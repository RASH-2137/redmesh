"use client";

import React from "react";
import { useAuth } from "@/lib/auth-context";
import { IdentityAvatar } from "@/components/identity-avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Shield,
  User,
  LogOut,
  Building2,
  Key,
  CheckCircle,
  ShieldCheck,
} from "lucide-react";

export default function ProfilePage() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const isReviewer = user.roles.includes("COMMANDER") || user.roles.includes("ADMIN");

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="pb-4 border-b border-surface-border">
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5 font-sans">
          <User className="w-6 h-6 text-cyan-400" />
          Account & Security Profile
        </h1>
        <p className="text-xs text-slate-400 mt-1 font-sans">
          Identity attributes, security clearance, and active session status.
        </p>
      </div>

      {/* 1. Personnel Identity Card */}
      <Card className="border-surface-border bg-surface/90 shadow-2xl">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <IdentityAvatar user={user} size="xl" />
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-white font-sans">{user.displayName}</h2>
                  <Badge clearance={user.clearance} />
                </div>
                <div className="text-xs font-mono text-cyan-400">@{user.username}</div>
                <div className="text-xs font-mono text-slate-400">
                  Role: <span className="text-white font-semibold">{user.roles.join(", ") || "AUTHORIZED"}</span>
                </div>
                <div className="text-xs font-mono text-slate-400 flex items-center gap-1.5 pt-1">
                  <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Assigned Unit: {user.unitCode}</span>
                </div>
              </div>
            </div>

            <Button
              variant="danger"
              size="sm"
              onClick={() => logout()}
              className="sm:self-start"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-4 border-t border-surface-border">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-3.5 rounded-xl bg-surface-elevated border border-surface-border space-y-1.5">
              <div className="text-slate-500 font-semibold uppercase text-[10px]">Personnel Account ID</div>
              <div className="text-slate-200 break-all select-all font-sans text-xs">{user.id}</div>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-elevated border border-surface-border space-y-1.5">
              <div className="text-slate-500 font-semibold uppercase text-[10px]">Account Status</div>
              <div className="flex items-center gap-2 text-emerald-400 font-sans text-xs font-semibold">
                <CheckCircle className="w-4 h-4" />
                <span>Active & Verified</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Operational Clearance & Scope */}
      <Card className="border-surface-border bg-surface/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            Clearance & Authorization Scope
          </CardTitle>
          <CardDescription>
            Authoritative access privileges assigned to this account.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-sans">
            <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border space-y-2">
              <div className="text-slate-400 font-medium">Security Clearance</div>
              <Badge clearance={user.clearance} />
              <p className="text-slate-400 text-[11px] pt-1">
                Authorizes inspection and access to resources up to {user.clearance} classification.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border space-y-2">
              <div className="text-slate-400 font-medium">Operational Unit Scope</div>
              <div className="font-mono text-white text-sm font-semibold">{user.unitCode}</div>
              <p className="text-slate-400 text-[11px] pt-1">
                Access boundary restricted strictly to assets and personnel assigned to Unit {user.unitCode}.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border space-y-2">
              <div className="text-slate-400 font-medium">Workflow Authority</div>
              <div className="font-sans text-white text-sm font-semibold">
                {isReviewer ? "Authorized Reviewer" : "Standard Personnel"}
              </div>
              <p className="text-slate-400 text-[11px] pt-1">
                {isReviewer
                  ? "Authorized to evaluate, approve, reject, and provision unit access requests."
                  : "Authorized to submit access requests for required unit resources."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Session Status */}
      <Card className="border-surface-border bg-surface/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-white flex items-center gap-2">
            <Key className="w-4 h-4 text-amber-400" />
            Active Session Security
          </CardTitle>
          <CardDescription>
            Current session protection and termination controls.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 text-xs font-sans">
          <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-semibold text-white">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Protected Identity Session Active</span>
              </div>
              <p className="text-slate-400 text-xs">
                Your session is authoritatively verified and cryptographically scoped to Unit {user.unitCode}.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => logout()}
              className="text-xs self-start sm:self-auto"
            >
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              Terminate Session
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
