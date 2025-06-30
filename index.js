require("dotenv").config();
const express = require("express");
const multer = require("multer");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const puppeteer = require("puppeteer");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Inisialisasi WhatsApp client
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    executablePath: puppeteer.executablePath(),
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-gpu",
    ],
  },
});
client.on("qr", (qr) => qrcode.generate(qr, { small: true }));
client.on("ready", () => console.log("✅ WhatsApp ready!"));
client.initialize();

// Middleware auth API key
app.use((req, res, next) => {
  if (req.header("bypass-apikey") !== process.env.API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
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

      res.json({ status: "success", id: sent.id._serialized });
    } catch (e) {
      console.error(e);
      res.status(500).json({ status: "error", message: e.message });
    }
  }
);

const PORT = process.env.PORT || 3626;
app.listen(PORT, () => console.log(`🚀 Running on http://localhost:${PORT}`));
