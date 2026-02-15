// Load and merge a specific IKF file into the predictions data
import fs from 'fs';
import path from 'path';
import { parseIkfWorkbook } from './ikf_parser.js';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node load-ikf-file.mjs <filename>');
  console.error('Example: node load-ikf-file.mjs IKForecast_stocks_top_10_SP500_01_Oct_2024.xls');
  process.exit(1);
}

const filename = args[0];
const filePath = path.resolve('data/ikf', filename);

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const predictionsPath = path.resolve('data/symbols-predict-ikf.json');

// Parse the new file
console.log(`Parsing ${filename}...`);
const newRecords = parseIkfWorkbook(filePath);
console.log(`✓ Parsed ${newRecords.length} records from ${filename}`);

// Load existing predictions
console.log(`Loading existing predictions...`);
let existingRecords = [];
if (fs.existsSync(predictionsPath)) {
  existingRecords = JSON.parse(fs.readFileSync(predictionsPath, 'utf-8'));
  console.log(`✓ Loaded ${existingRecords.length} existing records`);
}

// Merge: add new records that don't already exist (by date+symbol+horizon)
const existingKeys = new Set(existingRecords.map(r => `${r.date}|${r.symbol}|${r.horizon}`));
const recordsToAdd = newRecords.filter(r => !existingKeys.has(`${r.date}|${r.symbol}|${r.horizon}`));

console.log(`Found ${recordsToAdd.length} new records to add`);

const merged = [...existingRecords, ...recordsToAdd];
merged.sort((a, b) => {
  if (a.date !== b.date) return b.date.localeCompare(a.date); // newest first
  if (a.symbol !== b.symbol) return a.symbol.localeCompare(b.symbol);
  return a.horizon.localeCompare(b.horizon);
});

// Write back
fs.writeFileSync(predictionsPath, JSON.stringify(merged, null, 2));
console.log(`✓ Saved ${merged.length} total records to ${predictionsPath}`);
