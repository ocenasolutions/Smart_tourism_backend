const locationService = require('../services/locationService');

/**
 * Location Autocomplete Controller
 * 
 * Handles location search requests with automatic provider fallback
 */
class LocationController {
  /**
   * Autocomplete endpoint
   * GET /api/locations/autocomplete?q=searchText&type=flight|train|bus|hotel
   */
  async autocomplete(req, res) {
    try {
      const { q: query, type } = req.query;

      // Validation
      if (!query) {
        return res.status(400).json({
          success: false,
          message: 'Query parameter "q" is required',
          results: [],
        });
      }

      if (query.trim().length < 2) {
        return res.status(200).json({
          success: true,
          message: 'Query too short',
          results: [],
          source: 'validation',
        });
      }

      // Validate type if provided
      const validTypes = ['flight', 'train', 'bus', 'hotel'];
      if (type && !validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
          results: [],
        });
      }

      console.log(`[LocationController] Autocomplete request: query="${query}", type="${type || 'all'}"`);

      // Search using service (handles fallback automatically)
      const result = await locationService.search(query, type);

      // Success response
      return res.status(200).json({
        success: true,
        query,
        type: type || null,
        results: result.results,
        count: result.results.length,
        source: result.source,
        cached: result.cached,
      });

    } catch (error) {
      console.error('[LocationController] Error in autocomplete:', error);
      
      // Never expose internal errors to client
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch locations',
        results: [],
      });
    }
  }

  /**
   * Get service statistics
   * GET /api/locations/stats
   */
  async getStats(req, res) {
    try {
      const stats = locationService.getStats();
      
      return res.status(200).json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error('[LocationController] Error getting stats:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch stats',
      });
    }
  }

  /**
   * Health check for location service
   * GET /api/locations/health
   */
  async healthCheck(req, res) {
    try {
      // Test a simple query
      const testResult = await locationService.search('New York');
      
      return res.status(200).json({
        success: true,
        status: 'OK',
        message: 'Location service is operational',
        testQuery: 'New York',
        testResults: testResult.results.length,
        testSource: testResult.source,
      });
    } catch (error) {
      console.error('[LocationController] Health check failed:', error);
      
      return res.status(503).json({
        success: false,
        status: 'ERROR',
        message: 'Location service is not operational',
        error: error.message,
      });
    }
  }
}

module.exports = new LocationController();