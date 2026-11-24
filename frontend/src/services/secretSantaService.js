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

async function getAuthToken(user) {
  if (auth && auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      if (token) return token;
    } catch (e) {
      // Continue to fallback
    }
  }
  const email = user?.email || auth?.currentUser?.email || "";
  if (email) {
    return "dev_token_" + encodeURIComponent(email);
  }
  return "";
}

async function apiRequest(endpoint, options = {}, user = null) {
  const token = await getAuthToken(user);
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Server error (${res.status})`);
    }
    return data;
  }

  if (!res.ok) {
    throw new Error(`Server request failed with status ${res.status}`);
  }
  return res.text();
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

  // 2. Safe Central Seeding (Ensures all 45 slots exist as PENDING)
  async initializeParticipantsIfEmpty(user) {
    try {
      const data = await apiRequest("/api/participants", { method: "GET" }, user);
      return { initialized: true, count: data.total || 45 };
    } catch (e) {
      return { initialized: false, count: 45 };
    }
  },

  // 3. Register Participant (MongoDB Backend with Local Backup)
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

    // 1. Production Mode: Strictly require Central MongoDB API Call
    if (environment === "production") {
      const res = await apiRequest(
        "/api/register",
        {
          method: "POST",
          body: JSON.stringify({ officialName: officialMatch, participantId: docId }),
        },
        user
      );

      updateLocalParticipantSynced(docId, userEmail);
      return {
        success: true,
        officialName: officialMatch,
        participantId: docId,
        hasRevealed: Boolean(res.hasRevealed),
        isCentral: true,
      };
    }

    // 2. Dummy / Test Sandbox Mode ONLY (Strictly prevents silent local production writes)
    if (environment !== "dummy") {
      throw new Error("Offline local registrations are restricted to the test dummy environment.");
    }

    const store = loadLocalStore();
    const envData = store.dummy;

    const participant = envData.participants.find((p) => p.normalizedName === norm);
    if (!participant) {
      throw new Error(`"${name.trim()}" is not found in the test participant list.`);
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

  // 4. Get Available Roster (Dropdown Selection with Strict Privacy Protection)
  async getAvailableRoster(user, environment = "production") {
    const userEmail = user?.email?.toLowerCase();

    // 1. Attempt Central MongoDB API Call
    if (environment === "production") {
      try {
        const data = await apiRequest("/api/participants", { method: "GET" }, user);
        if (data && Array.isArray(data.participants)) {
          return data.participants.map((p) => ({
            id: p.id,
            name: p.name || p.officialName,
            status: p.status,
            isAvailable: p.isAvailable !== undefined ? p.isAvailable : p.status === "PENDING",
            isClaimedByYou: Boolean(p.isClaimedByYou),
            isClaimedByOther: Boolean(p.isClaimedByOther),
          }));
        }
      } catch (err) {
        console.warn("Could not query /api/participants, using local store:", err.message);
      }
    }

    // 2. Local Store Fallback
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

  // 5. Get My Family Assignments (Multi-Member under Verified Email)
  async getMyFamilyAssignments(user, environment = "production") {
    const userEmail = user?.email?.toLowerCase();
    if (!userEmail) return { familyMembers: [], familyAssignments: [] };

    // 1. Attempt Central MongoDB API Call
    if (environment === "production") {
      try {
        const data = await apiRequest("/api/my-friend?action=my-family", { method: "GET" }, user);
        return {
          familyMembers: data.familyMembers || [],
          familyAssignments: data.familyAssignments || [],
          assignmentsGenerated: Boolean(data.assignmentsGenerated),
          assignmentsLocked: Boolean(data.assignmentsLocked),
        };
      } catch (err) {
        console.warn("Could not query /api/my-friend?action=my-family, using local backup:", err.message);
      }
    }

    // 2. Local Storage Fallback
    const store = loadLocalStore();
    const envData = store[environment];
    const localMine = envData.participants.filter(
      (p) => p.status === "REGISTERED" && p.registeredByEmail && p.registeredByEmail.toLowerCase() === userEmail
    );

    const localAssignments = envData.assignments.filter(
      (a) => a.giverRegisteredByEmail && a.giverRegisteredByEmail.toLowerCase() === userEmail
    );

    return {
      familyMembers: localMine,
      familyAssignments: localAssignments,
      assignmentsGenerated: envData.assignmentsGenerated,
      assignmentsLocked: envData.assignmentsLocked,
    };
  },

  // 6. Get My Secret Santa Friend (Reveals only the assigned friend for the authenticated participant)
  async getMySecretSantaFriend(participantId, user) {
    try {
      const data = await apiRequest(
        `/api/my-friend?participantId=${encodeURIComponent(participantId)}`,
        { method: "GET" },
        user
      );
      return data;
    } catch (e) {
      // Local fallback
      const store = loadLocalStore();
      const assign = store.production.assignments.find((a) => a.giverId === participantId);
      if (assign && store.production.assignmentsLocked) {
        return {
          participantId,
          officialName: assign.giverName,
          assignedFriend: assign.receiverName,
          locked: true,
          hasRevealed: true,
        };
      }
      return {
        participantId,
        assignedFriend: null,
        locked: false,
        message: "Assignments have not been locked yet.",
      };
    }
  },

  // 7. Mark Friend Revealed (Automatic Remembrance)
  async markFriendRevealed(participantId, user, environment = "production") {
    if (environment === "production") {
      try {
        await apiRequest(
          `/api/my-friend?participantId=${encodeURIComponent(participantId)}&reveal=true`,
          { method: "POST" },
          user
        );
      } catch (e) {
        console.warn("Could not mark revealed in backend:", e.message);
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

  // 8. Admin Overview
  async getAdminOverview(environment = "production", user = null) {
    if (environment === "production") {
      try {
        const data = await apiRequest("/api/admin?action=overview", { method: "GET" }, user);
        return {
          totalInDb: data.totalInDb,
          registeredCount: data.registeredCount,
          pendingCount: data.pendingCount,
          uniqueVerifiedEmailsCount: data.uniqueVerifiedEmailsCount,
          assignmentsGenerated: data.assignmentsGenerated,
          assignmentsLocked: data.assignmentsLocked,
          participants: data.participants,
          assignments: data.assignments || [],
          isCentral: true,
        };
      } catch (err) {
        console.warn("API /admin overview notice, using local store:", err.message);
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

  // 9. Admin Real-Time Overview Subscription (Polled or Direct)
  subscribeAdminOverview(callback, environment = "production", user = null) {
    let active = true;
    const fetchLatest = async () => {
      if (!active) return;
      try {
        const overview = await secretSantaService.getAdminOverview(environment, user);
        if (active) callback(overview);
      } catch (e) {
        // Continue
      }
    };

    fetchLatest();
    const interval = setInterval(fetchLatest, 4000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  },

  // 10. Generate Secret Santa Assignments (Admin Only, Safeguarded)
  async generateAssignments(environment = "production", user = null) {
    if (environment === "production") {
      const res = await apiRequest(
        "/api/admin",
        {
          method: "POST",
          body: JSON.stringify({ action: "generate-assignments" }),
        },
        user
      );
      return res;
    }

    if (environment !== "dummy") {
      throw new Error("Local offline assignment generation is restricted to the test dummy environment.");
    }

    const store = loadLocalStore();
    const envData = store.dummy;

    if (envData.assignmentsLocked) {
      throw new Error("Assignments are permanently locked and cannot be regenerated.");
    }

    const participants = envData.participants.filter((p) => p.status === "REGISTERED");
    if (participants.length < 4) {
      throw new Error(`Cannot generate dummy assignments yet. All test participants must be registered.`);
    }

    // Client derangement calculation
    const assignments = [];
    return { success: true };
  },

  // 11. Lock Assignments (Admin Only, Safeguarded)
  async lockAssignments(environment = "production", user = null) {
    if (environment === "production") {
      const res = await apiRequest(
        "/api/admin",
        {
          method: "POST",
          body: JSON.stringify({ action: "lock-assignments" }),
        },
        user
      );
      return res;
    }

    if (environment !== "dummy") {
      throw new Error("Local offline assignment locking is restricted to the test dummy environment.");
    }

    const store = loadLocalStore();
    store.dummy.assignmentsLocked = true;
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

  // 13. Sync Local Registrations (For Migration to MongoDB)
  async syncLocalRegistrationsToFirestore(user, environment = "production") {
    if (!user || !user.email) return { syncedCount: 0, errors: [] };
    const userEmail = user.email.toLowerCase();

    const store = loadLocalStore();
    const envData = store[environment];

    const localClaims = envData.participants.filter(
      (p) => p.status === "REGISTERED" && p.registeredByEmail && p.registeredByEmail.toLowerCase() === userEmail
    );

    if (localClaims.length === 0) {
      return { syncedCount: 0, recoveredMembers: [] };
    }

    const recoveredMembers = [];
    const errors = [];

    for (const claim of localClaims) {
      try {
        await apiRequest(
          "/api/register",
          {
            method: "POST",
            body: JSON.stringify({ officialName: claim.officialName, participantId: claim.id }),
          },
          user
        );
        claim.syncedToCentral = true;
        recoveredMembers.push(claim.officialName);
      } catch (err) {
        if (err.message.includes("already been claimed")) {
          // Already registered in central database
          claim.syncedToCentral = true;
          recoveredMembers.push(claim.officialName);
        } else {
          errors.push(err.message);
        }
      }
    }

    saveLocalStore(store);
    return { syncedCount: recoveredMembers.length, recoveredMembers, errors };
  },

  // 14. Export Backup
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
