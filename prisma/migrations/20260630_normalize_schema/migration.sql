-- Migration: Normalize denormalized JSON columns into proper relational tables
-- Wrapped in a transaction with rollback capability
BEGIN;

-- ============================================================
-- 1. CREATE NEW TABLES
-- ============================================================

-- 1a. call_logs (replaces people.callHistory JSON)
CREATE TABLE IF NOT EXISTS call_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "personId" TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  "sessionId" TEXT,
  "calledAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL,
  remark TEXT,
  "calledBy" TEXT
);
CREATE INDEX IF NOT EXISTS idx_call_logs_person ON call_logs ("personId");
CREATE INDEX IF NOT EXISTS idx_call_logs_called_at ON call_logs ("calledAt");

-- 1b. person_stage_history (replaces people.progress JSON)
CREATE TABLE IF NOT EXISTS person_stage_history (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "personId" TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  note TEXT,
  "changedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "changedBy" TEXT
);
CREATE INDEX IF NOT EXISTS idx_stage_history_person ON person_stage_history ("personId");

-- 1c. contact_sources lookup table (replaces people.contactSource JSON)
CREATE TABLE IF NOT EXISTS contact_sources (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL UNIQUE
);

-- 1d. person_contact_sources join table
CREATE TABLE IF NOT EXISTS person_contact_sources (
  "personId" TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  "contactSourceId" TEXT NOT NULL REFERENCES contact_sources(id) ON DELETE CASCADE,
  PRIMARY KEY ("personId", "contactSourceId")
);

-- 1e. group_shared_users (replaces groups.sharedWithUserIds JSON)
CREATE TABLE IF NOT EXISTS group_shared_users (
  "groupId" TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY ("groupId", "userId")
);

-- 1f. group_report_recipients (replaces groups.reportRecipients JSON)
CREATE TABLE IF NOT EXISTS group_report_recipients (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "groupId" TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  email TEXT NOT NULL
);

-- 1g. calling_session_enablers (replaces calling_sessions.coEnablerIds JSON)
CREATE TABLE IF NOT EXISTS calling_session_enablers (
  "sessionId" TEXT NOT NULL REFERENCES calling_sessions(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY ("sessionId", "userId")
);

-- 1h. co_enabler_session_people (replaces co_enabler_sessions.peopleIds JSON)
CREATE TABLE IF NOT EXISTS co_enabler_session_people (
  "sessionId" TEXT NOT NULL REFERENCES co_enabler_sessions(id) ON DELETE CASCADE,
  "personId" TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  PRIMARY KEY ("sessionId", "personId")
);

-- ============================================================
-- 2. MIGRATE DATA FROM JSON COLUMNS TO NEW TABLES
-- ============================================================

-- 2a. Migrate people.callHistory → call_logs
-- Handles both ISO strings and Firestore timestamp objects: {"_seconds": N, "_nanoseconds": N}
INSERT INTO call_logs ("personId", "calledAt", status, remark, "calledBy")
SELECT
  p.id,
  CASE
    WHEN elem->'calledAt'->>'_seconds' IS NOT NULL THEN
      to_timestamp((elem->'calledAt'->>'_seconds')::bigint)
    WHEN elem->>'calledAt' ~ '^\d{4}-\d{2}-\d{2}' THEN
      (elem->>'calledAt')::timestamptz
    ELSE COALESCE(p."lastCallAt", NOW())
  END,
  COALESCE(elem->>'status', p."lastCallStatus", 'unknown'),
  COALESCE(elem->>'remark', p."lastCallRemark"),
  elem->>'calledBy'
FROM people p
CROSS JOIN LATERAL json_array_elements(
  CASE WHEN p."callHistory" IS NOT NULL AND p."callHistory" != ''
       THEN p."callHistory"::json ELSE '[]'::json END
) AS elem;

-- 2b. Migrate people.attendanceHistory → attendance table
-- Skip: attendance table already exists. The JSON was a redundant copy.
-- Data is already in the attendance table from the original source.

-- 2c. Migrate people.progress → person_stage_history
INSERT INTO person_stage_history ("personId", stage, note, "changedAt")
SELECT
  p.id,
  COALESCE(elem->>'stage', p."currentFolkStage"),
  elem->>'note',
  CASE
    WHEN elem->'timestamp'->>'_seconds' IS NOT NULL THEN
      to_timestamp((elem->'timestamp'->>'_seconds')::bigint)
    WHEN elem->>'timestamp' ~ '^\d{4}-\d{2}-\d{2}' THEN
      (elem->>'timestamp')::timestamptz
    ELSE NOW()
  END
FROM people p
CROSS JOIN LATERAL json_array_elements(
  CASE WHEN p.progress IS NOT NULL AND p.progress != ''
       THEN p.progress::json ELSE '[]'::json END
) AS elem;

-- 2d. Migrate people.contactSource → person_contact_sources
-- First ensure all unique source names exist in contact_sources
INSERT INTO contact_sources (name)
SELECT DISTINCT trim(elem::text, '"')
FROM people p
CROSS JOIN LATERAL json_array_elements(
  CASE WHEN p."contactSource" IS NOT NULL AND p."contactSource" != ''
       THEN p."contactSource"::json ELSE '[]'::json END
) AS elem
ON CONFLICT (name) DO NOTHING;

-- Then create the join records
INSERT INTO person_contact_sources ("personId", "contactSourceId")
SELECT DISTINCT p.id, cs.id
FROM people p
CROSS JOIN LATERAL json_array_elements(
  CASE WHEN p."contactSource" IS NOT NULL AND p."contactSource" != ''
       THEN p."contactSource"::json ELSE '[]'::json END
) AS elem
JOIN contact_sources cs ON cs.name = trim(elem::text, '"')
ON CONFLICT DO NOTHING;

-- 2e. Migrate groups.sharedWithUserIds → group_shared_users
INSERT INTO group_shared_users ("groupId", "userId")
SELECT g.id, trim(elem::text, '"')
FROM groups g
CROSS JOIN LATERAL json_array_elements(
  CASE WHEN g."sharedWithUserIds" IS NOT NULL AND g."sharedWithUserIds" != ''
       THEN g."sharedWithUserIds"::json ELSE '[]'::json END
) AS elem
ON CONFLICT DO NOTHING;

-- 2f. Migrate groups.reportRecipients → group_report_recipients
INSERT INTO group_report_recipients ("groupId", email)
SELECT g.id, trim(elem::text, '"')
FROM groups g
CROSS JOIN LATERAL json_array_elements(
  CASE WHEN g."reportRecipients" IS NOT NULL AND g."reportRecipients" != ''
       THEN g."reportRecipients"::json ELSE '[]'::json END
) AS elem;

-- 2g. Migrate calling_sessions.coEnablerIds → calling_session_enablers
INSERT INTO calling_session_enablers ("sessionId", "userId")
SELECT cs.id, trim(elem::text, '"')
FROM calling_sessions cs
CROSS JOIN LATERAL json_array_elements(
  CASE WHEN cs."coEnablerIds" IS NOT NULL AND cs."coEnablerIds" != ''
       THEN cs."coEnablerIds"::json ELSE '[]'::json END
) AS elem
ON CONFLICT DO NOTHING;

-- 2h. Migrate co_enabler_sessions.peopleIds → co_enabler_session_people
INSERT INTO co_enabler_session_people ("sessionId", "personId")
SELECT ces.id, trim(elem::text, '"')
FROM co_enabler_sessions ces
CROSS JOIN LATERAL json_array_elements(
  CASE WHEN ces."peopleIds" IS NOT NULL AND ces."peopleIds" != ''
       THEN ces."peopleIds"::json ELSE '[]'::json END
) AS elem
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. ADD NEW COLUMNS
-- ============================================================

-- 3a. Add assignedById FK to groups (replaces assignedBy/assignedByName/assignedToName)
ALTER TABLE groups ADD COLUMN IF NOT EXISTS "assignedById" TEXT REFERENCES users(id);

-- 3b. Add updatedAt timestamps for conflict resolution
ALTER TABLE people ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW();
ALTER TABLE groups ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW();
ALTER TABLE calling_sessions ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW();

-- 3c. Add coEnablerSessionId FK to people (replaces 4 denorm columns)
ALTER TABLE people ADD COLUMN IF NOT EXISTS "coEnablerSessionId" TEXT REFERENCES co_enabler_sessions(id);

-- 3d. Add functional index for case-insensitive search (replaces fullNameLowercase)
CREATE INDEX IF NOT EXISTS idx_people_fullname_lower ON people (LOWER("fullName"));

-- ============================================================
-- 4. DROP OLD DENORMALIZED COLUMNS
-- ============================================================

ALTER TABLE people DROP COLUMN IF EXISTS "fullNameLowercase";
ALTER TABLE people DROP COLUMN IF EXISTS "callHistory";
ALTER TABLE people DROP COLUMN IF EXISTS "attendanceHistory";
ALTER TABLE people DROP COLUMN IF EXISTS progress;
ALTER TABLE people DROP COLUMN IF EXISTS "contactSource";
ALTER TABLE people DROP COLUMN IF EXISTS "coEnablerId";
ALTER TABLE people DROP COLUMN IF EXISTS "coEnablerName";
ALTER TABLE people DROP COLUMN IF EXISTS "coEnablerExpiry";
ALTER TABLE people DROP COLUMN IF EXISTS "activeCoEnablerSessionId";

ALTER TABLE groups DROP COLUMN IF EXISTS "sharedWithUserIds";
ALTER TABLE groups DROP COLUMN IF EXISTS "reportRecipients";
ALTER TABLE groups DROP COLUMN IF EXISTS "assignedBy";
ALTER TABLE groups DROP COLUMN IF EXISTS "assignedByName";
ALTER TABLE groups DROP COLUMN IF EXISTS "assignedToName";

ALTER TABLE calling_sessions DROP COLUMN IF EXISTS "coEnablerIds";

ALTER TABLE co_enabler_sessions DROP COLUMN IF EXISTS "peopleIds";

-- ============================================================
-- 5. ADD INDEXES FOR QUERY PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_attendance_person_event ON attendance ("personId", "eventId");
CREATE INDEX IF NOT EXISTS idx_attendance_marked_at ON attendance ("markedAt");
CREATE INDEX IF NOT EXISTS idx_people_enabler_id ON people ("enablerId");
CREATE INDEX IF NOT EXISTS idx_people_folk_guide_id ON people ("folkGuideId");
CREATE INDEX IF NOT EXISTS idx_people_last_call_at ON people ("lastCallAt");
CREATE INDEX IF NOT EXISTS idx_people_stage ON people ("currentFolkStage");
CREATE INDEX IF NOT EXISTS idx_people_co_enabler_session ON people ("coEnablerSessionId");

COMMIT;
