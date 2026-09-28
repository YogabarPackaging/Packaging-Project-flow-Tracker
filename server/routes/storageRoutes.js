'use strict';

const express = require('express');
const path = require('path');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { storageService } = require('../services/StorageService');

const MIME_TYPES = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.psd': 'application/octet-stream',
  '.ai': 'application/postscript',
  '.cdr': 'application/octet-stream'
};

router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const storageKey = String(req.query.key || '');
    if (!storageKey || storageKey.includes('..') || storageKey.startsWith('/')) {
      return res.status(400).json({ error: 'A valid storage key is required.' });
    }

    const buffer = await storageService.getDocument(storageKey);
    if (!buffer) return res.status(404).json({ error: 'Artwork file not found.' });

    res.setHeader('Content-Type', MIME_TYPES[path.extname(storageKey).toLowerCase()] || 'application/octet-stream');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
