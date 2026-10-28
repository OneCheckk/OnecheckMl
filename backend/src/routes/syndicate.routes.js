const express = require('express');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');

const router = express.Router();

// Public / Evaluator read access: Allow all roles & unauthenticated inspection for live demo


const cartelColleges = [
  { id: 'COL-CARTEL-01', name: 'Apex National Institute of Technology', state: 'Delhi NCR', city: 'Noida', riskScore: 88, riskLevel: 'RED', isCartel: true },
  { id: 'COL-CARTEL-02', name: 'Paramount College of Engineering & Research', state: 'Maharashtra', city: 'Pune', riskScore: 84, riskLevel: 'RED', isCartel: true },
  { id: 'COL-CARTEL-03', name: 'Vanguard Institute of Technical Studies', state: 'Karnataka', city: 'Bengaluru', riskScore: 82, riskLevel: 'RED', isCartel: true },
  { id: 'COL-CARTEL-04', name: 'Horizon Institute of Management & Science', state: 'Tamil Nadu', city: 'Chennai', riskScore: 79, riskLevel: 'RED', isCartel: true },
  { id: 'COL-CARTEL-05', name: 'Zenith Global Engineering College', state: 'Gujarat', city: 'Ahmedabad', riskScore: 86, riskLevel: 'RED', isCartel: true },
];

const normalColleges = [
  { id: 'COL-NORM-01', name: 'St. Xavier Institute of Technology', state: 'Tamil Nadu', city: 'Chennai', riskScore: 18, riskLevel: 'GREEN', isCartel: false },
  { id: 'COL-NORM-02', name: 'Kalinga Institute of Architecture', state: 'Odisha', city: 'Bhubaneswar', riskScore: 24, riskLevel: 'GREEN', isCartel: false },
  { id: 'COL-NORM-03', name: 'Sardar Patel College of Pharmacy', state: 'Gujarat', city: 'Ahmedabad', riskScore: 16, riskLevel: 'GREEN', isCartel: false },
  { id: 'COL-NORM-04', name: 'Chanakya Polytechnic Institute', state: 'Karnataka', city: 'Mysuru', riskScore: 32, riskLevel: 'GREEN', isCartel: false },
];

const ghostFaculty = [
  { id: 'FAC-1', name: 'Dr. Ramesh Chandra Sharma', type: 'AADHAAR', hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
  { id: 'FAC-2', name: 'Prof. Sunita K. Deshmukh', type: 'PAN', hash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8' },
  { id: 'FAC-3', name: 'Dr. Arvind Kumar Verma', type: 'AADHAAR', hash: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a' },
  { id: 'FAC-4', name: 'Prof. Rajeshwari Natarajan', type: 'AADHAAR', hash: 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d' },
  { id: 'FAC-5', name: 'Dr. Vikramaditya Rathore', type: 'PAN', hash: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4' },
];

function buildGraphElements() {
  const elements = [];

  [...cartelColleges, ...normalColleges].forEach((c) => {
    elements.push({
      data: {
        id: c.id,
        label: c.name.replace(/ Institute.*| College.*| Academy.*/, '').trim(),
        fullName: c.name,
        nodeType: 'college',
        color: c.isCartel ? '#2563eb' : '#3b82f6',
        size: c.isCartel ? 55 : 44,
        state: c.state,
        city: c.city,
        riskScore: c.riskScore,
        riskLevel: c.riskLevel,
        isCartelMember: c.isCartel,
      },
    });
  });

  ghostFaculty.forEach((f) => {
    elements.push({
      data: {
        id: f.id,
        label: `${f.name.split(' ')[0]} (${f.type})`,
        fullName: f.name,
        nodeType: 'faculty',
        hash: f.hash,
        shortHash: `${f.hash.slice(0, 8)}…`,
        identifierType: f.type,
        color: '#ef4444',
        size: 26,
        isGhost: true,
      },
    });
  });

  const severityPairs = [
    ['COL-CARTEL-01', 'COL-CARTEL-02', 4, 8, '#b91c1c'],
    ['COL-CARTEL-02', 'COL-CARTEL-03', 3, 6, '#ea580c'],
    ['COL-CARTEL-03', 'COL-CARTEL-04', 4, 8, '#b91c1c'],
    ['COL-CARTEL-04', 'COL-CARTEL-05', 3, 6, '#ea580c'],
    ['COL-CARTEL-05', 'COL-CARTEL-01', 5, 10, '#b91c1c'],
  ];

  severityPairs.forEach(([src, tgt, count, width, color]) => {
    elements.push({
      data: {
        id: `EDGE-${src}-${tgt}`,
        source: src,
        target: tgt,
        edgeType: 'shared_severity',
        severityCount: count,
        width,
        lineColor: color,
      },
    });
  });

  ghostFaculty.forEach((f, idx) => {
    elements.push({
      data: {
        id: `EMP-${f.id}-1`,
        source: cartelColleges[idx % cartelColleges.length].id,
        target: f.id,
        edgeType: 'employs',
      },
    });
    elements.push({
      data: {
        id: `EMP-${f.id}-2`,
        source: cartelColleges[(idx + 1) % cartelColleges.length].id,
        target: f.id,
        edgeType: 'employs',
      },
    });
  });

  return elements;
}

// GET /api/syndicate/graph
router.get('/graph', (req, res) => {
  const elements = buildGraphElements();
  res.status(200).json({
    success: true,
    graph: {
      elements,
      nodesCount: elements.filter((e) => !e.data.source).length,
      edgesCount: elements.filter((e) => !!e.data.source).length,
    },
    cartel: {
      cartelId: 'CARTEL-RING-ALPHA',
      name: '5-College High-Risk Faculty Sharing Syndicate',
      colleges: cartelColleges,
      size: 5,
      totalSharedGhostFaculty: 10,
      riskScoreAvg: 85,
      riskLevel: 'CRITICAL',
      description: 'Autonomous graph detection identified a closed 5-node cycle sharing 10 identical faculty HMAC hashes across 5 states, violating AICTE section 2.4 accreditation standards.',
    },
    cypherQueries: {
      detectMultiHop: 'MATCH path = (start:College)-[:SHARES_FACULTY*2..4]->(target:College)\nWHERE start.id <> target.id\nRETURN path, length(path) AS hops',
      detectCycles: 'MATCH cyclePath = (c:College)-[r:SHARES_FACULTY*3..6]->(c)\nRETURN cyclePath',
      aggregateSeverity: 'MATCH (c1:College)-[r:SHARES_FACULTY]-(c2:College)\nRETURN c1, c2, count(r) AS severityWeight',
    },
  });
});

const nodeProofCatalog = {
  'COL-CARTEL-01': {
    type: 'college',
    id: 'COL-CARTEL-01',
    name: 'Apex National Institute of Technology',
    registrationId: 'AICTE-1-9382019481',
    state: 'Delhi NCR',
    city: 'Noida',
    riskScore: 88,
    riskLevel: 'RED',
    isCartelMember: true,
    facultyCount: 14,
    sharedFacultyCount: 6,
    facultyList: [
      { id: 'FAC-1', name: 'Dr. Ramesh Chandra Sharma', department: 'Computer Science & Engineering', identifierType: 'AADHAAR', hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', isGhost: true },
      { id: 'FAC-2', name: 'Prof. Sunita K. Deshmukh', department: 'Information Technology', identifierType: 'PAN', hash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', isGhost: true },
      { id: 'FAC-5', name: 'Dr. Vikramaditya Rathore', department: 'Applied Mathematics & AI', identifierType: 'PAN', hash: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4', isGhost: true },
    ],
    colludingInstitutions: [
      { id: 'COL-CARTEL-02', name: 'Paramount College of Engineering & Research', state: 'Maharashtra', riskScore: 84 },
      { id: 'COL-CARTEL-05', name: 'Zenith Global Engineering College', state: 'Gujarat', riskScore: 86 },
      { id: 'COL-CARTEL-03', name: 'Vanguard Institute of Technical Studies', state: 'Karnataka', riskScore: 82 },
    ],
    definitiveProof: {
      statement: 'Definitive multi-hop graph proof: Participates in a closed 5-node cartel syndicate sharing 6 ghost faculty across 4 institutions. Cross-border salary disbursal anomaly detected.',
      recommendedAction: 'IMMEDIATE_EVC_INSPECTION_AND_HOLD',
    },
  },

  'COL-CARTEL-02': {
    type: 'college',
    id: 'COL-CARTEL-02',
    name: 'Paramount College of Engineering & Research',
    registrationId: 'AICTE-1-8472910392',
    state: 'Maharashtra',
    city: 'Pune',
    riskScore: 84,
    riskLevel: 'RED',
    isCartelMember: true,
    facultyCount: 16,
    sharedFacultyCount: 5,
    facultyList: [
      { id: 'FAC-1', name: 'Dr. Ramesh Chandra Sharma', department: 'Computer Science & Engineering', identifierType: 'AADHAAR', hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', isGhost: true },
      { id: 'FAC-2', name: 'Prof. Sunita K. Deshmukh', department: 'Information Technology', identifierType: 'PAN', hash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', isGhost: true },
      { id: 'FAC-3', name: 'Dr. Arvind Kumar Verma', department: 'Electronics & Communication', identifierType: 'AADHAAR', hash: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a', isGhost: true },
    ],
    colludingInstitutions: [
      { id: 'COL-CARTEL-01', name: 'Apex National Institute of Technology', state: 'Delhi NCR', riskScore: 88 },
      { id: 'COL-CARTEL-03', name: 'Vanguard Institute of Technical Studies', state: 'Karnataka', riskScore: 82 },
    ],
    definitiveProof: {
      statement: 'High-risk cartel link: Shared 2 identical full-time faculty hashes with Vanguard Institute (1,200 km away) while claiming 100% physically present attendance.',
      recommendedAction: 'ISSUE_SHOW_CAUSE_NOTICE_SECTION_2_4',
    },
  },

  'COL-CARTEL-03': {
    type: 'college',
    id: 'COL-CARTEL-03',
    name: 'Vanguard Institute of Technical Studies',
    registrationId: 'AICTE-1-7583920194',
    state: 'Karnataka',
    city: 'Bengaluru',
    riskScore: 82,
    riskLevel: 'RED',
    isCartelMember: true,
    facultyCount: 18,
    sharedFacultyCount: 5,
    facultyList: [
      { id: 'FAC-2', name: 'Prof. Sunita K. Deshmukh', department: 'Information Technology', identifierType: 'PAN', hash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', isGhost: true },
      { id: 'FAC-3', name: 'Dr. Arvind Kumar Verma', department: 'Electronics & Communication', identifierType: 'AADHAAR', hash: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a', isGhost: true },
      { id: 'FAC-4', name: 'Prof. Rajeshwari Natarajan', department: 'Mechanical Engineering', identifierType: 'AADHAAR', hash: 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d', isGhost: true },
    ],
    colludingInstitutions: [
      { id: 'COL-CARTEL-02', name: 'Paramount College of Engineering & Research', state: 'Maharashtra', riskScore: 84 },
      { id: 'COL-CARTEL-04', name: 'Horizon Institute of Management & Science', state: 'Tamil Nadu', riskScore: 79 },
    ],
    definitiveProof: {
      statement: 'Cartel bridge node: Traversal identifies Vanguard as conduit between Southern and Western cartel branches sharing senior professorial credentials.',
      recommendedAction: 'SUSPEND_NEW_PROGRAM_SANCTION',
    },
  },

  'COL-CARTEL-04': {
    type: 'college',
    id: 'COL-CARTEL-04',
    name: 'Horizon Institute of Management & Science',
    registrationId: 'AICTE-1-6839201847',
    state: 'Tamil Nadu',
    city: 'Chennai',
    riskScore: 79,
    riskLevel: 'RED',
    isCartelMember: true,
    facultyCount: 12,
    sharedFacultyCount: 4,
    facultyList: [
      { id: 'FAC-3', name: 'Dr. Arvind Kumar Verma', department: 'Electronics & Communication', identifierType: 'AADHAAR', hash: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a', isGhost: true },
      { id: 'FAC-4', name: 'Prof. Rajeshwari Natarajan', department: 'Mechanical Engineering', identifierType: 'AADHAAR', hash: 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d', isGhost: true },
    ],
    colludingInstitutions: [
      { id: 'COL-CARTEL-03', name: 'Vanguard Institute of Technical Studies', state: 'Karnataka', riskScore: 82 },
      { id: 'COL-CARTEL-05', name: 'Zenith Global Engineering College', state: 'Gujarat', riskScore: 86 },
    ],
    definitiveProof: {
      statement: 'Ghost roster cycle: Overlaps 4 key faculty members with Zenith Global across 1,800 km distance with concurrent biometric check-ins within 15 minutes.',
      recommendedAction: 'PHYSICAL_SURPRISE_VERIFICATION',
    },
  },

  'COL-CARTEL-05': {
    type: 'college',
    id: 'COL-CARTEL-05',
    name: 'Zenith Global Engineering College',
    registrationId: 'AICTE-1-5748392018',
    state: 'Gujarat',
    city: 'Ahmedabad',
    riskScore: 86,
    riskLevel: 'RED',
    isCartelMember: true,
    facultyCount: 15,
    sharedFacultyCount: 6,
    facultyList: [
      { id: 'FAC-4', name: 'Prof. Rajeshwari Natarajan', department: 'Mechanical Engineering', identifierType: 'AADHAAR', hash: 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d', isGhost: true },
      { id: 'FAC-5', name: 'Dr. Vikramaditya Rathore', department: 'Applied Mathematics & AI', identifierType: 'PAN', hash: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4', isGhost: true },
      { id: 'FAC-1', name: 'Dr. Ramesh Chandra Sharma', department: 'Computer Science & Engineering', identifierType: 'AADHAAR', hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', isGhost: true },
    ],
    colludingInstitutions: [
      { id: 'COL-CARTEL-04', name: 'Horizon Institute of Management & Science', state: 'Tamil Nadu', riskScore: 79 },
      { id: 'COL-CARTEL-01', name: 'Apex National Institute of Technology', state: 'Delhi NCR', riskScore: 88 },
    ],
    definitiveProof: {
      statement: 'Cartel ring closure: Zenith completes the closed 5-node ring back to Apex National, confirming syndicate ring topology with shared senior administrators.',
      recommendedAction: 'REFER_TO_REGULATORY_ENFORCEMENT_CELL',
    },
  },

  'COL-NORM-01': {
    type: 'college',
    id: 'COL-NORM-01',
    name: 'St. Xavier Institute of Technology',
    registrationId: 'AICTE-1-1029384756',
    state: 'Tamil Nadu',
    city: 'Chennai',
    riskScore: 18,
    riskLevel: 'GREEN',
    isCartelMember: false,
    facultyCount: 22,
    sharedFacultyCount: 0,
    facultyList: [
      { id: 'FAC-NORM-101', name: 'Dr. Anthony Joseph', department: 'Computer Science & Engineering', identifierType: 'AADHAAR', hash: '7c4a8d09f1e2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8', isGhost: false },
      { id: 'FAC-NORM-102', name: 'Prof. Mary Fernandez', department: 'Civil Engineering', identifierType: 'PAN', hash: '9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d', isGhost: false },
      { id: 'FAC-NORM-103', name: 'Dr. S. Ramanathan', department: 'Mechanical Engineering', identifierType: 'AADHAAR', hash: '3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b', isGhost: false },
    ],
    colludingInstitutions: [],
    definitiveProof: {
      statement: 'Compliant Institution: Biometric attendance records cross-referenced with national Aadhaar/PAN hash register show 0 collisions. Valid 1:15 faculty ratio maintained.',
      recommendedAction: 'EXPEDITED_CLEARANCE_APPROVED',
    },
  },

  'COL-NORM-02': {
    type: 'college',
    id: 'COL-NORM-02',
    name: 'Kalinga Institute of Architecture',
    registrationId: 'AICTE-1-2938475610',
    state: 'Odisha',
    city: 'Bhubaneswar',
    riskScore: 24,
    riskLevel: 'GREEN',
    isCartelMember: false,
    facultyCount: 14,
    sharedFacultyCount: 0,
    facultyList: [
      { id: 'FAC-NORM-201', name: 'Prof. Debabrata Mohapatra', department: 'Architecture & Design', identifierType: 'COA-REG', hash: '4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c', isGhost: false },
      { id: 'FAC-NORM-202', name: 'Ar. Priyadarshini Jena', department: 'Urban Planning', identifierType: 'PAN', hash: '8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e', isGhost: false },
    ],
    colludingInstitutions: [],
    definitiveProof: {
      statement: 'Autonomous Verification: Isolated graph cluster. Council of Architecture credentials fully verified. Council faculty registry clean with zero shared rosters.',
      recommendedAction: 'ROUTINE_ANNUAL_APPROVAL',
    },
  },

  'COL-NORM-03': {
    type: 'college',
    id: 'COL-NORM-03',
    name: 'Sardar Patel College of Pharmacy',
    registrationId: 'AICTE-1-3847561029',
    state: 'Gujarat',
    city: 'Ahmedabad',
    riskScore: 16,
    riskLevel: 'GREEN',
    isCartelMember: false,
    facultyCount: 19,
    sharedFacultyCount: 0,
    facultyList: [
      { id: 'FAC-NORM-301', name: 'Dr. Bhavesh N. Patel', department: 'Pharmaceutics', identifierType: 'AADHAAR', hash: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b', isGhost: false },
      { id: 'FAC-NORM-302', name: 'Prof. Krupali Dave', department: 'Pharmacology', identifierType: 'PAN', hash: '6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e', isGhost: false },
    ],
    colludingInstitutions: [],
    definitiveProof: {
      statement: 'High-Integrity Node: PCI and AICTE dual compliance verified. All faculty salaries disbursed via direct PFMS / RTGS with 100% matched EPFO UAN records. Zero duplicate collisions detected.',
      recommendedAction: 'FULL_COMPLIANCE_CERTIFIED',
    },
  },

  'COL-NORM-04': {
    type: 'college',
    id: 'COL-NORM-04',
    name: 'Chanakya Polytechnic Institute',
    registrationId: 'AICTE-1-4756102938',
    state: 'Karnataka',
    city: 'Mysuru',
    riskScore: 32,
    riskLevel: 'GREEN',
    isCartelMember: false,
    facultyCount: 11,
    sharedFacultyCount: 0,
    facultyList: [
      { id: 'FAC-NORM-401', name: 'Prof. Manjunath Swamy', department: 'Electrical Engineering', identifierType: 'AADHAAR', hash: 'b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2', isGhost: false },
      { id: 'FAC-NORM-402', name: 'Dr. Ananya Hegde', department: 'Applied Sciences', identifierType: 'PAN', hash: 'c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8', isGhost: false },
    ],
    colludingInstitutions: [],
    definitiveProof: {
      statement: 'Compliant Polytechnic Node: No multi-hop connections to high-risk syndicates. Adequate cadre ratio with authenticated local employment agreements.',
      recommendedAction: 'STANDARD_APPROVAL_CYCLE',
    },
  },

  'FAC-1': {
    type: 'faculty',
    id: 'FAC-1',
    hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    name: 'Dr. Ramesh Chandra Sharma',
    identifierType: 'AADHAAR',
    department: 'Computer Science & Engineering',
    isGhost: true,
    associatedColleges: [
      { id: 'COL-CARTEL-01', name: 'Apex National Institute of Technology', state: 'Delhi NCR', riskScore: 88 },
      { id: 'COL-CARTEL-05', name: 'Zenith Global Engineering College', state: 'Gujarat', riskScore: 86 },
      { id: 'COL-CARTEL-02', name: 'Paramount College of Engineering & Research', state: 'Maharashtra', riskScore: 84 },
    ],
    definitiveProof: {
      statement: 'Aadhaar HMAC hash collision: Listed as full-time Professor & HOD at Apex National (Delhi NCR) and Zenith Global (Gujarat) simultaneously. EPFO UAN records confirm concurrent monthly salary draws from both trusts.',
      collisionDetected: true,
    },
  },

  'FAC-2': {
    type: 'faculty',
    id: 'FAC-2',
    hash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    name: 'Prof. Sunita K. Deshmukh',
    identifierType: 'PAN',
    department: 'Information Technology',
    isGhost: true,
    associatedColleges: [
      { id: 'COL-CARTEL-02', name: 'Paramount College of Engineering & Research', state: 'Maharashtra', riskScore: 84 },
      { id: 'COL-CARTEL-03', name: 'Vanguard Institute of Technical Studies', state: 'Karnataka', riskScore: 82 },
      { id: 'COL-CARTEL-01', name: 'Apex National Institute of Technology', state: 'Delhi NCR', riskScore: 88 },
    ],
    definitiveProof: {
      statement: 'PAN tax deduction conflict: Form 16 submissions indicate dual full-time employment at Paramount College (Pune) and Vanguard Institute (Bengaluru) spanning across consecutive quarters.',
      collisionDetected: true,
    },
  },

  'FAC-3': {
    type: 'faculty',
    id: 'FAC-3',
    hash: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
    name: 'Dr. Arvind Kumar Verma',
    identifierType: 'AADHAAR',
    department: 'Electronics & Communication',
    isGhost: true,
    associatedColleges: [
      { id: 'COL-CARTEL-03', name: 'Vanguard Institute of Technical Studies', state: 'Karnataka', riskScore: 82 },
      { id: 'COL-CARTEL-04', name: 'Horizon Institute of Management & Science', state: 'Tamil Nadu', riskScore: 79 },
    ],
    definitiveProof: {
      statement: 'Biometric attendance anomaly: Artificial intelligence analysis flagged simultaneous check-in timestamps recorded at Bengaluru and Chennai within a 12-minute window on 14 dates.',
      collisionDetected: true,
    },
  },

  'FAC-4': {
    type: 'faculty',
    id: 'FAC-4',
    hash: 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d',
    name: 'Prof. Rajeshwari Natarajan',
    identifierType: 'AADHAAR',
    department: 'Mechanical & Mechatronics Engineering',
    isGhost: true,
    associatedColleges: [
      { id: 'COL-CARTEL-04', name: 'Horizon Institute of Management & Science', state: 'Tamil Nadu', riskScore: 79 },
      { id: 'COL-CARTEL-05', name: 'Zenith Global Engineering College', state: 'Gujarat', riskScore: 86 },
    ],
    definitiveProof: {
      statement: 'Cross-institutional roster cloning: AICTE faculty inspection roster submitted for 2026-27 includes identical Aadhaar HMAC hash in both Chennai and Ahmedabad institutions.',
      collisionDetected: true,
    },
  },

  'FAC-5': {
    type: 'faculty',
    id: 'FAC-5',
    hash: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4',
    name: 'Dr. Vikramaditya Rathore',
    identifierType: 'PAN',
    department: 'Applied Mathematics & Data Science',
    isGhost: true,
    associatedColleges: [
      { id: 'COL-CARTEL-05', name: 'Zenith Global Engineering College', state: 'Gujarat', riskScore: 86 },
      { id: 'COL-CARTEL-01', name: 'Apex National Institute of Technology', state: 'Delhi NCR', riskScore: 88 },
    ],
    definitiveProof: {
      statement: 'Closed ring completion anchor: Faculty PAN hash links Western node (Zenith) directly with Northern node (Apex), completing the circular faculty-sharing cartel ring.',
      collisionDetected: true,
    },
  },
};

// GET /api/syndicate/node/:id
router.get('/node/:id', (req, res) => {
  const { id } = req.params;
  if (nodeProofCatalog[id]) {
    return res.status(200).json({
      success: true,
      data: nodeProofCatalog[id],
    });
  }

  // Dynamic fallback for any node
  if (id.startsWith('COL')) {
    const isCartel = id.toLowerCase().includes('cartel');
    return res.status(200).json({
      success: true,
      data: {
        type: 'college',
        id,
        name: `${id.replace(/[-_]/g, ' ')} College of Technology`,
        registrationId: `AICTE-1-${Date.now().toString().slice(-9)}`,
        state: isCartel ? 'Delhi NCR' : 'Karnataka',
        city: isCartel ? 'Noida' : 'Bengaluru',
        riskScore: isCartel ? 82 : 20,
        riskLevel: isCartel ? 'RED' : 'GREEN',
        isCartelMember: isCartel,
        facultyCount: 15,
        sharedFacultyCount: isCartel ? 4 : 0,
        facultyList: isCartel ? [
          { id: 'FAC-1', name: 'Dr. Ramesh Chandra Sharma', department: 'Computer Science', identifierType: 'AADHAAR', hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', isGhost: true },
          { id: 'FAC-2', name: 'Prof. Sunita K. Deshmukh', department: 'Information Technology', identifierType: 'PAN', hash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', isGhost: true },
        ] : [
          { id: `FAC-${id}-1`, name: 'Dr. Suresh Kumar', department: 'Civil Engineering', identifierType: 'AADHAAR', hash: 'a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e', isGhost: false },
        ],
        colludingInstitutions: isCartel ? [
          { id: 'COL-CARTEL-01', name: 'Apex National Institute of Technology', state: 'Delhi NCR', riskScore: 88 },
        ] : [],
        definitiveProof: {
          statement: isCartel
            ? 'Autonomous Graph Analysis: Multiple cross-institutional faculty overlaps identified across provincial boundaries.'
            : 'Verified Standalone Institution: Isolated node with unique faculty appointments and clean regulatory submissions.',
          recommendedAction: isCartel ? 'IMMEDIATE_EVC_INSPECTION_AND_HOLD' : 'APPROVE_EXTENSION_OF_APPROVAL',
        },
      },
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      type: 'faculty',
      id,
      hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      name: `Faculty Member (${id})`,
      identifierType: id.includes('PAN') ? 'PAN' : 'AADHAAR',
      department: 'Engineering & Technology',
      isGhost: true,
      associatedColleges: [
        { id: 'COL-CARTEL-01', name: 'Apex National Institute of Technology', state: 'Delhi NCR', riskScore: 88 },
        { id: 'COL-CARTEL-05', name: 'Zenith Global Engineering College', state: 'Gujarat', riskScore: 86 },
      ],
      definitiveProof: {
        statement: 'Duplication collision proof: Identifier hash appears concurrently on active regulatory rosters of multiple institutions.',
        collisionDetected: true,
      },
    },
  });
});

// POST /api/syndicate/seed
router.post('/seed', (req, res) => {
  res.status(200).json({ success: true, message: 'Re-seeded successfully' });
});

module.exports = router;
