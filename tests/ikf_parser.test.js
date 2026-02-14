import assert from 'assert/strict';
import path from 'path';
import { parseIkfWorkbook } from '../scripts/ikf_parser.js';

const SAMPLE = path.resolve('unit-test-data/29_Sep_2024.xls');

function findRow(rows, symbol, horizon) {
  return rows.find(r => r.symbol === symbol && r.horizon === horizon);
}

function approxEquals(actual, expected, tolerance = 0.02) {
  return Math.abs(actual - expected) <= tolerance;
}

function startsWithDecimal(actual, prefix) {
  const s = String(actual);
  return s.startsWith(prefix);
}

function printRow(label, r) {
  const sig = Number(r.signal).toFixed(2);
  const pred = Number(r.predictability).toFixed(2);
  console.log(`${label}: date=${r.date}, horizon=${r.horizon}, symbol=${r.symbol}, signal=${sig}, predictability=${pred}`);
}

function run() {
  const rows = parseIkfWorkbook(SAMPLE);
  assert(Array.isArray(rows) && rows.length > 0, 'Parsed rows should be non-empty');

  // Basic shape checks
  const r0 = rows[0];
  assert('date' in r0 && 'horizon' in r0 && 'symbol' in r0 && 'signal' in r0 && 'predictability' in r0,
    'Row should contain date, horizon, symbol, signal, predictability');

  // Strictness: no null signal or predictability
  for (const r of rows) {
    assert(r.signal != null && r.predictability != null, `Row with nulls found for ${r.symbol} ${r.horizon}`);
  }

  // Deterministic presence checks
  assert(findRow(rows, 'ZIM', '7d'), 'Expected ZIM at 7d horizon');
  assert(findRow(rows, 'ZIM', '14d'), 'Expected ZIM at 14d horizon');
  assert(findRow(rows, 'SIG', '1m'), 'Expected SIG at 1m horizon');
  assert(findRow(rows, 'MSTR', '3m'), 'Expected MSTR at 3m horizon');
  assert(findRow(rows, '^S&P500', '1m'), 'Expected ^S&P500 at 1m horizon');
  assert(findRow(rows, '^S&P500', '3m'), 'Expected ^S&P500 at 3m horizon');

  // Specific value assertions (prefix or approximate where requested)
  // 3d, FCX, 0.7..., 0.22
  {
    const r = findRow(rows, 'FCX', '3d');
    assert(r, 'FCX 3d row missing');
    assert(startsWithDecimal(r.signal, '0.7'), `FCX 3d signal expected to start with 0.7, got ${r.signal}`);
    assert(approxEquals(r.predictability, 0.22, 0.001), `FCX 3d predictability ~0.22, got ${r.predictability}`);
    printRow('FCX 3d', r);
  }

  // 3d, ESI, 0.2..., 0.21
  {
    const r = findRow(rows, 'ESI', '3d');
    assert(r, 'ESI 3d row missing');
    assert(startsWithDecimal(r.signal, '0.2'), `ESI 3d signal expected to start with 0.2, got ${r.signal}`);
    assert(approxEquals(r.predictability, 0.21, 0.001), `ESI 3d predictability ~0.21, got ${r.predictability}`);
    printRow('ESI 3d', r);
  }

  // 7d, AEO, 0.5..., 0.39
  {
    const r = findRow(rows, 'AEO', '7d');
    assert(r, 'AEO 7d row missing');
    assert(startsWithDecimal(r.signal, '0.5'), `AEO 7d signal expected to start with 0.5, got ${r.signal}`);
    assert(approxEquals(r.predictability, 0.39, 0.001), `AEO 7d predictability ~0.39, got ${r.predictability}`);
    printRow('AEO 7d', r);
  }

  // 14d, MAA, -0.1..., 0.37
  {
    const r = findRow(rows, 'MAA', '14d');
    assert(r, 'MAA 14d row missing');
    assert(startsWithDecimal(r.signal, '-0.1'), `MAA 14d signal expected to start with -0.1, got ${r.signal}`);
    assert(approxEquals(r.predictability, 0.37, 0.001), `MAA 14d predictability ~0.37, got ${r.predictability}`);
    printRow('MAA 14d', r);
  }

  // 1m, ^S&P500, ~0.14, 0.52
  {
    const r = findRow(rows, '^S&P500', '1m');
    assert(r, '^S&P500 1m row missing');
    assert(approxEquals(r.signal, 0.14, 0.01), `^S&P500 1m signal ~0.14, got ${r.signal}`);
    assert(approxEquals(r.predictability, 0.52, 0.001), `^S&P500 1m predictability ~0.52, got ${r.predictability}`);
    printRow('^S&P500 1m', r);
  }

  // 3m, IIPR, ~1.40, 0.62
  {
    const r = findRow(rows, 'IIPR', '3m');
    assert(r, 'IIPR 3m row missing');
    assert(approxEquals(r.signal, 1.40, 0.05), `IIPR 3m signal ~1.40, got ${r.signal}`);
    assert(approxEquals(r.predictability, 0.62, 0.001), `IIPR 3m predictability ~0.62, got ${r.predictability}`);
    printRow('IIPR 3m', r);
  }

  // 12m, MSTR, 565..., 0.78
  {
    const r = findRow(rows, 'MSTR', '12m');
    assert(r, 'MSTR 12m row missing');
    assert(startsWithDecimal(r.signal, '565'), `MSTR 12m signal expected to start with 565, got ${r.signal}`);
    assert(approxEquals(r.predictability, 0.78, 0.001), `MSTR 12m predictability ~0.78, got ${r.predictability}`);
    printRow('MSTR 12m', r);
  }

  console.log('OK: ikf_parser detailed tests passed');
}

run();
