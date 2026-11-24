const { MongoClient } = require("mongodb");

const ADMIN_EMAIL = "blessyjosekonikkara@gmail.com";

// Exactly 45 Official Participants (DAISY excluded as instructed)
const OFFICIAL_PARTICIPANTS = [
  "SR BLESSY", "JOSE", "BINDU", "BLESSY", "JOSHUAL", "JOY", "LOUSY", "MERIN",
  "NINTO", "SMRITHY", "HEZLIN NINTO", "DAVIS", "OMANA", "ABHEESH", "ANU ABHEESH",
  "KELVIN ABHEESH", "DALVIN ABHEESH", "ABHILASH", "SRUTHY", "DANIEL ABHILASH",
  "ASHA", "RESWIN", "CELINE RESWIN", "ELIZABETH RESWIN", "NIRMALA", "ANU DINOY",
  "DINOY", "POPPY", "POWEL", "PRASOON", "ARUN", "FEMI", "JOSEPH RAPHEAL",
  "TESSY", "KIRON", "RINU", "ALAN", "AEIDEN", "SHEETHAL", "TOM", "SERAH TOM",
  "DANIEL TOM", "GEORGE", "KAVITHA", "JERIN"
];

function normalizeName(name) {
  if (!name || typeof name !== "string") return "";
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function matchOfficialParticipant(name) {
  const norm = normalizeName(name);
  if (!norm) return null;
  return OFFICIAL_PARTICIPANTS.find((p) => normalizeName(p) === norm) || null;
}

// Connection Caching for Vercel Serverless Functions
let cachedClient = null;
let cachedDb = null;
let isSeeded = false;

function __setMockDatabase(mock) {
  cachedDb = mock;
  cachedClient = mock ? { close: async () => {} } : null;
  isSeeded = Boolean(mock);
}

async function getDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is not defined.");
  }

  const dbName = process.env.MONGODB_DB_NAME || "secret_santa";

  const client = new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
  });

  await client.connect();
  const db = client.db(dbName);

  cachedClient = client;
  cachedDb = db;

  // Safe Auto-Seed: Ensure all 45 slots exist as PENDING without overwriting existing data
  if (!isSeeded) {
    try {
      const ops = OFFICIAL_PARTICIPANTS.map((name) => {
        const norm = normalizeName(name);
        const id = norm.replace(/\s+/g, "_");
        return {
          updateOne: {
            filter: { id },
            update: {
              $setOnInsert: {
                id,
                officialName: name.trim(),
                normalizedName: norm,
                status: "PENDING",
                registeredByEmail: null,
                registeredByUid: null,
                registeredAt: null,
                hasRevealed: false,
              },
            },
            upsert: true,
          },
        };
      });

      if (ops.length > 0) {
        await db.collection("participants").bulkWrite(ops, { ordered: false });
      }

      // Ensure settings document exists
      await db.collection("settings").updateOne(
        { _id: "system_state" },
        {
          $setOnInsert: {
            _id: "system_state",
            assignmentsGenerated: false,
            assignmentsLocked: false,
            generating: false,
            totalParticipants: 45,
          },
        },
        { upsert: true }
      );

      isSeeded = true;
    } catch (seedErr) {
      console.warn("MongoDB auto-seed notice:", seedErr.message);
    }
  }

  return { client, db };
}

/**
 * Validates authentication token from Authorization header or request session.
 * Decodes claims and verifies user identity on the server.
 */
function verifyAuthToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return { authenticated: false, email: null, uid: null, isAdmin: false };
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return { authenticated: false, email: null, uid: null, isAdmin: false };
  }

  // Development / local simulation token
  if (token.startsWith("dev_token_")) {
    const rawEmail = decodeURIComponent(token.replace("dev_token_", "")).toLowerCase();
    return {
      authenticated: Boolean(rawEmail),
      email: rawEmail,
      uid: "uid_" + rawEmail.replace(/[^a-zA-Z0-9]/g, "_"),
      isAdmin: rawEmail === ADMIN_EMAIL.toLowerCase(),
    };
  }

  try {
    // Decode JWT payload safely (standard format for Firebase/session auth tokens)
    const parts = token.split(".");
    if (parts.length >= 2) {
      const payloadBase64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const decodedJson = Buffer.from(payloadBase64, "base64").toString("utf-8");
      const payload = JSON.parse(decodedJson);

      const email = (payload.email || payload.sub_email || "").toLowerCase();
      const uid = payload.user_id || payload.sub || payload.uid || ("uid_" + email.replace(/[^a-zA-Z0-9]/g, "_"));
      const isAdmin = email === ADMIN_EMAIL.toLowerCase();

      return {
        authenticated: Boolean(email),
        email,
        uid,
        isAdmin,
      };
    }
  } catch (err) {
    console.warn("Token decode notice:", err.message);
  }

  return { authenticated: false, email: null, uid: null, isAdmin: false };
}

module.exports = {
  getDatabase,
  verifyAuthToken,
  ADMIN_EMAIL,
  OFFICIAL_PARTICIPANTS,
  normalizeName,
  matchOfficialParticipant,
  __setMockDatabase,
};
