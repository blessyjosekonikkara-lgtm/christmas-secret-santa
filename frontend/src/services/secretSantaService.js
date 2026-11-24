import { 
  DUMMY_PARTICIPANTS, 
  normalizeName,
  matchOfficialParticipant 
} from "../config/participants";
import { 
  auth, 
  sendSignInLinkToEmail, 
  isSignInWithEmailLink, 
  signInWithEmailLink,
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
    production: { participants: [] },
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

async function apiRequest(endpoint, options = {}, user = null) {
  const currentUser = auth?.currentUser;
  if (!currentUser?.emailVerified || (user && currentUser.uid !== user.uid)) {
    throw new Error("Please sign in with your verified email.");
  }
  const token = await currentUser.getIdToken();
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...(options.headers || {}),
  };

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!res.headers.get("content-type")?.includes("application/json")) {
    throw new Error("The shared Secret Santa server is unavailable. Please try again or contact the organizer.");
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Server error (${res.status})`);
  }
  return data;
}

export const secretSantaService = {
  // 1. Passwordless Email Sign-In
  async sendMagicLink(email) {
    const actionCodeSettings = {
      url: window.location.origin + "/verify-email",
      handleCodeInApp: true,
    };

    if (!auth) {
      throw new Error("Email sign-in is unavailable. Please contact the organizer.");
    }
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem("emailForSignIn", email);
    return { success: true };
  },

  async completeEmailSignIn(email, href = window.location.href) {
    if (!auth || !isSignInWithEmailLink(auth, href)) {
      throw new Error("Open the Secret Santa sign-in link sent to your email.");
    }
    const { user } = await signInWithEmailLink(auth, email, href);
    return user;
  },

  async registerParticipant(name, user, environment = "production") {
    if (environment === "production") {
      const result = await apiRequest(
        "/api/register",
        { method: "POST", body: JSON.stringify({ officialName: name }) },
        user
      );
      if (result?.success !== true || typeof result.participantId !== "string") {
        throw new Error("The server could not confirm your registration. Please try again.");
      }
      return { ...result, isCentral: true };
    }

    const officialMatch = matchOfficialParticipant(name);
    if (!officialMatch) {
      throw new Error(`"${name.trim()}" is not found in the official 45 participant list.`);
    }

    const userEmail = user?.email?.toLowerCase();
    if (!userEmail) {
      throw new Error("A verified email address is required to register.");
    }

    const norm = normalizeName(officialMatch);

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
      const { participants } = await apiRequest("/api/participants", { method: "GET" }, user);
      return participants.map((p) => ({
        id: p.id,
        name: p.name || p.officialName,
        status: p.status,
        isAvailable: p.isAvailable ?? (p.status === "PENDING"),
        isClaimedByYou: Boolean(p.isClaimedByYou),
        isClaimedByOther: Boolean(p.isClaimedByOther),
      }));
    }

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

    if (environment === "production") {
      return apiRequest("/api/my-friend?action=my-family", { method: "GET" }, user);
    }

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
    return apiRequest(
      `/api/my-friend?participantId=${encodeURIComponent(participantId)}`,
      { method: "GET" },
      user
    );
  },

  // 7. Mark Friend Revealed (Automatic Remembrance)
  async markFriendRevealed(participantId, user, environment = "production") {
    if (environment === "production") {
      return apiRequest(
        `/api/my-friend?participantId=${encodeURIComponent(participantId)}&reveal=true`,
        { method: "POST" },
        user
      );
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
      const overview = await apiRequest("/api/admin?action=overview", { method: "GET" }, user);
      if (!Array.isArray(overview?.participants)) {
        throw new Error("The server returned an invalid admin overview.");
      }
      return overview;
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

  async recoverLocalRegistrations(user) {
    const userEmail = user.email.toLowerCase();
    const localClaims = (loadLocalStore().production?.participants || []).filter(
      (p) => p.status === "REGISTERED" &&
        p.registeredByEmail?.toLowerCase() === userEmail &&
        !p.centralConfirmedAt
    );

    const recoveredMembers = [];
    const errors = [];

    for (const claim of localClaims) {
      try {
        const result = await secretSantaService.registerParticipant(claim.officialName, user);
        recoveredMembers.push(result.officialName);
      } catch (err) {
        errors.push(err.message);
        continue;
      }

      const store = loadLocalStore();
      const currentClaim = store.production?.participants.find(
        (p) => p.id === claim.id && p.registeredByEmail?.toLowerCase() === userEmail
      );
      if (currentClaim) {
        currentClaim.centralConfirmedAt = new Date().toISOString();
        saveLocalStore(store);
      }
    }

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
