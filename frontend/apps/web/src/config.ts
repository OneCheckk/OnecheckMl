/** Runtime flags derived from the existing Vite environment variables. */
export const IS_MOCK_MODE = import.meta.env.VITE_USE_MOCKS === 'true';
export const IS_DEV = !!import.meta.env.DEV;

/**
 * Upload constraints mirrored from the backend (src/config/upload.js and
 * .env.example). The server remains the authority; these values only drive
 * helper text and an early client-side check.
 */
export const UPLOAD_ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';
export const UPLOAD_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];
export const UPLOAD_MAX_MB = 15; // MAX_FILE_SIZE_MB in backend .env.example (server default may differ)
