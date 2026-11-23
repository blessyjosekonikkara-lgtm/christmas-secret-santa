// Exactly 45 Official Real Family Participants (DAISY excluded as instructed)
export const REAL_FAMILY_PARTICIPANTS = [
  "SR BLESSY", "JOSE", "BINDU", "BLESSY", "JOSHUAL", "JOY", "LOUSY", "MERIN",
  "NINTO", "SMRITHY", "HEZLIN NINTO", "DAVIS", "OMANA", "ABHEESH", "ANU ABHEESH",
  "KELVIN ABHEESH", "DALVIN ABHEESH", "ABHILASH", "SRUTHY", "DANIEL ABHILASH",
  "ASHA", "RESWIN", "CELINE RESWIN", "ELIZABETH RESWIN", "NIRMALA", "ANU DINOY",
  "DINOY", "POPPY", "POWEL", "PRASOON", "ARUN", "FEMI", "JOSEPH RAPHEAL",
  "TESSY", "KIRON", "RINU", "ALAN", "AEIDEN", "SHEETHAL", "TOM", "SERAH TOM",
  "DANIEL TOM", "GEORGE", "KAVITHA", "JERIN"
];

// Exactly 4 Dummy Test Participants for isolated testing sandbox (/test-dummy)
export const DUMMY_PARTICIPANTS = ["ALICE", "BOB", "CHARLIE", "DAVID"];

// Active official participant list for REAL FAMILY mode (exactly 45 names!)
export const OFFICIAL_PARTICIPANTS = REAL_FAMILY_PARTICIPANTS;

export const ADMIN_EMAIL = "blessyjosekonikkara@gmail.com";

/**
 * Normalizes input name: trims excess spaces, converts to lowercase.
 */
export function normalizeName(name) {
  if (!name || typeof name !== "string") return "";
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Validates whether a given name matches an official participant.
 * Returns the exact official spelling if found, or null.
 */
export function matchOfficialParticipant(name, participantList = OFFICIAL_PARTICIPANTS) {
  const norm = normalizeName(name);
  if (!norm) return null;
  const found = participantList.find(p => normalizeName(p) === norm);
  return found || null;
}
