import React, { useEffect, useRef, useState } from "react";
import { 
  Box, 
  Paper, 
  Typography, 
  CircularProgress, 
  Alert, 
  TextField, 
  Button 
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function VerifyEmailPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [promptEmail, setPromptEmail] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const { loginWithEmailLink } = useAuth();
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const handleVerification = async () => {
      const email = window.localStorage.getItem("emailForSignIn");

      if (!email) {
        // Opened on a different device or incognito window
        setPromptEmail(true);
        setLoading(false);
        return;
      }

      try {
        const authedUser = await loginWithEmailLink(email, window.location.href);
        if (authedUser.isAdmin) {
          navigate("/admin");
        } else {
          navigate("/verify-name");
        }
      } catch (err) {
        setError(err.message || "Failed to verify email link.");
        setLoading(false);
      }
    };

    handleVerification();
  }, [loginWithEmailLink, navigate]);

  const handleManualEmailSubmit = async (e) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    setLoading(true);
    setError("");
    try {
      const authedUser = await loginWithEmailLink(emailInput.trim(), window.location.href);
      if (authedUser.isAdmin) {
        navigate("/admin");
      } else {
        navigate("/verify-name");
      }
    } catch (err) {
      setError(err.message || "Failed to verify email link.");
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "80vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
      }}
    >
      <Paper
        elevation={10}
        sx={{
          p: 4.5,
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
          borderRadius: 4,
          background: "rgba(255, 255, 255, 0.92)",
          backdropFilter: "blur(20px)",
          border: "1.5px solid rgba(212, 175, 55, 0.45)",
          boxShadow: "0 20px 50px rgba(180, 140, 60, 0.16)",
        }}
      >
        <AutoAwesomeIcon sx={{ fontSize: 54, color: "#D4AF37", mb: 2 }} />

        <Typography variant="h5" sx={{ color: "#78350F", fontWeight: 800, mb: 1 }}>
          Verifying Magic Link
        </Typography>

        {loading ? (
          <Box sx={{ my: 4 }}>
            <CircularProgress sx={{ color: "#D4AF37", mb: 2 }} />
            <Typography variant="body1" sx={{ color: "#78350F", fontWeight: 600 }}>
              Confirming your Christmas email authentication...
            </Typography>
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ my: 3 }}>
            {error}
            <Button
              variant="text"
              color="inherit"
              size="small"
              onClick={() => navigate("/login")}
              sx={{ display: "block", mt: 1, textDecoration: "underline" }}
            >
              Back to Login
            </Button>
          </Alert>
        ) : promptEmail ? (
          <form onSubmit={handleManualEmailSubmit}>
            <Typography variant="body2" sx={{ color: "#57534E", mb: 2 }}>
              Please confirm your email address to finish signing in:
            </Typography>
            <TextField
              fullWidth
              label="Confirm Your Email"
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              sx={{ mb: 2 }}
            />
            <Button
              fullWidth
              type="submit"
              variant="contained"
              sx={{
                py: 1.2,
                background: "linear-gradient(135deg, #FDE68A 0%, #D4AF37 100%)",
                color: "#452C06",
                fontWeight: 800,
              }}
            >
              Verify & Enter
            </Button>
          </form>
        ) : null}
      </Paper>
    </Box>
  );
}
