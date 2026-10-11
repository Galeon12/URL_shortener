/**
 * Url Model (Phase 2 & 4)
 *
 * MongoDB-backed with resilient fallback to local urls.json.
 *
 * Schema changes vs original:
 *   - expiresAt   (Date|null) — optional URL expiration timestamp
 *   - clickLog    (Array)     — last 100 click analytics events (Phase 3)
 *
 * Indexes (Phase 4):
 *   - urlCode: unique, used on every redirect lookup
 *   - longUrl: unique, used to deduplicate creation requests
 *   - expiresAt: sparse TTL-style index for expiration queries
 */
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'urls.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ─── Fallback storage helpers ────────────────────────────────────────────────
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

// ─── Mongoose schema ─────────────────────────────────────────────────────────
const clickEventSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now },
    deviceType: { type: String, enum: ['desktop', 'mobile', 'bot', 'unknown'] },
    referrer: { type: String, default: null },
  },
  { _id: false }
);

const urlSchema = new mongoose.Schema({
  urlCode:   { type: String, required: true, unique: true, index: true },
  longUrl:   { type: String, required: true },
  shortUrl:  { type: String, required: true },
  clicks:    { type: Number, default: 0 },
  date:      { type: String, default: () => new Date().toISOString() },
  expiresAt: { type: Date, default: null, index: true },
  clickLog:  { type: [clickEventSchema], default: [] },
});

// Compound index for deduplication on create
urlSchema.index({ longUrl: 1 }, { unique: false });

const MongoUrlModel = mongoose.model('Url', urlSchema);

// ─── Fallback record ──────────────────────────────────────────────────────────
class FallbackUrlRecord {
  constructor(data) {
    this._id      = data._id || 'loc_' + Math.random().toString(36).substring(2, 9);
    this.urlCode  = data.urlCode;
    this.longUrl  = data.longUrl;
    this.shortUrl = data.shortUrl;
    this.clicks   = data.clicks || 0;
    this.date     = data.date || new Date().toISOString();
    this.expiresAt = data.expiresAt || null;
    this.clickLog = data.clickLog || [];
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

// ─── Resilient Wrapper ────────────────────────────────────────────────────────
const isMongoReady = () =>
  mongoose.connection && mongoose.connection.readyState === 1;

const Url = function (data) {
  if (isMongoReady()) return new MongoUrlModel(data);
  return new FallbackUrlRecord(data);
};

Url.findOne = async function (filter) {
  if (isMongoReady()) {
    try { return await MongoUrlModel.findOne(filter); } catch (_) {}
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

Url.find = function (filter = {}) {
  if (isMongoReady()) return MongoUrlModel.find(filter);

  const records = readFallbackData().filter(item => {
    for (const key of Object.keys(filter)) {
      if (item[key] !== filter[key]) return false;
    }
    return true;
  });

  const queryMock = {
    _data: [...records],
    sort(sortObj) {
      if (sortObj && sortObj._id === -1) { /* already most-recent first */ }
      return this;
    },
    limit(n) { this._data = this._data.slice(0, n); return this; },
    then(resolve, reject) {
      return Promise.resolve(this._data.map(d => new FallbackUrlRecord(d))).then(resolve, reject);
    },
  };
  return queryMock;
};

Url.updateOne = async function (filter, update) {
  if (isMongoReady()) {
    try { return await MongoUrlModel.updateOne(filter, update); } catch (_) {}
  }
  const records = readFallbackData();
  const match = records.find(item => {
    for (const key of Object.keys(filter)) {
      if (item[key] !== filter[key]) return false;
    }
    return true;
  });
  if (match) {
    if (update.$inc && update.$inc.clicks) match.clicks = (match.clicks || 0) + update.$inc.clicks;
    if (update.$set) Object.assign(match, update.$set);
    if (update.$push && update.$push.clickLog) {
      match.clickLog = match.clickLog || [];
      const eventData = update.$push.clickLog.$each || [update.$push.clickLog];
      match.clickLog.push(...eventData);
      // keep last 100
      if (match.clickLog.length > 100) match.clickLog = match.clickLog.slice(-100);
    }
    writeFallbackData(records);
    return { nModified: 1 };
  }
  return { nModified: 0 };
};

Url.deleteOne = async function (filter) {
  if (isMongoReady()) {
    try { return await MongoUrlModel.deleteOne(filter); } catch (_) {}
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

Url.countDocuments = async function () {
  if (isMongoReady()) {
    try { return await MongoUrlModel.countDocuments(); } catch (_) {}
  }
  return readFallbackData().length;
};

export default Url;
