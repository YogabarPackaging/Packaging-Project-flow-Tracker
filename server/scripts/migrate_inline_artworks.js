'use strict';

require('dotenv').config();

const { pool, testConnection } = require('../db');
const { ProjectsRepo } = require('../db/repository');
const { storageService } = require('../services/StorageService');

const DATA_URL_PATTERN = /^data:([^;,]+)?(?:;base64)?,(.*)$/s;
const ARTWORK_URL_KEYS = new Set(['url', 'artworkUrl', 'artwork']);

async function migrateProject(project) {
  const uploaded = new Map();
  let migrated = 0;

  async function visit(value, path = []) {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        await visit(value[index], [...path, String(index)]);
      }
      return;
    }
    if (!value || typeof value !== 'object') return;

    for (const [key, child] of Object.entries(value)) {
      if (ARTWORK_URL_KEYS.has(key) && typeof child === 'string' && child.startsWith('data:')) {
        const match = child.match(DATA_URL_PATTERN);
        if (!match) continue;

        let stored = uploaded.get(child);
        if (!stored) {
          const filename = value.name || `${path.join('-') || 'artwork'}.bin`;
          stored = await storageService.storeDocument(Buffer.from(match[2], 'base64'), {
            filename,
            mimeType: value.type || match[1] || 'application/octet-stream',
            entity: 'ARTWORK',
            entityId: project.id,
            owner: 'migration@system'
          });
          uploaded.set(child, stored);
        }

        value[key] = `/api/storage?key=${encodeURIComponent(stored.storageKey)}`;
        value.storageKey = stored.storageKey;
        value.storageId = stored.storageId;
        value.storageProvider = stored.provider;
        value.checksumSha256 = stored.checksumSha256;
        value.size = stored.sizeBytes;
        value.type = stored.mimeType;
        migrated += 1;
      } else {
        await visit(child, [...path, key]);
      }
    }
  }

  await visit(project.materials || [], ['materials']);
  if (migrated > 0) await ProjectsRepo.update(project.id, project);
  return { migrated, uploaded: uploaded.size };
}

async function main() {
  const connection = await testConnection();
  if (!connection.ok) throw new Error(`Database connection failed: ${connection.error}`);

  const projects = await ProjectsRepo.getAll(true);
  let migrated = 0;
  let uploaded = 0;
  for (const project of projects) {
    const result = await migrateProject(project);
    migrated += result.migrated;
    uploaded += result.uploaded;
  }

  console.log(`Migrated ${migrated} inline artwork reference(s) into ${uploaded} stored object(s).`);
}

main()
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());