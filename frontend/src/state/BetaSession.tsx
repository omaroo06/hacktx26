import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Hold, HoldColorId, RouteSelection } from "../types/wall";
import type { ApiHealth, RouteContext, RouteHoldRef } from "../types/coach";
import { useWallPhoto, type UseWallPhoto } from "../hooks/useWallPhoto";
import { api } from "../services/api";
import { holdDetector, numberRouteHolds } from "../services/holdDetection";

export type DetectionStatus = "idle" | "loading" | "ready" | "error" | "unavailable";

export interface DetectionState {
  status: DetectionStatus;
  holds: Hold[];
  routeColors: HoldColorId[];
  model: string | null;
  cached: boolean;
  error: string | null;
}

const EMPTY_DETECTION: DetectionState = { status: "idle", holds: [], routeColors: [], model: null, cached: false, error: null };
export const EMPTY_ROUTE: RouteSelection = { color: null, name: "", grade: "", source: "manual" };

interface BetaSession {
  wall: UseWallPhoto;
  route: RouteSelection;
  setRoute: (next: RouteSelection | ((r: RouteSelection) => RouteSelection)) => void;
  detection: DetectionState;
  redetect: () => void;
  /** The chosen route's holds, numbered start → finish. */
  routeHolds: RouteHoldRef[];
  /** What the coach needs to know about the wall, or null before a route is set. */
  routeContext: RouteContext | null;
  health: ApiHealth | null;
  /** A hold number to light up on the wall, e.g. while hovering feedback about it. */
  highlightHold: number | null;
  setHighlightHold: (n: number | null) => void;
}

const SessionContext = createContext<BetaSession | null>(null);

export function BetaSessionProvider({ children }: { children: ReactNode }) {
  const wall = useWallPhoto();
  const [route, setRoute] = useState<RouteSelection>(EMPTY_ROUTE);
  const [detection, setDetection] = useState<DetectionState>(EMPTY_DETECTION);
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [highlightHold, setHighlightHold] = useState<number | null>(null);
  const run = useRef(0);

  useEffect(() => {
    let alive = true;
    api
      .health()
      .then((h) => alive && setHealth(h))
      .catch(() => alive && setHealth(null));
    return () => {
      alive = false;
    };
  }, []);

  const detect = useCallback(async () => {
    const photo = wall.photo;
    const token = ++run.current;
    if (!photo) {
      setDetection(EMPTY_DETECTION);
      return;
    }
    setDetection({ ...EMPTY_DETECTION, status: "loading" });
    try {
      const result = await holdDetector.detect(photo);
      if (token !== run.current) return;
      setDetection({ status: "ready", ...result, error: null });
    } catch (err) {
      if (token !== run.current) return;
      setDetection({ ...EMPTY_DETECTION, status: "error", error: (err as Error).message });
    }
  }, [wall.photo]);

  // Read every new wall photo as soon as it loads, when Gemini is set up.
  const geminiReady = health ? health.gemini.ready : null;
  useEffect(() => {
    if (!wall.photo) {
      run.current++;
      setDetection(EMPTY_DETECTION);
      setRoute(EMPTY_ROUTE);
      return;
    }
    if (geminiReady === false) {
      setDetection({ ...EMPTY_DETECTION, status: "unavailable" });
      return;
    }
    void detect();
  }, [wall.photo, geminiReady, detect]);

  const routeHolds = useMemo(() => numberRouteHolds(detection.holds, route.color), [detection.holds, route.color]);

  const routeContext = useMemo<RouteContext | null>(
    () =>
      route.color
        ? { color: route.color, name: route.name.trim(), grade: route.grade.trim(), holds: routeHolds }
        : null,
    [route, routeHolds],
  );

  const value: BetaSession = {
    wall,
    route,
    setRoute,
    detection,
    redetect: () => void detect(),
    routeHolds,
    routeContext,
    health,
    highlightHold,
    setHighlightHold,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useBetaSession(): BetaSession {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useBetaSession must be used inside BetaSessionProvider");
  return session;
}
