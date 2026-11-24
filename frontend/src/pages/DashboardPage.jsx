import React, { useEffect, useState } from "react";
import { 
  Box, 
  Paper, 
  Typography, 
  Chip, 
  CircularProgress,
  Alert,
  Button
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LockIcon from "@mui/icons-material/Lock";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import ScienceIcon from "@mui/icons-material/Science";
import { useAuth } from "../context/AuthContext";
import { secretSantaService } from "../services/secretSantaService";

export default function DashboardPage() {
  const { user, familyMembers, selectedMember, setSelectedMember, refreshFamily } = useAuth();
  const [loading, setLoading] = useState(true);
  const [assignmentData, setAssignmentData] = useState(null);
  const [error, setError] = useState("");
  const activeMember = selectedMember || (familyMembers.length > 0 ? familyMembers[0] : null);

  const fetchAssignments = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Auto-recover/sync in background silently
      try {
        const syncRes = await secretSantaService.recoverLocalRegistrations(user);
        if (syncRes.syncedCount > 0) {
          await refreshFamily();
        }
      } catch (syncErr) {
        console.warn("Background auto-sync notice:", syncErr);
      }

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

    </Box>
  );
}
