import React, { useEffect, useRef } from "react";

/**
 * Continuous Falling Snow Component
 * Prime Priority: Runs continuously across all pages, 60fps, pointer-events none,
 * never unmounts or resets during route navigation.
 * Enhanced with subtle champagne-gold glistening for light aesthetic backgrounds.
 */
export default function Snowfall() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let animationFrameId;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    const isMobile = window.innerWidth < 768;
    const flakeCount = isMobile ? 50 : 85;

    const flakes = [];
    for (let i = 0; i < flakeCount; i++) {
      flakes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 2.8 + 1.2,
        speedY: Math.random() * 1.4 + 0.6,
        speedX: (Math.random() - 0.5) * 0.6,
        angle: Math.random() * Math.PI * 2,
        swingSpeed: Math.random() * 0.02 + 0.01,
        opacity: Math.random() * 0.45 + 0.55,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < flakes.length; i++) {
        const flake = flakes[i];

        flake.angle += flake.swingSpeed;
        const drift = Math.sin(flake.angle) * 0.7;

        flake.y += flake.speedY;
        flake.x += flake.speedX + drift;

        if (flake.y > height) {
          flake.y = -6;
          flake.x = Math.random() * width;
        }

        if (flake.x > width + 6) {
          flake.x = -6;
        } else if (flake.x < -6) {
          flake.x = width + 6;
        }

        // Draw glistening snowflake
        ctx.beginPath();
        ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${flake.opacity})`;
        ctx.shadowColor = "rgba(212, 175, 55, 0.4)";
        ctx.shadowBlur = 5;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />
  );
}
