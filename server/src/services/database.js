const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let memoryServer;

async function connectDatabase() {
  let mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    const dbPath = path.resolve(process.cwd(), "server", "data", "mongodb");
    fs.mkdirSync(dbPath, { recursive: true });

    memoryServer = await MongoMemoryServer.create({
      instance: {
        dbPath,
        storageEngine: "wiredTiger"
      }
    });
    mongoUri = memoryServer.getUri();
    console.log(`Using local MongoDB data at ${dbPath}`);
  }

  await mongoose.connect(mongoUri);
}

module.exports = {
  connectDatabase
};
