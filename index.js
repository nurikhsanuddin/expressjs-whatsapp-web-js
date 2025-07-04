require("dotenv").config();
const express = require("express");
const multer = require("multer");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal"); // Gunakan fu  // Disable images and sounds if configured
if (process.env.DISABLE_IMAGES === "true") {
  defaultArgs.push("--blink-settings=imagesEnabled=false");
  console.log("Images disabled for better performance");
}

if (process.env.DISABLE_SOUNDS === "true") {
  defaultArgs.push("--mute-audio");
  console.log("Audio disabled for better performance");
}

// Set lower process priority to reduce CPU impact
defaultArgs.push("--disable-hang-monitor");
defaultArgs.push("--disable-crash-reporter");

// Reduce memory usage by limiting tab processes
defaultArgs.push("--renderer-process-limit=1");
defaultArgs.push("--disable-translate");
defaultArgs.push("--disable-sync");

// Check if we're in a production environment (like Linux server)
const isProduction = process.env.NODE_ENV === "production";
const puppeteerConfig = await getPuppeteerConfig();

// Inisialisasi WhatsApp client dengan konfigurasi yang didapat
client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    ...puppeteerConfig,
    // Menangkap browser instance untuk dikelola nanti
    browserWSEndpoint: null, // Paksa pembuatan instance baru
    browser: async (browser) => {
      browserInstance = browser;
      const pid = getBrowserPid(browser);
      console.log(
        `🌐 Browser instance created for WhatsApp Web JS with PID: ${pid}`
      );
      return browser;
    },
  },
});

client.on("qr", (qr) => qrcode.generate(qr, { small: true }));
client.on("ready", () => console.log("✅ WhatsApp ready!"));
client.on("auth_failure", (msg) =>
  console.error(`⚠️ WhatsApp authentication failed: ${msg}`)
);
client.on("disconnected", (reason) => {
  console.log(`🔌 WhatsApp disconnected: ${reason}`);
  // Jika terjadi disconnect, tetap pastikan browser ditutup
  if (browserInstance) {
    try {
      browserInstance
        .close()
        .catch((err) =>
          console.error("Error closing browser after disconnect:", err.message)
        );
    } catch (err) {
      console.error("Error closing browser after disconnect:", err.message);
    }
  }
});
er = require("puppeteer");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Variable untuk menyimpan instance client
let client = null;
let browserInstance = null;

// Tambahkan fungsi bantuan untuk mendapatkan PID browser
const getBrowserPid = (browser) => {
  if (browser && browser.process && typeof browser.process === "function") {
    const process = browser.process();
    if (process && process.pid) {
      return process.pid;
    }
  }
  return "unknown";
};

// Fungsi untuk graceful shutdown
const gracefulShutdown = async () => {
  console.log("🛑 Shutting down gracefully...");

  // Menutup browser dan client dengan timeout untuk memastikan tidak menggantung
  const shutdownPromise = Promise.race([
    (async () => {
      if (client) {
        try {
          console.log("👋 Disconnecting WhatsApp client...");
          await client.destroy();
          console.log("✅ WhatsApp client disconnected");
        } catch (err) {
          console.error("❌ Error disconnecting WhatsApp client:", err.message);
        }
      }

      if (browserInstance) {
        try {
          const pid = getBrowserPid(browserInstance);
          console.log(`🌐 Closing browser instance with PID: ${pid}...`);
          await browserInstance.close();
          console.log(
            `✅ Browser instance with PID: ${pid} closed successfully`
          );
        } catch (err) {
          console.error("❌ Error closing browser instance:", err.message);
          // Force close if normal close fails
          try {
            const browser = browserInstance;
            const pid = getBrowserPid(browser);
            browserInstance = null;
            if (browser && browser.process()) {
              browser.process().kill("SIGKILL");
              console.log(
                `🔥 Browser process with PID: ${pid} killed forcefully`
              );
            }
          } catch (forceErr) {
            console.error(
              "❌ Failed to forcefully kill browser:",
              forceErr.message
            );
          }
        }
      }
    })(),
    new Promise((resolve) =>
      setTimeout(() => {
        console.log("⚠️ Shutdown timed out, forcing exit...");
        resolve();
      }, 5000)
    ), // 5 second timeout
  ]);

  await shutdownPromise;
  console.log("👍 Shutdown complete");
  process.exit(0);
};

// Handle process termination signals
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Tambahkan event listener untuk menutup server dengan benar
process.on("SIGTERM", () => {
  console.log("Received SIGTERM, shutting down server gracefully");
  server.close(() => {
    console.log("Server closed");
    gracefulShutdown();
  });
});

process.on("SIGINT", () => {
  console.log("Received SIGINT, shutting down server gracefully");
  server.close(() => {
    console.log("Server closed");
    gracefulShutdown();
  });
});

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
  // Mengambil batasan memori dari konfigurasi
  const jsMemoryLimit = process.env.JS_MEMORY_LIMIT || "128";
  const diskCacheSize = process.env.DISK_CACHE_SIZE || "1";

  // Default arguments optimized for lower memory usage
  const defaultArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-accelerated-2d-canvas",
    "--no-first-run",
    "--no-zygote",
    "--single-process",
    "--js-flags=--max-old-space-size=" + jsMemoryLimit, // Limit JavaScript memory dari env
    "--disable-extensions", // Disable extensions
    "--disable-component-extensions-with-background-pages",
    "--disable-default-apps",
    "--mute-audio", // Mute audio
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-background-timer-throttling",
    "--disable-ipc-flooding-protection",
    "--disk-cache-size=" + diskCacheSize, // Batasi ukuran cache disk
    "--media-cache-size=" + diskCacheSize, // Batasi ukuran cache media
  ];

  // Add memory cache if enabled in environment
  if (process.env.USE_MEMORY_CACHE === "true") {
    defaultArgs.push("--disk-cache-size=1");
    defaultArgs.push("--media-cache-size=1");
    defaultArgs.push("--disk-cache-dir=/dev/null");
    console.log("Memory cache optimization enabled");
  }

  // Disable spellcheck if enabled in environment
  if (process.env.DISABLE_SPELLCHECK === "true") {
    defaultArgs.push("--disable-spell-checking");
    console.log("Spell checking disabled for performance");
  }

  // Disable GPU if configured
  if (process.env.DISABLE_GPU === "true") {
    defaultArgs.push("--disable-gpu");
    console.log("GPU disabled for better compatibility");
  }

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

  // Windows specific paths to try
  if (process.platform === "win32") {
    possibleBrowserPaths.push(
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
    );
  }

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

  const config = {
    headless: "new", // Use new headless mode for better performance
    args: defaultArgs,
    ignoreDefaultArgs: ["--enable-automation"], // Disable automation flag
    ignoreHTTPSErrors: true,
    protocolTimeout: 30000, // 30 seconds timeout
    defaultViewport: {
      width: 800,
      height: 600,
      deviceScaleFactor: 1,
    },
  };

  if (isProduction) {
    console.log("Running in production mode");
    if (chromePath) {
      console.log(`Using browser at: ${chromePath}`);
      config.executablePath = chromePath;
    } else {
      console.log(
        "No Chrome installation found. Using puppeteer's bundled Chromium"
      );
    }
  } else {
    // In development, try to use the local Chrome executable
    console.log("Running in development mode - using local Chrome");
    config.executablePath = puppeteer.executablePath();
  }

  return config;
};

// Fungsi untuk membersihkan file cache yang tidak diperlukan
const cleanupSessionFiles = async () => {
  try {
    // Path relatif ke folder .wwebjs_auth yang berisi session files
    const sessionDir = path.join(process.cwd(), ".wwebjs_auth");

    if (fs.existsSync(sessionDir)) {
      console.log(
        "🧹 Membersihkan file cache sesi WhatsApp yang tidak diperlukan..."
      );

      // Dapatkan tanggal saat ini
      const now = Date.now();
      // Berapa hari file dianggap kadaluarsa (default: 7 hari)
      const maxAgeInDays = 7;
      const maxAgeInMs = maxAgeInDays * 24 * 60 * 60 * 1000;

      // Bersihkan file temporary dan file log yang tidak digunakan
      const cleanupPaths = [
        path.join(sessionDir, "session", "Default", "Cache"),
        path.join(sessionDir, "session", "Default", "Code Cache"),
        path.join(sessionDir, "session", "Default", "GPUCache"),
        path.join(sessionDir, "session", "Default", "Service Worker"),
      ];

      // Fungsi untuk menghapus file lama secara rekursif
      const removeOldFiles = (dirPath) => {
        if (!fs.existsSync(dirPath)) return;

        const items = fs.readdirSync(dirPath);

        for (const item of items) {
          const itemPath = path.join(dirPath, item);
          const stats = fs.statSync(itemPath);

          if (stats.isDirectory()) {
            removeOldFiles(itemPath);
            // Cek apakah direktori kosong, jika ya hapus
            const subItems = fs.readdirSync(itemPath);
            if (subItems.length === 0) {
              fs.rmdirSync(itemPath);
            }
          } else if (stats.isFile()) {
            // Cek umur file
            const fileAge = now - stats.mtime.getTime();
            if (fileAge > maxAgeInMs) {
              fs.unlinkSync(itemPath);
              console.log(
                `  - Menghapus file lama: ${path.relative(
                  sessionDir,
                  itemPath
                )}`
              );
            }
          }
        }
      };

      // Bersihkan semua path yang ditentukan
      for (const cleanupPath of cleanupPaths) {
        if (fs.existsSync(cleanupPath)) {
          removeOldFiles(cleanupPath);
          console.log(
            `  ✓ Membersihkan: ${path.relative(sessionDir, cleanupPath)}`
          );
        }
      }

      console.log("✅ Pembersihan file cache selesai");
    }
  } catch (err) {
    console.error("❌ Error saat membersihkan file cache:", err.message);
  }
};

// Implementasi monitoring sumber daya sederhana
const monitorResources = () => {
  try {
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = {
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024),
    };

    console.log("📊 Penggunaan Memori (MB):", {
      total_rss: memoryUsageMB.rss,
      heap_total: memoryUsageMB.heapTotal,
      heap_used: memoryUsageMB.heapUsed,
      external: memoryUsageMB.external,
    });

    // Peringatan jika penggunaan memori tinggi
    const memoryThreshold = 200; // MB
    if (memoryUsageMB.rss > memoryThreshold) {
      console.warn(
        `⚠️ Penggunaan memori tinggi: ${memoryUsageMB.rss}MB > ${memoryThreshold}MB`
      );
    }
  } catch (err) {
    console.error("❌ Error saat monitoring sumber daya:", err.message);
  }
};

// Inisialisasi aplikasi dan WhatsApp client secara async
(async () => {
  try {
    // Gunakan fungsi async untuk mendapatkan konfigurasi browser
    const puppeteerConfig = await getPuppeteerConfig();

    // Inisialisasi WhatsApp client dengan konfigurasi yang didapat
    client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        ...puppeteerConfig,
        // Menangkap browser instance untuk dikelola nanti
        browserWSEndpoint: null, // Paksa pembuatan instance baru
        browser: async (browser) => {
          browserInstance = browser;
          const pid = getBrowserPid(browser);
          console.log(
            `🌐 Browser instance created for WhatsApp Web JS with PID: ${pid}`
          );
          return browser;
        },
      },
    });

    client.on("qr", (qr) => qrcode.generate(qr, { small: true }));
    client.on("ready", () => console.log("✅ WhatsApp ready!"));
    client.on("auth_failure", (msg) =>
      console.error(`⚠️ WhatsApp authentication failed: ${msg}`)
    );
    client.on("disconnected", (reason) => {
      console.log(`🔌 WhatsApp disconnected: ${reason}`);
      // Jika terjadi disconnect, tetap pastikan browser ditutup
      if (browserInstance) {
        try {
          browserInstance
            .close()
            .catch((err) =>
              console.error(
                "Error closing browser after disconnect:",
                err.message
              )
            );
        } catch (err) {
          console.error("Error closing browser after disconnect:", err.message);
        }
      }
    });

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
            console.log(
              `📤 Mengirim file: ${req.file.originalname} (${formatBytes(
                req.file.size
              )})`
            );
            sent = await client.sendMessage(to, media);
            console.log(
              `✅ File berhasil dikirim dengan ID: ${sent.id._serialized}`
            );

            // Fungsi formatBytes (tambahkan jika belum ada)
            function formatBytes(bytes, decimals = 2) {
              if (bytes === 0) return "0 Bytes";
              const k = 1024;
              const dm = decimals < 0 ? 0 : decimals;
              const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
              const i = Math.floor(Math.log(bytes) / Math.log(k));
              return (
                parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) +
                " " +
                sizes[i]
              );
            }
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
    const server = app.listen(PORT, () => {
      console.log(`🚀 Running on http://localhost:${PORT}`);

      // Beri tahu PM2 bahwa aplikasi sudah siap (jika berjalan di PM2)
      if (process.send) {
        process.send("ready");
        console.log("📣 Sent ready signal to PM2");
      }

      // Jalankan pembersihan file cache jika diaktifkan
      if (process.env.AUTO_CLEAN_SESSION === "true") {
        console.log("🧹 Auto-cleanup session enabled");

        // Bersihkan segera saat startup
        cleanupSessionFiles();

        // Set interval untuk pembersihan berkala
        const cleanupInterval =
          parseInt(process.env.SESSION_CLEANUP_INTERVAL) || 86400000; // Default 24 jam
        setInterval(cleanupSessionFiles, cleanupInterval);
        console.log(
          `🔄 Session cleanup scheduled every ${
            cleanupInterval / (60 * 60 * 1000)
          } hours`
        );
      }

      // Aktifkan monitoring sumber daya
      const resourceMonitoringInterval = 15 * 60 * 1000; // 15 menit
      setInterval(monitorResources, resourceMonitoringInterval);
      console.log(
        `🔄 Resource monitoring enabled (every ${
          resourceMonitoringInterval / (60 * 1000)
        } minutes)`
      );
    });
  } catch (error) {
    console.error("Fatal error initializing application:", error);
    process.exit(1);
  }
})();

// Ekspos fungsi-fungsi untuk penggunaan dari command line
if (require.main !== module) {
  module.exports = {
    cleanupSessionFiles,
    monitorResources,
  };
}
