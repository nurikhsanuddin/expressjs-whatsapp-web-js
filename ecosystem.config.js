module.exports = {
  apps: [
    {
      name: "wa-express",
      script: "index.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "300M", // Dinaikkan sedikit untuk stabilitas
      env: {
        NODE_ENV: "production", // Override untuk production
        // Semua konfigurasi lain sudah ada di .env file
      },
      // Optimasi PM2 untuk server yang stabil
      node_args: "--max-old-space-size=256 --gc-interval=100",
      kill_timeout: 10000, // Diperpanjang untuk graceful shutdown
      wait_ready: true, // Menunggu process.send("ready") dari index.js
      listen_timeout: 30000, // Diperpanjang untuk WhatsApp initialization
      max_restarts: 10, // Lebih toleran terhadap restart
      min_uptime: "60s", // Minimal uptime sebelum dianggap stabil
      exec_mode: "fork",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      exp_backoff_restart_delay: 500, // Delay restart bertahap
      // Restart mingguan saja, bukan harian (untuk menghindari scan QR berulang)
      cron_restart: "0 3 * * 0", // Restart Minggu jam 3 pagi saja
      restart_delay: 2000, // Delay restart lebih lama
      // Pengaturan untuk server
      ignore_watch: [
        "node_modules",
        ".git",
        ".wwebjs_auth",
        "logs",
        ".session_backup",
      ],
      treekill: true, // Untuk Linux/Unix
      source_map_support: false,
      pmx: false, // Disable PMX jika tidak perlu monitoring
      // Opsi tambahan untuk stabilitas session
      error_file: "logs/wa-express-error.log",
      out_file: "logs/wa-express-out.log",
      log_file: "logs/wa-express-combined.log",
      time: true,
    },
  ],
};
