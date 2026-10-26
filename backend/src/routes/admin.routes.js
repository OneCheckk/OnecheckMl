const express = require('express');
const adminController = require('../controllers/admin.controller');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');

const router = express.Router();

// All Admin routes require ADMIN role
router.use(authenticate, authorize('ADMIN'));

// Rulepack Management
router.get('/rulepacks', adminController.listRulepacks);
router.post('/rulepacks', adminController.createRulepack);
router.post('/rulepacks/:version/activate', adminController.activateRulepack);

// Checklist Management
router.get('/checklists', adminController.listChecklists);
router.put('/checklists/:category', adminController.updateChecklist);

// User Management
router.get('/users', adminController.listUsers);
router.post('/users', adminController.createUser);
router.patch('/users/:id', adminController.updateUser);

module.exports = router;
