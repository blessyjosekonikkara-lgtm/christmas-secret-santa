const { getDatabase, verifyAuthToken, matchOfficialParticipant, normalizeName } = require("./db");

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  // 1. Authenticate Request
  const auth = verifyAuthToken(req);
  if (!auth.authenticated || !auth.email) {
    return res.status(401).json({ error: "Authentication required. Please sign in with your verified email." });
  }

  const { name, officialName } = req.body || {};
  const candidateName = (officialName || name || "").trim();

  if (!candidateName) {
    return res.status(400).json({ error: "Participant name is required." });
  }

  // 2. Validate Against Official 45-Person Roster
  const matched = matchOfficialParticipant(candidateName);
  if (!matched) {
    return res.status(400).json({ error: `"${candidateName}" is not found in the official 45-participant roster.` });
  }

  const docId = normalizeName(matched).replace(/\s+/g, "_");
  const userEmail = auth.email.toLowerCase();

  try {
    const { db } = await getDatabase();
    const collection = db.collection("participants");

    // 3. Inspect Current Status
    const existing = await collection.findOne({ id: docId });

    if (existing && existing.status === "REGISTERED") {
      if (existing.registeredByEmail?.toLowerCase() === userEmail) {
        return res.status(200).json({
          success: true,
          alreadyRegisteredByYou: true,
          officialName: existing.officialName,
          participantId: existing.id,
          hasRevealed: Boolean(existing.hasRevealed),
        });
      }
      return res.status(409).json({
        error: `"${matched}" has already been claimed by another family account.`,
      });
    }

    // 4. Atomic Claim (Guarantees atomic locking against race conditions)
    const result = await collection.updateOne(
      { id: docId, status: "PENDING" },
      {
        $set: {
          id: docId,
          officialName: matched,
          status: "REGISTERED",
          registeredByEmail: userEmail,
          registeredByUid: auth.uid,
          registeredAt: new Date().toISOString(),
          hasRevealed: false,
        },
      }
    );

    if (result.matchedCount === 0) {
      // Slot was claimed concurrently by another family member
      return res.status(409).json({
        error: `"${matched}" was just claimed by another family member. Please select another available name.`,
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
    return res.status(500).json({ error: "Failed to record registration: " + err.message });
  }
};
