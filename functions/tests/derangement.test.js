const crypto = require("crypto");
const assert = require("assert");

function generateDerangement(items) {
  if (!items || items.length < 2) {
    throw new Error("At least 2 participants required for derangement.");
  }
  
  const n = items.length;
  let attempts = 0;
  const maxAttempts = 1000;

  while (attempts < maxAttempts) {
    attempts++;
    const permutation = [...items];

    // Fisher-Yates shuffle using cryptographically secure random integers
    for (let i = n - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      const temp = permutation[i];
      permutation[i] = permutation[j];
      permutation[j] = temp;
    }

    // Verify derangement condition: nobody gets themselves
    let isDerangement = true;
    for (let i = 0; i < n; i++) {
      if (permutation[i] === items[i]) {
        isDerangement = false;
        break;
      }
    }

    if (isDerangement) {
      return items.map((giver, idx) => ({
        giver,
        receiver: permutation[idx]
      }));
    }
  }

  throw new Error("Failed to generate valid derangement after maximum attempts.");
}

console.log("==================================================");
console.log("RUNNING DERANGEMENT ALGORITHM VERIFICATION TESTS");
console.log("==================================================");

// Test 1: 4 Dummy participants (Alice, Bob, Charlie, David)
console.log("\n[Test 1] Testing with 4 Dummy Participants:");
const dummyNames = ["ALICE", "BOB", "CHARLIE", "DAVID"];
const dummyResult = generateDerangement(dummyNames);

console.log("Assignments generated:");
dummyResult.forEach(pair => {
  console.log(`  🎁 ${pair.giver}  -->  🎅 ${pair.receiver}`);
  assert.notStrictEqual(pair.giver, pair.receiver, `Self-assignment found for ${pair.giver}!`);
});

assert.strictEqual(dummyResult.length, 4, "Result must have 4 pairs");
const dummyReceivers = new Set(dummyResult.map(p => p.receiver));
assert.strictEqual(dummyReceivers.size, 4, "All 4 receivers must be distinct");
dummyNames.forEach(name => {
  assert(dummyReceivers.has(name), `Receiver ${name} is missing`);
});
console.log("✓ Test 1 PASSED: 4 Dummy participants perfectly deranged without self-match.");

// Test 2: 46 Official participants
console.log("\n[Test 2] Testing with all 46 Official Participants:");
const officialNames = [
  "SR BLESSY", "JOSE", "BINDU", "BLESSY", "JOSHUAL", "JOY", "LOUSY", "MERIN",
  "NINTO", "SMRITHY", "HEZLIN NINTO", "DAVIS", "OMANA", "ABHEESH", "ANU ABHEESH",
  "KELVIN ABHEESH", "DALVIN ABHEESH", "ABHILASH", "SRUTHY", "DANIEL ABHILASH",
  "ASHA", "RESWIN", "CELINE RESWIN", "ELIZABETH RESWIN", "NIRMALA", "ANU DINOY",
  "DINOY", "POPPY", "POWEL", "PRASOON", "ARUN", "FEMI", "JOSEPH RAPHEAL",
  "TESSY", "KIRON", "RINU", "ALAN", "AEIDEN", "SHEETHAL", "TOM", "SERAH TOM",
  "DANIEL TOM", "GEORGE", "KAVITHA", "DAISY", "JERIN"
];

assert.strictEqual(officialNames.length, 46, "Official participant count must be exactly 46");
const officialResult = generateDerangement(officialNames);

assert.strictEqual(officialResult.length, 46, "Assignments count must be 46");
const officialReceivers = new Set();
const officialGivers = new Set();

officialResult.forEach(pair => {
  assert.notStrictEqual(pair.giver, pair.receiver, `Self-assignment detected: ${pair.giver} got themselves!`);
  officialGivers.add(pair.giver);
  officialReceivers.add(pair.receiver);
});

assert.strictEqual(officialGivers.size, 46, "All 46 participants must give a gift");
assert.strictEqual(officialReceivers.size, 46, "All 46 participants must receive a gift");
console.log("✓ Test 2 PASSED: 46 Official participants successfully deranged with 0 self-assignments and 100% uniqueness.");

// Test 3: Monte Carlo / Stress Test (1,000 continuous derangements)
console.log("\n[Test 3] Stress Testing: 1,000 successive derangements for 46 participants...");
for (let run = 1; run <= 1000; run++) {
  const runResult = generateDerangement(officialNames);
  for (let i = 0; i < runResult.length; i++) {
    if (runResult[i].giver === runResult[i].receiver) {
      throw new Error(`Self assignment detected on run #${run} for ${runResult[i].giver}`);
    }
  }
}
console.log("✓ Test 3 PASSED: 1,000 consecutive runs completed successfully without a single violation!");
console.log("\n==================================================");
console.log("ALL DERANGEMENT TESTS COMPLETED WITH 100% PASS RATE");
console.log("==================================================");
