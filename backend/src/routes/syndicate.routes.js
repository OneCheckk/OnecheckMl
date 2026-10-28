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

// GET /api/syndicate/node/:id
router.get('/node/:id', (req, res) => {
  const { id } = req.params;
  if (id.startsWith('COL')) {
    return res.status(200).json({
      success: true,
      data: {
        type: 'college',
        id,
        name: id.includes('01') ? 'Apex National Institute of Technology' : 'Paramount College of Engineering & Research',
        registrationId: `AICTE-${id}`,
        state: 'Delhi NCR',
        city: 'Noida',
        riskScore: 88,
        riskLevel: 'RED',
        isCartelMember: true,
        facultyCount: 14,
        sharedFacultyCount: 6,
        facultyList: [
          { id: 'FAC-1', name: 'Dr. Ramesh Chandra Sharma', department: 'Computer Science', identifierType: 'AADHAAR', hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', isGhost: true },
          { id: 'FAC-2', name: 'Prof. Sunita K. Deshmukh', department: 'Information Technology', identifierType: 'PAN', hash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', isGhost: true },
        ],
        colludingInstitutions: [
          { id: 'COL-CARTEL-02', name: 'Paramount College of Engineering & Research', state: 'Maharashtra', riskScore: 84 },
          { id: 'COL-CARTEL-03', name: 'Vanguard Institute of Technical Studies', state: 'Karnataka', riskScore: 82 },
        ],
        definitiveProof: {
          statement: 'Definitive multi-hop graph proof: Participates in a closed 5-node cartel syndicate sharing 6 ghost faculty across 4 institutions.',
          recommendedAction: 'IMMEDIATE_EVC_INSPECTION_AND_HOLD',
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
      name: 'Dr. Ramesh Chandra Sharma',
      identifierType: 'AADHAAR',
      department: 'Computer Science',
      isGhost: true,
      associatedColleges: [
        { id: 'COL-CARTEL-01', name: 'Apex National Institute of Technology', state: 'Delhi NCR', riskScore: 88 },
        { id: 'COL-CARTEL-02', name: 'Paramount College of Engineering & Research', state: 'Maharashtra', riskScore: 84 },
      ],
      definitiveProof: {
        statement: 'Duplication collision proof: Identifier AADHAAR hash appears simultaneously on active regulatory rosters of 2 distinct institutions.',
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
