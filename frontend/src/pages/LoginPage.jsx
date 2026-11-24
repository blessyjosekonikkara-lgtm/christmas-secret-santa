import React, { useState } from "react";
import { 
  Box, 
  Paper, 
  Typography, 
  TextField, 
  Button, 
  Alert, 
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent
} from "@mui/material";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import SendIcon from "@mui/icons-material/Send";
import { secretSantaService } from "../services/secretSantaService";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [linkSentModalOpen, setLinkSentModalOpen] = useState(false);

  const validateEmail = (val) => {
    return String(val)
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Please enter your email address.");
      return;
    }

    if (!validateEmail(trimmed)) {
      setError("Please provide a valid email address.");
      return;
    }

    setLoading(true);
    try {
      await secretSantaService.sendMagicLink(trimmed);
      setLinkSentModalOpen(true);
    } catch (err) {
      setError(err.message || "Failed to send magic link. Please check your connection.");
    } finally {
      setLoading(false);
    }
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
        elevation={12}
        sx={{
          p: { xs: 3.5, sm: 5 },
          width: "100%",
          maxWidth: 480,
          borderRadius: 4,
          textAlign: "center",
          background: "rgba(255, 255, 255, 0.90)",
          backdropFilter: "blur(20px)",
          border: "1.5px solid rgba(212, 175, 55, 0.45)",
          boxShadow: "0 20px 50px rgba(180, 140, 60, 0.16), 0 4px 16px rgba(0,0,0,0.05)",
          position: "relative",
        }}
      >
        {/* Festive Golden Logo Emblem */}
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #FDE68A 0%, #D4AF37 100%)",
            border: "2px solid #FFFFFF",
            boxShadow: "0 8px 24px rgba(212, 175, 55, 0.45)",
            mb: 2,
            animation: "gentlePulse 3s infinite",
          }}
        >
          <CardGiftcardIcon sx={{ color: "#78350F", fontSize: 40 }} />
        </Box>

        <Typography
          variant="h4"
          sx={{
            fontWeight: 900,
            letterSpacing: 2,
            color: "#78350F",
            textShadow: "0 1px 4px rgba(212, 175, 55, 0.3)",
            mb: 0.5,
          }}
        >
          SECRET SANTA
        </Typography>

        <Typography
          variant="body1"
          sx={{
            color: "#57534E",
            fontStyle: "italic",
            mb: 3,
            fontSize: "1.05rem",
          }}
        >
          "A Little Surprise, A Lot of Christmas Magic!"
        </Typography>

        <Box
          sx={{
            p: 1.5,
            mb: 3,
            borderRadius: 3,
            backgroundColor: "rgba(253, 248, 237, 0.8)",
            border: "1px dashed rgba(212, 175, 55, 0.45)",
          }}
        >
          <Typography variant="body2" sx={{ color: "#92400E", fontWeight: 700 }}>
            ✨ Private Christmas Friend Exchange for 46 Family Members
          </Typography>
          <Typography variant="caption" sx={{ color: "#78716C" }}>
            Passwordless email verification only. No passwords required.
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Email Address"
            placeholder="name@example.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            sx={{
              mb: 3,
              "& .MuiOutlinedInput-root": {
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                borderRadius: 3,
                "& fieldset": { borderColor: "rgba(212, 175, 55, 0.5)" },
                "&:hover fieldset": { borderColor: "#D4AF37" },
                "&.Mui-focused fieldset": { borderColor: "#B45309" },
              },
              "& input": { color: "#1C1917", fontWeight: 600 },
              "& label": { color: "#78350F" },
            }}
            InputProps={{
              startAdornment: <MarkEmailReadIcon sx={{ color: "#D4AF37", mr: 1 }} />,
            }}
          />

          <Button
            fullWidth
            type="submit"
            variant="contained"
            size="large"
            disabled={loading}
            endIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
            sx={{
              py: 1.6,
              fontSize: "1.05rem",
              letterSpacing: 1.2,
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
            {loading ? "SENDING MAGIC LINK..." : "CONTINUE WITH EMAIL LINK"}
          </Button>
        </form>
      </Paper>

      {/* Confirmation Modal when Magic Link is Sent */}
      <Dialog
        open={linkSentModalOpen}
        onClose={() => setLinkSentModalOpen(false)}
        PaperProps={{
          sx: {
            background: "rgba(255, 255, 255, 0.96)",
            backdropFilter: "blur(20px)",
            border: "2px solid #D4AF37",
            borderRadius: 4,
            p: 2,
            textAlign: "center",
          },
        }}
      >
        <DialogTitle sx={{ color: "#78350F", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
          <AutoAwesomeIcon sx={{ color: "#D4AF37" }} /> Christmas Magic Link Sent!
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ color: "#292524", mb: 2 }}>
            We've sent a secure sign-in link to:
          </Typography>
          <Typography variant="h6" sx={{ color: "#B45309", fontWeight: 800, mb: 2, wordBreak: "break-all" }}>
            {email}
          </Typography>
          <Typography variant="body2" sx={{ color: "#57534E", mb: 2 }}>
            Please check your email inbox and click the link to verify your account and enter the Secret Santa exchange!
          </Typography>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
