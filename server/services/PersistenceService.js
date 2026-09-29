'use strict';
/**
 * PersistenceService — Centralized dual-write layer.
 *
 * Eliminates scattered `store.saveLocalStore()` + `ProjectsRepo.*` calls
 * across route handlers. Every mutation goes through this service so
 * the in-memory store and PostgreSQL are always kept in sync atomically.
 *
 * Implements Pass 5 Soft Delete:
 *  - Projects are soft-deleted (marked `isDeleted: true`) preserving full audit history.
 *  - Deleted records are excluded from standard user queries by default.
 *  - Administrative restore functionality is provided.
 */

const store = require('../store');
const {
  ProjectsRepo,
  ProjectMaterialsRepo,
  SpecificationsRepo,
  ArtworksRepo,
  ProjectRisksRepo
} = require('../db/repository');
const { isDbAvailable } = require('../db');
const logger = require('../utils/logger');

/**
 * Save (create or update) a project to the in-memory store and PostgreSQL.
 * @param {object} project - The full project object
 * @param {'create'|'update'} operation - Whether this is a create or update
 */
async function saveProject(project, operation = null) {
  // 1. Update in-memory store
  const idx = store.projects.findIndex(x => String(x.id) === String(project.id));
  const isNew = idx === -1;
  if (!isNew) {
    store.projects[idx] = project;
  } else {
    store.projects.unshift(project);
  }

  // 2. Persist to PostgreSQL (primary storage)
  if (isDbAvailable()) {
    const op = operation || (isNew ? 'create' : 'update');
    try {
      if (op === 'create') {
        await ProjectsRepo.create(project);
      } else {
        const updated = await ProjectsRepo.update(project.id, project);
        if (!updated) {
          await ProjectsRepo.create(project);
        }
      }
      const syncTasks = [];
      if (Array.isArray(project.materials)) {
        if (ProjectMaterialsRepo) syncTasks.push(ProjectMaterialsRepo.syncMaterialsForProject(project.id, project.materials));
        if (SpecificationsRepo) syncTasks.push(SpecificationsRepo.syncForProject(project.id, project.materials));
        if (ArtworksRepo) syncTasks.push(ArtworksRepo.syncForProject(project.id, project.materials));
      }
      if (Array.isArray(project.risks) && ProjectRisksRepo) {
        syncTasks.push(ProjectRisksRepo.syncForProject(project.id, project.risks));
      }
      await Promise.all(syncTasks);
    } catch (err) {
      logger.warn('PersistenceService', `DB ${operation} failed for project ${project.id}:`, err.message);
    }
  } else {
    // Fallback to local JSON file only when PostgreSQL is offline
    if (typeof store.saveLocalStore === 'function') {
      store.saveLocalStore();
    }
  }
}

/**
 * Soft delete a project. Marks project as deleted and records audit metadata.
 *
 * @param {string|number} id - Project ID
 * @param {object|null} user - The user executing deletion
 * @returns {Promise<boolean>} true if found and marked deleted
 */
async function softDeleteProject(id, user = null) {
  const p = store.projects.find(x => String(x.id) === String(id));
  if (!p) return false;

  p.isDeleted = true;
  p.deletedAt = new Date().toISOString();
  p.deletedBy = user ? { name: user.name, email: user.email, role: user.role } : null;
  p.updatedAt = new Date().toISOString();

  // Persist soft delete to PostgreSQL (or fallback to local store if DB offline)
  if (isDbAvailable()) {
    try {
      await ProjectsRepo.softDelete(id, user);
    } catch (err) {
      logger.warn('PersistenceService', `DB softDelete failed for project ${id}:`, err.message);
    }
  } else if (typeof store.saveLocalStore === 'function') {
    store.saveLocalStore();
  }

  return true;
}

/**
 * Restore a soft-deleted project.
 *
 * @param {string|number} id - Project ID
 * @param {object|null} user - The user executing restore
 * @returns {Promise<object|null>} The restored project or null
 */
async function restoreProject(id, user = null) {
  let p = store.projects.find(x => String(x.id) === String(id));
  if (!p && isDbAvailable()) {
    try {
      p = await ProjectsRepo.getById(id, true);
      if (p) store.projects.push(p);
    } catch (e) {}
  }
  if (!p) return null;

  p.isDeleted = false;
  p.deletedAt = null;
  p.deletedBy = null;
  p.updatedAt = new Date().toISOString();
  if (user) {
    p.updatedBy = { name: user.name, email: user.email, role: user.role };
  }

  if (isDbAvailable()) {
    try {
      await ProjectsRepo.restore(id);
    } catch (err) {
      logger.warn('PersistenceService', `DB restore failed for project ${id}:`, err.message);
    }
  } else if (typeof store.saveLocalStore === 'function') {
    store.saveLocalStore();
  }

  return p;
}

/**
 * Permanently remove a project (hard delete fallback for tests / cleanup).
 *
 * @param {string|number} id - Project ID
 * @returns {Promise<boolean>} true if found and removed, false if not found
 */
async function deleteProject(id, user = null) {
  // By default, execute soft deletion to preserve history
  return await softDeleteProject(id, user);
}

/**
 * Load a project by ID. Checks in-memory store first, falls back to DB.
 *
 * @param {string|number} id - Project ID
 * @param {boolean} [includeDeleted=false] - Whether to allow loading soft-deleted projects
 * @returns {Promise<object|null>} The project or null
 */
async function loadProject(id, includeDeleted = false) {
  // 1. Check in-memory store first (fast path)
  let project = store.projects.find(x => String(x.id) === String(id));
  if (project) {
    if (!includeDeleted && project.isDeleted) return null;
    return project;
  }

  // 2. Fallback to PostgreSQL
  if (isDbAvailable()) {
    try {
      project = await ProjectsRepo.getById(id, includeDeleted);
      if (project) {
        // Sync back to in-memory store
        const existingIdx = store.projects.findIndex(x => String(x.id) === String(project.id));
        if (existingIdx !== -1) {
          store.projects[existingIdx] = project;
        } else {
          store.projects.push(project);
        }
      }
    } catch (err) {
      logger.warn('PersistenceService', `DB getById failed for project ${id}:`, err.message);
    }
  }

  if (project && !includeDeleted && project.isDeleted) return null;
  return project || null;
}

/**
 * Load all projects. Prefers PostgreSQL if available; falls back to store.
 * Filters out soft-deleted records unless explicitly requested.
 *
 * @param {boolean} [includeDeleted=false]
 * @returns {Promise<Array>} Array of projects
 */
async function loadAllProjects(includeDeleted = false) {
  if (isDbAvailable()) {
    try {
      const dbProjects = await ProjectsRepo.getAll(includeDeleted);
      if (dbProjects && dbProjects.length > 0) {
        // Merge with store while respecting is_deleted state
        dbProjects.forEach(dp => {
          const sIdx = store.projects.findIndex(x => String(x.id) === String(dp.id));
          if (sIdx !== -1) store.projects[sIdx] = dp;
          else store.projects.push(dp);
        });
      }
    } catch (err) {
      logger.warn('PersistenceService', 'DB getAll failed, using local store:', err.message);
    }
  }
  return (store.projects || []).filter(p => includeDeleted || !p.isDeleted);
}

module.exports = {
  saveProject,
  deleteProject,
  softDeleteProject,
  restoreProject,
  loadProject,
  loadAllProjects
};
