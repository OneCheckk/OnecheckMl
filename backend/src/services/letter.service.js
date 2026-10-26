/**
 * Deficiency Letter Service
 * Generates official regulatory deficiency letters using Handlebars templates,
 * tracks draft letters, and dispatches them with status transitions and audit logging.
 */

const mongoose = require('mongoose');
const Handlebars = require('handlebars');
const { Letter, Application, Finding, Institution } = require('../models');
const { logEvent } = require('./audit.service');
const ApiError = require('../utils/ApiError');

const DEFICIENCY_LETTER_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Times New Roman', Times, serif; margin: 40px; color: #1a1a1a; line-height: 1.6; }
    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 30px; }
    .header h2 { margin: 0; text-transform: uppercase; font-size: 18px; }
    .header p { margin: 5px 0 0 0; font-size: 14px; }
    .meta-table { width: 100%; margin-bottom: 25px; border-collapse: collapse; }
    .meta-table td { padding: 4px 0; font-size: 14px; }
    .finding-box { border: 1px solid #d32f2f; background: #fff5f5; padding: 12px; margin-bottom: 15px; border-radius: 4px; }
    .finding-title { font-weight: bold; color: #d32f2f; }
    .clause { font-size: 12px; color: #555; }
    .notice { margin-top: 30px; padding: 15px; background: #f9f9f9; border-left: 4px solid #1976d2; }
    .signature { margin-top: 40px; float: right; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <h2>All India Council for Technical Education</h2>
    <p>Nelson Mandela Marg, Vasant Kunj, New Delhi - 110070</p>
    <p><strong>REGULATORY COMPLIANCE & DEFICIENCY NOTICE</strong></p>
  </div>

  <table class="meta-table">
    <tr><td><strong>To:</strong> The Director / Principal</td><td><strong>Date:</strong> {{issueDate}}</td></tr>
    <tr><td><strong>Institution:</strong> {{institutionName}}</td><td><strong>Application No:</strong> {{applicationNumber}}</td></tr>
    <tr><td><strong>AICTE Permanent ID:</strong> {{aicteId}}</td><td><strong>Academic Session:</strong> {{academicYear}}</td></tr>
  </table>

  <p>Sir/Madam,</p>
  <p>During the automated and regulatory scrutiny of your Extension of Approval (EoA) application, the following regulatory deficiencies and discrepancies were observed under the Approval Process Handbook:</p>

  {{#each deficiencies}}
  <div class="finding-box">
    <div class="finding-title">[{{ruleId}}] ({{severity}}) - {{title}}</div>
    <div class="clause">Regulatory Handbook Clause: {{clauseRef}}</div>
    <p>{{message}}</p>
    {{#if proofStatement}}
    <small><strong>Evidence Statement:</strong> {{proofStatement}}</small>
    {{/if}}
  </div>
  {{/each}}

  <div class="notice">
    <strong>MANDATORY ACTION REQUIRED:</strong><br/>
    You are hereby directed to rectify the above-listed deficiencies and submit your compliance representation / corrected documents via the OneCheck portal within <strong>15 days</strong> of issuance of this notice (on or before <strong>{{deadlineDate}}</strong>). Failure to respond within the stipulated timeline may lead to adverse regulatory recommendations.
  </div>

  <div class="signature">
    <p>By Order of the Competent Authority,<br/><br/><strong>Scrutiny Officer / Regional Director</strong><br/>AICTE Regulatory Verification Division</p>
  </div>
</body>
</html>
`;

const compiledTemplate = Handlebars.compile(DEFICIENCY_LETTER_TEMPLATE);

/**
 * Creates draft deficiency letter
 */
async function createDeficiencyLetter(user, applicationId, { findingIds = [] }, requestId = null) {
  const application = await Application.findByIdOrNumber(applicationId).populate('institution');
  if (!application) {
    throw ApiError.notFound('Application not found');
  }

  // Scoping check
  if (user.role === 'INSTITUTION' || user.role === 'INSTITUTION_USER') {
    throw ApiError.forbidden('Only regulatory officers can generate deficiency letters.');
  }

  // Fetch target findings
  let findingsQuery = { applicationId: application._id };
  if (findingIds && findingIds.length > 0) {
    const validObjectIds = findingIds.filter((id) => mongoose.isValidObjectId(id));
    findingsQuery.$or = [
      { _id: { $in: validObjectIds } },
      { findingId: { $in: findingIds } }
    ];
  } else {
    findingsQuery.severity = { $in: ['HIGH', 'CRITICAL', 'MEDIUM'] };
  }

  const findings = await Finding.find(findingsQuery);
  if (findings.length === 0) {
    throw ApiError.badRequest('No regulatory findings available to include in deficiency letter.');
  }

  const now = new Date();
  const deadline = new Date(now.getTime() + 15 * 86400000);

  const templateData = {
    issueDate: now.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }),
    deadlineDate: deadline.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }),
    institutionName: application.institution?.name || 'Apex Institute of Technology',
    aicteId: application.institution?.aicteId || 'AICTE-DEL-2026-01',
    applicationNumber: application.applicationNumber,
    academicYear: application.academicYear,
    deficiencies: findings.map((f) => ({
      ruleId: f.ruleId,
      severity: f.severity,
      title: f.title,
      clauseRef: f.clauseRef,
      message: f.message,
      proofStatement: f.proof?.statement || null
    }))
  };

  const renderedHtml = compiledTemplate(templateData);

  const letter = await Letter.create({
    applicationId: application._id,
    findingIds: findings.map((f) => f._id.toString()),
    body: renderedHtml,
    status: 'DRAFT',
    createdBy: user._id
  });

  return letter;
}

/**
 * Retrieves letters for an application with access control
 */
async function getLettersByApplication(user, applicationId) {
  const application = await Application.findByIdOrNumber(applicationId);
  if (!application) {
    throw ApiError.notFound('Application not found');
  }

  // Scoping check
  if (user.role === 'INSTITUTION' || user.role === 'INSTITUTION_USER') {
    const userInstId = user.institutionId || user.institution?._id || user.institution;
    const appInstId = application.institutionId || application.institution?._id || application.institution;
    if (!userInstId || !appInstId || userInstId.toString() !== appInstId.toString()) {
      throw ApiError.forbidden('Access denied');
    }
  }

  return Letter.find({ applicationId: application._id }).sort({ createdAt: -1 });
}

/**
 * Dispatches letter, marks SENT, transitions application to DEFICIENCY_RAISED, and logs audit
 */
async function sendLetter(user, letterId, requestId = null) {
  const letter = await Letter.findById(letterId);
  if (!letter) {
    throw ApiError.notFound('Deficiency letter not found');
  }

  if (user.role === 'INSTITUTION' || user.role === 'INSTITUTION_USER') {
    throw ApiError.forbidden('Only regulatory officers can dispatch deficiency letters.');
  }

  letter.status = 'SENT';
  letter.sentAt = new Date();
  await letter.save();

  // Transition application state
  const application = await Application.findById(letter.applicationId);
  if (application) {
    application.status = 'DEFICIENCY_RAISED';
    await application.save();
  }

  await logEvent({
    actorUser: user._id,
    action: 'LETTER_SENT',
    entityType: 'Letter',
    entityId: letter._id,
    application: letter.applicationId,
    requestId,
    outcome: 'SUCCESS',
    metadata: {
      letterId: letter._id,
      findingsCount: letter.findingIds.length
    }
  });

  return letter;
}

module.exports = {
  createDeficiencyLetter,
  getLettersByApplication,
  sendLetter
};
