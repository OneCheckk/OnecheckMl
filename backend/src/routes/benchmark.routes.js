const express = require('express');
const benchmarkController = require('../controllers/benchmark.controller');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');

const router = express.Router();

// Benchmark endpoints (OFFICER / AUDITOR / ADMIN)
router.use(authenticate, authorize('OFFICER', 'SCRUTINY_OFFICER', 'REGIONAL_DIRECTOR', 'AUDITOR', 'ADMIN'));

router.post('/run', benchmarkController.runBenchmark);
router.get('/runs', benchmarkController.listBenchmarkRuns);

module.exports = router;
