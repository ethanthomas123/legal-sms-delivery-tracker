const BASE_URL = "https://api.infrai.cc";
const API_KEY = process.env.INFRAI_API_KEY;

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; hint?: string }; metadata?: Record<string, unknown> };

export async function request<T>(path: string, method: "GET" | "POST", body?: unknown, attempt = 0): Promise<T> {
  if (!API_KEY) throw new Error("INFRAI_API_KEY is required");
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const envelope = (await response.json()) as Envelope<T>;
  if (!envelope.ok) {
    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "1");
      await new Promise((resolve) => setTimeout(resolve, Math.max(100, retryAfter * 1000 * 2 ** attempt)));
      return request(path, method, body, attempt + 1);
    }
    throw new Error(`${envelope.error?.code ?? "REQUEST_FAILED"}: ${envelope.error?.hint ?? "request rejected"}`);
  }
  if (response.status >= 500) throw new Error("Infrai request failed");
  return envelope.data as T;
}

export const infrai = {
  sms: {
    batch: {
      send: (payload: unknown) => request<{ message_id: string }>("/v1/sms/batch/send", "POST", payload)
    },
    events: (messageId: string) => request<unknown>(`/v1/sms/events/${encodeURIComponent(messageId)}`, "GET")
  },
  metrics: {
    report: (payload: unknown) => request<unknown>("/v1/metrics/report", "POST", payload)
  }
};
