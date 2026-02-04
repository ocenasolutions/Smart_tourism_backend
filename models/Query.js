const SHEET_NAMES = {
  flight: 'Flights',
  train: 'Trains',
  bus: 'Buses',
  hotel: 'Hotels',
};

class Query {
  constructor(data) {
    this.type = data.type;
    this.name = data.name;
    this.mobile = data.mobile;
    this.searchData = data.searchData;
    this.timestamp = new Date().toISOString();
  }

  validate() {
    const errors = [];

    if (!this.type) errors.push('type is required');
    if (!this.name) errors.push('name is required');
    if (!this.mobile) errors.push('mobile is required');

    if (this.type && !SHEET_NAMES[this.type]) {
      errors.push(`Invalid type. Must be one of: ${Object.keys(SHEET_NAMES).join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  toRowData() {
    if (this.type === 'hotel') {
      const { location, checkIn, checkOut, people } = this.searchData;
      return [
        this.timestamp,
        this.name,
        this.mobile,
        location || '',
        checkIn || '',
        checkOut || '',
        people || 1,
      ];
    } else {
      const { from, to, date, people } = this.searchData;
      return [
        this.timestamp,
        this.name,
        this.mobile,
        from || '',
        to || '',
        date || '',
        people || 1,
      ];
    }
  }

  getSheetName() {
    return SHEET_NAMES[this.type];
  }
}

module.exports = { Query, SHEET_NAMES };