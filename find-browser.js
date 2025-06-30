#!/usr/bin/env node

/**
 * Script untuk mencari lokasi browser Chrome/Chromium di server
 *
 * Cara penggunaan:
 * 1. Jalankan script: node find-browser.js
 * 2. Salin path yang ditemukan ke variabel CHROME_PATH di file .env
 */

const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("🔍 Mencari browser Chrome/Chromium di server...\n");

// Lokasi browser yang umum
const commonPaths = [
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/snap/bin/chromium",
  "/usr/bin/chrome",
];

// Cek path yang umum
console.log("Memeriksa lokasi yang umum:");
let found = false;

for (const browserPath of commonPaths) {
  try {
    if (fs.existsSync(browserPath)) {
      console.log(`✅ Browser ditemukan di: ${browserPath}`);
      found = true;
    } else {
      console.log(`❌ Tidak ditemukan di: ${browserPath}`);
    }
  } catch (err) {
    console.log(`❌ Error memeriksa ${browserPath}: ${err.message}`);
  }
}

// Gunakan which command untuk menemukan browser
console.log('\nMencari dengan perintah "which":');
exec(
  "which google-chrome chromium chromium-browser google-chrome-stable",
  (error, stdout, stderr) => {
    if (error) {
      console.log(`❌ Error menjalankan perintah "which": ${error.message}`);
    } else if (stderr) {
      console.log(`❌ Error output: ${stderr}`);
    } else {
      const paths = stdout.split("\n").filter(Boolean);

      if (paths.length > 0) {
        console.log('✅ Browser ditemukan dengan perintah "which":');
        paths.forEach((p) => console.log(`   - ${p}`));
        found = true;
      } else {
        console.log(
          '❌ Tidak ada browser yang ditemukan dengan perintah "which"'
        );
      }
    }

    // Coba perintah alternatif jika tidak ditemukan
    if (!found) {
      console.log("\nMencoba pencarian alternatif...");
      exec(
        'find /usr/bin -name "*chrome*" -o -name "*chromium*"',
        (error, stdout, stderr) => {
          if (error) {
            console.log(`❌ Error mencari browser: ${error.message}`);
          } else {
            const paths = stdout.split("\n").filter(Boolean);

            if (paths.length > 0) {
              console.log("✅ Browser kandidat ditemukan:");
              paths.forEach((p) => console.log(`   - ${p}`));
            } else {
              console.log("❌ Tidak ada browser yang ditemukan");
              console.log("\n⚠️ Solusi:");
              console.log("1. Install Chrome atau Chromium:");
              console.log(
                "   sudo apt update && sudo apt install -y chromium-browser"
              );
              console.log("2. Atau install library yang diperlukan:");
              console.log(
                "   sudo apt-get install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils"
              );
            }
          }

          // Instruksi akhir
          console.log("\n🔧 Cara menggunakan hasil pencarian:");
          console.log("1. Salin path browser yang ditemukan");
          console.log("2. Buka file .env");
          console.log(
            "3. Tambahkan atau edit baris CHROME_PATH=<path-browser>"
          );
          console.log("4. Restart aplikasi dengan: npm run pm2:restart");
        }
      );
    } else {
      // Instruksi akhir jika browser ditemukan
      console.log("\n🔧 Cara menggunakan hasil pencarian:");
      console.log("1. Salin path browser yang ditemukan");
      console.log("2. Buka file .env");
      console.log("3. Tambahkan atau edit baris CHROME_PATH=<path-browser>");
      console.log("4. Restart aplikasi dengan: npm run pm2:restart");
    }
  }
);
