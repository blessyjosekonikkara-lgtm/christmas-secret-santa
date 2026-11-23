import React, { useState, useEffect } from "react";
import { 
  Box, 
  Paper, 
  Typography, 
  Button, 
  Alert, 
  CircularProgress,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { secretSantaService } from "../services/secretSantaService";
import { matchOfficialParticipant, OFFICIAL_PARTICIPANTS } from "../config/participants";

export default function NameVerificationPage() {
  const [nameInput, setNameInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [roster, setRoster] = useState([]);

  const { user, familyMembers, refreshFamily, setSelectedMember } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const loadRoster = async () => {
      try {
        const list = await secretSantaService.getAvailableRoster(user);
        setRoster(list);
      } catch (e) {
        console.warn("Could not fetch roster:", e);
      }
    };
    loadRoster();
  }, [user, familyMembers]);

  const handleGoToDashboard = async (e) => {
    if (e) e.preventDefault();
    setError("");

    const trimmed = nameInput.trim();

    // If input is empty but user already has a member linked, go straight to dashboard
    if (!trimmed && familyMembers.length > 0) {
      navigate("/dashboard");
      return;
    }

    if (!trimmed) {
      setError("Please select your official name from the dropdown.");
      return;
    }

    const officialMatch = matchOfficialParticipant(trimmed);
    if (!officialMatch) {
      setError(`"${trimmed}" does not match any name in the official 45 participant roster.`);
      return;
    }

    setLoading(true);
    try {
      const res = await secretSantaService.registerParticipant(officialMatch, user);
      await refreshFamily();

      // Retrieve updated member entry
      const updatedFamily = await secretSantaService.getMyFamilyAssignments(user);
      const matched = updatedFamily?.familyMembers?.find((m) => m.id === res.participantId);
      if (matched) {
        setSelectedMember(matched);
      }

      // Take user directly to their dashboard without any intermediate screens
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Unable to confirm name. Please check spelling or if already claimed.");
      setLoading(false);
    }
  };

  const handleSelectExisting = (member) => {
    setSelectedMember(member);
    navigate("/dashboard");
  };

  return (
    <Box
      sx={{
        minHeight: "82vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        py: 4,
      }}
    >
      <Paper
        elevation={10}
        sx={{
          p: { xs: 3.5, sm: 5 },
          width: "100%",
          maxWidth: 560,
          borderRadius: 4,
          textAlign: "center",
          background: "rgba(255, 255, 255, 0.92)",
          backdropFilter: "blur(20px)",
          border: "1.5px solid rgba(212, 175, 55, 0.45)",
          boxShadow: "0 20px 50px rgba(180, 140, 60, 0.16), 0 4px 16px rgba(0,0,0,0.05)",
        }}
      >
        {/* Real Family Official Roster Badge */}
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.8, px: 2.2, py: 0.6, borderRadius: 20, bgcolor: "rgba(253, 248, 237, 0.95)", border: "1.5px solid #D4AF37", mb: 2 }}>
          <AutoAwesomeIcon sx={{ fontSize: 18, color: "#D4AF37" }} />
          <Typography variant="caption" sx={{ fontWeight: 800, color: "#92400E", letterSpacing: 1.2 }}>
            OFFICIAL FAMILY SECRET SANTA (45 MEMBERS)
          </Typography>
        </Box>

        {/* Festive Golden Emblem */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #FDE68A 0%, #D4AF37 100%)",
            border: "2px solid #FFFFFF",
            boxShadow: "0 6px 20px rgba(212, 175, 55, 0.4)",
            mb: 2,
            mx: "auto",
          }}
        >
          <CardGiftcardIcon sx={{ color: "#78350F", fontSize: 34 }} />
        </Box>

        <Typography
          variant="h4"
          sx={{
            fontWeight: 800,
            letterSpacing: 1,
            color: "#78350F",
            textShadow: "0 1px 4px rgba(212, 175, 55, 0.3)",
            mb: 1,
            fontSize: { xs: "1.5rem", sm: "1.85rem" },
          }}
        >
          Secret Santa Name Selection
        </Typography>

        <Typography
          variant="body2"
          sx={{
            color: "#57534E",
            mb: 3,
            lineHeight: 1.6,
          }}
        >
          Signed in as: <strong>{user?.email}</strong>
        </Typography>

        {/* Existing registered member chips under this email */}
        {familyMembers.length > 0 && (
          <Box
            sx={{
              mb: 3,
              p: 2.5,
              borderRadius: 3.5,
              backgroundColor: "rgba(253, 248, 237, 0.9)",
              border: "1.5px dashed rgba(212, 175, 55, 0.6)",
              textAlign: "center",
            }}
          >
            <Typography variant="caption" sx={{ color: "#92400E", fontWeight: 800, display: "block", mb: 1.5, letterSpacing: 0.8 }}>
              YOUR REGISTERED FAMILY MEMBERS:
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.2, justifyContent: "center" }}>
              {familyMembers.map((m) => (
                <Chip
                  key={m.id}
                  label={`🎅 ${m.officialName}`}
                  onClick={() => handleSelectExisting(m)}
                  clickable
                  sx={{
                    fontWeight: 800,
                    fontSize: "0.95rem",
                    py: 2.2,
                    px: 1.2,
                    backgroundColor: "rgba(255, 255, 255, 0.98)",
                    color: "#78350F",
                    border: "2px solid #D4AF37",
                    boxShadow: "0 3px 10px rgba(212, 175, 55, 0.25)",
                    "&:hover": {
                      backgroundColor: "#FDE68A",
                      borderColor: "#B45309",
                      transform: "scale(1.03)",
                    },
                  }}
                />
              ))}
            </Box>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2, textAlign: "left" }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleGoToDashboard}>
          <Box sx={{ textAlign: "left", mb: 1 }}>
            <Typography variant="subtitle2" sx={{ color: "#78350F", fontWeight: 800 }}>
              {familyMembers.length > 0
                ? "Or Select Another Family Member to Link:"
                : "Select Your Name from the Official 45 Roster:"}
            </Typography>
          </Box>

          {/* Participant Name-Selection Dropdown (All 45 Official Names) */}
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel id="select-family-name-label" sx={{ color: "#78350F", fontWeight: 700 }}>
              Select Official Family Name
            </InputLabel>
            <Select
              labelId="select-family-name-label"
              id="family-name-select"
              value={nameInput}
              label="Select Official Family Name"
              onChange={(e) => setNameInput(e.target.value)}
              disabled={loading}
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
                textAlign: "left",
                backgroundColor: "rgba(255, 255, 255, 0.98)",
                borderRadius: 3,
                fontWeight: 700,
                color: "#1C1917",
                "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(212, 175, 55, 0.6)" },
                "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#D4AF37" },
                "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#B45309" },
              }}
            >
              <MenuItem value="" disabled>
                <em>-- Select from 45 Official Family Members --</em>
              </MenuItem>
              {OFFICIAL_PARTICIPANTS.map((officialName) => {
                const item = roster.find((r) => r.name.toLowerCase() === officialName.toLowerCase());
                const isClaimedByYou = item?.isClaimedByYou;
                const isClaimedByOther = item?.isClaimedByOther;
                return (
                  <MenuItem 
                    key={officialName} 
                    value={officialName}
                    disabled={isClaimedByOther}
                    sx={{ py: 1.2 }}
                  >
                    <Box sx={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                      <Typography sx={{ fontWeight: 800, color: isClaimedByOther ? "#A8A29E" : "#78350F" }}>
                        🎅 {officialName}
                      </Typography>
                      {isClaimedByYou && (
                        <Chip size="small" label="Linked to You" sx={{ bgcolor: "#FDE68A", color: "#78350F", fontWeight: 700, height: 22 }} />
                      )}
                      {isClaimedByOther && (
                        <Chip size="small" label="Claimed" sx={{ bgcolor: "#F5F5F4", color: "#A8A29E", height: 22 }} />
                      )}
                      {!isClaimedByYou && !isClaimedByOther && (
                        <Chip size="small" label="Ready to Register" sx={{ bgcolor: "#DCFCE7", color: "#166534", fontWeight: 700, height: 22 }} />
                      )}
                    </Box>
                  </MenuItem>
                );
              })}
            </Select>
            <FormHelperText sx={{ color: "#78350F", fontWeight: 600 }}>
              Select your exact name from the 45 official family participants
            </FormHelperText>
          </FormControl>

          {/* Action Button: "GO TO DASHBOARD" / "REGISTER & GO TO DASHBOARD" */}
          <Button
            fullWidth
            type="submit"
            variant="contained"
            size="large"
            disabled={loading || (!nameInput && familyMembers.length === 0)}
            endIcon={loading ? <CircularProgress size={20} color="inherit" /> : <ArrowForwardIcon />}
            sx={{
              py: 1.6,
              fontSize: "1.1rem",
              letterSpacing: 1.5,
              fontWeight: 800,
              borderRadius: 30,
              background: "linear-gradient(135deg, #FDE68A 0%, #D4AF37 50%, #C29B38 100%)",
              color: "#452C06",
              boxShadow: "0 6px 20px rgba(212, 175, 55, 0.4)",
              "&:hover": {
                background: "linear-gradient(135deg, #FFF6D6 0%, #F59E0B 50%, #D4AF37 100%)",
                boxShadow: "0 8px 25px rgba(212, 175, 55, 0.6)",
              },
            }}
          >
            {loading
              ? "CONFIRMING PARTICIPANT..."
              : nameInput
              ? `CONFIRM ${nameInput} & GO TO DASHBOARD`
              : "GO TO DASHBOARD"}
          </Button>
        </form>
      </Paper>
    </Box>
  );
}
