const { google } = require('googleapis');

class GoogleSheetsService {
  constructor() {
    this.spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    this.sheetsClient = null;
  }

  getClient() {
    if (this.sheetsClient) {
      return this.sheetsClient;
    }

    const credentials = {
      type: process.env.GOOGLE_SERVICE_ACCOUNT_TYPE,
      project_id: process.env.GOOGLE_PROJECT_ID,
      private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      client_id: process.env.GOOGLE_CLIENT_ID,
      auth_uri: process.env.GOOGLE_AUTH_URI,
      token_uri: process.env.GOOGLE_TOKEN_URI,
      auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_CERT_URL,
      client_x509_cert_url: process.env.GOOGLE_CLIENT_CERT_URL,
    };

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    this.sheetsClient = google.sheets({ version: 'v4', auth });
    return this.sheetsClient;
  }

  async appendRow(sheetName, rowData) {
    const sheets = this.getClient();

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${sheetName}!A:G`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [rowData],
      },
    });

    return response.data;
  }
}

module.exports = new GoogleSheetsService();