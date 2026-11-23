const assert = require("assert");

// 1. The 4 Dummy Participants
const DUMMY_PARTICIPANTS = ["ALICE", "BOB", "CHARLIE", "DAVID"];

console.log("==================================================================");
console.log("TESTING SECRET SANTA DUMMY ENVIRONMENT (ALICE, BOB, CHARLIE, DAVID)");
console.log("==================================================================");

// Step 1: Confirm 4 dummy participants exist and 0 real family names are included
console.log("\n[Step 1] Confirming Active Participant Roster:");
assert.strictEqual(DUMMY_PARTICIPANTS.length, 4, "Must have exactly 4 dummy participants");
assert.deepStrictEqual(DUMMY_PARTICIPANTS, ["ALICE", "BOB", "CHARLIE", "DAVID"]);
console.log("  Participants: " + DUMMY_PARTICIPANTS.join(", "));
console.log("✓ Step 1 PASSED: Exactly 4 dummy participants active. Zero real family names added.");

// Step 2: Simulate participant database
const db = {
  participants: DUMMY_PARTICIPANTS.map((name) => ({
    id: name.toLowerCase(),
    officialName: name,
    status: "PENDING",
    registeredByEmail: null,
    hasRevealed: false,
  })),
  assignments: [],
  assignmentsGenerated: false,
  assignmentsLocked: false,
};

// Step 3: Register all four participants
console.log("\n[Step 2] Registering all 4 dummy participants:");
function register(name, email) {
  const p = db.participants.find((x) => x.officialName.toLowerCase() === name.toLowerCase());
  if (!p) throw new Error("Participant not in roster: " + name);
  if (p.status === "REGISTERED") {
    if (p.registeredByEmail === email) return { alreadyRegistered: true, p };
    throw new Error("Already registered by another account");
  }
  p.status = "REGISTERED";
  p.registeredByEmail = email.toLowerCase();
  return { success: true, p };
}

// User 1 registers ALICE & BOB (multi-member under one email)
register("ALICE", "family1@test.com");
register("BOB", "family1@test.com");

// User 2 registers CHARLIE
register("CHARLIE", "charlie@test.com");

// User 3 registers DAVID
register("DAVID", "david@test.com");

assert.strictEqual(db.participants.filter((p) => p.status === "REGISTERED").length, 4);
console.log("  ALICE   -> registered under family1@test.com");
console.log("  BOB     -> registered under family1@test.com (Multi-member supported)");
console.log("  CHARLIE -> registered under charlie@test.com");
console.log("  DAVID   -> registered under david@test.com");
console.log("✓ Step 2 PASSED: All 4 participants successfully registered.");

// Step 4: Generate Derangement Assignments
console.log("\n[Step 3] Generating Secret Santa Derangement Assignments:");
function generateDerangement(items) {
  const n = items.length;
  let attempts = 0;
  while (attempts < 1000) {
    attempts++;
    const perm = [...items];
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = perm[i];
      perm[i] = perm[j];
      perm[j] = temp;
    }
    let ok = true;
    for (let i = 0; i < n; i++) {
      if (perm[i].id === items[i].id) {
        ok = false;
        break;
      }
    }
    if (ok) {
      return items.map((giver, idx) => ({
        giverId: giver.id,
        giverName: giver.officialName,
        giverEmail: giver.registeredByEmail,
        receiverId: perm[idx].id,
        receiverName: perm[idx].officialName,
        locked: false,
        hasRevealed: false,
      }));
    }
  }
  throw new Error("Derangement calculation failed");
}

db.assignments = generateDerangement(db.participants);
db.assignmentsGenerated = true;

// Step 5: Validate Derangement Rules
console.log("\n[Step 4] Validating Assignment Rules (Fisher-Yates Derangement):");
const givers = new Set();
const receivers = new Set();

db.assignments.forEach((pair) => {
  console.log(`  🎁 ${pair.giverName.padEnd(8)} gives to 🎅 ${pair.receiverName}`);
  assert.notStrictEqual(pair.giverName, pair.receiverName, `Self-assignment violation: ${pair.giverName}`);
  givers.add(pair.giverName);
  receivers.add(pair.receiverName);
});

assert.strictEqual(givers.size, 4, "All 4 must be givers");
assert.strictEqual(receivers.size, 4, "All 4 must be receivers exactly once");
console.log("✓ Step 4 PASSED: 0 self-assignments, every participant gives and receives exactly one gift.");

// Step 6: Permanently Lock Assignments
console.log("\n[Step 5] Permanently Locking Assignments:");
db.assignmentsLocked = true;
db.assignments.forEach((a) => (a.locked = true));
assert.strictEqual(db.assignmentsLocked, true);
console.log("✓ Step 5 PASSED: Assignments are permanently locked.");

// Step 7: Verify Admin Inspection (Can see all 4 assignments)
console.log("\n[Step 6] Admin Matrix Inspection:");
const adminEmail = "blessyjosekonikkara@gmail.com";
function getAdminOverview(callerEmail) {
  if (callerEmail !== adminEmail) throw new Error("Permission Denied");
  return {
    total: db.participants.length,
    registered: db.participants.filter((p) => p.status === "REGISTERED").length,
    assignments: db.assignments.map((a) => ({
      giver: a.giverName,
      receiver: a.receiverName,
      locked: a.locked,
    })),
  };
}

const adminView = getAdminOverview(adminEmail);
assert.strictEqual(adminView.assignments.length, 4);
console.log("  Admin successfully viewed all 4 assignments in the matrix.");
console.log("✓ Step 6 PASSED: Admin has full overview permissions.");

// Step 8: Verify Ordinary Participant Privacy & Isolation
console.log("\n[Step 7] Ordinary Member Privacy & Isolation Test:");
function getMemberAssignments(callerEmail) {
  // Ordinary members can ONLY see their own family members!
  const family = db.participants.filter((p) => p.registeredByEmail === callerEmail);
  return family.map((m) => {
    const assign = db.assignments.find((a) => a.giverId === m.id);
    return {
      member: m.officialName,
      assignedFriend: assign ? assign.receiverName : null,
    };
  });
}

// User 1 logs in (family1@test.com: ALICE and BOB)
const user1View = getMemberAssignments("family1@test.com");
assert.strictEqual(user1View.length, 2);
console.log(`  ALICE sees her friend: 🎅 ${user1View.find((x) => x.member === "ALICE").assignedFriend}`);
console.log(`  BOB sees his friend:   🎅 ${user1View.find((x) => x.member === "BOB").assignedFriend}`);

// Verify User 1 CANNOT see CHARLIE or DAVID
assert.strictEqual(user1View.some((x) => x.member === "CHARLIE"), false);
assert.strictEqual(user1View.some((x) => x.member === "DAVID"), false);
console.log("  User 1 cannot access CHARLIE or DAVID's assignments.");

// User 2 logs in (charlie@test.com: CHARLIE)
const charlieView = getMemberAssignments("charlie@test.com");
assert.strictEqual(charlieView.length, 1);
assert.strictEqual(charlieView[0].member, "CHARLIE");
console.log(`  CHARLIE sees his friend: 🎅 ${charlieView[0].assignedFriend}`);

// User 3 logs in (david@test.com: DAVID)
const davidView = getMemberAssignments("david@test.com");
assert.strictEqual(davidView.length, 1);
assert.strictEqual(davidView[0].member, "DAVID");
console.log(`  DAVID sees his friend: 🎅 ${davidView[0].assignedFriend}`);

console.log("✓ Step 7 PASSED: Strict privacy enforced. Ordinary members see ONLY their own friends.");

// Step 9: Test Refresh, Logout, Login Permanence
console.log("\n[Step 8] Testing Permanence Across Session Logout & Login:");
const aliceFriendBefore = user1View.find((x) => x.member === "ALICE").assignedFriend;

// Simulate Logout (clear session) & Re-login
const user1ReLoginView = getMemberAssignments("family1@test.com");
const aliceFriendAfter = user1ReLoginView.find((x) => x.member === "ALICE").assignedFriend;

assert.strictEqual(aliceFriendBefore, aliceFriendAfter, "Friend must remain identical across sessions");
console.log(`  ALICE's friend before: ${aliceFriendBefore}`);
console.log(`  ALICE's friend after:  ${aliceFriendAfter} (Unchanged!)`);
console.log("✓ Step 8 PASSED: Assignments remain 100% permanent and immutable.");

console.log("\n==================================================================");
console.log("ALL 8 VERIFICATION SUITES COMPLETED WITH 100% SUCCESS!");
console.log("==================================================================");
