export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(url: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(url, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  const isCredentialCall = url === "/api/auth/login" || url === "/api/auth/register";
  if (res.status === 401 && typeof window !== "undefined" && !isCredentialCall) {
    // The cookie may still be validly signed (e.g. user deleted/deactivated), so clear it
    // server-side first; otherwise the proxy would bounce /login back to /dashboard in a loop.
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  }
  if (!res.ok) throw new ApiError(res.status, data.error || `Request failed (${res.status})`);
  return data as T;
}
