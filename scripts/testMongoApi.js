const assert = require("assert");
const { mock } = require("node:test");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const {
  ADMIN_EMAIL,
  OFFICIAL_PARTICIPANTS,
  normalizeName,
  matchOfficialParticipant,
  __setMockDatabase,
} = require("../api/_db");

const participantsHandler = require("../api/participants");
const registerHandler = require("../api/register");
const myFriendHandler = require("../api/my-friend");
const adminHandler = require("../api/admin");

// Helper to create mock request and response objects
function createReqRes({ method = "GET", headers = {}, query = {}, body = null }) {
  const req = {
    method,
    headers: { ...headers },
    query: { ...query },
    body,
  };

  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, val) {
      this.headers[name] = val;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  return { req, res };
}

// In-Memory MongoDB Engine for Serverless Function Verification
class MockMongoDatabase {
  constructor() {
    this.participantsMap = new Map();
    this.settingsMap = new Map();
    this.assignmentsList = [];

    // Seed 45 PENDING participants
    for (const name of OFFICIAL_PARTICIPANTS) {
      const norm = normalizeName(name);
      const id = norm.replace(/\s+/g, "_");
      this.participantsMap.set(id, {
        id,
        officialName: name.trim(),
        normalizedName: norm,
        status: "PENDING",
        registeredByEmail: null,
        registeredByUid: null,
        registeredAt: null,
        hasRevealed: false,
      });
    }

    this.settingsMap.set("system_state", {
      _id: "system_state",
      assignmentsGenerated: false,
      assignmentsLocked: false,
      generating: false,
      totalParticipants: 45,
    });
  }

  collection(name) {
    if (name === "participants") {
      return {
        find: (filter = {}) => {
          let list = Array.from(this.participantsMap.values());
          if (filter.status) list = list.filter((p) => p.status === filter.status);
          if (filter.registeredByEmail) {
            list = list.filter(
              (p) => p.registeredByEmail?.toLowerCase() === filter.registeredByEmail.toLowerCase()
            );
          }
          return {
            sort: () => ({
              toArray: async () => list.sort((a, b) => a.officialName.localeCompare(b.officialName)),
            }),
            toArray: async () => list,
          };
        },
        findOne: async (query) => {
          if (query.id) return this.participantsMap.get(query.id) || null;
          if (query.registeredByEmail) {
            return (
              Array.from(this.participantsMap.values()).find(
                (p) => p.registeredByEmail?.toLowerCase() === query.registeredByEmail.toLowerCase()
              ) || null
            );
          }
          return null;
        },
        updateOne: async (filter, update, options = {}) => {
          let doc = this.participantsMap.get(filter.id);
          if (!doc && options.upsert) {
            const setOnInsert = update.$setOnInsert || {};
            doc = { id: filter.id, ...setOnInsert };
            this.participantsMap.set(filter.id, doc);
            return { matchedCount: 0, upsertedCount: 1 };
          }
          if (!doc) return { matchedCount: 0, modifiedCount: 0 };

          // Check conditional status filter (e.g. status: "PENDING")
          if (filter.status && doc.status !== filter.status) {
            return { matchedCount: 0, modifiedCount: 0 };
          }

          if (update.$set) {
            Object.assign(doc, update.$set);
          }
          return { matchedCount: 1, modifiedCount: 1 };
        },
        insertOne: async (doc) => {
          this.participantsMap.set(doc.id, doc);
          return { insertedId: doc.id };
        },
      };
    }

    if (name === "settings") {
      return {
        findOne: async (query) => {
          return this.settingsMap.get(query._id) || null;
        },
        findOneAndUpdate: async (filter, update) => {
          const doc = this.settingsMap.get(filter._id);
          if (!doc) return null;
          if (filter.generating && filter.generating.$ne === true && doc.generating === true) {
            return null; // Concurrency conflict
          }
          if (update.$set) {
            Object.assign(doc, update.$set);
          }
          return doc;
        },
        updateOne: async (filter, update, options = {}) => {
          let doc = this.settingsMap.get(filter._id);
          if (!doc && options.upsert) {
            doc = { _id: filter._id, ...(update.$setOnInsert || {}) };
            this.settingsMap.set(filter._id, doc);
            return { matchedCount: 0, upsertedCount: 1 };
          }
          if (!doc) return { matchedCount: 0, modifiedCount: 0 };
          if (update.$set) Object.assign(doc, update.$set);
          return { matchedCount: 1, modifiedCount: 1 };
        },
      };
    }

    if (name === "assignments") {
      return {
        find: (filter = {}) => {
          let list = [...this.assignmentsList];
          if (filter.giverId && filter.giverId.$in) {
            list = list.filter((a) => filter.giverId.$in.includes(a.giverId));
          }
          return {
            toArray: async () => list,
          };
        },
        findOne: async (query) => {
          if (query.giverId) {
            return this.assignmentsList.find((a) => a.giverId === query.giverId) || null;
          }
          return null;
        },
        deleteMany: async () => {
          const count = this.assignmentsList.length;
          this.assignmentsList = [];
          return { deletedCount: count };
        },
        insertMany: async (docs) => {
          this.assignmentsList.push(...docs);
          return { insertedCount: docs.length };
        },
        updateMany: async (filter, update) => {
          let count = 0;
          for (const item of this.assignmentsList) {
            if (update.$set) {
              Object.assign(item, update.$set);
              count++;
            }
          }
          return { modifiedCount: count };
        },
        updateOne: async (filter, update) => {
          const item = this.assignmentsList.find((a) => a.giverId === filter.giverId);
          if (item && update.$set) {
            Object.assign(item, update.$set);
            return { matchedCount: 1, modifiedCount: 1 };
          }
          return { matchedCount: 0, modifiedCount: 0 };
        },
      };
    }

    throw new Error(`Collection "${name}" not supported in mock.`);
  }
}

async function runMongoApiTestSuite() {
  console.log("==================================================================");
  console.log("MONGODB SERVERLESS API INTEGRATION & SECURITY TEST SUITE");
  console.log("==================================================================");

  const mockDb = new MockMongoDatabase();
  __setMockDatabase(mockDb);

  process.env.VITE_FIREBASE_PROJECT_ID = "secret-santa-test";
  const firebaseAuth = getAuth(initializeApp({ projectId: process.env.VITE_FIREBASE_PROJECT_ID }));
  const { req: legacyReq, res: legacyRes } = createReqRes({
    headers: { authorization: `Bearer dev_token_${ADMIN_EMAIL}` },
  });
  await adminHandler(legacyReq, legacyRes);
  assert.strictEqual(legacyRes.statusCode, 403);

  const fixtureEmails = [ADMIN_EMAIL, "user1@example.com", "family@example.com", "user1@family.com", "user2@other.com"];
  const fixtures = new Map(fixtureEmails.map((email) => [
    `test-session-${email}`, { email, email_verified: true, uid: `test-uid-${email}` },
  ]));
  mock.method(firebaseAuth, "verifyIdToken", async (token) => {
    const claims = fixtures.get(token);
    if (!claims) throw Object.assign(new Error("Unknown fixture"), { code: "auth/argument-error" });
    return claims;
  });

  // -------------------------------------------------------------
  // SUITE 1: Auto-Seed & Roster Integrity
  // -------------------------------------------------------------
  console.log("\n[Suite 1] Auto-Seed & Roster Integrity Verification:");
  assert.strictEqual(OFFICIAL_PARTICIPANTS.length, 45, "Must have exactly 45 official participants.");
  assert.strictEqual(mockDb.participantsMap.size, 45, "Mock DB must initialize with 45 records.");
  assert(!mockDb.participantsMap.has("daisy"), "DAISY must be excluded.");
  console.log("✓ Suite 1 PASSED: 45 official participants auto-seeded as PENDING (DAISY excluded).");

  // -------------------------------------------------------------
  // SUITE 2: Privacy Scoping on /api/participants
  // -------------------------------------------------------------
  console.log("\n[Suite 2] Privacy Scoping on /api/participants:");
  
  // Public/Unauthenticated query
  const { req: pReq1, res: pRes1 } = createReqRes({ method: "GET" });
  await participantsHandler(pReq1, pRes1);
  assert.strictEqual(pRes1.statusCode, 200);
  assert.strictEqual(pRes1.body.isAdmin, false);
  assert.strictEqual(pRes1.body.participants.length, 45);
  // Privacy check: No emails or UIDs returned in public roster
  assert.strictEqual(pRes1.body.participants[0].registeredByEmail, undefined);
  assert.strictEqual(pRes1.body.participants[0].registeredByUid, undefined);
  console.log("  ✓ Unauthenticated user receives sanitized roster with 0 email/UID exposures.");

  // Ordinary user query
  const { req: pReq2, res: pRes2 } = createReqRes({
    method: "GET",
    headers: { authorization: "Bearer test-session-user1@example.com" },
  });
  await participantsHandler(pReq2, pRes2);
  assert.strictEqual(pRes2.statusCode, 200);
  assert.strictEqual(pRes2.body.isAdmin, false);
  console.log("  ✓ Ordinary user recognized with isAdmin: false and strict scoping.");

  // Admin query
  const { req: pReqAdmin, res: pResAdmin } = createReqRes({
    method: "GET",
    headers: { authorization: `Bearer test-session-${ADMIN_EMAIL}` },
  });
  await participantsHandler(pReqAdmin, pResAdmin);
  assert.strictEqual(pResAdmin.statusCode, 200);
  assert.strictEqual(pResAdmin.body.isAdmin, true);
  assert(pResAdmin.body.participants[0].hasOwnProperty("registeredByEmail"));
  console.log("  ✓ Admin recognized with isAdmin: true and full oversight access.");
  console.log("✓ Suite 2 PASSED: Privacy scoping strictly enforced on /api/participants.");

  // -------------------------------------------------------------
  // SUITE 3: Registration & Double-Claim Prevention on /api/register
  // -------------------------------------------------------------
  console.log("\n[Suite 3] Registration & Double-Claim Prevention on /api/register:");

  // Test 3a: Unauthorized registration attempt
  const { req: rReqUnauth, res: rResUnauth } = createReqRes({
    method: "POST",
    body: { name: "SR BLESSY" },
  });
  await registerHandler(rReqUnauth, rResUnauth);
  assert.strictEqual(rResUnauth.statusCode, 401);
  console.log("  ✓ Unauthenticated registration rejected with 401 Unauthorized.");

  // Test 3b: Non-official name registration attempt
  const { req: rReqInvalid, res: rResInvalid } = createReqRes({
    method: "POST",
    headers: { authorization: "Bearer test-session-family@example.com" },
    body: { name: "SANTA CLAUS" },
  });
  await registerHandler(rReqInvalid, rResInvalid);
  assert.strictEqual(rResInvalid.statusCode, 400);
  console.log("  ✓ Non-official participant name rejected with 400 Bad Request.");

  // Test 3c: Valid registration of SR BLESSY by user1
  const { req: rReq1, res: rRes1 } = createReqRes({
    method: "POST",
    headers: { authorization: "Bearer test-session-user1@family.com" },
    body: { name: "SR BLESSY" },
  });
  await registerHandler(rReq1, rRes1);
  assert.strictEqual(rRes1.statusCode, 200);
  assert.strictEqual(rRes1.body.success, true);
  assert.strictEqual(rRes1.body.officialName, "SR BLESSY");
  console.log("  ✓ Valid participant 'SR BLESSY' successfully claimed by user1@family.com.");

  // Test 3d: Idempotent re-registration by SAME user
  const { req: rReqSame, res: rResSame } = createReqRes({
    method: "POST",
    headers: { authorization: "Bearer test-session-user1@family.com" },
    body: { name: "SR BLESSY" },
  });
  await registerHandler(rReqSame, rResSame);
  assert.strictEqual(rResSame.statusCode, 200);
  assert.strictEqual(rResSame.body.alreadyRegisteredByYou, true);
  console.log("  ✓ Re-registration by same account returns alreadyRegisteredByYou: true.");

  // Test 3e: Double-claim attempt by DIFFERENT user (user2 tries to claim SR BLESSY)
  const { req: rReqOther, res: rResOther } = createReqRes({
    method: "POST",
    headers: { authorization: "Bearer test-session-user2@other.com" },
    body: { name: "SR BLESSY" },
  });
  await registerHandler(rReqOther, rResOther);
  assert.strictEqual(rResOther.statusCode, 409);
  assert(rResOther.body.error.includes("already been claimed"));
  console.log("  ✓ Double-claim attempt by different account blocked with 409 Conflict.");

  // Test 3f: Multi-member family registration under SAME email (user1 claims JOSE)
  const { req: rReqMulti, res: rResMulti } = createReqRes({
    method: "POST",
    headers: { authorization: "Bearer test-session-user1@family.com" },
    body: { name: "JOSE" },
  });
  await registerHandler(rReqMulti, rResMulti);
  assert.strictEqual(rResMulti.statusCode, 200);
  assert.strictEqual(rResMulti.body.officialName, "JOSE");
  console.log("  ✓ Multi-member family registration (JOSE under user1@family.com) succeeds.");
  console.log("✓ Suite 3 PASSED: Registration constraints & double-claim prevention verified.");

  // -------------------------------------------------------------
  // SUITE 4: Scoped MY FRIEND Reveal on /api/my-friend
  // -------------------------------------------------------------
  console.log("\n[Suite 4] Scoped Friend Reveal on /api/my-friend:");

  // Test 4a: Pre-lock check (assignments not locked yet)
  const { req: fReqPreLock, res: fResPreLock } = createReqRes({
    method: "GET",
    headers: { authorization: "Bearer test-session-user1@family.com" },
    query: { participantId: "sr_blessy" },
  });
  await myFriendHandler(fReqPreLock, fResPreLock);
  assert.strictEqual(fResPreLock.statusCode, 200);
  assert.strictEqual(fResPreLock.body.assignedFriend, null);
  assert.strictEqual(fResPreLock.body.locked, false);
  console.log("  ✓ Before lock, assignedFriend returns null safely without leaking data.");

  // Test 4b: Unauthorized snooping attempt (user2 queries sr_blessy)
  const { req: fReqSnoop, res: fResSnoop } = createReqRes({
    method: "GET",
    headers: { authorization: "Bearer test-session-user2@other.com" },
    query: { participantId: "sr_blessy" },
  });
  await myFriendHandler(fReqSnoop, fResSnoop);
  assert.strictEqual(fResSnoop.statusCode, 403);
  console.log("  ✓ Unauthorized user querying another's participant ID is blocked with 403 Forbidden.");

  // Test 4c: Action 'my-family' returns only family members registered by this email
  const { req: fReqFamily, res: fResFamily } = createReqRes({
    method: "GET",
    headers: { authorization: "Bearer test-session-user1@family.com" },
    query: { action: "my-family" },
  });
  await myFriendHandler(fReqFamily, fResFamily);
  assert.strictEqual(fResFamily.statusCode, 200);
  assert.strictEqual(fResFamily.body.familyMembers.length, 2);
  const familyNames = fResFamily.body.familyMembers.map((m) => m.officialName);
  assert(familyNames.includes("SR BLESSY") && familyNames.includes("JOSE"));
  console.log("  ✓ Action 'my-family' returns exactly the 2 members claimed by user1.");
  console.log("✓ Suite 4 PASSED: Friend reveal authorization and family scoping verified.");

  // -------------------------------------------------------------
  // SUITE 5: Admin Protections & Assignment Pre-Conditions on /api/admin
  // -------------------------------------------------------------
  console.log("\n[Suite 5] Admin Protections & Strict Pre-Conditions on /api/admin:");

  // Test 5a: Non-admin trying to call /api/admin
  const { req: aReqNonAdmin, res: aResNonAdmin } = createReqRes({
    method: "GET",
    headers: { authorization: "Bearer test-session-user1@family.com" },
    query: { action: "overview" },
  });
  await adminHandler(aReqNonAdmin, aResNonAdmin);
  assert.strictEqual(aResNonAdmin.statusCode, 403);
  console.log("  ✓ Non-admin access to /api/admin denied with 403 Forbidden.");

  // Test 5b: Admin overview reflects 2 registered and 43 pending
  const { req: aReqOverview, res: aResOverview } = createReqRes({
    method: "GET",
    headers: { authorization: `Bearer test-session-${ADMIN_EMAIL}` },
    query: { action: "overview" },
  });
  await adminHandler(aReqOverview, aResOverview);
  assert.strictEqual(aResOverview.statusCode, 200);
  assert.strictEqual(aResOverview.body.registeredCount, 2);
  assert.strictEqual(aResOverview.body.pendingCount, 43);
  assert.strictEqual(aResOverview.body.assignmentsGenerated, false);
  assert.strictEqual(aResOverview.headers["Cache-Control"], "private, no-store");
  const adminJose = aResOverview.body.participants.find((participant) => participant.id === "jose");
  assert.strictEqual(adminJose.status, "REGISTERED");
  assert.strictEqual(adminJose.registeredByEmail, "user1@family.com");
  assert(Number.isFinite(Date.parse(adminJose.registeredAt)));
  console.log("  ✓ Admin overview reports accurate central registration counts (2 registered, 43 pending).");

  // Test 5c: Attempting assignment generation when only 2/45 are registered
  const { req: aReqEarlyGen, res: aResEarlyGen } = createReqRes({
    method: "POST",
    headers: { authorization: `Bearer test-session-${ADMIN_EMAIL}` },
    body: { action: "generate-assignments" },
  });
  await adminHandler(aReqEarlyGen, aResEarlyGen);
  assert.strictEqual(aResEarlyGen.statusCode, 500);
  assert(aResEarlyGen.body.error.includes("All 45 participants must be registered first"));
  console.log("  ✓ Strict Pre-Condition: Assignment generation BLOCKED because only 2/45 registered.");

  // Test 5d: Simulate all 45 official participants registered
  console.log("  * Simulating registration of all remaining 43 participants...");
  for (let i = 2; i < OFFICIAL_PARTICIPANTS.length; i++) {
    const name = OFFICIAL_PARTICIPANTS[i];
    const norm = normalizeName(name);
    const id = norm.replace(/\s+/g, "_");
    const doc = mockDb.participantsMap.get(id);
    doc.status = "REGISTERED";
    doc.registeredByEmail = `family_member_${i}@gmail.com`;
    doc.registeredAt = new Date().toISOString();
  }
  assert.strictEqual(
    Array.from(mockDb.participantsMap.values()).filter((p) => p.status === "REGISTERED").length,
    45
  );

  // Test 5e: Generate assignments now that all 45 are registered
  const { req: aReqGen, res: aResGen } = createReqRes({
    method: "POST",
    headers: { authorization: `Bearer test-session-${ADMIN_EMAIL}` },
    body: { action: "generate-assignments" },
  });
  await adminHandler(aReqGen, aResGen);
  assert.strictEqual(aReqGen.statusCode, undefined); // status 200 on res
  assert.strictEqual(aResGen.statusCode, 200);
  assert.strictEqual(aResGen.body.success, true);
  assert.strictEqual(aResGen.body.totalPairs, 45);

  // Verify derangement properties across all 45 pairs
  const assignments = mockDb.assignmentsList;
  assert.strictEqual(assignments.length, 45, "Must have exactly 45 assignment pairs.");
  const givers = new Set();
  const receivers = new Set();
  for (const pair of assignments) {
    assert.notStrictEqual(
      pair.giverId,
      pair.receiverId,
      `Self-assignment violation: ${pair.giverName} assigned to self!`
    );
    givers.add(pair.giverId);
    receivers.add(pair.receiverId);
  }
  assert.strictEqual(givers.size, 45, "All 45 participants must be givers.");
  assert.strictEqual(receivers.size, 45, "All 45 participants must be receivers.");
  console.log("  ✓ Successfully generated 45 valid derangements with 0 self-assignments.");

  // Test 5f: Lock assignments
  const { req: aReqLock, res: aResLock } = createReqRes({
    method: "POST",
    headers: { authorization: `Bearer test-session-${ADMIN_EMAIL}` },
    body: { action: "lock-assignments" },
  });
  await adminHandler(aReqLock, aResLock);
  assert.strictEqual(aResLock.statusCode, 200);
  assert.strictEqual(aResLock.body.success, true);
  const settingsDoc = mockDb.settingsMap.get("system_state");
  assert.strictEqual(settingsDoc.assignmentsLocked, true);
  console.log("  ✓ Assignments successfully and permanently locked by administrator.");

  // Test 5g: Verify friend reveal after lock
  const srBlessyPair = assignments.find((a) => a.giverId === "sr_blessy");
  const { req: fReqPostLock, res: fResPostLock } = createReqRes({
    method: "GET",
    headers: { authorization: "Bearer test-session-user1@family.com" },
    query: { participantId: "sr_blessy" },
  });
  await myFriendHandler(fReqPostLock, fResPostLock);
  assert.strictEqual(fResPostLock.statusCode, 200);
  assert.strictEqual(fResPostLock.body.assignedFriend, srBlessyPair.receiverName);
  assert.strictEqual(fResPostLock.body.locked, true);
  console.log(`  ✓ Owner user1 can now reveal Secret Santa friend: ${srBlessyPair.receiverName}.`);

  // Non-owner still blocked from seeing sr_blessy's friend even after lock
  const { req: fReqPostLockSnoop, res: fResPostLockSnoop } = createReqRes({
    method: "GET",
    headers: { authorization: "Bearer test-session-user2@other.com" },
    query: { participantId: "sr_blessy" },
  });
  await myFriendHandler(fReqPostLockSnoop, fResPostLockSnoop);
  assert.strictEqual(fResPostLockSnoop.statusCode, 403);
  console.log("  ✓ Non-owner still blocked from snooping after assignments locked (403 Forbidden).");
  console.log("✓ Suite 5 PASSED: Admin authorization, 45-participant pre-condition & derangements verified.");

  console.log("\n==================================================================");
  console.log("ALL 5 MONGODB API TEST SUITES PASSED FLAWLESSLY (0 ERRORS)");
  console.log("==================================================================");
}

runMongoApiTestSuite().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
