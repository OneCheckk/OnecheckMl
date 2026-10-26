const mongoose = require('mongoose');

class MongoMemoryServer {
  constructor(uri) {
    this._uri = uri;
  }

  static async create(options = {}) {
    if (!process.env.MONGODB_URI) {
      require('dotenv').config();
    }
    const rawUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/';
    const testDbName = `test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    let uri = rawUri;
    if (uri.includes('?')) {
      const parts = uri.split('?');
      let base = parts[0];
      if (!base.endsWith('/')) base += '/';
      uri = `${base}${testDbName}?${parts[1]}`;
    } else {
      if (!uri.endsWith('/')) uri += '/';
      uri = `${uri}${testDbName}`;
    }

    return new MongoMemoryServer(uri);
  }

  getUri() {
    return this._uri;
  }

  async stop() {
    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        const collections = Object.values(mongoose.connection.collections);
        for (const col of collections) {
          try {
            await col.deleteMany({});
          } catch (e) {
            // ignore
          }
        }
      }
    } catch (err) {
      // ignore
    }
    return true;
  }
}

module.exports = { MongoMemoryServer };
