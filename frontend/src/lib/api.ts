import type {
  User,
  Asset,
  AccessRequest,
  ProvisioningRecord,
  AuditVerification,
  AuditEvent,
  LoginResponse,
} from "./types";

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

const API_BASE = "/api/backend";

class ApiClient {
  private accessToken: string | null = null;
  private refreshTokenValue: string | null = null;
  private isRefreshing = false;
  private refreshSubscribers: ((token: string) => void)[] = [];

  constructor() {
    if (typeof window !== "undefined") {
      this.accessToken = sessionStorage.getItem("redmesh_access_token") || localStorage.getItem("redmesh_access_token");
      this.refreshTokenValue = sessionStorage.getItem("redmesh_refresh_token") || localStorage.getItem("redmesh_refresh_token");
    }
  }

  public setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshTokenValue = refreshToken;
    if (typeof window !== "undefined") {
      sessionStorage.setItem("redmesh_access_token", accessToken);
      sessionStorage.setItem("redmesh_refresh_token", refreshToken);
      localStorage.setItem("redmesh_access_token", accessToken);
      localStorage.setItem("redmesh_refresh_token", refreshToken);
    }
  }

  public clearTokens() {
    this.accessToken = null;
    this.refreshTokenValue = null;
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("redmesh_access_token");
      sessionStorage.removeItem("redmesh_refresh_token");
      localStorage.removeItem("redmesh_access_token");
      localStorage.removeItem("redmesh_refresh_token");
    }
  }

  public getAccessToken(): string | null {
    return this.accessToken;
  }

  public isAuthenticated(): boolean {
    return Boolean(this.accessToken);
  }

  private onTokenRefreshed(token: string) {
    this.refreshSubscribers.forEach((callback) => callback(token));
    this.refreshSubscribers = [];
  }

  private addRefreshSubscriber(callback: (token: string) => void) {
    this.refreshSubscribers.push(callback);
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requiresAuth = true
  ): Promise<T> {
    const url = `${API_BASE}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
    const headers: Record<string, string> = {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers as Record<string, string>),
    };

    if (requiresAuth && this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401 && requiresAuth && this.refreshTokenValue) {
      if (!this.isRefreshing) {
        this.isRefreshing = true;
        try {
          const newTokens = await this.refreshTokens();
          this.setTokens(newTokens.accessToken, newTokens.refreshToken);
          this.isRefreshing = false;
          this.onTokenRefreshed(newTokens.accessToken);
          return this.request<T>(endpoint, options, requiresAuth);
        } catch (refreshErr) {
          this.isRefreshing = false;
          this.clearTokens();
          throw new ApiError(401, "Session expired. Please log in again.");
        }
      } else {
        return new Promise<T>((resolve, reject) => {
          this.addRefreshSubscriber(async () => {
            try {
              resolve(await this.request<T>(endpoint, options, requiresAuth));
            } catch (err) {
              reject(err);
            }
          });
        });
      }
    }

    if (!response.ok) {
      let errorData: any = null;
      try {
        errorData = await response.json();
      } catch {
        // Ignored if non-json
      }
      const message = errorData?.error || errorData?.message || `Request failed with status ${response.status}`;
      throw new ApiError(response.status, message, errorData);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  // --- Authentication ---

  public async login(username: string, password: string): Promise<LoginResponse> {
    const result = await this.request<LoginResponse>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ username, password }),
      },
      false
    );
    this.setTokens(result.accessToken, result.refreshToken);
    return result;
  }

  public async refreshTokens(): Promise<LoginResponse> {
    if (!this.refreshTokenValue) {
      throw new Error("No refresh token available");
    }
    const result = await this.request<LoginResponse>(
      "/auth/refresh",
      {
        method: "POST",
        body: JSON.stringify({ refreshToken: this.refreshTokenValue }),
      },
      false
    );
    return result;
  }

  public async logout(): Promise<void> {
    try {
      if (this.accessToken) {
        await this.request<void>("/auth/logout", { method: "POST" });
      }
    } finally {
      this.clearTokens();
    }
  }

  public async getMe(): Promise<{ user: User }> {
    return this.request<{ user: User }>("/auth/me");
  }

  // --- Assets ---

  public async getAssets(): Promise<{ assets: Asset[] }> {
    return this.request<{ assets: Asset[] }>("/assets");
  }

  public async getAsset(id: string): Promise<{ asset: Asset }> {
    return this.request<{ asset: Asset }>(`/assets/${id}`);
  }

  // --- Access Requests ---

  public async createAccessRequest(
    assetId: string,
    reason: string
  ): Promise<{ request: AccessRequest }> {
    return this.request<{ request: AccessRequest }>(`/assets/${assetId}/requests`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  }

  public async getAccessRequests(): Promise<{ requests: AccessRequest[] }> {
    return this.request<{ requests: AccessRequest[] }>("/access-requests");
  }

  public async approveAccessRequest(id: string): Promise<{ request: AccessRequest }> {
    return this.request<{ request: AccessRequest }>(`/access-requests/${id}/approve`, {
      method: "POST",
    });
  }

  public async rejectAccessRequest(id: string): Promise<{ request: AccessRequest }> {
    return this.request<{ request: AccessRequest }>(`/access-requests/${id}/reject`, {
      method: "POST",
    });
  }

  // --- Provisioning ---

  public async provisionAccessRequest(id: string): Promise<{ provisioning: ProvisioningRecord }> {
    return this.request<{ provisioning: ProvisioningRecord }>(
      `/access-requests/${id}/provision`,
      {
        method: "POST",
      }
    );
  }

  public async getProvisioningRecords(): Promise<{ provisioning: ProvisioningRecord[] }> {
    return this.request<{ provisioning: ProvisioningRecord[] }>("/provisioning");
  }

  public async revokeProvisioning(id: string): Promise<{ provisioning: ProvisioningRecord }> {
    return this.request<{ provisioning: ProvisioningRecord }>(`/provisioning/${id}/revoke`, {
      method: "POST",
    });
  }

  // --- Audit & Security ---

  public async getAuditIntegrity(): Promise<{ verification: AuditVerification }> {
    return this.request<{ verification: AuditVerification }>("/audit/integrity");
  }

  public async getAuditEvents(): Promise<{ events: AuditEvent[] }> {
    return this.request<{ events: AuditEvent[] }>("/audit/events");
  }
}

export const api = new ApiClient();
