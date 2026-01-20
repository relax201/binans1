import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export function errorHandler(
  err: AppError | Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log error for debugging
  console.error("Error:", {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Validation error",
      details: err.errors.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      })),
    });
  }

  // Handle custom AppError
  if ("statusCode" in err && err.statusCode) {
    return res.status(err.statusCode).json({
      error: err.message || "An error occurred",
      ...(err.details && { details: err.details }),
    });
  }

  // Handle Binance API errors
  if ("code" in err && err.code) {
    const binanceErrorCodes: Record<string, number> = {
      "-1022": 400, // Invalid signature
      "-2010": 400, // NEW_ORDER_REJECTED
      "-2011": 400, // CANCEL_REJECTED
      "-2013": 404, // NO_SUCH_ORDER
      "-2015": 400, // INVALID_API_KEY
      "-2019": 400, // MARGIN_NOT_SUFFICIENT
    };

    const statusCode = binanceErrorCodes[err.code] || 400;
    return res.status(statusCode).json({
      error: err.message || "Binance API error",
      code: err.code,
    });
  }

  // Default error response
  const statusCode = "statusCode" in err ? err.statusCode || 500 : 500;
  res.status(statusCode).json({
    error: process.env.NODE_ENV === "production" 
      ? "Internal server error" 
      : err.message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
