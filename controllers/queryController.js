const { Query } = require('../models/Query');
const googleSheetsService = require('../services/googleSheetsService');

class QueryController {
  async saveQuery(req, res) {
    try {
      const { type, name, mobile, ...searchData } = req.body;

      // Create query instance
      const query = new Query({
        type,
        name,
        mobile,
        searchData,
      });

      // Validate
      const validation = query.validate();
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validation.errors,
        });
      }

      // Get row data and sheet name
      const rowData = query.toRowData();
      const sheetName = query.getSheetName();

      // Save to Google Sheets
      const response = await googleSheetsService.appendRow(sheetName, rowData);

      console.log(`Data saved to ${sheetName}:`, response);

      return res.status(200).json({
        success: true,
        message: 'Search query saved successfully',
        data: {
          type: query.type,
          sheet: sheetName,
          timestamp: query.timestamp,
        },
      });
    } catch (error) {
      console.error('Error saving query:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to save search query',
        error: error.message,
      });
    }
  }
}

module.exports = new QueryController();