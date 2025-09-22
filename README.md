<!DOCTYPE html>
<html lang="id">

<body>

  <h1>🚀 API WhatsApp Sender - Optimized & Secure</h1>
  <p>API untuk mengirim pesan WhatsApp (teks & file) menggunakan <code>whatsapp-web.js</code> dan Express. Dilengkapi dengan sistem keamanan, auto-backup session, dan optimasi performa untuk server production.</p>

  <div class="security-notice" style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <h3>⚠️ Security Notice</h3>
    <p><strong>🔒 PENTING:</strong> Semua data dalam dokumentasi ini adalah contoh/dummy untuk keamanan repository public.</p>
    <ul>
      <li>🔑 <strong>API Keys:</strong> Gunakan API key yang kuat dan unik untuk production</li>
      <li>📱 <strong>Phone Numbers:</strong> Gunakan nomor WhatsApp yang valid</li>
      <li>🌐 <strong>IPs & Ports:</strong> Sesuaikan dengan environment Anda</li>
      <li>🚫 <strong>Jangan commit file .env</strong> ke repository public</li>
    </ul>
  </div>

  <div class="features">
    <h2>✨ Fitur Utama</h2>
    <ul>
      <li>🔐 <strong>Enhanced Security:</strong> Rate limiting, IP whitelist, API key validation</li>
      <li>💾 <strong>Session Persistence:</strong> Anti scan QR berulang dengan proteksi file session</li>
      <li>📦 <strong>Auto Backup:</strong> Backup otomatis session files setiap 12 jam</li>
      <li>⚡ <strong>Performance Optimized:</strong> Memory management dan Puppeteer optimization</li>
      <li>🔄 <strong>Smart Restart:</strong> Restart mingguan otomatis (bukan harian)</li>
      <li>📊 <strong>Comprehensive Logging:</strong> Security logs dan monitoring lengkap</li>
      <li>🐛 <strong>Debug Mode:</strong> Easy switching untuk development/production</li>
    </ul>
  </div>

  <div class="section">
    <h2>📦 Installasi</h2>
    <pre><code># Install dependencies
npm install -g pnpm pm2
pnpm install

# Install security dependencies

npm install express-rate-limit

# Make helper script executable (Linux)

chmod +x server-helper.sh</code></pre>

  </div>

  <div class="section">
    <h2>🔧 Konfigurasi</h2>
    <p>File <code>.env</code> sudah dikonfigurasi dengan optimasi lengkap:</p>
    <pre><code># Basic Configuration
API_KEY=your_secure_api_key_here_12345
PORT=3000
NODE_ENV=production

# Browser Configuration

HEADLESS_MODE=true
CHROME_PATH=

# Performance Optimization

USE_MEMORY_CACHE=true
DISABLE_SPELLCHECK=true
JS_MEMORY_LIMIT=128
DISK_CACHE_SIZE=1
DISABLE_EXTENSIONS=true
DISABLE_GPU=true
USE_SINGLE_PROCESS=true

# Session Management (Anti Scan QR Berulang)

AUTO_CLEAN_SESSION=true
SESSION_CLEANUP_INTERVAL=86400000
PRESERVE_SESSION_FILES=true
SESSION_BACKUP_ENABLED=true
SESSION_BACKUP_INTERVAL=43200000
MAX_SESSION_AGE_DAYS=30

# Security Configuration

RATE_LIMIT_ENABLED=true
MAX_REQUESTS_PER_MINUTE=60
ALLOWED_IPS=127.0.0.1,localhost
ENABLE_API_LOGGING=true

# Debug Mode (Set to false for production)

DEBUG_MODE=false
DISABLE_IP_WHITELIST_IN_DEBUG=false</code></pre>

    <div class="config-warning" style="background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 10px; border-radius: 5px; margin: 10px 0;">
      <p><strong>⚠️ Production Setup:</strong></p>
      <ul>
        <li>Ganti <code>your_secure_api_key_here_12345</code> dengan API key yang kuat</li>
        <li>Sesuaikan <code>PORT</code> dengan environment Anda</li>
        <li>Update <code>ALLOWED_IPS</code> dengan IP server yang valid</li>
        <li>Set <code>DEBUG_MODE=false</code> untuk production</li>
      </ul>
    </div>

  </div>

  <div class="section">
    <h2>▶️ Menjalankan Aplikasi</h2>
    
    <h3>🐧 Linux (Recommended):</h3>
    <pre><code># Using helper script
./server-helper.sh install   # Install dependencies + chromium
./server-helper.sh start     # Start with PM2
./server-helper.sh logs      # View QR code

# Manual PM2

pm2 start ecosystem.config.js
pm2 logs wa-express</code></pre>

    <h3>🪟 Manual (Any OS):</h3>
    <pre><code># Direct run

node index.js

# Using PM2

pm2 start ecosystem.config.js
pm2 save && pm2 startup</code></pre>

    <p><strong>📱 QR Code:</strong> Scan QR code yang muncul di logs <strong>hanya sekali</strong>. Session akan tersimpan dan tidak perlu scan lagi.</p>

  </div>

  <div class="section">
    <h2>📤 Kirim Pesan Teks <span class="tag">application/json</span></h2>
    <p><strong>Endpoint:</strong> <code>POST /send-message</code></p>
    <p><strong>Headers:</strong></p>
    <ul>
      <li><code>bypass-apikey: your_secure_api_key_here_12345</code></li>
      <li><code>Content-Type: application/json</code></li>
    </ul>

    <p>Contoh body:</p>
    <pre><code>{

"from": "62888888888888",
"to": "62858545685452",
"type": "text",
"content": "Halo, ini pesan dari API!"
}</code></pre>

    <p><strong>Response:</strong></p>
    <pre><code>{

"status": "success",
"message": "Message sent successfully",
"mid": "message_id_12345",
"from": "62888888888888",
"to": "62858545685452"
}</code></pre>

  </div>

  <div class="section">
    <h2>📎 Kirim File <span class="tag">multipart/form-data</span></h2>
    <p><strong>Fields:</strong> <code>meta</code> (JSON) dan <code>file</code> (Binary)</p>
    <p><strong>Contoh curl:</strong></p>
    <pre><code>curl -X POST http://localhost:3000/send-message \
  -H "bypass-apikey: your_secure_api_key_here_12345" \
  -F 'meta={
    "from": "62888888888888",
    "to": "62858545685452",
    "type": "file",
    "caption": "Ini file penting"
  }' \
  -F "file=@/path/to/file.pdf"</code></pre>

    <p><strong>Supported file types:</strong> PDF, Images (JPG, PNG), Documents, Audio, Video (max 50MB)</p>

  </div>

  <div class="section">
    <h2>� Endpoint Security & Monitoring</h2>
    
    <h3>📊 Status Check:</h3>
    <pre><code>GET /status
Header: bypass-apikey: your_secure_api_key_here_12345

Response:
{
"status": "connected",
"info": {
"phone": "62888888888888",
"name": "Your WhatsApp Name"
},
"qr_available": false
}</code></pre>

    <h3>📱 QR Code Viewer:</h3>
    <pre><code>GET /qr

Header: bypass-apikey: your_secure_api_key_here_12345

# Menampilkan QR code dalam format HTML (jika tersedia)</code></pre>

    <h3>🛡️ Rate Limiting:</h3>
    <ul>
      <li><strong>Default:</strong> 60 requests per minute per IP</li>
      <li><strong>Response saat limit:</strong> HTTP 429 Too Many Requests</li>
      <li><strong>IP Whitelist:</strong> Hanya IP terdaftar yang bisa akses</li>
    </ul>

  </div>

  <div class="section">
    <h2>� Session Management - Anti Scan QR Berulang</h2>
    
    <p><strong>🔒 Session Persistence:</strong> File session dilindungi otomatis, QR scan hanya sekali!</p>
    
    <h3>📂 Auto Backup System:</h3>
    <pre><code># Manual backup
npm run backup

# Manual restore

npm run restore /path/to/backup

# Cleanup cache (aman, tidak hapus session)

npm run cleanup</code></pre>

    <h3>📍 File Structure:</h3>
    <pre><code>.wwebjs_auth/           # Session storage (protected)

├── session-wa-1.json # Main auth file (protected)
├── session/ # Browser session (protected)
└── Default/Cache/ # Cache files (auto-cleaned)

.session_backup/ # Auto backup storage
├── session_backup_2024-XX-XX/
└── session_backup_latest/

logs/ # Application logs
├── security.log # Security events
├── wa-express-combined.log
└── wa-express-error.log</code></pre>

    <p><strong>✅ Keuntungan:</strong></p>
    <ul>
      <li>Session bertahan berminggu-minggu tanpa scan QR</li>
      <li>Auto backup setiap 12 jam</li>
      <li>Recovery mudah jika session hilang</li>
      <li>Cleanup cerdas hanya hapus cache, bukan session</li>
    </ul>

  </div>

  <div class="section">
    <h2>🔧 Management Commands</h2>
    
    <h3>🐧 Linux Helper Script:</h3>
    <pre><code># Server management
./server-helper.sh start     # Start aplikasi
./server-helper.sh stop      # Stop aplikasi  
./server-helper.sh restart   # Restart aplikasi
./server-helper.sh status    # Check status
./server-helper.sh logs      # View logs & QR code

# Maintenance

./server-helper.sh cleanup # Clean cache files
./server-helper.sh backup # Backup session
./server-helper.sh monitor # Monitor resources</code></pre>

    <h3>📦 NPM Scripts:</h3>
    <pre><code># PM2 Commands

npm run pm2:start # Start with PM2
npm run pm2:stop # Stop PM2
npm run pm2:restart # Restart PM2
npm run pm2:logs # View logs
npm run pm2:status # Check status

# Utility Commands

npm run cleanup # Clean cache
npm run backup # Backup session
npm run restore # Restore session
npm run monitor # Monitor resources</code></pre>

    <h3>⚡ PM2 Direct Commands:</h3>
    <pre><code># Essential PM2 commands

pm2 start ecosystem.config.js # Start application
pm2 logs wa-express # View real-time logs
pm2 status wa-express # Check status
pm2 restart wa-express # Restart application
pm2 stop wa-express # Stop application
pm2 monit # Resource monitoring</code></pre>

  </div>

  <div class="section">
    <h2>💡 Production Tips</h2>
    <h3>🚀 Auto Restart & Monitoring:</h3>
    <ul>
      <li><strong>PM2 Auto Restart:</strong> Restart mingguan otomatis (Minggu 3 AM)</li>
      <li><strong>Memory Management:</strong> Auto restart pada 300MB usage</li>
      <li><strong>Session Persistence:</strong> Session tetap terjaga setelah restart</li>
      <li><strong>Log Rotation:</strong> Auto log management</li>
    </ul>

    <h3>🛡️ Security Best Practices:</h3>
    <ul>
      <li>Gunakan <strong>strong API key</strong> di production</li>
      <li>Set <code>ALLOWED_IPS</code> ke IP spesifik, bukan wildcard</li>
      <li>Monitor <code>logs/security.log</code> untuk akses tidak sah</li>
      <li>Backup session files secara berkala</li>
      <li>Set <code>DEBUG_MODE=false</code> di production</li>
    </ul>

    <h3>⚡ Performance Optimization:</h3>
    <ul>
      <li><strong>Memory limit:</strong> 256MB JavaScript heap</li>
      <li><strong>Cache optimization:</strong> Minimal disk cache untuk server</li>
      <li><strong>Browser flags:</strong> Disabled GPU, extensions, images untuk performance</li>
      <li><strong>Single process:</strong> Optimized untuk server headless</li>
    </ul>

    <h3>🐛 Debug Mode:</h3>
    <pre><code># Enable debug mode

DEBUG_MODE=true
DISABLE_IP_WHITELIST_IN_DEBUG=true
ALLOWED_IPS=\*

# Disable untuk production

DEBUG_MODE=false
ALLOWED_IPS=127.0.0.1,localhost</code></pre>

  </div>

  <div class="section">
    <h2>🆘 Troubleshooting</h2>
    
    <h3>❓ QR Code Masih Muncul Setelah Restart?</h3>
    <pre><code># Check session files
ls -la .wwebjs_auth/session-wa-1.json

# Restore dari backup

npm run restore $(ls -t .session_backup/ | head -n1)

# Check konfigurasi protection

grep PRESERVE_SESSION_FILES .env</code></pre>

    <h3>🚫 Error: IP Blocked?</h3>
    <pre><code># Check allowed IPs

grep ALLOWED_IPS .env

# Temporary allow all untuk debug

# Set ALLOWED_IPS=\* di .env lalu restart</code></pre>

    <h3>📊 Memory Issues?</h3>
    <pre><code># Monitor resource usage

npm run monitor

# Check PM2 memory usage

pm2 monit

# Increase memory limit di ecosystem.config.js

max_memory_restart: "400M"</code></pre>

    <h3>🔍 Browser Not Found?</h3>
    <pre><code># Find available browsers

npm run find-browser

# Set browser path di .env

CHROME_PATH=/usr/bin/chromium-browser

# Install chromium (Ubuntu/Debian)

sudo apt install -y chromium-browser</code></pre>

  </div>

  <div class="section">
    <h2>📚 Documentation</h2>
    <ul>
      <li><code>LINUX_SETUP_GUIDE.md</code> - Panduan setup Linux lengkap</li>
      <li><code>OPTIMIZATION_GUIDE.md</code> - Detail optimasi yang diterapkan</li>
      <li><code>DEBUG_CONFIG.md</code> - Konfigurasi debug mode</li>
    </ul>
  </div>

  <div class="section">
    <h2>📋 Requirements</h2>
    <ul>
      <li><strong>Node.js:</strong> v16+ (recommended v18+)</li>
      <li><strong>PM2:</strong> For production deployment</li>
      <li><strong>Chromium/Chrome:</strong> For WhatsApp Web automation</li>
      <li><strong>Memory:</strong> Minimum 512MB RAM</li>
      <li><strong>Storage:</strong> 1GB free space for sessions & logs</li>
    </ul>
  </div>

  <div class="section">
    <h2>🔐 Security Guidelines for Production</h2>
    
    <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 10px 0;">
      <h3>🛡️ Essential Security Checklist:</h3>
      <ul>
        <li>✅ <strong>Strong API Key:</strong> Gunakan minimal 32 karakter random string</li>
        <li>✅ <strong>IP Whitelist:</strong> Hanya allow IP yang benar-benar diperlukan</li>
        <li>✅ <strong>Environment Variables:</strong> Jangan hardcode credentials di code</li>
        <li>✅ <strong>HTTPS:</strong> Gunakan reverse proxy (nginx) dengan SSL</li>
        <li>✅ <strong>Firewall:</strong> Tutup port yang tidak diperlukan</li>
        <li>✅ <strong>Monitoring:</strong> Monitor logs secara berkala</li>
        <li>✅ <strong>Backup:</strong> Regular backup session dan configuration</li>
      </ul>
    </div>

    <h3>🚫 Jangan Commit ke Public Repository:</h3>
    <pre><code># Add to .gitignore

.env
.wwebjs_auth/
.session_backup/
logs/
\*.log</code></pre>

    <h3>🔑 Generate Strong API Key:</h3>
    <pre><code># Node.js

node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# OpenSSL

openssl rand -hex 32

# Python

python3 -c "import secrets; print(secrets.token_hex(32))"</code></pre>

  </div>

  <footer style="margin-top: 4rem; font-size: 0.9rem; color: #6b7280; text-align: center;">
    <p><strong>🚀 WhatsApp Web JS API - Optimized & Secure</strong></p>
    <p>Created by <strong>nurikhsanuddin</strong> | Powered by <code>whatsapp-web.js</code></p>
    <p>✨ Features: Session Persistence • Auto Backup • Security Enhanced • Performance Optimized</p>
    <p>📅 Last Updated: September 2024 | 🔄 Auto Restart: Weekly</p>
    <p><strong>⚠️ Repository ini menggunakan data dummy untuk keamanan. Sesuaikan konfigurasi untuk production.</strong></p>
  </footer>

</body>
</html>
