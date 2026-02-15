// Build script: generates static HTML with embedded aggregated data

import fs from 'fs';
import path from 'path';
import { aggregateSymbolData } from './aggregator.js';

const OUTPUT_PATH = path.resolve('clients/web/index.html');

function generateHTML(data) {
  const jsonData = JSON.stringify(data, null, 2);
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Symbol Analysis - Predictions vs Performance</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      padding: 20px;
    }
    
    h1 {
      color: #333;
      margin-bottom: 10px;
      font-size: 28px;
    }
    
    .subtitle {
      color: #666;
      margin-bottom: 20px;
      font-size: 14px;
    }
    
    .stats {
      display: flex;
      gap: 20px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    
    .stat-card {
      background: #f9f9f9;
      border-left: 4px solid #2196F3;
      padding: 15px 20px;
      border-radius: 4px;
    }
    
    .stat-label {
      font-size: 12px;
      color: #999;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #333;
      margin-top: 5px;
    }
    
    .controls {
      display: flex;
      gap: 20px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    
    .control-group {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    
    .control-group label {
      font-weight: 500;
      color: #333;
      font-size: 12px;
      text-transform: uppercase;
    }
    
    .control-group input,
    .control-group select {
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }
    
    .table-wrapper {
      margin-top: 20px;
      overflow-x: auto;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
    }
    
    table thead {
      background: #f9f9f9;
      border-bottom: 2px solid #ddd;
      position: sticky;
      top: 0;
    }
    
    table th {
      padding: 12px 8px;
      text-align: left;
      font-weight: 600;
      color: #333;
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
    }
    
    table th:hover {
      background: #f0f0f0;
    }
    
    table th.sortable::after {
      content: ' ⇅';
      opacity: 0.5;
    }
    
    table th.sorted-asc::after {
      content: ' ↑';
      opacity: 1;
      color: #2196F3;
    }
    
    table th.sorted-desc::after {
      content: ' ↓';
      opacity: 1;
      color: #2196F3;
    }
    
    table td {
      padding: 10px 8px;
      border-bottom: 1px solid #eee;
      font-size: 13px;
    }
    
    table tbody tr:hover {
      background: #f9f9f9;
    }
    
    .number {
      text-align: right;
      font-family: 'Courier New', monospace;
    }
    
    .positive {
      color: #27ae60;
      font-weight: 500;
    }
    
    .negative {
      color: #e74c3c;
      font-weight: 500;
    }
    
    .neutral {
      color: #666;
    }
    
    .pagination {
      display: flex;
      gap: 10px;
      margin-top: 20px;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
    }
    
    .pagination button {
      padding: 6px 12px;
      border: 1px solid #ddd;
      background: white;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }
    
    .pagination button:hover {
      background: #f0f0f0;
    }
    
    .pagination button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .page-info {
      font-size: 13px;
      color: #666;
    }
    
    .fetch-btn {
      background: #f0f0f0;
      border: 1px dashed #2196F3;
      color: #2196F3;
      padding: 4px 8px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      transition: all 0.2s;
    }
    
     .fetch-btn:hover {
       background: #e3f2fd;
       border-style: solid;
     }
     
     .checkbox-group {
       display: flex;
       gap: 15px;
       flex-wrap: wrap;
       align-items: center;
     }
     
     .checkbox-label {
       display: flex;
       align-items: center;
       gap: 6px;
       cursor: pointer;
       font-size: 14px;
       font-weight: normal;
       color: #333;
       text-transform: none;
     }
     
     .checkbox-label input[type="checkbox"] {
       cursor: pointer;
       width: 16px;
       height: 16px;
       margin: 0;
     }
     
     th.hidden,
     td.hidden {
       display: none;
     }
   </style>
</head>
<body>
  <div class="container">
    <h1>📊 Symbol Analysis</h1>
    <p class="subtitle">Compare IKF predictions with actual performance data from Alpha Vantage and Yahoo Finance</p>
    
    <div class="stats">
      <div class="stat-card">
        <div class="stat-label">Total Records</div>
        <div class="stat-value" id="totalRecords">0</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Unique Symbols</div>
        <div class="stat-value" id="uniqueSymbols">0</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">With AV Data</div>
        <div class="stat-value" id="withAV">0</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">With YH Data</div>
        <div class="stat-value" id="withYH">0</div>
      </div>
    </div>
    
     <div class="controls">
       <div class="control-group">
         <label>Symbol</label>
         <input type="text" id="filterSymbol" placeholder="Filter...">
       </div>
       <div class="control-group">
         <label>Horizon</label>
         <select id="filterHorizon">
           <option value="">All</option>
           <option value="3d">3d</option>
           <option value="7d">7d</option>
           <option value="14d">14d</option>
           <option value="1m">1m</option>
           <option value="3m">3m</option>
           <option value="12m">12m</option>
         </select>
       </div>
       <div class="control-group">
         <label>Date</label>
         <input type="text" id="filterDate" placeholder="YYYY-MM-DD">
       </div>
        <div class="control-group">
          <label>Column Visibility</label>
          <div class="checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" id="togglePredictability" checked> Predictability
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="toggleSP"> S&P
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="toggleAV" checked> AV Data
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="toggleYHPrices" checked> YH Prices
            </label>
          </div>
        </div>
     </div>
    
    <div class="table-wrapper">
      <table id="dataTable">
         <thead>
           <tr>
             <th class="sortable" data-field="date">Date</th>
             <th class="sortable" data-field="symbol">Symbol</th>
             <th class="sortable" data-field="horizon">Horizon</th>
             <th class="sortable" data-field="signal">Signal</th>
             <th class="sortable" data-field="predictability">Predictability</th>
             <th class="sortable" data-field="yh-change-pct">YH Change %</th>
             <th class="sortable" data-field="yh-change-abs">YH Change \$</th>
             <th class="sortable" data-field="sp-change-pct">S&P</th>
             <th class="sortable" data-field="av-change-pct">AV Change %</th>
             <th class="sortable" data-field="av-change-abs">AV Change \$</th>
             <th class="sortable" data-field="yh-open">YH Open</th>
             <th class="sortable" data-field="yh-close">YH Close</th>
           </tr>
         </thead>
        <tbody id="tableBody">
        </tbody>
      </table>
    </div>
    
    <div class="pagination">
      <button id="prevBtn" onclick="prevPage()">← Previous</button>
      <span class="page-info"><span id="pageNum">1</span> of <span id="totalPages">1</span></span>
      <button id="nextBtn" onclick="nextPage()">Next →</button>
    </div>
  </div>

  <script>
    const rawData = ${jsonData};
    
    let currentPage = 1;
    const pageSize = 50;
    let sortField = 'symbol';
    let sortDir = 'asc';
    let filteredData = [...rawData];
    
    // Calculate stats
    const uniqueSymbols = new Set(rawData.map(d => d.symbol)).size;
    const withAV = rawData.filter(d => d.performance.av !== null).length;
    const withYH = rawData.filter(d => d.performance.yh !== null).length;
    
     document.getElementById('totalRecords').textContent = rawData.length;
     document.getElementById('uniqueSymbols').textContent = uniqueSymbols;
     document.getElementById('withAV').textContent = withAV;
     document.getElementById('withYH').textContent = withYH;
     
      // Column configuration and visibility
      const columnConfig = {
        predictability: {
          name: 'predictability',
          checkboxId: 'togglePredictability',
          headerSelector: 'th[data-field="predictability"]',
          cellSelector: 'td:nth-child(5)',
          defaultVisible: true,
          visible: true
        },
        sp: {
          name: 'sp',
          checkboxId: 'toggleSP',
          headerSelector: 'th[data-field="sp-change-pct"]',
          cellSelector: 'td:nth-child(8)',
          defaultVisible: false,
          visible: false
        },
        av: {
          name: 'av',
          checkboxId: 'toggleAV',
          headerSelector: 'th[data-field="av-change-pct"], th[data-field="av-change-abs"]',
          cellSelector: 'td:nth-child(9), td:nth-child(10)',
          defaultVisible: true,
          visible: true
        },
        yh_prices: {
          name: 'yh_prices',
          checkboxId: 'toggleYHPrices',
          headerSelector: 'th[data-field="yh-open"], th[data-field="yh-close"]',
          cellSelector: 'td:nth-child(11), td:nth-child(12)',
          defaultVisible: true,
          visible: true
        }
      };
     
     // Column visibility functions
     function saveColumnVisibility() {
       const visibility = {};
       Object.keys(columnConfig).forEach(key => {
         visibility[key] = columnConfig[key].visible;
       });
       localStorage.setItem('columnVisibility', JSON.stringify(visibility));
     }
     
     function loadColumnVisibility() {
       const saved = localStorage.getItem('columnVisibility');
       if (saved) {
         const visibility = JSON.parse(saved);
         Object.keys(visibility).forEach(key => {
           if (columnConfig[key]) {
             columnConfig[key].visible = visibility[key];
           }
         });
       }
     }
     
     function applyColumnVisibility() {
       const table = document.getElementById('dataTable');
       Object.keys(columnConfig).forEach(key => {
         const config = columnConfig[key];
         const headers = table.querySelectorAll(config.headerSelector);
         const cells = table.querySelectorAll(config.cellSelector);
         
         if (config.visible) {
           headers.forEach(h => h.classList.remove('hidden'));
           cells.forEach(c => c.classList.remove('hidden'));
         } else {
           headers.forEach(h => h.classList.add('hidden'));
           cells.forEach(c => c.classList.add('hidden'));
         }
       });
     }
     
     function toggleColumnVisibility(columnName) {
       if (columnConfig[columnName]) {
         columnConfig[columnName].visible = !columnConfig[columnName].visible;
         applyColumnVisibility();
         saveColumnVisibility();
         
         // Update checkbox state
         const checkbox = document.getElementById(columnConfig[columnName].checkboxId);
         if (checkbox) {
           checkbox.checked = columnConfig[columnName].visible;
         }
       }
     }
     
     function initializeColumnVisibility() {
       loadColumnVisibility();
       applyColumnVisibility();
       
       // Set checkbox states
       Object.keys(columnConfig).forEach(key => {
         const config = columnConfig[key];
         const checkbox = document.getElementById(config.checkboxId);
         if (checkbox) {
           checkbox.checked = config.visible;
         }
       });
     }
     
     // Sort state persistence
     function saveSortState() {
       localStorage.setItem('sortState', JSON.stringify({
         field: sortField,
         direction: sortDir
       }));
     }
     
      function applySortToData(field) {
        filteredData.sort((a, b) => {
          let aVal, bVal;
          
          if (field === 'date') { aVal = a.date; bVal = b.date; }
          else if (field === 'symbol') { aVal = a.symbol; bVal = b.symbol; }
          else if (field === 'horizon') { aVal = a.horizon; bVal = b.horizon; }
          else if (field === 'signal') { aVal = a.prediction.signal; bVal = b.prediction.signal; }
          else if (field === 'predictability') { aVal = a.prediction.predictability; bVal = b.prediction.predictability; }
          else if (field === 'av-change-pct') { aVal = a.performance.av ? a.performance.av['change-percentage'] : -999; bVal = b.performance.av ? b.performance.av['change-percentage'] : -999; }
          else if (field === 'av-change-abs') { aVal = a.performance.av ? a.performance.av['change-abs'] : -999; bVal = b.performance.av ? b.performance.av['change-abs'] : -999; }
          else if (field === 'yh-change-pct') { aVal = a.performance.yh ? a.performance.yh['change-percentage'] : -999; bVal = b.performance.yh ? b.performance.yh['change-percentage'] : -999; }
          else if (field === 'yh-change-abs') { aVal = a.performance.yh ? a.performance.yh['change-abs'] : -999; bVal = b.performance.yh ? b.performance.yh['change-abs'] : -999; }
          else if (field === 'yh-open') { aVal = a.performance.yh ? a.performance.yh['open-price'] : -999; bVal = b.performance.yh ? b.performance.yh['open-price'] : -999; }
          else if (field === 'yh-close') { aVal = a.performance.yh ? a.performance.yh['close-price'] : -999; bVal = b.performance.yh ? b.performance.yh['close-price'] : -999; }
          
          if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
          if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
          return 0;
        });
      }
      
      function loadSortState() {
        const saved = localStorage.getItem('sortState');
        if (saved) {
          const state = JSON.parse(saved);
          sortField = state.field;
          sortDir = state.direction;
          applySortToData(sortField);
        }
      }
      
      function initializeSortState() {
        loadSortState();
        updateSortIndicators();
      }
     
    // Format value
    function formatValue(val) {
      if (val === null || val === undefined) return '-';
      return typeof val === 'number' ? val.toFixed(2) : val;
    }
    
    // Generate fetch command
    function generateFetchCommand(row, dataSource) {
      const symbol = row.symbol;
      const date = row.date; // YYYY-MM-DD
      const horizon = row.horizon;
      
      if (dataSource === 'av') {
        return \`npm run fetch:av \${symbol} \${date} \${horizon}\`;
      } else if (dataSource === 'yh') {
        // Convert horizon to period: 1m->1M, 3m->3M, 12m->12M
        const period = horizon === '1m' ? '1M' : horizon === '3m' ? '3M' : horizon === '12m' ? '12M' : horizon.toUpperCase();
        // Convert date YYYY-MM-DD to MM-YYYY
        const [year, month] = date.split('-');
        const startMonth = \`\${month}-\${year}\`;
        return \`npm run fetch:yahoo \${symbol} \${period} \${startMonth}\`;
      }
    }
    
    // Copy to clipboard
    function copyToClipboard(text, button) {
      navigator.clipboard.writeText(text).then(() => {
        const originalText = button.innerHTML;
        button.innerHTML = '✓ Copied!';
        button.style.background = '#27ae60';
        button.style.color = 'white';
        setTimeout(() => {
          button.innerHTML = originalText;
          button.style.background = '';
          button.style.color = '';
        }, 2000);
      }).catch(err => {
        console.error('Copy failed:', err);
        alert('Copy failed: ' + err);
      });
    }

    // Fetch Yahoo data via API
    async function fetchYahooData(symbol, horizon, startDate, button) {
      const originalText = button.innerHTML;
      button.innerHTML = '⏳ Fetching...';
      button.disabled = true;
      
      try {
        const response = await fetch('/api/fetch-yahoo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            symbol: symbol,
            horizon: horizon,
            startDate: startDate
          })
        });

        if (!response.ok) {
          throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
        }

        const result = await response.json();
        
        if (result.success) {
          button.innerHTML = '✅ Success';
          button.style.background = '#27ae60';
          button.style.color = 'white';
          
          // Update the data in memory and re-render
          updateRowData(symbol, horizon, startDate, result.data, result.fromCache);
          
          setTimeout(() => {
            button.innerHTML = originalText;
            button.style.background = '';
            button.style.color = '';
            button.disabled = false;
          }, 2000);
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (error) {
        console.error('Fetch failed:', error);
        button.innerHTML = '❌ Error';
        button.style.background = '#e74c3c';
        button.style.color = 'white';
        alert('Fetch failed: ' + error.message);
        
        setTimeout(() => {
          button.innerHTML = originalText;
          button.style.background = '';
          button.style.color = '';
          button.disabled = false;
        }, 3000);
      }
    }

     // Update row data after successful fetch
     function updateRowData(symbol, horizon, startDate, newData, fromCache) {
       // Find the row in rawData that matches
       const rowIndex = rawData.findIndex(row => 
         row.symbol === symbol && 
         row.horizon === horizon && 
         row.date === startDate
       );
       
       if (rowIndex !== -1) {
         // Update the performance data
         rawData[rowIndex].performance.yh = {
           'open-price': newData['open-price'],
           'close-price': newData['close-price'],
           'change-abs': newData['change-abs'],
           'change-percentage': newData['change-percentage']
         };
         
         // Refresh table without resetting pagination
         refreshTable();
         
         // Re-apply column visibility after rendering new table
         applyColumnVisibility();
         
         console.log(\`Updated \${symbol} \${horizon} \${startDate} with Yahoo data\${fromCache ? ' (from cache)' : ''}\`);
       }
     }
    
    // Make functions globally available
    window.copyToClipboard = copyToClipboard;
    window.fetchYahooData = fetchYahooData;
    
    // Format with color or fetch button
    function formatWithColor(val, isPercent = false, row = null, dataSource = null) {
      if (val === null || val === undefined) {
        if (row && dataSource) {
          if (dataSource === 'yh') {
            // Yahoo fetcher: use API call
            return \`<button class="fetch-btn" onclick="fetchYahooData('\${row.symbol}', '\${row.horizon}', '\${row.date}', this)" title="Fetch Yahoo Finance data via API">🚀 Fetch</button>\`;
          } else {
            // AV fetcher: copy command to clipboard
            const cmd = generateFetchCommand(row, dataSource);
            return \`<button class="fetch-btn" onclick="copyToClipboard('\${cmd}', this)" title="Copy fetch command to clipboard">📋 Fetch</button>\`;
          }
        }
        return '-';
      }
      const num = typeof val === 'number' ? val : parseFloat(val);
      if (isNaN(num)) return val;
      const formatted = num.toFixed(2);
      const className = num > 0 ? 'positive' : num < 0 ? 'negative' : 'neutral';
      const suffix = isPercent ? '%' : '';
      return '<span class="' + className + '">' + formatted + suffix + '</span>';
    }
    
     // Build table
      function renderTable() {
        const tbody = document.getElementById('tableBody');
        tbody.innerHTML = '';
        
        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        const pageData = filteredData.slice(start, end);
        
        pageData.forEach(row => {
          const tr = document.createElement('tr');
          
          // Find S&P data matching the same horizon and date
          const spData = rawData.find(d => 
            d.symbol === '^S&P500' && 
            d.horizon === row.horizon && 
            d.date === row.date &&
            d.performance.yh
          );
          const spChangeValue = spData ? spData.performance.yh['change-percentage'] : null;
          
          tr.innerHTML = \`
            <td>\${row.date}</td>
            <td>\${row.symbol}</td>
            <td>\${row.horizon}</td>
            <td class="number">\${formatWithColor(row.prediction.signal)}</td>
            <td class="number">\${formatValue(row.prediction.predictability)}</td>
            <td class="number">\${formatWithColor(row.performance.yh ? row.performance.yh['change-percentage'] : null, true, row, 'yh')}</td>
            <td class="number">\${formatWithColor(row.performance.yh ? row.performance.yh['change-abs'] : null, false, row, 'yh')}</td>
            <td class="number">\${formatWithColor(spChangeValue, true)}</td>
            <td class="number">\${formatWithColor(row.performance.av ? row.performance.av['change-percentage'] : null, true, row, 'av')}</td>
            <td class="number">\${formatWithColor(row.performance.av ? row.performance.av['change-abs'] : null, false, row, 'av')}</td>
            <td class="number">\${formatValue(row.performance.yh ? row.performance.yh['open-price'] : null)}</td>
            <td class="number">\${formatValue(row.performance.yh ? row.performance.yh['close-price'] : null)}</td>
          \`;
          tbody.appendChild(tr);
        });
        
        updatePagination();
        applyColumnVisibility();
      }
    
    // Filter data
    function applyFilters() {
      const symbol = document.getElementById('filterSymbol').value.toUpperCase();
      const horizon = document.getElementById('filterHorizon').value;
      const date = document.getElementById('filterDate').value;
      
      filteredData = rawData.filter(row => {
        if (symbol && !row.symbol.includes(symbol)) return false;
        if (horizon && row.horizon !== horizon) return false;
        if (date && row.date !== date) return false;
        return true;
      });
      
      currentPage = 1;
      renderTable();
    }
    
    // Refresh table without resetting filters or pagination
    function refreshTable() {
      renderTable();
    }
    
     // Sort
      function sortData(field) {
        if (sortField === field) {
          sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          sortField = field;
          sortDir = 'asc';
        }
        
        saveSortState();
        applySortToData(field);
        
        currentPage = 1;
        updateSortIndicators();
        renderTable();
      }
    
    // Update sort indicators
    function updateSortIndicators() {
      document.querySelectorAll('th.sortable').forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
        if (th.dataset.field === sortField) {
          th.classList.add(sortDir === 'asc' ? 'sorted-asc' : 'sorted-desc');
        }
      });
    }
    
    // Pagination
    function updatePagination() {
      const totalPages = Math.ceil(filteredData.length / pageSize);
      document.getElementById('totalPages').textContent = totalPages;
      document.getElementById('pageNum').textContent = currentPage;
      document.getElementById('prevBtn').disabled = currentPage === 1;
      document.getElementById('nextBtn').disabled = currentPage === totalPages;
    }
    
    function prevPage() {
      if (currentPage > 1) {
        currentPage--;
        renderTable();
      }
    }
    
    function nextPage() {
      const totalPages = Math.ceil(filteredData.length / pageSize);
      if (currentPage < totalPages) {
        currentPage++;
        renderTable();
      }
    }
    
     // Event listeners
     document.getElementById('filterSymbol').addEventListener('input', applyFilters);
     document.getElementById('filterHorizon').addEventListener('change', applyFilters);
     document.getElementById('filterDate').addEventListener('input', applyFilters);
     
     document.querySelectorAll('th.sortable').forEach(th => {
       th.addEventListener('click', () => sortData(th.dataset.field));
     });
     
      // Column visibility event listeners
      document.getElementById('togglePredictability').addEventListener('change', () => {
        toggleColumnVisibility('predictability');
      });
      
      document.getElementById('toggleSP').addEventListener('change', () => {
        toggleColumnVisibility('sp');
      });
      
      document.getElementById('toggleAV').addEventListener('change', () => {
        toggleColumnVisibility('av');
      });
      
      document.getElementById('toggleYHPrices').addEventListener('change', () => {
        toggleColumnVisibility('yh_prices');
      });
     
     // Initial render
     initializeColumnVisibility();
     initializeSortState();
     renderTable();
     applyColumnVisibility();
   </script>
</body>
</html>`;
}

function main() {
  console.log('Generating HTML with aggregated data...');
  
  const data = aggregateSymbolData();
  const html = generateHTML(data);
  
  fs.writeFileSync(OUTPUT_PATH, html, 'utf8');
  console.log(`✓ Generated ${OUTPUT_PATH} with ${data.length} records`);
}

main();
