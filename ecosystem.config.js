module.exports = {
  apps: [
    {
      name: "wa-express",
      script: "index.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "250M", // Sesuaikan dengan server Ubuntu
      env: {
        NODE_ENV: "production", // Override untuk production
        // Semua konfigurasi lain sudah ada di .env file
      },
      // Optimasi PM2 untuk Ubuntu server
      node_args: "--max-old-space-size=128 --gc-interval=100",
      kill_timeout: 5000, // Sinkron dengan gracefulShutdown timeout
      wait_ready: true, // Menunggu process.send("ready") dari index.js
      listen_timeout: 15000, // Diperpanjang untuk WhatsApp initialization
      max_restarts: 5,
      min_uptime: "30s",
      exec_mode: "fork",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      exp_backoff_restart_delay: 200,
      cron_restart: "0 2 * * *", // Restart jam 2 pagi
      restart_delay: 1000,
      // Pengaturan untuk Ubuntu server
      ignore_watch: ["node_modules", ".git", ".wwebjs_auth", "logs"],
      treekill: true, // Untuk Linux
      source_map_support: false,
      pmx: false, // Disable PMX jika tidak perlu monitoring
    },
  ],
};
