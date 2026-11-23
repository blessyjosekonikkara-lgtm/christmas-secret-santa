import React from "react";
import { Box } from "@mui/material";

/**
 * Animated White Doodle-Style Santa Claus in Sleigh
 * Floats on the topmost animation layer (z-index: 99999, pointer-events: none)
 * so he NEVER gets hidden behind the header, tagline, or cards!
 * 
 * Route:
 * 1. BOTTOM-RIGHT -> BOTTOM-LEFT (Right to Left)
 * 2. BOTTOM-LEFT -> TOP-LEFT (Upward)
 * 3. TOP-LEFT -> TOP-RIGHT (Left to Right along top)
 * 4. TOP-RIGHT -> BOTTOM-RIGHT (Downward)
 * 5. Endlessly repeats in a smooth, continuous loop.
 */
export default function AnimatedSantaSleigh() {
  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 2147483647, // Maximum possible z-index to guarantee Santa is NEVER hidden by any layer
        overflow: "visible",
      }}
    >
      <Box
        className="santa-four-border-rider"
        sx={{
          position: "absolute",
          width: { xs: 78, sm: 92 },
          height: { xs: 39, sm: 46 },
          filter: "drop-shadow(0 0 2px #78350F) drop-shadow(0 3px 10px rgba(0, 0, 0, 0.55)) drop-shadow(0 0 12px rgba(253, 230, 138, 0.95))",
          userSelect: "none",
          transformOrigin: "center center",
        }}
      >
        {/* Crisp White Doodle-Style Santa in Sleigh with Champagne Gold Accent */}
        <svg
          viewBox="0 0 140 70"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: "100%", height: "100%" }}
        >
          {/* Reindeer (leading at the front on the left) */}
          <g stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            {/* Antlers */}
            <path d="M12 16 L8 8 M10 12 L6 11 M14 11 L14 7 M12 9 L16 8" />
            {/* Head */}
            <path d="M12 18 C14 15 19 15 21 18 C22 20 20 23 16 23 C13 23 11 20 12 18 Z" fill="#FFFFFF" />
            <circle cx="15" cy="18" r="1" fill="#78350F" />
            {/* Red Nose */}
            <circle cx="21" cy="19" r="2.2" fill="#E11D48" />
            {/* Body */}
            <path d="M14 23 C10 27 10 32 15 35 C20 38 27 38 31 32 C33 29 32 25 30 24" />
            {/* Legs */}
            <path d="M15 35 L11 47 M13 47 L16 43" />
            <path d="M20 37 L17 48" />
            <path d="M28 34 L32 46 M30 46 L33 42" />
            <path d="M30 32 L35 44" />
            {/* Gold Reins */}
            <path d="M22 24 Q40 28 58 29" stroke="#D4AF37" strokeWidth="2" strokeDasharray="3 2" />
          </g>

          {/* Sleigh Runner / Skids */}
          <path
            d="M50 56 C70 56 100 56 115 56 C124 56 128 52 126 47 C124 43 118 43 116 46"
            stroke="#D4AF37"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path d="M62 56 L66 46 M95 56 L92 46" stroke="#D4AF37" strokeWidth="2.5" strokeLinecap="round" />

          {/* Sleigh Body */}
          <path
            d="M54 36 C54 44 60 48 70 48 L104 48 C114 48 120 42 120 34 C120 28 112 28 108 32 L102 36 Z"
            fill="#FFFFFF"
            stroke="#D4AF37"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />

          {/* Gift Sack */}
          <ellipse cx="100" cy="30" rx="12" ry="10" fill="#FDFBF7" stroke="#D4AF37" strokeWidth="1.8" />
          <path d="M96 22 L104 22 M100 22 L100 19" stroke="#B45309" strokeWidth="1.8" />

          {/* Doodle Santa */}
          <path d="M72 40 C70 34 74 26 82 26 C90 26 92 34 90 40 Z" fill="#FFFFFF" stroke="#D4AF37" strokeWidth="1.8" />
          <circle cx="81" cy="22" r="6" fill="#FFFFFF" stroke="#D4AF37" strokeWidth="1.8" />
          <path d="M75 22 C75 29 87 29 87 22 C87 28 83 31 81 31 C79 31 75 28 75 22 Z" fill="#FDFBF7" />
          <circle cx="79" cy="20" r="0.8" fill="#78350F" />
          <circle cx="77" cy="22" r="1.2" fill="#FDA4AF" />
          <path d="M76 18 C78 12 87 11 91 16 L92 18 Z" fill="#E11D48" />
          <circle cx="92" cy="18" r="2.2" fill="#FFFFFF" />
          {/* Waving Arm */}
          <path d="M72 32 C68 28 66 23 68 20" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" />
          <circle cx="68" cy="19" r="2" fill="#FDE68A" />

          {/* Trailing Magic Golden Stars */}
          <g fill="#D4AF37">
            <circle cx="126" cy="34" r="1.4" />
            <circle cx="132" cy="28" r="1.8" />
            <circle cx="128" cy="22" r="1.2" />
          </g>
        </svg>
      </Box>
    </Box>
  );
}
