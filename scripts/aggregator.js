// Aggregator: reads all symbols*.json files and combines them into a unified array
// Each object contains prediction data merged with actual performance data

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve('data');

/**
 * Load JSON file, return empty array if file doesn't exist or is invalid
 */
function loadJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(content) ? content : [];
  } catch (err) {
    console.error(`Warning: Failed to parse ${filePath}:`, err.message);
    return [];
  }
}

/**
 * Aggregate all symbol data from JSON files in data/
 * Returns array of objects with combined prediction and performance data
 */
export function aggregateSymbolData() {
  const predictions = loadJsonFile(path.join(DATA_DIR, 'symbols-predict-ikf.json'));
  const performanceAV = loadJsonFile(path.join(DATA_DIR, 'symbols-data-av.json'));
  const performanceYH = loadJsonFile(path.join(DATA_DIR, 'symbols-data-yh.json'));

  // Create maps for quick lookup of performance data by (date, symbol, horizon)
  const avMap = new Map();
  const yhMap = new Map();

  performanceAV.forEach(item => {
    const key = `${item.date}|${item.symbol}|${item.horizon}`;
    avMap.set(key, item);
  });

  performanceYH.forEach(item => {
    const key = `${item.date}|${item.symbol}|${item.horizon}`;
    yhMap.set(key, item);
  });

  // Aggregate: start with predictions and merge performance data
  const aggregated = predictions.map(pred => {
    const key = `${pred.date}|${pred.symbol}|${pred.horizon}`;
    const avData = avMap.get(key);
    const yhData = yhMap.get(key);

    return {
      date: pred.date,
      symbol: pred.symbol,
      horizon: pred.horizon,
      prediction: {
        signal: pred.signal,
        predictability: pred.predictability
      },
      performance: {
        av: avData ? {
          'change-abs': avData['change-abs'],
          'change-percentage': avData['change-percentage']
        } : null,
        yh: yhData ? {
          'open-price': yhData['open-price'],
          'close-price': yhData['close-price'],
          'change-abs': yhData['change-abs'],
          'change-percentage': yhData['change-percentage']
        } : null
      }
    };
  });

  return aggregated;
}

function main() {
  const aggregated = aggregateSymbolData();
  aggregated.forEach(obj => console.log(JSON.stringify(obj)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
