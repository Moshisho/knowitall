// Simple HTTP server for serving the web client with Yahoo fetcher API

import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { 
  calculateReturn, 
  checkExistingData, 
  loadSymbolsData, 
  saveSymbolsData, 
  parseDate, 
  formatDate 
} from './yahoo_fetcher.js';
import { aggregateSymbolData } from './aggregator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.resolve(__dirname, '../clients/web');
const PORT = 3000;

// Global browser instance
let globalBrowser = null;
let isBrowserStarting = false;

// Initialize browser
async function initBrowser() {
  if (isBrowserStarting) {
    while (isBrowserStarting) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return globalBrowser;
  }

  if (globalBrowser) {
    return globalBrowser;
  }

  console.log('🌐 Starting persistent browser session...');
  isBrowserStarting = true;

  try {
    const userDataDir = './browser-session';
    globalBrowser = await puppeteer.launch({
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

    console.log('✅ Browser started successfully');
    
    // Handle browser disconnection
    globalBrowser.on('disconnected', () => {
      console.log('⚠️  Browser disconnected, resetting...');
      globalBrowser = null;
    });

  } catch (error) {
    console.error('❌ Failed to start browser:', error.message);
    globalBrowser = null;
    throw error;
  } finally {
    isBrowserStarting = false;
  }

  return globalBrowser;
}

// Close browser
async function closeBrowser() {
  if (globalBrowser) {
    console.log('🔒 Closing browser...');
    try {
      await globalBrowser.close();
    } catch (error) {
      console.warn('Warning: Error closing browser:', error.message);
    }
    globalBrowser = null;
  }
}

// Handle Yahoo fetch API
async function handleYahooFetch(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const { symbol, horizon, startDate } = JSON.parse(body);

      if (!symbol || !horizon || !startDate) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Missing required fields: symbol, horizon, startDate' 
        }));
        return;
      }

      // Check for existing data first
      const existing = checkExistingData(symbol.toUpperCase(), startDate, horizon);
      if (existing) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          data: existing,
          fromCache: true 
        }));
        return;
      }

      // Ensure browser is running
      const browser = await initBrowser();
      
      // Calculate return using shared browser
      const result = await calculateReturn(symbol.toUpperCase(), startDate, horizon, browser);
      
      // Save to data file
      const symbolsData = loadSymbolsData();
      const existingIndex = symbolsData.findIndex(
        entry => entry.date === result.date && 
                 entry.symbol === result.symbol && 
                 entry.horizon === result.horizon
      );

      if (existingIndex >= 0) {
        symbolsData[existingIndex] = result;
      } else {
        symbolsData.push(result);
      }

      saveSymbolsData(symbolsData);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        data: result,
        fromCache: false 
      }));

    } catch (error) {
      console.error('Yahoo fetch error:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: error.message 
      }));
    }
  });
}

// Handle get all data API
function handleGetAllData(req, res) {
  try {
    const data = aggregateSymbolData();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  } catch (error) {
    console.error('Get all data error:', error.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: error.message 
    }));
  }
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // API Routes
  if (pathname === '/api/fetch-yahoo') {
    handleYahooFetch(req, res);
    return;
  }

  if (pathname === '/api/get-all-data') {
    handleGetAllData(req, res);
    return;
  }

  // Static file serving
  if (pathname === '/' || pathname === '/index.html') {
    const filePath = path.join(WEB_DIR, 'index.html');
    
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Error reading file: ${err.message}`);
        return;
      }
      
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  await closeBrowser();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down server...');
  await closeBrowser();
  process.exit(0);
});

server.listen(PORT, async () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`📊 Open your browser and visit: http://localhost:${PORT}`);
  console.log(`🔧 API endpoint: POST http://localhost:${PORT}/api/fetch-yahoo`);
  
  // Initialize browser on startup
  try {
    await initBrowser();
  } catch (error) {
    console.error('⚠️  Failed to initialize browser on startup. It will be started when needed.');
  }
  
  console.log('');
});
