const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let memoryServer;

function clearStaleMongoLocks(dbPath) {
  // mongodb-memory-server can leave lock files behind after a forced laptop/app shutdown.
  // Removing only those lock markers lets the same persistent local database restart safely.
  ["mongod.lock", "WiredTiger.lock"].forEach((fileName) => {
    const lockPath = path.join(dbPath, fileName);

    if (fs.existsSync(lockPath)) {
      fs.rmSync(lockPath, { force: true });
    }
  });
}

async function startLocalDatabase(dbPath) {
  clearStaleMongoLocks(dbPath);

  try {
    memoryServer = await MongoMemoryServer.create({
      instance: {
        dbPath,
        storageEngine: "wiredTiger"
      }
    });

    return memoryServer.getUri();
  } catch (error) {
    clearStaleMongoLocks(dbPath);
    memoryServer = await MongoMemoryServer.create({
      instance: {
        dbPath,
        storageEngine: "wiredTiger"
      }
    });

    return memoryServer.getUri();
  }
}

async function connectDatabase() {
  let mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    const dbPath = path.resolve(process.cwd(), "server", "data", "mongodb");
    fs.mkdirSync(dbPath, { recursive: true });

    mongoUri = await startLocalDatabase(dbPath);
    console.log(`Using local MongoDB data at ${dbPath}`);
  }

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 15000
  });
}

module.exports = {
  connectDatabase
};
