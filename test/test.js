/**
 * Example test file for cities autocomplete API
 * 
 * To run tests:
 * 1. Install Jest: npm install --save-dev jest supertest
 * 2. Run: npm test
 * 
 * For production, expand these tests to cover:
 * - All edge cases
 * - Error scenarios
 * - Rate limiting
 * - Cache behavior
 * - Provider fallback
 */

const request = require('supertest');
const app = require('../server');

describe('Cities Autocomplete API', () => {
  
  describe('GET /api/cities', () => {
    
    test('should return cities for valid query', async () => {
      const response = await request(app)
        .get('/api/cities')
        .query({ q: 'new' })
        .expect(200)
        .expect('Content-Type', /json/);

      expect(Array.isArray(response.body)).toBe(true);
      
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('city');
        expect(response.body[0]).toHaveProperty('state');
        expect(response.body[0]).toHaveProperty('country');
      }
    });

    test('should return empty array for query < 2 characters', async () => {
      const response = await request(app)
        .get('/api/cities')
        .query({ q: 'a' })
        .expect(200);

      expect(response.body).toEqual([]);
    });

    test('should return empty array for missing query', async () => {
      const response = await request(app)
        .get('/api/cities')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    test('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/api/cities')
        .query({ q: 'paris' })
        .expect(200);

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });

    test('should normalize results correctly', async () => {
      const response = await request(app)
        .get('/api/cities')
        .query({ q: 'london' })
        .expect(200);

      if (response.body.length > 0) {
        const city = response.body[0];
        
        expect(typeof city.city).toBe('string');
        expect(typeof city.state).toBe('string');
        expect(typeof city.country).toBe('string');
        
        // Should not have extra properties
        expect(Object.keys(city).sort()).toEqual(['city', 'country', 'state'].sort());
      }
    });

    test('should handle special characters in query', async () => {
      const response = await request(app)
        .get('/api/cities')
        .query({ q: 'São Paulo' })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

  });

  describe('GET /api/cities/health', () => {
    
    test('should return health status', async () => {
      const response = await request(app)
        .get('/api/cities/health')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('providers');
      expect(response.body).toHaveProperty('cache');
    });

    test('should show provider configuration', async () => {
      const response = await request(app)
        .get('/api/cities/health')
        .expect(200);

      expect(response.body.providers).toHaveProperty('googlePlaces');
      expect(response.body.providers).toHaveProperty('geoDB');
    });

  });

  describe('Rate Limiting', () => {
    
    test('should enforce rate limits', async () => {
      // This test assumes rate limit is set low for testing
      // In production, you'd configure a separate test rate limiter
      
      const requests = [];
      for (let i = 0; i < 65; i++) {
        requests.push(
          request(app)
            .get('/api/cities')
            .query({ q: 'test' })
        );
      }

      const responses = await Promise.all(requests);
      const tooManyRequests = responses.filter(r => r.status === 429);
      
      // At least one request should be rate limited
      // (exact number depends on timing)
      expect(tooManyRequests.length).toBeGreaterThan(0);
    }, 10000); // 10 second timeout for this test

  });

});

describe('Integration Tests', () => {
  
  test('should handle provider fallback', async () => {
    // Mock Google Places to fail
    // (In real test, you'd use dependency injection or test doubles)
    
    const response = await request(app)
      .get('/api/cities')
      .query({ q: 'test' })
      .expect(200);

    // Should still return results (from fallback) or empty array
    expect(Array.isArray(response.body)).toBe(true);
  });

  test('should cache results', async () => {
    const query = 'berlin';
    
    // First request
    const response1 = await request(app)
      .get('/api/cities')
      .query({ q: query })
      .expect(200);

    // Second request (should be cached)
    const response2 = await request(app)
      .get('/api/cities')
      .query({ q: query })
      .expect(200);

    expect(response1.body).toEqual(response2.body);
  });

});