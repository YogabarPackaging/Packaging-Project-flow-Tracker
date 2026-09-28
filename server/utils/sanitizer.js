'use strict';

/**
 * sanitizer.js — Data Cleaning, Trimming & Normalization Utility
 *
 * Rules:
 *  1. All string values are checked and trimmed.
 *  2. When an empty string ("" or whitespace only) is sent, it is converted to NULL.
 *  3. Numbers, booleans, and dates are validated; invalid numbers/dates become NULL.
 *  4. JSON objects and arrays are recursively cleaned with the same rules.
 */

/**
 * Trims a string and returns null if the trimmed string is empty.
 * If value is undefined or null, returns null.
 * For numbers, booleans, dates, arrays, and objects, preserves types and cleans recursively.
 *
 * @param {any} val - Input value
 * @returns {any} Sanitized value (with empty strings as null)
 */
function cleanValue(val) {
  if (val === undefined || val === null) {
    return null;
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null;
  }

  if (typeof val === 'boolean') {
    return val;
  }

  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }

  if (Array.isArray(val)) {
    return val.map(item => cleanValue(item));
  }

  if (typeof val === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = cleanValue(v);
    }
    return out;
  }

  return val;
}

/**
 * Specifically cleans a string field, ensuring it is trimmed and returns null if empty.
 * @param {any} val
 * @param {string|null} fallback
 * @returns {string|null}
 */
function cleanStr(val, fallback = null) {
  if (val === undefined || val === null) return fallback;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }
  const str = String(val).trim();
  return str.length > 0 ? str : fallback;
}

/**
 * Specifically validates and formats a date string (YYYY-MM-DD).
 * Returns null if the value is empty, null, or invalid date.
 * @param {any} d
 * @returns {string|null}
 */
function cleanDate(d) {
  if (!d) return null;
  if (typeof d === 'string') {
    const trimmed = d.trim();
    if (!trimmed) return null;
    // Check YYYY-MM-DD or parseable date
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
    const parsed = new Date(trimmed);
    if (isNaN(parsed.getTime())) return null;
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (d instanceof Date) {
    if (isNaN(d.getTime())) return null;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return null;
}

/**
 * Cleans an integer field.
 * @param {any} val
 * @param {number|null} fallback
 * @returns {number|null}
 */
function cleanInt(val, fallback = null) {
  if (val === undefined || val === null || val === '') return fallback;
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? fallback : n;
}

/**
 * Cleans a boolean field.
 * @param {any} val
 * @param {boolean} fallback
 * @returns {boolean}
 */
function cleanBool(val, fallback = false) {
  if (val === undefined || val === null) return fallback;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const lower = val.trim().toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'yes') return true;
    if (lower === 'false' || lower === '0' || lower === 'no') return false;
  }
  return Boolean(val);
}

/**
 * Cleans a JSON field, ensuring all nested strings are trimmed and empty strings are null.
 * @param {any} val
 * @param {any} fallback
 * @returns {any}
 */
function cleanJson(val, fallback = null) {
  if (val === undefined || val === null || val === '') {
    return fallback;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return fallback;
    try {
      const parsed = JSON.parse(trimmed);
      return cleanValue(parsed);
    } catch {
      return fallback;
    }
  }
  return cleanValue(val);
}

/**
 * Recursively cleans an entire record/object.
 * @param {object} record
 * @returns {object}
 */
function sanitizeRecord(record) {
  return cleanValue(record);
}

/**
 * Express middleware to automatically trim and nullify empty strings on all incoming requests.
 */
function sanitizerMiddleware(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeRecord(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeRecord(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeRecord(req.params);
  }
  next();
}

module.exports = {
  cleanValue,
  cleanStr,
  cleanDate,
  cleanInt,
  cleanBool,
  cleanJson,
  sanitizeRecord,
  sanitizerMiddleware
};
