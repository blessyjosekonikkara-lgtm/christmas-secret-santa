const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();

const ADMIN_EMAIL = "blessyjosekonikkara@gmail.com";

// Official list of 45 initial participants (DAISY excluded as instructed)
const INITIAL_OFFICIAL_PARTICIPANTS = [
  "SR BLESSY", "JOSE", "BINDU", "BLESSY", "JOSHUAL", "JOY", "LOUSY", "MERIN",
  "NINTO", "SMRITHY", "HEZLIN NINTO", "DAVIS", "OMANA", "ABHEESH", "ANU ABHEESH",
  "KELVIN ABHEESH", "DALVIN ABHEESH", "ABHILASH", "SRUTHY", "DANIEL ABHILASH",
  "ASHA", "RESWIN", "CELINE RESWIN", "ELIZABETH RESWIN", "NIRMALA", "ANU DINOY",
  "DINOY", "POPPY", "POWEL", "PRASOON", "ARUN", "FEMI", "JOSEPH RAPHEAL",
  "TESSY", "KIRON", "RINU", "ALAN", "AEIDEN", "SHEETHAL", "TOM", "SERAH TOM",
  "DANIEL TOM", "GEORGE", "KAVITHA", "JERIN"
];

const DUMMY_PARTICIPANTS = ["ALICE", "BOB", "CHARLIE", "DAVID"];

/**
 * Normalizes names for strict, case-insensitive, space-trimmed comparisons.
 */
function normalizeName(name) {
  if (!name || typeof name !== "string") return "";
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Generate safe document ID from normalized name.
 */
function toDocId(normalizedName) {
  return normalizedName.replace(/[^a-z0-9]/g, "_");
}

/**
 * Verifies caller is the authorized administrator.
 */
function assertAdmin(context) {
  if (!context.auth || !context.auth.token || !context.auth.token.email) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }
  if (context.auth.token.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    throw new functions.https.HttpsError("permission-denied", "Access restricted to authorized Secret Santa Administrator.");
  }
}

/**
 * Cryptographically secure Derangement Algorithm (Fisher-Yates)
 * Ensures every participant gives 1 gift and receives 1 gift, with 0 self-assignments.
 */
function generateDerangement(items) {
  if (!items || items.length < 2) {
    throw new Error("At least 2 participants required for Secret Santa assignment.");
  }
  
  const n = items.length;
  let attempts = 0;
  const maxAttempts = 1000;

  while (attempts < maxAttempts) {
    attempts++;
    const permutation = [...items];

    // Fisher-Yates with crypto.randomInt
    for (let i = n - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      const temp = permutation[i];
      permutation[i] = permutation[j];
      permutation[j] = temp;
    }

    // Verify derangement condition: permutation[i] !== items[i] for all i
    let isDerangement = true;
    for (let i = 0; i < n; i++) {
      if (permutation[i].id === items[i].id) {
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

  throw new Error("Failed to generate derangement after maximum attempts.");
}

/**
 * 1. Initialize participants in Firestore (Seed 46 participants)
 */
exports.initializeParticipants = functions.https.onCall(async (data, context) => {
  assertAdmin(context);
  const isDummy = data && data.environment === "dummy";
  const list = isDummy ? DUMMY_PARTICIPANTS : INITIAL_OFFICIAL_PARTICIPANTS;
  const collectionName = isDummy ? "dummy_participants" : "participants";

  const batch = db.batch();
  for (const name of list) {
    const norm = normalizeName(name);
    const docId = toDocId(norm);
    const docRef = db.collection(collectionName).doc(docId);
    
    const doc = await docRef.get();
    if (!doc.exists) {
      batch.set(docRef, {
        id: docId,
        officialName: name.trim(),
        normalizedName: norm,
        status: "PENDING",
        registeredByEmail: null,
        registeredByUid: null,
        registeredAt: null,
        hasRevealed: false,
        revealedAt: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  }

  await batch.commit();
  return { success: true, count: list.length, environment: isDummy ? "dummy" : "production" };
});

/**
 * 2. Add New Participant (Admin Only)
 */
exports.addParticipant = functions.https.onCall(async (data, context) => {
  assertAdmin(context);
  const rawName = data && data.officialName;
  if (!rawName || typeof rawName !== "string" || !rawName.trim()) {
    throw new functions.https.HttpsError("invalid-argument", "Valid participant name is required.");
  }

  const cleanName = rawName.trim();
  const norm = normalizeName(cleanName);
  const isDummy = data && data.environment === "dummy";
  const collectionName = isDummy ? "dummy_participants" : "participants";
  const docId = toDocId(norm);

  const docRef = db.collection(collectionName).doc(docId);
  const doc = await docRef.get();
  if (doc.exists) {
    throw new functions.https.HttpsError("already-exists", `Participant "${cleanName}" already exists.`);
  }

  const settingDocId = isDummy ? "dummy" : "production";
  const settingsSnap = await db.collection("systemSettings").doc(settingDocId).get();
  const settings = settingsSnap.exists ? settingsSnap.data() : {};
  if (settings.assignmentsLocked) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Assignments are permanently locked. Adding new participants would invalidate locked assignments unless admin resets assignments first."
    );
  }

  await docRef.set({
    id: docId,
    officialName: cleanName,
    normalizedName: norm,
    status: "PENDING",
    registeredByEmail: null,
    registeredByUid: null,
    registeredAt: null,
    hasRevealed: false,
    revealedAt: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success: true, id: docId, officialName: cleanName };
});

/**
 * 3. Edit Participant Name (Admin Only)
 */
exports.editParticipant = functions.https.onCall(async (data, context) => {
  assertAdmin(context);
  const participantId = data && data.participantId;
  const newOfficialName = data && data.newOfficialName;

  if (!participantId || !newOfficialName || typeof newOfficialName !== "string" || !newOfficialName.trim()) {
    throw new functions.https.HttpsError("invalid-argument", "Participant ID and new name are required.");
  }

  const cleanName = newOfficialName.trim();
  const norm = normalizeName(cleanName);
  const isDummy = data && data.environment === "dummy";
  const collectionName = isDummy ? "dummy_participants" : "participants";
  const assignmentColl = isDummy ? "dummy_assignments" : "assignments";

  const docRef = db.collection(collectionName).doc(participantId);
  const doc = await docRef.get();
  if (!doc.exists) {
    throw new functions.https.HttpsError("not-found", "Participant not found.");
  }

  await docRef.update({
    officialName: cleanName,
    normalizedName: norm,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  const giverAssignSnap = await db.collection(assignmentColl).where("giverId", "==", participantId).get();
  const receiverAssignSnap = await db.collection(assignmentColl).where("receiverId", "==", participantId).get();

  const batch = db.batch();
  giverAssignSnap.forEach(d => batch.update(d.ref, { giverName: cleanName }));
  receiverAssignSnap.forEach(d => batch.update(d.ref, { receiverName: cleanName }));
  await batch.commit();

  return { success: true, participantId, newOfficialName: cleanName };
});

/**
 * 4. Delete Participant (Admin Only)
 */
exports.deleteParticipant = functions.https.onCall(async (data, context) => {
  assertAdmin(context);
  const participantId = data && data.participantId;
  if (!participantId) {
    throw new functions.https.HttpsError("invalid-argument", "Participant ID required.");
  }

  const isDummy = data && data.environment === "dummy";
  const collectionName = isDummy ? "dummy_participants" : "participants";
  const assignmentColl = isDummy ? "dummy_assignments" : "assignments";
  const settingDocId = isDummy ? "dummy" : "production";

  const settingsSnap = await db.collection("systemSettings").doc(settingDocId).get();
  const settings = settingsSnap.exists ? settingsSnap.data() : {};
  if (settings.assignmentsLocked) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Assignments are permanently locked. You cannot delete participants while assignments are locked."
    );
  }

  const docRef = db.collection(collectionName).doc(participantId);
  const doc = await docRef.get();
  if (!doc.exists) {
    throw new functions.https.HttpsError("not-found", "Participant not found.");
  }

  await docRef.delete();

  if (settings.assignmentsGenerated) {
    const existingAssignments = await db.collection(assignmentColl).get();
    const batch = db.batch();
    existingAssignments.forEach(d => batch.delete(d.ref));
    batch.update(db.collection("systemSettings").doc(settingDocId), {
      assignmentsGenerated: false,
      invalidatedReason: `Participant ${doc.data().officialName} was deleted; assignments must be regenerated.`
    });
    await batch.commit();
  }

  return { success: true, deletedName: doc.data().officialName };
});

/**
 * 5. Register Participant Under Caller's Email
 */
exports.registerParticipant = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.token || !context.auth.token.email) {
    throw new functions.https.HttpsError("unauthenticated", "You must be signed in with a verified email link.");
  }

  const rawName = data && data.name;
  if (!rawName || typeof rawName !== "string" || !rawName.trim()) {
    throw new functions.https.HttpsError("invalid-argument", "Participant name is required.");
  }

  const norm = normalizeName(rawName);
  const isDummy = data.environment === "dummy";
  const collectionName = isDummy ? "dummy_participants" : "participants";
  const callerEmail = context.auth.token.email.toLowerCase();
  const callerUid = context.auth.uid;

  const querySnap = await db.collection(collectionName).where("normalizedName", "==", norm).limit(1).get();
  if (querySnap.empty) {
    throw new functions.https.HttpsError(
      "not-found",
      `"${rawName.trim()}" is not found in the official participant list. Please check the spelling.`
    );
  }

  const docRef = querySnap.docs[0].ref;
  const participantData = querySnap.docs[0].data();

  if (participantData.status === "REGISTERED") {
    if (participantData.registeredByEmail === callerEmail) {
      return {
        alreadyRegisteredByYou: true,
        officialName: participantData.officialName,
        participantId: docRef.id,
        hasRevealed: Boolean(participantData.hasRevealed)
      };
    }
    throw new functions.https.HttpsError(
      "already-exists",
      `"${participantData.officialName}" is already registered by another email account.`
    );
  }

  await db.runTransaction(async (transaction) => {
    const freshDoc = await transaction.get(docRef);
    if (freshDoc.data().status === "REGISTERED") {
      throw new functions.https.HttpsError("already-exists", `"${freshDoc.data().officialName}" was just registered by someone else.`);
    }

    transaction.update(docRef, {
      status: "REGISTERED",
      registeredByEmail: callerEmail,
      registeredByUid: callerUid,
      registeredAt: admin.firestore.FieldValue.serverTimestamp(),
      hasRevealed: false
    });

    const userDocRef = db.collection("users").doc(callerUid);
    transaction.set(userDocRef, {
      email: callerEmail,
      isAdmin: callerEmail === ADMIN_EMAIL.toLowerCase(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      registeredParticipants: admin.firestore.FieldValue.arrayUnion({
        id: docRef.id,
        officialName: participantData.officialName,
        registeredAt: new Date().toISOString()
      })
    }, { merge: true });
  });

  return {
    success: true,
    officialName: participantData.officialName,
    participantId: docRef.id,
    hasRevealed: false
  };
});

/**
 * 6. Retrieve Family Members and Assignments for Authenticated Caller
 * Automatically includes hasRevealed status!
 */
exports.getMyFamilyAssignments = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.token || !context.auth.token.email) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }

  const callerEmail = context.auth.token.email.toLowerCase();
  const isDummy = data && data.environment === "dummy";
  const participantColl = isDummy ? "dummy_participants" : "participants";
  const assignmentColl = isDummy ? "dummy_assignments" : "assignments";
  const settingDocId = isDummy ? "dummy" : "production";

  const settingsDoc = await db.collection("systemSettings").doc(settingDocId).get();
  const settings = settingsDoc.exists ? settingsDoc.data() : { assignmentsGenerated: false, assignmentsLocked: false };

  const snap = await db.collection(participantColl).where("registeredByEmail", "==", callerEmail).get();
  const familyMembers = [];
  snap.forEach(doc => {
    const d = doc.data();
    familyMembers.push({
      id: doc.id,
      officialName: d.officialName,
      hasRevealed: Boolean(d.hasRevealed),
      registeredAt: d.registeredAt ? d.registeredAt.toDate().toISOString() : null
    });
  });

  if (!settings.assignmentsGenerated) {
    return {
      status: "NOT_GENERATED",
      locked: false,
      familyMembers: familyMembers.map(m => ({
        id: m.id,
        officialName: m.officialName,
        hasRevealed: false,
        assignedFriend: null
      }))
    };
  }

  const memberResults = [];
  for (const member of familyMembers) {
    const assignSnap = await db.collection(assignmentColl).where("giverId", "==", member.id).limit(1).get();
    let assignedFriend = null;
    let hasRevealed = member.hasRevealed;

    if (!assignSnap.empty) {
      const assignData = assignSnap.docs[0].data();
      assignedFriend = assignData.receiverName;
      if (assignData.hasRevealed) {
        hasRevealed = true;
      }
    }

    memberResults.push({
      id: member.id,
      officialName: member.officialName,
      assignedFriend: assignedFriend,
      hasRevealed: hasRevealed
    });
  }

  return {
    status: "READY",
    locked: settings.assignmentsLocked || false,
    familyMembers: memberResults
  };
});

/**
 * 7. Mark Christmas Friend as Revealed (Permanent Flag)
 * Persists to Firestore so the user never has to re-draw and will always see their friend!
 */
exports.markFriendRevealed = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.token || !context.auth.token.email) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }

  const participantId = data && data.participantId;
  if (!participantId) {
    throw new functions.https.HttpsError("invalid-argument", "Participant ID required.");
  }

  const callerEmail = context.auth.token.email.toLowerCase();
  const isDummy = data.environment === "dummy";
  const participantColl = isDummy ? "dummy_participants" : "participants";
  const assignmentColl = isDummy ? "dummy_assignments" : "assignments";

  const partRef = db.collection(participantColl).doc(participantId);
  const partDoc = await partRef.get();
  if (!partDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Participant not found.");
  }

  // Ensure this participant belongs to the caller
  if (partDoc.data().registeredByEmail !== callerEmail && callerEmail !== ADMIN_EMAIL.toLowerCase()) {
    throw new functions.https.HttpsError("permission-denied", "You can only reveal assignments for your registered family members.");
  }

  const batch = db.batch();
  batch.update(partRef, {
    hasRevealed: true,
    revealedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  const assignSnap = await db.collection(assignmentColl).where("giverId", "==", participantId).limit(1).get();
  if (!assignSnap.empty) {
    batch.update(assignSnap.docs[0].ref, {
      hasRevealed: true,
      revealedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  await batch.commit();

  return { success: true, participantId };
});

/**
 * 8. Generate Assignments (Admin Only)
 */
exports.generateAssignments = functions.https.onCall(async (data, context) => {
  assertAdmin(context);
  const isDummy = data && data.environment === "dummy";
  const participantColl = isDummy ? "dummy_participants" : "participants";
  const assignmentColl = isDummy ? "dummy_assignments" : "assignments";
  const settingDocId = isDummy ? "dummy" : "production";

  const settingsDocRef = db.collection("systemSettings").doc(settingDocId);
  const settingsSnap = await settingsDocRef.get();
  if (settingsSnap.exists && settingsSnap.data().assignmentsLocked) {
    throw new functions.https.HttpsError("failed-precondition", "Assignments are permanently locked.");
  }

  const participantsSnap = await db.collection(participantColl).get();
  const participants = [];
  participantsSnap.forEach(doc => {
    participants.push({
      id: doc.id,
      officialName: doc.data().officialName,
      registeredByEmail: doc.data().registeredByEmail || null,
      registeredByUid: doc.data().registeredByUid || null
    });
  });

  if (participants.length < 2) {
    throw new functions.https.HttpsError("failed-precondition", "Need at least 2 participants to generate Secret Santa assignments.");
  }

  const derangedPairs = generateDerangement(participants);

  // Validate derangement
  const giverIds = new Set();
  const receiverIds = new Set();
  for (const pair of derangedPairs) {
    if (pair.giver.id === pair.receiver.id) {
      throw new functions.https.HttpsError("internal", "Derangement validation failed: self-assignment.");
    }
    giverIds.add(pair.giver.id);
    receiverIds.add(pair.receiver.id);
  }

  if (giverIds.size !== participants.length || receiverIds.size !== participants.length) {
    throw new functions.https.HttpsError("internal", "Derangement validation failed: non-bijective.");
  }

  const existingAssignments = await db.collection(assignmentColl).get();
  const batch = db.batch();
  existingAssignments.forEach(doc => batch.delete(doc.ref));

  for (const pair of derangedPairs) {
    const docRef = db.collection(assignmentColl).doc(pair.giver.id);
    batch.set(docRef, {
      giverId: pair.giver.id,
      giverName: pair.giver.officialName,
      giverRegisteredByEmail: pair.giver.registeredByEmail,
      giverRegisteredByUid: pair.giver.registeredByUid,
      receiverId: pair.receiver.id,
      receiverName: pair.receiver.officialName,
      locked: false,
      hasRevealed: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  batch.set(settingsDocRef, {
    assignmentsGenerated: true,
    assignmentsLocked: false,
    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    totalParticipants: participants.length
  }, { merge: true });

  await batch.commit();

  return {
    success: true,
    totalAssignments: derangedPairs.length,
    environment: isDummy ? "dummy" : "production"
  };
});

/**
 * 9. Lock Assignments Permanently (Admin Only)
 */
exports.lockAssignments = functions.https.onCall(async (data, context) => {
  assertAdmin(context);
  const isDummy = data && data.environment === "dummy";
  const assignmentColl = isDummy ? "dummy_assignments" : "assignments";
  const settingDocId = isDummy ? "dummy" : "production";

  const settingsDocRef = db.collection("systemSettings").doc(settingDocId);
  const settingsSnap = await settingsDocRef.get();
  if (!settingsSnap.exists || !settingsSnap.data().assignmentsGenerated) {
    throw new functions.https.HttpsError("failed-precondition", "Cannot lock assignments before generating them.");
  }

  const batch = db.batch();
  batch.update(settingsDocRef, {
    assignmentsLocked: true,
    lockedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  const assignmentsSnap = await db.collection(assignmentColl).get();
  assignmentsSnap.forEach(doc => {
    batch.update(doc.ref, { locked: true });
  });

  await batch.commit();

  return { success: true, lockedCount: assignmentsSnap.size };
});

/**
 * 10. Reset Assignments (Admin Only)
 */
exports.resetAssignments = functions.https.onCall(async (data, context) => {
  assertAdmin(context);
  const isDummy = data && data.environment === "dummy";
  const assignmentColl = isDummy ? "dummy_assignments" : "assignments";
  const settingDocId = isDummy ? "dummy" : "production";

  const assignmentsSnap = await db.collection(assignmentColl).get();
  const batch = db.batch();
  assignmentsSnap.forEach(doc => batch.delete(doc.ref));

  batch.set(db.collection("systemSettings").doc(settingDocId), {
    assignmentsGenerated: false,
    assignmentsLocked: false,
    resetAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  await batch.commit();

  return { success: true };
});

/**
 * 11. Admin Overview
 */
exports.getAdminOverview = functions.https.onCall(async (data, context) => {
  assertAdmin(context);
  const isDummy = data && data.environment === "dummy";
  const participantColl = isDummy ? "dummy_participants" : "participants";
  const assignmentColl = isDummy ? "dummy_assignments" : "assignments";
  const settingDocId = isDummy ? "dummy" : "production";

  const settingsSnap = await db.collection("systemSettings").doc(settingDocId).get();
  const settings = settingsSnap.exists ? settingsSnap.data() : { assignmentsGenerated: false, assignmentsLocked: false };

  const participantsSnap = await db.collection(participantColl).get();
  const participants = [];
  let registeredCount = 0;
  const emailsSet = new Set();

  participantsSnap.forEach(doc => {
    const d = doc.data();
    if (d.status === "REGISTERED") {
      registeredCount++;
      if (d.registeredByEmail) emailsSet.add(d.registeredByEmail);
    }
    participants.push({
      id: doc.id,
      officialName: d.officialName,
      status: d.status,
      hasRevealed: Boolean(d.hasRevealed),
      registeredByEmail: d.registeredByEmail || null,
      registeredAt: d.registeredAt ? d.registeredAt.toDate().toISOString() : null
    });
  });

  participants.sort((a, b) => a.officialName.localeCompare(b.officialName));

  let assignments = [];
  if (settings.assignmentsGenerated) {
    const assignmentsSnap = await db.collection(assignmentColl).get();
    assignmentsSnap.forEach(doc => {
      const d = doc.data();
      assignments.push({
        giverId: d.giverId,
        giverName: d.giverName,
        giverRegisteredByEmail: d.giverRegisteredByEmail || "Not Registered",
        receiverId: d.receiverId,
        receiverName: d.receiverName,
        hasRevealed: Boolean(d.hasRevealed),
        locked: d.locked
      });
    });
  }

  return {
    totalInDb: participants.length,
    registeredCount,
    pendingCount: participants.length - registeredCount,
    uniqueVerifiedEmailsCount: emailsSet.size,
    assignmentsGenerated: settings.assignmentsGenerated || false,
    assignmentsLocked: settings.assignmentsLocked || false,
    participants,
    assignments
  };
});
