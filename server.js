const express = require('express');
const cors = require('cors');
require('dotenv').config();

const queryRoutes = require('./routes/queryRoutes');
const healthRoutes = require('./routes/healthRoutes');
const locationRoutes = require('./routes/locationRoutes');
const { startSelfPing } = require('./utils/selfPing');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', queryRoutes);
app.use('/api', healthRoutes);
app.use('/api/locations', locationRoutes); 

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Location Service: Enabled`);
  
  // Log enabled providers
  console.log('Autocomplete Providers:');
  console.log('  1. Photon (OpenStreetMap) - Always enabled');
  console.log('  2. Nominatim (OpenStreetMap) - Always enabled');
  console.log(`  3. GeoDB Cities - ${process.env.RAPIDAPI_KEY ? 'Enabled' : 'Disabled (no API key)'}`);
  
  // Start self-ping mechanism
  startSelfPing(PORT);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

module.exports = app;