/**
 * Regulatory Scheduler Service
 * Evaluates periodic rules using node-cron and effective simulated time:
 * - Alerts on impending document expiries (DOC_EXPIRING / DOC_EXPIRED)
 * - Flags stagnant source queries (PENDING_SOURCE_VERIFICATION)
 * - Flags overdue clarification responses (CLARIFICATION_DUE)
 */

const cron = require('node-cron');
const { Finding, VerificationEntry, Alert, Application } = require('../models');
const { getEffectiveNow } = require('./demoSettings.service');
const { computeApplicationSummary } = require('./summary.service');
const env = require('../config/env');
const logger = require('../config/logger');

let cronTask = null;

/**
 * Runs a single scheduler tick against effective simulated time
 */
async function runSchedulerTick() {
  const effectiveNow = getEffectiveNow();
  let createdAlerts = 0;

  try {
    // 1. Process Findings with upcoming or passed expiry alerts
    const alertFindings = await Finding.find({
      alertAt: { $ne: null, $lte: effectiveNow },
      $or: [{ 'disposition.state': 'OPEN' }, { state: 'OPEN' }]
    });

    for (const finding of alertFindings) {
      // Check if alert already raised for this finding
      const existingAlert = await Alert.findOne({
        application: finding.applicationId,
        refType: 'Finding',
        refId: finding._id.toString()
      });

      if (!existingAlert) {
        await Alert.create({
          application: finding.applicationId,
          applicationId: finding.applicationId,
          type: 'DOC_EXPIRING',
          severity: finding.severity || 'HIGH',
          title: `Validity alert: ${finding.title}`,
          message: finding.message,
          refType: 'Finding',
          refId: finding._id.toString(),
          dueAt: finding.alertAt,
          status: 'OPEN'
        });
        createdAlerts += 1;
        await computeApplicationSummary(finding.applicationId);
      }
    }

    // 2. Process stagnant external source verifications
    const pendingMinutes = env.PENDING_ALERT_MINUTES || 15;
    const pendingCutoff = new Date(effectiveNow.getTime() - pendingMinutes * 60 * 1000);

    const stagnantEntries = await VerificationEntry.find({
      status: 'VERIFICATION_PENDING',
      requestedAt: { $lt: pendingCutoff }
    });

    for (const entry of stagnantEntries) {
      const existingAlert = await Alert.findOne({
        application: entry.applicationId,
        refType: 'VerificationEntry',
        refId: entry._id.toString()
      });

      if (!existingAlert) {
        await Alert.create({
          application: entry.applicationId,
          applicationId: entry.applicationId,
          type: 'PENDING_SOURCE_VERIFICATION',
          severity: 'MEDIUM',
          title: 'External source verification is delayed',
          message: `Verification check ${entry.checkType} has been pending for more than ${pendingMinutes} minutes.`,
          refType: 'VerificationEntry',
          refId: entry._id.toString(),
          status: 'OPEN'
        });
        createdAlerts += 1;
        await computeApplicationSummary(entry.applicationId);
      }
    }

    return {
      success: true,
      effectiveNow: effectiveNow.toISOString(),
      createdAlerts,
      evaluatedFindings: alertFindings.length,
      stagnantEntries: stagnantEntries.length
    };
  } catch (err) {
    logger.error(`Error during regulatory scheduler tick: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Starts periodic scheduler (runs every minute)
 */
function startScheduler(cronExpression = '* * * * *') {
  if (cronTask) return;
  logger.info(`Starting Regulatory Scheduler (${cronExpression})`);
  cronTask = cron.schedule(cronExpression, runSchedulerTick);
}

/**
 * Stops periodic scheduler
 */
function stopScheduler() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    logger.info('Regulatory Scheduler stopped');
  }
}

module.exports = {
  startScheduler,
  stopScheduler,
  runSchedulerTick
};
