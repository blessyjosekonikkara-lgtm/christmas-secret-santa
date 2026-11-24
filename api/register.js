const { getDatabase, verifyAuthToken, matchOfficialParticipant, normalizeName } = require("./_db");

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const auth = await verifyAuthToken(req);
    if (!auth.authenticated) {
      return res.status(401).json({ error: "Authentication required. Please sign in with your verified email." });
    }

    const { name, officialName } = req.body || {};
    const candidateName = officialName || name;
    if (typeof candidateName !== "string" || !candidateName.trim()) {
      return res.status(400).json({ error: "Participant name is required." });
    }

    const matched = matchOfficialParticipant(candidateName);
    if (!matched) {
      return res.status(400).json({ error: `"${candidateName.trim()}" is not found in the official 45-participant roster.` });
    }

    const docId = normalizeName(matched).replace(/\s+/g, "_");
    const { db } = await getDatabase();
    const collection = db.collection("participants");

    const result = await collection.updateOne(
      { id: docId, status: "PENDING" },
      {
        $set: {
          status: "REGISTERED",
          registeredByEmail: auth.email,
          registeredByUid: auth.uid,
          registeredAt: new Date().toISOString(),
          hasRevealed: false,
        },
      },
      { writeConcern: { w: "majority" } }
    );

    if (result.matchedCount === 0) {
      const existing = await collection.findOne({ id: docId });
      if (existing?.status === "REGISTERED" && existing.registeredByEmail?.toLowerCase() === auth.email) {
        return res.status(200).json({
          success: true,
          alreadyRegisteredByYou: true,
          officialName: existing.officialName,
          participantId: existing.id,
          hasRevealed: Boolean(existing.hasRevealed),
        });
      }
      if (!existing) {
        return res.status(503).json({ error: "This participant is temporarily unavailable. Please contact the organizer." });
      }
      return res.status(409).json({
        error: `"${matched}" has already been claimed by another family account.`,
      });
    }

    return res.status(200).json({
      success: true,
      officialName: matched,
      participantId: docId,
      hasRevealed: false,
    });
  } catch (err) {
    console.error("API /register error:", err);
    return res.status(500).json({ error: "Could not save your registration. Please try again or contact the organizer." });
  }
};
