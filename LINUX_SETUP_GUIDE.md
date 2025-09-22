# 🐧 Panduan Menjalankan WhatsApp Web JS di Linux

## 🚀 **Cara Menjalankan Aplikasi**

### **1. Install Dependensi Baru**

```bash
# Install express-rate-limit yang diperlukan untuk security
npm install express-rate-limit

# Atau jika menggunakan pnpm
pnpm install express-rate-limit
```

### **2. Verifikasi Konfigurasi .env**

```bash
# Pastikan konfigurasi sudah benar
cat .env | grep -E "(PRESERVE_SESSION_FILES|SESSION_BACKUP_ENABLED|RATE_LIMIT_ENABLED)"
```

### **3. Menjalankan Aplikasi dengan PM2**

#### **Opsi A: Menggunakan ecosystem.config.js (Recommended)**

```bash
# Start aplikasi dengan PM2
pm2 start ecosystem.config.js

# Atau restart jika sudah ada
pm2 restart wa-express
```

#### **Opsi B: Manual PM2 start**

```bash
# Start manual
pm2 start index.js --name wa-express

# Dengan environment production
pm2 start index.js --name wa-express --env production
```

### **4. Setup PM2 untuk Auto-Start saat Boot**

```bash
# Save konfigurasi PM2 saat ini
pm2 save

# Generate startup script (hanya sekali)
pm2 startup

# Ikuti instruksi yang muncul, biasanya seperti:
# sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u username --hp /home/username
```

---

## ⏰ **Cron Restart - Apakah Otomatis Berjalan?**

### **✅ YA! Cron restart OTOMATIS aktif setelah PM2 start**

Konfigurasi di `ecosystem.config.js`:

```javascript
cron_restart: "0 3 * * 0",  // Restart setiap Minggu jam 3 pagi
```

**Penjelasan cron pattern:**

- `0` = Menit ke-0
- `3` = Jam 3 pagi
- `*` = Setiap hari dalam bulan
- `*` = Setiap bulan
- `0` = Hari Minggu (0=Minggu, 1=Senin, dst)

### **Cara Memverifikasi Cron Restart Aktif:**

```bash
# Lihat detail aplikasi, termasuk cron restart
pm2 show wa-express

# Output akan menampilkan:
# ┌─────────────────┬────────────────────┐
# │ restart time    │ 0 3 * * 0          │
# └─────────────────┴────────────────────┘
```

---

## 📋 **Command Management untuk Linux**

### **Menjalankan Aplikasi:**

```bash
# Start aplikasi
pm2 start ecosystem.config.js

# Lihat QR Code
pm2 logs wa-express

# Check status
pm2 status wa-express
```

### **Management Harian:**

```bash
# Lihat logs real-time
pm2 logs wa-express --lines 100

# Monitor resource usage
pm2 monit

# Restart manual jika diperlukan
pm2 restart wa-express

# Stop aplikasi
pm2 stop wa-express
```

### **Utility Commands:**

```bash
# Cleanup cache (aman, tidak hapus session)
npm run cleanup

# Backup session manual
npm run backup

# Monitor memory usage
npm run monitor

# Restore session jika diperlukan
npm run restore /path/to/backup
```

---

## 🔧 **Setup Script Linux (server-helper.sh)**

Script bash yang sudah ada sudah compatible dengan optimasi baru. Update sedikit untuk compatibility:

```bash
# Pastikan executable
chmod +x server-helper.sh

# Menjalankan berbagai command
./server-helper.sh install      # Install dependencies + chromium
./server-helper.sh start        # Start dengan PM2
./server-helper.sh logs         # Lihat QR code
./server-helper.sh status       # Check status
./server-helper.sh cleanup      # Cleanup cache
./server-helper.sh monitor      # Monitor resources
```

---

## 📊 **Monitoring & Verifikasi**

### **1. Verifikasi Session Protection Aktif:**

```bash
# Check apakah file session terlindungi
ls -la .wwebjs_auth/session-wa-1.json

# Check konfigurasi .env
grep PRESERVE_SESSION_FILES .env
```

### **2. Verifikasi PM2 Cron:**

```bash
# Detail lengkap aplikasi
pm2 show wa-express

# List semua proses dengan cron info
pm2 list
```

### **3. Verifikasi Auto Backup:**

```bash
# Check folder backup
ls -la .session_backup/

# Test manual backup
npm run backup
```

### **4. Check Logs:**

```bash
# Application logs
pm2 logs wa-express

# Security logs (jika enabled)
tail -f logs/security.log

# Error logs
tail -f logs/wa-express-error.log
```

---

## 🚀 **Quick Start Commands**

### **Initial Setup (First Time):**

```bash
# 1. Install dependencies
npm install express-rate-limit

# 2. Setup chromium (jika belum ada)
./server-helper.sh install

# 3. Start aplikasi
pm2 start ecosystem.config.js

# 4. Setup auto-start saat boot
pm2 save
pm2 startup

# 5. Lihat QR code
pm2 logs wa-express
```

### **Daily Operations:**

```bash
# Check status
pm2 status wa-express

# View logs untuk QR code (jika perlu)
pm2 logs wa-express --lines 50

# Manual restart (jarang diperlukan)
pm2 restart wa-express
```

---

## ⚠️ **Important Notes**

### **Tentang Cron Restart:**

- **Otomatis aktif** setelah `pm2 start`
- **Tidak perlu setup manual** cron di system
- **PM2 internal cron** yang menangani restart
- **Restart setiap Minggu** jam 3 pagi untuk maintenance
- **Graceful restart** - tidak akan interrupt active sessions

### **Tentang Session Persistence:**

- File session **dilindungi** dari auto-cleanup
- **Backup otomatis** setiap 12 jam
- **Restore mudah** jika ada masalah
- **No QR scan** after restart (session preserved)

### **Tentang Security:**

- **Rate limiting** aktif (60 req/min)
- **IP whitelist** protection
- **API key validation** enhanced
- **Logging** semua akses

---

## 🆘 **Troubleshooting**

### **Jika PM2 tidak start:**

```bash
# Install PM2 global
npm install -g pm2

# Kill all PM2 processes dan start fresh
pm2 kill
pm2 start ecosystem.config.js
```

### **Jika masih perlu scan QR setelah restart:**

```bash
# Check session files
ls -la .wwebjs_auth/

# Restore dari backup terakhir
npm run restore $(ls -t .session_backup/ | head -n1)
```

### **Jika cron restart tidak aktif:**

```bash
# Restart PM2 dengan ecosystem config
pm2 delete wa-express
pm2 start ecosystem.config.js
pm2 save
```

**🎯 Dengan setup ini, aplikasi akan berjalan stabil dengan restart mingguan otomatis dan session yang persisten!**
