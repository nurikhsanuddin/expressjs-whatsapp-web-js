<!DOCTYPE html>
<html lang="id">

<body>

  <h1>🚀 API WhatsApp Sender</h1>
  <p>API untuk mengirim pesan WhatsApp (teks & file) menggunakan <code>whatsapp-web.js</code> dan Express. Mendukung kirim pesan via <code>application/json</code> maupun <code>multipart/form-data</code>.</p>

  <div class="section">
    <h2>📦 Installasi</h2>
    <pre><code>npm install express dotenv multer whatsapp-web.js qrcode-terminal puppeteer</code></pre>
  </div>

  <div class="section">
    <h2>🔧 Setup</h2>
    <p>Buat file <code>.env</code>:</p>
    <pre><code>API_KEY=apikeymu123
PORT=3000</code></pre>
  </div>

  <div class="section">
    <h2>▶️ Menjalankan Aplikasi</h2>
    <p>Jalankan perintah ini:</p>
    <pre><code>node index.js</code></pre>
    <p>Akan muncul QR code di terminal, scan pakai WhatsApp HP kamu untuk login.</p>
  </div>

  <div class="section">
    <h2>📤 Kirim Pesan Teks <span class="tag">application/json</span></h2>
    <p><strong>Endpoint:</strong> <code>POST /send-message</code></p>
    <p><strong>Header:</strong> <code>bypass-apikey: apikeymu123</code></p>

    <p>Contoh body:</p>
    <pre><code>{
  "from": "081234567890",
  "to": "081234567891",
  "type": "text",
  "content": "Halo, ini pesan dari API!"
}</code></pre>
  </div>

  <div class="section">
    <h2>📎 Kirim File <span class="tag">multipart/form-data</span></h2>
    <p><strong>Field:</strong> <code>meta</code> dan <code>file</code></p>
    <p><strong>Contoh curl:</strong></p>
    <pre><code>curl -X POST http://localhost:3626/send-message \
  -H "bypass-apikey: apikeymu123" \
  -F 'meta={
    "from": "081234567890",
    "to": "081234567891",
    "type": "file"
  }' \
  -F "file=@/path/to/file.pdf"</code></pre>
  </div>

  <div class="section">
    <h2>💾 Session</h2>
    <p>Sesi login WhatsApp disimpan otomatis di folder <code>.wwebjs_auth</code> menggunakan <code>LocalAuth</code>. QR code hanya muncul saat login pertama.</p>
  </div>

  <div class="section">
    <h2>💡 Tips Tambahan</h2>
    <ul>
      <li>Gunakan <code>pm2</code> untuk menjalankan API di background:</li>
    </ul>
    <pre><code>npm install -g pm2
pm2 start index.js</code></pre>
    <ul>
      <li>Pastikan Chromium terpasang di server untuk Puppeteer:</li>
    </ul>
    <pre><code>sudo apt install -y chromium-browser</code></pre>
  </div>

  <footer style="margin-top: 4rem; font-size: 0.9rem; color: #6b7280;">
    nurikhsanuddin | Powered by <code>whatsapp-web.js</code>
  </footer>

</body>
</html>
