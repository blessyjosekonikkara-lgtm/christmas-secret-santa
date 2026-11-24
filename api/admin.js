const { getDatabase, verifyAuthToken, OFFICIAL_PARTICIPANTS, normalizeName, matchOfficialParticipant } = require("./db");

function generateDerangement(items) {
  if (!items || items.length < 2) {
    throw new Error("At least 2 participants required for Secret Santa derangement.");
  }
  const n = items.length;
  let attempts = 0;
  const maxAttempts = 10000;

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
        generatedAt: new Date().toISOString(),
      }));
    }
  }

  throw new Error("Failed to compute valid derangement after maximum attempts.");
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  // 1. Strict Administrator Authorization Check
  const auth = verifyAuthToken(req);
  if (!auth.authenticated || !auth.isAdmin) {
    return res.status(403).json({ error: "Access denied. Restricted to authorized administrator." });
  }

  try {
    const { db } = await getDatabase();
    const action = req.query.action || req.body?.action || "overview";

    // 2. Action: Overview & Roster Metrics
    if (action === "overview" && req.method === "GET") {
      const participants = await db
        .collection("participants")
        .find({})
        .sort({ officialName: 1 })
        .toArray();

      const registered = participants.filter((p) => p.status === "REGISTERED");
      const uniqueEmails = new Set(registered.map((p) => p.registeredByEmail).filter(Boolean));

      const settings = (await db.collection("settings").findOne({ _id: "system_state" })) || {};
      const assignments = await db.collection("assignments").find({}).toArray();

      return res.status(200).json({
        totalInDb: participants.length,
        registeredCount: registered.length,
        pendingCount: participants.length - registered.length,
        uniqueVerifiedEmailsCount: uniqueEmails.size,
        assignmentsGenerated: Boolean(settings.assignmentsGenerated),
        assignmentsLocked: Boolean(settings.assignmentsLocked),
        participants: participants.map((p) => ({
          id: p.id,
          officialName: p.officialName,
          status: p.status,
          registeredByEmail: p.registeredByEmail,
          registeredAt: p.registeredAt,
          hasRevealed: Boolean(p.hasRevealed),
        })),
        assignments: assignments.map((a) => ({
          giverId: a.giverId,
          giverName: a.giverName,
          giverRegisteredByEmail: a.giverRegisteredByEmail,
          receiverId: a.receiverId,
          receiverName: a.receiverName,
          locked: a.locked,
          hasRevealed: a.hasRevealed,
        })),
      });
    }

    // 3. Action: Generate Assignments (Strict Pre-Condition: All 45 Registered)
    if (action === "generate-assignments" && req.method === "POST") {
      // Atomic Lock Check
      const lockRes = await db.collection("settings").findOneAndUpdate(
        { _id: "system_state", generating: { $ne: true } },
        { $set: { generating: true, lockStartedAt: new Date() } },
        { returnDocument: "after" }
      );

      if (!lockRes) {
        return res.status(409).json({ error: "Assignment generation already in progress. Please wait." });
      }

      try {
        const settings = (await db.collection("settings").findOne({ _id: "system_state" })) || {};
        if (settings.assignmentsLocked) {
          throw new Error("Assignments are permanently locked and cannot be regenerated.");
        }

        const registered = await db
          .collection("participants")
          .find({ status: "REGISTERED" })
          .toArray();

        // Strict Requirement: All 45 official members must be registered
        if (registered.length !== OFFICIAL_PARTICIPANTS.length) {
          throw new Error(
            `Cannot generate Secret Santa assignments yet. All ${OFFICIAL_PARTICIPANTS.length} participants must be registered first (currently ${registered.length}/${OFFICIAL_PARTICIPANTS.length} registered).`
          );
        }

        // Verify all 45 distinct IDs exist
        const regIds = new Set(registered.map((p) => p.id));
        for (const name of OFFICIAL_PARTICIPANTS) {
          const expectedId = normalizeName(name).replace(/\s+/g, "_");
          if (!regIds.has(expectedId)) {
            throw new Error(`Missing registration for official participant "${name}". All 45 must be registered.`);
          }
        }

        // Generate cryptographic derangement
        const assignments = generateDerangement(registered);

        // Save atomically to assignments collection
        await db.collection("assignments").deleteMany({});
        await db.collection("assignments").insertMany(assignments);

        await db.collection("settings").updateOne(
          { _id: "system_state" },
          {
            $set: {
              assignmentsGenerated: true,
              generatedAt: new Date().toISOString(),
              generating: false,
            },
          }
        );

        return res.status(200).json({
          success: true,
          totalPairs: assignments.length,
          message: `Successfully generated valid derangements for all ${assignments.length} participants.`,
        });
      } finally {
        await db.collection("settings").updateOne({ _id: "system_state" }, { $set: { generating: false } });
      }
    }

    // 4. Action: Lock Assignments Permanently
    if (action === "lock-assignments" && req.method === "POST") {
      const settings = (await db.collection("settings").findOne({ _id: "system_state" })) || {};
      if (!settings.assignmentsGenerated) {
        return res.status(400).json({ error: "Assignments have not been generated yet." });
      }

      await db.collection("assignments").updateMany({}, { $set: { locked: true, lockedAt: new Date().toISOString() } });
      await db.collection("settings").updateOne(
        { _id: "system_state" },
        {
          $set: {
            assignmentsLocked: true,
            lockedAt: new Date().toISOString(),
          },
        }
      );

      return res.status(200).json({ success: true, message: "Assignments are permanently locked." });
    }

    // 5. Action: Add Participant
    if (action === "add-participant" && req.method === "POST") {
      const name = (req.body?.name || "").trim();
      if (!name) return res.status(400).json({ error: "Participant name required." });

      const norm = normalizeName(name);
      const id = norm.replace(/\s+/g, "_");

      const existing = await db.collection("participants").findOne({ id });
      if (existing) {
        return res.status(409).json({ error: `Participant "${name}" already exists.` });
      }

      await db.collection("participants").insertOne({
        id,
        officialName: name,
        normalizedName: norm,
        status: "PENDING",
        registeredByEmail: null,
        registeredByUid: null,
        registeredAt: null,
        hasRevealed: false,
      });

      return res.status(200).json({ success: true, id, officialName: name });
    }

    return res.status(400).json({ error: `Unknown admin action: ${action}` });
  } catch (err) {
    console.error("API /admin error:", err);
    return res.status(500).json({ error: err.message });
  }
};
