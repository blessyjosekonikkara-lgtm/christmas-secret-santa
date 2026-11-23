import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Box, CircularProgress, Typography } from "@mui/material";

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, familyMembers, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "75vh",
          gap: 2,
        }}
      >
        <CircularProgress sx={{ color: "#D4AF37" }} />
        <Typography variant="body1" sx={{ color: "#78350F", fontStyle: "italic", fontWeight: 600 }}>
          Unwrapping Christmas Magic...
        </Typography>
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && !user.isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // Only redirect to verify-name if this user has ZERO family members registered yet
  if (
    !requireAdmin &&
    familyMembers.length === 0 &&
    location.pathname !== "/verify-name"
  ) {
    return <Navigate to="/verify-name" replace />;
  }

  return children;
}
