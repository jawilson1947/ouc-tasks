-- ============================================================================
-- OUC Infrastructure Tasks — Complete MySQL Schema + Seed Data
-- ============================================================================
-- Converted from Supabase/PostgreSQL (migrations 0001–0005)
-- Requires: MySQL 8.0.13+ (for DEFAULT (UUID()) expression support)
--
-- KEY DIFFERENCES FROM THE SUPABASE VERSION:
--
-- 1. AUTHENTICATION: Supabase Auth (auth.users) is replaced by a standalone
--    user_profile table with a password_hash column. You must update the
--    Next.js application to use Auth.js / NextAuth.js (or similar) pointed
--    at this MySQL database instead of Supabase's auth helpers.
--
-- 2. ROW-LEVEL SECURITY: MySQL does not support RLS. All access control
--    that was enforced by Supabase RLS policies must be enforced in the
--    application layer (Next.js Server Actions / API routes).
--
-- 3. UUID DEFAULTS: Uses MySQL's built-in UUID() function via the
--    DEFAULT (UUID()) expression syntax (requires MySQL 8.0.13+).
--    On older MySQL, remove the DEFAULT clause and generate UUIDs in
--    the application before every INSERT.
--
-- 4. AGGREGATE FILTER: MySQL does not support COUNT(...) FILTER (WHERE ...).
--    The task_with_totals view uses COUNT(CASE WHEN ... THEN 1 END) instead.
--
-- 5. TRIGGERS: The updated_at column uses ON UPDATE CURRENT_TIMESTAMP
--    natively in MySQL, so no separate trigger is needed for that.
--    The maybe_complete_task trigger is ported to MySQL syntax.
--
-- HOW TO RUN:
--   mysql -u YOUR_USER -p YOUR_DATABASE < mysql_schema.sql
--   (or paste into MySQL Workbench / phpMyAdmin / DBeaver)
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- Section 1: Reference tables (no FK dependencies)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- category
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS category (
    id          INT             NOT NULL AUTO_INCREMENT,
    name        VARCHAR(255)    NOT NULL,
    color_hex   VARCHAR(20)     NULL,
    sort_order  INT             NOT NULL DEFAULT 0,

    PRIMARY KEY (id),
    UNIQUE KEY category_name_uq (name),
    KEY        category_sort_idx (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- location
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS location (
    id          INT             NOT NULL AUTO_INCREMENT,
    name        VARCHAR(255)    NOT NULL,
    building    VARCHAR(255)    NULL,
    sort_order  INT             NOT NULL DEFAULT 0,

    PRIMARY KEY (id),
    UNIQUE KEY location_name_uq (name),
    KEY        location_sort_idx (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Section 2: User accounts
-- (Replaces Supabase auth.users + user_profile in a single table)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_profile (
    id                  VARCHAR(36)     NOT NULL DEFAULT (UUID()),

    -- Authentication fields (were managed by Supabase Auth)
    email               VARCHAR(255)    NOT NULL,
    password_hash       VARCHAR(255)    NULL,       -- BCrypt/Argon2 hash; NULL for magic-link-only accounts
    email_verified      TINYINT(1)      NOT NULL DEFAULT 0,

    -- Profile fields
    full_name           VARCHAR(255)    NOT NULL,
    role                ENUM('admin','editor','viewer') NOT NULL DEFAULT 'viewer',
    phone               VARCHAR(50)     NULL,
    active              TINYINT(1)      NOT NULL DEFAULT 1,
    last_login          DATETIME        NULL,

    -- Contractor-specific fields (NULL for non-contractor users)
    company_name        VARCHAR(255)    NULL,
    trade               VARCHAR(255)    NULL,
    license_number      VARCHAR(100)    NULL,
    insurance_expiry    DATE            NULL,
    default_labor_rate  DECIMAL(10,2)   NULL,
    billing_email       VARCHAR(255)    NULL,
    mailing_address     TEXT            NULL,
    notes               TEXT            NULL,

    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY user_profile_email_uq (email),
    KEY        user_profile_role_idx (role, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Section 3: Contractor (vendor / sub-contractor business entity)
-- ============================================================================

CREATE TABLE IF NOT EXISTS contractor (
    id                    VARCHAR(36)     NOT NULL DEFAULT (UUID()),
    business_name         VARCHAR(255)    NOT NULL,
    primary_first_name    VARCHAR(100)    NULL,
    primary_last_name     VARCHAR(100)    NULL,
    primary_email         VARCHAR(255)    NULL,
    primary_phone         VARCHAR(50)     NULL,
    address_line1         VARCHAR(255)    NULL,
    address_line2         VARCHAR(255)    NULL,
    city                  VARCHAR(100)    NULL,
    state                 VARCHAR(50)     NULL,
    zipcode               VARCHAR(20)     NULL,
    business_phone        VARCHAR(50)     NULL,
    notes                 TEXT            NULL,
    active                TINYINT(1)      NOT NULL DEFAULT 1,
    created_by            VARCHAR(36)     NULL,
    created_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY        contractor_business_name_idx (business_name),
    KEY        contractor_active_idx (active),
    CONSTRAINT fk_contractor_created_by
        FOREIGN KEY (created_by) REFERENCES user_profile (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Section 4: Tasks
-- ============================================================================

CREATE TABLE IF NOT EXISTS task (
    id                  VARCHAR(36)     NOT NULL DEFAULT (UUID()),
    legacy_id           INT             NULL,           -- human-readable task number
    title               VARCHAR(500)    NOT NULL,
    description         TEXT            NULL,
    priority            INT             NOT NULL,
    status              ENUM('not_started','in_progress','blocked','done')
                                        NOT NULL DEFAULT 'not_started',
    category_id         INT             NULL,
    location_id         INT             NULL,
    assignee_id         VARCHAR(36)     NULL,
    contractor_id       VARCHAR(36)     NULL,
    due_date            DATE            NULL,
    needs_by_date       DATE            NULL,
    notes               TEXT            NULL,
    created_by          VARCHAR(36)     NULL,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    completed_at        DATETIME        NULL,

    PRIMARY KEY (id),
    UNIQUE KEY task_legacy_id_uq (legacy_id),
    KEY        task_status_idx       (status),
    KEY        task_priority_idx     (priority, due_date),
    KEY        task_assignee_idx     (assignee_id),
    KEY        task_category_idx     (category_id),
    KEY        task_location_idx     (location_id),
    KEY        task_contractor_idx   (contractor_id),

    CONSTRAINT chk_task_priority
        CHECK (priority BETWEEN 1 AND 5),
    CONSTRAINT fk_task_category
        FOREIGN KEY (category_id)   REFERENCES category    (id) ON DELETE SET NULL,
    CONSTRAINT fk_task_location
        FOREIGN KEY (location_id)   REFERENCES location    (id) ON DELETE SET NULL,
    CONSTRAINT fk_task_assignee
        FOREIGN KEY (assignee_id)   REFERENCES user_profile (id) ON DELETE SET NULL,
    CONSTRAINT fk_task_contractor
        FOREIGN KEY (contractor_id) REFERENCES contractor   (id) ON DELETE SET NULL,
    CONSTRAINT fk_task_created_by
        FOREIGN KEY (created_by)    REFERENCES user_profile (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Section 5: Subtasks
-- ============================================================================

CREATE TABLE IF NOT EXISTS subtask (
    id                  VARCHAR(36)     NOT NULL DEFAULT (UUID()),
    task_id             VARCHAR(36)     NOT NULL,
    sequence            INT             NOT NULL,
    description         TEXT            NOT NULL,
    labor_cost          DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
    equipment_cost      DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
    status              ENUM('not_started','in_progress','done')
                                        NOT NULL DEFAULT 'not_started',
    completed_at        DATETIME        NULL,
    completed_by        VARCHAR(36)     NULL,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY subtask_task_seq_uq (task_id, sequence),
    KEY        subtask_status_idx (status),

    CONSTRAINT fk_subtask_task
        FOREIGN KEY (task_id)      REFERENCES task         (id) ON DELETE CASCADE,
    CONSTRAINT fk_subtask_completed_by
        FOREIGN KEY (completed_by) REFERENCES user_profile (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Section 6: task_with_totals view
-- NOTE: MySQL does not support FILTER (WHERE ...) in aggregate functions.
--       COUNT(CASE WHEN s.status = 'done' THEN 1 END) is the equivalent.
-- ============================================================================

CREATE OR REPLACE VIEW task_with_totals AS
SELECT
    t.*,
    COALESCE(SUM(s.labor_cost), 0)                              AS total_labor_cost,
    COALESCE(SUM(s.equipment_cost), 0)                          AS total_equipment_cost,
    COALESCE(SUM(s.labor_cost + s.equipment_cost), 0)           AS total_cost,
    COUNT(s.id)                                                 AS subtask_count,
    COUNT(CASE WHEN s.status = 'done' THEN 1 END)               AS subtask_done_count
FROM task t
LEFT JOIN subtask s ON s.task_id = t.id
GROUP BY
    t.id, t.legacy_id, t.title, t.description, t.priority, t.status,
    t.category_id, t.location_id, t.assignee_id, t.contractor_id,
    t.due_date, t.needs_by_date, t.notes, t.created_by,
    t.created_at, t.updated_at, t.completed_at;

-- ============================================================================
-- Section 7: Attachments
-- ============================================================================

CREATE TABLE IF NOT EXISTS attachment (
    id              VARCHAR(36)     NOT NULL DEFAULT (UUID()),
    task_id         VARCHAR(36)     NULL,
    subtask_id      VARCHAR(36)     NULL,
    type            ENUM('photo','receipt','spec','document','other')
                                    NOT NULL DEFAULT 'photo',
    filename        VARCHAR(500)    NOT NULL,
    storage_path    VARCHAR(1000)   NOT NULL,
    content_type    VARCHAR(100)    NULL,
    size_bytes      BIGINT          NULL,
    caption         TEXT            NULL,
    receipt_amount  DECIMAL(10,2)   NULL,
    vendor          VARCHAR(255)    NULL,
    receipt_date    DATE            NULL,
    uploaded_by     VARCHAR(36)     NULL,
    uploaded_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY attachment_task_idx    (task_id),
    KEY attachment_subtask_idx (subtask_id),
    KEY attachment_type_idx    (type),

    -- At least one of task_id / subtask_id must be set
    CONSTRAINT chk_attachment_has_parent
        CHECK (task_id IS NOT NULL OR subtask_id IS NOT NULL),
    -- receipt_amount required when type = 'receipt'
    CONSTRAINT chk_attachment_receipt
        CHECK (type != 'receipt' OR receipt_amount IS NOT NULL),

    CONSTRAINT fk_attachment_task
        FOREIGN KEY (task_id)    REFERENCES task         (id) ON DELETE CASCADE,
    CONSTRAINT fk_attachment_subtask
        FOREIGN KEY (subtask_id) REFERENCES subtask      (id) ON DELETE CASCADE,
    CONSTRAINT fk_attachment_uploaded
        FOREIGN KEY (uploaded_by) REFERENCES user_profile (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Section 8: Comments
-- ============================================================================

CREATE TABLE IF NOT EXISTS comment (
    id          VARCHAR(36)     NOT NULL DEFAULT (UUID()),
    task_id     VARCHAR(36)     NOT NULL,
    author_id   VARCHAR(36)     NOT NULL,
    body        TEXT            NOT NULL,
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    edited_at   DATETIME        NULL,

    PRIMARY KEY (id),
    KEY comment_task_idx (task_id, created_at),

    CONSTRAINT fk_comment_task
        FOREIGN KEY (task_id)   REFERENCES task         (id) ON DELETE CASCADE,
    CONSTRAINT fk_comment_author
        FOREIGN KEY (author_id) REFERENCES user_profile (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Section 9: Audit log
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
    id          BIGINT          NOT NULL AUTO_INCREMENT,
    table_name  VARCHAR(100)    NOT NULL,
    record_id   VARCHAR(36)     NOT NULL,
    action      ENUM('insert','update','delete') NOT NULL,
    changed_by  VARCHAR(36)     NULL,
    changed_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    old_values  JSON            NULL,
    new_values  JSON            NULL,

    PRIMARY KEY (id),
    KEY audit_log_record_idx (table_name, record_id, changed_at),

    CONSTRAINT fk_audit_log_changed_by
        FOREIGN KEY (changed_by) REFERENCES user_profile (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Section 10: Triggers
-- ============================================================================
-- Note: updated_at maintenance is handled automatically by the
--   ON UPDATE CURRENT_TIMESTAMP column default on every table — no trigger
--   needed for that in MySQL.
--
-- The trigger below ports the PostgreSQL maybe_complete_task() function:
-- when ALL subtasks of a task reach 'done', the parent task is auto-completed.
-- ============================================================================

DELIMITER $$

-- Fires after a subtask row is updated
CREATE TRIGGER trg_subtask_maybe_complete_update
    AFTER UPDATE ON subtask
    FOR EACH ROW
BEGIN
    DECLARE remaining_count INT DEFAULT 0;

    IF NEW.status = 'done' THEN
        SELECT COUNT(*) INTO remaining_count
          FROM subtask
         WHERE task_id = NEW.task_id
           AND status  != 'done';

        IF remaining_count = 0 THEN
            UPDATE task
               SET status       = 'done',
                   completed_at = NOW()
             WHERE id     = NEW.task_id
               AND status != 'done';
        END IF;
    END IF;
END$$

-- Also fires after a new subtask is inserted (in case it's inserted as 'done')
CREATE TRIGGER trg_subtask_maybe_complete_insert
    AFTER INSERT ON subtask
    FOR EACH ROW
BEGIN
    DECLARE remaining_count INT DEFAULT 0;

    IF NEW.status = 'done' THEN
        SELECT COUNT(*) INTO remaining_count
          FROM subtask
         WHERE task_id = NEW.task_id
           AND status  != 'done';

        IF remaining_count = 0 THEN
            UPDATE task
               SET status       = 'done',
                   completed_at = NOW()
             WHERE id     = NEW.task_id
               AND status != 'done';
        END IF;
    END IF;
END$$

DELIMITER ;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- Section 11: Seed data
-- ============================================================================

INSERT INTO category (name, color_hex, sort_order) VALUES
    ('Surveillance',   '#3B7BD9', 10),
    ('Access Control', '#0EA5A4', 20),
    ('AV/Displays',    '#8B5CF6', 30),
    ('Cabling',        '#F59E0B', 40),
    ('Maintenance',    '#10B981', 50),
    ('Other',          '#6B7280', 90)
ON DUPLICATE KEY UPDATE
    color_hex  = VALUES(color_hex),
    sort_order = VALUES(sort_order);

INSERT INTO location (name, building, sort_order) VALUES
    ('Family Life Center (FLC)', 'FLC',       10),
    ('Sanctuary',                'Main',      20),
    ('Pastoral Suite',           'Main',      30),
    ('Senior Pastor Office',     'Main',      31),
    ('Choir Room',               'Main',      40),
    ('Treasury',                 'Main',      50),
    ('Admin Office',             'Main',      60),
    ('MPRN (North)',             'Main',      70),
    ('MPRS (South)',             'Main',      80),
    ('Main Foyer',               'Main',      90),
    ('Main Lobby',               'Main',     100),
    ('Balcony',                  'Main',     110),
    ('North Entry',              'Main',     120),
    ('Breezeway',                'FLC/Main', 130),
    ('FLC Gym',                  'FLC',      140),
    ('FLC Sprinkler Room',       'FLC',      150),
    ('Video Production Rack',    'Main',     160)
ON DUPLICATE KEY UPDATE
    building   = VALUES(building),
    sort_order = VALUES(sort_order);

-- ============================================================================
-- Verify with:
--   SELECT COUNT(*) FROM category;           -- should be 6
--   SELECT COUNT(*) FROM location;           -- should be 17
--   DESCRIBE task;                           -- should include contractor_id
--   SELECT * FROM task_with_totals LIMIT 1;  -- should work (empty result ok)
-- ============================================================================
