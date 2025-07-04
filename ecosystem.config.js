module.exports = {
  apps: [
    {
      name: "wa-express",
      script: "index.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 3626,
      },
      // Pengaturan khusus PM2 untuk kinerja lebih baik
      node_args: "--max-old-space-size=256", // Batasi memory heap Node.js
      kill_timeout: 5000, // Beri waktu 5 detik untuk graceful shutdown
      wait_ready: true, // Tunggu hingga aplikasi mengirim sinyal "ready"
      listen_timeout: 15000, // Tunggu 15 detik sampai aplikasi siap
      max_restarts: 10, // Batasi jumlah restart otomatis
      // Capture dan log semua output
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      // Pengaturan CPU dan memori tambahan
      exp_backoff_restart_delay: 100, // Delay sebelum restart jika gagal (ms)
      cron_restart: "0 3 * * *", // Restart otomatis setiap hari jam 3 pagi
      restart_delay: 2000, // Delay antara restart (ms)
      // Optimasi sumber daya PM2
      min_uptime: "60s", // Aplikasi harus berjalan setidaknya 60 detik untuk dianggap stabil
      listen_timeout: 10000, // Waktu (ms) untuk menganggap aplikasi berhasil start
      max_memory_restart: "400M", // Restart jika memori di atas 400MB
    },
  ],
};
