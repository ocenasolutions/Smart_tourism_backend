const axios = require('axios');

/**
 * Production-ready Location Autocomplete Service
 * 
 * Provider hierarchy (strict order):
 * 1. Photon (OpenStreetMap-based, no API key, fastest)
 * 2. Nominatim (OpenStreetMap, requires User-Agent)
 * 3. GeoDB Cities (RapidAPI free tier, API key required)
 * 
 * Features:
 * - Automatic fallback on failure
 * - In-memory caching to reduce API calls
 * - Rate limit compliance
 * - Consistent response format
 * - Zero billing risk
 */

class LocationService {
  constructor() {
    // Cache configuration
    this.cache = new Map();
    this.cacheMaxSize = 500;
    this.cacheTTL = 3600000; // 1 hour in milliseconds
    
    // Provider configurations
    this.providers = {
      photon: {
        name: 'Photon',
        baseUrl: 'https://photon.komoot.io/api/',
        enabled: true,
        timeout: 5000,
        rateLimit: { requests: 60, window: 60000 }, // 60 requests per minute
      },
      nominatim: {
        name: 'Nominatim',
        baseUrl: 'https://nominatim.openstreetmap.org/search',
        enabled: true,
        timeout: 5000,
        rateLimit: { requests: 1, window: 1000 }, // 1 request per second
        headers: {
          'User-Agent': 'TravelBookingApp/1.0 (contact@yourdomain.com)', // REQUIRED by Nominatim
        },
      },
      geodb: {
        name: 'GeoDB',
        baseUrl: 'https://wft-geo-db.p.rapidapi.com/v1/geo/cities',
        enabled: !!process.env.RAPIDAPI_KEY,
        timeout: 5000,
        rateLimit: { requests: 1, window: 1000 }, // Free tier: 1 req/sec
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY || '',
          'X-RapidAPI-Host': 'wft-geo-db.p.rapidapi.com',
        },
      },
    };
    
    // Rate limiting trackers
    this.rateLimitTrackers = {
      photon: [],
      nominatim: [],
      geodb: [],
    };
    
    // Statistics
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      providerUsage: {
        photon: 0,
        nominatim: 0,
        geodb: 0,
      },
      providerFailures: {
        photon: 0,
        nominatim: 0,
        geodb: 0,
      },
    };
    
    // Start cache cleanup interval
    this.startCacheCleanup();
  }

  /**
   * Main search method - tries providers in order until success
   */
  async search(query, type = null) {
    this.stats.totalRequests++;
    
    // Input validation
    if (!query || query.trim().length < 2) {
      return {
        success: true,
        results: [],
        source: 'validation',
        cached: false,
      };
    }
    
    const searchQuery = query.trim();
    const cacheKey = this.getCacheKey(searchQuery, type);
    
    // Check cache first
    const cachedResult = this.getFromCache(cacheKey);
    if (cachedResult) {
      this.stats.cacheHits++;
      return {
        success: true,
        results: cachedResult,
        source: 'cache',
        cached: true,
      };
    }
    
    this.stats.cacheMisses++;
    
    // Try providers in order: Photon → Nominatim → GeoDB
    const providers = ['photon', 'nominatim', 'geodb'];
    
    for (const providerKey of providers) {
      if (!this.providers[providerKey].enabled) {
        console.log(`[LocationService] ${this.providers[providerKey].name} is disabled, skipping`);
        continue;
      }
      
      // Check rate limit
      if (!this.checkRateLimit(providerKey)) {
        console.log(`[LocationService] ${this.providers[providerKey].name} rate limit exceeded, skipping`);
        continue;
      }
      
      try {
        console.log(`[LocationService] Trying ${this.providers[providerKey].name} for query: "${searchQuery}"`);
        
        const results = await this.queryProvider(providerKey, searchQuery, type);
        
        if (results && results.length > 0) {
          // Success! Cache and return
          this.stats.providerUsage[providerKey]++;
          this.saveToCache(cacheKey, results);
          
          console.log(`[LocationService] ✓ ${this.providers[providerKey].name} returned ${results.length} results`);
          
          return {
            success: true,
            results,
            source: this.providers[providerKey].name,
            cached: false,
          };
        }
        
        console.log(`[LocationService] ${this.providers[providerKey].name} returned no results, trying next provider`);
        
      } catch (error) {
        this.stats.providerFailures[providerKey]++;
        console.error(`[LocationService] ${this.providers[providerKey].name} error:`, error.message);
        // Continue to next provider
      }
    }
    
    // All providers failed or returned no results
    console.log(`[LocationService] All providers exhausted for query: "${searchQuery}"`);
    return {
      success: true,
      results: [],
      source: 'none',
      cached: false,
    };
  }

  /**
   * Query specific provider
   */
  async queryProvider(providerKey, query, type) {
    switch (providerKey) {
      case 'photon':
        return await this.queryPhoton(query, type);
      case 'nominatim':
        return await this.queryNominatim(query, type);
      case 'geodb':
        return await this.queryGeoDB(query, type);
      default:
        throw new Error(`Unknown provider: ${providerKey}`);
    }
  }

  /**
   * Photon (OpenStreetMap) - Primary provider
   */
  async queryPhoton(query, type) {
    const config = this.providers.photon;
    const params = {
      q: query,
      limit: 10,
      lang: 'en',
    };
    
    // Filter by location type if needed
    if (type === 'hotel') {
      params.osm_tag = 'place:city,place:town,place:village';
    }
    
    const response = await axios.get(config.baseUrl, {
      params,
      timeout: config.timeout,
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.data || !response.data.features) {
      return [];
    }
    
    return response.data.features.map(feature => {
      const props = feature.properties;
      const coords = feature.geometry?.coordinates || [];
      
      return {
        name: props.name || '',
        city: props.city || props.name || '',
        state: props.state || '',
        country: props.country || '',
        displayName: this.formatDisplayName(
          props.name,
          props.city,
          props.state,
          props.country
        ),
        latitude: coords[1] || null,
        longitude: coords[0] || null,
        type: props.osm_value || 'city',
      };
    }).filter(location => location.name); // Filter out empty results
  }

  /**
   * Nominatim (OpenStreetMap) - Secondary provider
   */
  async queryNominatim(query, type) {
    const config = this.providers.nominatim;
    const params = {
      q: query,
      format: 'json',
      limit: 10,
      addressdetails: 1,
      'accept-language': 'en',
    };
    
    // Filter by feature type
    if (type === 'hotel') {
      params.featuretype = 'city';
    }
    
    const response = await axios.get(config.baseUrl, {
      params,
      timeout: config.timeout,
      headers: config.headers,
    });
    
    if (!response.data || !Array.isArray(response.data)) {
      return [];
    }
    
    return response.data.map(item => {
      const addr = item.address || {};
      
      return {
        name: addr.city || addr.town || addr.village || item.name || '',
        city: addr.city || addr.town || addr.village || '',
        state: addr.state || '',
        country: addr.country || '',
        displayName: this.formatDisplayName(
          addr.city || addr.town || addr.village,
          null,
          addr.state,
          addr.country
        ),
        latitude: parseFloat(item.lat) || null,
        longitude: parseFloat(item.lon) || null,
        type: item.type || 'city',
      };
    }).filter(location => location.name);
  }

  /**
   * GeoDB Cities (RapidAPI) - Tertiary provider
   */
  async queryGeoDB(query, type) {
    const config = this.providers.geodb;
    
    if (!config.headers['X-RapidAPI-Key']) {
      throw new Error('GeoDB API key not configured');
    }
    
    const params = {
      namePrefix: query,
      limit: 10,
      sort: '-population',
      types: 'CITY',
      languageCode: 'en',
    };
    
    const response = await axios.get(config.baseUrl, {
      params,
      timeout: config.timeout,
      headers: config.headers,
    });
    
    if (!response.data || !response.data.data || !Array.isArray(response.data.data)) {
      return [];
    }
    
    return response.data.data.map(item => ({
      name: item.city || item.name || '',
      city: item.city || item.name || '',
      state: item.region || '',
      country: item.country || '',
      displayName: this.formatDisplayName(
        item.city || item.name,
        null,
        item.region,
        item.country
      ),
      latitude: item.latitude || null,
      longitude: item.longitude || null,
      type: 'city',
    })).filter(location => location.name);
  }

  /**
   * Format display name consistently
   */
  formatDisplayName(name, city, state, country) {
    const parts = [];
    
    if (name) parts.push(name);
    else if (city) parts.push(city);
    
    if (state) parts.push(state);
    if (country) parts.push(country);
    
    return parts.join(', ');
  }

  /**
   * Cache management
   */
  getCacheKey(query, type) {
    return `${query.toLowerCase()}_${type || 'default'}`;
  }

  getFromCache(key) {
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    // Check if expired
    if (Date.now() - cached.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  saveToCache(key, data) {
    // Implement LRU: remove oldest if cache is full
    if (this.cache.size >= this.cacheMaxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  startCacheCleanup() {
    // Clean expired entries every 10 minutes
    this.cleanupInterval = setInterval(() => {
      let removed = 0;
      const now = Date.now();
      
      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > this.cacheTTL) {
          this.cache.delete(key);
          removed++;
        }
      }
      
      if (removed > 0) {
        console.log(`[LocationService] Cache cleanup: removed ${removed} expired entries`);
      }
    }, 600000); // 10 minutes
  }

  /**
   * Rate limiting
   */
  checkRateLimit(providerKey) {
    const config = this.providers[providerKey];
    const tracker = this.rateLimitTrackers[providerKey];
    const now = Date.now();
    
    // Remove old requests outside the window
    const windowStart = now - config.rateLimit.window;
    this.rateLimitTrackers[providerKey] = tracker.filter(t => t > windowStart);
    
    // Check if limit exceeded
    if (this.rateLimitTrackers[providerKey].length >= config.rateLimit.requests) {
      return false;
    }
    
    // Add current request
    this.rateLimitTrackers[providerKey].push(now);
    return true;
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      cacheHitRate: this.stats.totalRequests > 0 
        ? ((this.stats.cacheHits / this.stats.totalRequests) * 100).toFixed(2) + '%'
        : '0%',
    };
  }

  /**
   * Clear cache and stats (useful for testing)
   */
  reset() {
    this.cache.clear();
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      providerUsage: {
        photon: 0,
        nominatim: 0,
        geodb: 0,
      },
      providerFailures: {
        photon: 0,
        nominatim: 0,
        geodb: 0,
      },
    };
  }

  /**
   * Cleanup on shutdown
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

module.exports = new LocationService();