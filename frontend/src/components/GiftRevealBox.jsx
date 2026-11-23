import React, { useState, useEffect } from "react";
import { Box, Typography, Button, Paper, Chip } from "@mui/material";
import confetti from "canvas-confetti";
import LockIcon from "@mui/icons-material/Lock";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { secretSantaService } from "../services/secretSantaService";

export default function GiftRevealBox({ 
  giverId, 
  giverName, 
  receiverName, 
  initiallyRevealed = false, 
  onRevealed 
}) {
  const [isOpen, setIsOpen] = useState(initiallyRevealed);

  useEffect(() => {
    if (initiallyRevealed) {
      setIsOpen(true);
    }
  }, [initiallyRevealed, giverId]);

  const handleOpenGift = async () => {
    if (isOpen) return;
    setIsOpen(true);

    if (giverId) {
      try {
        await secretSantaService.markFriendRevealed(giverId);
        if (onRevealed) onRevealed(giverId);
      } catch (e) {
        console.warn("Could not mark revealed:", e.message);
      }
    }

    // Fire lavish Christmas confetti explosion
    const end = Date.now() + 1800;
    const colors = ["#C41E3A", "#D4AF37", "#10B981", "#FFFFFF", "#FDE68A", "#FFD700"];

    (function frame() {
      confetti({
        particleCount: 6,
        angle: 60,
        spread: 60,
        origin: { x: 0 },
        colors: colors,
      });
      confetti({
        particleCount: 6,
        angle: 120,
        spread: 60,
        origin: { x: 1 },
        colors: colors,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        my: 3,
        width: "100%",
        maxWidth: 580,
      }}
    >
      {!isOpen ? (
        // Unopened Gift Box
        <Paper
          elevation={10}
          sx={{
            p: { xs: 3.5, sm: 5 },
            textAlign: "center",
            width: "100%",
            borderRadius: 5,
            background: "linear-gradient(155deg, rgba(11, 61, 32, 0.96) 0%, rgba(4, 25, 13, 0.98) 100%)",
            border: "2px solid #D4AF37",
            boxShadow: "0 16px 45px rgba(212, 175, 55, 0.35)",
            position: "relative",
            overflow: "hidden",
            transition: "all 0.3s ease",
            "&:hover": {
              transform: "translateY(-5px) scale(1.02)",
              boxShadow: "0 20px 55px rgba(212, 175, 55, 0.5)",
            },
          }}
        >
          {/* Metallic Gold Ribbon Crossing */}
          <Box
            sx={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: "50%",
              width: "16px",
              transform: "translateX(-50%)",
              background: "linear-gradient(180deg, #FFF6D6 0%, #F59E0B 30%, #D4AF37 70%, #B45309 100%)",
              boxShadow: "0 0 14px rgba(212, 175, 55, 0.7)",
            }}
          />
          <Box
            sx={{
              position: "absolute",
              left: 0,
              right: 0,
              top: "42%",
              height: "16px",
              background: "linear-gradient(90deg, #FFF6D6 0%, #F59E0B 30%, #D4AF37 70%, #B45309 100%)",
              boxShadow: "0 0 14px rgba(212, 175, 55, 0.7)",
            }}
          />

          <Box
            sx={{
              position: "relative",
              zIndex: 2,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <Box
              sx={{
                fontSize: { xs: 75, sm: 90 },
                animation: "gentlePulse 2.2s ease-in-out infinite",
                filter: "drop-shadow(0 8px 18px rgba(212, 175, 55, 0.6))",
                mb: 1.5,
                userSelect: "none",
              }}
            >
              🎁
            </Box>

            <Typography
              variant="h5"
              sx={{
                color: "#FDE68A",
                fontWeight: 800,
                letterSpacing: 1.5,
                mb: 0.5,
                textShadow: "0 2px 10px rgba(0,0,0,0.6)",
              }}
            >
              For {giverName}
            </Typography>

            <Typography
              variant="body1"
              sx={{
                color: "rgba(255, 255, 255, 0.85)",
                mb: 3.5,
                fontStyle: "italic",
                fontSize: "1.05rem",
              }}
            >
              Your Christmas surprise is waiting inside...
            </Typography>

            <Button
              variant="contained"
              color="secondary"
              size="large"
              onClick={handleOpenGift}
              startIcon={<AutoAwesomeIcon sx={{ fontSize: "1.4rem" }} />}
              sx={{
                px: { xs: 3.5, sm: 5 },
                py: 1.8,
                fontSize: { xs: "1.1rem", sm: "1.25rem" },
                letterSpacing: 1.5,
                fontWeight: 900,
                borderRadius: 35,
                background: "linear-gradient(135deg, #FFF6D6 0%, #F59E0B 30%, #D4AF37 70%, #B45309 100%)",
                color: "#062815",
                boxShadow: "0 6px 25px rgba(245, 158, 11, 0.6)",
                "&:hover": {
                  background: "linear-gradient(135deg, #FFFFFF 0%, #FDE68A 40%, #D4AF37 100%)",
                  boxShadow: "0 8px 30px rgba(245, 158, 11, 0.8)",
                  transform: "translateY(-2px)",
                },
              }}
            >
              OPEN CHRISTMAS GIFT 🎁
            </Button>
          </Box>
        </Paper>
      ) : (
        // Revealed Friend Box with EXTRA-LARGE GOLDEN FONT
        <Paper
          elevation={14}
          sx={{
            p: { xs: 3.5, sm: 5 },
            textAlign: "center",
            width: "100%",
            borderRadius: 5,
            background: "linear-gradient(145deg, rgba(196, 30, 58, 0.97) 0%, rgba(136, 19, 19, 0.98) 100%)",
            border: "2.5px solid #FDE68A",
            boxShadow: "0 20px 60px rgba(245, 158, 11, 0.55)",
            animation: initiallyRevealed ? "none" : "revealPop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
            position: "relative",
          }}
        >
          {/* Confirmed Banner */}
          <Box sx={{ display: "flex", justifyContent: "center", gap: 1, mb: 2 }}>
            <Chip
              icon={<CheckCircleIcon sx={{ "&&": { color: "#10B981" } }} />}
              label="SECRET SANTA FRIEND CONFIRMED"
              size="small"
              sx={{
                backgroundColor: "rgba(4, 25, 13, 0.85)",
                color: "#FDE68A",
                fontWeight: 800,
                letterSpacing: 1.2,
                border: "1.5px solid #D4AF37",
                py: 2,
                px: 1.5,
                fontSize: "0.85rem",
              }}
            />
          </Box>

          <Typography
            variant="h5"
            sx={{
              color: "#FFFFFF",
              fontWeight: 600,
              letterSpacing: 1,
              mb: 1.5,
              fontSize: { xs: "1.2rem", sm: "1.5rem" },
            }}
          >
            Your Christmas Friend Is...
          </Typography>

          {/* 
            EXTRA-LARGE METALLIC GOLD TYPOGRAPHY BANNER 
            - Extra-large font size (2.6rem to 4.5rem)
            - Luxurious metallic-gold gradient fill
            - Glowing drop shadows
          */}
          <Box
            sx={{
              my: 3,
              py: { xs: 2.5, sm: 3.5 },
              px: { xs: 2, sm: 4 },
              backgroundColor: "rgba(4, 25, 13, 0.94)",
              border: "3px dashed #D4AF37",
              borderRadius: 4,
              boxShadow: "inset 0 4px 15px rgba(0,0,0,0.6), 0 0 25px rgba(212, 175, 55, 0.35)",
            }}
          >
            <Typography
              sx={{
                fontWeight: 900,
                letterSpacing: { xs: 2, sm: 3.5 },
                textTransform: "uppercase",
                lineHeight: 1.15,
                fontSize: { xs: "2.5rem", sm: "3.6rem", md: "4.4rem" },
                background: "linear-gradient(135deg, #FFFFFF 0%, #FFF5D0 20%, #FDE68A 45%, #D4AF37 75%, #B45309 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                filter: "drop-shadow(0 4px 15px rgba(212, 175, 55, 0.7))",
                wordBreak: "break-word",
              }}
            >
              {receiverName}
            </Typography>
          </Box>

          {/* Mandatory Confidentiality Message */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 1.2,
              mt: 2.5,
              px: 2.5,
              py: 1.4,
              borderRadius: 3,
              backgroundColor: "rgba(0,0,0,0.4)",
              border: "1px solid rgba(253, 230, 138, 0.3)",
            }}
          >
            <LockIcon sx={{ color: "#FDE68A", fontSize: 20 }} />
            <Typography
              variant="body1"
              sx={{
                color: "#FFFFFF",
                fontWeight: 700,
                fontSize: { xs: "0.95rem", sm: "1.05rem" },
                letterSpacing: 0.5,
              }}
            >
              Keep it a secret! Make someone's Christmas special. 🤫🎅
            </Typography>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
