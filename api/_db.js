const { MongoClient } = require("mongodb");
const { getApp, getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

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

let databasePromise;

function __setMockDatabase(mock) {
  databasePromise = mock ? Promise.resolve({ db: mock }) : undefined;
}

function getDatabase() {
  if (!databasePromise) {
    databasePromise = connectAndSeedDatabase().catch((err) => {
      databasePromise = undefined;
      throw err;
    });
  }
  return databasePromise;
}

async function connectAndSeedDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is not defined.");
  }

  const dbName = process.env.MONGODB_DB_NAME || "secret_santa";

  const client = new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
  });

  try {
    await client.connect();
    const db = client.db(dbName);
    const participants = db.collection("participants");
    await participants.createIndex({ id: 1 }, { unique: true });

    const ops = OFFICIAL_PARTICIPANTS.map((name) => {
      const norm = normalizeName(name);
      return {
        updateOne: {
          filter: { id: norm.replace(/\s+/g, "_") },
          update: {
            $setOnInsert: {
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
    await participants.bulkWrite(ops, { ordered: false });

    await db.collection("settings").updateOne(
      { _id: "system_state" },
      {
        $setOnInsert: {
          assignmentsGenerated: false,
          assignmentsLocked: false,
          generating: false,
          totalParticipants: OFFICIAL_PARTICIPANTS.length,
        },
      },
      { upsert: true }
    );
    return { db };
  } catch (err) {
    await client.close();
    throw err;
  }
}

async function verifyAuthToken(req) {
  const unauthenticated = { authenticated: false, email: null, uid: null, isAdmin: false };
  const authHeader = req.headers.authorization || req.headers.Authorization || "";
  const token = /^Bearer\s+(\S+)$/i.exec(authHeader)?.[1];
  if (!token) return unauthenticated;

  const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("VITE_FIREBASE_PROJECT_ID is not configured.");
  const app = getApps().length ? getApp() : initializeApp({ projectId });

  let claims;
  try {
    claims = await getAuth(app).verifyIdToken(token);
  } catch (err) {
    if (["auth/argument-error", "auth/id-token-expired", "auth/invalid-id-token"].includes(err.code)) {
      return unauthenticated;
    }
    throw err;
  }
  if (!claims.email_verified || !claims.email) return unauthenticated;
  const email = claims.email.toLowerCase();
  return { authenticated: true, email, uid: claims.uid, isAdmin: email === ADMIN_EMAIL };
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
