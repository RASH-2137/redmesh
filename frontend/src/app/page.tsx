"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { Asset, AccessRequest, ProvisioningRecord, AuditVerification } from "@/lib/types";
import { IdentityAvatar } from "@/components/identity-avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { formatTimestamp, truncateHash } from "@/lib/utils";
import {
  Shield,
  ShieldCheck,
  Layers,
  FileCheck,
  KeyRound,
  ArrowUpRight,
  Clock,
  Database,
  Lock,
  Activity,
  CheckCircle,
} from "lucide-react";

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [provisioning, setProvisioning] = useState<ProvisioningRecord[]>([]);
  const [auditStatus, setAuditStatus] = useState<AuditVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboardData() {
      if (!user) return;
      setLoading(true);
      setError(null);

      try {
        const [assetsRes, requestsRes, provisioningRes] = await Promise.all([
          api.getAssets().catch(() => ({ assets: [] })),
          api.getAccessRequests().catch(() => ({ requests: [] })),
          api.getProvisioningRecords().catch(() => ({ provisioning: [] })),
        ]);

        setAssets(assetsRes.assets);
        setRequests(requestsRes.requests);
        setProvisioning(provisioningRes.provisioning);

        // Load audit integrity if user has permission (Auditor or Admin)
        const isAuditorOrAdmin = user.roles.some((r) => r === "AUDITOR" || r === "ADMIN");
        if (isAuditorOrAdmin) {
          try {
            const auditRes = await api.getAuditIntegrity();
            setAuditStatus(auditRes.verification);
          } catch {
            // Non-fatal if forbidden or unavailable
          }
        }
      } catch (err: any) {
        setError(err?.message || "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading && user) {
      loadDashboardData();
    }
  }, [user, authLoading]);

  if (authLoading || (!user && loading)) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
          <span className="text-xs font-mono text-slate-400">Loading session...</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const pendingRequests = requests.filter((r) => r.status === "PENDING");
  const activeProvisioned = provisioning.filter((p) => p.status === "PROVISIONED");

  return (
    <div className="space-y-8">
      {/* Top Welcome / Status Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-surface-border">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5 font-sans">
            Dashboard
          </h1>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Your resources, access requests, and active assignments.
          </p>
        </div>

        {/* Secondary Security Posture Indicator */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-surface border border-surface-border text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-subtle" />
            <span>Session Protected</span>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="danger" title="System Communication Error">
          {error}
        </Alert>
      )}

      {/* Primary Identity Card */}
      <Card className="border-surface-border bg-gradient-to-br from-surface to-surface-elevated shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-5">
            <IdentityAvatar user={user} size="lg" />
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-white tracking-tight font-sans">
                  {user.displayName}
                </h2>
                <Badge clearance={user.clearance} />
              </div>
              <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
                <span>@{user.username}</span>
                <span>•</span>
                <span className="text-cyan-400 font-semibold">{user.roles.join(", ") || "AUTHORIZED"}</span>
                <span>•</span>
                <span className="text-slate-300">Unit: {user.unitCode}</span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans pt-1">
                Active identity session • Unit resource boundary enforced
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => (window.location.href = "/assets")}
              className="flex-1 md:flex-none justify-center"
            >
              View Resources
              <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => (window.location.href = "/profile")}
              className="flex-1 md:flex-none justify-center"
            >
              Identity & Security
            </Button>
          </div>
        </div>
      </Card>

      {/* 3 Metric Overview Cards (Real Data) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="border-surface-border bg-surface/70" glow>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Accessible Resources</CardTitle>
            <Layers className="w-4 h-4 text-cyan-400" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-12 bg-surface-elevated animate-pulse rounded my-0.5" />
            ) : (
              <div className="text-2xl font-bold text-white font-mono">{assets.length}</div>
            )}
            <CardDescription className="mt-1">
              Resources available in unit {user.unitCode}
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="border-surface-border bg-surface/70" glow>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Pending Requests</CardTitle>
            <FileCheck className="w-4 h-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-12 bg-surface-elevated animate-pulse rounded my-0.5" />
            ) : (
              <div className="text-2xl font-bold text-white font-mono">{pendingRequests.length}</div>
            )}
            <CardDescription className="mt-1">
              Access requests awaiting review
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="border-surface-border bg-surface/70" glow>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Active Assignments</CardTitle>
            <KeyRound className="w-4 h-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-12 bg-surface-elevated animate-pulse rounded my-0.5" />
            ) : (
              <div className="text-2xl font-bold text-white font-mono">{activeProvisioned.length}</div>
            )}
            <CardDescription className="mt-1">
              Resources currently assigned and active
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout: Quick Actions & Audit Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Unit Resources List */}
        <Card className="border-surface-border bg-surface/80">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base text-white">Accessible Resources</CardTitle>
              <CardDescription>Resources available within your unit</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => (window.location.href = "/assets")}
              className="text-xs text-cyan-400"
            >
              View All
            </Button>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="space-y-3 py-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-surface-elevated/50 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : assets.length === 0 ? (
              <div className="text-center py-8 text-xs font-mono text-slate-500">
                No accessible resources found for unit {user.unitCode}.
              </div>
            ) : (
              <div className="divide-y divide-surface-border">
                {assets.slice(0, 4).map((asset) => (
                  <div key={asset.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-200 truncate">{asset.name}</div>
                      <div className="text-xs font-mono text-slate-500 mt-0.5">Status: {asset.status}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge clearance={asset.classification} />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => (window.location.href = `/assets`)}
                        className="text-xs px-2.5 py-1"
                      >
                        Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Security Integrity & Pending Requests */}
        <div className="space-y-6">
          {/* Audit Chain Verification Banner if Auditor/Admin */}
          {auditStatus && (
            <Card className="border-surface-border bg-surface/80">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-white flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    Audit Integrity
                  </span>
                  <Badge variant={auditStatus.valid ? "success" : "danger"}>
                    {auditStatus.valid ? "Audit integrity: Verified" : "Tampered"}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Tamper-evident cryptographic audit chain
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs font-mono p-3 rounded-xl bg-surface-elevated border border-surface-border">
                  <div>
                    <span className="text-slate-500">Recorded Events:</span>{" "}
                    <span className="text-slate-200 font-bold">{auditStatus.eventCount}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Hash Algorithm:</span>{" "}
                    <span className="text-slate-200">SHA-256</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => (window.location.href = "/audit")}
                  className="w-full text-xs"
                >
                  View Audit Log
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Pending Access Requests */}
          <Card className="border-surface-border bg-surface/80">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base text-white">Recent Requests</CardTitle>
                <CardDescription>Access requests within your unit</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => (window.location.href = "/requests")}
                className="text-xs text-cyan-400"
              >
                Manage
              </Button>
            </CardHeader>

            <CardContent>
              {loading ? (
                <div className="space-y-3 py-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 bg-surface-elevated/50 animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : requests.length === 0 ? (
                <div className="text-center py-6 text-xs font-mono text-slate-500">
                  No active requests in current unit scope.
                </div>
              ) : (
                <div className="divide-y divide-surface-border">
                  {requests.slice(0, 3).map((req) => (
                    <div key={req.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-slate-200">
                          {req.assetName || "Resource"}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {formatTimestamp(req.createdAt)}
                        </div>
                      </div>
                      <Badge status={req.status} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
