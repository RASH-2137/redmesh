"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { ProvisioningRecord } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { formatTimestamp, formatRequesterIdentity, getErrorDetails } from "@/lib/utils";
import {
  KeyRound,
  Layers,
  Clock,
  User,
  ShieldAlert,
  CheckCircle,
  RotateCcw,
  Check,
} from "lucide-react";

export default function ProvisioningPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<ProvisioningRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ title: string; message: string; type: "success" | "error" } | null>(null);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);

  const isCommander = user?.roles.includes("COMMANDER") || user?.roles.includes("ADMIN");

  const loadProvisioning = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getProvisioningRecords();
      setRecords(res.provisioning);
    } catch (err: any) {
      const details = getErrorDetails(err, "Failed to load provisioning records.");
      setError({ title: details.title, message: details.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProvisioning();
  }, []);

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    setFeedback(null);
    try {
      await api.revokeProvisioning(id);
      setFeedback({
        title: "Assignment Revoked",
        message: "Resource assignment has been revoked successfully.",
        type: "success",
      });
      await loadProvisioning();
    } catch (err: any) {
      const details = getErrorDetails(err, "Failed to revoke assignment.");
      setFeedback({
        title: details.title,
        message: details.message,
        type: "error",
      });
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-border">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5 font-sans">
            <KeyRound className="w-6 h-6 text-cyan-400" />
            Resource Assignments
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Resources currently assigned to users and teams.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={loadProvisioning} isLoading={loading}>
          Refresh
        </Button>
      </div>

      {feedback && (
        <Alert
          variant={feedback.type === "success" ? "success" : "danger"}
          title={feedback.title}
        >
          {feedback.message}
        </Alert>
      )}

      {error && (
        <Alert variant="danger" title={error.title}>
          {error.message}
        </Alert>
      )}

      <Card className="border-surface-border bg-surface/90 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-white">Active Assignments</CardTitle>
          <CardDescription>
            Showing assigned resources for unit {user?.unitCode}.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-xs font-mono text-slate-400 animate-pulse">
              Loading assignments...
            </div>
          ) : records.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <KeyRound className="w-10 h-10 text-slate-600 mx-auto" />
              <div className="text-sm text-slate-300 font-medium">No active assignments found</div>
              <p className="text-xs text-slate-500">
                Approved access requests will appear here once provisioned.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-surface-elevated text-slate-400 uppercase tracking-wider font-mono text-[10px] border-y border-surface-border">
                  <tr>
                    <th className="py-3 px-4">Resource</th>
                    <th className="py-3 px-4">Assigned Identity</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Assigned At</th>
                    <th className="py-3 px-4">Revoked At</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {records.map((rec) => {
                    const isProvisioned = rec.status === "PROVISIONED";

                    return (
                      <tr key={rec.id} className="hover:bg-surface-elevated/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-cyan-400" />
                            {rec.assetName || rec.assetId.slice(0, 8)}
                          </div>
                          {rec.assetClassification && (
                            <Badge clearance={rec.assetClassification} className="mt-1 py-0 px-1 text-[9px]" />
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-slate-300 font-sans">
                          {formatRequesterIdentity(
                            rec.userName,
                            rec.userRole,
                            rec.userUnit,
                            rec.userId
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <Badge status={isProvisioned ? "ACTIVE" : rec.status}>
                            {isProvisioned ? "ACTIVE" : rec.status}
                          </Badge>
                        </td>

                        <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                          {formatTimestamp(rec.provisionedAt)}
                        </td>

                        <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                          {formatTimestamp(rec.revokedAt)}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          {isCommander ? (
                            isProvisioned ? (
                              <Button
                                variant="danger"
                                size="sm"
                                className="text-xs px-2.5 py-1"
                                isLoading={revokingId === rec.id}
                                onClick={() => handleRevoke(rec.id)}
                                title="Revoke Assignment"
                              >
                                <RotateCcw className="w-3 h-3 mr-1" />
                                Revoke
                              </Button>
                            ) : (
                              <span className="text-[11px] font-mono text-slate-500">
                                Revoked
                              </span>
                            )
                          ) : (
                            <span className="text-[11px] font-mono text-slate-400">
                              {isProvisioned ? "Active" : "Revoked"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
