import pg from 'pg';
const { Client } = pg;
const url = 'postgresql://postgres.utguapdntsluhopxvqmp:zNB22uwKXCEkE%2FA@aws-1-ap-south-1.pooler.supabase.com:5432/postgres';
const client = new Client({ connectionString: url });
client.connect().then(async () => {
  const sqls = [
    `ALTER TABLE people ADD COLUMN IF NOT EXISTS "fullNameLowercase" TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE people ADD COLUMN IF NOT EXISTS "contactSource" TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE people ADD COLUMN IF NOT EXISTS "enablerInTouchWith" TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE people ADD COLUMN IF NOT EXISTS "folkGuide" TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE people ADD COLUMN IF NOT EXISTS "folkId" TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE people ADD COLUMN IF NOT EXISTS "progress" TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE people ADD COLUMN IF NOT EXISTS "callHistory" TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE people ADD COLUMN IF NOT EXISTS "attendanceHistory" TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE people ADD COLUMN IF NOT EXISTS "lastSg" TEXT DEFAULT ''`,
    `ALTER TABLE people ADD COLUMN IF NOT EXISTS "lastMa" TEXT DEFAULT ''`,
    `ALTER TABLE people ADD COLUMN IF NOT EXISTS "lastFrp" TEXT DEFAULT ''`,
    `ALTER TABLE people ADD COLUMN IF NOT EXISTS "reminderSetName" TEXT DEFAULT ''`,
    `ALTER TABLE people ADD COLUMN IF NOT EXISTS "activeCoEnablerSessionId" TEXT DEFAULT ''`,
    `ALTER TABLE people ADD COLUMN IF NOT EXISTS "coEnablerId" TEXT DEFAULT ''`,
    `ALTER TABLE people ADD COLUMN IF NOT EXISTS "coEnablerName" TEXT DEFAULT ''`,
    `ALTER TABLE people ADD COLUMN IF NOT EXISTS "coEnablerExpiry" TEXT DEFAULT ''`,
    `ALTER TABLE people ADD COLUMN IF NOT EXISTS "customData" TEXT NOT NULL DEFAULT '{}'`,
    `ALTER TABLE groups ADD COLUMN IF NOT EXISTS "createdByName" TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE groups ADD COLUMN IF NOT EXISTS "creatorRole" TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE groups ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE groups ADD COLUMN IF NOT EXISTS "memberCount" INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE groups ADD COLUMN IF NOT EXISTS "task" TEXT DEFAULT ''`,
    `ALTER TABLE groups ADD COLUMN IF NOT EXISTS "assignedBy" TEXT DEFAULT ''`,
    `ALTER TABLE groups ADD COLUMN IF NOT EXISTS "assignedByName" TEXT DEFAULT ''`,
    `ALTER TABLE groups ADD COLUMN IF NOT EXISTS "assignedToName" TEXT DEFAULT ''`,
    `ALTER TABLE groups ADD COLUMN IF NOT EXISTS "reportingEnabled" BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE groups ADD COLUMN IF NOT EXISTS "reportTime" TEXT DEFAULT ''`,
    `ALTER TABLE groups ADD COLUMN IF NOT EXISTS "reportRecipients" TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS "pausedCallingSession" TEXT DEFAULT ''`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS "reportsTo" TEXT DEFAULT ''`,
  ];
  for (const sql of sqls) {
    try {
      await client.query(sql);
      console.log(`OK: ${sql.substring(0, 80)}...`);
    } catch (e) {
      console.log(`ERR: ${e.message}`);
    }
  }
  await client.end();
  console.log('Done');
}).catch(e => { console.error(e.message); client.end(); });
