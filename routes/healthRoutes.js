const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');

router.get('/health', (req, res) => healthController.checkHealth(req, res));

router.get('/ping', (req, res) => healthController.ping(req, res));

module.exports = router;