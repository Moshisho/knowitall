# knowitall
A project to highlight best symbols from signals

## Parser
- Node.js parser for IKF Excel files using fixed layout.
- Extracts per-symbol predictions: `date`, `horizon (3d/7d/14d/1m/3m/12m)`, `signal`, `predictability`.
- CLI parses files in `data/`; tests validate specific entries from `unit-test-data/29_Sep_2024.xls`.

## Usage
- Install: `npm install`

### Parser usage
- Parse all files in `data/`: `npm run parse:ikf`
- Parse a single file: `IKF_FILE=unit-test-data/29_Sep_2024.xls npm run parse:ikf`
- Run tests: `npm test`
