const { getDatabase, verifyAuthToken } = require("./_db");

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "private, no-store");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use GET." });
  }

  try {
    const auth = await verifyAuthToken(req);
    const { db } = await getDatabase();

    const participants = await db
      .collection("participants")
      .find({})
      .sort({ officialName: 1 })
      .toArray();

    // 1. Admin Access: Return complete roster and full registration data
    if (auth.isAdmin) {
      return res.status(200).json({
        isAdmin: true,
        total: participants.length,
        participants: participants.map((p) => ({
          id: p.id,
          officialName: p.officialName,
          status: p.status,
          registeredByEmail: p.registeredByEmail,
          registeredAt: p.registeredAt,
          hasRevealed: Boolean(p.hasRevealed),
        })),
      });
    }

    // 2. Ordinary Participant Access: STRICT PRIVACY SCOPING
    // Never expose other family members' emails, timestamps, or UIDs.
    const userEmail = auth.email?.toLowerCase();

    const publicRoster = participants.map((p) => {
      const isPending = p.status === "PENDING";
      const isClaimedByYou = Boolean(p.status === "REGISTERED" && userEmail && p.registeredByEmail?.toLowerCase() === userEmail);
      const isClaimedByOther = Boolean(p.status === "REGISTERED" && (!userEmail || p.registeredByEmail?.toLowerCase() !== userEmail));

      return {
        id: p.id,
        name: p.officialName,
        status: isPending ? "PENDING" : "REGISTERED",
        isAvailable: isPending,
        isClaimedByYou,
        isClaimedByOther,
      };
    });

    return res.status(200).json({
      isAdmin: false,
      total: publicRoster.length,
      participants: publicRoster,
    });
  } catch (err) {
    console.error("API /participants error:", err);
    return res.status(500).json({ error: "The shared family roster is unavailable. Please try again." });
  }
};
