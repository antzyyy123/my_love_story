"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { REQUIRED_VISITS, SITE_CONTENT } from "@/lib/content";

const STORAGE_KEY = "floral-cosmos-progress";
const TOTAL_MEMORIES = 1 + SITE_CONTENT.solarSystem.planets.length; // Sun + 8 planets = 9

interface StoredProgress {
  visited: string[];
  finaleSeen: boolean;
  moonFound: boolean;
  moonVisited: boolean;
}

export interface ProgressContextValue {
  visitedIds: Set<string>;
  visitedCount: number;
  totalMemories: number;
  totalRequired: number;
  finaleSeen: boolean;
  moonFound: boolean;
  moonVisited: boolean;
  hydrated: boolean;
  markVisited: (id: string) => void;
  markFinaleSeen: () => void;
  markMoonFound: () => void;
  markMoonVisited: () => void;
  resetProgress: () => void;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

function readStorage(): StoredProgress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { visited: [], finaleSeen: false, moonFound: false, moonVisited: false };
    const parsed = JSON.parse(raw) as Partial<StoredProgress>;
    const visited = Array.isArray(parsed.visited)
      ? parsed.visited.filter((v): v is string => typeof v === "string")
      : [];
    return {
      visited: Array.from(new Set(visited)),
      finaleSeen: Boolean(parsed.finaleSeen),
      moonFound: Boolean(parsed.moonFound),
      moonVisited: Boolean(parsed.moonVisited),
    };
  } catch {
    return { visited: [], finaleSeen: false, moonFound: false, moonVisited: false };
  }
}

function writeStorage(next: StoredProgress): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota or private-browsing errors
  }
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoredProgress>({
    visited: [],
    finaleSeen: false,
    moonFound: false,
    moonVisited: false,
  });
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on client mount, handle ?resetProgress=1, and sync across tabs
  useEffect(() => {
    let shouldReset = false;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("resetProgress") === "1") {
        shouldReset = true;
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Ignore
    }

    const initial = shouldReset
      ? { visited: [], finaleSeen: false, moonFound: false, moonVisited: false }
      : readStorage();
    const raf = window.requestAnimationFrame(() => {
      setState(initial);
      setHydrated(true);
    });

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setState(readStorage());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const markVisited = useCallback((id: string) => {
    if (!id) return;
    setState((prev) => {
      if (prev.visited.includes(id)) return prev;
      const next: StoredProgress = {
        ...prev,
        visited: [...prev.visited, id],
      };
      writeStorage(next);
      return next;
    });
  }, []);

  const markFinaleSeen = useCallback(() => {
    setState((prev) => {
      if (prev.finaleSeen) return prev;
      const next: StoredProgress = { ...prev, finaleSeen: true };
      writeStorage(next);
      return next;
    });
  }, []);

  const markMoonFound = useCallback(() => {
    setState((prev) => {
      if (prev.moonFound) return prev;
      const next: StoredProgress = { ...prev, moonFound: true };
      writeStorage(next);
      return next;
    });
  }, []);

  const markMoonVisited = useCallback(() => {
    setState((prev) => {
      if (prev.moonVisited && prev.moonFound) return prev;
      const next: StoredProgress = { ...prev, moonFound: true, moonVisited: true };
      writeStorage(next);
      return next;
    });
  }, []);

  const resetProgress = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
    setState({ visited: [], finaleSeen: false, moonFound: false, moonVisited: false });
  }, []);

  const totalRequired =
    REQUIRED_VISITS === "all"
      ? TOTAL_MEMORIES
      : Math.max(1, Math.min(TOTAL_MEMORIES, REQUIRED_VISITS));

  const value = useMemo<ProgressContextValue>(() => {
    const visitedIds = new Set(state.visited);
    return {
      visitedIds,
      visitedCount: visitedIds.size,
      totalMemories: TOTAL_MEMORIES,
      totalRequired,
      finaleSeen: state.finaleSeen,
      moonFound: state.moonFound,
      moonVisited: state.moonVisited,
      hydrated,
      markVisited,
      markFinaleSeen,
      markMoonFound,
      markMoonVisited,
      resetProgress,
    };
  }, [
    state,
    totalRequired,
    hydrated,
    markVisited,
    markFinaleSeen,
    markMoonFound,
    markMoonVisited,
    resetProgress,
  ]);

  return (
    <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
  );
}

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) {
    throw new Error("useProgress must be used within a ProgressProvider");
  }
  return ctx;
}
