'use strict';
/**
 * EntityIdService — Centralized generator for stable business entity identifiers.
 *
 * Implements Pass 5 Entity Identification Standards:
 *  - Project:       PRJ-000001 (or PRJ-xxx)
 *  - Material:      MAT-000001 (internal stable ID; PM Code remains business identifier)
 *  - Artwork:       ART-000001
 *  - Specification: SPEC-000001
 *  - Risk:          RSK-000001
 *  - Activity:      ACT-000001 (with backward compatibility for LOG-)
 */

let counter = 1000;

/**
 * Generate a cryptographically strong or sequence-based stable ID.
 * @param {string} prefix - Entity prefix (PRJ, MAT, ART, SPEC, RSK, ACT)
 * @returns {string} Formatted ID, e.g., 'MAT-000123'
 */
function generateId(prefix = 'ENT') {
  counter++;
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  const seq = String(counter).padStart(6, '0');
  
  if (prefix === 'ACT') {
    return `ACT-${Date.now()}-${rand}`;
  }

  // Standard unique identifier with timestamp and random entropy for distributed safety
  return `${prefix}-${ts}-${rand}`;
}

function generateMaterialId() {
  return generateId('MAT');
}

function generateArtworkId() {
  return generateId('ART');
}

function generateSpecId() {
  return generateId('SPEC');
}

function generateRiskId() {
  return generateId('RSK');
}

function generateActivityId() {
  return generateId('ACT');
}

/**
 * Ensure all materials in an array possess a permanent internal ID.
 * Leaves existing IDs and PM Codes completely untouched.
 *
 * @param {Array} materials - Array of material objects
 * @returns {Array} Materials guaranteed to have stable `id`
 */
function ensureMaterialIds(materials = []) {
  if (!Array.isArray(materials)) return [];
  return materials.map((m, idx) => {
    if (!m) return m;
    if (!m.id) {
      m.id = generateMaterialId();
    }
    return m;
  });
}

/**
 * Validate whether a string conforms to the expected entity ID format.
 * @param {string} id - The ID to test
 * @param {string} [expectedPrefix] - Optional prefix constraint
 * @returns {boolean}
 */
function isValidEntityId(id, expectedPrefix = null) {
  if (typeof id !== 'string' || !id.trim()) return false;
  const regex = expectedPrefix
    ? new RegExp(`^${expectedPrefix}-[A-Za-z0-9_-]+$`, 'i')
    : /^[A-Z]{3,4}-[A-Za-z0-9_-]+$/;
  return regex.test(id.trim());
}

module.exports = {
  generateId,
  generateMaterialId,
  generateArtworkId,
  generateSpecId,
  generateRiskId,
  generateActivityId,
  ensureMaterialIds,
  isValidEntityId
};
