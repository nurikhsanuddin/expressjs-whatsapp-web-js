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
const upload = multer({ storage: multer.memoryStorage() });

// Fungsi utilitas untuk mencari browser di sistem
const findChromeBrowser = () => {
  return new Promise((resolve) => {
    // Jika kita di Windows
    if (process.platform === "win32") {
      const commonPaths = [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      ];

      for (const browserPath of commonPaths) {
        if (fs.existsSync(browserPath)) {
          return resolve(browserPath);
        }
      }
    } else {
      // Di Linux/Mac, gunakan which command
      exec(
        "which google-chrome chromium chromium-browser google-chrome-stable",
        (error, stdout) => {
          if (!error && stdout) {
            // Ambil path pertama yang ditemukan
            const browserPath = stdout.split("\n")[0].trim();
            if (browserPath) {
              return resolve(browserPath);
            }
          }
          // Jika which tidak berhasil, kembalikan null
          resolve(null);
        }
      );
    }

    // Default resolver jika tidak ada yang cocok
    setTimeout(() => resolve(null), 1000);
  });
};

// Puppeteer configuration based on environment
const getPuppeteerConfig = async () => {
  // Default arguments that work in most environments
  const defaultArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-accelerated-2d-canvas",
    "--no-first-run",
    "--no-zygote",
    "--single-process",
    "--disable-gpu",
  ];

  // Check if we're in a production environment (like Linux server)
  const isProduction = process.env.NODE_ENV === "production";

  // Log environment variables for debugging
  if (isProduction) {
    console.log("Chrome path from .env:", process.env.CHROME_PATH || "Not set");
  }

  // Browser paths to try in Linux environments
  const possibleBrowserPaths = [
    // Custom browser path from env if specified
    process.env.CHROME_PATH,
    // Common Chromium/Chrome paths on Linux
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    // For Ubuntu/Debian
    "/snap/bin/chromium",
    // Path used in some Docker containers
    "/usr/bin/chrome",
  ].filter(Boolean); // Remove undefined entries

  // Check if any of the browser paths exist
  let chromePath = null;
  for (const browserPath of possibleBrowserPaths) {
    if (browserPath && fs.existsSync(browserPath)) {
      chromePath = browserPath;
      console.log(`Found Chrome/Chromium at: ${chromePath}`);
      break;
    }
  }

  // Jika tidak ditemukan, gunakan fungsi utilitas untuk mencari browser
  if (!chromePath && isProduction) {
    console.log(
      "Browser not found in common paths, trying to find it automatically..."
    );
    try {
      chromePath = await findChromeBrowser();
      if (chromePath) {
        console.log(`Browser found automatically at: ${chromePath}`);
      }
    } catch (err) {
      console.error("Error while trying to auto-detect browser:", err.message);
    }
  }

  if (isProduction) {
    console.log("Running in production mode");
    if (chromePath) {
      console.log(`Using browser at: ${chromePath}`);
      return {
        headless: true,
        executablePath: chromePath,
        args: defaultArgs,
      };
    } else {
      console.log(
        "No Chrome installation found. Using puppeteer's bundled Chromium"
      );
      return {
        headless: true,
        args: defaultArgs,
      };
    }
  } else {
    // In development, try to use the local Chrome executable
    console.log("Running in development mode - using local Chrome");
    return {
      headless: true,
      executablePath: puppeteer.executablePath(),
      args: defaultArgs,
    };
  }
};

// Inisialisasi aplikasi dan WhatsApp client secara async
(async () => {
  try {
    // Gunakan fungsi async untuk mendapatkan konfigurasi browser
    const puppeteerConfig = await getPuppeteerConfig();

    // Inisialisasi WhatsApp client dengan konfigurasi yang didapat
    const client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: puppeteerConfig,
    });

    client.on("qr", (qr) => qrcode.generate(qr, { small: true }));
    client.on("ready", () => console.log("✅ WhatsApp ready!"));
    client.on("auth_failure", (msg) =>
      console.error(`⚠️ WhatsApp authentication failed: ${msg}`)
    );
    client.on("disconnected", (reason) =>
      console.log(`🔌 WhatsApp disconnected: ${reason}`)
    );

    // Handle initialization with better error reporting
    try {
      await client.initialize();
    } catch (err) {
      console.error("Failed to initialize WhatsApp client:");
      console.error(err);

      // Check for common errors
      if (
        err.message &&
        err.message.includes("Failed to launch the browser process")
      ) {
        console.error("\n⚠️ Browser launch error. This is usually caused by:");
        console.error(
          "1. Chrome not being installed on the server\n2. Missing libraries on Linux (try installing: libnss3, libatk1.0-0, libatk-bridge2.0-0, libcups2, libdrm2, libxkbcommon0, libxcomposite1, libxdamage1, libxfixes3, libxrandr2, libgbm1, libasound2)\n3. Running in an unsupported environment\n"
        );

        console.error("🔍 Debugging info:");
        console.error("- NODE_ENV:", process.env.NODE_ENV);
        console.error("- CHROME_PATH:", process.env.CHROME_PATH || "Not set");
        console.error("- Current directory:", process.cwd());

        // Cek keberadaan browser yang dikonfigurasi
        if (process.env.CHROME_PATH) {
          try {
            console.error(
              "- CHROME_PATH exists:",
              fs.existsSync(process.env.CHROME_PATH) ? "Yes" : "No"
            );
            if (!fs.existsSync(process.env.CHROME_PATH)) {
              console.error(
                "  ⛔ Browser not found at configured path. Check your CHROME_PATH setting."
              );
            }
          } catch (e) {
            console.error("- Error checking CHROME_PATH:", e.message);
          }
        }
      }
    }

    // Middleware auth API key
    app.use((req, res, next) => {
      if (req.header("bypass-apikey") !== process.env.API_KEY) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      next();
    });

    // Status endpoint to check connection status
    app.get("/status", (req, res) => {
      const isConnected = client.info ? true : false;
      res.json({
        status: isConnected ? "connected" : "disconnected",
        info: isConnected
          ? {
              phone: client.info.wid.user,
              name: client.info.pushname,
            }
          : null,
      });
    });

    // Dual-mode route
    app.post(
      "/send-message",
      // kalau JSON: parse body, kalau multipart: parse file
      (req, res, next) => {
        const isJson = req.is("application/json");
        if (isJson) {
          express.json()(req, res, next);
        } else {
          upload.single("file")(req, res, next);
        }
      },
      async (req, res) => {
        try {
          // Ambil meta (dari JSON atau dari field form-data)
          const meta = req.body.meta
            ? typeof req.body.meta === "string"
              ? JSON.parse(req.body.meta)
              : req.body.meta
            : req.body;

          const from = meta.from.replace(/\D/g, "") + "@c.us";
          const to = meta.to.replace(/\D/g, "") + "@c.us";

          // Pastikan sesi WhatsApp cocok
          if (
            !client.info ||
            client.info.wid.user !== meta.from.replace(/\D/g, "")
          ) {
            return res
              .status(400)
              .json({ error: "Nomor “from” tidak sama dengan sesi WhatsApp." });
          }

          let sent;
          if (meta.type === "text") {
            sent = await client.sendMessage(to, meta.content);
          } else if (meta.type === "file") {
            if (!req.file) {
              return res
                .status(400)
                .json({ error: "File tidak ditemukan di multipart." });
            }
            const media = new MessageMedia(
              req.file.mimetype,
              req.file.buffer.toString("base64"),
              req.file.originalname
            );
            sent = await client.sendMessage(to, media);
          } else {
            return res
              .status(400)
              .json({ error: "Type harus “text” atau “file”." });
          }

          res.json({
            status: "success",
            message_id: sent.id._serialized,
            from: from,
          });
        } catch (e) {
          console.error(e);
          res.status(500).json({ status: "error", message: e.message });
        }
      }
    );

    // Start server
    const PORT = process.env.PORT || 3626;
    app.listen(PORT, () =>
      console.log(`🚀 Running on http://localhost:${PORT}`)
    );
  } catch (error) {
    console.error("Fatal error initializing application:", error);
    process.exit(1);
  }
})();
