import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import type { AppCloseRequest } from "@shared/types";

type CloseHandler = (request: AppCloseRequest) => void;

interface AppCloseContextValue {
  registerCloseHandler(handler: CloseHandler): () => void;
}

const AppCloseContext = createContext<AppCloseContextValue | null>(null);

export function AppCloseProvider({ children }: { children: React.ReactNode }) {
  const handlerRef = useRef<CloseHandler | null>(null);

  useEffect(() => window.desktopApi.lifecycle.onCloseRequested((request) => {
    if (handlerRef.current) {
      handlerRef.current(request);
    } else {
      window.desktopApi.lifecycle.respondToClose({ requestId: request.requestId, decision: "proceed" });
    }
  }), []);

  const registerCloseHandler = useCallback((handler: CloseHandler) => {
    handlerRef.current = handler;
    return () => {
      if (handlerRef.current === handler) handlerRef.current = null;
    };
  }, []);

  const value = useMemo(() => ({ registerCloseHandler }), [registerCloseHandler]);
  return <AppCloseContext.Provider value={value}>{children}</AppCloseContext.Provider>;
}

export function useAppCloseHandler(handler: CloseHandler | null, enabled = true): void {
  const context = useContext(AppCloseContext);
  useEffect(() => {
    if (!context || !enabled || !handler) return undefined;
    return context.registerCloseHandler(handler);
  }, [context, enabled, handler]);
}
