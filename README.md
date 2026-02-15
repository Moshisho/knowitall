# knowitall
A project to highlight best symbols from signals

## Architecture Overview

### Data Flow
The application uses a **dynamic data loading architecture**:

```
Build Time:
  ├─ build-web.js
  │  └─ Generates lightweight HTML (no embedded data)
  └─ Creates index.html with empty table

Runtime:
  ├─ User visits http://localhost:3000
  ├─ Browser loads HTML
  ├─ JavaScript calls /api/get-all-data
  ├─ Server aggregates current data from JSON files
  ├─ Browser receives fresh data and renders table
  └─ When user fetches → data updates on disk → page shows latest
```

**Key Benefits:**
- ✅ Always shows current data (no stale snapshots)
- ✅ No rebuild needed after fetches
- ✅ Data updates reflected immediately
- ✅ Efficient: only aggregates what's needed
- ✅ Lighter HTML file (no embedded data)

### API Endpoints

#### GET `/api/get-all-data`
Returns all aggregated data (predictions + performance)
```
Response: [{
  date, symbol, horizon,
  prediction: { signal, predictability },
  performance: { av: {...}, yh: {...} }
}]
```

#### POST `/api/fetch-yahoo`
Fetches fresh Yahoo Finance data and saves it
```
Request: { symbol, horizon, startDate }
Response: { success, data, fromCache }
```

## Parser
- Node.js parser for IKF Excel files using fixed layout.
- Extracts per-symbol predictions: `date`, `horizon (3d/7d/14d/1m/3m/12m)`, `signal`, `predictability`.
- CLI parses files in `data/`; tests validate specific entries from `unit-test-data/29_Sep_2024.xls`.

## Aggregator
- Combines prediction data from `symbols-predict-ikf.json` with actual performance data from `symbols-data-av.json` and `symbols-data-yh.json`.
- Creates unified array with structure: `{ date, symbol, horizon, prediction: { signal, predictability }, performance: { av: {...}, yh: {...} } }`
- Matches records by date, symbol, and horizon.
- Usage: `npm run aggregate`

## Usage
- Install: `npm install`

### Parser usage
- Parse all files in `data/`: `npm run parse:ikf`
- Parse a single file: `IKF_FILE=unit-test-data/29_Sep_2024.xls npm run parse:ikf`
- Run tests: `npm test`

### Data fetchers

#### Alpha Vantage fetcher
- Fetch actual stock returns: `AV_API_KEY=YOUR_KEY npm run fetch:av SYMBOL START_DATE HORIZON`
  - Example: `npm run fetch:av AAPL 2024-09-29 3m` (AV_API_KEY should be exported)
  - Uses Alpha Vantage free tier (~100 days of data)
  - Supports horizons: 3d, 7d, 14d, 1m, 3m, 12m
  - Saves to `data/symbols-data-av.json` for comparison with IKF predictions

#### Yahoo Finance fetcher
- **CLI Usage**: `npm run fetch:yahoo SYMBOL PERIOD START_DATE`
  - Example: `npm run fetch:yahoo AAPL 3M 2024-09-01` (monthly data)
  - Example: `npm run fetch:yahoo TSLA 3d 2024-10-31` (daily data)
  - Example: `npm run fetch:yahoo MSTR 7d 10-2024` (daily data)
  - Uses Puppeteer to scrape Yahoo Finance historical data
  - **Supports periods**: 3d, 7d, 14d (daily data), 1M, 3M, 12M (monthly data)
  - **Date format**: YYYY-MM-DD or MM-YYYY
  - **Price methodology**: Open price for start date, Close price for end date
  - Saves to `data/symbols-data-yh.json` for comparison with IKF predictions
  - Checks for existing data before attempting to fetch

- **HTTP API Usage**: 
  - Start server: `npm run serve:web` (browser session starts automatically)
  - API endpoint: `POST http://localhost:3000/api/fetch-yahoo`
  - Request body: `{"symbol": "AAPL", "horizon": "3d", "startDate": "2024-10-31"}`
  - Returns JSON with success status and data
  - Uses persistent browser session for efficiency
  - Test API: `npm run test:yahoo-api`

- **Horizon Logic**:
  - **Short horizons** (3d, 7d, 14d): Uses specific date range URLs for daily data
  - **Long horizons** (1M, 3M, 12M): Uses 5-year historical range for monthly data

**Note**: Both fetchers check for existing data before attempting to fetch to avoid duplicates.

## Web UI

### Features
- **Dynamic data loading**: Data loads from server on page load
- **Live search & filter**: By symbol, horizon, and date
- **Sortable columns**: Click headers to sort
- **Pagination**: Navigate through results (50 per page)
- **Column visibility controls**: Toggle visibility of:
  - **Predictability**: IKF prediction reliability score
  - **S&P**: S&P 500 performance for comparison (hidden by default)
  - **AV Data**: Alpha Vantage performance metrics
  - **YH Prices**: Yahoo Finance open/close prices

### S&P 500 Special Feature
- When viewing a symbol's data, the S&P column shows S&P 500's performance for the same horizon and date
- Useful for comparing individual stock performance against market baseline
- Matches by: same date, same horizon, same performance source (Yahoo Finance)

### Persistence
- **Column visibility**: Saved to localStorage, persists across page reloads
- **Sort state**: Saved to localStorage, persists across page reloads

### Running the Web Server
```bash
npm start                 # Builds and starts server
npm run serve:web        # Start server without build
npm run build:web        # Build HTML only
```

Open `http://localhost:3000` in your browser.

## Symbol Mapping

### S&P 500 Special Handling
The symbol `^S&P500` is mapped to `^GSPC` when fetching from Yahoo Finance:
- Displayed to users as: `^S&P500` (user-friendly)
- Fetched from Yahoo as: `^GSPC` (technical symbol)
- Mapping happens automatically in fetchers

Files involved:
- `scripts/yahoo_fetcher.js`: `normalizeSymbol()` function
- `scripts/av_fetcher.js`: `normalizeSymbol()` function
