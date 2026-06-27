import pkg from 'firebase-admin';
const { initializeApp: firebaseInit, cert: fbCert } = pkg;
import { Timestamp, getFirestore } from 'firebase-admin/firestore';
import { PrismaClient } from '@prisma/client';

// --- Config ---
const DIRECT_URL = process.env.DIRECT_URL;
if (!DIRECT_URL) {
  console.error('DIRECT_URL environment variable is required');
  process.exit(1);
}

// Firebase Admin credentials from env
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
const FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY;
if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
  console.error('Firebase Admin credentials required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
  process.exit(1);
}

// --- Init Firebase Admin ---
const app = firebaseInit({
  credential: fbCert({
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const firestore = getFirestore(app);
firestore.settings({ preferRest: true });

// --- Init Prisma ---
const prisma = new PrismaClient({
  datasources: { db: { url: DIRECT_URL } },
});

// --- Helpers ---
function toDate(val) {
  if (!val) return undefined;
  if (val instanceof Timestamp) return val.toDate();
  if (typeof val === 'string') return new Date(val);
  if (val instanceof Date) return val;
  return undefined;
}

function toJsonArray(val) {
  if (!val) return '[]';
  if (typeof val === 'string') return val;
  return JSON.stringify(val);
}

function toJson(val) {
  if (!val) return '{}';
  if (typeof val === 'string') return val;
  return JSON.stringify(val);
}

function safeString(val, fallback = '') {
  if (val === undefined || val === null) return fallback;
  return String(val);
}

function safeNumber(val, fallback = 0) {
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

function safeBool(val) {
  return val === true || val === 'true' || val === 1 || val === '1';
}

// Valid reference ID check — returns the ID only if it exists in the valid set
function validRef(id, validIds) {
  if (!id) return null;
  return validIds.has(String(id)) ? String(id) : null;
}

// Fetch all docs from a collection with pagination
async function getAllDocs(collectionName) {
  const docs = [];
  let lastDoc = null;
  const batchSize = 500;
  let hasMore = true;

  while (hasMore) {
    let query = firestore.collection(collectionName).orderBy('__name__').limit(batchSize);
    if (lastDoc) query = query.startAfter(lastDoc);
    const snapshot = await query.get();
    if (snapshot.empty) break;

    snapshot.forEach(doc => {
      const data = doc.data();
      // Convert Timestamps to ISO strings
      for (const key of Object.keys(data)) {
        if (data[key] instanceof Timestamp) {
          data[key] = data[key].toDate().toISOString();
        }
      }
      docs.push({ id: doc.id, ...data });
    });

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    hasMore = snapshot.docs.length === batchSize;
  }

  return docs;
}

// Upsert helper with progress
async function upsertBatch(collection, records, upsertFn, concurrency = 10) {
  let success = 0;
  let errors = 0;
  let lastLog = Date.now();

  // Process in chunks for concurrency control
  for (let i = 0; i < records.length; i += concurrency) {
    const chunk = records.slice(i, i + concurrency);
    const results = await Promise.allSettled(chunk.map(r => upsertFn(r)));
    for (const r of results) {
      if (r.status === 'fulfilled') success++;
      else errors++;
    }

    if (Date.now() - lastLog > 5000) {
      console.log(`  Progress: ${success} migrated, ${errors} errors (${Math.min(i + concurrency, records.length)}/${records.length})`);
      lastLog = Date.now();
    }
  }

  console.log(`  Total: ${success} migrated, ${errors} errors`);
  return { success, errors };
}

async function migrate() {
  console.log('=== Starting Full Firestore to PostgreSQL Migration ===\n');

  // Step 0: Collect all valid user IDs first for FK validation
  console.log('Pre-collecting valid user IDs...');
  const validUserIds = new Set();
  let userDocs = [];
  try {
    userDocs = await getAllDocs('users');
    for (const doc of userDocs) validUserIds.add(doc.id);
    console.log(`  Found ${validUserIds.size} valid users in Firestore`);
  } catch (err) {
    console.error('  Error collecting users:', err.message);
  }

  // Add 'system' as a fallback user ID for non-nullable FKs
  validUserIds.add('system');

  // Create 'system' user if it doesn't exist
  try {
    await prisma.user.upsert({
      where: { id: 'system' },
      update: {},
      create: {
        id: 'system',
        name: 'System',
        email: 'system@folk-crm.local',
        password: '',
        role: '[]',
      },
    });
  } catch (err) {
    console.log('  System user already exists (or error):', err.message);
  }

  // Also ensure all Firestore user IDs exist in DB (migrate users first)
  console.log('\n=== Migrating users ===');
  let usersMigrated = 0;
  let userErrors = 0;
  for (const doc of userDocs) {
    try {
      await prisma.user.upsert({
        where: { id: doc.id },
        update: {
          name: safeString(doc.name),
          email: safeString(doc.email),
          phone: safeString(doc.phone),
          role: toJsonArray(doc.role),
          photoUrl: doc.photoUrl || null,
          fgCode: doc.fgCode || null,
          reportsTo: toJson(doc.reportsTo),
          pausedCallingSession: toJson(doc.pausedCallingSession),
          whatsappTemplate: doc.whatsappTemplate || null,
        },
        create: {
          id: doc.id,
          name: safeString(doc.name),
          email: safeString(doc.email),
          phone: safeString(doc.phone),
          role: toJsonArray(doc.role),
          photoUrl: doc.photoUrl || null,
          fgCode: doc.fgCode || null,
          reportsTo: toJson(doc.reportsTo),
          pausedCallingSession: toJson(doc.pausedCallingSession),
          whatsappTemplate: doc.whatsappTemplate || null,
        },
      });
      usersMigrated++;
    } catch (err) {
      // Duplicate email errors are expected
      userErrors++;
      if (!err.message.includes('Unique constraint')) {
        console.error(`  Error migrating user ${doc.id}: ${err.message}`);
      }
    }
  }
  console.log(`  Users migrated: ${usersMigrated}, skipped: ${userErrors}`);

  // Re-collect valid user IDs now including DB-only users
  const dbUsers = await prisma.user.findMany({ select: { id: true } });
  for (const u of dbUsers) validUserIds.add(u.id);
  console.log(`  Total valid user IDs for FK validation: ${validUserIds.size}`);

  // 3. People
  console.log('\n=== Migrating people ===');
  const peopleDocs = await getAllDocs('people');
  console.log(`  Found ${peopleDocs.length} people in Firestore`);
  await upsertBatch('people', peopleDocs, async (doc) => {
    const pgStage = (doc.currentFolkStage || 'Fresh Lead').replace(/\s+/g, '');
    // Null out FK references that don't match valid users
    const enablerId = validRef(doc.enablerId, validUserIds);
    const folkGuideId = validRef(doc.folkGuideId, validUserIds);
    const coEnablerId = validRef(doc.coEnablerId, validUserIds);

    await prisma.person.upsert({
      where: { id: doc.id },
      update: {
        fullName: safeString(doc.fullName),
        fullNameLowercase: safeString(doc.fullName_lowercase || doc.fullName?.toLowerCase?.() || ''),
        phone: safeString(doc.phone),
        photoUrl: doc.photoUrl || null,
        age: safeNumber(doc.age),
        currentFolkStage: pgStage,
        location: doc.location || null,
        stayingWith: doc.stayingWith || null,
        occupation: doc.occupation || null,
        organisation: doc.organisation || null,
        rentDetails: safeNumber(doc.rentDetails),
        nativePlace: doc.nativePlace || null,
        sgRating: safeNumber(doc.sgRating),
        contactSource: toJsonArray(doc.contactSource),
        chantingStatus: safeNumber(doc.chantingStatus),
        fromOtherCamp: safeBool(doc.fromOtherCamp),
        enablerInTouchWith: safeString(doc.enablerInTouchWith),
        enablerId,
        folkGuide: safeString(doc.folkGuide),
        folkGuideId,
        folkId: safeString(doc.folkId),
        progress: toJsonArray(doc.progress),
        generalRemarks: doc.generalRemarks || null,
        callHistory: toJsonArray(doc.callHistory),
        attendanceHistory: toJsonArray(doc.attendanceHistory),
        relationshipStatus: safeString(doc.relationshipStatus, 'Single'),
        verifiedByFg: safeString(doc.verifiedByFg, 'No'),
        isDeleted: safeBool(doc.isDeleted),
        deletedAt: doc.deletedAt ? new Date(doc.deletedAt) : null,
        lastCallAt: doc.lastCallAt ? new Date(doc.lastCallAt) : null,
        lastCallStatus: doc.lastCallStatus || null,
        lastCallRemark: doc.lastCallRemark || null,
        lastSg: doc.lastSg || null,
        lastMa: doc.lastMa || null,
        lastFrp: doc.lastFrp || null,
        nextFollowUpAt: doc.nextFollowUpAt ? String(doc.nextFollowUpAt) : null,
        reminderSetName: doc.reminderSetName || null,
        activeCoEnablerSessionId: doc.activeCoEnablerSessionId || null,
        coEnablerId,
        coEnablerName: doc.coEnablerName || null,
        coEnablerExpiry: doc.coEnablerExpiry || null,
        customData: toJson(doc.customData),
      },
      create: {
        id: doc.id,
        fullName: safeString(doc.fullName),
        fullNameLowercase: safeString(doc.fullName_lowercase || doc.fullName?.toLowerCase?.() || ''),
        phone: safeString(doc.phone),
        photoUrl: doc.photoUrl || null,
        age: safeNumber(doc.age),
        currentFolkStage: pgStage,
        location: doc.location || null,
        stayingWith: doc.stayingWith || null,
        occupation: doc.occupation || null,
        organisation: doc.organisation || null,
        rentDetails: safeNumber(doc.rentDetails),
        nativePlace: doc.nativePlace || null,
        sgRating: safeNumber(doc.sgRating),
        contactSource: toJsonArray(doc.contactSource),
        chantingStatus: safeNumber(doc.chantingStatus),
        fromOtherCamp: safeBool(doc.fromOtherCamp),
        enablerInTouchWith: safeString(doc.enablerInTouchWith),
        enablerId,
        folkGuide: safeString(doc.folkGuide),
        folkGuideId,
        folkId: safeString(doc.folkId),
        progress: toJsonArray(doc.progress),
        generalRemarks: doc.generalRemarks || null,
        callHistory: toJsonArray(doc.callHistory),
        attendanceHistory: toJsonArray(doc.attendanceHistory),
        relationshipStatus: safeString(doc.relationshipStatus, 'Single'),
        verifiedByFg: safeString(doc.verifiedByFg, 'No'),
        isDeleted: safeBool(doc.isDeleted),
        deletedAt: doc.deletedAt ? new Date(doc.deletedAt) : null,
        lastCallAt: doc.lastCallAt ? new Date(doc.lastCallAt) : null,
        lastCallStatus: doc.lastCallStatus || null,
        lastCallRemark: doc.lastCallRemark || null,
        lastSg: doc.lastSg || null,
        lastMa: doc.lastMa || null,
        lastFrp: doc.lastFrp || null,
        nextFollowUpAt: doc.nextFollowUpAt ? String(doc.nextFollowUpAt) : null,
        reminderSetName: doc.reminderSetName || null,
        activeCoEnablerSessionId: doc.activeCoEnablerSessionId || null,
        coEnablerId,
        coEnablerName: doc.coEnablerName || null,
        coEnablerExpiry: doc.coEnablerExpiry || null,
        customData: toJson(doc.customData),
      },
    });
  });

  // 4. Groups
  console.log('\n=== Migrating groups ===');
  const groupDocs = await getAllDocs('groups');
  console.log(`  Found ${groupDocs.length} groups in Firestore`);
  await upsertBatch('groups', groupDocs, async (doc) => {
    const createdBy = validRef(doc.createdBy, validUserIds);
    await prisma.group.upsert({
      where: { id: doc.id },
      update: {
        name: safeString(doc.name),
        description: doc.description || null,
        photoUrl: doc.photoUrl || null,
        createdBy,
        createdByName: safeString(doc.createdByName),
        creatorRole: toJsonArray(doc.creatorRole),
        sharedWithUserIds: toJsonArray(doc.sharedWithUserIds),
        visibility: toJsonArray(doc.visibility),
        memberCount: safeNumber(doc.memberCount),
        isDynamic: safeBool(doc.isDynamic),
        color: doc.color || null,
        expiresAt: doc.expiresAt ? new Date(doc.expiresAt) : null,
        task: doc.task || null,
        assignedBy: doc.assignedBy || null,
        assignedByName: doc.assignedByName || null,
        assignedToName: doc.assignedToName || null,
        reportingEnabled: safeBool(doc.reportingEnabled),
        reportTime: doc.reportTime || null,
        reportRecipients: toJsonArray(doc.reportRecipients),
      },
      create: {
        id: doc.id,
        name: safeString(doc.name),
        description: doc.description || null,
        photoUrl: doc.photoUrl || null,
        createdBy,
        createdByName: safeString(doc.createdByName),
        creatorRole: toJsonArray(doc.creatorRole),
        sharedWithUserIds: toJsonArray(doc.sharedWithUserIds),
        visibility: toJsonArray(doc.visibility),
        memberCount: safeNumber(doc.memberCount),
        isDynamic: safeBool(doc.isDynamic),
        color: doc.color || null,
        expiresAt: doc.expiresAt ? new Date(doc.expiresAt) : null,
        task: doc.task || null,
        assignedBy: doc.assignedBy || null,
        assignedByName: doc.assignedByName || null,
        assignedToName: doc.assignedToName || null,
        reportingEnabled: safeBool(doc.reportingEnabled),
        reportTime: doc.reportTime || null,
        reportRecipients: toJsonArray(doc.reportRecipients),
      },
    });
  });

  // 5. Group Members
  console.log('\n=== Migrating group members ===');
  let gmAdded = 0;
  let gmErrors = 0;
  for (const groupDoc of groupDocs) {
    const groupId = groupDoc.id;

    // peopleIds array on group doc
    const peopleIds = groupDoc.peopleIds || [];
    for (const personId of peopleIds) {
      try {
        await prisma.groupMember.upsert({
          where: { groupId_personId: { groupId, personId } },
          update: {},
          create: { groupId, personId },
        });
        gmAdded++;
      } catch (err) {
        gmErrors++;
      }
    }

    // members subcollection
    const membersSnap = await firestore.collection('groups').doc(groupId).collection('members').get();
    for (const memberDoc of membersSnap.docs) {
      try {
        const personId = memberDoc.id;
        await prisma.groupMember.upsert({
          where: { groupId_personId: { groupId, personId } },
          update: {},
          create: { groupId, personId },
        });
        gmAdded++;
      } catch (err) {
        gmErrors++;
      }
    }
  }
  console.log(`  Group members: ${gmAdded} added, ${gmErrors} errors`);

  // 6. Group Events
  console.log('\n=== Migrating group events ===');
  let evMigrated = 0;
  let evErrors = 0;
  for (const groupDoc of groupDocs) {
    const groupId = groupDoc.id;
    const eventsSnap = await firestore.collection('groups').doc(groupId).collection('events').get();
    for (const eventDoc of eventsSnap.docs) {
      try {
        const ev = eventDoc.data();
        await prisma.groupEvent.upsert({
          where: { id: eventDoc.id },
          update: {
            groupId,
            name: safeString(ev.name),
            date: safeString(ev.date || ev.createdAt || ''),
            linkInfo: toJson(ev.linkInfo),
            attendeeCount: safeNumber(ev.attendeeCount),
          },
          create: {
            id: eventDoc.id,
            groupId,
            name: safeString(ev.name),
            date: safeString(ev.date || ev.createdAt || ''),
            linkInfo: toJson(ev.linkInfo),
            attendeeCount: safeNumber(ev.attendeeCount),
          },
        });
        evMigrated++;
      } catch (err) {
        evErrors++;
      }
    }
  }
  console.log(`  Events: ${evMigrated} migrated, ${evErrors} errors`);

  // 7. Attendance (from subcollection)
  console.log('\n=== Migrating attendance ===');
  let attMigrated = 0;
  let attErrors = 0;
  for (const groupDoc of groupDocs) {
    const groupId = groupDoc.id;
    const attendanceSnap = await firestore.collection('groups').doc(groupId).collection('attendance').get();
    for (const attDoc of attendanceSnap.docs) {
      try {
        const att = attDoc.data();
        await prisma.attendance.upsert({
          where: { id: attDoc.id },
          update: {
            personId: safeString(att.personId || attDoc.id),
            groupId,
            eventId: att.eventId || null,
            date: safeString(att.date || att.timestamp || ''),
          },
          create: {
            id: attDoc.id,
            personId: safeString(att.personId || attDoc.id),
            groupId,
            eventId: att.eventId || null,
            date: safeString(att.date || att.timestamp || ''),
          },
        });
        attMigrated++;
      } catch (err) {
        attErrors++;
      }
    }
  }

  // Also check top-level attendance collection
  const topLevelAttDocs = await getAllDocs('attendance');
  for (const doc of topLevelAttDocs) {
    try {
      await prisma.attendance.upsert({
        where: { id: doc.id },
        update: {
          personId: safeString(doc.personId),
          groupId: safeString(doc.groupId),
          eventId: doc.eventId || null,
          date: safeString(doc.date || doc.markedAt || ''),
        },
        create: {
          id: doc.id,
          personId: safeString(doc.personId),
          groupId: safeString(doc.groupId),
          eventId: doc.eventId || null,
          date: safeString(doc.date || doc.markedAt || ''),
        },
      });
      attMigrated++;
    } catch (err) {
      attErrors++;
    }
  }
  console.log(`  Attendance: ${attMigrated} migrated, ${attErrors} errors`);

  // 8. Calling Sessions
  console.log('\n=== Migrating calling sessions ===');
  const csDocs = await getAllDocs('calling-sessions');
  console.log(`  Found ${csDocs.length} calling sessions`);
  await upsertBatch('calling-sessions', csDocs, async (doc) => {
    const createdBy = validRef(doc.createdBy, validUserIds) || 'system';
    const assignedById = validRef(doc.assignedById, validUserIds);
    const folkGuideId = validRef(doc.folkGuideId, validUserIds);

    await prisma.callingSession.upsert({
      where: { id: doc.id },
      update: {
        name: safeString(doc.name),
        current_index: safeNumber(doc.current_index),
        status: safeString(doc.status, 'active'),
        createdBy,
        creatorName: safeString(doc.creatorName),
        assignedById,
        assignedByName: safeString(doc.assignedByName),
        folkGuideId,
        lastActivity: doc.lastActivity ? new Date(doc.lastActivity) : new Date(),
        coEnablerIds: toJsonArray(doc.coEnablerIds),
      },
      create: {
        id: doc.id,
        name: safeString(doc.name),
        current_index: safeNumber(doc.current_index),
        status: safeString(doc.status, 'active'),
        createdBy,
        creatorName: safeString(doc.creatorName),
        assignedById,
        assignedByName: safeString(doc.assignedByName),
        folkGuideId,
        lastActivity: doc.lastActivity ? new Date(doc.lastActivity) : new Date(),
        coEnablerIds: toJsonArray(doc.coEnablerIds),
      },
    });

    // Migrate session people (peopleIds array)
    const peopleIds = doc.peopleIds || [];
    for (const personId of peopleIds) {
      try {
        await prisma.callingSessionPerson.upsert({
          where: { sessionId_personId: { sessionId: doc.id, personId } },
          update: {},
          create: { sessionId: doc.id, personId },
        });
      } catch (err) {
        // ignore FK errors for people that don't exist
      }
    }
  });

  // 9. Co-Enabler Sessions
  console.log('\n=== Migrating co-enabler sessions ===');
  const ceDocs = await getAllDocs('co_enabler_sessions');
  console.log(`  Found ${ceDocs.length} co-enabler sessions`);
  await upsertBatch('co_enabler_sessions', ceDocs, async (doc) => {
    const creatorId = validRef(doc.creatorId, validUserIds);
    await prisma.coEnablerSession.upsert({
      where: { id: doc.id },
      update: {
        name: safeString(doc.name),
        task: safeString(doc.task),
        type: safeString(doc.type, 'external'),
        expiresAt: doc.expiresAt ? new Date(doc.expiresAt) : new Date(),
        creatorId,
        creatorName: safeString(doc.creatorName),
        peopleIds: toJsonArray(doc.peopleIds),
      },
      create: {
        id: doc.id,
        name: safeString(doc.name),
        task: safeString(doc.task),
        type: safeString(doc.type, 'external'),
        expiresAt: doc.expiresAt ? new Date(doc.expiresAt) : new Date(),
        creatorId,
        creatorName: safeString(doc.creatorName),
        peopleIds: toJsonArray(doc.peopleIds),
      },
    });
  });

  // 10. Audits
  console.log('\n=== Migrating audits ===');
  const auditDocs = await getAllDocs('audits');
  console.log(`  Found ${auditDocs.length} audits`);
  await upsertBatch('audits', auditDocs, async (doc) => {
    const userId = validRef(doc.userId, validUserIds) || 'system';
    await prisma.audit.upsert({
      where: { id: doc.id },
      update: {
        userId,
        userName: safeString(doc.userName, 'System'),
        action: safeString(doc.action),
        details: safeString(doc.details),
      },
      create: {
        id: doc.id,
        userId,
        userName: safeString(doc.userName, 'System'),
        action: safeString(doc.action),
        details: safeString(doc.details),
      },
    });
  });

  // 11. Notifications
  console.log('\n=== Migrating notifications ===');
  const notifDocs = await getAllDocs('notifications');
  console.log(`  Found ${notifDocs.length} notifications`);
  await upsertBatch('notifications', notifDocs, async (doc) => {
    const userId = validRef(doc.userId, validUserIds) || 'system';
    await prisma.notification.upsert({
      where: { id: doc.id },
      update: {
        userId,
        title: safeString(doc.title),
        message: safeString(doc.message),
        isRead: safeBool(doc.isRead),
        type: safeString(doc.type, 'info'),
        senderId: doc.senderId || null,
        senderName: doc.senderName || null,
        personId: doc.personId || null,
      },
      create: {
        id: doc.id,
        userId,
        title: safeString(doc.title),
        message: safeString(doc.message),
        isRead: safeBool(doc.isRead),
        type: safeString(doc.type, 'info'),
        senderId: doc.senderId || null,
        senderName: doc.senderName || null,
        personId: doc.personId || null,
      },
    });
  });

  // Settings (standalone document)
  console.log('\n=== Migrating settings ===');
  const settingsDoc = await firestore.collection('settings').doc('options').get();
  if (settingsDoc.exists) {
    const data = settingsDoc.data();
    await prisma.setting.upsert({
      where: { id: 'options' },
      update: {
        contactSources: toJsonArray(data.contactSources),
        folkStages: toJsonArray(data.folkStages),
        occupationStatuses: toJsonArray(data.occupationStatuses),
        stayingWithOptions: toJsonArray(data.stayingWithOptions),
        customPersonFields: toJsonArray(data.customPersonFields),
        sgOptions: toJsonArray(data.sgOptions),
        maOptions: toJsonArray(data.maOptions),
        frpOptions: toJsonArray(data.frpOptions),
        activityFieldLabels: toJson(data.activityFieldLabels),
      },
      create: {
        id: 'options',
        contactSources: toJsonArray(data.contactSources),
        folkStages: toJsonArray(data.folkStages),
        occupationStatuses: toJsonArray(data.occupationStatuses),
        stayingWithOptions: toJsonArray(data.stayingWithOptions),
        customPersonFields: toJsonArray(data.customPersonFields),
        sgOptions: toJsonArray(data.sgOptions),
        maOptions: toJsonArray(data.maOptions),
        frpOptions: toJsonArray(data.frpOptions),
        activityFieldLabels: toJson(data.activityFieldLabels),
      },
    });
    console.log('  Settings migrated');
  } else {
    console.log('  No settings document found');
  }

  // --- Summary ---
  console.log('\n=== Migration Complete ===');
  console.log('Settings: migrated');
  console.log('Users:', usersMigrated);
  console.log('People:', peopleDocs.length);
  console.log('Groups:', groupDocs.length);
  console.log('Group Members:', gmAdded);
  console.log('Events:', evMigrated);
  console.log('Attendance:', attMigrated);
  console.log('Calling Sessions:', csDocs.length);
  console.log('Co-Enabler Sessions:', ceDocs.length);
  console.log('Audits:', auditDocs.length);
  console.log('Notifications:', notifDocs.length);

  await prisma.$disconnect();
  await app.delete();
}

migrate().catch(err => {
  console.error('\nMigration failed:', err);
  process.exit(1);
});
