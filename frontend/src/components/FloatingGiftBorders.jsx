import React from "react";
import { Box } from "@mui/material";

// Golden Christmas gifts and decorations floating gently along all four screen edges
const leftDecorations = [
  { icon: "🎁", top: "14%", delay: "0s", duration: "4.2s", size: "30px" },
  { icon: "⭐", top: "34%", delay: "1.1s", duration: "3.6s", size: "24px" },
  { icon: "🎄", top: "54%", delay: "0.5s", duration: "4.8s", size: "28px" },
  { icon: "🔔", top: "74%", delay: "1.8s", duration: "4.2s", size: "26px" },
  { icon: "🎁", top: "90%", delay: "2.3s", duration: "4.0s", size: "32px" },
];

const rightDecorations = [
  { icon: "🎁", top: "16%", delay: "0.8s", duration: "4.5s", size: "32px" },
  { icon: "✨", top: "36%", delay: "2.0s", duration: "3.5s", size: "24px" },
  { icon: "🎀", top: "56%", delay: "1.3s", duration: "4.6s", size: "28px" },
  { icon: "🦌", top: "76%", delay: "0.3s", duration: "4.1s", size: "26px" },
  { icon: "🎁", top: "92%", delay: "1.7s", duration: "4.4s", size: "30px" },
];

const topDecorations = [
  { icon: "⭐", left: "18%", delay: "0.4s", duration: "3.8s", size: "22px" },
  { icon: "🎁", left: "38%", delay: "1.5s", duration: "4.4s", size: "26px" },
  { icon: "🔔", left: "62%", delay: "0.9s", duration: "4.0s", size: "22px" },
  { icon: "⭐", left: "82%", delay: "1.9s", duration: "3.7s", size: "24px" },
];

const bottomDecorations = [
  { icon: "🎁", left: "15%", delay: "1.2s", duration: "4.3s", size: "28px" },
  { icon: "🎄", left: "35%", delay: "0.7s", duration: "4.7s", size: "24px" },
  { icon: "✨", left: "65%", delay: "2.1s", duration: "3.9s", size: "22px" },
  { icon: "🎁", left: "85%", delay: "1.0s", duration: "4.5s", size: "28px" },
];

export default function FloatingGiftBorders() {
  return (
    <>
      {/* Left Edge Decorations */}
      <Box
        sx={{
          position: "fixed",
          left: { xs: 4, sm: 14, md: 24 },
          top: 0,
          bottom: 0,
          width: { xs: 32, sm: 46 },
          pointerEvents: "none",
          zIndex: 12,
        }}
      >
        {leftDecorations.map((item, idx) => (
          <Box
            key={`left-${idx}`}
            sx={{
              position: "absolute",
              top: item.top,
              left: 0,
              fontSize: { xs: "20px", sm: item.size },
              filter: "drop-shadow(0 4px 12px rgba(212, 175, 55, 0.55))",
              animation: `gentleFloat ${item.duration} ease-in-out infinite alternate`,
              animationDelay: item.delay,
              opacity: { xs: 0.5, sm: 0.85 },
              userSelect: "none",
            }}
          >
            {item.icon}
          </Box>
        ))}
      </Box>

      {/* Right Edge Decorations */}
      <Box
        sx={{
          position: "fixed",
          right: { xs: 4, sm: 14, md: 24 },
          top: 0,
          bottom: 0,
          width: { xs: 32, sm: 46 },
          pointerEvents: "none",
          zIndex: 12,
        }}
      >
        {rightDecorations.map((item, idx) => (
          <Box
            key={`right-${idx}`}
            sx={{
              position: "absolute",
              top: item.top,
              right: 0,
              fontSize: { xs: "20px", sm: item.size },
              filter: "drop-shadow(0 4px 12px rgba(212, 175, 55, 0.55))",
              animation: `gentleFloat ${item.duration} ease-in-out infinite alternate`,
              animationDelay: item.delay,
              opacity: { xs: 0.5, sm: 0.85 },
              userSelect: "none",
            }}
          >
            {item.icon}
          </Box>
        ))}
      </Box>

      {/* Top Edge Floating Decor */}
      <Box
        sx={{
          position: "fixed",
          top: { xs: 60, sm: 72 },
          left: 0,
          right: 0,
          height: 36,
          pointerEvents: "none",
          zIndex: 12,
          display: { xs: "none", md: "block" },
        }}
      >
        {topDecorations.map((item, idx) => (
          <Box
            key={`top-${idx}`}
            sx={{
              position: "absolute",
              left: item.left,
              top: 0,
              fontSize: item.size,
              filter: "drop-shadow(0 2px 10px rgba(212, 175, 55, 0.5))",
              animation: `gentleFloat ${item.duration} ease-in-out infinite alternate`,
              animationDelay: item.delay,
              opacity: 0.65,
              userSelect: "none",
            }}
          >
            {item.icon}
          </Box>
        ))}
      </Box>

      {/* Bottom Edge Floating Decor */}
      <Box
        sx={{
          position: "fixed",
          bottom: { xs: 8, sm: 14 },
          left: 0,
          right: 0,
          height: 40,
          pointerEvents: "none",
          zIndex: 12,
          display: { xs: "none", sm: "block" },
        }}
      >
        {bottomDecorations.map((item, idx) => (
          <Box
            key={`bottom-${idx}`}
            sx={{
              position: "absolute",
              left: item.left,
              bottom: 0,
              fontSize: item.size,
              filter: "drop-shadow(0 4px 12px rgba(212, 175, 55, 0.5))",
              animation: `gentleFloat ${item.duration} ease-in-out infinite alternate`,
              animationDelay: item.delay,
              opacity: 0.6,
              userSelect: "none",
            }}
          >
            {item.icon}
          </Box>
        ))}
      </Box>
    </>
  );
}
