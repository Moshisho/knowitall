// Yahoo Finance scraper: fetches monthly data and calculates returns
// Usage: node scripts/yahoo_fetcher.js SYMBOL PERIOD START_MONTH
// Example: node scripts/yahoo_fetcher.js MSTR 3M 2024-09-01

import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const SYMBOLS_DATA_FILE = path.resolve('data/symbols-data-yh.json');

function parseDate(dateStr) {
  // Support formats: YYYY-MM-DD, MM-YYYY
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr + 'T00:00:00');
  }
  if (/^\d{2}-\d{4}$/.test(dateStr)) {
    const [mm, yyyy] = dateStr.split('-');
    return new Date(Number(yyyy), Number(mm) - 1, 1);
  }
  throw new Error(`Invalid date format: ${dateStr}. Use YYYY-MM-DD or MM-YYYY`);
}

function addHorizonToDate(date, horizon) {
  const result = new Date(date);
  switch (horizon.toLowerCase()) {
    case '3d': result.setDate(result.getDate() + 3); break;
    case '7d': result.setDate(result.getDate() + 7); break;
    case '14d': result.setDate(result.getDate() + 14); break;
    case '1m': result.setMonth(result.getMonth() + 1); break;
    case '3m': result.setMonth(result.getMonth() + 3); break;
    case '12m': result.setFullYear(result.getFullYear() + 1); break;
    default: throw new Error(`Invalid horizon: ${horizon}. Use 3d, 7d, 14d, 1M, 3M, 12M`);
  }
  return result;
}

function isShortHorizon(horizon) {
  return ['3d', '7d', '14d'].includes(horizon.toLowerCase());
}

function normalizeSymbol(symbol) {
  // Map ^S&P500 to ^GSPC for Yahoo Finance
  if (symbol === '^S&P500') {
    return '^GSPC';
  }
  return symbol;
}

function buildShortHorizonUrl(symbol, startDate, endDate) {
  const period1 = Math.floor(startDate.getTime() / 1000);
  const period2 = Math.floor(endDate.getTime() / 1000);
  return `https://finance.yahoo.com/quote/${symbol}/history/?period1=${period1}&period2=${period2}`;
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

async function fetchYahooData(symbol, startDate, endDate, horizon, browser = null) {
  const normalizedSymbol = normalizeSymbol(symbol);
  console.log(`Fetching data for ${symbol} (${horizon})...`);
  
  let shouldCloseBrowser = false;
  if (!browser) {
    console.log('Opening new browser session...');
    const userDataDir = './browser-session';
    browser = await puppeteer.launch({ 
      headless: false,
      slowMo: 100,
      defaultViewport: null,
      userDataDir: userDataDir,
      args: [
        '--start-maximized',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled'
      ]
    });
    shouldCloseBrowser = true;
  }
  
  const page = await browser.newPage();
  
  // Build URL based on horizon type
  let url;
  if (isShortHorizon(horizon)) {
    // For short horizons, use specific date range
    url = buildShortHorizonUrl(normalizedSymbol, startDate, endDate);
  } else {
    // For long horizons, use 5-year range with monthly frequency
    const today = new Date();
    const fiveYearsAgo = new Date(today);
    fiveYearsAgo.setFullYear(today.getFullYear() - 5);
    const period1 = Math.floor(fiveYearsAgo.getTime() / 1000);
    const period2 = Math.floor(today.getTime() / 1000);
    url = `https://finance.yahoo.com/quote/${normalizedSymbol}/history/?frequency=1mo&period1=${period1}&period2=${period2}`;
  }
  
  console.log(`Navigating to: ${url}`);
  await page.goto(url, { waitUntil: 'networkidle2' });
  
  // Wait for the page to load
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Check if table is already loaded (skip popup handling if so)
  async function tryExtractTableEarly() {
    try {
      await page.waitForSelector('table', { timeout: 2000 });
      console.log('Table found, skipping popup handling...');
      return true;
    } catch (e) {
      console.log('Table not ready, proceeding with popup handling...');
      return false;
    }
  }
  
  const tableReady = await tryExtractTableEarly();
  
  if (!tableReady) {
    // Handle consent popup if present
    try {
      console.log('Looking for consent popup...');
      // Scroll down to see if there's a consent popup
      await page.evaluate(() => window.scrollBy(0, 200));
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // First try to find and click the "מעבר אל הסוף" (Go to end) button
      try {
        await page.waitForSelector('button', { timeout: 1500 });
        const buttons = await page.$$('button');
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent, button);
          if (text?.includes('מעבר אל הסוף')) {
            await button.click();
            console.log('Clicked "מעבר אל הסוף" button');
            await new Promise(resolve => setTimeout(resolve, 2000));
            break;
          }
        }
      } catch (e) {
        console.log('Could not find "מעבר אל הסוף" button');
      }
      
      // Then try to find and click the "Reject All" button (דחה הכל)
      const rejectSelectors = [
        'button[name="reject"]',
        'button[data-testid="reject-all"]',
        'button:contains("דחה הכל")',
        'button:contains("Reject all")',
        '.reject-all',
        '#reject-all-button'
      ];
      
      for (const selector of rejectSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 1500 });
          await page.click(selector);
          console.log('Clicked reject all button, selector:', selector);
          await new Promise(resolve => setTimeout(resolve, 2000));
          break;
        } catch (e) {
          // Continue to next selector
        }
      }
    } catch (error) {
      console.log('No consent popup found or could not handle it');
    }
  }
  
  // Wait for table to load
  await page.waitForSelector('table', { timeout: 10000 });
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Extract data from table (both daily and monthly formats)
  const data = await page.$$eval('table tbody tr', (rows, isShort) => {
    return rows.map(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 6) return null;
      const dateStr = cells[0].textContent.trim();
      const open = parseFloat(cells[1].textContent.replace(',', ''));
      const close = parseFloat(cells[4].textContent.replace(',', ''));
      if (isNaN(open) || isNaN(close)) return null;
      return { date: dateStr, open, close };
    }).filter(item => item);
  }, isShortHorizon(horizon));
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  if (shouldCloseBrowser) {
    await browser.close();
  } else {
    await page.close();
  }
  
  console.log(`Found ${data.length} monthly data points`);
  
  return data;
}

function findMonthData(data, targetDate) {
  // Convert target date to YYYY-MM format for comparison
  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth();
  const targetYearMonth = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
  
  // Try exact match first (compare YYYY-MM format)
  const exactMatch = data.find(item => {
    const itemDate = new Date(item.date);
    const itemYearMonth = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}`;
    return itemYearMonth === targetYearMonth;
  });
  
  if (exactMatch) {
    return exactMatch;
  }
  
  // Find the closest month (within 2 months)
  const targetTime = targetDate.getTime();
  let closestItem = null;
  let minDiff = Infinity;
  
  for (const item of data) {
    const itemDate = new Date(item.date);
    const diff = Math.abs(itemDate.getTime() - targetTime);
    if (diff < minDiff && diff < (60 * 24 * 60 * 60 * 1000)) { // Within 60 days
      minDiff = diff;
      closestItem = item;
    }
  }
  
  if (!closestItem) {
    throw new Error(`No monthly data found near ${targetYearMonth}`);
  }
  
  return closestItem;
}

function findDayData(data, targetDate) {
  const targetStr = formatDate(targetDate);
  
  // Try exact match first
  const exactMatch = data.find(item => {
    const itemDate = new Date(item.date);
    return formatDate(itemDate) === targetStr;
  });
  
  if (exactMatch) {
    return exactMatch;
  }
  
  // Find the closest day (within 3 days)
  const targetTime = targetDate.getTime();
  let closestItem = null;
  let minDiff = Infinity;
  
  for (const item of data) {
    const itemDate = new Date(item.date);
    const diff = Math.abs(itemDate.getTime() - targetTime);
    if (diff < minDiff && diff < (3 * 24 * 60 * 60 * 1000)) { // Within 3 days
      minDiff = diff;
      closestItem = item;
    }
  }
  
  if (!closestItem) {
    throw new Error(`No daily data found near ${targetStr}`);
  }
  
  return closestItem;
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
    console.log(`Open: ${existingEntry['open-price']}, Close: ${existingEntry['close-price']}`);
    console.log(`Change: ${existingEntry['change-abs']} (${existingEntry['change-percentage']}%)`);
    return existingEntry;
  }
  
  return null;
}

async function calculateReturn(symbol, startDateStr, horizon, browser = null) {
  const startDate = parseDate(startDateStr);
  const endDate = addHorizonToDate(startDate, horizon);
  
  console.log(`Fetching ${symbol} data from ${formatDate(startDate)} to ${formatDate(endDate)} (${horizon})...`);
  
  const data = await fetchYahooData(symbol, startDate, endDate, horizon, browser);
  
  let startItem, endItem, startPrice, endPrice;
  
  if (isShortHorizon(horizon)) {
    // For daily data: Open price for start date, Close price for end date
    startItem = findDayData(data, startDate);
    endItem = findDayData(data, endDate);
    startPrice = startItem.open;
    endPrice = endItem.close;
    
    console.log(`${symbol}: ${startPrice.toFixed(2)} (${startItem.date} Open) → ${endPrice.toFixed(2)} (${endItem.date} Close)`);
  } else {
    // For monthly data: Open price for start month, Close price for end month
    startItem = findMonthData(data, startDate);
    endItem = findMonthData(data, endDate);
    startPrice = startItem.open;
    endPrice = endItem.close;
    
    console.log(`${symbol}: ${startPrice.toFixed(2)} (${startItem.date} Open) → ${endPrice.toFixed(2)} (${endItem.date} Close)`);
  }
  
  const changeAbs = endPrice - startPrice;
  const changePercentage = (changeAbs / startPrice) * 100;
  
  console.log(`Change: ${changeAbs.toFixed(2)} (${changePercentage.toFixed(2)}%)`);
  
  return {
    date: formatDate(startDate),
    symbol,
    horizon: horizon.toLowerCase(),
    'open-price': parseFloat(startPrice.toFixed(2)),
    'close-price': parseFloat(endPrice.toFixed(2)),
    'change-abs': parseFloat(changeAbs.toFixed(2)),
    'change-percentage': parseFloat(changePercentage.toFixed(2))
  };
}

async function main() {
  const [symbol, period, startMonth] = process.argv.slice(2);
  
  if (!symbol || !period || !startMonth) {
    console.error('Usage: node scripts/yahoo_fetcher.js SYMBOL PERIOD START_DATE');
    console.error('Example: node scripts/yahoo_fetcher.js MSTR 3M 2024-09-01');
    console.error('Example: node scripts/yahoo_fetcher.js SWK 3d 2024-10-31');
    console.error('Example: node scripts/yahoo_fetcher.js AAPL 7d 10-2024');
    console.error('Periods: 3d, 7d, 14d, 1M, 3M, 12M');
    console.error('START_DATE format: YYYY-MM-DD or MM-YYYY');
    process.exit(1);
  }
  
  if (checkExistingData(symbol.toUpperCase(), startMonth, period)) {
    console.log('Using existing data, no fetch needed.');
    return;
  }
  
  try {
    const returnData = await calculateReturn(symbol.toUpperCase(), startMonth, period);
    
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
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Export functions for HTTP server integration
export {
  calculateReturn,
  checkExistingData,
  loadSymbolsData,
  saveSymbolsData,
  parseDate,
  formatDate,
  isShortHorizon,
  normalizeSymbol
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}