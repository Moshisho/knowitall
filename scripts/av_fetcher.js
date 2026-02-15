// Alpha Vantage fetcher: fetches price data and calculates returns
// Usage: node scripts/av_fetcher.js SYMBOL START_DATE HORIZON
// Example: node scripts/av_fetcher.js AAPL 2024-09-29 3m

import fs from 'fs';
import path from 'path';

const SYMBOLS_DATA_FILE = path.resolve('data/symbols-data-av.json');
const AV_BASE_URL = 'https://www.alphavantage.co/query';

function parseDate(dateStr) {
  // Support formats: YYYY-MM-DD, DD_Mon_YYYY
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr + 'T00:00:00');
  }
  const m = dateStr.match(/^(\d{2})_([A-Za-z]{3})_(\d{4})$/);
  if (!m) throw new Error(`Invalid date format: ${dateStr}. Use YYYY-MM-DD or DD_Mon_YYYY`);
  
  const [_, dd, monStr, yyyy] = m;
  const monthMap = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
  };
  const mm = monthMap[monStr];
  if (mm === undefined) throw new Error(`Invalid month: ${monStr}`);
  return new Date(Number(yyyy), mm, Number(dd));
}

function addHorizonToDate(date, horizon) {
  const result = new Date(date);
  switch (horizon) {
    case '3d': result.setDate(result.getDate() + 3); break;
    case '7d': result.setDate(result.getDate() + 7); break;
    case '14d': result.setDate(result.getDate() + 14); break;
    case '1m': result.setMonth(result.getMonth() + 1); break;
    case '3m': result.setMonth(result.getMonth() + 3); break;
    case '12m': result.setFullYear(result.getFullYear() + 1); break;
    default: throw new Error(`Invalid horizon: ${horizon}. Use 3d, 7d, 14d, 1m, 3m, 12m`);
  }
  return result;
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function normalizeSymbol(symbol) {
  // Map ^S&P500 to ^GSPC for Alpha Vantage
  if (symbol === '^S&P500') {
    return '^GSPC';
  }
  return symbol;
}

async function fetchStockData(symbol, apiKey) {
  const normalizedSymbol = normalizeSymbol(symbol);
  const url = `${AV_BASE_URL}?function=TIME_SERIES_DAILY&symbol=${normalizedSymbol}&apikey=${apiKey}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data['Error Message']) {
      throw new Error(`Alpha Vantage error: ${data['Error Message']}`);
    }
    
    if (data['Information'] && data['Information'].includes('premium')) {
      throw new Error('Premium endpoint required. Try with a different symbol or upgrade Alpha Vantage plan.');
    }
    
    if (data['Note']) {
      throw new Error(`Rate limit: ${data['Note']}`);
    }
    
    const timeSeries = data['Time Series (Daily)'];
    if (!timeSeries) {
      throw new Error('No time series data found. Check symbol and API key.');
    }
    
    return timeSeries;
  } catch (error) {
    throw new Error(`Failed to fetch data for ${symbol}: ${error.message}`);
  }
}

function getClosestPrice(timeSeries, targetDate, direction = 'backward') {
  const targetStr = formatDate(targetDate);
  
  // Try exact match first
  if (timeSeries[targetStr]) {
    return {
      date: targetStr,
      price: parseFloat(timeSeries[targetStr]['4. close'])
    };
  }
  
  // Get all available dates and sort
  const availableDates = Object.keys(timeSeries).sort();
  
  if (direction === 'backward') {
    // Find closest date before target (go backwards up to 10 days)
    const searchDate = new Date(targetDate);
    for (let i = 0; i <= 10; i++) {
      const dateStr = formatDate(searchDate);
      if (timeSeries[dateStr]) {
        return {
          date: dateStr,
          price: parseFloat(timeSeries[dateStr]['4. close'])
        };
      }
      searchDate.setDate(searchDate.getDate() - 1);
    }
  } else {
    // Find closest date after target (go forwards up to 10 days)
    const searchDate = new Date(targetDate);
    for (let i = 0; i <= 10; i++) {
      const dateStr = formatDate(searchDate);
      if (timeSeries[dateStr]) {
        return {
          date: dateStr,
          price: parseFloat(timeSeries[dateStr]['4. close'])
        };
      }
      searchDate.setDate(searchDate.getDate() + 1);
    }
  }
  
  // If still not found, get the closest available date
  const targetTime = targetDate.getTime();
  let closestDate = availableDates[0];
  let minDiff = Math.abs(new Date(closestDate).getTime() - targetTime);
  
  for (const dateStr of availableDates) {
    const diff = Math.abs(new Date(dateStr).getTime() - targetTime);
    if (diff < minDiff) {
      minDiff = diff;
      closestDate = dateStr;
    }
  }
  
  if (!closestDate) {
    throw new Error(`No price data found near ${targetStr}`);
  }
  
  return {
    date: closestDate,
    price: parseFloat(timeSeries[closestDate]['4. close'])
  };
}

function loadSymbolsData() {
  if (!fs.existsSync(SYMBOLS_DATA_FILE)) {
    return [];
  }
  try {
    const content = fs.readFileSync(SYMBOLS_DATA_FILE, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`Warning: Could not parse ${SYMBOLS_DATA_FILE}, starting fresh:`, error.message);
    return [];
  }
}

function saveSymbolsData(data) {
  fs.writeFileSync(SYMBOLS_DATA_FILE, JSON.stringify(data, null, 2));
}

function checkExistingData(symbol, startDateStr, horizon) {
  const symbolsData = loadSymbolsData();
  const startDate = parseDate(startDateStr);
  const dateKey = formatDate(startDate);
  
  const existingEntry = symbolsData.find(
    entry => entry.date === dateKey && 
             entry.symbol === symbol.toUpperCase() && 
             entry.horizon === horizon.toLowerCase()
  );
  
  if (existingEntry) {
    console.log(`Found existing data for ${symbol} ${horizon} starting ${dateKey}:`);
    console.log(`Change: ${existingEntry['change-abs']} (${existingEntry['change-percentage']}%)`);
    return existingEntry;
  }
  
  return null;
}

async function calculateReturn(symbol, startDateStr, horizon, apiKey) {
  const startDate = parseDate(startDateStr);
  const endDate = addHorizonToDate(startDate, horizon);
  
  console.log(`Fetching ${symbol} data from ${formatDate(startDate)} to ${formatDate(endDate)} (${horizon})...`);
  
  const timeSeries = await fetchStockData(symbol, apiKey);
  
  const startPrice = getClosestPrice(timeSeries, startDate);
  const endPrice = getClosestPrice(timeSeries, endDate);
  
  // Validate that we got meaningful price data
  if (startPrice.price === endPrice.price && startPrice.date === endPrice.date) {
    throw new Error('Invalid price data: start and end prices are identical with same date');
  }
  
  const changeAbs = endPrice.price - startPrice.price;
  const changePercentage = (changeAbs / startPrice.price) * 100;
  
  console.log(`${symbol}: ${startPrice.price} (${startPrice.date}) → ${endPrice.price} (${endPrice.date})`);
  console.log(`Change: ${changeAbs.toFixed(2)} (${changePercentage.toFixed(2)}%)`);
  
  return {
    date: formatDate(startDate),
    symbol,
    horizon,
    'change-abs': parseFloat(changeAbs.toFixed(2)),
    'change-percentage': parseFloat(changePercentage.toFixed(2))
  };
}

async function main() {
  const apiKey = process.env.AV_API_KEY;
  if (!apiKey) {
    console.error('Error: AV_API_KEY environment variable is required');
    process.exit(1);
  }
  
  const [symbol, startDateStr, horizon] = process.argv.slice(2);
  
  if (!symbol || !startDateStr || !horizon) {
    console.error('Usage: node scripts/av_fetcher.js SYMBOL START_DATE HORIZON');
    console.error('Example: node scripts/av_fetcher.js AAPL 2024-09-29 3m');
    console.error('Horizons: 3d, 7d, 14d, 1m, 3m, 12m');
    process.exit(1);
  }
  
  if (checkExistingData(symbol.toUpperCase(), startDateStr, horizon)) {
    console.log('Using existing data, no fetch needed.');
    return;
  }
  
  try {
    const returnData = await calculateReturn(symbol.toUpperCase(), startDateStr, horizon, apiKey);
    
    const symbolsData = loadSymbolsData();
    
    // Check if entry already exists
    const existingIndex = symbolsData.findIndex(
      entry => entry.date === returnData.date && 
               entry.symbol === returnData.symbol && 
               entry.horizon === returnData.horizon
    );
    
    if (existingIndex >= 0) {
      console.log('Updating existing entry...');
      symbolsData[existingIndex] = returnData;
    } else {
      console.log('Adding new entry...');
      symbolsData.push(returnData);
    }
    
    saveSymbolsData(symbolsData);
    console.log(`✓ Data saved to ${SYMBOLS_DATA_FILE}`);
  } catch (fetchError) {
    console.error('Fetch failed:', fetchError.message);
    console.error('Data will not be saved due to fetch failure.');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  calculateReturn,
  checkExistingData,
  loadSymbolsData,
  saveSymbolsData,
  parseDate,
  formatDate,
  normalizeSymbol
};