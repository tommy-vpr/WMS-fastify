/**
 * API Helper
 *
 * Save to: apps/web/src/lib/api.ts
 */

const API_BASE = import.meta.env.VITE_API_URL || "/api";

// ============================================================================
// Types
// ============================================================================

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}

// ============================================================================
// Token Management
// ============================================================================

function getAccessToken(): string | null {
  try {
    const stored = localStorage.getItem("wms_tokens");
    if (!stored) return null;
    return JSON.parse(stored).accessToken;
  } catch {
    return null;
  }
}

function getRefreshToken(): string | null {
  try {
    const stored = localStorage.getItem("wms_tokens");
    if (!stored) return null;
    return JSON.parse(stored).refreshToken;
  } catch {
    return null;
  }
}

function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(
    "wms_tokens",
    JSON.stringify({ accessToken, refreshToken }),
  );
}

function clearTokens(): void {
  localStorage.removeItem("wms_tokens");
  localStorage.removeItem("wms_user");
}

// ============================================================================
// API Client
// ============================================================================

export async function api<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const headers = new Headers(options.headers);

  // Add auth token
  const token = getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Add content type for JSON body
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response = await fetch(url, { ...options, headers });

  // Handle 401 - try refresh
  if (response.status === 401) {
    const refreshToken = getRefreshToken();

    if (refreshToken) {
      const refreshResponse = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        setTokens(data.accessToken, data.refreshToken);

        // Retry original request
        headers.set("Authorization", `Bearer ${data.accessToken}`);
        response = await fetch(url, { ...options, headers });
      } else {
        // Refresh failed - logout
        clearTokens();
        window.location.href = "/login";
        throw new Error("Session expired");
      }
    } else {
      clearTokens();
      window.location.href = "/login";
      throw new Error("Not authenticated");
    }
  }

  // Parse response
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error?.message || data.message || "Request failed");
  }

  return data as T;
}

// ============================================================================
// Convenience Methods
// ============================================================================

export const apiClient = {
  get: <T = unknown>(endpoint: string) => api<T>(endpoint, { method: "GET" }),

  post: <T = unknown>(endpoint: string, body?: unknown) =>
    api<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T = unknown>(endpoint: string, body?: unknown) =>
    api<T>(endpoint, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T = unknown>(endpoint: string, body?: unknown) =>
    api<T>(endpoint, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T = unknown>(endpoint: string) =>
    api<T>(endpoint, { method: "DELETE" }),
};

// ============================================================================
// Usage Examples
// ============================================================================

/*
// Simple GET
const products = await apiClient.get<Product[]>("/products");

// POST with body
const order = await apiClient.post<Order>("/orders", { items: [...] });

// With error handling
try {
  const data = await apiClient.get("/products");
} catch (error) {
  console.error(error.message);
}

// In React Query
const { data } = useQuery({
  queryKey: ["products"],
  queryFn: () => apiClient.get<Product[]>("/products"),
});
*/
