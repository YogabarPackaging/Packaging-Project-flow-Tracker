-- 012_recreate_clean_essential_schema.sql
-- Drop all unwanted/dead tables and establish the lean, essential schema
-- Required modules:
-- 1. roles & roles_permissions
-- 2. users & users_permissions
-- 3. sessions
-- 4. packaging_formats
-- 5. projects
-- 6. project_materials
-- 7. specifications
-- 8. artworks
-- 9. project_risks

-- ──────────────────────────────────────────────────────────────────────────
-- SECTION 1: DROP UNWANTED TABLES
-- ──────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS webhook_deliveries CASCADE;
DROP TABLE IF EXISTS webhooks CASCADE;
DROP TABLE IF EXISTS ai_activity_logs CASCADE;
DROP TABLE IF EXISTS advance_logs CASCADE;
DROP TABLE IF EXISTS app_settings CASCADE;
DROP TABLE IF EXISTS approvals CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS factories CASCADE;
DROP TABLE IF EXISTS material_types CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS po_statuses CASCADE;
DROP TABLE IF EXISTS print_types CASCADE;
DROP TABLE IF EXISTS raci_matrix CASCADE;
DROP TABLE IF EXISTS spec_library CASCADE;
DROP TABLE IF EXISTS stage_definitions CASCADE;
DROP TABLE IF EXISTS standard_risks CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS user_preferences CASCADE;

-- ──────────────────────────────────────────────────────────────────────────
-- SECTION 2: SEQUENCE FOR PROJECT IDS
-- ──────────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS project_seq START WITH 1;

-- ──────────────────────────────────────────────────────────────────────────
-- SECTION 3: ROLES & ROLES_PERMISSIONS
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  color VARCHAR(32) DEFAULT '#00bfa5',
  badge VARCHAR(64) DEFAULT 'Member',
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roles_permissions (
  id SERIAL PRIMARY KEY,
  role_id VARCHAR(64) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_role_permission UNIQUE (role_id, permission)
);

CREATE INDEX IF NOT EXISTS idx_roles_permissions_role ON roles_permissions (role_id);
CREATE INDEX IF NOT EXISTS idx_roles_permissions_perm ON roles_permissions (permission);

-- Seed System Roles
INSERT INTO roles (id, name, description, color, badge, is_system)
VALUES
  ('superadmin', 'Super Admin', 'Packaging Head & Super Admin: System governance, delete privileges, full oversight.', '#ef4444', '⚡ Super Admin', TRUE),
  ('admin', 'Admin', 'Packaging Project Manager: Create, edit, advance, revoke, approve specifications and crunch plans.', '#7c3aed', '🛡 Admin', TRUE),
  ('updater', 'Updater', 'Packaging Executive: Material advance, inline field edits, PO and specification maintenance.', '#00bfa5', '⚡ Updater', TRUE),
  ('viewer', 'Viewer', 'Read-only stakeholder: View dashboard, timelines, specifications, and reports.', '#64748b', '👁 Viewer', TRUE),
  ('supplier', 'Supplier', 'External packaging partner: Update PO status, upload dielines/artworks for allocated materials.', '#f59e0b', '🏭 Supplier', TRUE)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  color = EXCLUDED.color,
  badge = EXCLUDED.badge,
  is_system = EXCLUDED.is_system,
  updated_at = CURRENT_TIMESTAMP;

-- Seed Standard Role Permissions
INSERT INTO roles_permissions (role_id, permission) VALUES
  -- Super Admin: all permissions
  ('superadmin', 'project.view'), ('superadmin', 'project.create'), ('superadmin', 'project.update'), ('superadmin', 'project.delete'),
  ('superadmin', 'project.advance'), ('superadmin', 'project.revoke'), ('superadmin', 'project.launch'), ('superadmin', 'project.brief_date'),
  ('superadmin', 'project.edit.fgcode'), ('superadmin', 'project.edit.supplier'), ('superadmin', 'project.edit.factory'),
  ('superadmin', 'project.edit.description'), ('superadmin', 'project.edit.status'), ('superadmin', 'project.edit.risk'),
  ('superadmin', 'material.advance'), ('superadmin', 'material.artwork.upload'), ('superadmin', 'material.spec.update'),
  ('superadmin', 'material.spec.signoff'), ('superadmin', 'material.po.update'), ('superadmin', 'material.pmcode.update'),
  ('superadmin', 'crunch.approve.stage1'), ('superadmin', 'crunch.approve.stage2'),
  ('superadmin', 'spec.view'), ('superadmin', 'spec.create'), ('superadmin', 'spec.update'), ('superadmin', 'spec.delete'),
  ('superadmin', 'artwork.view'), ('superadmin', 'artwork.upload'), ('superadmin', 'artwork.approve'), ('superadmin', 'artwork.delete'),
  ('superadmin', 'user.view'), ('superadmin', 'user.manage'), ('superadmin', 'user.password.reset'),
  ('superadmin', 'audit.view'), ('superadmin', 'logs.view'), ('superadmin', 'logs.export'),
  ('superadmin', 'risk.view'), ('superadmin', 'risk.manage'),

  -- Admin: management without hard delete of projects
  ('admin', 'project.view'), ('admin', 'project.create'), ('admin', 'project.update'),
  ('admin', 'project.advance'), ('admin', 'project.revoke'), ('admin', 'project.launch'), ('admin', 'project.brief_date'),
  ('admin', 'project.edit.fgcode'), ('admin', 'project.edit.supplier'), ('admin', 'project.edit.factory'),
  ('admin', 'project.edit.description'), ('admin', 'project.edit.status'), ('admin', 'project.edit.risk'),
  ('admin', 'material.advance'), ('admin', 'material.artwork.upload'), ('admin', 'material.spec.update'),
  ('admin', 'material.spec.signoff'), ('admin', 'material.po.update'), ('admin', 'material.pmcode.update'),
  ('admin', 'crunch.approve.stage1'),
  ('admin', 'spec.view'), ('admin', 'spec.create'), ('admin', 'spec.update'),
  ('admin', 'artwork.view'), ('admin', 'artwork.upload'), ('admin', 'artwork.approve'),
  ('admin', 'user.view'),
  ('admin', 'audit.view'), ('admin', 'logs.view'), ('admin', 'logs.export'),
  ('admin', 'risk.view'), ('admin', 'risk.manage'),

  -- Updater: execution & updates
  ('updater', 'project.view'),
  ('updater', 'project.advance'),
  ('updater', 'project.edit.fgcode'), ('updater', 'project.edit.supplier'), ('updater', 'project.edit.factory'),
  ('updater', 'project.edit.description'), ('updater', 'project.edit.risk'),
  ('updater', 'material.advance'), ('updater', 'material.artwork.upload'), ('updater', 'material.spec.update'),
  ('updater', 'material.spec.signoff'), ('updater', 'material.po.update'),
  ('updater', 'spec.view'),
  ('updater', 'artwork.view'), ('updater', 'artwork.upload'),
  ('updater', 'audit.view'), ('updater', 'logs.view'),
  ('updater', 'risk.view'),

  -- Viewer: read-only
  ('viewer', 'project.view'), ('viewer', 'spec.view'), ('viewer', 'artwork.view'),
  ('viewer', 'audit.view'), ('viewer', 'logs.view'), ('viewer', 'risk.view'),

  -- Supplier: portal access for allocated items
  ('supplier', 'project.view'),
  ('supplier', 'material.artwork.upload'),
  ('supplier', 'material.po.update'),
  ('supplier', 'spec.view'),
  ('supplier', 'artwork.view'), ('supplier', 'artwork.upload')
ON CONFLICT (role_id, permission) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────
-- SECTION 4: USERS & USERS_PERMISSIONS
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  email VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  role_id VARCHAR(64) REFERENCES roles(id) ON DELETE SET NULL,
  role VARCHAR(64) NOT NULL DEFAULT 'updater',
  title VARCHAR(100),
  team VARCHAR(100),
  department VARCHAR(100),
  mobile VARCHAR(50),
  avatar TEXT,
  color VARCHAR(32) DEFAULT '#00d4c8',
  password_hash VARCHAR(255) NOT NULL,
  must_change_pw BOOLEAN NOT NULL DEFAULT FALSE,
  temp_pw VARCHAR(255),
  supplier_name VARCHAR(255),
  organization_id VARCHAR(64) DEFAULT 'org-yogabar-main',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id VARCHAR(64) REFERENCES roles(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users (role_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON users (is_active);

-- Link existing users' role_id
UPDATE users SET role_id = role WHERE role_id IS NULL AND role IN ('superadmin', 'admin', 'updater', 'viewer', 'supplier');

CREATE TABLE IF NOT EXISTS users_permissions (
  id SERIAL PRIMARY KEY,
  user_email VARCHAR(255) NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  permission VARCHAR(100) NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_user_permission UNIQUE (user_email, permission)
);

CREATE INDEX IF NOT EXISTS idx_users_permissions_user ON users_permissions (user_email);

-- ──────────────────────────────────────────────────────────────────────────
-- SECTION 5: SESSIONS
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  token VARCHAR(255) PRIMARY KEY,
  user_email VARCHAR(255) NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_email ON sessions (user_email);

-- ──────────────────────────────────────────────────────────────────────────
-- SECTION 6: PACKAGING_FORMATS
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS packaging_formats (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  code_prefix VARCHAR(50) NOT NULL,
  category VARCHAR(100) NOT NULL,
  hierarchy_tier INT NOT NULL DEFAULT 1,
  default_lead_time_days INT NOT NULL DEFAULT 15,
  is_pouch BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pkg_formats_name ON packaging_formats (name);
CREATE INDEX IF NOT EXISTS idx_pkg_formats_tier ON packaging_formats (hierarchy_tier);
CREATE INDEX IF NOT EXISTS idx_pkg_formats_is_active ON packaging_formats (is_active);

-- Seed Packaging Formats from Master Guide & App tables.xlsx
INSERT INTO packaging_formats (id, name, code_prefix, category, hierarchy_tier, default_lead_time_days, is_pouch, description)
VALUES
  ('PF-01', 'PET Bottle', 'PM/PR/PJR/', 'Primary Container', 1, 30, FALSE, 'Polyethylene terephthalate rigid bottle'),
  ('PF-02', 'HDPE Bottle', 'PM/PR/PJR/', 'Primary Container', 1, 30, FALSE, 'High-density polyethylene rigid bottle'),
  ('PF-03', 'Glass Bottle', 'PM/PR/GJR/', 'Primary Container', 1, 30, FALSE, 'Moulded or tubular glass bottle/jar'),
  ('PF-04', 'Flexible Pouch', 'PM/PR/POU/', 'Primary Container', 1, 21, TRUE, 'Multi-layer barrier flexible film pouch'),
  ('PF-05', 'Stand-up Pouch', 'PM/PR/POU/', 'Primary Container', 1, 21, TRUE, 'Doypack / stand-up barrier pouch with zipper/gusset'),
  ('PF-06', 'Sachet / Stick Pack', 'PM/PR/POU/', 'Primary Container', 1, 21, TRUE, 'Single-serve portion flexible stick pack or sachet'),
  ('PF-07', 'Monocarton', 'PM/SE/MON/', 'Secondary Box', 4, 15, FALSE, 'Folding paperboard monocarton retail box'),
  ('PF-08', 'Eflute', 'PM/SE/EFL/', 'Secondary Box', 4, 15, FALSE, 'E-flute micro-corrugated retail carton'),
  ('PF-09', 'Rigid Carton Box', 'PM/SE/KAP/', 'Secondary Box', 4, 30, FALSE, 'Rigid gift box or kappa board luxury carton'),
  ('PF-10', 'Corrugated Shipper', 'PM/SE/OCA/', 'Tertiary Shipper', 5, 10, FALSE, 'Outer corrugated transport case / master carton'),
  ('PF-11', 'Paper Label', 'PM/SE/LBL/', 'Primary Label', 3, 20, FALSE, 'Wet-glue or self-adhesive paper label'),
  ('PF-12', 'PP Label', 'PM/SE/LBL/', 'Primary Label', 3, 20, FALSE, 'Polypropylene synthetic film self-adhesive label'),
  ('PF-13', 'Shrink Sleeve', 'PM/SE/SHR/', 'Primary Label', 3, 20, FALSE, 'Full-body or tamper-evident heat-shrink PVC/PET sleeve'),
  ('PF-14', 'In-Mould Label', 'PM/SE/IML/', 'Primary Label', 3, 30, FALSE, 'In-mould decorative label for injection moulding'),
  ('PF-15', 'Cap / Closure', 'PM/PR/CAP/', 'Primary Closure', 2, 30, FALSE, 'Screw cap, flip-top cap, or child-resistant closure'),
  ('PF-16', 'Pump Dispenser', 'PM/PR/PUM/', 'Primary Closure', 2, 30, FALSE, 'Lotion pump, mist sprayer, or trigger dispenser'),
  ('PF-17', 'Liner / Foil Seal', 'PM/PR/FOI/', 'Primary Closure', 2, 20, FALSE, 'Induction heat seal liner or pressure-sensitive foil wad'),
  ('PF-18', 'Laminated Tube', 'PM/PR/TUB/', 'Primary Container', 1, 45, FALSE, 'ABL or PBL barrier laminated squeeze tube'),
  ('PF-19', 'Aluminium/Tin Can', 'PM/PR/TIN/', 'Primary Container', 1, 30, FALSE, 'Food-grade aluminium can or tinplate container'),
  ('PF-20', 'Aerosol Can', 'PM/PR/AER/', 'Primary Container', 1, 45, FALSE, 'Pressurized metal aerosol canister'),
  ('PF-21', 'Thermoform Tray', 'PM/PR/TRA/', 'Primary Container', 1, 25, FALSE, 'Thermoformed plastic blister tray or insert'),
  ('PF-22', 'Blister Pack', 'PM/PR/BLI/', 'Primary Container', 1, 25, FALSE, 'Push-through or peelable blister card with lidding foil'),
  ('PF-23', 'Insert / Leaflet', 'PM/PR/LEA/', 'Secondary Box', 4, 10, FALSE, 'Patient or consumer information folded leaflet / outsert'),
  ('PF-24', 'Other', 'PM/PR/GEN/', 'Ancillary Pack', 6, 15, FALSE, 'Specialized or ancillary packaging component')
ON CONFLICT (name) DO UPDATE SET
  code_prefix = EXCLUDED.code_prefix,
  category = EXCLUDED.category,
  hierarchy_tier = EXCLUDED.hierarchy_tier,
  default_lead_time_days = EXCLUDED.default_lead_time_days,
  is_pouch = EXCLUDED.is_pouch,
  description = EXCLUDED.description,
  updated_at = CURRENT_TIMESTAMP;

-- ──────────────────────────────────────────────────────────────────────────
-- SECTION 7: PROJECTS
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(100) PRIMARY KEY,
  fg_code VARCHAR(100),
  project_name VARCHAR(255) NOT NULL,
  sku_size VARCHAR(100),
  project_type VARCHAR(100) NOT NULL DEFAULT 'Regular',
  project_category VARCHAR(100) NOT NULL DEFAULT 'NPD',
  stage VARCHAR(50) NOT NULL DEFAULT 'Brief',
  status VARCHAR(50) NOT NULL DEFAULT 'On Track',
  risk VARCHAR(50) NOT NULL DEFAULT 'Low',
  brief_date DATE,
  target_launch_date DATE,
  launch_date DATE,
  supplier VARCHAR(255),
  factory VARCHAR(255),
  description TEXT,
  comments TEXT,
  milestones JSONB NOT NULL DEFAULT '{}'::jsonb,
  original_milestones JSONB NOT NULL DEFAULT '{}'::jsonb,
  crunch_plan JSONB,
  materials JSONB NOT NULL DEFAULT '[]'::jsonb,
  stage_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  status_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  audit_trail JSONB NOT NULL DEFAULT '[]'::jsonb,
  ownership JSONB DEFAULT '{}'::jsonb,
  risks JSONB DEFAULT '[]'::jsonb,
  organization_id VARCHAR(64) DEFAULT 'org-yogabar-main',
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by JSONB,
  created_by JSONB,
  updated_by JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_stage ON projects (stage);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects (status);
CREATE INDEX IF NOT EXISTS idx_projects_is_deleted ON projects (is_deleted);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects (created_at DESC);

-- ──────────────────────────────────────────────────────────────────────────
-- SECTION 8: PROJECT_MATERIALS
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_materials (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(100) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  packaging_format_id VARCHAR(64) REFERENCES packaging_formats(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  pm_code VARCHAR(100),
  material_type VARCHAR(100),
  print_type VARCHAR(100),
  brief_date DATE,
  lead_time_days INT,
  supplier VARCHAR(255),
  custom_lead_time INT,
  po_status VARCHAR(100),
  po_number VARCHAR(100),
  specs JSONB DEFAULT '{}'::jsonb,
  spec_sheet JSONB,
  artwork_url TEXT,
  artwork_file_name VARCHAR(255),
  variants JSONB DEFAULT '[]'::jsonb,
  stage VARCHAR(50) DEFAULT 'Brief',
  milestones JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_proj_mat_project_id ON project_materials (project_id);
CREATE INDEX IF NOT EXISTS idx_proj_mat_format_id ON project_materials (packaging_format_id);
CREATE INDEX IF NOT EXISTS idx_proj_mat_pm_code ON project_materials (pm_code);
CREATE INDEX IF NOT EXISTS idx_proj_mat_stage ON project_materials (stage);

-- ──────────────────────────────────────────────────────────────────────────
-- SECTION 9: SPECIFICATIONS (SPEC TABLE)
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS specifications (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(100) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  material_id VARCHAR(64) REFERENCES project_materials(id) ON DELETE CASCADE,
  packaging_format_id VARCHAR(64) REFERENCES packaging_formats(id) ON DELETE SET NULL,
  item_code VARCHAR(100),
  artwork_code VARCHAR(100),
  doc_name VARCHAR(255) NOT NULL,
  category VARCHAR(100) DEFAULT 'generic',
  revision VARCHAR(50) DEFAULT 'v1.0',
  version INT DEFAULT 1,
  status VARCHAR(50) DEFAULT 'DRAFT',
  general_details JSONB DEFAULT '{}'::jsonb,
  dimensions JSONB DEFAULT '{}'::jsonb,
  parameters JSONB DEFAULT '[]'::jsonb,
  performance_tests JSONB DEFAULT '[]'::jsonb,
  quality_clauses JSONB DEFAULT '[]'::jsonb,
  governance JSONB DEFAULT '{}'::jsonb,
  variants JSONB DEFAULT '[]'::jsonb,
  clubbed_codes TEXT,
  created_by JSONB,
  updated_by JSONB,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_specs_project_id ON specifications (project_id);
CREATE INDEX IF NOT EXISTS idx_specs_material_id ON specifications (material_id);
CREATE INDEX IF NOT EXISTS idx_specs_format_id ON specifications (packaging_format_id);
CREATE INDEX IF NOT EXISTS idx_specs_item_code ON specifications (item_code);
CREATE INDEX IF NOT EXISTS idx_specs_status ON specifications (status);

-- ──────────────────────────────────────────────────────────────────────────
-- SECTION 10: ARTWORKS (ARTWORK TABLE)
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artworks (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(100) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  material_id VARCHAR(64) REFERENCES project_materials(id) ON DELETE CASCADE,
  specification_id VARCHAR(64) REFERENCES specifications(id) ON DELETE SET NULL,
  artwork_code VARCHAR(100) NOT NULL,
  pm_code VARCHAR(100),
  version_tag VARCHAR(32) DEFAULT 'v1',
  version_number INT DEFAULT 1,
  status VARCHAR(50) DEFAULT 'UPLOADED',
  files JSONB DEFAULT '[]'::jsonb,
  variants JSONB DEFAULT '[]'::jsonb,
  pantone_colors JSONB DEFAULT '["CMYK"]'::jsonb,
  dimensions VARCHAR(255) DEFAULT 'Standard',
  rejection_reason TEXT,
  approved_by JSONB,
  approved_at TIMESTAMPTZ,
  uploaded_by JSONB,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_artworks_project_id ON artworks (project_id);
CREATE INDEX IF NOT EXISTS idx_artworks_material_id ON artworks (material_id);
CREATE INDEX IF NOT EXISTS idx_artworks_spec_id ON artworks (specification_id);
CREATE INDEX IF NOT EXISTS idx_artworks_code ON artworks (artwork_code);
CREATE INDEX IF NOT EXISTS idx_artworks_status ON artworks (status);

-- ──────────────────────────────────────────────────────────────────────────
-- SECTION 11: PROJECT_RISKS
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_risks (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(100) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  impact VARCHAR(50) DEFAULT 'Medium',
  prob VARCHAR(50) DEFAULT 'Medium',
  level VARCHAR(50) DEFAULT 'Medium',
  mitigation TEXT,
  owner VARCHAR(100) DEFAULT 'Packaging',
  status VARCHAR(50) DEFAULT 'Open',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_risks_project_id ON project_risks (project_id);
CREATE INDEX IF NOT EXISTS idx_risks_stage ON project_risks (stage);
CREATE INDEX IF NOT EXISTS idx_risks_status ON project_risks (status);

