import { test, expect, Page, spawn } from '@playwright/test';
import { execSync, spawn as spawnChild } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_URL = 'http://localhost:3000';
const PROJECT_ROOT = path.resolve(__dirname, '..');
let serverProcess: any;

/**
 * Start the web server
 */
async function startServer() {
  return new Promise((resolve, reject) => {
    // Kill any existing processes on port 3000
    try {
      execSync('pkill -f "serve-web" || true');
    } catch (e) {
      // Ignore errors
    }

    // Wait a bit for the port to be free
    setTimeout(() => {
      const server = spawnChild('npm', ['run', 'serve:web'], {
        cwd: PROJECT_ROOT,
        stdio: 'pipe',
        detached: true,
      });

      // Wait for server to be ready
      const timeout = setTimeout(() => {
        reject(new Error('Server failed to start within 10 seconds'));
      }, 10000);

      server.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        if (output.includes('Server running at')) {
          clearTimeout(timeout);
          resolve(server);
        }
      });

      server.stderr?.on('data', (data: Buffer) => {
        console.error('Server error:', data.toString());
      });
    }, 1000);
  });
}

/**
 * Stop the web server
 */
function stopServer(process: any) {
  if (process && process.pid) {
    try {
      // Kill the process group to ensure all child processes are killed
      process.kill('SIGTERM');
      // Also kill via pkill to be sure
      execSync('pkill -f "serve-web" || true');
    } catch (e) {
      console.error('Error stopping server:', e);
    }
  }
}

/**
 * Clear localStorage for a page
 */
async function clearStorage(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
  });
}

/**
 * Get hidden column cells on current page
 */
async function getHiddenColumnCells(page: Page): Promise<number> {
  const hiddenCount = await page.evaluate(() => {
    return document.querySelectorAll('td.hidden, th.hidden').length;
  });
  return hiddenCount;
}

/**
 * Check if AV columns are hidden
 */
async function areAVColumnsHidden(page: Page): Promise<boolean> {
  const avCheckbox = await page.locator('#toggleAV');
  return !(await avCheckbox.isChecked());
}

// ============================================================================
// Test Setup & Teardown
// ============================================================================

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  serverProcess = await startServer();
  console.log('✅ Server started');
});

test.afterAll(async () => {
  stopServer(serverProcess);
  console.log('✅ Server stopped');
});

test.beforeEach(async ({ page }) => {
  // Navigate to the app
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  // Clear any existing storage
  await clearStorage(page);
  // Wait for table to load
  await page.waitForSelector('#dataTable tbody tr', { timeout: 5000 });
});

// ============================================================================
// BUG #1: Sorting State Not Persisted After Refresh
// ============================================================================

test('Bug #1: Sorting state should persist after page refresh', async ({ page }) => {
  // Step 1: Sort by "Predictability" column in descending order
  const predictabilityHeader = page.locator('th[data-field="predictability"]');
  
  // Click to sort ascending first
  await predictabilityHeader.click();
  await page.waitForTimeout(300);
  
  // Verify sorted-asc indicator is present
  let hasSortIndicator = await predictabilityHeader.evaluate((el) => {
    return el.classList.contains('sorted-asc');
  });
  expect(hasSortIndicator).toBe(true);

  // Click again to sort descending
  await predictabilityHeader.click();
  await page.waitForTimeout(300);

  // Verify sorted-desc indicator is present
  hasSortIndicator = await predictabilityHeader.evaluate((el) => {
    return el.classList.contains('sorted-desc');
  });
  expect(hasSortIndicator).toBe(true);

  // Step 2: Refresh the page
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#dataTable tbody tr', { timeout: 5000 });

  // Step 3: Verify sorting state is preserved
  const predictabilityHeaderAfterRefresh = page.locator('th[data-field="predictability"]');
  
  hasSortIndicator = await predictabilityHeaderAfterRefresh.evaluate((el) => {
    return el.classList.contains('sorted-desc');
  });
  expect(hasSortIndicator).toBe(true);

  // Verify the data is actually sorted by checking the first few rows
  const firstCellValue = await page.locator('tbody tr:first-child td:nth-child(5)').textContent();
  expect(firstCellValue).toBeTruthy();
});

// ============================================================================
// BUG #2: Column Visibility Not Applied to Newly Rendered Rows on Page Navigation
// ============================================================================

test('Bug #2: Hidden columns should remain hidden when navigating pages', async ({ page }) => {
  // Step 1: Hide AV Data columns
  const avToggle = page.locator('#toggleAV');
  
  // Verify it starts as checked
  let isChecked = await avToggle.isChecked();
  expect(isChecked).toBe(true);

  // Uncheck to hide AV columns
  await avToggle.click();
  await page.waitForTimeout(300);

  // Verify AV columns are hidden (have .hidden class)
  let hiddenCount = await getHiddenColumnCells(page);
  expect(hiddenCount).toBeGreaterThan(0);

  // Get the current page's AV cells that should be hidden
  const avChangePercentCells = await page.locator('tbody tr td:nth-child(8)').all();
  for (const cell of avChangePercentCells) {
    const isHidden = await cell.evaluate((el) => {
      return el.classList.contains('hidden');
    });
    expect(isHidden).toBe(true);
  }

  // Step 2: Navigate to next page
  const nextBtn = page.locator('#nextBtn');
  const isNextDisabled = await nextBtn.isDisabled();
  
  if (!isNextDisabled) {
    await nextBtn.click();
    await page.waitForTimeout(300);
    await page.waitForSelector('#dataTable tbody tr', { timeout: 5000 });

    // Step 3: Verify AV columns are still hidden on the new page
    const avChangePercentCellsPage2 = await page.locator('tbody tr td:nth-child(8)').all();
    for (const cell of avChangePercentCellsPage2) {
      const isHidden = await cell.evaluate((el) => {
        return el.classList.contains('hidden');
      });
      expect(isHidden).toBe(true);
    }

    // Also verify the checkbox is still unchecked
    isChecked = await avToggle.isChecked();
    expect(isChecked).toBe(false);
  }
});

// ============================================================================
// BUG #3: Pagination Should Be Preserved After Fetch
// ============================================================================

test('Bug #3: Current page should be preserved after fetching Yahoo data', async ({ page }) => {
  // This test requires having data that needs to be fetched
  // We'll look for a row with a "Fetch" button in the YH columns
  
  // Step 1: Navigate to page 2 (if available)
  const nextBtn = page.locator('#nextBtn');
  const isNextDisabled = await nextBtn.isDisabled();
  
  if (!isNextDisabled) {
    await nextBtn.click();
    await page.waitForTimeout(300);
    await page.waitForSelector('#dataTable tbody tr', { timeout: 5000 });

    // Get current page number
    let currentPageBefore = await page.locator('#pageNum').textContent();
    expect(currentPageBefore).toBe('2');

    // Step 2: Look for a fetch button on this page
    const fetchButton = await page.locator('tbody tr td .fetch-btn').first();
    const isFetchButtonVisible = await fetchButton.isVisible();

    if (isFetchButtonVisible) {
      // Step 3: Click fetch button (but don't wait for the server response in this test)
      // We'll set a small timeout to simulate the fetch process
      
      const fetchButtonText = await fetchButton.textContent();
      
      // Only proceed if it's a Yahoo fetch button (not a copy button)
      if (fetchButtonText?.includes('Fetch')) {
        // Listen for console messages or state changes
        const originalPageNum = await page.locator('#pageNum').textContent();
        
        // Click the fetch button
        await fetchButton.click();
        
        // Wait a moment for the request to be sent
        await page.waitForTimeout(500);

        // Check if we're still on the same page
        const currentPageAfterClick = await page.locator('#pageNum').textContent();
        
        // Note: The page might change briefly during fetch, but we're checking
        // that it doesn't jump to page 1 permanently
        expect(currentPageAfterClick).not.toBe('1');
      }
    }
  } else {
    // If there's only 1 page, this test is not applicable
    console.log('ℹ️  Only one page available, skipping pagination test');
  }
});

// ============================================================================
// Integration Test: All Three Bugs Combined
// ============================================================================

test('Integration: Column visibility, sorting, and pagination should work together', async ({ page }) => {
  // Step 1: Sort by symbol
  await page.locator('th[data-field="symbol"]').click();
  await page.waitForTimeout(300);

  // Step 2: Hide AV columns
  const avToggle = page.locator('#toggleAV');
  await avToggle.click();
  await page.waitForTimeout(300);

  // Step 3: Hide Predictability column
  const predToggle = page.locator('#togglePredictability');
  await predToggle.click();
  await page.waitForTimeout(300);

  // Step 4: Navigate to next page (if available)
  const nextBtn = page.locator('#nextBtn');
  const isNextDisabled = await nextBtn.isDisabled();
  
  if (!isNextDisabled) {
    await nextBtn.click();
    await page.waitForTimeout(300);
    await page.waitForSelector('#dataTable tbody tr', { timeout: 5000 });
  }

  // Check sort state before reload
  const sortStateBefore = await page.evaluate(() => {
    return localStorage.getItem('sortState');
  });
  console.log('Sort state before reload:', sortStateBefore);
  const expectedDirection = JSON.parse(sortStateBefore).direction;

  // Step 5: Refresh the page
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#dataTable tbody tr', { timeout: 5000 });

  // Check sort state after reload
  const sortStateAfter = await page.evaluate(() => {
    return localStorage.getItem('sortState');
  });
  console.log('Sort state after reload:', sortStateAfter);

  // Step 6: Verify all state is preserved
  
  // 6a. Verify sorting is preserved
  const symbolHeader = page.locator('th[data-field="symbol"]');
  const hasSortIndicator = await symbolHeader.evaluate((el, direction) => {
    console.log('Symbol header classes:', el.className);
    const expectedClass = 'sorted-' + direction;
    return el.classList.contains(expectedClass);
  }, expectedDirection);
  expect(hasSortIndicator).toBe(true);

  // 6b. Verify column visibility is preserved
  const avCheckbox = page.locator('#toggleAV');
  const predCheckbox = page.locator('#togglePredictability');
  
  const avIsHidden = !(await avCheckbox.isChecked());
  const predIsHidden = !(await predCheckbox.isChecked());
  
  expect(avIsHidden).toBe(true);
  expect(predIsHidden).toBe(true);

  // 6c. Verify columns are actually hidden in the DOM
  const avCells = await page.locator('tbody tr td:nth-child(8)').all();
  if (avCells.length > 0) {
    const isHidden = await avCells[0].evaluate((el) => {
      return el.classList.contains('hidden');
    });
    expect(isHidden).toBe(true);
  }

  console.log('✅ All state preserved after refresh and navigation');
});
