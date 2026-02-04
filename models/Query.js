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
    this.timestamp = this.formatTimestamp(new Date());
  }

  formatTimestamp(date) {
    // Convert to IST (India Standard Time - UTC+5:30)
    const options = {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata' // This sets the timezone to IST
    };
    
    return date.toLocaleString('en-IN', options);
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