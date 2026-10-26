/**
 * Demo Settings Service
 * Manages simulation controls (clock offset, simulated outages, slow ML responses)
 */

const { logEvent } = require('./audit.service');

let currentSettings = {
  clockOffsetDays: 0,
  forceSourceUnavailable: false,
  slowMlMs: 0
};

function getSettings() {
  return { ...currentSettings };
}

function getEffectiveNow() {
  const offsetMs = (currentSettings.clockOffsetDays || 0) * 86400000;
  return new Date(Date.now() + offsetMs);
}

async function updateSettings(updates, user = null, requestId = null) {
  const previous = { ...currentSettings };

  if (updates.clockOffsetDays !== undefined) {
    currentSettings.clockOffsetDays = Number(updates.clockOffsetDays);
  }
  if (updates.forceSourceUnavailable !== undefined) {
    currentSettings.forceSourceUnavailable = Boolean(updates.forceSourceUnavailable);
  }
  if (updates.slowMlMs !== undefined) {
    currentSettings.slowMlMs = Number(updates.slowMlMs);
  }

  await logEvent({
    actorUser: user?._id || null,
    action: 'SETTINGS_CHANGED',
    entityType: 'SystemSettings',
    entityId: 'DEMO_CONFIG',
    requestId,
    outcome: 'SUCCESS',
    metadata: {
      previous,
      updated: currentSettings,
      effectiveNow: getEffectiveNow().toISOString()
    }
  });

  return getSettings();
}

function resetSettings() {
  currentSettings = {
    clockOffsetDays: 0,
    forceSourceUnavailable: false,
    slowMlMs: 0
  };
  return getSettings();
}

module.exports = {
  getSettings,
  getEffectiveNow,
  updateSettings,
  resetSettings
};
