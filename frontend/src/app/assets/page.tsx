"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { Asset } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Modal } from "@/components/ui/modal";
import { getClearanceWeight } from "@/lib/utils";
import {
  Layers,
  Shield,
  Lock,
  CheckCircle,
  AlertTriangle,
  Send,
  Eye,
  Info,
  Building2,
} from "lucide-react";

export default function AssetsPage() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inspection modal state
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [inspectingAsset, setInspectingAsset] = useState<Asset | null>(null);
  const [selectedInspectAsset, setSelectedInspectAsset] = useState<Asset | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);

  // Request modal state
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [targetAsset, setTargetAsset] = useState<Asset | null>(null);
  const [requestReason, setRequestReason] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);

  const loadAssets = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getAssets();
      setAssets(response.assets);
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.status === 401) setError("Session expired. Please log in again.");
        else if (err.status === 403) setError("Authorization denied: Ineligible to list unit resources.");
        else setError(err.message);
      } else {
        setError("Network error: Unable to connect to REDmesh API.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, []);

  const handleInspect = async (asset: Asset) => {
    setSelectedInspectAsset(asset);
    setInspectingAsset(null);
    setInspectError(null);
    setInspectLoading(true);
    setInspectModalOpen(true);

    try {
      // Direct call to GET /assets/:id (Tested under Cerbos PDP)
      const res = await api.getAsset(asset.id);
      setInspectingAsset(res.asset);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 403) {
        setInspectError(
          "Authorization denied: Your current security clearance is insufficient to inspect this classified resource (Cerbos Policy Rejection)."
        );
      } else if (err instanceof ApiError && err.status === 404) {
        setInspectError("Resource not found or isolated by Row-Level Security.");
      } else {
        setInspectError(err?.message || "Failed to inspect asset.");
      }
    } finally {
      setInspectLoading(false);
    }
  };

  const openRequestModal = (asset: Asset) => {
    setTargetAsset(asset);
    setRequestReason("");
    setRequestSuccess(null);
    setRequestModalOpen(true);
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAsset) return;

    setSubmittingRequest(true);
    try {
      await api.createAccessRequest(targetAsset.id, requestReason);
      setRequestSuccess(`Access request for ${targetAsset.name} submitted successfully.`);
      setTimeout(() => {
        setRequestModalOpen(false);
        setRequestSuccess(null);
      }, 1500);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 403) {
        setError("Authorization denied by Cerbos: Role not permitted to request this resource.");
      } else {
        setError(err?.message || "Failed to create access request.");
      }
      setRequestModalOpen(false);
    } finally {
      setSubmittingRequest(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-border">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5 font-sans">
            <Layers className="w-6 h-6 text-cyan-400" />
            Resources
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Resources available to your organization and current access level.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={loadAssets} isLoading={loading}>
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="danger" title="Access Error">
          {error}
        </Alert>
      )}

      {/* Asset Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[1, 2, 3].map((n) => (
            <Card key={n} className="border-surface-border animate-pulse h-48 bg-surface-elevated/40" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <Card className="border-surface-border text-center py-12">
          <CardContent className="space-y-3">
            <Layers className="w-10 h-10 text-slate-600 mx-auto" />
            <div className="text-sm font-medium text-slate-300">No resources found in current unit scope</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              PostgreSQL Row-Level Security restricts queries to unit {user?.unitCode || "assigned"}.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assets.map((asset) => {
            const userClearanceWeight = getClearanceWeight(user?.clearance || "");
            const assetClassificationWeight = getClearanceWeight(asset.classification);
            const clearanceAllowed = userClearanceWeight >= assetClassificationWeight;

            return (
              <Card
                key={asset.id}
                className="border-surface-border bg-surface/80 hover:border-slate-600 transition-all flex flex-col justify-between"
                glow
              >
                <div>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base font-semibold text-white truncate">
                        {asset.name}
                      </CardTitle>
                      <Badge clearance={asset.classification} />
                    </div>
                    <CardDescription className="font-mono text-[11px] text-slate-400">
                      ID: {asset.id.slice(0, 8)}...{asset.id.slice(-4)}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-3 pt-0">
                    <div className="space-y-1.5 text-xs font-mono p-3 rounded-xl bg-surface-elevated/60 border border-surface-border">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Status:</span>
                        <Badge status={asset.status} className="py-0 px-2 text-[10px]" />
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Unit:</span>
                        <span className="text-cyan-400 flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {user?.unitCode}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Clearance Match:</span>
                        <span
                          className={`font-semibold ${
                            clearanceAllowed ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {clearanceAllowed ? "ELIGIBLE" : "RESTRICTED"}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </div>

                {/* Card Actions */}
                <div className="p-6 pt-0 flex gap-2 border-t border-surface-border mt-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => handleInspect(asset)}
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" />
                    Details
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs text-cyan-400 hover:text-cyan-300"
                    onClick={() => openRequestModal(asset)}
                  >
                    <Send className="w-3.5 h-3.5 mr-1" />
                    Request Access
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Inspect Detail Modal */}
      <Modal
        isOpen={inspectModalOpen}
        onClose={() => setInspectModalOpen(false)}
        title="Resource Details"
        description="Resource attributes, operational status, and security classification."
      >
        {inspectLoading ? (
          <div className="py-8 text-center text-xs font-mono text-cyan-400 animate-pulse">
            Verifying security clearance...
          </div>
        ) : inspectError ? (
          <div className="space-y-4">
            <Alert variant="danger" title="Authorization Denied">
              {selectedInspectAsset
                ? `This resource requires ${selectedInspectAsset.classification} clearance. If your operational duties require access, submit an access request for review.`
                : "Your current clearance level is insufficient to view details for this resource."}
            </Alert>
            <div className="p-3 rounded-xl bg-surface-elevated border border-surface-border text-xs text-slate-300 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Resource Name:</span>
                <span className="text-white font-semibold">{selectedInspectAsset?.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Required Clearance:</span>
                {selectedInspectAsset && <Badge clearance={selectedInspectAsset.classification} />}
              </div>
              <div className="text-slate-400 pt-1 text-[11px]">
                Access requests are subject to review by unit commanding officers.
              </div>
            </div>
          </div>
        ) : inspectingAsset ? (
          <div className="space-y-4">
            <Alert variant="success" title="Access Authorized">
              Your identity clearance satisfies resource access requirements.
            </Alert>
            <div className="space-y-2 p-3 rounded-xl bg-surface-elevated border border-surface-border text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Resource Name:</span>
                <span className="text-white font-bold">{inspectingAsset.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Classification:</span>
                <Badge clearance={inspectingAsset.classification} />
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Unit ID:</span>
                <span className="text-cyan-400">{inspectingAsset.unitId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <Badge status={inspectingAsset.status} />
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Request Access Modal */}
      <Modal
        isOpen={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        title={`Request Access: ${targetAsset?.name || "Resource"}`}
        description="Submit an access request for organizational review."
      >
        {requestSuccess ? (
          <Alert variant="success" title="Request Created">
            {requestSuccess}
          </Alert>
        ) : (
          <form onSubmit={handleCreateRequest} className="space-y-4">
            <div className="p-3 rounded-xl bg-surface-elevated border border-surface-border text-xs font-mono space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Resource:</span>
                <span className="text-white">{targetAsset?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Classification:</span>
                <span className="text-amber-400">{targetAsset?.classification}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Requester:</span>
                <span className="text-cyan-400">@{user?.username}</span>
              </div>
            </div>

            <Input
              label="Business Justification"
              id="reason"
              value={requestReason}
              onChange={(e) => setRequestReason(e.target.value)}
              placeholder="e.g., Scheduled maintenance or operational task"
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full"
              isLoading={submittingRequest}
            >
              Submit Request
            </Button>
          </form>
        )}
      </Modal>
    </div>
  );
}
