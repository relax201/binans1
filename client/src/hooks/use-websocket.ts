import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        setReconnectAttempts(0);
        console.log("WebSocket connected");
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          // Handle different message types
          switch (message.type) {
            case "connected":
              console.log("WebSocket:", message.message);
              break;

            case "new_trade":
            case "trade_update":
            case "trade_closed":
              // Invalidate trades queries to refetch
              queryClient.invalidateQueries({ queryKey: ["/api/trades/active"] });
              queryClient.invalidateQueries({ queryKey: ["/api/trades/history"] });
              queryClient.invalidateQueries({ queryKey: ["/api/stats/summary"] });
              break;

            case "new_log":
              // Invalidate logs query
              queryClient.invalidateQueries({ queryKey: ["/api/logs/recent"] });
              break;

            case "stats_update":
              // Update stats cache
              queryClient.setQueryData(["/api/stats/summary"], message.stats);
              break;

            case "settings_update":
              // Update settings cache
              queryClient.setQueryData(["/api/settings"], message.settings);
              break;

            default:
              console.log("Unknown WebSocket message type:", message.type);
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      ws.onclose = () => {
        setIsConnected(false);
        console.log("WebSocket disconnected");

        // Reconnect with exponential backoff
        const maxAttempts = 5;
        if (reconnectAttempts < maxAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          setReconnectAttempts((prev) => prev + 1);

          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`Reconnecting WebSocket (attempt ${reconnectAttempts + 1})...`);
            connect();
          }, delay);
        } else {
          console.error("Max WebSocket reconnection attempts reached");
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      setIsConnected(false);
    }
  }, [reconnectAttempts, queryClient]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return { isConnected };
}
