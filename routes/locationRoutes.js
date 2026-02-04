const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const RateLimiter = require('../middleware/rateLimiter');

// Create rate limiter for location endpoints
// More lenient than general API (autocomplete needs frequent requests)
const locationRateLimiter = new RateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 30, // 30 requests per minute per IP
});

/**
 * Location Autocomplete Routes
 */

// GET /api/locations/autocomplete?q=searchText&type=flight
router.get(
  '/autocomplete',
  locationRateLimiter.middleware(),
  (req, res) => locationController.autocomplete(req, res)
);

// GET /api/locations/stats - Get service statistics
router.get('/stats', (req, res) => locationController.getStats(req, res));

// GET /api/locations/health - Health check
router.get('/health', (req, res) => locationController.healthCheck(req, res));

module.exports = router;