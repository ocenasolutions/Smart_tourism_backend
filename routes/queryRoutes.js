const express = require('express');
const router = express.Router();
const queryController = require('../controllers/queryController');

// POST /api/save-query
router.post('/save-query', (req, res) => queryController.saveQuery(req, res));

module.exports = router;