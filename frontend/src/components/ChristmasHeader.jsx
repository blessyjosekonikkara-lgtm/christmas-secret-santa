import React, { useState } from "react";
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Box, 
  Button, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions 
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";
import LogoutIcon from "@mui/icons-material/Logout";
import { useAuth } from "../context/AuthContext";

export default function ChristmasHeader() {
  const { user, logout } = useAuth();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const navigate = useNavigate();

  const handleConfirmLogout = async () => {
    setLogoutConfirmOpen(false);
    await logout();
    navigate("/login");
  };

  return (
    <>
      <AppBar
        position="sticky"
        sx={{
          background: "rgba(255, 255, 255, 0.92)",
          backdropFilter: "blur(18px)",
          borderBottom: "1.5px solid rgba(212, 175, 55, 0.35)",
          boxShadow: "0 4px 20px rgba(180, 140, 60, 0.10)",
          zIndex: 100,
          /* 
            Dedicated top corridor so doodle Santa can smoothly fly along the 
            top border without covering the title, tagline, or LOG OUT button!
          */
          pt: { xs: "32px", sm: "36px" },
          pb: 0.5,
        }}
      >
        <Toolbar sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 0.5, minHeight: { xs: 52, sm: 58 } }}>
          {/* Logo and Tagline */}
          <Box
            onClick={() => navigate(user ? "/dashboard" : "/login")}
            sx={{
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
              gap: 1.5,
              userSelect: "none",
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: { xs: 38, sm: 44 },
                height: { xs: 38, sm: 44 },
                borderRadius: "50%",
                background: "linear-gradient(135deg, #FDE68A 0%, #D4AF37 100%)",
                border: "2px solid #FFFFFF",
                boxShadow: "0 4px 14px rgba(212, 175, 55, 0.4)",
                flexShrink: 0,
              }}
            >
              <CardGiftcardIcon sx={{ color: "#78350F", fontSize: { xs: 20, sm: 24 } }} />
            </Box>

            <Box>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 900,
                  letterSpacing: { xs: 1.2, sm: 2 },
                  background: "linear-gradient(135deg, #78350F 0%, #B45309 50%, #D4AF37 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  lineHeight: 1.1,
                  fontSize: { xs: "1.05rem", sm: "1.3rem" },
                }}
              >
                SECRET SANTA
              </Typography>
              {/* Top Tagline: Visible on all screens, never covered by Santa! */}
              <Typography
                variant="caption"
                sx={{
                  color: "#78350F",
                  fontStyle: "italic",
                  letterSpacing: 0.4,
                  display: "block",
                  fontSize: { xs: "0.70rem", sm: "0.80rem" },
                  fontWeight: 600,
                  opacity: 0.9,
                  lineHeight: 1.2,
                }}
              >
                "A Little Surprise, A Lot of Christmas Magic!"
              </Typography>
            </Box>
          </Box>

          {/* 
            Top-Right: ONLY the LOG OUT button 
          */}
          {user && (
            <Box>
              <Button
                size="medium"
                onClick={() => setLogoutConfirmOpen(true)}
                startIcon={<LogoutIcon sx={{ color: "#D4AF37 !important", fontSize: "1.2rem" }} />}
                sx={{
                  background: "linear-gradient(145deg, #1C3322 0%, #0F2314 100%)", // Dark forest-green background
                  border: "1.5px solid #D4AF37", // Subtle golden border
                  borderRadius: "24px",
                  px: { xs: 1.6, sm: 2.4 },
                  py: { xs: 0.5, sm: 0.75 },
                  color: "#FDE68A", // Metallic-gold text
                  fontWeight: 800,
                  fontSize: { xs: "0.80rem", sm: "0.90rem" },
                  letterSpacing: 1,
                  boxShadow: "0 4px 14px rgba(15, 35, 20, 0.35)",
                  transition: "all 0.25s ease-in-out",
                  "&:hover": {
                    background: "linear-gradient(145deg, #24442D 0%, #17321E 100%)",
                    color: "#FFFFFF",
                    borderColor: "#FDE68A",
                    boxShadow: "0 6px 20px rgba(212, 175, 55, 0.45)",
                    transform: "translateY(-1.5px)",
                  },
                }}
              >
                LOG OUT
              </Button>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      {/* Logout Confirmation Dialog */}
      <Dialog
        open={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        PaperProps={{
          sx: {
            background: "rgba(255, 255, 255, 0.98)",
            backdropFilter: "blur(20px)",
            border: "2px solid #D4AF37",
            borderRadius: 4,
            boxShadow: "0 20px 50px rgba(180, 140, 60, 0.25)",
            p: 1.5,
            maxWidth: 440,
            textAlign: "center",
          },
        }}
      >
        <DialogTitle sx={{ color: "#78350F", fontWeight: 800, fontSize: "1.3rem", pb: 1 }}>
          🎅 Confirm Log Out
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ color: "#292524", mb: 1.5, fontSize: "1.05rem", fontWeight: 600 }}>
            Are you sure you want to log out?
          </Typography>
          <Typography variant="body2" sx={{ color: "#78716C", display: "block" }}>
            ✨ Don't worry! Your participant registrations and Secret Santa assignments will remain permanently saved in Firebase.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", gap: 2, pb: 2 }}>
          <Button
            variant="outlined"
            onClick={() => setLogoutConfirmOpen(false)}
            sx={{
              borderRadius: 20,
              px: 3,
              borderColor: "rgba(212, 175, 55, 0.5)",
              color: "#78350F",
              fontWeight: 700,
              "&:hover": { borderColor: "#D4AF37", backgroundColor: "rgba(253, 248, 237, 0.6)" },
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmLogout}
            startIcon={<LogoutIcon />}
            sx={{
              borderRadius: 20,
              px: 3.5,
              fontWeight: 800,
              background: "linear-gradient(135deg, #FDE68A 0%, #D4AF37 100%)",
              color: "#452C06",
              boxShadow: "0 4px 15px rgba(212, 175, 55, 0.4)",
              "&:hover": {
                background: "linear-gradient(135deg, #FFF6D6 0%, #F59E0B 100%)",
              },
            }}
          >
            Yes, Log Out
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
