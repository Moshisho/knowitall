// Quick test script for the Yahoo fetcher API
import http from 'http';

function makeRequest(symbol, horizon, startDate) {
  const data = JSON.stringify({
    symbol: symbol,
    horizon: horizon,
    startDate: startDate
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/fetch-yahoo',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  console.log(`Testing: ${symbol} ${horizon} ${startDate}`);
  
  const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Headers:`, res.headers);

    let responseData = '';
    res.on('data', (chunk) => {
      responseData += chunk;
    });

    res.on('end', () => {
      try {
        const result = JSON.parse(responseData);
        console.log('Response:', JSON.stringify(result, null, 2));
      } catch (error) {
        console.log('Raw response:', responseData);
      }
    });
  });

  req.on('error', (error) => {
    console.error('Request error:', error.message);
  });

  req.write(data);
  req.end();
}

// Test short horizon (daily data)
makeRequest('AAPL', '3d', '2024-10-31');

// Wait a moment then test long horizon (monthly data)
setTimeout(() => {
  makeRequest('TSLA', '3M', '2024-09-01');
}, 2000);