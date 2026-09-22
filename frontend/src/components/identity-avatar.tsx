"use client";

import React, { useMemo } from "react";
import type { User } from "@/lib/types";

interface IdentityAvatarProps {
  user?: User | null;
  seed?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeMap = {
  xs: "w-6 h-6",
  sm: "w-9 h-9",
  md: "w-12 h-12",
  lg: "w-20 h-20",
  xl: "w-32 h-32",
};

// Deterministic simple hash
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function IdentityAvatar({
  user,
  seed,
  size = "md",
  className = "",
}: IdentityAvatarProps) {
  const identifier = seed || user?.username || user?.id || "guest";
  const num = useMemo(() => hashString(identifier), [identifier]);

  // Determine role/clearance accent palette
  const palette = useMemo(() => {
    const role = user?.roles?.[0];
    const clearance = user?.clearance;

    if (role === "COMMANDER" || clearance === "TOP_SECRET") {
      return {
        primary: "#ef4444", // Crimson
        secondary: "#8b5cf6", // Purple
        glow: "rgba(239, 68, 68, 0.4)",
        meshStroke: "#f87171",
        coreGlow: "#dc2626",
      };
    }
    if (role === "AUDITOR" || role === "ADMIN") {
      return {
        primary: "#10b981", // Emerald
        secondary: "#06b6d4", // Cyan
        glow: "rgba(16, 185, 129, 0.35)",
        meshStroke: "#34d399",
        coreGlow: "#059669",
      };
    }
    if (clearance === "SECRET") {
      return {
        primary: "#f59e0b", // Amber
        secondary: "#06b6d4", // Cyan
        glow: "rgba(245, 158, 11, 0.35)",
        meshStroke: "#fbbf24",
        coreGlow: "#d97706",
      };
    }
    // CONFIDENTIAL / Default: Electric Cyan & Deep Blue
    return {
      primary: "#06b6d4", // Cyan
      secondary: "#3b82f6", // Blue
      glow: "rgba(6, 182, 212, 0.4)",
      meshStroke: "#38bdf8",
      coreGlow: "#0284c7",
    };
  }, [user]);

  // Deterministic node variations
  const variant = num % 4;

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-2xl overflow-hidden bg-surface-elevated border border-surface-border shadow-inner ${sizeMap[size]} ${className}`}
      style={{
        boxShadow: `0 0 20px -5px ${palette.glow}, inset 0 0 15px rgba(0,0,0,0.8)`,
      }}
      title={`Identity Mesh: ${user?.displayName || identifier} [${user?.clearance || "UNVERIFIED"}]`}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full transform transition-transform duration-500 hover:scale-105"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id={`glow-${num}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={palette.primary} stopOpacity="0.45" />
            <stop offset="70%" stopColor={palette.secondary} stopOpacity="0.1" />
            <stop offset="100%" stopColor="#080c14" stopOpacity="0.9" />
          </radialGradient>

          <linearGradient id={`grad-mesh-${num}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={palette.primary} stopOpacity="0.9" />
            <stop offset="100%" stopColor={palette.secondary} stopOpacity="0.6" />
          </linearGradient>

          <filter id={`blur-${num}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" />
          </filter>
        </defs>

        {/* Ambient background glow */}
        <circle cx="50" cy="50" r="48" fill={`url(#glow-${num})`} />

        {/* Outer Circular Grid Coordinates */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={palette.meshStroke}
          strokeOpacity="0.15"
          strokeWidth="0.8"
          strokeDasharray="2 4"
        />
        <circle
          cx="50"
          cy="50"
          r="38"
          fill="none"
          stroke={palette.meshStroke}
          strokeOpacity="0.2"
          strokeWidth="0.5"
        />

        {/* Abstract Faceless Digital Silhouette - Polygonal Facets */}
        <g fill="none" stroke={palette.meshStroke} strokeWidth="1" strokeLinejoin="round">
          {/* Facet 1: Forehead / Crest */}
          <polygon
            points="50,16 64,26 50,34 36,26"
            fill={palette.primary}
            fillOpacity="0.25"
            strokeOpacity="0.8"
          />

          {/* Facet 2: Left Temple */}
          <polygon
            points="36,26 50,34 38,50 24,38"
            fill={palette.secondary}
            fillOpacity="0.2"
            strokeOpacity="0.7"
          />

          {/* Facet 3: Right Temple */}
          <polygon
            points="64,26 76,38 62,50 50,34"
            fill={palette.secondary}
            fillOpacity="0.2"
            strokeOpacity="0.7"
          />

          {/* Facet 4: Central Visor / Optical Core (Glowing) */}
          <polygon
            points="50,34 62,50 50,60 38,50"
            fill={palette.coreGlow}
            fillOpacity="0.5"
            stroke={palette.primary}
            strokeOpacity="1"
            strokeWidth="1.2"
          />

          {/* Facet 5: Left Jaw / Mesh Collar */}
          <polygon
            points="38,50 50,60 48,78 30,68"
            fill={palette.primary}
            fillOpacity="0.18"
            strokeOpacity="0.6"
          />

          {/* Facet 6: Right Jaw / Mesh Collar */}
          <polygon
            points="62,50 70,68 52,78 50,60"
            fill={palette.primary}
            fillOpacity="0.18"
            strokeOpacity="0.6"
          />

          {/* Facet 7: Chin Node */}
          <polygon
            points="50,60 52,78 50,86 48,78"
            fill={palette.secondary}
            fillOpacity="0.35"
            strokeOpacity="0.8"
          />

          {/* Collar Bone Lattice */}
          <line x1="30" y1="68" x2="20" y2="86" strokeOpacity="0.4" />
          <line x1="70" y1="68" x2="80" y2="86" strokeOpacity="0.4" />
          <line x1="48" y1="78" x2="35" y2="92" strokeOpacity="0.4" />
          <line x1="52" y1="78" x2="65" y2="92" strokeOpacity="0.4" />
          <line x1="50" y1="86" x2="50" y2="94" strokeOpacity="0.5" />
        </g>

        {/* Dynamic Nodes (Luminous Vertices) */}
        <g fill={palette.primary}>
          <circle cx="50" cy="16" r="2" />
          <circle cx="36" cy="26" r="1.5" />
          <circle cx="64" cy="26" r="1.5" />
          <circle cx="50" cy="34" r="2.2" />
          <circle cx="38" cy="50" r="1.8" />
          <circle cx="62" cy="50" r="1.8" />
          <circle cx="50" cy="60" r="2.5" fill="#ffffff" filter={`url(#blur-${num})`} />
          <circle cx="50" cy="60" r="2" fill="#ffffff" />
          <circle cx="48" cy="78" r="1.5" />
          <circle cx="52" cy="78" r="1.5" />
          <circle cx="50" cy="86" r="1.8" />

          {/* Variant-specific accent vertices */}
          {variant === 0 && (
            <>
              <circle cx="24" cy="38" r="1.2" fill={palette.secondary} />
              <circle cx="76" cy="38" r="1.2" fill={palette.secondary} />
            </>
          )}
          {variant === 1 && (
            <>
              <circle cx="30" cy="68" r="1.2" fill={palette.secondary} />
              <circle cx="70" cy="68" r="1.2" fill={palette.secondary} />
            </>
          )}
          {variant === 2 && (
            <>
              <circle cx="50" cy="25" r="1.5" fill="#ffffff" />
              <circle cx="50" cy="70" r="1.5" fill="#ffffff" />
            </>
          )}
          {variant === 3 && (
            <>
              <circle cx="44" cy="42" r="1" fill={palette.secondary} />
              <circle cx="56" cy="42" r="1" fill={palette.secondary} />
            </>
          )}
        </g>

        {/* Central Optic / Identity Core Scan line */}
        <line
          x1="42"
          y1="50"
          x2="58"
          y2="50"
          stroke="#ffffff"
          strokeWidth="1.2"
          strokeOpacity="0.8"
        />
      </svg>

      {/* Subtle pulsating status indicator in bottom right */}
      <span
        className="absolute bottom-1 right-1 w-2 h-2 rounded-full border border-background animate-pulse-subtle"
        style={{ backgroundColor: palette.primary }}
      />
    </div>
  );
}
