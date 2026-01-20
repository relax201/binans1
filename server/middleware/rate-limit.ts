import { Request, Response, NextFunction } from "express";

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum number of requests
  message?: string;
  skipSuccessfulRequests?: boolean;
}

export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs = 60000, // Default 1 minute
    max = 100, // Default 100 requests
    message = "Too many requests, please try again later",
    skipSuccessfulRequests = false,
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();

    // Clean up expired entries
    Object.keys(store).forEach((k) => {
      if (store[k].resetTime < now) {
        delete store[k];
      }
    });

    // Get or create entry for this IP
    if (!store[key]) {
      store[key] = {
        count: 0,
        resetTime: now + windowMs,
      };
    }

    const entry = store[key];

    // Reset if window expired
    if (entry.resetTime < now) {
      entry.count = 0;
      entry.resetTime = now + windowMs;
    }

    // Check if limit exceeded
    if (entry.count >= max) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      res.status(429).json({
        error: message,
        retryAfter,
      });
      return;
    }

    // Increment counter
    entry.count++;

    // Set rate limit headers
    res.setHeader("X-RateLimit-Limit", max.toString());
    res.setHeader("X-RateLimit-Remaining", Math.max(0, max - entry.count).toString());
    res.setHeader("X-RateLimit-Reset", new Date(entry.resetTime).toISOString());

    // Track response status if needed
    if (skipSuccessfulRequests) {
      const originalSend = res.send;
      res.send = function (body) {
        if (res.statusCode < 400) {
          entry.count = Math.max(0, entry.count - 1);
        }
        return originalSend.call(this, body);
      };
    }

    next();
  };
}

// Pre-configured rate limiters
export const apiRateLimit = rateLimit({
  windowMs: 60000, // 1 minute
  max: 100, // 100 requests per minute
  message: "Too many API requests, please try again later",
});

export const authRateLimit = rateLimit({
  windowMs: 900000, // 15 minutes
  max: 5, // 5 login attempts per 15 minutes
  message: "Too many authentication attempts, please try again later",
});

export const tradeRateLimit = rateLimit({
  windowMs: 60000, // 1 minute
  max: 10, // 10 trades per minute
  message: "Too many trade requests, please slow down",
});
