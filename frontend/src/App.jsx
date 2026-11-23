import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider, CssBaseline, Box } from "@mui/material";
import { christmasTheme } from "./theme/christmasTheme";
import { AuthProvider } from "./context/AuthContext";

// Components
import Snowfall from "./components/Snowfall";
import AnimatedSantaSleigh from "./components/AnimatedSantaSleigh";
import ChristmasHeader from "./components/ChristmasHeader";
import ProtectedRoute from "./components/ProtectedRoute";

// Pages
import LoginPage from "./pages/LoginPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import NameVerificationPage from "./pages/NameVerificationPage";
import DashboardPage from "./pages/DashboardPage";
import MyFriendPage from "./pages/MyFriendPage";
import AdminPage from "./pages/AdminPage";
import DummyTestPage from "./pages/DummyTestPage";

export default function App() {
  return (
    <ThemeProvider theme={christmasTheme}>
      <CssBaseline />
      
      {/* 
        MANDATORY FULL-SCREEN CHRISTMAS BACKGROUND
        - Snowy Christmas trees illuminated with warm fairy lights
        - Rendered in a fixed background layer with soft blur and light champagne-gold overlay
      */}
      <div className="fixed-christmas-background" aria-hidden="true">
        <img
          src="/images/christmas-background.jpg"
          alt="Peaceful Snowy Christmas Eve Background"
          className="christmas-bg-img"
        />
        <div className="christmas-light-tint" />
      </div>

      <BrowserRouter>
        <AuthProvider>
          {/* Continuous falling snow engine (Canvas 60fps) across all pages */}
          <Snowfall />

          {/* Header with ONLY the prominent Logout button in top-right */}
          <ChristmasHeader />

          {/* Main Content Area */}
          <Box
            component="main"
            sx={{
              position: "relative",
              zIndex: 10,
              minHeight: "calc(100vh - 68px)",
              pb: 6,
            }}
          >
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/test-dummy" element={<DummyTestPage />} />

              {/* Protected Member Routes */}
              <Route
                path="/verify-name"
                element={
                  <ProtectedRoute>
                    <NameVerificationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-friend"
                element={
                  <ProtectedRoute>
                    <MyFriendPage />
                  </ProtectedRoute>
                }
              />

              {/* Protected Admin Route */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requireAdmin={true}>
                    <AdminPage />
                  </ProtectedRoute>
                }
              />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Box>

          {/* 
            Animated White Doodle-Style Santa Claus in Sleigh
            - Rendered at top of DOM stack to guarantee 100% visibility over all borders
            - Patrols in continuous route:
              BOTTOM RIGHT -> BOTTOM LEFT -> TOP LEFT -> TOP RIGHT -> BOTTOM RIGHT
          */}
          <AnimatedSantaSleigh />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
