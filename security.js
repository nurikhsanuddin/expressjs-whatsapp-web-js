/**
 * Security middleware untuk WhatsApp Web JS API
 *
 * Menyediakan rate limiting, IP whitelist, dan logging keamanan
 */

const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");

// Rate limiting configuration
const createRateLimiter = () => {
  const isEnabled = process.env.RATE_LIMIT_ENABLED === "true";
  const maxRequests = parseInt(process.env.MAX_REQUESTS_PER_MINUTE) || 60;

  if (!isEnabled) {
    return (req, res, next) => next(); // No-op middleware
  }

  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: maxRequests,
    message: {
      error: "Too many requests",
      message: `Maximum ${maxRequests} requests per minute exceeded`,
      retryAfter: "60 seconds",
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip successful responses from rate limit counting
    skip: (req, res) => res.statusCode < 400,
    handler: (req, res) => {
      logSecurityEvent("RATE_LIMIT_EXCEEDED", req);
      res.status(429).json({
        error: "Too many requests",
        message: `Maximum ${maxRequests} requests per minute exceeded`,
        retryAfter: "60 seconds",
      });
    },
  });
};

// IP Whitelist middleware
const createIPWhitelist = () => {
  // Check if IP whitelist is disabled in debug mode
  if (
    process.env.DEBUG_MODE === "true" &&
    process.env.DISABLE_IP_WHITELIST_IN_DEBUG === "true"
  ) {
    console.log("[SECURITY] IP Whitelist disabled - DEBUG MODE active");
    return (req, res, next) => {
      logSecurityEvent("IP_WHITELIST_BYPASSED_DEBUG", req);
      next();
    };
  }

  const allowedIPs = process.env.ALLOWED_IPS
    ? process.env.ALLOWED_IPS.split(",").map((ip) => ip.trim())
    : ["127.0.0.1", "localhost", "::1"];

  return (req, res, next) => {
    const clientIP =
      req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const normalizedClientIP = clientIP.replace(/^::ffff:/, ""); // Remove IPv6 prefix for IPv4

    // Check for wildcard (allow all)
    if (allowedIPs.includes("*")) {
      logSecurityEvent("IP_ALLOWED_WILDCARD", req, {
        clientIP: normalizedClientIP,
      });
      return next();
    }

    // Check if IP is in whitelist
    const isAllowed = allowedIPs.some((allowedIP) => {
      if (
        allowedIP === "localhost" &&
        (normalizedClientIP === "127.0.0.1" || normalizedClientIP === "::1")
      ) {
        return true;
      }
      return normalizedClientIP === allowedIP || allowedIP === "*";
    });

    if (!isAllowed) {
      logSecurityEvent("IP_BLOCKED", req, {
        clientIP: normalizedClientIP,
        allowedIPs,
      });
      return res.status(403).json({
        error: "Access forbidden",
        message: "Your IP address is not whitelisted",
      });
    }

    logSecurityEvent("IP_ALLOWED", req, { clientIP: normalizedClientIP });
    next();
  };
};

// Enhanced API Key validation
const validateAPIKey = (req, res, next) => {
  const apiKey = req.header("bypass-apikey");
  const expectedKey = process.env.API_KEY;

  if (!apiKey) {
    logSecurityEvent("MISSING_API_KEY", req);
    return res.status(401).json({
      error: "Unauthorized",
      message: "API key required",
    });
  }

  if (apiKey !== expectedKey) {
    logSecurityEvent("INVALID_API_KEY", req, {
      providedKey: apiKey.substring(0, 8) + "...",
    });
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid API key",
    });
  }

  // Log successful authentication for monitoring
  if (process.env.ENABLE_API_LOGGING === "true") {
    logSecurityEvent("API_ACCESS_SUCCESS", req);
  }

  next();
};

// Security event logging
const logSecurityEvent = (eventType, req, additionalData = {}) => {
  if (process.env.ENABLE_API_LOGGING !== "true") return;

  const logEntry = {
    timestamp: new Date().toISOString(),
    eventType,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get("User-Agent"),
    method: req.method,
    url: req.originalUrl,
    ...additionalData,
  };

  // Ensure logs directory exists
  const logsDir = path.join(process.cwd(), "logs");
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Write to security log file
  const logFile = path.join(logsDir, "security.log");
  const logLine = JSON.stringify(logEntry) + "\n";

  fs.appendFile(logFile, logLine, (err) => {
    if (err) {
      console.error("Failed to write security log:", err.message);
    }
  });

  // Also log to console for immediate visibility
  console.log(
    `[SECURITY] ${eventType}: ${logEntry.ip} ${logEntry.method} ${logEntry.url}`
  );
};

// Request logging middleware
const requestLogger = (req, res, next) => {
  if (process.env.ENABLE_API_LOGGING !== "true") {
    return next();
  }

  const startTime = Date.now();

  // Log request
  logSecurityEvent("API_REQUEST", req, {
    contentLength: req.get("Content-Length"),
    contentType: req.get("Content-Type"),
  });

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function (data) {
    const duration = Date.now() - startTime;

    logSecurityEvent("API_RESPONSE", req, {
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      success: res.statusCode < 400,
    });

    return originalJson.call(this, data);
  };

  next();
};

module.exports = {
  createRateLimiter,
  createIPWhitelist,
  validateAPIKey,
  requestLogger,
  logSecurityEvent,
};
