class HealthController {
  async checkHealth(req, res) {
    try {
      const healthCheck = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
        },
      };

      res.status(200).json(healthCheck);
    } catch (error) {
      res.status(503).json({
        status: 'ERROR',
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    }
  }

  async ping(req, res) {
    res.status(200).json({
      success: true,
      message: 'pong',
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = new HealthController();