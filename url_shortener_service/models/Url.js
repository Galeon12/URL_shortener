import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'urls.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper to read and write fallback data
const readFallbackData = () => {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify([]));
      return [];
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.error('Error reading fallback urls.json:', err.message);
    return [];
  }
};

const writeFallbackData = (data) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error writing fallback urls.json:', err.message);
  }
};

const urlSchema = new mongoose.Schema({
  urlCode: String,
  longUrl: String,
  shortUrl: String,
  clicks: { type: Number, default: 0 },
  date: { type: String, default: () => new Date().toISOString() }
});

const MongoUrlModel = mongoose.model('Url', urlSchema);

class FallbackUrlRecord {
  constructor(data) {
    this._id = data._id || 'loc_' + Math.random().toString(36).substring(2, 9);
    this.urlCode = data.urlCode;
    this.longUrl = data.longUrl;
    this.shortUrl = data.shortUrl;
    this.clicks = data.clicks || 0;
    this.date = data.date || new Date().toISOString();
  }

  async save() {
    const records = readFallbackData();
    const existingIndex = records.findIndex(r => r.urlCode === this.urlCode);
    if (existingIndex >= 0) {
      records[existingIndex] = { ...this };
    } else {
      records.unshift({ ...this });
    }
    writeFallbackData(records);
    return this;
  }
}

// Resilient Wrapper that acts like Mongoose Model
const Url = function(data) {
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    return new MongoUrlModel(data);
  }
  return new FallbackUrlRecord(data);
};

Url.findOne = async function(filter) {
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    try {
      return await MongoUrlModel.findOne(filter);
    } catch (err) {
      // Fall through to fallback
    }
  }

  const records = readFallbackData();
  const match = records.find(item => {
    for (const key of Object.keys(filter)) {
      if (item[key] !== filter[key]) return false;
    }
    return true;
  });

  return match ? new FallbackUrlRecord(match) : null;
};

Url.find = function(filter = {}) {
  const isMongoReady = mongoose.connection && mongoose.connection.readyState === 1;

  if (isMongoReady) {
    return MongoUrlModel.find(filter);
  }

  // Create chainable query mock for fallback
  const records = readFallbackData().filter(item => {
    for (const key of Object.keys(filter)) {
      if (item[key] !== filter[key]) return false;
    }
    return true;
  });

  const queryMock = {
    _data: [...records],
    sort(sortObj) {
      if (sortObj && sortObj._id === -1) {
        // already ordered unshift
      }
      return this;
    },
    limit(n) {
      this._data = this._data.slice(0, n);
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve(this._data.map(d => new FallbackUrlRecord(d))).then(resolve, reject);
    }
  };

  return queryMock;
};

Url.updateOne = async function(filter, update) {
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    try {
      return await MongoUrlModel.updateOne(filter, update);
    } catch (err) {
      // Fall through to fallback
    }
  }

  const records = readFallbackData();
  const match = records.find(item => {
    for (const key of Object.keys(filter)) {
      if (item[key] !== filter[key]) return false;
    }
    return true;
  });

  if (match) {
    if (update.$inc && update.$inc.clicks) {
      match.clicks = (match.clicks || 0) + update.$inc.clicks;
    }
    if (update.$set) {
      Object.assign(match, update.$set);
    }
    writeFallbackData(records);
    return { nModified: 1 };
  }
  return { nModified: 0 };
};

Url.deleteOne = async function(filter) {
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    try {
      return await MongoUrlModel.deleteOne(filter);
    } catch (err) {
      // Fall through to fallback
    }
  }

  let records = readFallbackData();
  const originalLength = records.length;
  records = records.filter(item => {
    for (const key of Object.keys(filter)) {
      if (item[key] === filter[key]) return false;
    }
    return true;
  });

  writeFallbackData(records);
  return { deletedCount: originalLength - records.length };
};

Url.countDocuments = async function() {
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    try {
      return await MongoUrlModel.countDocuments();
    } catch (err) {
      // Fall through
    }
  }
  return readFallbackData().length;
};

export default Url;
