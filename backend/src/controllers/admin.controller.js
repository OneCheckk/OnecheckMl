/**
 * Admin Controller
 * Manages Rulepacks, Checklists, and User accounts
 */

const crypto = require('crypto');
const { Rulepack, Checklist, User } = require('../models');
const mlClient = require('../services/mlClient.service');
const { logEvent } = require('../services/audit.service');
const ApiError = require('../utils/ApiError');

// 1. Rulepack Management
async function listRulepacks(req, res, next) {
  try {
    const rulepacks = await Rulepack.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: rulepacks });
  } catch (err) {
    next(err);
  }
}

async function createRulepack(req, res, next) {
  try {
    const { version, yamlText, notes } = req.body;
    if (!version || !yamlText) {
      throw ApiError.badRequest('version and yamlText are required');
    }

    const sha256 = crypto.createHash('sha256').update(yamlText).digest('hex');

    // Register with ML engine
    await mlClient.registerRulepack({ version, yaml: yamlText }, req.requestId);

    const rulepack = await Rulepack.create({
      version,
      yamlText,
      sha256,
      active: false,
      notes: notes || null,
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'Rulepack registered successfully',
      data: rulepack
    });
  } catch (err) {
    next(err);
  }
}

async function activateRulepack(req, res, next) {
  try {
    const { version } = req.params;
    const target = await Rulepack.findOne({ version });
    if (!target) {
      throw ApiError.notFound(`Rulepack version '${version}' not found`);
    }

    await Rulepack.updateMany({}, { active: false });
    target.active = true;
    await target.save();

    await logEvent({
      actorUser: req.user._id,
      action: 'RULEPACK_ACTIVATED',
      entityType: 'Rulepack',
      entityId: target._id,
      requestId: req.requestId,
      outcome: 'SUCCESS',
      metadata: { version, sha256: target.sha256 }
    });

    res.status(200).json({
      success: true,
      message: `Rulepack version '${version}' activated`,
      data: target
    });
  } catch (err) {
    next(err);
  }
}

// 2. Checklist Management
async function listChecklists(req, res, next) {
  try {
    const checklists = await Checklist.find().sort({ category: 1 });
    res.status(200).json({ success: true, data: checklists });
  } catch (err) {
    next(err);
  }
}

async function updateChecklist(req, res, next) {
  try {
    const { category } = req.params;
    const { items, version = '2026.1' } = req.body;

    if (!items || !Array.isArray(items)) {
      throw ApiError.badRequest('items array is required');
    }

    const updated = await Checklist.findOneAndUpdate(
      { category },
      { items, version, active: true },
      { upsert: true, new: true }
    );

    res.status(200).json({
      success: true,
      message: `Checklist for category '${category}' updated successfully`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
}

// 3. User Management
async function listUsers(req, res, next) {
  try {
    const query = {};
    if (req.query.role) query.role = req.query.role;
    if (req.query.isActive !== undefined) query.isActive = req.query.isActive === 'true';

    const users = await User.find(query).select('-passwordHash').sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
}

async function createUser(req, res, next) {
  try {
    const { name, email, password, role, institutionId } = req.body;
    if (!name || !email || !password || !role) {
      throw ApiError.badRequest('name, email, password, and role are required');
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      throw ApiError.conflict(`User with email '${email}' already exists`);
    }

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({
      name,
      email: email.toLowerCase().trim(),
      passwordHash,
      role,
      institution: institutionId || null,
      institutionId: institutionId || null,
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: user
    });
  } catch (err) {
    next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const { role, isActive } = req.body;
    const update = {};
    if (role) update.role = role;
    if (isActive !== undefined) update.isActive = Boolean(isActive);

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-passwordHash');
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listRulepacks,
  createRulepack,
  activateRulepack,
  listChecklists,
  updateChecklist,
  listUsers,
  createUser,
  updateUser
};
