import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Clearance, Role } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatClearance(clearance: Clearance | string): string {
  switch (clearance) {
    case "TOP_SECRET":
      return "TOP SECRET";
    case "SECRET":
      return "SECRET";
    case "CONFIDENTIAL":
      return "CONFIDENTIAL";
    default:
      return clearance || "UNKNOWN";
  }
}

export function getClearanceWeight(clearance: Clearance | string): number {
  switch (clearance) {
    case "TOP_SECRET":
      return 3;
    case "SECRET":
      return 2;
    case "CONFIDENTIAL":
      return 1;
    default:
      return 0;
  }
}

export function formatTimestamp(isoString?: string | null): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return isoString;
  }
}

export function truncateHash(hash?: string | null, length = 12): string {
  if (!hash) return "— (GENESIS)";
  if (hash.length <= length) return hash;
  return `${hash.slice(0, 6)}...${hash.slice(-6)}`;
}

export function formatRequesterIdentity(
  name?: string | null,
  role?: string | null,
  unit?: string | null,
  fallbackId?: string | null
): string {
  if (name) {
    const details = [role, unit].filter(Boolean).join(", ");
    return details ? `${name} (${details})` : name;
  }
  if (fallbackId) {
    return `Personnel (${fallbackId.slice(0, 8)})`;
  }
  return "Personnel";
}

export function getErrorDetails(err: unknown, defaultMessage = "Operation failed"): { title: string; message: string } {
  if (err && typeof err === "object" && "status" in err) {
    const status = (err as { status: number }).status;
    const msg = (err as { message?: string }).message || defaultMessage;
    switch (status) {
      case 400:
        return { title: "Invalid Request", message: msg || "The request parameters were invalid." };
      case 401:
        return { title: "Session Expired", message: "Authentication required. Please sign in again." };
      case 403:
        return { title: "Authorization Denied", message: msg || "Your current role is not authorized for this action." };
      case 404:
        return { title: "Resource Not Found", message: msg || "The requested item was not found." };
      case 409:
        return { title: "Workflow Conflict", message: msg || "The request is in a conflicting state." };
      default:
        if (status >= 500) {
          return { title: "Service Unavailable", message: "An unexpected service error occurred. Please try again later." };
        }
        return { title: "Operation Error", message: msg };
    }
  }
  if (err instanceof Error) {
    return { title: "Operation Error", message: err.message || defaultMessage };
  }
  return { title: "Operation Error", message: defaultMessage };
}


