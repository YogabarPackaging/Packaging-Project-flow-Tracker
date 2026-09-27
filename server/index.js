require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const store = require('./store');
const { hashPass } = require('./utils');
const { SEED_USERS } = require('./constants');
const { errorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const authRoutes = require('./routes/authRoutes');
const projectRoutes = require('./routes/projectRoutes');
const logRoutes = require('./routes/logRoutes');
const specRoutes = require('./routes/specRoutes');
const approvalRoutes = require('./routes/approvalRoutes');
const taskRoutes = require('./routes/taskRoutes');
const commentRoutes = require('./routes/commentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const searchRoutes = require('./routes/searchRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const reportRoutes = require('./routes/reportRoutes');
const dataQualityRoutes = require('./routes/dataQualityRoutes');
const importRoutes = require('./routes/importRoutes');
const packagingFormatRoutes = require('./routes/packagingFormatRoutes');
const apiDocsRoutes = require('./routes/apiDocsRoutes');
const exportRoutes = require('./routes/exportRoutes');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// ── Middleware ────────────────────────────────────────────────────
app.use(cors({
  origin: [CLIENT_URL, 'http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// ── Observability & Request Metrics ────────────────────────────────
const metrics = {
  startTime: Date.now(),
  totalRequests: 0,
  totalErrors: 0,
  statusCodes: { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 },
  recentLatencies: [] // Rolling window of last 100 request durations (ms)
};

app.use((req, res, next) => {
  const start = Date.now();
  metrics.totalRequests++;

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (metrics.recentLatencies.length >= 100) {
      metrics.recentLatencies.shift();
    }
    metrics.recentLatencies.push(duration);

    const statusGroup = `${Math.floor(res.statusCode / 100)}xx`;
    if (metrics.statusCodes[statusGroup] !== undefined) {
      metrics.statusCodes[statusGroup]++;
    }
    if (res.statusCode >= 500) {
      metrics.totalErrors++;
    }
  });

  next();
});

// ── API Version Header (non-breaking, informational) ──────────────
app.use((req, res, next) => {
  res.setHeader('X-API-Version', '1');
  next();
});

// ── Routes (v1) ───────────────────────────────────────────────────
// Mount at both /api/v1/ (future-proof) and /api/ (backward compat)
const v1Router = express.Router();
v1Router.use('/auth', authRoutes);
v1Router.use('/projects', projectRoutes);
v1Router.use('/logs', logRoutes);
v1Router.use('/specs', specRoutes);
v1Router.use('/approvals', approvalRoutes);
v1Router.use('/tasks', taskRoutes);
v1Router.use('/comments', commentRoutes);
v1Router.use('/notifications', notificationRoutes);
v1Router.use('/search', searchRoutes);
v1Router.use('/webhooks', webhookRoutes);
v1Router.use('/reports', reportRoutes);
v1Router.use('/data-quality', dataQualityRoutes);
v1Router.use('/import', importRoutes);
v1Router.use('/packaging-formats', packagingFormatRoutes);
v1Router.use('/export', exportRoutes);
v1Router.use('/', apiDocsRoutes);

app.use('/api/v1', v1Router);
app.use('/api', v1Router);   // Backward-compatible alias — all existing clients work unchanged

// ── Health check with dependency verification ─────────────────────
const healthHandler = async (req, res) => {
  const { testConnection } = require('./db');
  let dbStatus = 'disconnected';
  let dbOk = false;
  try {
    const conn = await testConnection();
    dbOk = conn && conn.ok;
    dbStatus = dbOk ? 'connected' : 'disconnected';
  } catch {
    dbStatus = 'disconnected';
  }

  const mem = process.memoryUsage();
  const uptimeSec = Math.floor(process.uptime());
  const storageStatus = Array.isArray(store.projects) ? 'ready' : 'initializing';

  const isHealthy = storageStatus === 'ready';
  const responseData = {
    status: isHealthy ? (dbOk ? 'healthy' : 'degraded') : 'unhealthy',
    environment: process.env.NODE_ENV || 'development',
    mode: dbOk ? 'database_rds' : 'local_persistent_store',
    version: '1.0.0',
    uptime: uptimeSec,
    timestamp: new Date().toISOString(),
    dependencies: {
      database: dbStatus,
      storage: storageStatus
    },
    memory: {
      rssMb: Math.round(mem.rss / 1024 / 1024),
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024)
    }
  };

  res.status(isHealthy ? 200 : 503).json(responseData);
};

app.get('/api/health', healthHandler);
app.get('/api/v1/health', healthHandler);

// ── Observability & Performance Metrics ───────────────────────────
const metricsHandler = (req, res) => {
  const avgLatency = metrics.recentLatencies.length > 0
    ? Math.round(metrics.recentLatencies.reduce((a, b) => a + b, 0) / metrics.recentLatencies.length)
    : 0;
  const mem = process.memoryUsage();

  res.json({
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    requests: {
      total: metrics.totalRequests,
      errors: metrics.totalErrors,
      statusCodes: metrics.statusCodes,
      avgLatencyMs: avgLatency
    },
    system: {
      memoryRssMb: Math.round(mem.rss / 1024 / 1024),
      memoryHeapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      nodeVersion: process.version
    },
    entities: {
      projectsCount: (store.projects || []).length,
      specsCount: (store.specLibrary || []).length,
      usersCount: Object.keys(store.users || {}).length
    }
  });
};

app.get('/api/metrics', metricsHandler);
app.get('/api/v1/metrics', metricsHandler);

// ── Static Frontend & SPA Fallback (Production) ───────────────────
const path = require('path');
const fs = require('fs');
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// ── 404 Handler for Unmatched API Routes ───────────────────────────
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.originalUrl}` });
});

// ── Centralized Error Handler (MUST be last middleware) ───────────
app.use(errorHandler);


// ── Startup & DB Initialization ─────────────────────────────────────
async function bootstrap() {
  // Always prepare memory cache first so app is instantly responsive
  store.users = {};
  for (const u of SEED_USERS) {
    store.users[u.email] = {
      name: u.name,
      role: u.role,
      title: u.title || '',
      team: u.team || '',
      mobile: u.mobile || '',
      avatar: u.avatar || '',
      department: u.department || '',
      description: u.description || '',
      color: u.color,
      passwordHash: hashPass(u.defaultPw),
      mustChangePw: false,
      tempPw: null
    };
  }

  const { testConnection } = require('./db');
  const { runMigrations } = require('./db/migrate');
  const { runSeeds } = require('./db/seed');
  const {
    ProjectsRepo,
    UsersRepo,
    SpecLibraryRepo,
    TasksRepo,
    ApprovalsRepo,
    CommentsRepo,
    NotificationsRepo,
    WebhooksRepo,
    LogsRepo
  } = require('./db/repository');

  let isDbConnected = false;
  try {
    const conn = await testConnection();
    isDbConnected = conn && conn.ok;
  } catch (e) {
    isDbConnected = false;
  }

  if (isDbConnected) {
    console.log('🐘 AWS RDS PostgreSQL Connected successfully!');
    try {
      await runMigrations();
      await runSeeds();
      const dbProjects = await ProjectsRepo.getAll();
      if (Array.isArray(dbProjects)) {
        store.projects = dbProjects;
        console.log(`📦 Loaded ${dbProjects.length} project(s) from PostgreSQL database.`);
      }
      const dbUsers = await UsersRepo.getAll();
      if (dbUsers && Object.keys(dbUsers).length > 0) {
        store.users = { ...store.users, ...dbUsers };
        console.log(`👥 Synchronized users from PostgreSQL database.`);
      }
      const dbSpecs = await SpecLibraryRepo.getAll();
      if (Array.isArray(dbSpecs)) {
        store.specLibrary = dbSpecs;
        console.log(`📋 Loaded ${dbSpecs.length} spec(s) from Spec Library.`);
      }
      const dbTasks = await TasksRepo.getAll();
      if (Array.isArray(dbTasks)) {
        store.tasks = dbTasks;
      }
      const dbApprovals = await ApprovalsRepo.getAll();
      if (Array.isArray(dbApprovals)) {
        store.approvals = dbApprovals;
      }
      const dbComments = await CommentsRepo.getAll();
      if (Array.isArray(dbComments)) {
        store.comments = dbComments;
      }
      const dbWebhooks = await WebhooksRepo.getAll();
      if (Array.isArray(dbWebhooks)) {
        store.webhooks = dbWebhooks;
      }
      const dbLogs = await LogsRepo.getAll(500);
      if (Array.isArray(dbLogs)) {
        store.advanceLogs = dbLogs;
      }
    } catch (dbInitErr) {
      console.error('⚠️ DB Migration/Seed warning:', dbInitErr.message);
    }
  } else {
    store.loadLocalStore();
    console.log('\n======================================================');
    console.log('⚠  PostgreSQL RDS database not connected or password missing.');
    console.log('   Running in persistent local JSON storage mode (server/data/local_store.json).');
    console.log('   To activate persistent RDS storage, set DB_PASSWORD in server/.env');
    console.log('======================================================\n');
  }

  if (require.main === module) {
    app.listen(PORT, () => {
      console.log(`\n🚀 PKG Tracker API running on http://localhost:${PORT}`);
      console.log(`   Client expected at: ${CLIENT_URL}`);
      console.log(`   Super Admin login: username=admin  password=Admin@PKG#2024`);
      if (isDbConnected) {
        console.log(`   ✅ Persistent storage: AWS RDS PostgreSQL (ap-south-1)\n`);
      } else {
        console.log(`   ⚠  Temporary in-memory store active until RDS password is set\n`);
      }
    });
  }
  return app;
}

if (require.main === module) {
  bootstrap().catch(err => {
    console.error('Fatal startup error:', err);
  });
}

module.exports = { app, bootstrap };


