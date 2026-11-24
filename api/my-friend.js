const { getDatabase, verifyAuthToken } = require("./_db");

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "private, no-store");

  try {
    const auth = await verifyAuthToken(req);
    if (!auth.authenticated) {
      return res.status(401).json({ error: "Authentication required to view Secret Santa friend." });
    }
    const userEmail = auth.email;
    const { db } = await getDatabase();

    // Action A: Fetch all family members registered under this email
    const action = req.query.action || req.body?.action;
    if (action === "my-family" || !req.query.participantId) {
      const familyMembers = await db
        .collection("participants")
        .find({ registeredByEmail: userEmail })
        .toArray();

      const settings = await db.collection("settings").findOne({ _id: "system_state" });
      const assignmentsLocked = Boolean(settings?.assignmentsLocked);

      let familyAssignments = [];
      if (assignmentsLocked) {
        const participantIds = familyMembers.map((m) => m.id);
        familyAssignments = await db
          .collection("assignments")
          .find({ giverId: { $in: participantIds } })
          .toArray();
      }

      return res.status(200).json({
        familyMembers: familyMembers.map((m) => ({
          id: m.id,
          officialName: m.officialName,
          status: m.status,
          hasRevealed: Boolean(m.hasRevealed),
        })),
        familyAssignments: familyAssignments.map((a) => ({
          giverId: a.giverId,
          giverName: a.giverName,
          receiverName: a.receiverName,
          locked: a.locked,
        })),
        assignmentsLocked,
        assignmentsGenerated: Boolean(settings?.assignmentsGenerated),
      });
    }

    // Action B: Scoped Individual Friend Reveal
    const participantId = (req.query.participantId || req.body?.participantId || "").trim();
    if (!participantId) {
      return res.status(400).json({ error: "participantId is required." });
    }

    // 2. Strict Authorization Check (Verify ownership of this participant identity)
    const participant = await db.collection("participants").findOne({ id: participantId });
    if (!participant) {
      return res.status(404).json({ error: "Participant not found." });
    }

    if (!auth.isAdmin && participant.registeredByEmail?.toLowerCase() !== userEmail) {
      return res.status(403).json({
        error: "Forbidden. You are not authorized to view Secret Santa assignments for this participant.",
      });
    }

    // 3. Inspect Assignment Lock Status
    const settings = await db.collection("settings").findOne({ _id: "system_state" });
    const isLocked = Boolean(settings?.assignmentsLocked);

    if (!isLocked) {
      return res.status(200).json({
        participantId: participant.id,
        officialName: participant.officialName,
        assignedFriend: null,
        locked: false,
        message: "Secret Santa assignments are being prepared by the administrator.",
      });
    }

    // 4. Retrieve Assignment for this specific participant
    const assignment = await db.collection("assignments").findOne({ giverId: participantId });
    if (!assignment) {
      return res.status(404).json({ error: "No assignment found for this participant." });
    }

    // Mark as revealed on first unbox
    if (req.method === "POST" || req.query.reveal === "true") {
      await db.collection("participants").updateOne({ id: participantId }, { $set: { hasRevealed: true } });
      await db.collection("assignments").updateOne({ giverId: participantId }, { $set: { hasRevealed: true } });
    }

    return res.status(200).json({
      participantId: participant.id,
      officialName: participant.officialName,
      assignedFriend: assignment.receiverName,
      locked: true,
      hasRevealed: true,
    });
  } catch (err) {
    console.error("API /my-friend error:", err);
    return res.status(500).json({ error: "Could not load your family registration or assignment. Please try again." });
  }
};
