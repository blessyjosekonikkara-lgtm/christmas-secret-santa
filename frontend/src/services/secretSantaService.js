import { 
  OFFICIAL_PARTICIPANTS, 
  DUMMY_PARTICIPANTS, 
  ADMIN_EMAIL, 
  normalizeName 
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

  // Separate sandbox assignments for dummy testing environment only
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

  // 2. Register Participant under Email (Multi-Member Support!)
  async registerParticipant(name, user, environment = "production") {
    if (isLiveFirebaseConfigured && functions) {
      try {
        const fn = httpsCallable(functions, "registerParticipant");
        const res = await fn({ name, environment });
        return res.data;
      } catch (err) {
        console.warn("Live function error, falling back to local simulation:", err.message);
      }
    }

    const store = loadLocalStore();
    const envData = store[environment];
    const norm = normalizeName(name);

    const participant = envData.participants.find((p) => p.normalizedName === norm);
    if (!participant) {
      throw new Error(`"${name.trim()}" is not found in the official participant list. Please verify exact spelling.`);
    }

    if (participant.status === "REGISTERED") {
      if (participant.registeredByEmail === user.email.toLowerCase()) {
        return {
          alreadyRegisteredByYou: true,
          officialName: participant.officialName,
          participantId: participant.id,
          hasRevealed: Boolean(participant.hasRevealed),
        };
      }
      throw new Error(`"${participant.officialName}" has already been registered by another account.`);
    }

    participant.status = "REGISTERED";
    participant.registeredByEmail = user.email.toLowerCase();
    participant.registeredByUid = user.uid;
    participant.registeredAt = new Date().toISOString();
    participant.hasRevealed = false;

    saveLocalStore(store);

    return {
      success: true,
      officialName: participant.officialName,
      participantId: participant.id,
      hasRevealed: false,
    };
  },

  // 2b. Get Available Roster for Name Dropdown Selection
  async getAvailableRoster(user, environment = "production") {
    const store = loadLocalStore();
    const envData = store[environment];
    const userEmail = user?.email?.toLowerCase();

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

  // 2c. Reset Testing Environment (Clean Slate for Dummy Testing)
  async resetTestingEnvironment() {
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
      };
    });

    const resetStore = {
      production: {
        participants,
        assignments: [],
        assignmentsGenerated: false,
        assignmentsLocked: false,
        generatedAt: null,
        lockedAt: null,
      },
      dummy: {
        participants: [...participants],
        assignments: [],
        assignmentsGenerated: false,
        assignmentsLocked: false,
        generatedAt: null,
        lockedAt: null,
      },
      users: {},
    };

    saveLocalStore(resetStore);
    localStorage.removeItem("SECRET_SANTA_SELECTED_MEMBER_ID");
    return { success: true };
  },

  // 3. Get Family Members and Assigned Friends for User
  async getMyFamilyAssignments(user, environment = "production") {
    if (isLiveFirebaseConfigured && functions) {
      try {
        const fn = httpsCallable(functions, "getMyFamilyAssignments");
        const res = await fn({ environment });
        return res.data;
      } catch (err) {
        console.warn("Live function error, falling back to local simulation:", err.message);
      }
    }

    const store = loadLocalStore();
    const envData = store[environment];
    const userEmail = user.email.toLowerCase();

    const family = envData.participants.filter(
      (p) => p.registeredByEmail && p.registeredByEmail === userEmail
    );

    if (!envData.assignmentsGenerated) {
      return {
        status: "NOT_GENERATED",
        locked: false,
        familyMembers: family.map((m) => ({
          id: m.id,
          officialName: m.officialName,
          assignedFriend: null,
          hasRevealed: false,
        })),
      };
    }

    const familyWithFriends = family.map((m) => {
      const assignment = envData.assignments.find((a) => a.giverId === m.id);
      const isRevealed = Boolean(m.hasRevealed || assignment?.hasRevealed);
      return {
        id: m.id,
        officialName: m.officialName,
        assignedFriend: assignment ? assignment.receiverName : null,
        hasRevealed: isRevealed,
      };
    });

    return {
      status: "READY",
      locked: envData.assignmentsLocked,
      familyMembers: familyWithFriends,
    };
  },

  // 4. Mark Christmas Friend as Revealed (Permanent Flag)
  async markFriendRevealed(participantId, environment = "production") {
    if (isLiveFirebaseConfigured && functions) {
      try {
        const fn = httpsCallable(functions, "markFriendRevealed");
        const res = await fn({ participantId, environment });
        return res.data;
      } catch (err) {
        console.warn("Live function error, falling back to local store:", err.message);
      }
    }

    const store = loadLocalStore();
    const envData = store[environment];

    const participant = envData.participants.find((p) => p.id === participantId);
    if (participant) {
      participant.hasRevealed = true;
      participant.revealedAt = new Date().toISOString();
    }

    const assignment = envData.assignments.find((a) => a.giverId === participantId);
    if (assignment) {
      assignment.hasRevealed = true;
      assignment.revealedAt = new Date().toISOString();
    }

    saveLocalStore(store);
    return { success: true, participantId };
  },

  // 5. Admin: Add Participant
  async addParticipant(officialName, environment = "production") {
    if (isLiveFirebaseConfigured && functions) {
      try {
        const fn = httpsCallable(functions, "addParticipant");
        const res = await fn({ officialName, environment });
        return res.data;
      } catch (err) {
        console.warn("Live function fallback:", err.message);
      }
    }

    const store = loadLocalStore();
    const envData = store[environment];
    const norm = normalizeName(officialName);

    if (envData.participants.some((p) => p.normalizedName === norm)) {
      throw new Error(`Participant "${officialName.trim()}" already exists in the list.`);
    }

    if (envData.assignmentsLocked) {
      throw new Error("Assignments are permanently locked. You must reset assignments before adding new participants.");
    }

    const newId = norm.replace(/\s+/g, "_");
    envData.participants.push({
      id: newId,
      officialName: officialName.trim(),
      normalizedName: norm,
      status: "PENDING",
      registeredByEmail: null,
      registeredByUid: null,
      registeredAt: null,
      hasRevealed: false,
    });

    saveLocalStore(store);
    return { success: true, officialName: officialName.trim(), id: newId };
  },

  // 6. Admin: Edit Participant Name
  async editParticipant(participantId, newOfficialName, environment = "production") {
    if (isLiveFirebaseConfigured && functions) {
      try {
        const fn = httpsCallable(functions, "editParticipant");
        const res = await fn({ participantId, newOfficialName, environment });
        return res.data;
      } catch (err) {
        console.warn("Live function fallback:", err.message);
      }
    }

    const store = loadLocalStore();
    const envData = store[environment];
    const participant = envData.participants.find((p) => p.id === participantId);

    if (!participant) {
      throw new Error("Participant not found.");
    }

    participant.officialName = newOfficialName.trim();
    participant.normalizedName = normalizeName(newOfficialName);

    envData.assignments.forEach((a) => {
      if (a.giverId === participantId) a.giverName = newOfficialName.trim();
      if (a.receiverId === participantId) a.receiverName = newOfficialName.trim();
    });

    saveLocalStore(store);
    return { success: true, participantId, newOfficialName: newOfficialName.trim() };
  },

  // 7. Admin: Delete Participant
  async deleteParticipant(participantId, environment = "production") {
    if (isLiveFirebaseConfigured && functions) {
      try {
        const fn = httpsCallable(functions, "deleteParticipant");
        const res = await fn({ participantId, environment });
        return res.data;
      } catch (err) {
        console.warn("Live function fallback:", err.message);
      }
    }

    const store = loadLocalStore();
    const envData = store[environment];

    if (envData.assignmentsLocked) {
      throw new Error("Assignments are locked! Reset assignments first before deleting participants.");
    }

    const index = envData.participants.findIndex((p) => p.id === participantId);
    if (index === -1) {
      throw new Error("Participant not found.");
    }

    const deleted = envData.participants.splice(index, 1)[0];

    if (envData.assignmentsGenerated) {
      envData.assignments = [];
      envData.assignmentsGenerated = false;
      envData.invalidatedReason = `Participant ${deleted.officialName} was deleted; assignments must be regenerated.`;
    }

    saveLocalStore(store);
    return { success: true, deletedName: deleted.officialName };
  },

  // 8. Admin: Generate Secret Santa Assignments
  async generateAssignments(environment = "production") {
    if (isLiveFirebaseConfigured && functions) {
      try {
        const fn = httpsCallable(functions, "generateAssignments");
        const res = await fn({ environment });
        return res.data;
      } catch (err) {
        console.warn("Live function fallback:", err.message);
      }
    }

    const store = loadLocalStore();
    const envData = store[environment];

    if (envData.assignmentsLocked) {
      throw new Error("Assignments are permanently locked and cannot be regenerated.");
    }

    if (envData.participants.length < 2) {
      throw new Error("At least 2 participants are required.");
    }

    const pairings = generateClientDerangement(envData.participants);

    envData.assignments = pairings;
    envData.assignmentsGenerated = true;
    envData.generatedAt = new Date().toISOString();

    saveLocalStore(store);
    return { success: true, totalAssignments: pairings.length };
  },

  // 9. Admin: Lock Assignments Permanently
  async lockAssignments(environment = "production") {
    if (isLiveFirebaseConfigured && functions) {
      try {
        const fn = httpsCallable(functions, "lockAssignments");
        const res = await fn({ environment });
        return res.data;
      } catch (err) {
        console.warn("Live function fallback:", err.message);
      }
    }

    const store = loadLocalStore();
    const envData = store[environment];

    if (!envData.assignmentsGenerated) {
      throw new Error("Cannot lock assignments before generating them.");
    }

    envData.assignmentsLocked = true;
    envData.lockedAt = new Date().toISOString();
    envData.assignments.forEach((a) => (a.locked = true));

    saveLocalStore(store);
    return { success: true, lockedCount: envData.assignments.length };
  },

  // 10. Admin: Reset Assignments
  async resetAssignments(environment = "production") {
    if (isLiveFirebaseConfigured && functions) {
      try {
        const fn = httpsCallable(functions, "resetAssignments");
        const res = await fn({ environment });
        return res.data;
      } catch (err) {
        console.warn("Live function fallback:", err.message);
      }
    }

    const store = loadLocalStore();
    const envData = store[environment];

    envData.assignments = [];
    envData.assignmentsGenerated = false;
    envData.assignmentsLocked = false;
    envData.generatedAt = null;
    envData.lockedAt = null;

    saveLocalStore(store);
    return { success: true };
  },

  // 11. Admin: Get Overview & Complete Matrix
  async getAdminOverview(environment = "production") {
    if (isLiveFirebaseConfigured && functions) {
      try {
        const fn = httpsCallable(functions, "getAdminOverview");
        const res = await fn({ environment });
        return res.data;
      } catch (err) {
        console.warn("Live function fallback:", err.message);
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
    };
  },

  // 12. Reset dummy environment to clean state
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
};
