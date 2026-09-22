"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { API_BASE_URL, tokenStore } from "@/lib/api";
import type { WebSocketEvent } from "@/lib/types";

export type ConnectionState = "CONNECTING" | "LIVE" | "RECONNECTING" | "DISCONNECTED";

export interface UseLiveCallSocketOptions {
  onEvent?: (event: WebSocketEvent) => void;
  autoConnect?: boolean;
}

export function useLiveCallSocket(options: UseLiveCallSocketOptions = {}) {
  const { onEvent, autoConnect = true } = options;
  const [connectionState, setConnectionState] = useState<ConnectionState>("DISCONNECTED");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const onEventRef = useRef(onEvent);
  const connectRef = useRef<() => void>(() => {});

  useEffect(() => {
    onEventRef.current = onEvent;
  });

  const connect = useCallback(() => {
    if (typeof window === "undefined") return;

    const token = tokenStore.get();
    if (!token) {
      setConnectionState("DISCONNECTED");
      return;
    }

    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    queueMicrotask(() => {
      setConnectionState((prev) => (prev === "DISCONNECTED" ? "CONNECTING" : "RECONNECTING"));
    });

    // Build WS URL from HTTP URL
    const wsBaseUrl = (process.env.NEXT_PUBLIC_WS_URL || API_BASE_URL)
      .replace(/^http:/, "ws:")
      .replace(/^https:/, "wss:");

    const wsUrl = `${wsBaseUrl}/api/v1/ws?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionState("LIVE");
      // Keep-alive heartbeat every 25 seconds
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send("ping");
        }
      }, 25000);
    };

    ws.onmessage = (event) => {
      if (event.data === "pong") return;
      try {
        const payload: WebSocketEvent = JSON.parse(event.data);
        if (onEventRef.current) {
          onEventRef.current(payload);
        }
      } catch {
        // Non-JSON or debug message
      }
    };

    ws.onclose = () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      wsRef.current = null;
      setConnectionState("RECONNECTING");
      // Attempt reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connectRef.current();
      }, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionState("DISCONNECTED");
  }, []);

  useEffect(() => {
    if (autoConnect) {
      const timer = setTimeout(() => {
        connect();
      }, 0);
      return () => {
        clearTimeout(timer);
        disconnect();
      };
    }
    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    connectionState,
    connect,
    disconnect,
  };
}
