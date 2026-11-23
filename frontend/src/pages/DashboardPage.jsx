import React, { useEffect, useState } from "react";
import { 
  Box, 
  Paper, 
  Typography, 
  Chip, 
  CircularProgress,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LockIcon from "@mui/icons-material/Lock";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import PersonIcon from "@mui/icons-material/Person";
import ScienceIcon from "@mui/icons-material/Science";
import { useAuth } from "../context/AuthContext";
import { secretSantaService } from "../services/secretSantaService";
import { matchOfficialParticipant, OFFICIAL_PARTICIPANTS } from "../config/participants";

export default function DashboardPage() {
  const { user, familyMembers, selectedMember, setSelectedMember, refreshFamily } = useAuth();
  const [loading, setLoading] = useState(true);
  const [assignmentData, setAssignmentData] = useState(null);
  const [error, setError] = useState("");

  // Modal for linking another family member to this email
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [addMemberLoading, setAddMemberLoading] = useState(false);
  const [addMemberError, setAddMemberError] = useState("");
  const [addMemberSuccess, setAddMemberSuccess] = useState("");

  const activeMember = selectedMember || (familyMembers.length > 0 ? familyMembers[0] : null);

  const fetchAssignments = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await secretSantaService.getMyFamilyAssignments(user);
      setAssignmentData(data);
    } catch (err) {
      setError(err.message || "Failed to load Secret Santa assignment.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [user]);

  // Handle adding another family member under this same email account
  const handleLinkNewMember = async (e) => {
    if (e) e.preventDefault();
    setAddMemberError("");
    setAddMemberSuccess("");

    const trimmed = newMemberName.trim();
    if (!trimmed) {
      setAddMemberError("Please enter a family member's name from the official roster.");
      return;
    }

    const officialMatch = matchOfficialParticipant(trimmed);
    if (!officialMatch) {
      setAddMemberError(`"${trimmed}" is not found in the official participant roster. Please check spelling.`);
      return;
    }

    setAddMemberLoading(true);
    try {
      const res = await secretSantaService.registerParticipant(officialMatch, user);
      await refreshFamily();
      const updatedFamily = await secretSantaService.getMyFamilyAssignments(user);
      setAssignmentData(updatedFamily);

      const newlyLinked = updatedFamily?.familyMembers?.find((m) => m.id === res.participantId);
      if (newlyLinked) {
        setSelectedMember(newlyLinked);
      }

      setAddMemberSuccess(`Successfully linked "${officialMatch}" to your email!`);
      setNewMemberName("");
      setTimeout(() => {
        setAddMemberModalOpen(false);
        setAddMemberSuccess("");
      }, 1000);
    } catch (err) {
      setAddMemberError(err.message || "Unable to link participant. Please check spelling or if already claimed.");
    } finally {
      setAddMemberLoading(false);
    }
  };

  // Find assignment specifically for active member (never mix up assignments!)
  const currentAssignment = assignmentData?.familyMembers?.find(
    (m) => m.id === activeMember?.id
  );

  const isAssignedAndReady = Boolean(
    assignmentData?.locked && currentAssignment?.assignedFriend
  );

  return (
    <Box
      sx={{
        minHeight: "82vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        px: { xs: 2, sm: 3 },
        py: { xs: 3, sm: 5 },
      }}
    >
      <Paper
        elevation={12}
        sx={{
          p: { xs: 3.5, sm: 5 },
          width: "100%",
          maxWidth: 680,
          borderRadius: 5,
          textAlign: "center",
          background: "rgba(255, 255, 255, 0.92)",
          backdropFilter: "blur(20px)",
          border: "1.5px solid rgba(212, 175, 55, 0.45)",
          boxShadow: "0 20px 50px rgba(180, 140, 60, 0.16), 0 4px 16px rgba(0,0,0,0.05)",
          position: "relative",
        }}
      >
        {/* Festive Welcome Badge */}
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 1,
            px: 2.5,
            py: 0.6,
            borderRadius: 20,
            background: "rgba(253, 248, 237, 0.95)",
            border: "1px solid rgba(212, 175, 55, 0.5)",
            mb: 2,
          }}
        >
          <AutoAwesomeIcon sx={{ color: "#D4AF37", fontSize: 18 }} />
          <Typography variant="caption" sx={{ color: "#92400E", fontWeight: 800, letterSpacing: 1.5 }}>
            CHRISTMAS FRIEND EXCHANGE
          </Typography>
        </Box>

        {/* Christmas Greeting */}
        <Typography
          variant="h3"
          sx={{
            fontWeight: 900,
            letterSpacing: { xs: 1.5, sm: 2.5 },
            color: "#78350F",
            textShadow: "0 1px 4px rgba(212, 175, 55, 0.3)",
            mb: 1.5,
            fontSize: { xs: "2rem", sm: "2.6rem" },
          }}
        >
          Merry Christmas! 🎄
        </Typography>

        {/* 
          Multi-Member Participant Switcher & Link Control:
          Allows one verified email ID to associate with multiple official family members!
        */}
        <Box
          sx={{
            mb: 3,
            p: 2,
            borderRadius: 3.5,
            backgroundColor: "rgba(253, 248, 237, 0.8)",
            border: "1.5px dashed rgba(212, 175, 55, 0.5)",
            textAlign: "center",
          }}
        >
          <Typography variant="caption" sx={{ color: "#92400E", fontWeight: 800, letterSpacing: 1, display: "block", mb: 1.2 }}>
            REGISTERED FAMILY MEMBERS UNDER THIS EMAIL:
          </Typography>

          <Box sx={{ display: "flex", gap: 1.2, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
            {familyMembers.map((member) => {
              const isSelected = activeMember?.id === member.id;
              return (
                <Chip
                  key={member.id}
                  icon={isSelected ? <CheckCircleIcon sx={{ "&&": { color: "#452C06" } }} /> : undefined}
                  label={`🎁 ${member.officialName}`}
                  onClick={() => setSelectedMember(member)}
                  clickable
                  sx={{
                    fontWeight: 800,
                    px: 1.5,
                    py: 2.2,
                    fontSize: "0.95rem",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    background: isSelected 
                      ? "linear-gradient(135deg, #FDE68A 0%, #D4AF37 100%)" 
                      : "rgba(255, 255, 255, 0.95)",
                    color: isSelected ? "#452C06" : "#78350F",
                    border: isSelected ? "2px solid #B45309" : "1.5px solid rgba(212, 175, 55, 0.4)",
                    boxShadow: isSelected ? "0 4px 15px rgba(212, 175, 55, 0.45)" : "none",
                    "&:hover": {
                      transform: "translateY(-1.5px)",
                      borderColor: "#D4AF37",
                    },
                  }}
                />
              );
            })}

            {/* Prominent "+ Link Another Family Member" Button */}
            <Chip
              icon={<AddCircleIcon sx={{ "&&": { color: "#78350F" } }} />}
              label="+ Link Another Family Member"
              onClick={() => {
                setAddMemberError("");
                setAddMemberSuccess("");
                setNewMemberName("");
                setAddMemberModalOpen(true);
              }}
              clickable
              sx={{
                fontWeight: 800,
                px: 1.5,
                py: 2.2,
                fontSize: "0.90rem",
                background: "linear-gradient(145deg, #FFFFFF 0%, #FFFDF7 100%)",
                color: "#78350F",
                border: "1.5px dashed #D4AF37",
                boxShadow: "0 2px 8px rgba(180, 140, 60, 0.15)",
                "&:hover": {
                  backgroundColor: "#FDE68A",
                  borderColor: "#B45309",
                  transform: "translateY(-1.5px)",
                },
              }}
            />
          </Box>
        </Box>

        {/* Selected Member Display Banner */}
        {activeMember && (
          <Box
            sx={{
              display: "inline-block",
              px: { xs: 2.5, sm: 4 },
              py: 1.2,
              borderRadius: 30,
              background: "rgba(253, 248, 237, 0.95)",
              border: "1.5px solid rgba(212, 175, 55, 0.6)",
              boxShadow: "0 4px 15px rgba(212, 175, 55, 0.15)",
              mb: 3.5,
            }}
          >
            <Typography variant="h6" sx={{ color: "#292524", fontWeight: 700, fontSize: { xs: "1rem", sm: "1.2rem" } }}>
              Participant: <span style={{ color: "#92400E", fontWeight: 900, letterSpacing: 1.2 }}>{activeMember.officialName}</span>
            </Typography>
          </Box>
        )}

        {/* Loading State */}
        {loading ? (
          <Box sx={{ my: 5 }}>
            <CircularProgress sx={{ color: "#D4AF37", mb: 2 }} />
            <Typography variant="body1" sx={{ color: "#78350F", fontWeight: 600 }}>
              Checking your Secret Santa friend...
            </Typography>
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ my: 3 }}>
            {error}
          </Alert>
        ) : isAssignedAndReady ? (
          /* 
            AUTOMATIC REVEAL:
            Once assignments are generated, validated, and locked by the administrator,
            show the assigned Christmas friend prominently with subtle reveal animation!
          */
          <Box
            sx={{
              animation: "revealPop 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
              my: 2,
            }}
          >
            {/* Confirmed Banner */}
            <Box sx={{ display: "flex", justifyContent: "center", gap: 1, mb: 1.5 }}>
              <Chip
                icon={<CheckCircleIcon sx={{ "&&": { color: "#10B981" } }} />}
                label="SECRET SANTA FRIEND CONFIRMED"
                size="small"
                sx={{
                  backgroundColor: "rgba(236, 253, 245, 0.95)",
                  color: "#065F46",
                  fontWeight: 800,
                  letterSpacing: 1.2,
                  border: "1.5px solid #10B981",
                  py: 1.8,
                  px: 1.5,
                  fontSize: "0.85rem",
                }}
              />
            </Box>

            <Typography
              variant="h5"
              sx={{
                color: "#78350F",
                fontWeight: 700,
                letterSpacing: 1,
                mb: 2,
                fontSize: { xs: "1.2rem", sm: "1.5rem" },
              }}
            >
              Your Christmas Friend Is...
            </Typography>

            {/* Extra-Large Metallic-Gold Friend Name Banner */}
            <Box
              sx={{
                my: 2.5,
                py: { xs: 2.5, sm: 3.5 },
                px: { xs: 2, sm: 4 },
                backgroundColor: "rgba(253, 248, 237, 0.98)",
                border: "3px dashed #D4AF37",
                borderRadius: 4,
                boxShadow: "inset 0 2px 10px rgba(0,0,0,0.06), 0 8px 30px rgba(212, 175, 55, 0.35)",
              }}
            >
              <Typography
                sx={{
                  fontWeight: 900,
                  letterSpacing: { xs: 2, sm: 3.5 },
                  textTransform: "uppercase",
                  lineHeight: 1.15,
                  fontSize: { xs: "2.4rem", sm: "3.6rem", md: "4.4rem" },
                  background: "linear-gradient(135deg, #78350F 0%, #92400E 25%, #B45309 50%, #D4AF37 80%, #78350F 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 2px 8px rgba(212, 175, 55, 0.5))",
                  wordBreak: "break-word",
                }}
              >
                {currentAssignment.assignedFriend}
              </Typography>
            </Box>

            {/* Confidentiality Reminder */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 1.2,
                mt: 3,
                px: 2.5,
                py: 1.4,
                borderRadius: 3,
                backgroundColor: "rgba(253, 248, 237, 0.9)",
                border: "1px solid rgba(212, 175, 55, 0.4)",
              }}
            >
              <LockIcon sx={{ color: "#B45309", fontSize: 20 }} />
              <Typography
                variant="body1"
                sx={{
                  color: "#78350F",
                  fontWeight: 700,
                  fontSize: { xs: "0.95rem", sm: "1.05rem" },
                  letterSpacing: 0.5,
                }}
              >
                Keep it a secret! Make someone's Christmas special. 🤫🎅
              </Typography>
            </Box>
          </Box>
        ) : (
          /* 
            WAITING STATE:
            If assignments are not yet locked by the administrator,
            show a festive waiting card.
          */
          <Box sx={{ my: 4 }}>
            <HourglassEmptyIcon sx={{ fontSize: 64, color: "#D4AF37", mb: 2, animation: "gentlePulse 2.5s infinite" }} />
            <Typography variant="h5" sx={{ color: "#78350F", fontWeight: 800, mb: 1.5 }}>
              Secret Santa Pairs Coming Soon! ⏳
            </Typography>
            <Typography variant="body1" sx={{ color: "#57534E", mb: 2, maxWidth: 460, mx: "auto", lineHeight: 1.6, fontSize: "1.05rem" }}>
              Santa's elves are gathering the family members! Once the exchange is finalized and locked by the administrator, your assigned Christmas friend will appear right here automatically.
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Dialog for Linking Another Family Member Under This Email */}
      <Dialog
        open={addMemberModalOpen}
        onClose={() => !addMemberLoading && setAddMemberModalOpen(false)}
        PaperProps={{
          sx: {
            background: "rgba(255, 255, 255, 0.98)",
            backdropFilter: "blur(20px)",
            border: "2px solid #D4AF37",
            borderRadius: 4,
            boxShadow: "0 20px 50px rgba(180, 140, 60, 0.25)",
            p: 2,
            maxWidth: 460,
            width: "100%",
          },
        }}
      >
        <DialogTitle sx={{ textAlign: "center", pb: 1 }}>
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 50,
              height: 50,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #FDE68A 0%, #D4AF37 100%)",
              border: "2px solid #FFFFFF",
              boxShadow: "0 4px 14px rgba(212, 175, 55, 0.4)",
              mb: 1.5,
            }}
          >
            <PersonIcon sx={{ color: "#78350F", fontSize: 28 }} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: "#78350F" }}>
            Link Family Member
          </Typography>
          <Typography variant="caption" sx={{ color: "#78716C", display: "block" }}>
            Account: <strong>{user?.email}</strong>
          </Typography>
        </DialogTitle>

        <form onSubmit={handleLinkNewMember}>
          <DialogContent sx={{ pt: 1 }}>
            <Typography variant="body2" sx={{ color: "#57534E", mb: 2, textAlign: "center", lineHeight: 1.5 }}>
              Enter the official participant name of the family member you wish to link under this email.
            </Typography>

            {addMemberError && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                {addMemberError}
              </Alert>
            )}

            {addMemberSuccess && (
              <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
                {addMemberSuccess}
              </Alert>
            )}

            <FormControl fullWidth sx={{ mt: 1, textAlign: "left" }}>
              <InputLabel id="dialog-select-family-label" sx={{ color: "#78350F", fontWeight: 700 }}>
                Select Official Family Name
              </InputLabel>
              <Select
                labelId="dialog-select-family-label"
                value={newMemberName}
                label="Select Official Family Name"
                onChange={(e) => setNewMemberName(e.target.value)}
                disabled={addMemberLoading}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      maxHeight: 380,
                      borderRadius: 3,
                      boxShadow: "0 10px 40px rgba(180, 140, 60, 0.3)",
                      border: "1.5px solid #D4AF37",
                    },
                  },
                }}
                sx={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 3,
                  fontWeight: 700,
                  "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(212, 175, 55, 0.6)" },
                  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#D4AF37" },
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#B45309" },
                }}
              >
                <MenuItem value="" disabled>
                  <em>-- Select from 45 Official Family Members --</em>
                </MenuItem>
                {OFFICIAL_PARTICIPANTS.map((officialName) => {
                  const isAlreadyLinked = familyMembers.some(
                    (m) => m.officialName.toLowerCase() === officialName.toLowerCase()
                  );
                  return (
                    <MenuItem key={officialName} value={officialName} disabled={isAlreadyLinked}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                        <Typography sx={{ fontWeight: 800, color: isAlreadyLinked ? "#A8A29E" : "#78350F" }}>
                          🎅 {officialName}
                        </Typography>
                        {isAlreadyLinked ? (
                          <Chip size="small" label="Already Linked" sx={{ bgcolor: "#F5F5F4", color: "#A8A29E", height: 22 }} />
                        ) : (
                          <Chip size="small" label="Available" sx={{ bgcolor: "#DCFCE7", color: "#166534", fontWeight: 700, height: 22 }} />
                        )}
                      </Box>
                    </MenuItem>
                  );
                })}
              </Select>
              <FormHelperText sx={{ color: "#78350F", fontWeight: 600 }}>
                Select an official family member from the 45 participant roster
              </FormHelperText>
            </FormControl>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2, justifyContent: "space-between" }}>
            <Button
              onClick={() => setAddMemberModalOpen(false)}
              disabled={addMemberLoading}
              sx={{ color: "#78716C", fontWeight: 700 }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={addMemberLoading || !newMemberName.trim()}
              endIcon={addMemberLoading ? <CircularProgress size={18} color="inherit" /> : <CheckCircleIcon />}
              sx={{
                background: "linear-gradient(135deg, #FDE68A 0%, #D4AF37 100%)",
                color: "#452C06",
                fontWeight: 800,
                borderRadius: 20,
                px: 3,
                boxShadow: "0 4px 14px rgba(212, 175, 55, 0.35)",
              }}
            >
              {addMemberLoading ? "Linking..." : "Confirm & Link"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
