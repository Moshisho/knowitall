# knowitall
A project to highlight best symbols from signals

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
- Fetch monthly stock returns: `npm run fetch:yahoo SYMBOL PERIOD START_MONTH`
  - Example: `npm run fetch:yahoo AAPL 1M 09-2024`
  - Uses Puppeteer to scrape Yahoo Finance monthly historical data
  - Supports periods: 1M, 3M, 12M
  - Date format: YYYY-MM-DD or MM-YYYY
  - Saves to `data/symbols-data-yh.json` for comparison with IKF predictions
  - Both fetchers check for existing data before attempting to fetch
