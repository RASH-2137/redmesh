import React from "react";
import { cn } from "@/lib/utils";
import type { Clearance, Role, AccessRequestStatus, ProvisioningStatus } from "@/lib/types";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "outline"
    | "success"
    | "warning"
    | "danger"
    | "info"
    | "clearance"
    | "role"
    | "status";
  clearance?: Clearance;
  role?: Role;
  status?: AccessRequestStatus | ProvisioningStatus | string;
}

export function Badge({
  className,
  variant = "default",
  clearance,
  role,
  status,
  children,
  ...props
}: BadgeProps) {
  let badgeClasses = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium tracking-wide transition-colors";

  if (clearance) {
    switch (clearance) {
      case "TOP_SECRET":
        badgeClasses = cn(
          badgeClasses,
          "bg-red-950/60 text-red-400 border border-red-500/30 shadow-sm shadow-red-900/30"
        );
        break;
      case "SECRET":
        badgeClasses = cn(
          badgeClasses,
          "bg-amber-950/60 text-amber-400 border border-amber-500/30 shadow-sm shadow-amber-900/30"
        );
        break;
      case "CONFIDENTIAL":
        badgeClasses = cn(
          badgeClasses,
          "bg-cyan-950/60 text-cyan-400 border border-cyan-500/30 shadow-sm shadow-cyan-900/30"
        );
        break;
    }
  } else if (status) {
    switch (status) {
      case "APPROVED":
      case "PROVISIONED":
      case "AVAILABLE":
      case "ACTIVE":
        badgeClasses = cn(
          badgeClasses,
          "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30"
        );
        break;
      case "PENDING":
        badgeClasses = cn(
          badgeClasses,
          "bg-amber-950/60 text-amber-400 border border-amber-500/30"
        );
        break;
      case "REJECTED":
      case "REVOKED":
        badgeClasses = cn(
          badgeClasses,
          "bg-red-950/60 text-red-400 border border-red-500/30"
        );
        break;
      default:
        badgeClasses = cn(
          badgeClasses,
          "bg-slate-800 text-slate-300 border border-slate-700"
        );
    }
  } else {
    switch (variant) {
      case "success":
        badgeClasses = cn(badgeClasses, "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30");
        break;
      case "warning":
        badgeClasses = cn(badgeClasses, "bg-amber-950/60 text-amber-400 border border-amber-500/30");
        break;
      case "danger":
        badgeClasses = cn(badgeClasses, "bg-red-950/60 text-red-400 border border-red-500/30");
        break;
      case "info":
        badgeClasses = cn(badgeClasses, "bg-cyan-950/60 text-cyan-400 border border-cyan-500/30");
        break;
      case "outline":
        badgeClasses = cn(badgeClasses, "bg-transparent text-slate-300 border border-surface-border");
        break;
      default:
        badgeClasses = cn(badgeClasses, "bg-surface-elevated text-slate-300 border border-surface-border");
    }
  }

  return (
    <span className={cn(badgeClasses, className)} {...props}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {children || clearance || status || role}
    </span>
  );
}
