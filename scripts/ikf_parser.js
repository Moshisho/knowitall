// IKF Excel parser: reads files under data/ and prints parsed boxes
// Deterministic layout per spec

import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';

const DATA_DIR = path.resolve('data');

export function parseDateFromFilename(filename) {
  const m = filename.match(/_(\d{2})_([A-Za-z]{3})_(\d{4})\./);
  if (!m) return null;
  const [_, dd, monStr, yyyy] = m;
  const monthMap = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
  };
  const mm = monthMap[monStr];
  if (mm === undefined) return null;
  return new Date(Number(yyyy), mm, Number(dd));
}

function cellValue(aoa, r, c) {
  const row = aoa[r] || [];
  const v = row[c];
  if (v == null) return '';
  return String(v).trim();
}

function normalizeHorizonLabel(label) {
  const s = String(label || '').toLowerCase();
  if (/^3d$|^3\s*days?$/.test(s)) return '3d';
  if (/^7d$|^7\s*days?$|^1\s*week$/.test(s)) return '7d';
  if (/^14d$|^14\s*days?$|^2\s*weeks?$/.test(s)) return '14d';
  if (/^1m$|^1\s*month$|^30d$/.test(s)) return '1m';
  if (/^3m$|^3\s*months$/.test(s)) return '3m';
  if (/^12m$|^12\s*months$|^1\s*year$|^year$|^1y$/.test(s)) return '12m';
  return label || null;
}

function isSymbolCell(v) {
  const s = String(v || '').trim();
  return s === '^S&P500' || /^[A-Z]{1,4}$/.test(s);
}

function toNumber(v) {
  if (v == null || v === '') return null;
  const num = Number(String(v).replace(/[\s,]+/g, ''));
  return Number.isNaN(num) ? null : num;
}

export function parseIkfWorkbook(filePath) {
  const wb = xlsx.readFile(filePath);
  const filename = path.basename(filePath);
  const date = parseDateFromFilename(filename);
  const dateIso = date ? date.toISOString().slice(0, 10) : null;
  const results = [];

  wb.SheetNames.forEach(sheetName => {
    // Skip non-data sheets explicitly
    if (sheetName.toLowerCase() === 'explanation') return;

    const sheet = wb.Sheets[sheetName];
    const aoa = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    let horizonLabels = [
      normalizeHorizonLabel(cellValue(aoa, 3, 3)),  // D4
      normalizeHorizonLabel(cellValue(aoa, 3, 9)),  // J4
      normalizeHorizonLabel(cellValue(aoa, 3, 15))  // P4
    ];
    // Deterministic fallback only if label missing
    if (!horizonLabels[0] || !horizonLabels[1] || !horizonLabels[2]) {
      const sname = sheetName.toLowerCase();
      if (sname.includes('3-7-14')) horizonLabels = ['3d', '7d', '14d'];
      else if (sname.includes('1-3-12')) horizonLabels = ['1m', '3m', '12m'];
    }

    const blocks = [
      { cols: [1, 2, 3, 4, 5], horizon: horizonLabels[0], labelCell: 'D4' },    // B..F
      { cols: [7, 8, 9, 10, 11], horizon: horizonLabels[1], labelCell: 'J4' },  // H..L
      { cols: [13, 14, 15, 16, 17], horizon: horizonLabels[2], labelCell: 'P4' } // N..R
    ];

    for (let r = 5; r <= 63; r += 3) {
      for (const block of blocks) {
        const horizon = block.horizon || null;
        if (!horizon) {
          // Keep warning for data sheets; explanation is already skipped
          console.warn(`Warning: skipping block ${block.labelCell} in sheet '${sheetName}' due to unparsable horizon`);
          continue; // skip entire block if horizon unknown
        }
        for (const c of block.cols) {
          const symbolRaw = cellValue(aoa, r, c);
          const symbol = isSymbolCell(symbolRaw) ? symbolRaw : 'N/A';
          if (symbol === 'N/A') continue; // skip empty/invalid symbols

          const signal = toNumber(cellValue(aoa, r + 1, c));
          const predictability = toNumber(cellValue(aoa, r + 2, c));

          // Strict: skip rows with missing non-numeric values
          if (signal == null || predictability == null) continue;

          results.push({
            date: dateIso,
            horizon,
            symbol,
            signal,
            predictability
          });
        }
      }
    }
  });

  return results;
}

function main() {
  if (process.env.IKF_FILE) {
    const parsed = parseIkfWorkbook(process.env.IKF_FILE);
    parsed.forEach(obj => console.log(JSON.stringify(obj)));
    return;
  }
  if (!fs.existsSync(DATA_DIR)) {
    console.error(`Data directory not found: ${DATA_DIR}`);
    process.exit(1);
  }
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => /\.xlsx?$/.test(f))
    .map(f => path.join(DATA_DIR, f));

  if (files.length === 0) {
    console.error('No Excel files found in data/.');
    process.exit(1);
  }

  for (const fp of files) {
    try {
      const parsed = parseIkfWorkbook(fp);
      parsed.forEach(obj => console.log(JSON.stringify(obj)));
    } catch (err) {
      console.error(`Failed to parse ${fp}:`, err.message);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}



