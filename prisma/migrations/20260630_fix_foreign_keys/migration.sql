BEGIN;

-- FIX 1: call_logs add missing columns
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS "calledById" TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS "sgRating" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS "maRating" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS "frpRating" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS "nextFollowUpAt" TIMESTAMP;
ALTER TABLE call_logs DROP CONSTRAINT IF EXISTS fk_calllogs_calledby;
ALTER TABLE call_logs ADD CONSTRAINT fk_calllogs_calledby FOREIGN KEY ("calledById") REFERENCES users(id) ON DELETE SET NULL;
UPDATE call_logs cl SET "calledById" = u.id FROM users u WHERE u.name = cl."calledBy" AND cl."calledById" IS NULL;

-- FIX 2: person_stage_history add FK for changedBy
ALTER TABLE person_stage_history ADD COLUMN IF NOT EXISTS "changedById" TEXT;
ALTER TABLE person_stage_history DROP CONSTRAINT IF EXISTS fk_stagehistory_changedby;
ALTER TABLE person_stage_history ADD CONSTRAINT fk_stagehistory_changedby FOREIGN KEY ("changedById") REFERENCES users(id) ON DELETE SET NULL;
UPDATE person_stage_history psh SET "changedById" = u.id FROM users u WHERE u.name = psh."changedBy" AND psh."changedById" IS NULL;

-- FIX 3: Convert text date columns to proper types
ALTER TABLE people ADD COLUMN IF NOT EXISTS "nextFollowUpAt_tmp" TIMESTAMP;
UPDATE people SET "nextFollowUpAt_tmp" = CASE WHEN "nextFollowUpAt" IS NOT NULL THEN "nextFollowUpAt"::timestamp ELSE NULL END;
ALTER TABLE people DROP COLUMN IF EXISTS "nextFollowUpAt";
ALTER TABLE people RENAME COLUMN "nextFollowUpAt_tmp" TO "nextFollowUpAt";
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS date_tmp DATE;
UPDATE attendance SET date_tmp = CASE WHEN date ~ '^\d{4}-\d{2}-\d{2}' THEN date::date ELSE '1970-01-01'::date END;
ALTER TABLE attendance DROP COLUMN IF EXISTS date;
ALTER TABLE attendance RENAME COLUMN date_tmp TO date;
ALTER TABLE attendance ALTER COLUMN date SET NOT NULL;
ALTER TABLE group_events ADD COLUMN IF NOT EXISTS date_tmp DATE;
UPDATE group_events SET date_tmp = CASE WHEN date ~ '^\d{4}-\d{2}-\d{2}' THEN date::date ELSE '1970-01-01'::date END;
ALTER TABLE group_events DROP COLUMN IF EXISTS date;
ALTER TABLE group_events RENAME COLUMN date_tmp TO date;
ALTER TABLE group_events ALTER COLUMN date SET NOT NULL;

-- FIX 4: Add ALL missing foreign key constraints
ALTER TABLE people DROP CONSTRAINT IF EXISTS fk_people_enabler;
ALTER TABLE people ADD CONSTRAINT fk_people_enabler FOREIGN KEY ("enablerId") REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE people DROP CONSTRAINT IF EXISTS fk_people_folkguide;
ALTER TABLE people ADD CONSTRAINT fk_people_folkguide FOREIGN KEY ("folkGuideId") REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE people DROP CONSTRAINT IF EXISTS fk_people_coenablerSession;
ALTER TABLE people ADD CONSTRAINT fk_people_coenablerSession FOREIGN KEY ("coEnablerSessionId") REFERENCES co_enabler_sessions(id) ON DELETE SET NULL;
ALTER TABLE call_logs DROP CONSTRAINT IF EXISTS fk_calllogs_person;
ALTER TABLE call_logs ADD CONSTRAINT fk_calllogs_person FOREIGN KEY ("personId") REFERENCES people(id) ON DELETE CASCADE;
ALTER TABLE call_logs DROP CONSTRAINT IF EXISTS fk_calllogs_session;
ALTER TABLE call_logs ADD CONSTRAINT fk_calllogs_session FOREIGN KEY ("sessionId") REFERENCES calling_sessions(id) ON DELETE SET NULL;
ALTER TABLE person_stage_history DROP CONSTRAINT IF EXISTS fk_stagehistory_person;
ALTER TABLE person_stage_history ADD CONSTRAINT fk_stagehistory_person FOREIGN KEY ("personId") REFERENCES people(id) ON DELETE CASCADE;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS fk_attendance_person;
ALTER TABLE attendance ADD CONSTRAINT fk_attendance_person FOREIGN KEY ("personId") REFERENCES people(id) ON DELETE CASCADE;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS fk_attendance_group;
ALTER TABLE attendance ADD CONSTRAINT fk_attendance_group FOREIGN KEY ("groupId") REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS fk_attendance_event;
ALTER TABLE attendance ADD CONSTRAINT fk_attendance_event FOREIGN KEY ("eventId") REFERENCES group_events(id) ON DELETE SET NULL;
ALTER TABLE group_members DROP CONSTRAINT IF EXISTS fk_groupmembers_group;
ALTER TABLE group_members ADD CONSTRAINT fk_groupmembers_group FOREIGN KEY ("groupId") REFERENCES groups(id) ON DELETE CASCADE;
-- group_members may use personId or contactId depending on schema version
ALTER TABLE group_members DROP CONSTRAINT IF EXISTS fk_groupmembers_contact;
ALTER TABLE group_members ADD CONSTRAINT fk_groupmembers_contact FOREIGN KEY ("contactId") REFERENCES people(id) ON DELETE CASCADE;
ALTER TABLE group_shared_users DROP CONSTRAINT IF EXISTS fk_groupshared_group;
ALTER TABLE group_shared_users ADD CONSTRAINT fk_groupshared_group FOREIGN KEY ("groupId") REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE group_shared_users DROP CONSTRAINT IF EXISTS fk_groupshared_user;
ALTER TABLE group_shared_users ADD CONSTRAINT fk_groupshared_user FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE group_report_recipients DROP CONSTRAINT IF EXISTS fk_groupreport_group;
ALTER TABLE group_report_recipients ADD CONSTRAINT fk_groupreport_group FOREIGN KEY ("groupId") REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE group_events DROP CONSTRAINT IF EXISTS fk_groupevents_group;
ALTER TABLE group_events ADD CONSTRAINT fk_groupevents_group FOREIGN KEY ("groupId") REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE person_contact_sources DROP CONSTRAINT IF EXISTS fk_pcs_person;
ALTER TABLE person_contact_sources ADD CONSTRAINT fk_pcs_person FOREIGN KEY ("personId") REFERENCES people(id) ON DELETE CASCADE;
ALTER TABLE person_contact_sources DROP CONSTRAINT IF EXISTS fk_pcs_source;
ALTER TABLE person_contact_sources ADD CONSTRAINT fk_pcs_source FOREIGN KEY ("contactSourceId") REFERENCES contact_sources(id) ON DELETE CASCADE;
ALTER TABLE calling_session_people DROP CONSTRAINT IF EXISTS fk_csp_session;
ALTER TABLE calling_session_people ADD CONSTRAINT fk_csp_session FOREIGN KEY ("sessionId") REFERENCES calling_sessions(id) ON DELETE CASCADE;
ALTER TABLE calling_session_people DROP CONSTRAINT IF EXISTS fk_csp_person;
ALTER TABLE calling_session_people ADD CONSTRAINT fk_csp_person FOREIGN KEY ("personId") REFERENCES people(id) ON DELETE CASCADE;
ALTER TABLE calling_session_enablers DROP CONSTRAINT IF EXISTS fk_cse_session;
ALTER TABLE calling_session_enablers ADD CONSTRAINT fk_cse_session FOREIGN KEY ("sessionId") REFERENCES calling_sessions(id) ON DELETE CASCADE;
ALTER TABLE calling_session_enablers DROP CONSTRAINT IF EXISTS fk_cse_user;
ALTER TABLE calling_session_enablers ADD CONSTRAINT fk_cse_user FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE co_enabler_session_people DROP CONSTRAINT IF EXISTS fk_cesp_session;
ALTER TABLE co_enabler_session_people ADD CONSTRAINT fk_cesp_session FOREIGN KEY ("sessionId") REFERENCES co_enabler_sessions(id) ON DELETE CASCADE;
ALTER TABLE co_enabler_session_people DROP CONSTRAINT IF EXISTS fk_cesp_person;
ALTER TABLE co_enabler_session_people ADD CONSTRAINT fk_cesp_person FOREIGN KEY ("personId") REFERENCES people(id) ON DELETE CASCADE;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS fk_notif_user;
ALTER TABLE notifications ADD CONSTRAINT fk_notif_user FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE push_tokens DROP CONSTRAINT IF EXISTS fk_pushtokens_user;
ALTER TABLE push_tokens ADD CONSTRAINT fk_pushtokens_user FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;

-- FIX 5: Add ALL missing indexes
CREATE INDEX IF NOT EXISTS idx_people_enablerid ON people("enablerId");
CREATE INDEX IF NOT EXISTS idx_people_folkguideid ON people("folkGuideId");
CREATE INDEX IF NOT EXISTS idx_people_lastcallat ON people("lastCallAt");
CREATE INDEX IF NOT EXISTS idx_people_stage ON people("currentFolkStage");
CREATE INDEX IF NOT EXISTS idx_people_isdeleted ON people("isDeleted");
CREATE INDEX IF NOT EXISTS idx_people_createdat ON people("createdAt");
CREATE INDEX IF NOT EXISTS idx_people_name_lower ON people(LOWER("fullName"));
CREATE INDEX IF NOT EXISTS idx_people_nextfollowup ON people("nextFollowUpAt");
CREATE INDEX IF NOT EXISTS idx_calllogs_personid ON call_logs("personId");
CREATE INDEX IF NOT EXISTS idx_calllogs_calledat ON call_logs("calledAt");
CREATE INDEX IF NOT EXISTS idx_calllogs_calledbyid ON call_logs("calledById");
CREATE INDEX IF NOT EXISTS idx_calllogs_status ON call_logs(status);
CREATE INDEX IF NOT EXISTS idx_calllogs_sessionid ON call_logs("sessionId");
CREATE INDEX IF NOT EXISTS idx_stagehistory_personid ON person_stage_history("personId");
CREATE INDEX IF NOT EXISTS idx_stagehistory_changedat ON person_stage_history("changedAt");
CREATE INDEX IF NOT EXISTS idx_attendance_personid ON attendance("personId");
CREATE INDEX IF NOT EXISTS idx_attendance_eventid ON attendance("eventId");
CREATE INDEX IF NOT EXISTS idx_attendance_groupid ON attendance("groupId");
CREATE INDEX IF NOT EXISTS idx_groupmembers_contactid ON group_members("contactId");
CREATE INDEX IF NOT EXISTS idx_groupevents_groupid ON group_events("groupId");
CREATE INDEX IF NOT EXISTS idx_notifications_userid ON notifications("userId");
CREATE INDEX IF NOT EXISTS idx_notifications_isread ON notifications("isRead");
CREATE INDEX IF NOT EXISTS idx_callingsp_sessionid ON calling_session_people("sessionId");
CREATE INDEX IF NOT EXISTS idx_callingsp_personid ON calling_session_people("personId");

-- FIX 6: Drop orphaned denormalized columns from people
ALTER TABLE people DROP COLUMN IF EXISTS "callHistory";
ALTER TABLE people DROP COLUMN IF EXISTS "attendanceHistory";
ALTER TABLE people DROP COLUMN IF EXISTS progress;
ALTER TABLE people DROP COLUMN IF EXISTS "contactSource";
ALTER TABLE people DROP COLUMN IF EXISTS "fullNameLowercase";
ALTER TABLE people DROP COLUMN IF EXISTS "coEnablerId";
ALTER TABLE people DROP COLUMN IF EXISTS "coEnablerName";
ALTER TABLE people DROP COLUMN IF EXISTS "coEnablerExpiry";
ALTER TABLE people DROP COLUMN IF EXISTS "activeCoEnablerSessionId";
ALTER TABLE people DROP COLUMN IF EXISTS "lastSg";
ALTER TABLE people DROP COLUMN IF EXISTS "lastMa";
ALTER TABLE people DROP COLUMN IF EXISTS "lastFrp";

-- FIX 7: Replace groups.memberCount with a DB trigger
CREATE OR REPLACE FUNCTION update_group_member_count()
RETURNS TRIGGER AS $func$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE groups SET "memberCount" = "memberCount" + 1 WHERE id = NEW."groupId";
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE groups SET "memberCount" = "memberCount" - 1 WHERE id = OLD."groupId";
  END IF;
  RETURN NULL;
END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_group_member_count ON group_members;
CREATE TRIGGER trg_group_member_count
AFTER INSERT OR DELETE ON group_members
FOR EACH ROW EXECUTE FUNCTION update_group_member_count();

UPDATE groups g SET "memberCount" = (SELECT COUNT(*) FROM group_members gm WHERE gm."groupId" = g.id);

-- FIX 8: Create people_activity_summary view
CREATE OR REPLACE VIEW people_activity_summary AS
SELECT
  p.id,
  p."fullName",
  p."currentFolkStage",
  p."enablerId",
  p."lastCallAt",
  p."nextFollowUpAt",
  COUNT(cl.id)::bigint as "totalCalls",
  MAX(cl."calledAt") as "lastCallDate",
  COALESCE(AVG(cl."sgRating"), 0)::double precision as "avgSgRating",
  COALESCE(AVG(cl."maRating"), 0)::double precision as "avgMaRating",
  COUNT(a.id)::bigint as "totalAttendances",
  CASE
    WHEN MAX(cl."calledAt") > NOW() - INTERVAL '30 days' THEN 'active'
    WHEN MAX(cl."calledAt") > NOW() - INTERVAL '60 days' THEN 'at_risk'
    WHEN MAX(cl."calledAt") > NOW() - INTERVAL '90 days' THEN 'danger'
    WHEN MAX(cl."calledAt") IS NOT NULL THEN 'emergency'
    ELSE 'never_called'
  END as "activityStatus"
FROM people p
LEFT JOIN call_logs cl ON cl."personId" = p.id
LEFT JOIN attendance a ON a."personId" = p.id
WHERE p."isDeleted" = false
GROUP BY p.id, p."fullName", p."currentFolkStage", p."enablerId", p."lastCallAt", p."nextFollowUpAt";

COMMIT;
