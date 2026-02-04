/**
 * Simple IP-based rate limiter middleware
 * 
 * Limits requests per IP address to prevent abuse
 * For production, consider using:
 * - express-rate-limit package
 * - Redis-based rate limiter for distributed systems
 * - API Gateway rate limiting (AWS, Cloudflare, etc.)
 */

class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60000; // 1 minute window
    this.maxRequests = options.maxRequests || 100; // 100 requests per minute
    this.requests = new Map();
    
    // Cleanup old entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Middleware function for rate limiting
   * @returns {Function} Express middleware
   */
  middleware() {
    return (req, res, next) => {
      const ip = this.getClientIP(req);
      const now = Date.now();
      const windowStart = now - this.windowMs;

      // Get or initialize request history for this IP
      let ipRequests = this.requests.get(ip) || [];

      // Remove requests outside the current window
      ipRequests = ipRequests.filter(timestamp => timestamp > windowStart);

      // Check if limit exceeded
      if (ipRequests.length >= this.maxRequests) {
        return res.status(429).json({
          error: 'Too many requests',
          message: `Rate limit exceeded. Maximum ${this.maxRequests} requests per ${this.windowMs / 1000} seconds.`,
          retryAfter: Math.ceil((ipRequests[0] + this.windowMs - now) / 1000),
        });
      }

      // Add current request
      ipRequests.push(now);
      this.requests.set(ip, ipRequests);

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': this.maxRequests,
        'X-RateLimit-Remaining': this.maxRequests - ipRequests.length,
        'X-RateLimit-Reset': new Date(now + this.windowMs).toISOString(),
      });

      next();
    };
  }

  /**
   * Get client IP address from request
   * Handles proxies and load balancers
   * 
   * @param {Object} req - Express request object
   * @returns {string} Client IP address
   */
  getClientIP(req) {
    // Check for common proxy headers
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      // x-forwarded-for can contain multiple IPs, get the first one
      return forwarded.split(',')[0].trim();
    }

    const realIP = req.headers['x-real-ip'];
    if (realIP) {
      return realIP;
    }

    // Fallback to socket address
    return req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           req.ip || 
           'unknown';
  }

  /**
   * Clean up old request entries
   */
  cleanup() {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    let cleanedCount = 0;

    this.requests.forEach((timestamps, ip) => {
      const validTimestamps = timestamps.filter(t => t > windowStart);
      
      if (validTimestamps.length === 0) {
        // No valid requests, remove IP entry
        this.requests.delete(ip);
        cleanedCount++;
      } else if (validTimestamps.length < timestamps.length) {
        // Some requests expired, update
        this.requests.set(ip, validTimestamps);
      }
    });

    if (cleanedCount > 0) {
      console.log(`Rate limiter cleanup: removed ${cleanedCount} IP entries`);
    }
  }

  /**
   * Get current stats
   * @returns {Object} Rate limiter stats
   */
  getStats() {
    return {
      activeIPs: this.requests.size,
      windowMs: this.windowMs,
      maxRequests: this.maxRequests,
    };
  }

  /**
   * Cleanup on shutdown
   */
  destroy() {
    clearInterval(this.cleanupInterval);
    this.requests.clear();
  }
}

module.exports = RateLimiter;