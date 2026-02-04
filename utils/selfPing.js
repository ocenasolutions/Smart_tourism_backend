const http = require('http');
const https = require('https');

let pingInterval = null;

const selfPing = (port) => {
  // Determine if we're in production (using HTTPS) or development (using HTTP)
  const isProduction = process.env.NODE_ENV === 'production';
  const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
  
  const url = `${baseUrl}/api/ping`;
  
  console.log(`[Self-Ping] Pinging ${url}`);

  const protocol = isProduction || baseUrl.startsWith('https') ? https : http;

  const request = protocol.get(url, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      if (res.statusCode === 200) {
        console.log(`[Self-Ping] Success - Server is alive at ${new Date().toISOString()}`);
      } else {
        console.log(`[Self-Ping] Warning - Received status code ${res.statusCode}`);
      }
    });
  });

  request.on('error', (error) => {
    console.error(`[Self-Ping] Error: ${error.message}`);
  });

  request.end();
};

const startSelfPing = (port) => {
  // Clear any existing interval
  if (pingInterval) {
    clearInterval(pingInterval);
  }

  console.log('[Self-Ping] Starting self-ping mechanism (every 5 minutes)');

  // Ping immediately on start
  setTimeout(() => selfPing(port), 10000); // First ping after 10 seconds

  // Then ping every 5 minutes (300000 milliseconds)
  pingInterval = setInterval(() => {
    selfPing(port);
  }, 5 * 60 * 1000);

  return pingInterval;
};

const stopSelfPing = () => {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
    console.log('[Self-Ping] Self-ping mechanism stopped');
  }
};

module.exports = {
  startSelfPing,
  stopSelfPing,
  selfPing,
};