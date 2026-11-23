const assert = require("assert");

// Import official roster definitions
const OFFICIAL_PARTICIPANTS = [
  "SR BLESSY", "JOSE", "BINDU", "BLESSY", "JOSHUAL", "JOY", "LOUSY", "MERIN",
  "NINTO", "SMRITHY", "HEZLIN NINTO", "DAVIS", "OMANA", "ABHEESH", "ANU ABHEESH",
  "KELVIN ABHEESH", "DALVIN ABHEESH", "ABHILASH", "SRUTHY", "DANIEL ABHILASH",
  "ASHA", "RESWIN", "CELINE RESWIN", "ELIZABETH RESWIN", "NIRMALA", "ANU DINOY",
  "DINOY", "POPPY", "POWEL", "PRASOON", "ARUN", "FEMI", "JOSEPH RAPHEAL",
  "TESSY", "KIRON", "RINU", "ALAN", "AEIDEN", "SHEETHAL", "TOM", "SERAH TOM",
  "DANIEL TOM", "GEORGE", "KAVITHA", "JERIN"
];

function normalize(n) {
  return n.trim().toLowerCase().replace(/\s+/g, " ");
}

console.log("==================================================================");
console.log("REGISTRATION RECOVERY & FIRESTORE INTEGRATION TEST SUITE");
console.log("==================================================================");

// 1. Test Mock Central Firestore State
const centralFirestore = {
  participants: new Map()
};

// Seed central Firestore with 45 PENDING participants
OFFICIAL_PARTICIPANTS.forEach(name => {
  const norm = normalize(name);
  const id = norm.replace(/\s+/g, "_");
  centralFirestore.participants.set(id, {
    id,
    officialName: name,
    status: "PENDING",
    registeredByEmail: null,
    registeredByUid: null,
    registeredAt: null
  });
});

assert.strictEqual(centralFirestore.participants.size, 45);
console.log("\n[Test 1] Initialized 45 official participants in central store (All PENDING): ✓ PASSED");

// 2. Test Local Registration in Browser on Client Device
const clientLocalStorage = {
  production: {
    participants: OFFICIAL_PARTICIPANTS.map(name => {
      const norm = normalize(name);
      return {
        id: norm.replace(/\s+/g, "_"),
        officialName: name,
        status: "PENDING",
        registeredByEmail: null,
        registeredAt: null,
        syncedToCentral: false
      };
    })
  }
};

// User registers locally on their phone as "CELINE RESWIN" under "celine@example.com"
const clientEmail = "celine@example.com";
const clientName = "CELINE RESWIN";
const clientNorm = normalize(clientName);
const localTarget = clientLocalStorage.production.participants.find(p => p.id === clientNorm.replace(/\s+/g, "_"));
assert(localTarget, "Target participant must exist");
localTarget.status = "REGISTERED";
localTarget.registeredByEmail = clientEmail;
localTarget.registeredAt = new Date().toISOString();
localTarget.syncedToCentral = false;

console.log(`\n[Test 2] Family member registered locally on phone as "${clientName}" (${clientEmail}): ✓ PASSED`);

// 3. Test Recovery & Sync from Local Device to Central Firestore
function simulateSync(user, localStore, centralStore) {
  const userEmail = user.email.toLowerCase();
  const claims = localStore.production.participants.filter(
    p => p.status === "REGISTERED" && p.registeredByEmail && p.registeredByEmail.toLowerCase() === userEmail
  );

  const recovered = [];
  const errors = [];

  claims.forEach(claim => {
    // Security check: Validate against official 45 roster
    const match = OFFICIAL_PARTICIPANTS.find(o => normalize(o) === normalize(claim.officialName));
    if (!match) {
      errors.push(`Unauthorized name "${claim.officialName}"`);
      return;
    }

    const doc = centralStore.participants.get(claim.id);
    if (!doc) {
      errors.push(`Document ${claim.id} not found in central store`);
      return;
    }

    if (doc.status === "REGISTERED") {
      if (doc.registeredByEmail?.toLowerCase() === userEmail) {
        claim.syncedToCentral = true;
        recovered.push(match);
      } else {
        errors.push(`Conflict: "${match}" was claimed by another email`);
      }
      return;
    }

    // Atomic claim in central store
    doc.status = "REGISTERED";
    doc.registeredByEmail = userEmail;
    doc.registeredByUid = user.uid;
    doc.registeredAt = claim.registeredAt;
    claim.syncedToCentral = true;
    recovered.push(match);
  });

  return { syncedCount: recovered.length, recovered, errors };
}

const syncResult = simulateSync({ email: clientEmail, uid: "uid_celine_123" }, clientLocalStorage, centralFirestore);
assert.strictEqual(syncResult.syncedCount, 1);
assert.strictEqual(syncResult.recovered[0], "CELINE RESWIN");
assert.strictEqual(centralFirestore.participants.get("celine_reswin").status, "REGISTERED");
assert.strictEqual(centralFirestore.participants.get("celine_reswin").registeredByEmail, clientEmail);
console.log(`\n[Test 3] Local registration successfully recovered and synced to central store: ✓ PASSED`);

// 4. Test Duplicate Claim Prevention (Another user tries to claim "CELINE RESWIN")
const attackerEmail = "attacker@example.com";
const attackResult = simulateSync({ email: attackerEmail, uid: "uid_attacker" }, {
  production: {
    participants: [{ id: "celine_reswin", officialName: "CELINE RESWIN", status: "REGISTERED", registeredByEmail: attackerEmail }]
  }
}, centralFirestore);

assert.strictEqual(attackResult.syncedCount, 0);
assert(attackResult.errors.length > 0);
assert(attackResult.errors[0].includes("Conflict"));
console.log("\n[Test 4] Duplicate claim rejected, preserving original claimant: ✓ PASSED");

// 5. Test Multi-Member Registration under Same Email (e.g. Celine also registers "ELIZABETH RESWIN")
const member2 = "ELIZABETH RESWIN";
const member2Id = normalize(member2).replace(/\s+/g, "_");
const localTarget2 = clientLocalStorage.production.participants.find(p => p.id === member2Id);
localTarget2.status = "REGISTERED";
localTarget2.registeredByEmail = clientEmail;
localTarget2.registeredAt = new Date().toISOString();

const syncResult2 = simulateSync({ email: clientEmail, uid: "uid_celine_123" }, clientLocalStorage, centralFirestore);
assert.strictEqual(centralFirestore.participants.get("elizabeth_reswin").status, "REGISTERED");
assert.strictEqual(centralFirestore.participants.get("elizabeth_reswin").registeredByEmail, clientEmail);
console.log(`\n[Test 5] Multi-member registration under same email (${clientEmail} -> CELINE & ELIZABETH): ✓ PASSED`);

// 6. Test Privacy Scoping (Ordinary user cannot view other members' emails)
function queryUserFamily(userEmail, centralStore) {
  const result = [];
  centralStore.participants.forEach(doc => {
    // Only return documents owned by this email
    if (doc.registeredByEmail && doc.registeredByEmail.toLowerCase() === userEmail.toLowerCase()) {
      result.push(doc);
    }
  });
  return result;
}

const celineFamily = queryUserFamily(clientEmail, centralFirestore);
assert.strictEqual(celineFamily.length, 2);
assert(celineFamily.every(m => m.registeredByEmail === clientEmail));

const strangerFamily = queryUserFamily("stranger@example.com", centralFirestore);
assert.strictEqual(strangerFamily.length, 0);
console.log("\n[Test 6] Privacy Scoping: User only accesses their own family records: ✓ PASSED");

// 7. Test Admin View (Admin sees all 45 records with complete registered/pending metrics)
function getAdminOverview(centralStore) {
  const all = Array.from(centralStore.participants.values());
  const registered = all.filter(p => p.status === "REGISTERED");
  const pending = all.filter(p => p.status === "PENDING");
  const uniqueEmails = new Set(registered.map(p => p.registeredByEmail));

  return {
    total: all.length,
    registeredCount: registered.length,
    pendingCount: pending.length,
    uniqueEmailsCount: uniqueEmails.size
  };
}

const adminOverview = getAdminOverview(centralFirestore);
assert.strictEqual(adminOverview.total, 45);
assert.strictEqual(adminOverview.registeredCount, 2);
assert.strictEqual(adminOverview.pendingCount, 43);
assert.strictEqual(adminOverview.uniqueEmailsCount, 1);
console.log("\n[Test 7] Admin Overview: Real-time metrics accurate (45 Total, 2 Registered, 43 Pending): ✓ PASSED");

// 8. Test Export Backup Token Generation
const backupPayload = {
  app: "ChristmasSecretSanta2026",
  exportedAt: new Date().toISOString(),
  userEmail: clientEmail,
  registeredMembers: celineFamily.map(m => ({ officialName: m.officialName, id: m.id }))
};
const token = "SANTA-BACKUP-" + Buffer.from(JSON.stringify(backupPayload)).toString("base64");
assert(token.startsWith("SANTA-BACKUP-"));
const decoded = JSON.parse(Buffer.from(token.replace("SANTA-BACKUP-", ""), "base64").toString("utf8"));
assert.strictEqual(decoded.userEmail, clientEmail);
assert.strictEqual(decoded.registeredMembers.length, 2);
console.log("\n[Test 8] Export Backup Token: Encoded & decoded successfully: ✓ PASSED");

console.log("\n==================================================================");
console.log("ALL 8 RECOVERY & INTEGRATION TESTS PASSED (100% SUCCESS)!");
console.log("==================================================================");
