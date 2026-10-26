/**
 * Benchmark Controller
 * Handles regulatory AI synthetic benchmark dataset generation and scoring
 */

const mlClient = require('../services/mlClient.service');

const benchmarkRuns = [];

async function runBenchmark(req, res, next) {
  try {
    const { n = 2, seed = 42 } = req.body;

    // 1. Generate benchmark dataset via ML client
    const genRes = await mlClient.generateBenchmark({ n, seed }, req.requestId);

    // 2. Score benchmark results
    const scoreRes = await mlClient.scoreBenchmark({ runId: genRes.runId }, req.requestId);

    const record = {
      runId: genRes.runId,
      seed,
      appsCount: genRes.appsCount,
      manifestHash: genRes.manifestHash,
      scores: scoreRes,
      executedAt: new Date().toISOString()
    };

    benchmarkRuns.unshift(record);

    res.status(200).json({
      success: true,
      message: 'Benchmark evaluation completed successfully',
      data: record
    });
  } catch (err) {
    next(err);
  }
}

async function listBenchmarkRuns(req, res, next) {
  try {
    res.status(200).json({
      success: true,
      data: benchmarkRuns
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  runBenchmark,
  listBenchmarkRuns
};
