const express = require('express');
const router = express.Router();

const CATEGORIES = [
  { id: 'ENGINEERING_UNDERGRADUATE', name: 'Engineering & Technology (Undergraduate / B.Tech)', checklistCount: 4 },
  { id: 'MANAGEMENT_POSTGRADUATE', name: 'Management Studies (Postgraduate / MBA)', checklistCount: 2 },
  { id: 'PHARMACY_DIPLOMA', name: 'Pharmacy & Medical Sciences (Diploma / B.Pharm)', checklistCount: 3 },
  { id: 'EOA_CONTINUATION', name: 'Extension of Approval (Continuation)', checklistCount: 4 },
  { id: 'EOA_INTAKE_INCREASE', name: 'Extension of Approval (Intake Increase)', checklistCount: 4 },
  { id: 'EOA_NEW_COURSE', name: 'Extension of Approval (New Course)', checklistCount: 4 }
];

// GET /api/categories
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    data: CATEGORIES
  });
});

module.exports = router;
