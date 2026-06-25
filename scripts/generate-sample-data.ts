/**
 * Generate Sample Excel File for Import Testing
 * Creates an Excel file with 2500+ sample contacts
 */

import ExcelJS = require('exceljs');

const FOLK_STAGES = [
  'Fresh Lead', 'FRJ', 'FRP', 'SGW', 'SGS',
  '21 Days Challenge', 'Interested (Visited Residency or Temple)',
  'Diamond-club 16', 'Club 16 - Inactive'
];

const LOCATIONS = [
  'Bangalore', 'Mumbai', 'Delhi', 'Chennai', 'Hyderabad',
  'Pune', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Lucknow'
];

const OCCUPATIONS = [
  'Working', 'Student', 'Searching for job', 'Self Employed'
];

const STAYING_WITH = [
  'PG / Hostel', 'Flat', 'Family', 'Temple Residency'
];

const CONTACT_SOURCES = [
  'Govinda Temple', 'ITPL', 'HK hill', 'Govinda Residency', 'Other'
];

const NAMES = [
  'Arjun Sharma', 'Priya Patel', 'Rahul Verma', 'Ananya Singh', 'Vikram Kumar',
  'Neha Gupta', 'Amit Patel', 'Sneha Reddy', 'Rohit Mehta', 'Pooja Nair',
  'Karthik Iyer', 'Deepa Menon', 'Suresh Babu', 'Lakshmi Devi', 'Rajesh Kumar',
  'Meera Joshi', 'Arun Nair', 'Divya Sharma', 'Suresh Patel', 'Kavitha Rao',
  'Manoj Kumar', 'Swathi Reddy', 'Venkat Prasad', 'Padmavathi Devi', 'Ravi Teja',
  'Anitha Kumari', 'Srinivasulu', 'Geetha Rani', 'Prasad Reddy', 'Lakshmi Narayana'
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generatePhone(): string {
  const prefix = ['98', '97', '96', '95', '94', '93', '92', '91', '90', '89', '88', '87', '86', '85'];
  return randomItem(prefix) + String(randomInt(10000000, 99999999));
}

async function generateSampleExcel() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Contacts');

  // Define columns
  sheet.columns = [
    { header: 'Full Name', key: 'fullName', width: 25 },
    { header: 'Phone', key: 'phone', width: 15 },
    { header: 'Age', key: 'age', width: 10 },
    { header: 'Current Folk Stage', key: 'currentFolkStage', width: 20 },
    { header: 'Location', key: 'location', width: 20 },
    { header: 'Native Place', key: 'nativePlace', width: 20 },
    { header: 'Staying With', key: 'stayingWith', width: 20 },
    { header: 'Occupation', key: 'occupation', width: 20 },
    { header: 'Organisation', key: 'organisation', width: 25 },
    { header: 'Chanting Rounds', key: 'chantingStatus', width: 15 },
    { header: 'SG Rating', key: 'sgRating', width: 15 },
    { header: 'Contact Source', key: 'contactSource', width: 25 },
    { header: 'Relationship Status', key: 'relationshipStatus', width: 20 },
    { header: 'Verified by FG', key: 'verifiedByFg', width: 15 },
    { header: 'Folk ID', key: 'folkId', width: 15 },
    { header: 'Monthly Rent', key: 'rentDetails', width: 15 },
    { header: 'Primary Enabler', key: 'enablerInTouchWith', width: 25 },
    { header: 'General Remarks', key: 'generalRemarks', width: 40 },
  ];

  // Style header row
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EAF6' } };

  // Generate 2500 contacts
  console.log('Generating 2500 sample contacts...');

  for (let i = 1; i <= 2500; i++) {
    const name = `${randomItem(NAMES)} ${randomInt(1, 99)}`;
    const phone = generatePhone();
    const age = randomInt(18, 45);
    const folkStage = randomItem(FOLK_STAGES);
    const location = randomItem(LOCATIONS);

    sheet.addRow({
      fullName: name,
      phone: phone,
      age: age,
      currentFolkStage: folkStage,
      location: location,
      nativePlace: randomItem(LOCATIONS),
      stayingWith: randomItem(STAYING_WITH),
      occupation: randomItem(OCCUPATIONS),
      organisation: `Company ${randomInt(1, 500)}`,
      chantingStatus: randomInt(0, 16),
      sgRating: randomInt(0, 5),
      contactSource: randomItem(CONTACT_SOURCES),
      relationshipStatus: Math.random() > 0.7 ? 'Married' : 'Single',
      verifiedByFg: Math.random() > 0.5 ? 'Yes' : 'No',
      folkId: `FOLK/${2024}/${String(i).padStart(4, '0')}`,
      rentDetails: randomInt(5000, 25000),
      enablerInTouchWith: '',
      generalRemarks: `Sample contact ${i}`,
    });

    if (i % 500 === 0) {
      console.log(`  Generated ${i} contacts...`);
    }
  }

  const filePath = 'sample_contacts.xlsx';
  await workbook.xlsx.writeFile(filePath);
  console.log(`\n✅ Sample Excel file created: ${filePath}`);
  console.log(`   Total contacts: 2500`);
}

generateSampleExcel().catch(console.error);
