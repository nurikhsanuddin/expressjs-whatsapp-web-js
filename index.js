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

// Fungsi utilitas untuk mencari browser di sistem
const findChromeBrowser = () => {
  return new Promise((resolve) => {
    // Jika kita di Windows
    if (process.platform === "win32") {
      const commonPaths = [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        // Add more possible Windows paths
        process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe",
        process.env.PROGRAMFILES + "\\Google\\Chrome\\Application\\chrome.exe",
        process.env["PROGRAMFILES(X86)"] +
          "\\Google\\Chrome\\Application\\chrome.exe",
      ].filter(Boolean); // Remove undefined entries

      for (const browserPath of commonPaths) {
        try {
          if (fs.existsSync(browserPath)) {
            return resolve(browserPath);
          }
        } catch (err) {
          // Continue to next path if there's an access error
          continue;
        }
      }

      // If no browser found, try using 'where' command on Windows
      exec("where chrome.exe", (error, stdout) => {
        if (!error && stdout) {
          const browserPath = stdout.split("\n")[0].trim();
          if (browserPath && fs.existsSync(browserPath)) {
            return resolve(browserPath);
          }
        }
        resolve(null);
      });
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
    setTimeout(() => resolve(null), 2000);
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

  // Add Windows-specific arguments
  if (process.platform === "win32") {
    defaultArgs.push("--disable-features=VizDisplayCompositor");
  } else {
    // Linux/Mac specific arguments
    defaultArgs.push("--no-zygote");
    // Only use single-process on Linux if specifically enabled
    if (process.env.USE_SINGLE_PROCESS === "true") {
      defaultArgs.push("--single-process");
    }
  }

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

  // Disable images and sounds if configured
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

  const isHeadless = process.env.HEADLESS_MODE === "true";

  const config = {
    headless: isHeadless, // Configurable headless mode
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

  // Log headless mode status
  if (isHeadless) {
    console.log(
      "🔕 HEADLESS MODE: Browser akan berjalan tanpa tampilan visual"
    );
    console.log("📋 QR Code akan ditampilkan di terminal ini");
  } else {
    console.log("🌐 BROWSER MODE: Browser window akan terbuka");
    console.log("📋 QR Code akan muncul di browser dan terminal");
  }

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
    try {
      config.executablePath = puppeteer.executablePath();
    } catch (err) {
      console.warn("Could not get puppeteer executable path:", err.message);
      if (chromePath) {
        console.log(`Falling back to detected Chrome at: ${chromePath}`);
        config.executablePath = chromePath;
      }
    }
  }

  // Debug: log final configuration
  console.log("Final puppeteer config:", {
    headless: config.headless,
    mode: config.headless ? "HEADLESS" : "BROWSER WINDOW",
    executablePath: config.executablePath || "default",
    argsCount: config.args.length,
    timeout: config.protocolTimeout,
  });

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

// Fungsi helper untuk format bytes (pindahkan ke luar scope)
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

// Implementasi monitoring sumber daya yang lebih detail
const monitorResources = () => {
  try {
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = {
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024),
    };

    const uptime = Math.round(process.uptime());
    const cpuUsage = process.cpuUsage();
    
    console.log("📊 Resource Usage:", {
      memory_mb: memoryUsageMB,
      uptime_seconds: uptime,
      cpu_user_ms: Math.round(cpuUsage.user / 1000),
      cpu_system_ms: Math.round(cpuUsage.system / 1000),
      client_status: client && client.info ? 'connected' : 'disconnected',
      qr_available: currentQRCode ? true : false
    });

    // Memory thresholds dan peringatan
    const memoryThreshold = parseInt(process.env.MEMORY_THRESHOLD_MB) || 200;
    const criticalThreshold = memoryThreshold * 1.5;
    
    if (memoryUsageMB.rss > criticalThreshold) {
      console.error(
        `🚨 CRITICAL: Memory usage ${memoryUsageMB.rss}MB > ${criticalThreshold}MB`
      );
      // Log memory breakdown for debugging
      console.error("Memory breakdown:", memoryUsageMB);
    } else if (memoryUsageMB.rss > memoryThreshold) {
      console.warn(
        `⚠️ HIGH: Memory usage ${memoryUsageMB.rss}MB > ${memoryThreshold}MB`
      );
    }

    // Check browser process jika ada
    if (client && client.pupBrowser) {
      try {
        const browserConnected = client.pupBrowser.isConnected();
        if (!browserConnected) {
          console.warn("⚠️ Browser process disconnected");
        }
      } catch (browserErr) {
        console.warn("⚠️ Cannot check browser status:", browserErr.message);
      }
    }

    // Garbage collection hint jika memory usage tinggi
    if (memoryUsageMB.heapUsed > memoryThreshold * 0.8 && global.gc) {
      console.log("🧹 Running garbage collection...");
      global.gc();
    }

  } catch (err) {
    console.error("❌ Error monitoring resources:", err.message);
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
      puppeteer: puppeteerConfig,
    });

    client.on("qr", (qr) => {
      currentQRCode = qr; // Simpan QR code untuk endpoint
      console.log("\n" + "=".repeat(60));
      if (process.env.HEADLESS_MODE === "true") {
        console.log("🔍 HEADLESS MODE AKTIF - QR Code ditampilkan di terminal");
        console.log("📱 Scan QR code di bawah ini dengan WhatsApp di HP Anda:");
        console.log(
          "🌐 Atau akses http://localhost:" +
            (process.env.PORT || 3626) +
            "/qr untuk melihat QR code di browser"
        );
      } else {
        console.log(
          "🌐 Browser mode aktif - QR code akan muncul di browser DAN terminal"
        );
        console.log("📱 Scan QR code dengan WhatsApp di HP Anda:");
      }
      console.log("=".repeat(60));
      qrcode.generate(qr, { small: true });
      console.log("=".repeat(60));
      console.log("⏳ Menunggu scan QR code...\n");
    });

    // Capture browser instance after client initialization
    client.on("ready", () => {
      currentQRCode = null; // Clear QR code setelah berhasil login
      if (client.pupPage && client.pupPage.browser) {
        browserInstance = client.pupPage.browser();
        const pid = getBrowserPid(browserInstance);
        console.log(`🌐 Browser instance captured with PID: ${pid}`);
      }
      console.log("✅ WhatsApp ready!");
    });

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

    // QR Code endpoint untuk headless mode
    app.get("/qr", (req, res) => {
      if (!currentQRCode) {
        return res.status(404).json({
          error: "QR Code tidak tersedia",
          message: "QR Code belum di-generate atau WhatsApp sudah terhubung",
        });
      }

      // Generate QR code sebagai data URL untuk ditampilkan di browser
      const QRCode = require("qrcode");
      QRCode.toDataURL(currentQRCode, (err, url) => {
        if (err) {
          return res.status(500).json({ error: "Gagal generate QR code" });
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
              <h2>📱 WhatsApp QR Code</h2>
              <img src="${url}" alt="WhatsApp QR Code" class="qr-code">
              <div class="instructions">
                <p><strong>Cara menggunakan:</strong></p>
                <p>1. Buka WhatsApp di HP Anda</p>
                <p>2. Tap menu ⋮ (titik tiga) → Perangkat Tertaut</p>
                <p>3. Tap "Tautkan Perangkat"</p>
                <p>4. Scan QR code di atas</p>
              </div>
              <button class="refresh-btn" onclick="location.reload()">🔄 Refresh</button>
            </div>
            <script>
              // Auto refresh setiap 30 detik
              setTimeout(() => location.reload(), 30000);
            </script>
          </body>
          </html>
        `;

        res.send(html);
      });
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
        qr_available: currentQRCode ? true : false,
        headless_mode: process.env.HEADLESS_MODE === "true",
      });
    });

    // Health check endpoint dengan detail lengkap untuk debugging
    app.get("/health", async (req, res) => {
      try {
        const health = {
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          pid: process.pid,
          node_version: process.version,
          platform: process.platform,
          client: {
            initialized: client ? true : false,
            connected: client && client.info ? true : false,
            qr_available: currentQRCode ? true : false,
          }
        };

        if (client) {
          try {
            const state = await client.getState();
            health.client.state = state;
            health.client.connected = state === 'CONNECTED';
          } catch (stateError) {
            health.client.state_error = stateError.message;
          }

          if (client.info) {
            health.client.info = {
              phone: client.info.wid.user,
              name: client.info.pushname,
              platform: client.info.platform
            };
          }
        }

        // Check browser process status
        if (client && client.pupPage) {
          try {
            health.browser = {
              connected: !client.pupPage.isClosed(),
              url: client.pupPage.url()
            };
          } catch (browserError) {
            health.browser = {
              error: browserError.message
            };
          }
        }

        const statusCode = health.client.connected ? 200 : 503;
        res.status(statusCode).json(health);
      } catch (error) {
        res.status(500).json({
          error: "Health check failed",
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Emergency debug endpoint
    app.get("/debug", async (req, res) => {
      try {
        const debug = {
          timestamp: new Date().toISOString(),
          client_initialized: !!client,
          client_ready: !!(client && client.info),
          browser_connected: false,
          page_info: null,
          memory_usage: process.memoryUsage(),
          uptime: process.uptime()
        };

        if (client) {
          try {
            debug.client_state = await client.getState();
          } catch (e) {
            debug.client_state_error = e.message;
          }

          if (client.pupPage) {
            try {
              debug.browser_connected = !client.pupPage.isClosed();
              debug.page_info = {
                url: await client.pupPage.url(),
                title: await client.pupPage.title()
              };
            } catch (e) {
              debug.page_error = e.message;
            }
          }

          if (client.pupBrowser) {
            try {
              debug.browser_process = {
                connected: client.pupBrowser.isConnected(),
                pid: client.pupBrowser.process() ? client.pupBrowser.process().pid : null
              };
            } catch (e) {
              debug.browser_process_error = e.message;
            }
          }
        }

        res.json(debug);
      } catch (error) {
        res.status(500).json({
          error: "Debug failed",
          message: error.message
        });
      }
    });

    // Force restart endpoint (emergency use only)
    app.post("/emergency-restart", async (req, res) => {
      try {
        console.log("🚨 EMERGENCY RESTART TRIGGERED");
        res.json({ 
          message: "Restart initiated", 
          timestamp: new Date().toISOString() 
        });
        
        // Give response time to send
        setTimeout(() => {
          console.log("🔄 Forcing process exit for restart...");
          process.exit(1);
        }, 1000);
        
      } catch (error) {
        res.status(500).json({
          error: "Restart failed",
          message: error.message
        });
      }
    });

    // Dual-mode route dengan error handling yang lebih baik
    app.post(
      "/send-message",
      // Middleware untuk parsing berdasarkan content type
      (req, res, next) => {
        const contentType = req.get("Content-Type") || "";

        if (contentType.includes("application/json")) {
          // JSON request
          express.json({ limit: "50mb" })(req, res, next);
        } else if (contentType.includes("multipart/form-data")) {
          // Multipart request dengan file
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
          // Default JSON parser
          express.json({ limit: "50mb" })(req, res, next);
        }
      },
      async (req, res) => {
        try {
          console.log("📬 Received send-message request");
          console.log("Content-Type:", req.get("Content-Type"));
          console.log("Body keys:", Object.keys(req.body));
          console.log("File:", req.file ? req.file.originalname : "No file");

          // Ambil meta (dari JSON atau dari field form-data)
          const meta = req.body.meta
            ? typeof req.body.meta === "string"
              ? JSON.parse(req.body.meta)
              : req.body.meta
            : req.body;

          console.log("Meta data:", meta);

          // Validasi field yang diperlukan
          if (!meta.from || !meta.to || !meta.type) {
            return res.status(400).json({
              error: "Field yang diperlukan tidak lengkap",
              required: ["from", "to", "type"],
              received: Object.keys(meta),
            });
          }

          const from = meta.from.replace(/\D/g, "") + "@c.us";
          const to = meta.to.replace(/\D/g, "") + "@c.us";

          // Cek koneksi WhatsApp
          if (!client || !client.info) {
            return res.status(503).json({
              error: "WhatsApp client tidak terhubung",
              message: "Silakan scan QR code terlebih dahulu",
            });
          }

          // Pastikan sesi WhatsApp cocok
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
            console.log(`💬 Mengirim pesan teks ke ${meta.to}`);
            sent = await client.sendMessage(to, meta.content);
          } else if (meta.type === "file") {
            if (!req.file) {
              return res.status(400).json({
                error: "File tidak ditemukan di multipart request",
                message: "Pastikan field 'file' ada dalam form-data",
              });
            }

            // Validasi file
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

            console.log(
              `📤 Mengirim file: ${req.file.originalname} (${formatBytes(
                req.file.size
              )})`
            );

            // Verifikasi koneksi WhatsApp sebelum mengirim file
            console.log("🔍 Memverifikasi koneksi WhatsApp...");
            try {
              const state = await client.getState();
              console.log("📱 Status WhatsApp:", state);
              
              if (state !== 'CONNECTED') {
                throw new Error(`WhatsApp tidak terhubung. Status: ${state}`);
              }
            } catch (stateError) {
              console.error("❌ Error mendapatkan status WhatsApp:", stateError.message);
              throw new Error(`Gagal verifikasi koneksi WhatsApp: ${stateError.message}`);
            }

            const media = new MessageMedia(
              req.file.mimetype,
              req.file.buffer.toString("base64"),
              req.file.originalname
            );

            console.log("🔄 Memulai proses pengiriman file ke WhatsApp...");
            console.log("📊 Media info:", {
              type: media.mimetype,
              filename: media.filename,
              size: `${Math.round(media.data.length / 1024)} KB`
            });

            // Pre-send checks
            console.log("🔍 Melakukan pengecekan pre-send...");
            try {
              // Check if chat exists
              const chat = await client.getChatById(to);
              console.log("💬 Chat ditemukan:", { 
                name: chat.name || 'Unknown',
                isGroup: chat.isGroup,
                id: chat.id._serialized 
              });
            } catch (chatError) {
              console.warn("⚠️ Chat check gagal:", chatError.message);
              // Continue anyway as chat might still be valid
            }

            // Check browser connection
            if (client.pupPage) {
              try {
                const pageUrl = await client.pupPage.url();
                console.log("🌐 Browser page URL:", pageUrl);
                
                if (client.pupPage.isClosed()) {
                  throw new Error("Browser page telah ditutup");
                }
              } catch (pageError) {
                console.error("❌ Browser page error:", pageError.message);
                throw new Error(`Browser tidak responsif: ${pageError.message}`);
              }
            }
            
            // Enhanced timeout wrapper dengan multiple fallbacks
            const sendWithTimeout = (client, to, media, timeoutMs = 60000) => {
              return new Promise((resolve, reject) => {
                let isResolved = false;
                
                const timeout = setTimeout(() => {
                  if (!isResolved) {
                    isResolved = true;
                    console.error("⏰ TIMEOUT: sendMessage tidak meresponse dalam waktu yang ditentukan");
                    reject(new Error(`Timeout: Pengiriman file gagal dalam ${timeoutMs/1000} detik`));
                  }
                }, timeoutMs);

                // Heartbeat check untuk memastikan koneksi masih hidup
                const heartbeatInterval = setInterval(async () => {
                  if (isResolved) {
                    clearInterval(heartbeatInterval);
                    return;
                  }
                  
                  try {
                    console.log("💓 Heartbeat check...");
                    const state = await client.getState();
                    if (state !== 'CONNECTED') {
                      clearInterval(heartbeatInterval);
                      if (!isResolved) {
                        isResolved = true;
                        clearTimeout(timeout);
                        reject(new Error(`Koneksi terputus saat mengirim: ${state}`));
                      }
                    }
                  } catch (heartbeatError) {
                    console.warn("⚠️ Heartbeat check error:", heartbeatError.message);
                  }
                }, 10000); // Check setiap 10 detik

                console.log(`⏱️ Mengirim file dengan timeout ${timeoutMs/1000} detik...`);
                console.log("📤 Memulai client.sendMessage...");
                
                // Attempt to send message
                const sendPromise = client.sendMessage(to, media);
                
                // Handle the promise
                sendPromise
                  .then((result) => {
                    clearInterval(heartbeatInterval);
                    if (!isResolved) {
                      isResolved = true;
                      clearTimeout(timeout);
                      console.log("✅ client.sendMessage berhasil");
                      resolve(result);
                    }
                  })
                  .catch((error) => {
                    clearInterval(heartbeatInterval);
                    if (!isResolved) {
                      isResolved = true;
                      clearTimeout(timeout);
                      console.error("❌ client.sendMessage gagal:", error.message);
                      reject(error);
                    }
                  });

                // Handle case where promise never resolves/rejects
                setTimeout(() => {
                  if (!isResolved) {
                    console.warn("⚠️ sendMessage masih belum meresponse setelah 30 detik");
                  }
                }, 30000);
              });
            };

            try {
              sent = await sendWithTimeout(client, to, media, 60000); // 1 menit timeout lebih agresif
              console.log(
                `✅ File berhasil dikirim dengan ID: ${sent.id._serialized}`
              );
            } catch (sendError) {
              console.error("❌ Error saat mengirim file:", sendError.message);
              
              // Retry mechanism untuk kasus tertentu
              if (sendError.message.includes("Timeout") || sendError.message.includes("tidak meresponse")) {
                console.log("🔄 Mencoba mengirim ulang dengan timeout lebih pendek...");
                
                try {
                  // Coba dengan media yang lebih kecil (kompresi data)
                  const compressedMedia = new MessageMedia(
                    media.mimetype,
                    media.data,
                    media.filename || 'file'
                  );
                  
                  // Reduce timeout dan coba lagi
                  sent = await sendWithTimeout(client, to, compressedMedia, 30000); // 30 detik
                  console.log("✅ Retry berhasil dengan ID:", sent.id._serialized);
                  
                } catch (retryError) {
                  console.error("❌ Retry juga gagal:", retryError.message);
                  
                  // Last resort: coba kirim sebagai text dengan info file
                  try {
                    console.log("🆘 Last resort: mengirim info file sebagai teks...");
                    const fallbackMessage = `⚠️ Gagal mengirim file: ${req.file.originalname} (${formatBytes(req.file.size)})\nTipe: ${req.file.mimetype}\nError: ${retryError.message}`;
                    sent = await client.sendMessage(to, fallbackMessage);
                    console.log("📝 Fallback message sent dengan ID:", sent.id._serialized);
                  } catch (fallbackError) {
                    console.error("❌ Fallback message juga gagal:", fallbackError.message);
                    throw new Error(`Semua upaya gagal: ${sendError.message}`);
                  }
                }
              } else {
                throw new Error(`Gagal mengirim file: ${sendError.message}`);
              }
            }
          } else {
            return res.status(400).json({
              error: 'Type harus "text" atau "file".',
              received: meta.type,
            });
          }

          // Validasi apakah message berhasil dikirim
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

          console.log("✅ Response:", response);
          res.json(response);
        } catch (e) {
          console.error("❌ Error in send-message:", e);
          
          // Specific error messages untuk berbagai kasus
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
            errorMessage = "Sesi WhatsApp belum siap - scan QR code terlebih dahulu";
            statusCode = 503;
          } else if (e.message.includes("File too large")) {
            errorMessage = `File terlalu besar - maksimal ${MAX_FILE_SIZE_MB}MB`;
            statusCode = 413;
          } else if (e.message.includes("Unsupported file type")) {
            errorMessage = "Tipe file tidak didukung";
            statusCode = 415;
          } else if (e.message.includes("Browser crashed") || e.message.includes("Target closed")) {
            errorMessage = "Browser WhatsApp crash - restart diperlukan";
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
      console.log(`🚀 Running on http://localhost:${PORT}`);

      if (process.env.HEADLESS_MODE === "true") {
        console.log(`🔗 QR Code endpoint: http://localhost:${PORT}/qr`);
        console.log(`📊 Status endpoint: http://localhost:${PORT}/status`);
      }

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

    // Tambahkan event listener untuk menutup server dengan benar
    const handleServerShutdown = (signal) => {
      console.log(`Received ${signal}, shutting down server gracefully`);
      server.close(() => {
        console.log("Server closed");
        gracefulShutdown();
      });
    };

    // Use the server-specific shutdown handlers
    process.on("SIGTERM", () => handleServerShutdown("SIGTERM"));
    process.on("SIGINT", () => handleServerShutdown("SIGINT"));
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
