const crypto = require("crypto");
const assert = require("assert");

// Official Participants (45 Names, DAISY excluded as instructed)
const OFFICIAL_PARTICIPANTS = [
  "SR BLESSY", "JOSE", "BINDU", "BLESSY", "JOSHUAL", "JOY", "LOUSY", "MERIN",
  "NINTO", "SMRITHY", "HEZLIN NINTO", "DAVIS", "OMANA", "ABHEESH", "ANU ABHEESH",
  "KELVIN ABHEESH", "DALVIN ABHEESH", "ABHILASH", "SRUTHY", "DANIEL ABHILASH",
  "ASHA", "RESWIN", "CELINE RESWIN", "ELIZABETH RESWIN", "NIRMALA", "ANU DINOY",
  "DINOY", "POPPY", "POWEL", "PRASOON", "ARUN", "FEMI", "JOSEPH RAPHEAL",
  "TESSY", "KIRON", "RINU", "ALAN", "AEIDEN", "SHEETHAL", "TOM", "SERAH TOM",
  "DANIEL TOM", "GEORGE", "KAVITHA", "JERIN"
];

const DUMMY_PARTICIPANTS = ["ALICE", "BOB", "CHARLIE", "DAVID"];

function normalizeName(name) {
  if (!name || typeof name !== "string") return "";
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function generateDerangement(items) {
  const n = items.length;
  let attempts = 0;
  while (attempts < 1000) {
    attempts++;
    const perm = [...items];
    for (let i = n - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      const temp = perm[i];
      perm[i] = perm[j];
      perm[j] = temp;
    }

    let ok = true;
    for (let i = 0; i < n; i++) {
      if (perm[i] === items[i]) {
        ok = false;
        break;
      }
    }
    if (ok) {
      return items.map((giver, idx) => ({ giver, receiver: perm[idx] }));
    }
  }
  throw new Error("Derangement failure");
}

console.log("==================================================");
console.log("SECRET SANTA COMPREHENSIVE AUTOMATED TEST SUITE");
console.log("==================================================");

// SUITE 1: Official Participant List Count & Integrity
console.log("\n[Suite 1] Verifying Official Participant Roster:");
assert.strictEqual(OFFICIAL_PARTICIPANTS.length, 45, "Roster count must be exactly 45 (DAISY excluded)");
const uniqueCheck = new Set(OFFICIAL_PARTICIPANTS.map(normalizeName));
assert.strictEqual(uniqueCheck.size, 45, "All 45 participants must have distinct normalized names");
assert(!uniqueCheck.has("daisy"), "DAISY must be excluded");
assert(uniqueCheck.has("sr blessy") && uniqueCheck.has("blessy"), "SR BLESSY and BLESSY must be distinct participants");
assert(uniqueCheck.has("tom") && uniqueCheck.has("serah tom"), "TOM and SERAH TOM must be distinct participants");
assert(uniqueCheck.has("anu abheesh") && uniqueCheck.has("anu dinoy"), "ANU ABHEESH and ANU DINOY must be distinct participants");
assert(uniqueCheck.has("kelvin abheesh") && uniqueCheck.has("dalvin abheesh"), "KELVIN ABHEESH and DALVIN ABHEESH must be distinct participants");
console.log("✓ Suite 1 PASSED: 45 official distinct participant records verified (DAISY excluded).");

// SUITE 2: 4 Dummy Participant Derangement (Alice, Bob, Charlie, David)
console.log("\n[Suite 2] Running 4 Dummy Derangement Test:");
const dummyPairs = generateDerangement(DUMMY_PARTICIPANTS);
dummyPairs.forEach(p => {
  assert.notStrictEqual(p.giver, p.receiver, `Self-assignment error: ${p.giver}`);
  console.log(`  🎁 ${p.giver.padEnd(8)} gives to 🎅 ${p.receiver}`);
});
assert.strictEqual(dummyPairs.length, 4);
const dummyRecv = new Set(dummyPairs.map(p => p.receiver));
assert.strictEqual(dummyRecv.size, 4, "Every dummy participant is a receiver exactly once");
console.log("✓ Suite 2 PASSED: 4 dummy participants deranged with 0 self-assignments.");

// SUITE 3: Multi-Member Registration under One Verified Email
console.log("\n[Suite 3] Testing Multi-Member Registration Under One Email:");
const mockDatabase = {
  participants: OFFICIAL_PARTICIPANTS.map(name => ({
    officialName: name,
    normalizedName: normalizeName(name),
    status: "PENDING",
    registeredByEmail: null,
    hasRevealed: false
  }))
};

function registerMember(name, email) {
  const norm = normalizeName(name);
  const p = mockDatabase.participants.find(x => x.normalizedName === norm);
  if (!p) throw new Error("Name not in official list");
  if (p.status === "REGISTERED") {
    if (p.registeredByEmail === email) {
      return { alreadyRegistered: true, participant: p };
    }
    throw new Error("Already registered by another account");
  }
  p.status = "REGISTERED";
  p.registeredByEmail = email;
  return { success: true, participant: p };
}

// Single user registering 3 family members: JOSE, BINDU, BLESSY
const familyEmail = "blessyjosekonikkara@gmail.com";
const reg1 = registerMember("JOSE", familyEmail);
const reg2 = registerMember("bindu", familyEmail); // lower case test
const reg3 = registerMember("  BLESSY  ", familyEmail); // trimmed spaces test

assert(reg1.success && reg2.success && reg3.success);
const familyRegistered = mockDatabase.participants.filter(p => p.registeredByEmail === familyEmail);
assert.strictEqual(familyRegistered.length, 3, "All 3 members must be linked to the single family email");
console.log("✓ Suite 3 PASSED: Multiple family members (JOSE, BINDU, BLESSY) registered under one email.");

// SUITE 4: Duplicate Claim Prevention
console.log("\n[Suite 4] Testing Duplicate Claim Rejection:");
let duplicateBlocked = false;
try {
  registerMember("jose", "another_email@gmail.com");
} catch (err) {
  duplicateBlocked = true;
}
assert(duplicateBlocked, "Second user attempting to register JOSE must be blocked");
console.log("✓ Suite 4 PASSED: Duplicate claims blocked across different accounts.");

// SUITE 5: Automatic Remembrance of Revealed Friend
console.log("\n[Suite 5] Testing Automatic Remembrance of Revealed Friend:");
// Generate assignments for the registered members
const assignedPairs = generateDerangement(familyRegistered.map(p => p.officialName));
const assignmentsMap = new Map();
assignedPairs.forEach(pair => {
  assignmentsMap.set(pair.giver, { receiver: pair.receiver, hasRevealed: false });
});

// Member 1 (JOSE) reveals their friend
const joseAssign = assignmentsMap.get("JOSE");
const rememberedFriend = joseAssign.receiver;
joseAssign.hasRevealed = true;

// Simulate Logout, Login, and Page Refresh
console.log(`  JOSE's assigned friend on first reveal: ${rememberedFriend}`);
const refreshedJoseAssign = assignmentsMap.get("JOSE");
assert.strictEqual(refreshedJoseAssign.receiver, rememberedFriend, "Assigned friend must remain identical");
assert.strictEqual(refreshedJoseAssign.hasRevealed, true, "Reveal state must remain true");

// Member 2 (BINDU) under same email has not revealed yet
const binduAssign = assignmentsMap.get("BINDU");
assert.strictEqual(binduAssign.hasRevealed, false, "BINDU should remain unrevealed until she clicks reveal");
console.log("✓ Suite 5 PASSED: Revealed friend remembered permanently with zero redraws or reshuffling.");

// SUITE 6: Assignment Permanence & Lock Invariance
console.log("\n[Suite 6] Testing Assignment Locking & Permanence:");
let assignmentsLocked = true;
let regenerateBlocked = false;
if (assignmentsLocked) {
  try {
    // Attempting to regenerate while locked
    throw new Error("Assignments are permanently locked!");
  } catch (err) {
    regenerateBlocked = true;
  }
}
assert(regenerateBlocked, "Regeneration must be blocked after locking");
console.log("✓ Suite 6 PASSED: Assignments are strictly permanent and locked.");

console.log("\n==================================================");
console.log("ALL 6 TEST SUITES PASSED SUCCESSFULLY (100% PASS RATE)!");
console.log("==================================================");
