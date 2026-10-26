const env = require('../config/env');
const logger = require('../config/logger');

class VerificationClient {
  constructor() {
    this.baseUrl = env.VERIFICATION_SERVICE_URL;
    this.timeoutMs = env.VERIFICATION_TIMEOUT_MS;
    this.isMock = env.MOCK_VERIFICATION_SERVICE;
  }

  /**
   * Helper to execute HTTP request with timeout and error normalization
   */
  async _request(endpoint, payload) {
    if (this.isMock) {
      return this._mockResponse(endpoint, payload);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return {
          success: false,
          errorCode: 'SERVICE_ERROR',
          errorMessage: `FastAPI verification service returned HTTP ${response.status}`,
          status: 'UNAVAILABLE'
        };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (err) {
      clearTimeout(timeout);
      const isTimeout = err.name === 'AbortError';
      logger.warn(`Verification service call failed: ${endpoint}`, {
        isTimeout,
        error: err.message,
        suppressInTest: true
      });

      return {
        success: false,
        errorCode: isTimeout ? 'TIMEOUT' : 'CONNECTION_REFUSED',
        errorMessage: isTimeout
          ? 'Verification request timed out'
          : 'Unable to connect to FastAPI verification service',
        status: 'UNAVAILABLE'
      };
    }
  }

  /**
   * 1. Extract Document Text (OCR)
   */
  async extractDocumentText(storageKey, documentType = 'GENERAL_DOCUMENT') {
    const res = await this._request('/api/ocr', { storageKey, documentType });
    if (!res.success) {
      return {
        status: res.status,
        errorCode: res.errorCode,
        errorMessage: res.errorMessage,
        text: null,
        fields: {},
        dates: [],
        confidence: 0
      };
    }
    return {
      status: 'SUCCEEDED',
      text: res.data.text || '',
      fields: res.data.fields || {},
      dates: res.data.dates || [],
      certificateNumber: res.data.certificateNumber || null,
      confidence: res.data.confidence ?? 0.95,
      providerVersion: res.data.providerVersion || 'fastapi-ocr-v1'
    };
  }

  /**
   * 2. Analyze Tampering (ELA)
   */
  async analyzeTampering(storageKey) {
    const res = await this._request('/api/ela', { storageKey });
    if (!res.success) {
      return {
        status: res.status,
        errorCode: res.errorCode,
        errorMessage: res.errorMessage,
        score: 0,
        suspected: false,
        regions: []
      };
    }
    return {
      status: 'SUCCEEDED',
      score: res.data.score || 0.05,
      suspected: res.data.suspected || false,
      regions: res.data.regions || [],
      methodVersion: res.data.methodVersion || 'ela-v1'
    };
  }

  /**
   * 3. Extract Photo Metadata (EXIF GPS)
   */
  async extractPhotoMetadata(storageKey) {
    const res = await this._request('/api/exif', { storageKey });
    if (!res.success) {
      return {
        status: res.status,
        errorCode: res.errorCode,
        errorMessage: res.errorMessage,
        gpsLatitude: null,
        gpsLongitude: null
      };
    }
    return {
      status: 'SUCCEEDED',
      gpsLatitude: res.data.gpsLatitude ?? null,
      gpsLongitude: res.data.gpsLongitude ?? null,
      capturedAt: res.data.capturedAt || null
    };
  }

  /**
   * 4. Compute Perceptual Hash
   */
  async computePerceptualHash(storageKey) {
    const res = await this._request('/api/phash', { storageKey });
    if (!res.success) {
      return {
        status: res.status,
        errorCode: res.errorCode,
        errorMessage: res.errorMessage,
        imageHash: null
      };
    }
    return {
      status: 'SUCCEEDED',
      imageHash: res.data.imageHash || null,
      methodVersion: 'dhash-v1'
    };
  }

  /**
   * 5. Match Faculty Names (Fuzzy Matching)
   */
  async matchFacultyNames(normalizedNames = []) {
    const res = await this._request('/api/faculty-match', { normalizedNames });
    if (!res.success) {
      return {
        status: res.status,
        matches: []
      };
    }
    return {
      status: 'SUCCEEDED',
      matches: res.data.matches || []
    };
  }

  /**
   * 6. Authority Document Verification (DigiLocker/QR)
   * PDF Section 1: "No fake authority verification: DigiLocker, QR/PKI or government integrations
   * must be represented as adapters with explicit configuration and a safe 'NOT_CONFIGURED' result
   * until credentials and official API specifications are supplied."
   */
  async verifyAuthorityDocument(documentType, documentRef) {
    // Authority providers are not configured with government credentials in this environment
    return {
      status: 'NOT_CONFIGURED',
      provider: 'OFFICIAL_AUTHORITY_API',
      reference: documentRef || null,
      evidence: null,
      errorMessage: 'Authority verification provider is not configured. Credentials pending government integration.'
    };
  }

  /**
   * Mock responder for offline unit/integration testing
   */
  _mockResponse(endpoint, payload) {
    if (endpoint === '/api/ocr') {
      return {
        success: true,
        data: {
          text: 'Extracted regulatory compliance text and certificate details.',
          fields: { institutionName: 'Sample Institute', registrationNumber: 'REG-12345' },
          dates: ['2026-06-30'],
          certificateNumber: 'CERT-2026-XYZ',
          confidence: 0.98,
          providerVersion: 'mock-ocr-v1'
        }
      };
    }

    if (endpoint === '/api/ela') {
      return {
        success: true,
        data: {
          score: 0.08,
          suspected: false,
          regions: [],
          methodVersion: 'mock-ela-v1'
        }
      };
    }

    if (endpoint === '/api/exif') {
      return {
        success: true,
        data: {
          gpsLatitude: 28.6315,
          gpsLongitude: 77.2167,
          capturedAt: new Date().toISOString()
        }
      };
    }

    if (endpoint === '/api/phash') {
      return {
        success: true,
        data: {
          imageHash: 'dhash_a1b2c3d4e5f60718'
        }
      };
    }

    if (endpoint === '/api/faculty-match') {
      return {
        success: true,
        data: {
          matches: []
        }
      };
    }

    return { success: false, status: 'UNAVAILABLE', errorCode: 'NOT_IMPLEMENTED', errorMessage: 'Mock endpoint not implemented' };
  }
}

const verificationClient = new VerificationClient();

module.exports = verificationClient;
