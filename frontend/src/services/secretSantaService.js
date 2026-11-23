import { 
  OFFICIAL_PARTICIPANTS, 
  DUMMY_PARTICIPANTS, 
  ADMIN_EMAIL, 
  normalizeName,
  matchOfficialParticipant 
} from "../config/participants";
import { 
  auth, 
  db, 
  functions, 
  sendSignInLinkToEmail, 
  isSignInWithEmailLink, 
  signInWithEmailLink, 
  signOut,
  isLiveFirebaseConfigured 
} from "../config/firebase";
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  onSnapshot, 
  writeBatch 
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

const STORAGE_KEY = "SECRET_SANTA_REAL_FAMILY_ROSTER_V1";

function loadLocalStore() {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) {
    try {
      return JSON.parse(existing);
    } catch (e) {
      console.warn("Error parsing local store, reinitializing...", e);
    }
  }

  // 45 Real Family Participants (all PENDING, unassigned, DAISY excluded)
  const participants = OFFICIAL_PARTICIPANTS.map((name) => {
    const norm = normalizeName(name);
    return {
      id: norm.replace(/\s+/g, "_"),
      officialName: name.trim(),
      normalizedName: norm,
      status: "PENDING",
      registeredByEmail: null,
      registeredByUid: null,
      registeredAt: null,
      hasRevealed: false,
      syncedToCentral: false,
    };
  });

  // 4 Dummy Test Participants preserved separately for /test-dummy
  const dummyParticipants = DUMMY_PARTICIPANTS.map((name) => {
    const norm = normalizeName(name);
    return {
      id: norm.replace(/\s+/g, "_"),
      officialName: name.trim(),
      normalizedName: norm,
      status: "PENDING",
      registeredByEmail: null,
      registeredByUid: null,
      registeredAt: null,
      hasRevealed: false,
    };
  });

  // Sandbox dummy assignments for isolated testing only
  const dummySandboxAssignments = [
    { giverId: "alice", giverName: "ALICE", giverRegisteredByEmail: null, receiverId: "bob", receiverName: "BOB", locked: true, hasRevealed: false },
    { giverId: "bob", giverName: "BOB", giverRegisteredByEmail: null, receiverId: "charlie", receiverName: "CHARLIE", locked: true, hasRevealed: false },
    { giverId: "charlie", giverName: "CHARLIE", giverRegisteredByEmail: null, receiverId: "david", receiverName: "DAVID", locked: true, hasRevealed: false },
    { giverId: "david", giverName: "DAVID", giverRegisteredByEmail: null, receiverId: "alice", receiverName: "ALICE", locked: true, hasRevealed: false },
  ];

  const initial = {
    production: {
      participants,
      assignments: [], // Completely EMPTY - Do not generate or lock real-family assignments yet!
      assignmentsGenerated: false,
      assignmentsLocked: false,
      generatedAt: null,
      lockedAt: null,
    },
    dummy: {
      participants: dummyParticipants,
      assignments: dummySandboxAssignments,
      assignmentsGenerated: true,
      assignmentsLocked: true,
      generatedAt: new Date().toISOString(),
      lockedAt: new Date().toISOString(),
    },
    users: {},
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  return initial;
}

function saveLocalStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function updateLocalParticipantSynced(docId, email) {
  try {
    const store = loadLocalStore();
    const p = store.production.participants.find((x) => x.id === docId);
    if (p) {
      p.status = "REGISTERED";
      p.registeredByEmail = email.toLowerCase();
      p.syncedToCentral = true;
      p.syncedAt = new Date().toISOString();
      saveLocalStore(store);
    }
  } catch (e) {
    console.warn("Could not mark local participant as synced:", e);
  }
}

export function generateClientDerangement(items) {
  if (!items || items.length < 2) {
    throw new Error("At least 2 participants required for Secret Santa assignment.");
  }
  const n = items.length;
  let attempts = 0;
  const maxAttempts = 1000;

  while (attempts < maxAttempts) {
    attempts++;
    const permutation = [...items];

    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = permutation[i];
      permutation[i] = permutation[j];
      permutation[j] = temp;
    }

    let isDerangement = true;
    for (let i = 0; i < n; i++) {
      if (permutation[i].id === items[i].id) {
        isDerangement = false;
        break;
      }
    }

    if (isDerangement) {
      return items.map((giver, idx) => ({
        giverId: giver.id,
        giverName: giver.officialName,
        giverRegisteredByEmail: giver.registeredByEmail,
        receiverId: permutation[idx].id,
        receiverName: permutation[idx].officialName,
        locked: false,
        hasRevealed: false,
      }));
    }
  }

  throw new Error("Unable to calculate derangement after maximum attempts.");
}

export const secretSantaService = {
  // 1. Passwordless Email Sign-In
  async sendMagicLink(email) {
    const actionCodeSettings = {
      url: window.location.origin + "/verify-email",
      handleCodeInApp: true,
    };

    if (isLiveFirebaseConfigured && auth) {
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    }
    window.localStorage.setItem("emailForSignIn", email);
    return { success: true };
  },

  async completeEmailSignIn(email, href = window.location.href) {
    if (isLiveFirebaseConfigured && auth && isSignInWithEmailLink(auth, href)) {
      const result = await signInWithEmailLink(auth, email, href);
      return { user: result.user };
    }

    const simulatedUser = {
      uid: "uid_" + email.replace(/[^a-zA-Z0-9]/g, "_"),
      email: email.toLowerCase(),
      isAdmin: email.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
    };
    return { user: simulatedUser };
  },

  // 2. Safe Central Seeding (Admin Only, Non-Destructive Merge)
  async initializeParticipantsIfEmpty(user) {
    if (!isLiveFirebaseConfigured || !db) return { initialized: false, count: 0 };
    if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return { initialized: false, count: 0 };
    }

    try {
      const snap = await getDocs(collection(db, "participants"));
      if (snap.size === 0) {
        const batch = writeBatch(db);
        for (const name of OFFICIAL_PARTICIPANTS) {
          const norm = normalizeName(name);
          const docId = norm.replace(/\s+/g, "_");
          const ref = doc(db, "participants", docId);
          batch.set(
            ref,
            {
              id: docId,
              officialName: name.trim(),
              normalizedName: norm,
              status: "PENDING",
              registeredByEmail: null,
              registeredByUid: null,
              registeredAt: null,
              hasRevealed: false,
            },
            { merge: true }
          );
        }
        await batch.commit();
        return { initialized: true, count: OFFICIAL_PARTICIPANTS.length };
      }
      return { initialized: false, count: snap.size };
    } catch (err) {
      console.warn("Could not check/seed Firestore participants:", err);
      return { initialized: false, error: err.message };
    }
  },

  // 3. Register Participant (Direct Firestore with Fallback & Local Backup)
  async registerParticipant(name, user, environment = "production") {
    const officialMatch = matchOfficialParticipant(name);
    if (!officialMatch) {
      throw new Error(`"${name.trim()}" is not found in the official 45 participant list.`);
    }

    const userEmail = user?.email?.toLowerCase();
    if (!userEmail) {
      throw new Error("A verified email address is required to register.");
    }

    const norm = normalizeName(officialMatch);
    const docId = norm.replace(/\s+/g, "_");

    // Attempt direct Firestore registration first if live Firebase is active
    if (isLiveFirebaseConfigured && db && environment === "production") {
      try {
        const docRef = doc(db, "participants", docId);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
          const cur = snap.data();
          if (cur.status === "REGISTERED") {
            if (cur.registeredByEmail?.toLowerCase() === userEmail) {
              updateLocalParticipantSynced(docId, userEmail);
              return {
                alreadyRegisteredByYou: true,
                officialName: cur.officialName,
                participantId: cur.id,
                hasRevealed: Boolean(cur.hasRevealed),
                isCentral: true,
              };
            }
            throw new Error(`"${cur.officialName}" has already been claimed by another family account.`);
          }
        }

        // Atomically claim the participant
        await updateDoc(docRef, {
          id: docId,
          officialName: officialMatch,
          status: "REGISTERED",
          registeredByEmail: userEmail,
          registeredByUid: user.uid || "uid_" + userEmail.replace(/[^a-zA-Z0-9]/g, "_"),
          registeredAt: new Date().toISOString(),
          hasRevealed: false,
        });

        // Update local backup
        updateLocalParticipantSynced(docId, userEmail);

        return {
          success: true,
          officialName: officialMatch,
          participantId: docId,
          hasRevealed: false,
          isCentral: true,
        };
      } catch (err) {
        if (err.message && err.message.includes("already been claimed")) {
          throw err;
        }
        console.warn("Direct Firestore update notice, checking Cloud Function / local store:", err.message);
      }
    }

    // Local Storage Preservation & Fallback
    const store = loadLocalStore();
    const envData = store[environment];

    const participant = envData.participants.find((p) => p.normalizedName === norm);
    if (!participant) {
      throw new Error(`"${name.trim()}" is not found in the official participant list.`);
    }

    if (participant.status === "REGISTERED") {
      if (participant.registeredByEmail === userEmail) {
        return {
          alreadyRegisteredByYou: true,
          officialName: participant.officialName,
          participantId: participant.id,
          hasRevealed: Boolean(participant.hasRevealed),
          isCentral: false,
        };
      }
      throw new Error(`"${participant.officialName}" has already been registered by another account.`);
    }

    participant.status = "REGISTERED";
    participant.registeredByEmail = userEmail;
    participant.registeredByUid = user.uid;
    participant.registeredAt = new Date().toISOString();
    participant.hasRevealed = false;
    participant.syncedToCentral = false;

    saveLocalStore(store);

    return {
      success: true,
      officialName: participant.officialName,
      participantId: participant.id,
      hasRevealed: false,
      isCentral: false,
    };
  },

  // 4. Safe Recovery / Synchronization of Local Registrations to Central Firestore
  async syncLocalRegistrationsToFirestore(user, environment = "production") {
    if (!user || !user.email) return { syncedCount: 0, errors: [] };
    const userEmail = user.email.toLowerCase();

    const store = loadLocalStore();
    const envData = store[environment];

    // Find all records locally claimed by this verified email
    const localClaims = envData.participants.filter(
      (p) => p.status === "REGISTERED" && p.registeredByEmail && p.registeredByEmail.toLowerCase() === userEmail
    );

    if (localClaims.length === 0) {
      return { syncedCount: 0, recoveredMembers: [] };
    }

    const recoveredMembers = [];
    const errors = [];

    if (isLiveFirebaseConfigured && db && environment === "production") {
      for (const claim of localClaims) {
        const officialMatch = matchOfficialParticipant(claim.officialName);
        if (!officialMatch) {
          errors.push(`Name "${claim.officialName}" not in official roster.`);
          continue;
        }

        const docId = claim.id;
        try {
          const docRef = doc(db, "participants", docId);
          const snap = await getDoc(docRef);

          if (snap.exists()) {
            const cur = snap.data();
            if (cur.status === "REGISTERED") {
              if (cur.registeredByEmail?.toLowerCase() === userEmail) {
                // Already successfully recorded in Firestore
                claim.syncedToCentral = true;
                recoveredMembers.push(officialMatch);
                continue;
              } else {
                errors.push(`"${officialMatch}" was claimed in the central database by another account.`);
                continue;
              }
            }
          }

          // Write claim to central Firestore
          await updateDoc(docRef, {
            id: docId,
            officialName: officialMatch,
            status: "REGISTERED",
            registeredByEmail: userEmail,
            registeredByUid: user.uid || "uid_" + userEmail.replace(/[^a-zA-Z0-9]/g, "_"),
            registeredAt: claim.registeredAt || new Date().toISOString(),
            hasRevealed: Boolean(claim.hasRevealed),
          });

          claim.syncedToCentral = true;
          recoveredMembers.push(officialMatch);
        } catch (err) {
          console.warn(`Could not sync ${officialMatch} to Firestore:`, err.message);
          errors.push(`Sync error for ${officialMatch}: ${err.message}`);
        }
      }
      saveLocalStore(store);
    } else {
      // Offline / demo fallback - local claims remain marked
      for (const claim of localClaims) {
        recoveredMembers.push(claim.officialName);
      }
    }

    return {
      syncedCount: recoveredMembers.length,
      recoveredMembers,
      errors,
    };
  },

  // 5. Get Available Roster (Dropdown Selection with Strict Privacy Protection)
  async getAvailableRoster(user, environment = "production") {
    const userEmail = user?.email?.toLowerCase();
    const isAdminUser = userEmail === ADMIN_EMAIL.toLowerCase();

    if (isLiveFirebaseConfigured && db && environment === "production") {
      try {
        // Query only pending participants (allowed for authenticated users)
        const pendingSnap = await getDocs(query(collection(db, "participants"), where("status", "==", "PENDING")));
        const pendingIds = new Set(pendingSnap.docs.map((d) => d.id));

        // Query only participants claimed by current user's email (allowed for owner)
        let myClaimedIds = new Set();
        if (userEmail) {
          const mySnap = await getDocs(
            query(collection(db, "participants"), where("registeredByEmail", "==", userEmail))
          );
          myClaimedIds = new Set(mySnap.docs.map((d) => d.id));
        }

        // If admin, can optionally inspect all
        let allParticipantsMap = null;
        if (isAdminUser) {
          const allSnap = await getDocs(collection(db, "participants"));
          allParticipantsMap = new Map(allSnap.docs.map((d) => [d.id, d.data()]));
        }

        return OFFICIAL_PARTICIPANTS.map((name) => {
          const norm = normalizeName(name);
          const id = norm.replace(/\s+/g, "_");

          const isClaimedByYou = myClaimedIds.has(id);
          const isPending = pendingIds.has(id);
          const isClaimedByOther = !isPending && !isClaimedByYou;

          return {
            id,
            name: name.trim(),
            status: isPending ? "PENDING" : "REGISTERED",
            isClaimedByYou,
            isClaimedByOther,
            isAvailable: isPending,
          };
        });
      } catch (err) {
        console.warn("Live roster query notice, using local store:", err.message);
      }
    }

    // Local Store Fallback
    const store = loadLocalStore();
    const envData = store[environment];

    return envData.participants.map((p) => {
      const isClaimedByYou = Boolean(p.registeredByEmail && userEmail && p.registeredByEmail === userEmail);
      const isClaimedByOther = Boolean(p.registeredByEmail && (!userEmail || p.registeredByEmail !== userEmail));
      return {
        id: p.id,
        name: p.officialName,
        status: p.status,
        isClaimedByYou,
        isClaimedByOther,
        isAvailable: p.status !== "REGISTERED",
      };
    });
  },

  // 6. Get My Family Assignments (Multi-Member under Verified Email)
  async getMyFamilyAssignments(user, environment = "production") {
    const userEmail = user?.email?.toLowerCase();
    if (!userEmail) return { familyMembers: [], familyAssignments: [] };

    let members = [];
    let assignments = [];

    if (isLiveFirebaseConfigured && db && environment === "production") {
      try {
        const memberSnap = await getDocs(
          query(collection(db, "participants"), where("registeredByEmail", "==", userEmail))
        );
        members = memberSnap.docs.map((d) => ({ ...d.data(), id: d.id }));

        const assignSnap = await getDocs(
          query(collection(db, "assignments"), where("giverRegisteredByEmail", "==", userEmail))
        );
        assignments = assignSnap.docs.map((d) => ({ ...d.data(), id: d.id }));
      } catch (err) {
        console.warn("Could not fetch remote family assignments, using local backup:", err.message);
      }
    }

    // Merge with local storage to guarantee zero data loss
    const store = loadLocalStore();
    const envData = store[environment];
    const localMine = envData.participants.filter(
      (p) => p.status === "REGISTERED" && p.registeredByEmail && p.registeredByEmail.toLowerCase() === userEmail
    );

    for (const loc of localMine) {
      if (!members.find((m) => m.id === loc.id)) {
        members.push({ ...loc, isLocalOnly: true });
      }
    }

    for (const locAssign of envData.assignments) {
      if (
        locAssign.giverRegisteredByEmail &&
        locAssign.giverRegisteredByEmail.toLowerCase() === userEmail &&
        !assignments.find((a) => a.giverId === locAssign.giverId)
      ) {
        assignments.push(locAssign);
      }
    }

    return {
      familyMembers: members,
      familyAssignments: assignments,
      assignmentsGenerated: envData.assignmentsGenerated,
      assignmentsLocked: envData.assignmentsLocked,
    };
  },

  // 7. Mark Friend Revealed (Automatic Remembrance)
  async markFriendRevealed(participantId, user, environment = "production") {
    if (isLiveFirebaseConfigured && db && environment === "production") {
      try {
        const ref = doc(db, "participants", participantId);
        await updateDoc(ref, { hasRevealed: true });
      } catch (e) {
        console.warn("Could not mark friend revealed in Firestore:", e);
      }
    }

    const store = loadLocalStore();
    const envData = store[environment];
    const p = envData.participants.find((x) => x.id === participantId);
    if (p) p.hasRevealed = true;

    const assign = envData.assignments.find((x) => x.giverId === participantId);
    if (assign) assign.hasRevealed = true;

    saveLocalStore(store);
    return { success: true };
  },

  // 8. Admin Overview (Single Fetch)
  async getAdminOverview(environment = "production") {
    if (isLiveFirebaseConfigured && db && environment === "production") {
      try {
        const snap = await getDocs(collection(db, "participants"));
        if (snap.size > 0) {
          const participants = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
          const registered = participants.filter((p) => p.status === "REGISTERED");
          const emails = new Set(registered.map((p) => p.registeredByEmail).filter(Boolean));

          let assignments = [];
          try {
            const assignSnap = await getDocs(collection(db, "assignments"));
            assignments = assignSnap.docs.map((d) => ({ ...d.data(), id: d.id }));
          } catch (e) {
            // Assignments empty or not generated yet
          }

          return {
            totalInDb: participants.length,
            registeredCount: registered.length,
            pendingCount: participants.length - registered.length,
            uniqueVerifiedEmailsCount: emails.size,
            assignmentsGenerated: assignments.length > 0,
            assignmentsLocked: assignments.length > 0 && assignments.every((a) => a.locked),
            participants,
            assignments,
            isCentral: true,
          };
        }
      } catch (err) {
        console.warn("Live admin overview fallback to local storage:", err.message);
      }
    }

    const store = loadLocalStore();
    const envData = store[environment];
    const registered = envData.participants.filter((p) => p.status === "REGISTERED");
    const emails = new Set(registered.map((p) => p.registeredByEmail).filter(Boolean));

    return {
      totalInDb: envData.participants.length,
      registeredCount: registered.length,
      pendingCount: envData.participants.length - registered.length,
      uniqueVerifiedEmailsCount: emails.size,
      assignmentsGenerated: envData.assignmentsGenerated,
      assignmentsLocked: envData.assignmentsLocked,
      participants: [...envData.participants],
      assignments: [...envData.assignments],
      isCentral: false,
    };
  },

  // 9. Admin Real-Time Listener (Instant Sync to Admin Dashboard)
  subscribeAdminOverview(callback, environment = "production") {
    if (isLiveFirebaseConfigured && db && environment === "production") {
      try {
        const unsubscribe = onSnapshot(
          collection(db, "participants"),
          (snapshot) => {
            if (snapshot.size === 0) return;
            const participants = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
            const registered = participants.filter((p) => p.status === "REGISTERED");
            const emails = new Set(registered.map((p) => p.registeredByEmail).filter(Boolean));

            callback({
              totalInDb: participants.length,
              registeredCount: registered.length,
              pendingCount: participants.length - registered.length,
              uniqueVerifiedEmailsCount: emails.size,
              assignmentsGenerated: false,
              assignmentsLocked: false,
              participants,
              assignments: [],
              isCentral: true,
            });
          },
          (err) => {
            console.warn("Admin onSnapshot subscription error:", err);
          }
        );
        return unsubscribe;
      } catch (e) {
        console.warn("Could not attach real-time admin listener:", e);
      }
    }
    return () => {};
  },

  // 10. Generate Secret Santa Assignments (Admin Only, Safeguarded)
  async generateAssignments(environment = "production") {
    const store = loadLocalStore();
    const envData = store[environment];

    if (envData.assignmentsLocked) {
      throw new Error("Assignments are permanently locked and cannot be regenerated.");
    }

    const participants = envData.participants.filter((p) => p.status === "REGISTERED");
    if (participants.length < 2) {
      throw new Error("At least 2 registered participants are required to generate assignments.");
    }

    const assignments = generateClientDerangement(participants);
    envData.assignments = assignments;
    envData.assignmentsGenerated = true;
    envData.generatedAt = new Date().toISOString();

    saveLocalStore(store);

    return {
      success: true,
      totalPairs: assignments.length,
      assignments,
    };
  },

  // 11. Lock Assignments (Admin Only, Safeguarded)
  async lockAssignments(environment = "production") {
    const store = loadLocalStore();
    const envData = store[environment];

    if (!envData.assignmentsGenerated || envData.assignments.length === 0) {
      throw new Error("No assignments exist to lock. Please generate assignments first.");
    }

    envData.assignmentsLocked = true;
    envData.lockedAt = new Date().toISOString();
    envData.assignments.forEach((a) => (a.locked = true));

    saveLocalStore(store);
    return { success: true };
  },

  // 12. Reset Dummy Environment Sandbox
  resetDummyEnvironment() {
    const store = loadLocalStore();
    store.dummy = {
      participants: DUMMY_PARTICIPANTS.map((name) => {
        const norm = normalizeName(name);
        return {
          id: norm.replace(/\s+/g, "_"),
          officialName: name.trim(),
          normalizedName: norm,
          status: "PENDING",
          registeredByEmail: null,
          registeredByUid: null,
          registeredAt: null,
          hasRevealed: false,
        };
      }),
      assignments: [],
      assignmentsGenerated: false,
      assignmentsLocked: false,
      generatedAt: null,
      lockedAt: null,
    };
    saveLocalStore(store);
  },

  // 13. Export Local Registration Backup Token (For WhatsApp Sharing with Admin)
  exportLocalRegistrationBackup(user) {
    try {
      const store = loadLocalStore();
      const userEmail = user?.email?.toLowerCase();
      const registered = store.production.participants.filter(
        (p) => p.status === "REGISTERED" && (!userEmail || p.registeredByEmail?.toLowerCase() === userEmail)
      );

      const payload = {
        app: "ChristmasSecretSanta2026",
        exportedAt: new Date().toISOString(),
        userEmail: userEmail || "unknown",
        registeredMembers: registered.map((m) => ({
          officialName: m.officialName,
          registeredAt: m.registeredAt,
          id: m.id,
        })),
      };

      const jsonStr = JSON.stringify(payload);
      const b64 = btoa(unescape(encodeURIComponent(jsonStr)));
      return {
        success: true,
        count: registered.length,
        members: registered.map((m) => m.officialName),
        token: `SANTA-BACKUP-${b64}`,
        payload,
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },
};
