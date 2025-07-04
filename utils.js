/**
 * Script utilitas untuk WhatsApp Web JS
 *
 * Script ini menyediakan utilitas untuk membersihkan file cache dan
 * memantau penggunaan sumber daya aplikasi WhatsApp Web JS.
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");

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
      let totalCleaned = 0;
      for (const cleanupPath of cleanupPaths) {
        if (fs.existsSync(cleanupPath)) {
          const beforeSize = getFolderSize(cleanupPath);
          removeOldFiles(cleanupPath);
          const afterSize = getFolderSize(cleanupPath);
          const cleanedSize = beforeSize - afterSize;
          totalCleaned += cleanedSize;
          console.log(
            `  ✓ Membersihkan: ${path.relative(
              sessionDir,
              cleanupPath
            )}, dibebaskan: ${formatBytes(cleanedSize)}`
          );
        }
      }

      console.log(
        `✅ Pembersihan file cache selesai. Total ruang disk yang dibebaskan: ${formatBytes(
          totalCleaned
        )}`
      );
    } else {
      console.log(
        "⚠️ Direktori sesi .wwebjs_auth belum ada. Tidak ada yang perlu dibersihkan."
      );
    }
  } catch (err) {
    console.error("❌ Error saat membersihkan file cache:", err.message);
  }
};

// Fungsi bantuan untuk mendapatkan ukuran folder
function getFolderSize(folderPath) {
  let totalSize = 0;

  if (!fs.existsSync(folderPath)) return 0;

  const files = fs.readdirSync(folderPath);

  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const stats = fs.statSync(filePath);

    if (stats.isFile()) {
      totalSize += stats.size;
    } else if (stats.isDirectory()) {
      totalSize += getFolderSize(filePath);
    }
  }

  return totalSize;
}

// Fungsi bantuan untuk memformat ukuran dalam bytes menjadi format yang lebih mudah dibaca
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

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

    return memoryUsageMB;
  } catch (err) {
    console.error("❌ Error saat monitoring sumber daya:", err.message);
    return null;
  }
};

// Eksekusi fungsi yang dipanggil dari command line
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "cleanup") {
    cleanupSessionFiles();
  } else if (command === "monitor") {
    monitorResources();
  } else {
    console.log("Perintah tidak valid. Gunakan 'cleanup' atau 'monitor'.");
    console.log("Contoh penggunaan:");
    console.log(
      "  node utils.js cleanup  - Membersihkan file cache sesi WhatsApp"
    );
    console.log(
      "  node utils.js monitor  - Menampilkan penggunaan memori saat ini"
    );
  }
}

// Ekspos fungsi untuk digunakan dari file lain
module.exports = {
  cleanupSessionFiles,
  monitorResources,
  getFolderSize,
  formatBytes,
};
