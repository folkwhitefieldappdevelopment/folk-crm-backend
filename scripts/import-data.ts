/**
 * Import Data Script for FOLK Spiritual Gems CRM
 * 
 * Reads contacts from an Excel file and imports them into PostgreSQL.
 * 
 * Usage:
 *   npx ts-node scripts/import-data.ts --file path/to/contacts.xlsx
 *   npm run import-data
 * 
 * Expected Excel columns:
 *   Full Name, Phone, Age, Current Folk Stage, Location, Native Place,
 *   Staying With, Occupation, Organisation, Chanting Rounds, SG Rating,
 *   Contact Source, Relationship Status, Verified by FG, Folk ID,
 *   Monthly Rent, Primary Enabler, General Remarks
 */

import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Column mapping (Excel header -> Prisma field)
const COLUMN_MAP: Record<string, string> = {
  'full name': 'fullName',
  'phone': 'phone',
  'age': 'age',
  'current folk stage': 'currentFolkStage',
  'location': 'location',
  'native place': 'nativePlace',
  'staying with': 'stayingWith',
  'occupation': 'occupation',
  'organisation': 'organisation',
  'chanting rounds': 'chantingStatus',
  'sg rating': 'sgRating',
  'contact source': 'contactSource',
  'relationship status': 'relationshipStatus',
  'verified by fg': 'verifiedByFg',
  'folk id': 'folkId',
  'monthly rent': 'rentDetails',
  'primary enabler': 'enablerInTouchWith',
  'general remarks': 'generalRemarks',
};

// Folk Stage mapping (Excel value -> Prisma string)
const FOLK_STAGE_MAP: Record<string, string> = {
  'diamond-club 16': 'DiamondClub16',
  'diamond club 16': 'DiamondClub16',
  'frj': 'FRJ',
  'frp': 'FRP',
  'sg-w': 'SGW',
  'sgw': 'SGW',
  'sg-s': 'SGS',
  'sgs': 'SGS',
  '21 days challenge': 'DaysChallenge21',
  '21dayschallenge': 'DaysChallenge21',
  'interested (visited residency or temple)': 'InterestedVisitedResidencyOrTemple',
  'interested': 'InterestedVisitedResidencyOrTemple',
  'fresh lead': 'FreshLead',
  'freshlead': 'FreshLead',
  'club 16 - inactive': 'Club16Inactive',
  'club 16 inactive': 'Club16Inactive',
};

// Relationship Status mapping
const RELATIONSHIP_MAP: Record<string, string> = {
  'single': 'Single',
  'married': 'Married',
};

// Verified Status mapping
const VERIFIED_MAP: Record<string, string> = {
  'yes': 'Yes',
  'no': 'No',
};

/**
 * Normalize phone number to last 10 digits
 */
function normalizePhone(phone: string): string {
  return String(phone).replace(/\D/g, '').slice(-10);
}

/**
 * Map Excel value to FolkStage enum
 */
function mapFolkStage(value: string): string {
  const normalized = value?.toLowerCase().trim() || '';
  return FOLK_STAGE_MAP[normalized] || 'FreshLead';
}

/**
 * Map Excel value to RelationshipStatus enum
 */
function mapRelationship(value: string): string {
  const normalized = value?.toLowerCase().trim() || '';
  return RELATIONSHIP_MAP[normalized] || 'Single';
}

/**
 * Map Excel value to VerifiedStatus enum
 */
function mapVerified(value: string): string {
  const normalized = value?.toLowerCase().trim() || '';
  return VERIFIED_MAP[normalized] || 'No';
}

/**
 * Parse contact source (comma-separated or array)
 */
function parseContactSource(value: any): string[] {
  if (Array.isArray(value)) {
    return value.filter(v => v && String(v).trim());
  }
  if (typeof value === 'string') {
    return value.split(',').map(s => s.trim()).filter(s => s);
  }
  return [];
}

/**
 * Create initial progress data
 */
function createInitialProgress(): any[] {
  return [
    {
      name: 'Association',
      items: [
        { question: 'FR Staying (Or) FR Visiting', levels: ['Yes', 'Yes', 'Yes'], answers: { l1: '', l2: '', l3: '', l1_remark: '', l2_remark: '', l3_remark: '' } },
        { question: 'Special Association of Senior devotees', levels: ['1', '1', '1'], answers: { l1: '', l2: '', l3: '', l1_remark: '', l2_remark: '', l3_remark: '' } },
        { question: 'One-on-One Association (>20 min)', levels: ['6', '8', '12'], answers: { l1: '', l2: '', l3: '', l1_remark: '', l2_remark: '', l3_remark: '' } },
        { question: 'Weekly programs attended (No.s)', levels: ['4', '4', '4'], answers: { l1: '', l2: '', l3: '', l1_remark: '', l2_remark: '', l3_remark: '' } },
      ],
    },
    {
      name: 'Book Reading',
      items: [
        { question: 'Reading (mins per day)', levels: ['30 mins', '45 mins', '60 mins'], answers: { l1: '', l2: '', l3: '', l1_remark: '', l2_remark: '', l3_remark: '' } },
        { question: 'Bhagavad Gita', levels: ['Yes', 'Yes', 'Yes'], answers: { l1: '', l2: '', l3: '', l1_remark: '', l2_remark: '', l3_remark: '' } },
        { question: 'SSR', levels: ['Yes', 'Yes', 'Yes'], answers: { l1: '', l2: '', l3: '', l1_remark: '', l2_remark: '', l3_remark: '' } },
      ],
    },
    {
      name: 'Chanting',
      items: [
        { question: 'Chanting (No of rounds)', levels: ['16', '16', '16'], answers: { l1: '', l2: '', l3: '', l1_remark: '', l2_remark: '', l3_remark: '' } },
      ],
    },
    {
      name: 'Devotional Service (or) Deity Darshan (or) Diet',
      items: [
        { question: '4 regulative principles', levels: ['Yes', 'Yes', 'Yes'], answers: { l1: '', l2: '', l3: '', l1_remark: '', l2_remark: '', l3_remark: '' } },
        { question: 'Avoid Non - veg', levels: ['Yes', 'Yes', 'Yes'], answers: { l1: '', l2: '', l3: '', l1_remark: '', l2_remark: '', l3_remark: '' } },
      ],
    },
    {
      name: 'Expedition',
      items: [
        { question: 'Long Trip', levels: ['1', '1', '1'], answers: { l1: '', l2: '', l3: '', l1_remark: '', l2_remark: '', l3_remark: '' } },
        { question: 'Short Trip', levels: ['1', '1', '1'], answers: { l1: '', l2: '', l3: '', l1_remark: '', l2_remark: '', l3_remark: '' } },
      ],
    },
  ];
}

/**
 * Main import function
 */
async function importData(filePath: string): Promise<void> {
  console.log(`\n📂 Reading file: ${filePath}\n`);

  if (!fs.existsSync(filePath)) {
    console.error('❌ File not found:', filePath);
    process.exit(1);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    console.error('❌ No worksheets found in file');
    process.exit(1);
  }

  console.log(`📊 Sheet: ${sheet.name}`);
  console.log(`📊 Rows: ${sheet.rowCount}`);
  console.log(`📊 Columns: ${sheet.columnCount}\n`);

  // Map column headers to indices
  const headerRow = sheet.getRow(1);
  const columnIndices: Record<string, number> = {};

  headerRow.eachCell((cell, colNumber) => {
    const header = String(cell.value || '').toLowerCase().trim();
    if (COLUMN_MAP[header]) {
      columnIndices[COLUMN_MAP[header]] = colNumber;
    }
  });

  console.log('📋 Mapped columns:', Object.keys(columnIndices).join(', '));
  console.log('');

  // Track statistics
  let totalRows = 0;
  let successCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;
  const processedPhones = new Set<string>();

  // Process each row (skip header)
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    totalRows++;

    try {
      // Extract values
      const fullName = String(row.getCell(columnIndices.fullName || 0).value || '').trim();
      const phoneRaw = row.getCell(columnIndices.phone || 0).value;
      const phone = normalizePhone(String(phoneRaw || ''));

      // Skip empty rows
      if (!fullName && !phone) {
        continue;
      }

      // Skip duplicates
      if (processedPhones.has(phone)) {
        duplicateCount++;
        continue;
      }
      processedPhones.add(phone);

      // Check database for existing phone
      const existing = await prisma.person.findFirst({
        where: { phone },
      });

      if (existing) {
        duplicateCount++;
        continue;
      }

      // Extract all fields
      const age = parseInt(String(row.getCell(columnIndices.age || 0).value || '0')) || 0;
      const currentFolkStage = mapFolkStage(String(row.getCell(columnIndices.currentFolkStage || 0).value || ''));
      const location = String(row.getCell(columnIndices.location || 0).value || '').trim();
      const nativePlace = String(row.getCell(columnIndices.nativePlace || 0).value || '').trim();
      const stayingWith = String(row.getCell(columnIndices.stayingWith || 0).value || '').trim();
      const occupation = String(row.getCell(columnIndices.occupation || 0).value || '').trim();
      const organisation = String(row.getCell(columnIndices.organisation || 0).value || '').trim();
      const chantingStatus = parseInt(String(row.getCell(columnIndices.chantingStatus || 0).value || '0')) || 0;
      const sgRating = parseFloat(String(row.getCell(columnIndices.sgRating || 0).value || '0')) || 0;
      const contactSource = parseContactSource(row.getCell(columnIndices.contactSource || 0).value);
      const relationshipStatus = mapRelationship(String(row.getCell(columnIndices.relationshipStatus || 0).value || ''));
      const verifiedByFg = mapVerified(String(row.getCell(columnIndices.verifiedByFg || 0).value || ''));
      const folkId = String(row.getCell(columnIndices.folkId || 0).value || '').trim();
      const rentDetails = parseFloat(String(row.getCell(columnIndices.rentDetails || 0).value || '0')) || 0;
      const enablerInTouchWith = String(row.getCell(columnIndices.enablerInTouchWith || 0).value || '').trim();
      const generalRemarks = String(row.getCell(columnIndices.generalRemarks || 0).value || '').trim();

      // Insert into database
      await prisma.person.create({
        data: {
          fullName: fullName || 'Unknown Contact',
          fullNameLowercase: (fullName || '').toLowerCase(),
          phone,
          age,
          currentFolkStage,
          location,
          nativePlace,
          stayingWith,
          occupation,
          organisation,
          rentDetails,
          contactSource: JSON.stringify(contactSource),
          chantingStatus,
          sgRating,
          relationshipStatus,
          verifiedByFg,
          folkId,
          enablerInTouchWith,
          generalRemarks,
          progress: JSON.stringify(createInitialProgress()),
          callHistory: JSON.stringify([]),
          attendanceHistory: JSON.stringify([]),
          customData: JSON.stringify({}),
        },
      });

      successCount++;

      // Progress indicator
      if (successCount % 100 === 0) {
        console.log(`✅ Imported ${successCount} contacts...`);
      }
    } catch (err: any) {
      errorCount++;
      if (errorCount <= 5) {
        console.error(`❌ Row ${rowNumber} error:`, err.message);
      }
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total rows processed: ${totalRows}`);
  console.log(`✅ Successfully imported: ${successCount}`);
  console.log(`⚠️  Duplicates skipped: ${duplicateCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log('='.repeat(50));
  console.log(`\n🎉 Import completed! ${successCount} contacts added to PostgreSQL.\n`);
}

/**
 * Entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const fileIndex = args.indexOf('--file');
  const filePath = fileIndex !== -1 ? args[fileIndex + 1] : 'contacts.xlsx';

  try {
    await importData(filePath);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
