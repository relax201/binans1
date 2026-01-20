import { WebSocketServer, WebSocket } from "ws";
import path from 'path';
import fs from 'fs';
import { Server } from "http";
import { storage } from "./storage";
import type { Trade, ActivityLog } from "@shared/schema";

export class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();

  initialize(httpServer: Server) {
    this.wss = new WebSocketServer({ 
      server: httpServer,
      path: "/ws"
    });

    this.wss.on("connection", (ws: WebSocket) => {
      // #region agent log
      const DEBUG_LOG_PATH = path.join(process.cwd(), ".cursor", "debug.log");
      try {
        const logEntry = {
          id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          location: "server/websocket.ts:15",
          message: "WebSocket client connected",
          data: { clientCount: this.clients.size + 1 },
          sessionId: "debug-session",
          runId: "websocket",
          hypothesisId: "WS",
        };
        const logLine = JSON.stringify(logEntry) + "\n";
        fs.appendFileSync(DEBUG_LOG_PATH, logLine, "utf8");
      } catch (error) {
        // Silently fail if logging fails
      }
      // #endregion

      this.clients.add(ws);
      console.log(`WebSocket client connected. Total clients: ${this.clients.size}`);

      // Send initial data
      this.sendToClient(ws, {
        type: "connected",
        message: "تم الاتصال بنجاح",
        timestamp: new Date().toISOString(),
      });

      ws.on("close", () => {
        // #region agent log
        try {
          const logEntry = {
            id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            location: "server/websocket.ts:40",
            message: "WebSocket client disconnected",
            data: { clientCount: this.clients.size - 1 },
            sessionId: "debug-session",
            runId: "websocket",
            hypothesisId: "WS",
          };
          const logLine = JSON.stringify(logEntry) + "\n";
          fs.appendFileSync(DEBUG_LOG_PATH, logLine, "utf8");
        } catch (error) {
          // Silently fail if logging fails
        }
        // #endregion

        this.clients.delete(ws);
        console.log(`WebSocket client disconnected. Total clients: ${this.clients.size}`);
      });

      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
      });
    });

    console.log("WebSocket server initialized on /ws");
  }

  private sendToClient(ws: WebSocket, data: any) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(data));
      } catch (error) {
        console.error("Failed to send WebSocket message:", error);
      }
    }
  }

  broadcast(data: any) {
    const message = JSON.stringify(data);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          console.error("Failed to broadcast message:", error);
        }
      }
    });
  }

  async broadcastTradeUpdate(trade: Trade) {
    this.broadcast({
      type: "trade_update",
      trade,
      timestamp: new Date().toISOString(),
    });
  }

  async broadcastNewTrade(trade: Trade) {
    this.broadcast({
      type: "new_trade",
      trade,
      timestamp: new Date().toISOString(),
    });
  }

  async broadcastTradeClosed(trade: Trade) {
    this.broadcast({
      type: "trade_closed",
      trade,
      timestamp: new Date().toISOString(),
    });
  }

  async broadcastLog(log: ActivityLog) {
    this.broadcast({
      type: "new_log",
      log,
      timestamp: new Date().toISOString(),
    });
  }

  async broadcastStats(stats: any) {
    this.broadcast({
      type: "stats_update",
      stats,
      timestamp: new Date().toISOString(),
    });
  }

  async broadcastSettings(settings: any) {
    this.broadcast({
      type: "settings_update",
      settings,
      timestamp: new Date().toISOString(),
    });
  }

  getClientCount(): number {
    return this.clients.size;
  }

  close() {
    if (this.wss) {
      this.clients.forEach((client) => {
        client.close();
      });
      this.clients.clear();
      this.wss.close();
      this.wss = null;
    }
  }
}

export const wsManager = new WebSocketManager();
