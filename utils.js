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
      // Berapa hari file dianggap kadaluarsa (hanya untuk file cache, bukan session auth)
      const maxAgeInDays = parseInt(process.env.MAX_SESSION_AGE_DAYS) || 30;
      const maxAgeInMs = maxAgeInDays * 24 * 60 * 60 * 1000;

      // Preserve session files? (untuk mencegah scan QR berulang)
      const preserveSessionFiles =
        process.env.PRESERVE_SESSION_FILES === "true";

      // Hanya bersihkan file cache dan temporary, JANGAN hapus file autentikasi
      const cleanupPaths = [
        path.join(sessionDir, "session", "Default", "Cache"),
        path.join(sessionDir, "session", "Default", "Code Cache"),
        path.join(sessionDir, "session", "Default", "GPUCache"),
        path.join(sessionDir, "session", "Default", "Service Worker"),
        path.join(sessionDir, "session", "Default", "logs"),
        path.join(sessionDir, "session", "Default", "CachedData"),
      ];

      // File-file penting yang TIDAK boleh dihapus (untuk menjaga autentikasi)
      const protectedFiles = [
        "session.json",
        "Default/Cookies",
        "Default/Local Storage",
        "Default/Session Storage",
        "Default/IndexedDB",
        "Default/WebStorage",
        "session-wa-1.json",
      ];

      // Fungsi untuk memeriksa apakah file dilindungi
      const isProtectedFile = (filePath) => {
        if (!preserveSessionFiles) return false;

        const relativePath = path.relative(sessionDir, filePath);
        return protectedFiles.some(
          (protectedFile) =>
            relativePath.includes(protectedFile) ||
            relativePath.endsWith(".json") ||
            relativePath.includes("Cookies") ||
            relativePath.includes("Storage")
        );
      };

      // Fungsi untuk menghapus file lama secara rekursif
      const removeOldFiles = (dirPath) => {
        if (!fs.existsSync(dirPath)) return;

        const items = fs.readdirSync(dirPath);

        for (const item of items) {
          const itemPath = path.join(dirPath, item);

          // Skip file yang dilindungi
          if (isProtectedFile(itemPath)) {
            console.log(
              `  ⚠️ Melindungi file penting: ${path.relative(
                sessionDir,
                itemPath
              )}`
            );
            continue;
          }

          const stats = fs.statSync(itemPath);

          if (stats.isDirectory()) {
            removeOldFiles(itemPath);
            // Cek apakah direktori kosong, jika ya hapus (kecuali direktori penting)
            try {
              const subItems = fs.readdirSync(itemPath);
              if (subItems.length === 0 && !isProtectedFile(itemPath)) {
                fs.rmdirSync(itemPath);
              }
            } catch (err) {
              // Ignore error jika direktori tidak bisa dihapus
            }
          } else if (stats.isFile()) {
            // Cek umur file
            const fileAge = now - stats.mtime.getTime();
            if (fileAge > maxAgeInMs) {
              try {
                fs.unlinkSync(itemPath);
                console.log(
                  `  - Menghapus file cache lama: ${path.relative(
                    sessionDir,
                    itemPath
                  )}`
                );
              } catch (err) {
                console.warn(
                  `  ⚠️ Gagal menghapus file: ${itemPath} - ${err.message}`
                );
              }
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

      // Log informasi tentang file yang dilindungi
      if (preserveSessionFiles) {
        console.log(
          "🔒 File autentikasi WhatsApp telah dilindungi untuk mencegah scan QR berulang"
        );
      }
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

// Fungsi backup session files untuk mencegah kehilangan autentikasi
const backupSessionFiles = async () => {
  try {
    const sessionDir = path.join(process.cwd(), ".wwebjs_auth");
    const backupDir = path.join(process.cwd(), ".session_backup");

    if (!fs.existsSync(sessionDir)) {
      console.log("⚠️ Tidak ada session yang perlu di-backup");
      return;
    }

    // Buat direktori backup jika belum ada
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Buat timestamp untuk backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(backupDir, `session_backup_${timestamp}`);

    console.log("💾 Memulai backup session files...");

    // Copy file-file penting saja (bukan cache)
    const importantFiles = ["session-wa-1.json", "session.json"];

    const importantDirs = [
      "Default/Cookies",
      "Default/Local Storage",
      "Default/Session Storage",
      "Default/IndexedDB",
      "Default/WebStorage",
    ];

    fs.mkdirSync(backupPath, { recursive: true });

    // Backup file JSON session
    for (const file of importantFiles) {
      const srcFile = path.join(sessionDir, file);
      if (fs.existsSync(srcFile)) {
        const destFile = path.join(backupPath, file);
        fs.copyFileSync(srcFile, destFile);
        console.log(`  ✓ Backup: ${file}`);
      }
    }

    // Backup direktori penting
    for (const dir of importantDirs) {
      const srcDir = path.join(sessionDir, "session", dir);
      const destDir = path.join(backupPath, "session", dir);

      if (fs.existsSync(srcDir)) {
        copyDirectoryRecursive(srcDir, destDir);
        console.log(`  ✓ Backup: ${dir}`);
      }
    }

    // Hapus backup lama (simpan hanya 5 backup terbaru)
    cleanOldBackups(backupDir, 5);

    console.log(`✅ Session backup selesai: ${backupPath}`);
    return backupPath;
  } catch (err) {
    console.error("❌ Error saat backup session:", err.message);
    return null;
  }
};

// Fungsi restore session dari backup
const restoreSessionFiles = async (backupPath) => {
  try {
    if (!backupPath || !fs.existsSync(backupPath)) {
      console.error("❌ Path backup tidak valid atau tidak ditemukan");
      return false;
    }

    const sessionDir = path.join(process.cwd(), ".wwebjs_auth");

    console.log("🔄 Memulai restore session dari backup...");

    // Backup session yang ada sebelum restore (sebagai safety)
    if (fs.existsSync(sessionDir)) {
      await backupSessionFiles();
    }

    // Buat direktori session jika belum ada
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    // Copy file dari backup
    copyDirectoryRecursive(backupPath, sessionDir);

    console.log("✅ Session berhasil di-restore dari backup");
    return true;
  } catch (err) {
    console.error("❌ Error saat restore session:", err.message);
    return false;
  }
};

// Fungsi helper untuk copy direktori secara rekursif
const copyDirectoryRecursive = (src, dest) => {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const items = fs.readdirSync(src);

  for (const item of items) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);

    const stats = fs.statSync(srcPath);

    if (stats.isDirectory()) {
      copyDirectoryRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
};

// Fungsi untuk membersihkan backup lama
const cleanOldBackups = (backupDir, keepCount) => {
  try {
    const backups = fs
      .readdirSync(backupDir)
      .filter((item) => item.startsWith("session_backup_"))
      .map((item) => ({
        name: item,
        path: path.join(backupDir, item),
        mtime: fs.statSync(path.join(backupDir, item)).mtime,
      }))
      .sort((a, b) => b.mtime - a.mtime); // Sort by newest first

    // Hapus backup yang lebih dari keepCount
    if (backups.length > keepCount) {
      const toDelete = backups.slice(keepCount);

      for (const backup of toDelete) {
        fs.rmSync(backup.path, { recursive: true, force: true });
        console.log(`  🗑️ Menghapus backup lama: ${backup.name}`);
      }
    }
  } catch (err) {
    console.warn("⚠️ Error membersihkan backup lama:", err.message);
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
  } else if (command === "backup") {
    backupSessionFiles();
  } else if (command === "restore") {
    const backupPath = args[1];
    if (!backupPath) {
      console.log("❌ Path backup harus disediakan");
      console.log("Contoh: node utils.js restore /path/to/backup");
      return;
    }
    restoreSessionFiles(backupPath);
  } else {
    console.log(
      "Perintah tidak valid. Gunakan 'cleanup', 'monitor', 'backup', atau 'restore'."
    );
    console.log("Contoh penggunaan:");
    console.log(
      "  node utils.js cleanup  - Membersihkan file cache sesi WhatsApp"
    );
    console.log(
      "  node utils.js monitor  - Menampilkan penggunaan memori saat ini"
    );
    console.log("  node utils.js backup   - Backup file session penting");
    console.log("  node utils.js restore <path> - Restore session dari backup");
  }
}

// Ekspos fungsi untuk digunakan dari file lain
module.exports = {
  cleanupSessionFiles,
  monitorResources,
  getFolderSize,
  formatBytes,
  backupSessionFiles,
  restoreSessionFiles,
};
