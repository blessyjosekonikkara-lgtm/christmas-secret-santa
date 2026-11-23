import React, { useEffect, useState } from "react";
import { 
  Box, 
  Paper, 
  Typography, 
  Button, 
  Chip, 
  CircularProgress, 
  Alert 
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LockIcon from "@mui/icons-material/Lock";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { secretSantaService } from "../services/secretSantaService";

export default function MyFriendPage() {
  const { user, familyMembers, selectedMember, setSelectedMember } = useAuth();
  const [loading, setLoading] = useState(true);
  const [assignmentData, setAssignmentData] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const activeMember = selectedMember || (familyMembers.length > 0 ? familyMembers[0] : null);

  useEffect(() => {
    const fetchAssignments = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const data = await secretSantaService.getMyFamilyAssignments(user);
        setAssignmentData(data);
      } catch (err) {
        setError(err.message || "Failed to load Christmas friend assignment.");
      } finally {
        setLoading(false);
      }
    };

    fetchAssignments();
  }, [user]);

  const activeAssignment = assignmentData?.familyMembers?.find(
    (m) => m.id === activeMember?.id
  );

  const isAssignedAndReady = Boolean(
    assignmentData?.locked && activeAssignment?.assignedFriend
  );

  return (
    <Box
      sx={{
        minHeight: "82vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        py: 4,
      }}
    >
      <Paper
        elevation={12}
        sx={{
          p: { xs: 3.5, sm: 5 },
          width: "100%",
          maxWidth: 640,
          borderRadius: 5,
          textAlign: "center",
          background: "rgba(255, 255, 255, 0.92)",
          backdropFilter: "blur(20px)",
          border: "1.5px solid rgba(212, 175, 55, 0.5)",
          boxShadow: "0 20px 50px rgba(180, 140, 60, 0.16), 0 4px 16px rgba(0,0,0,0.05)",
        }}
      >
        {/* Back to Dashboard Button */}
        <Box sx={{ display: "flex", justifyContent: "flex-start", mb: 2 }}>
          <Button
            size="small"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/dashboard")}
            sx={{
              color: "#78350F",
              fontWeight: 700,
              backgroundColor: "rgba(253, 248, 237, 0.8)",
              border: "1px solid rgba(212, 175, 55, 0.4)",
              borderRadius: 20,
              px: 2,
              "&:hover": {
                backgroundColor: "#FDE68A",
              },
            }}
          >
            ← Back to Dashboard
          </Button>
        </Box>

        {/* Member Selector if multiple members */}
        {familyMembers.length > 1 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" sx={{ color: "#57534E", mb: 1, fontWeight: 600 }}>
              Viewing Assignment For:
            </Typography>
            <Box sx={{ display: "flex", gap: 1, justifyContent: "center", flexWrap: "wrap" }}>
              {familyMembers.map((member) => {
                const isSelected = activeMember?.id === member.id;
                return (
                  <Chip
                    key={member.id}
                    label={`🎁 ${member.officialName}`}
                    onClick={() => setSelectedMember(member)}
                    sx={{
                      fontWeight: 800,
                      cursor: "pointer",
                      background: isSelected ? "linear-gradient(135deg, #FDE68A, #D4AF37)" : "rgba(255, 255, 255, 0.9)",
                      color: isSelected ? "#452C06" : "#78350F",
                      border: isSelected ? "2px solid #D4AF37" : "1.5px solid rgba(212, 175, 55, 0.4)",
                      boxShadow: isSelected ? "0 4px 12px rgba(212, 175, 55, 0.4)" : "none",
                    }}
                  />
                );
              })}
            </Box>
          </Box>
        )}

        {loading ? (
          <Box sx={{ my: 6 }}>
            <CircularProgress sx={{ color: "#D4AF37", mb: 2 }} />
            <Typography variant="body1" sx={{ color: "#78350F", fontWeight: 600 }}>
              Unwrapping Secret Santa assignments...
            </Typography>
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ my: 3 }}>
            {error}
          </Alert>
        ) : !isAssignedAndReady ? (
          <Box sx={{ my: 4 }}>
            <HourglassEmptyIcon sx={{ fontSize: 60, color: "#D4AF37", mb: 2, animation: "gentlePulse 2s infinite" }} />
            <Typography variant="h5" sx={{ color: "#78350F", fontWeight: 800, mb: 1 }}>
              Secret Santa Pairs Coming Soon! ⏳
            </Typography>
            <Typography variant="body1" sx={{ color: "#57534E", mb: 3, maxWidth: 440, mx: "auto", lineHeight: 1.6 }}>
              Santa's elves are gathering the family members! Once the exchange is finalized and locked by the administrator, your assigned Christmas friend will appear here.
            </Typography>
            <Button
              variant="outlined"
              onClick={() => navigate("/dashboard")}
              sx={{
                borderRadius: 25,
                borderColor: "#D4AF37",
                color: "#78350F",
                fontWeight: 700,
                px: 3,
              }}
            >
              Return to Dashboard
            </Button>
          </Box>
        ) : (
          <Box
            sx={{
              animation: "revealPop 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
              my: 2,
            }}
          >
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
                {activeAssignment.assignedFriend}
              </Typography>
            </Box>

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
        )}
      </Paper>
    </Box>
  );
}
