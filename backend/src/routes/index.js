const express = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const institutionRoutes = require('./institution.routes');
const applicationRoutes = require('./application.routes');
const documentRoutes = require('./document.routes');
const facultyRoutes = require('./faculty.routes');
const forensicsRoutes = require('./forensics.routes');
const scoreRoutes = require('./score.routes');
const alertRoutes = require('./alert.routes');
const dashboardRoutes = require('./dashboard.routes');
const claimRoutes = require('./claim.routes');
const findingRoutes = require('./finding.routes');
const ledgerRoutes = require('./ledger.routes');

const router = express.Router();

// All Canonical & Spec REST Endpoints
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/institutions', institutionRoutes);
router.use('/applications', applicationRoutes);
router.use('/documents', documentRoutes);
router.use('/claims', claimRoutes);
router.use('/findings', findingRoutes);
router.use('/ledger', ledgerRoutes);

const categoryRoutes = require('./category.routes');
const letterRoutes = require('./letter.routes');
router.use('/categories', categoryRoutes);
router.use('/letters', letterRoutes);
router.use('/faculty', facultyRoutes);
router.use('/forensics', forensicsRoutes);
router.use('/score', scoreRoutes);
router.use('/alerts', alertRoutes);
router.use('/dashboard', dashboardRoutes);

const auditRoutes = require('./audit.routes');
const auditController = require('../controllers/audit.controller');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');

router.use('/audit', auditRoutes);

const demoRoutes = require('./demo.routes');
const { subscribe } = require('../services/sse.service');

router.use('/demo', demoRoutes);

// Spec SSE Endpoint: GET /api/events (Live streaming event stream)
router.get('/events', subscribe);

const adminRoutes = require('./admin.routes');
const benchmarkRoutes = require('./benchmark.routes');

router.use('/admin', adminRoutes);
router.use('/benchmark', benchmarkRoutes);

// Spec Dev Tamper Endpoint: POST /api/dev/tamper-audit (DEMO_MODE / test only)
router.post(
  '/dev/tamper-audit',
  authenticate,
  authorize('ADMIN'),
  auditController.tamperAudit
);

module.exports = router;
