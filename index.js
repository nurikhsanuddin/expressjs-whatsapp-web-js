require("dotenv").config();
const express = require("express");
const multer = require("multer");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    fieldSize: 50 * 1024 * 1024, // 50MB field size limit
  },
});

// Tambah timeout untuk request yang lama (file upload)
app.use((req, res, next) => {
  req.setTimeout(300000); // 5 menit timeout
  res.setTimeout(300000); // 5 menit timeout
  next();
});

// Variable untuk menyimpan instance client dan QR code
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

// Puppeteer configuration based on environment
const getPuppeteerConfig = async () => {
  const jsMemoryLimit = process.env.JS_MEMORY_LIMIT || "128";
  const diskCacheSize = process.env.DISK_CACHE_SIZE || "1";

  const defaultArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-accelerated-2d-canvas",
    "--no-first-run",
    "--js-flags=--max-old-space-size=" + jsMemoryLimit,
    "--disable-extensions",
    "--disable-component-extensions-with-background-pages",
    "--disable-default-apps",
    "--mute-audio",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-background-timer-throttling",
    "--disable-ipc-flooding-protection",
    "--disk-cache-size=" + diskCacheSize,
    "--media-cache-size=" + diskCacheSize,
  ];

  if (process.platform === "win32") {
    defaultArgs.push("--disable-features=VizDisplayCompositor");
  } else {
    defaultArgs.push("--no-zygote");
  }

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

  // Headless mode configuration without logging

  return config;
};

// Fungsi untuk graceful shutdown
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

// Inisialisasi aplikasi dan WhatsApp client secara async
(async () => {
  try {
    const puppeteerConfig = await getPuppeteerConfig();

    client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: puppeteerConfig,
    });

    client.on("qr", (qr) => {
      currentQRCode = qr;
      console.log("\n" + "=".repeat(60));
      console.log("Scan QR code dengan WhatsApp di HP Anda");
      console.log("=".repeat(60));
      qrcode.generate(qr, { small: true });
      console.log("=".repeat(60));
    });

    client.on("ready", () => {
      currentQRCode = null;
      if (client.pupPage && client.pupPage.browser) {
        browserInstance = client.pupPage.browser();
      }
      console.log("WhatsApp ready! Connection established.");
    });

    client.on("auth_failure", (msg) =>
      console.error(`Authentication failed: ${msg}`)
    );
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

    try {
      console.log("Initializing WhatsApp client...");
      await client.initialize();
      console.log("WhatsApp client initialization completed");
    } catch (err) {
      console.error("Failed to initialize WhatsApp client:");
      console.error(err);
    }

    // Middleware auth API key
    app.use((req, res, next) => {
      if (req.header("bypass-apikey") !== process.env.API_KEY) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      next();
    });

    // QR Code endpoint untuk headless mode
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
              .instructions {
                color: #666;
                margin-top: 20px;
                line-height: 1.5;
              }
              .refresh-btn {
                background: #25D366;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                margin-top: 15px;
              }
              .refresh-btn:hover {
                background: #128C7E;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h2>WhatsApp QR Code</h2>
              <img src="${url}" alt="WhatsApp QR Code" class="qr-code">
              <div class="instructions">
                <p><strong>Cara menggunakan:</strong></p>
                <p>1. Buka WhatsApp di HP Anda</p>
                <p>2. Tap menu ⋮ (titik tiga) → Perangkat Tertaut</p>
                <p>3. Tap "Tautkan Perangkat"</p>
                <p>4. Scan QR code di atas</p>
              </div>
              <button class="refresh-btn" onclick="location.reload()">Refresh</button>
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
      const clientState = client
        ? client.info
          ? "ready"
          : "initializing"
        : "not_initialized";

      res.json({
        status: isConnected ? "connected" : "disconnected",
        client_state: clientState,
        qr_available: currentQRCode ? true : false,
        info: isConnected
          ? {
              phone: client.info.wid.user,
              name: client.info.pushname,
            }
          : null,
        headless_mode: process.env.HEADLESS_MODE === "true",
      });
    });

    // Main send-message endpoint
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
          console.log("Processing send-message request");

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
            console.log("WhatsApp client status:", {
              client_exists: !!client,
              client_info: !!client?.info,
              qr_code_available: !!currentQRCode,
            });
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

            // Send file as document
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

            // Enhanced timeout wrapper
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
              // UNIVERSAL DOCUMENT APPROACH - Mengirim semua file sebagai dokumen
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
              // Retry dengan approach minimal
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
          console.error("Error in send-message:", e);

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
