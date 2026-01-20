import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import fs from "fs";
import path from "path";
import { wsManager } from "./websocket";
import { errorHandler } from "./middleware/error-handler";
import { apiRateLimit } from "./middleware/rate-limit";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Rate limiting middleware
app.use("/api", apiRateLimit);

// Debug logging helper
const DEBUG_LOG_PATH = path.resolve(process.cwd(), ".cursor", "debug.log");
function debugLog(location: string, message: string, data: any = {}, hypothesisId: string = "") {
  try {
    const logEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      location,
      message,
      data,
      sessionId: "debug-session",
      runId: "startup",
      hypothesisId,
    };
    const logLine = JSON.stringify(logEntry) + "\n";
    fs.appendFileSync(DEBUG_LOG_PATH, logLine, "utf8");
  } catch (error) {
    // Silently fail if logging fails
  }
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // #region agent log
  debugLog('server/index.ts:62', 'Server initialization started', { timestamp: Date.now() }, 'A');
  // #endregion

  // Get port early and validate
  const port = parseInt(process.env.PORT || "5001", 10);

  // #region agent log
  debugLog('server/index.ts:66', 'Port parsed', { port, envPort: process.env.PORT }, 'D');
  // #endregion

  // Add a simple health check endpoint that responds immediately
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // #region agent log
  debugLog('server/index.ts:71', 'Starting route registration', {}, 'B');
  // #endregion

  try {
    await registerRoutes(httpServer, app);

    // #region agent log
    debugLog('server/index.ts:75', 'Route registration completed', {}, 'B');
    // #endregion

    // Initialize WebSocket server
    // #region agent log
    debugLog('server/index.ts:80', 'Initializing WebSocket server', {}, 'WS');
    // #endregion
    wsManager.initialize(httpServer);
    // #region agent log
    debugLog('server/index.ts:83', 'WebSocket server initialized', {}, 'WS');
    // #endregion
  } catch (error) {
    // #region agent log
    debugLog('server/index.ts:78', 'Route registration failed', { error: String(error) }, 'B');
    // #endregion
    throw error;
  }

  // Error handling middleware (must be after routes)
  app.use(errorHandler);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  const nodeEnv = process.env.NODE_ENV;
  // #region agent log
  debugLog('server/index.ts:90', 'Checking environment for Vite setup', { nodeEnv, isProduction: nodeEnv === "production" }, 'C');
  // #endregion

  if (nodeEnv === "production") {
    // #region agent log
    debugLog('server/index.ts:92', 'Setting up static serving', {}, 'C');
    // #endregion
    serveStatic(app);
  } else {
    // #region agent log
    debugLog('server/index.ts:95', 'Starting Vite setup', {}, 'C');
    // #endregion
    try {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
      // #region agent log
      debugLog('server/index.ts:99', 'Vite setup completed', {}, 'C');
      // #endregion
    } catch (error) {
      // #region agent log
      debugLog('server/index.ts:102', 'Vite setup failed', { error: String(error) }, 'C');
      // #endregion
      throw error;
    }
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  // #region agent log
  debugLog('server/index.ts:110', 'Starting server listen', { port, host: '0.0.0.0' }, 'D');
  // #endregion

  httpServer.listen(port, "0.0.0.0", () => {
    // #region agent log
    debugLog('server/index.ts:113', 'Server listening successfully', { port }, 'D');
    // #endregion
    log(`serving on port ${port}`);
    console.log(`Server is ready and listening on http://localhost:${port}`);
  });

  // #region agent log
  debugLog('server/index.ts:118', 'Server initialization async function completed', {}, 'A');
  // #endregion
})().catch((error) => {
  // #region agent log
  debugLog('server/index.ts:121', 'Server initialization failed with error', { error: String(error), stack: error?.stack }, 'E');
  // #endregion
  console.error('Failed to start server:', error);
  process.exit(1);
});
