require("dotenv").config();
const express = require("express");
const multer = require("multer");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const path = require("path");
const fs = require("fs");

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    fieldSize: 50 * 1024 * 1024, // 50MB field size limit
  },
});

// Timeout untuk request yang lama
app.use((req, res, next) => {
  req.setTimeout(300000); // 5 menit timeout
  res.setTimeout(300000); // 5 menit timeout
  next();
});

// Variables
let client = null;
let browserInstance = null;
let currentQRCode = null;

// Helper function untuk format bytes
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

// Session cleanup function
const cleanupSessionFiles = async () => {
  try {
    const sessionDir = path.join(process.cwd(), ".wwebjs_auth");

    if (fs.existsSync(sessionDir)) {
      console.log("Cleaning up old session files...");

      const now = Date.now();
      const maxAgeInDays = 7;
      const maxAgeInMs = maxAgeInDays * 24 * 60 * 60 * 1000;

      const cleanupPaths = [
        path.join(sessionDir, "session", "Default", "Cache"),
        path.join(sessionDir, "session", "Default", "Code Cache"),
        path.join(sessionDir, "session", "Default", "GPUCache"),
        path.join(sessionDir, "session", "Default", "Service Worker"),
      ];

      for (const cleanupPath of cleanupPaths) {
        if (fs.existsSync(cleanupPath)) {
          try {
            const stats = fs.statSync(cleanupPath);
            if (now - stats.mtime.getTime() > maxAgeInMs) {
              fs.rmSync(cleanupPath, { recursive: true, force: true });
              console.log(`Cleaned: ${cleanupPath}`);
            }
          } catch (err) {
            console.warn(`Error cleaning ${cleanupPath}:`, err.message);
          }
        }
      }
    }
  } catch (err) {
    console.error("Error during session cleanup:", err.message);
  }
};

// Puppeteer configuration
const getPuppeteerConfig = async () => {
  // Get optimization settings from environment
  const jsMemoryLimit = process.env.JS_MEMORY_LIMIT || "128";
  const diskCacheSize = process.env.DISK_CACHE_SIZE || "1";

  const defaultArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-accelerated-2d-canvas",
    "--no-first-run",
    "--js-flags=--max-old-space-size=" + jsMemoryLimit, // Memory limit from env
    "--disable-extensions",
    "--disable-component-extensions-with-background-pages",
    "--disable-default-apps",
    "--mute-audio",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-background-timer-throttling",
    "--disable-ipc-flooding-protection",
    "--disk-cache-size=" + diskCacheSize, // Disk cache limit from env
    "--media-cache-size=" + diskCacheSize, // Media cache limit from env
  ];

  if (process.platform === "win32") {
    defaultArgs.push("--disable-features=VizDisplayCompositor");
  } else {
    defaultArgs.push("--no-zygote");
    // Use single process if enabled in environment
    if (process.env.USE_SINGLE_PROCESS === "true") {
      defaultArgs.push("--single-process");
    }
  }

  // Add memory cache optimization if enabled
  if (process.env.USE_MEMORY_CACHE === "true") {
    defaultArgs.push("--disk-cache-size=1");
    defaultArgs.push("--media-cache-size=1");
    defaultArgs.push("--disk-cache-dir=/dev/null");
  }

  // Disable spellcheck if enabled
  if (process.env.DISABLE_SPELLCHECK === "true") {
    defaultArgs.push("--disable-spell-checking");
  }

  // Disable GPU if configured
  if (process.env.DISABLE_GPU === "true") {
    defaultArgs.push("--disable-gpu");
  }

  // Disable images and sounds if configured
  if (process.env.DISABLE_IMAGES === "true") {
    defaultArgs.push("--blink-settings=imagesEnabled=false");
  }

  if (process.env.DISABLE_SOUNDS === "true") {
    defaultArgs.push("--mute-audio");
  }

  // Additional optimizations
  defaultArgs.push("--disable-hang-monitor");
  defaultArgs.push("--disable-crash-reporter");
  defaultArgs.push("--renderer-process-limit=1");
  defaultArgs.push("--disable-translate");
  defaultArgs.push("--disable-sync");

  const isHeadless = process.env.HEADLESS_MODE === "true";

  const config = {
    headless: isHeadless,
    args: defaultArgs,
    ignoreDefaultArgs: ["--enable-automation"],
    ignoreHTTPSErrors: true,
    protocolTimeout: 30000,
    defaultViewport: {
      width: 800,
      height: 600,
      deviceScaleFactor: 1,
    },
  };

  // Try to find available browser executable
  const possibleBrowserPaths = [
    process.env.CHROME_PATH,
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/snap/bin/chromium",
    "/usr/bin/chrome",
  ].filter(Boolean);

  // Windows specific paths
  if (process.platform === "win32") {
    possibleBrowserPaths.push(
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
    );
  }

  // Check if any browser path exists
  for (const browserPath of possibleBrowserPaths) {
    if (browserPath && fs.existsSync(browserPath)) {
      config.executablePath = browserPath;
      console.log(`Using browser: ${browserPath}`);
      break;
    }
  }

  // If no browser found, try to use puppeteer's bundled chromium
  if (!config.executablePath) {
    try {
      const puppeteer = require("puppeteer");
      config.executablePath = puppeteer.executablePath();
      console.log("Using Puppeteer bundled Chromium");
    } catch (err) {
      console.warn(
        "Could not find browser executable. Trying without executablePath..."
      );
      // Let puppeteer handle it
    }
  }

  return config;
};

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log("Shutting down gracefully...");

  const shutdownPromise = Promise.race([
    (async () => {
      if (client) {
        try {
          await client.destroy();
        } catch (err) {
          console.warn("Error destroying client:", err.message);
        }
      }

      if (browserInstance) {
        try {
          await browserInstance.close();
        } catch (err) {
          console.warn("Error closing browser:", err.message);
        }
      }
    })(),
    new Promise((resolve) =>
      setTimeout(() => {
        console.log("Shutdown timed out, forcing exit...");
        resolve();
      }, 5000)
    ),
  ]);

  await shutdownPromise;
  console.log("Shutdown complete");
  process.exit(0);
};

// Handle process termination signals
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Initialize application
(async () => {
  try {
    const puppeteerConfig = await getPuppeteerConfig();

    client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: puppeteerConfig,
    });

    client.on("qr", (qr) => {
      currentQRCode = qr;
      console.log("QR Code generated. Scan with WhatsApp:");
      qrcode.generate(qr, { small: true });
    });

    client.on("ready", () => {
      currentQRCode = null;
      if (client.pupPage && client.pupPage.browser) {
        browserInstance = client.pupPage.browser();
      }
      console.log("WhatsApp ready!");
    });

    client.on("auth_failure", (msg) => {
      console.error(`Authentication failed: ${msg}`);
    });

    client.on("disconnected", (reason) => {
      console.log(`WhatsApp disconnected: ${reason}`);
      if (browserInstance) {
        try {
          browserInstance.close();
        } catch (err) {
          console.warn("Error closing browser:", err.message);
        }
      }
    });

    console.log("Initializing WhatsApp client...");
    await client.initialize();

    // Middleware auth API key
    app.use((req, res, next) => {
      if (req.header("bypass-apikey") !== process.env.API_KEY) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      next();
    });

    // QR Code endpoint
    app.get("/qr", (req, res) => {
      if (!currentQRCode) {
        return res.status(404).json({
          error: "QR Code tidak tersedia",
          message: "QR Code belum di-generate atau WhatsApp sudah terhubung",
        });
      }

      const QRCode = require("qrcode");
      QRCode.toDataURL(currentQRCode, (err, url) => {
        if (err) {
          return res.status(500).json({
            error: "Error generating QR code",
            message: err.message,
          });
        }

        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>WhatsApp QR Code</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { 
                font-family: Arial, sans-serif; 
                text-align: center; 
                padding: 20px; 
                background: #f5f5f5;
              }
              .container {
                max-width: 400px;
                margin: 0 auto;
                background: white;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              }
              .qr-code {
                margin: 20px 0;
                max-width: 100%;
                height: auto;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h2>WhatsApp QR Code</h2>
              <img src="${url}" alt="WhatsApp QR Code" class="qr-code">
              <p>Scan QR code dengan WhatsApp di HP Anda</p>
            </div>
            <script>
              setTimeout(() => location.reload(), 30000);
            </script>
          </body>
          </html>
        `;

        res.send(html);
      });
    });

    // Status endpoint
    app.get("/status", (req, res) => {
      const isConnected = client && client.info ? true : false;
      res.json({
        status: isConnected ? "connected" : "disconnected",
        info: isConnected
          ? {
              phone: client.info.wid.user,
              name: client.info.pushname,
            }
          : null,
        qr_available: currentQRCode ? true : false,
      });
    });

    // Send message endpoint
    app.post(
      "/send-message",
      (req, res, next) => {
        const contentType = req.get("Content-Type") || "";

        if (contentType.includes("application/json")) {
          express.json({ limit: "50mb" })(req, res, next);
        } else if (contentType.includes("multipart/form-data")) {
          upload.single("file")(req, res, (err) => {
            if (err) {
              console.error("Multer error:", err);
              if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(413).json({
                  error: "File terlalu besar",
                  message: "Maksimal ukuran file adalah 50MB",
                });
              }
              return res.status(400).json({
                error: "Error upload file",
                message: err.message,
              });
            }
            next();
          });
        } else {
          express.json({ limit: "50mb" })(req, res, next);
        }
      },
      async (req, res) => {
        try {
          const meta = req.body.meta
            ? typeof req.body.meta === "string"
              ? JSON.parse(req.body.meta)
              : req.body.meta
            : req.body;

          if (!meta.from || !meta.to || !meta.type) {
            return res.status(400).json({
              error: "Field yang diperlukan tidak lengkap",
              required: ["from", "to", "type"],
              received: Object.keys(meta),
            });
          }

          const from = meta.from.replace(/\D/g, "") + "@c.us";
          const to = meta.to.replace(/\D/g, "") + "@c.us";

          if (!client || !client.info) {
            return res.status(503).json({
              error: "WhatsApp client tidak terhubung",
              message: "Silakan scan QR code terlebih dahulu",
            });
          }

          if (client.info.wid.user !== meta.from.replace(/\D/g, "")) {
            return res.status(400).json({
              error: 'Nomor "from" tidak sama dengan sesi WhatsApp.',
              expected: client.info.wid.user,
              received: meta.from.replace(/\D/g, ""),
            });
          }

          let sent;

          // Ensure chat exists before sending
          let chat;
          try {
            // Try to get existing chat
            chat = await client.getChatById(to);
          } catch (chatError) {
            // If chat doesn't exist, try to get number info first
            try {
              const numberCheck = await client.getNumberId(to.replace('@c.us', ''));
              if (!numberCheck) {
                return res.status(400).json({
                  error: "Nomor WhatsApp tidak terdaftar",
                  to: meta.to
                });
              }
            } catch (numberError) {
              console.warn("Could not verify number:", numberError.message);
            }
          }

          if (meta.type === "text") {
            if (!meta.content) {
              return res.status(400).json({
                error: "Content text tidak boleh kosong",
              });
            }
            sent = await client.sendMessage(to, meta.content);
          } else if (meta.type === "file") {
            if (!req.file) {
              return res.status(400).json({
                error: "File tidak ditemukan di multipart request",
                message: "Pastikan field 'file' ada dalam form-data",
              });
            }

            const allowedTypes = [
              "image/jpeg",
              "image/png",
              "image/gif",
              "image/webp",
              "application/pdf",
              "text/plain",
              "application/msword",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              "video/mp4",
              "video/avi",
              "video/mov",
              "audio/mp3",
              "audio/wav",
            ];

            if (!allowedTypes.includes(req.file.mimetype)) {
              return res.status(400).json({
                error: "Tipe file tidak didukung",
                allowed: allowedTypes,
                received: req.file.mimetype,
              });
            }

            // Verify WhatsApp connection
            try {
              const state = await client.getState();
              if (state !== "CONNECTED") {
                throw new Error(`WhatsApp tidak terhubung. Status: ${state}`);
              }
            } catch (stateError) {
              throw new Error(
                `Gagal verifikasi koneksi WhatsApp: ${stateError.message}`
              );
            }

            // Send with timeout
            const sendWithTimeout = (
              client,
              to,
              media,
              timeoutMs = 30000,
              options = {}
            ) => {
              return new Promise((resolve, reject) => {
                let isResolved = false;

                const timeout = setTimeout(() => {
                  if (!isResolved) {
                    isResolved = true;
                    reject(
                      new Error(
                        `Timeout: sendMessage dibatalkan setelah ${
                          timeoutMs / 1000
                        } detik`
                      )
                    );
                  }
                }, timeoutMs);

                try {
                  const sendPromise = client.sendMessage(to, media, options);

                  sendPromise
                    .then((result) => {
                      if (!isResolved) {
                        isResolved = true;
                        clearTimeout(timeout);
                        resolve(result);
                      }
                    })
                    .catch((error) => {
                      if (!isResolved) {
                        isResolved = true;
                        clearTimeout(timeout);
                        reject(error);
                      }
                    });
                } catch (immediateError) {
                  if (!isResolved) {
                    isResolved = true;
                    clearTimeout(timeout);
                    reject(immediateError);
                  }
                }
              });
            };

            try {
              // Send all files as documents for maximum reliability
              const mediaToSend = new MessageMedia(
                req.file.mimetype,
                req.file.buffer.toString("base64"),
                req.file.originalname
              );

              const sendOptions = {
                sendMediaAsDocument: true,
              };

              sent = await sendWithTimeout(
                client,
                to,
                mediaToSend,
                30000,
                sendOptions
              );
            } catch (sendError) {
              // Retry with simplified approach
              if (
                sendError.message.includes("timeout") ||
                sendError.message.includes("Timeout")
              ) {
                try {
                  const retryMedia = new MessageMedia(
                    req.file.mimetype,
                    req.file.buffer.toString("base64"),
                    req.file.originalname
                  );

                  const simpleOptions = {
                    sendMediaAsDocument: true,
                  };

                  sent = await sendWithTimeout(
                    client,
                    to,
                    retryMedia,
                    20000,
                    simpleOptions
                  );
                } catch (retryError) {
                  // Final fallback to text notification
                  try {
                    const fallbackMessage =
                      `File Upload Failed\n\n` +
                      `Filename: ${req.file.originalname}\n` +
                      `Size: ${formatBytes(req.file.size)}\n` +
                      `Type: ${req.file.mimetype}\n` +
                      `Status: Upload failed\n` +
                      `Time: ${new Date().toLocaleString()}`;

                    sent = await Promise.race([
                      client.sendMessage(to, fallbackMessage),
                      new Promise((_, reject) =>
                        setTimeout(
                          () => reject(new Error("Text fallback timeout")),
                          10000
                        )
                      ),
                    ]);
                  } catch (fallbackError) {
                    throw new Error(
                      `Total failure: ${sendError.message}, ${retryError.message}, ${fallbackError.message}`
                    );
                  }
                }
              } else {
                throw sendError;
              }
            }
          } else {
            return res.status(400).json({
              error: 'Type harus "text" atau "file".',
              received: meta.type,
            });
          }

          if (!sent || !sent.id) {
            throw new Error("Pesan gagal dikirim - tidak ada response ID");
          }

          const response = {
            status: "success",
            message: "Message sent successfully",
            mid: sent.id._serialized.split("_")[2] || sent.id._serialized,
            from: meta.from.replace(/\D/g, ""),
            to: meta.to.replace(/\D/g, ""),
          };

          res.json(response);
        } catch (e) {
          console.error("Error in send-message:", e.message);

          let errorMessage = "Gagal mengirim pesan";
          let statusCode = 500;

          if (e.message.includes("Timeout")) {
            errorMessage = "Pengiriman pesan timeout - coba lagi";
            statusCode = 408;
          } else if (e.message.includes("not registered")) {
            errorMessage = "Nomor WhatsApp tidak terdaftar";
            statusCode = 400;
          } else if (e.message.includes("Chat not found")) {
            errorMessage = "Chat tidak ditemukan - nomor mungkin tidak valid";
            statusCode = 400;
          } else if (e.message.includes("Session not ready")) {
            errorMessage =
              "Sesi WhatsApp belum siap - scan QR code terlebih dahulu";
            statusCode = 503;
          } else if (e.message.includes("markedUnread") || e.message.includes("Cannot read properties of undefined")) {
            errorMessage = "Chat tidak ditemukan atau belum tersedia - coba kirim pesan manual terlebih dahulu";
            statusCode = 400;
          } else {
            errorMessage = `Error: ${e.message}`;
          }

          res.status(statusCode).json({
            status: "error",
            message: errorMessage,
            mid: null,
            from: null,
            to: null,
            timestamp: new Date().toISOString(),
          });
        }
      }
    );

    // Start server
    const PORT = process.env.PORT || 3626;
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);

      if (process.send) {
        process.send("ready");
      }

      // Auto-cleanup session if enabled
      if (process.env.AUTO_CLEAN_SESSION === "true") {
        console.log("Auto-cleanup session enabled");

        // Cleanup immediately on startup
        cleanupSessionFiles();

        // Set interval for periodic cleanup
        const cleanupInterval =
          parseInt(process.env.SESSION_CLEANUP_INTERVAL) || 21600000; // Default 6 hours
        setInterval(cleanupSessionFiles, cleanupInterval);
        console.log(
          `Session cleanup scheduled every ${
            cleanupInterval / (60 * 60 * 1000)
          } hours`
        );
      }
    });

    const handleServerShutdown = (signal) => {
      console.log(`Received ${signal}, shutting down server gracefully`);
      server.close(() => {
        console.log("Server closed");
        gracefulShutdown();
      });
    };

    process.on("SIGTERM", () => handleServerShutdown("SIGTERM"));
    process.on("SIGINT", () => handleServerShutdown("SIGINT"));
  } catch (error) {
    console.error("Fatal error initializing application:", error);
    process.exit(1);
  }
})();
