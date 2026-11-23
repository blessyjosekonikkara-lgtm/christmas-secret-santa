import { createTheme } from "@mui/material/styles";

export const christmasTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#B45309", // Warm Amber Gold
      light: "#FDE68A",
      dark: "#78350F",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#D4AF37", // Champagne Gold
      light: "#FFF6D6",
      dark: "#92400E",
      contrastText: "#452C06",
    },
    background: {
      default: "transparent",
      paper: "rgba(255, 255, 255, 0.90)",
    },
    success: {
      main: "#10B981",
    },
    text: {
      primary: "#1C1917", // Rich Dark Charcoal for crisp readability
      secondary: "#57534E", // Warm Stone Gray
    },
  },
  typography: {
    fontFamily: [
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "Roboto",
      '"Helvetica Neue"',
      "Arial",
      "sans-serif",
    ].join(","),
    h1: { fontWeight: 900, letterSpacing: "0.04em", color: "#78350F" },
    h2: { fontWeight: 800, letterSpacing: "0.03em", color: "#78350F" },
    h3: { fontWeight: 800, color: "#78350F" },
    h4: { fontWeight: 800, color: "#78350F" },
    button: { textTransform: "none", fontWeight: 700 },
  },
  shape: {
    borderRadius: 16,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 28,
          padding: "10px 24px",
          fontSize: "1rem",
          boxShadow: "0 4px 14px rgba(180, 140, 60, 0.15)",
          transition: "all 0.25s ease-in-out",
          "&:hover": {
            transform: "translateY(-2px)",
            boxShadow: "0 6px 20px rgba(212, 175, 55, 0.35)",
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backdropFilter: "blur(18px)",
          border: "1.5px solid rgba(212, 175, 55, 0.45)",
          boxShadow: "0 20px 50px rgba(180, 140, 60, 0.16), 0 4px 16px rgba(0,0,0,0.05)",
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 14,
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            "& fieldset": { borderColor: "rgba(212, 175, 55, 0.4)" },
            "&:hover fieldset": { borderColor: "#D4AF37" },
            "&.Mui-focused fieldset": { borderColor: "#B45309", borderWidth: 2 },
          },
        },
      },
    },
  },
});
