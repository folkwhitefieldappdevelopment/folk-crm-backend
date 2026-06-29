-- ============================================================
-- PRE-FLIGHT CHECK — Run BEFORE the fix_migration
-- Reports issues that would prevent a clean migration.
-- Run via: railway run "psql $DATABASE_URL -f preflight_check.sql"
-- ============================================================

-- 1. Count rows in old JSON denormalized columns that may not have been migrated
SELECT 'Old JSON data still present — check these counts:' as check_name;
SELECT 'callHistory' as column_name, COUNT(*) as row_count FROM people WHERE "callHistory" IS NOT NULL AND "callHistory" != '[]'
UNION ALL
SELECT 'attendanceHistory', COUNT(*) FROM people WHERE "attendanceHistory" IS NOT NULL AND "attendanceHistory" != '[]'
UNION ALL
SELECT 'progress', COUNT(*) FROM people WHERE progress IS NOT NULL AND progress != '[]'
UNION ALL
SELECT 'contactSource', COUNT(*) FROM people WHERE "contactSource" IS NOT NULL AND "contactSource" != '[]'
UNION ALL
SELECT 'coEnablerId', COUNT(*) FROM people WHERE "coEnablerId" IS NOT NULL
UNION ALL
SELECT 'coEnablerName', COUNT(*) FROM people WHERE "coEnablerName" IS NOT NULL;

-- 2. List a few rows where columns still have old JSON data (if any)
SELECT 'Sample rows with non-empty callHistory:' as msg;
SELECT id, "fullName", substring("callHistory" for 100) as callHistory_sample
FROM people
WHERE "callHistory" IS NOT NULL AND "callHistory" != '[]'
LIMIT 5;

-- 3. Check for FK violations that would break constraint additions

-- 3a. call_logs.personId referencing non-existent people
SELECT 'call_logs with missing person FK:' as check_name;
SELECT cl.id, cl."personId"
FROM call_logs cl
LEFT JOIN people p ON p.id = cl."personId"
WHERE p.id IS NULL;

-- 3b. attendance.personId referencing non-existent people
SELECT 'attendance with missing person FK:' as check_name;
SELECT a.id, a."personId"
FROM attendance a
LEFT JOIN people p ON p.id = a."personId"
WHERE p.id IS NULL;

-- 3c. attendance.groupId referencing non-existent groups
SELECT 'attendance with missing group FK:' as check_name;
SELECT a.id, a."groupId"
FROM attendance a
LEFT JOIN groups g ON g.id = a."groupId"
WHERE g.id IS NULL;

-- 3d. group_members.personId referencing non-existent people
SELECT 'group_members with missing person FK:' as check_name;
SELECT gm."groupId", gm."personId"
FROM group_members gm
LEFT JOIN people p ON p.id = gm."personId"
WHERE p.id IS NULL;

-- 3e. group_events.groupId referencing non-existent groups
SELECT 'group_events with missing group FK:' as check_name;
SELECT ge.id, ge."groupId"
FROM group_events ge
LEFT JOIN groups g ON g.id = ge."groupId"
WHERE g.id IS NULL;

-- 3f. person_stage_history.personId referencing non-existent people
SELECT 'person_stage_history with missing person FK:' as check_name;
SELECT psh.id, psh."personId"
FROM person_stage_history psh
LEFT JOIN people p ON p.id = psh."personId"
WHERE p.id IS NULL;

-- 3g. calling_session_people.personId referencing non-existent people
SELECT 'calling_session_people with missing person FK:' as check_name;
SELECT csp."sessionId", csp."personId"
FROM calling_session_people csp
LEFT JOIN people p ON p.id = csp."personId"
WHERE p.id IS NULL;

-- 3h. calling_session_people.sessionId referencing non-existent sessions
SELECT 'calling_session_people with missing session FK:' as check_name;
SELECT csp."sessionId", csp."personId"
FROM calling_session_people csp
LEFT JOIN calling_sessions cs ON cs.id = csp."sessionId"
WHERE cs.id IS NULL;

-- 4. Check NULL calledBy values in call_logs — won't backfill
SELECT 'call_logs entries where calledBy is NULL (no backfill possible):' as check_name;
SELECT COUNT(*) as count
FROM call_logs
WHERE "calledBy" IS NULL;

-- 5. Check invalid date formats in people.nextFollowUpAt
SELECT 'people with invalid nextFollowUpAt dates (will be nullified):' as check_name;
SELECT id, "fullName", "nextFollowUpAt"
FROM people
WHERE "nextFollowUpAt" IS NOT NULL
  AND "nextFollowUpAt" !~ '^\d{4}-\d{2}-\d{2}';

-- 6. Check sequences for the group_member_count trigger
SELECT 'Current group member counts:' as check_name;
SELECT g.id, g.name, g."memberCount" as current_count,
  (SELECT COUNT(*) FROM group_members gm WHERE gm."groupId" = g.id) as actual_count,
  CASE
    WHEN g."memberCount" = (SELECT COUNT(*) FROM group_members gm WHERE gm."groupId" = g.id)
    THEN 'OK'
    ELSE 'MISMATCH — will be recalibrated'
  END as status
FROM groups g
ORDER BY g.name;
