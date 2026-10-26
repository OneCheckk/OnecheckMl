/**
 * Background Job Runner Service
 * Strictly adheres to Section 0.8 & Part 4 contract:
 * - 1-second polling on Job collection
 * - Atomic findOneAndUpdate locking
 * - Reclaims jobs locked > 5 minutes
 * - 3 retries with backoff delays of 5s, 20s, 80s
 * - Handles ANALYZE_DOC, RECONCILE_APP, VERIFY_SOURCES
 */

const { Job } = require('../models');
const logger = require('../config/logger');
const {
  handleAnalyzeDoc,
  onAnalyzeDocFailed,
  handleReconcileApp,
  handleVerifySources
} = require('./jobHandlers.service');

const HANDLERS = {
  ANALYZE_DOC: handleAnalyzeDoc,
  RECONCILE_APP: handleReconcileApp,
  VERIFY_SOURCES: handleVerifySources
};

const BACKOFF_DELAYS_SEC = [5, 20, 80];
const STUCK_JOB_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

let intervalTimer = null;
let isProcessing = false;

/**
 * Reclaims jobs stuck in RUNNING state beyond lock threshold
 */
async function reclaimStuckJobs() {
  try {
    const cutoff = new Date(Date.now() - STUCK_JOB_TIMEOUT_MS);
    const result = await Job.updateMany(
      {
        status: 'RUNNING',
        lockedAt: { $lt: cutoff }
      },
      {
        $set: {
          status: 'QUEUED',
          lockedAt: null,
          lastError: 'Job reclaimed from abandoned lock'
        }
      }
    );

    if (result.modifiedCount > 0) {
      logger.warn(`Reclaimed ${result.modifiedCount} stuck background jobs`);
    }
  } catch (err) {
    logger.error(`Error reclaiming stuck jobs: ${err.message}`);
  }
}

/**
 * Atomically acquires and processes the next eligible queued job
 * Returns the processed job or null if no eligible job was available
 */
async function processNextJob() {
  await reclaimStuckJobs();

  // Find next eligible candidate
  const candidate = await Job.findOne({
    status: 'QUEUED',
    runAfter: { $lte: new Date() }
  }).sort({ runAfter: 1, createdAt: 1 });

  if (!candidate) {
    return null;
  }

  // Atomically lock the candidate
  const job = await Job.findOneAndUpdate(
    { _id: candidate._id, status: 'QUEUED' },
    {
      $set: {
        status: 'RUNNING',
        lockedAt: new Date()
      },
      $inc: { attempts: 1 }
    },
    { new: true }
  );

  if (!job) {
    // Another worker grabbed it
    return null;
  }

  const handler = HANDLERS[job.type];
  if (!handler) {
    logger.error(`No handler registered for job type: ${job.type}`);
    job.status = 'FAILED';
    job.lastError = `Unrecognized job type: ${job.type}`;
    job.lockedAt = null;
    await job.save();
    return job;
  }

  try {
    await handler(job.payload);
    job.status = 'DONE';
    job.lockedAt = null;
    job.lastError = null;
    await job.save();
    logger.info(`Job ${job._id} [${job.type}] completed successfully`);
    return job;
  } catch (err) {
    logger.warn(`Job ${job._id} [${job.type}] attempt ${job.attempts} failed: ${err.message}`);

    if (job.attempts < job.maxAttempts) {
      const delaySec = BACKOFF_DELAYS_SEC[job.attempts - 1] || 80;
      job.status = 'QUEUED';
      job.runAfter = new Date(Date.now() + delaySec * 1000);
      job.lockedAt = null;
      job.lastError = err.message;
      await job.save();
    } else {
      job.status = 'FAILED';
      job.lockedAt = null;
      job.lastError = err.message;
      await job.save();

      // Terminal failure triggers
      if (job.type === 'ANALYZE_DOC') {
        await onAnalyzeDocFailed(job.payload, err);
      }
    }
    return job;
  }
}

/**
 * Worker tick: processes all available jobs in a loop until queue is empty
 */
async function runnerTick() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    let job = null;
    do {
      job = await processNextJob();
    } while (job !== null);
  } catch (err) {
    logger.error(`Unhandled error during runner tick: ${err.message}`);
  } finally {
    isProcessing = false;
  }
}

/**
 * Starts the periodic job runner
 */
function startJobRunner(intervalMs = 1000) {
  if (intervalTimer) return;
  logger.info(`Starting OneCheck background job runner (interval ${intervalMs}ms)`);
  intervalTimer = setInterval(runnerTick, intervalMs);
}

/**
 * Stops the periodic job runner
 */
function stopJobRunner() {
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
    logger.info('OneCheck background job runner stopped');
  }
}

module.exports = {
  startJobRunner,
  stopJobRunner,
  processNextJob,
  reclaimStuckJobs
};
