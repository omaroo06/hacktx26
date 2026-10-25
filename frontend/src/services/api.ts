/**
 * Browser side of the beta API (server/index.ts). API keys never reach the browser;
 * every model call goes through these /api routes.
 */

import type {
  ApiHealth,
  ChatRequest,
  ChatResponse,
  CoachRequest,
  CoachResponse,
  CrewRequest,
  CrewResponse,
  DetectHoldsResponse,
  RouteContext,
  VisionResponse,
} from "../types/coach";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new Error("Can't reach the beta server. Start it with npm run dev.");
  }

  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !data) {
    if (data?.error) throw new Error(data.error);
    if (res.status >= 500) throw new Error("The beta API server isn't answering. Start it with npm run dev and try again.");
    throw new Error(`Request failed (${res.status}).`);
  }
  return data;
}

const postJson = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const api = {
  health: () => request<ApiHealth>("/api/health"),

  detectHolds(photo: File) {
    const form = new FormData();
    form.append("photo", photo, photo.name);
    return request<DetectHoldsResponse>("/api/holds", { method: "POST", body: form });
  },

  vision(input: { video: File; wallPhoto?: File | null; route: RouteContext | null }) {
    const form = new FormData();
    form.append("video", input.video, input.video.name);
    if (input.wallPhoto && input.route?.holds.length) form.append("wallPhoto", input.wallPhoto, input.wallPhoto.name);
    if (input.route) form.append("route", JSON.stringify(input.route));
    return request<VisionResponse>("/api/vision", { method: "POST", body: form });
  },

  pose(video: File) {
    const form = new FormData();
    form.append("video", video, video.name);
    return request<unknown>("/api/pose", { method: "POST", body: form });
  },

  coach: (body: CoachRequest) => postJson<CoachResponse>("/api/coach", body),
  crew: (body: CrewRequest) => postJson<CrewResponse>("/api/crew", body),
  chat: (body: ChatRequest) => postJson<ChatResponse>("/api/chat", body),
};
