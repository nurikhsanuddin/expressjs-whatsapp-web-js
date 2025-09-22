#!/bin/bash
# Script untuk mengelola aplikasi WhatsApp Web JS di server Ubuntu

# Warna untuk output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fungsi untuk menampilkan pesan
print_message() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Verifikasi bahwa chromium terinstall
check_chromium() {
  print_message "Memeriksa instalasi Chromium..."
  
  CHROMIUM_PATH=$(which chromium 2>/dev/null || which chromium-browser 2>/dev/null)
  
  if [ -z "$CHROMIUM_PATH" ]; then
    print_error "Chromium tidak ditemukan! Menginstal Chromium..."
    
    # Coba install chromium via snap
    sudo apt update
    sudo apt install -y snapd
    sudo snap install chromium
    
    CHROMIUM_PATH=$(which chromium 2>/dev/null || which chromium-browser 2>/dev/null)
    
    if [ -z "$CHROMIUM_PATH" ]; then
      print_error "Gagal menginstal Chromium. Silakan install manual."
      exit 1
    fi
  fi
  
  print_message "Chromium ditemukan di: $CHROMIUM_PATH"
  
  # Update .env file dengan path chromium yang benar
  if grep -q "CHROME_PATH=" .env; then
    sed -i "s|CHROME_PATH=.*|CHROME_PATH=$CHROMIUM_PATH|g" .env
    print_message "File .env diperbarui dengan path Chromium: $CHROMIUM_PATH"
  else
    echo "CHROME_PATH=$CHROMIUM_PATH" >> .env
    print_message "Path Chromium ditambahkan ke file .env"
  fi
}

# Instal dependensi yang diperlukan
install_dependencies() {
  print_message "Menginstal dependensi sistem..."
  
  # Dependensi untuk Puppeteer pada Ubuntu/Debian
  sudo apt-get update
  sudo apt-get install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 \
    libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 \
    libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
    libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 \
    ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget
  
  print_message "Dependensi sistem terinstal."
  
  # Instal dependensi Node.js
  print_message "Menginstal dependensi Node.js..."
  npm install
  
  # Install express-rate-limit untuk security enhancement
  print_message "Menginstal dependensi keamanan..."
  npm install express-rate-limit
  
  print_message "Dependensi Node.js terinstal."
  
  # Instal PM2 secara global jika belum ada
  if ! command -v pm2 &> /dev/null; then
    print_message "Menginstal PM2 secara global..."
    npm install -g pm2
  fi
}

# Memulai aplikasi dengan PM2
start_app() {
  print_message "Memulai aplikasi dengan PM2..."
  
  # Cek apakah aplikasi sudah berjalan
  if pm2 list | grep -q "wa-express"; then
    print_warning "Aplikasi sudah berjalan. Melakukan restart..."
    pm2 restart wa-express
  else
    # Jalankan aplikasi
    pm2 start ecosystem.config.js
  fi
  
  # Setup PM2 untuk start saat boot
  print_message "Mengatur PM2 untuk start otomatis saat server reboot..."
  pm2 save
  
  if ! pm2 startup | grep -q "already"; then
    pm2 startup
  fi
  
  print_message "Aplikasi berhasil dimulai. Gunakan 'pm2 logs wa-express' untuk melihat log."
}

# Menampilkan QR Code
show_qr() {
  print_message "Melihat log untuk QR Code..."
  pm2 logs wa-express --lines 100
}

# Periksa status aplikasi
check_status() {
  print_message "Status aplikasi:"
  pm2 status wa-express
}

# Restart aplikasi
restart_app() {
  print_message "Merestart aplikasi..."
  pm2 restart wa-express
  print_message "Aplikasi berhasil direstart."
}

# Stop aplikasi
stop_app() {
  print_message "Menghentikan aplikasi..."
  pm2 stop wa-express
  print_message "Aplikasi berhasil dihentikan."
}

# Menampilkan bantuan
show_help() {
  echo "Penggunaan: $0 [perintah]"
  echo "Perintah:"
  echo "  install     - Verifikasi Chromium dan instal dependensi"
  echo "  start       - Mulai aplikasi dengan PM2"
  echo "  stop        - Hentikan aplikasi"
  echo "  restart     - Restart aplikasi"
  echo "  status      - Periksa status aplikasi"
  echo "  logs        - Tampilkan log aplikasi (berguna untuk melihat QR code)"
  echo "  cleanup     - Bersihkan file cache sesi"
  echo "  backup      - Backup session files penting"
  echo "  monitor     - Monitor penggunaan sumber daya"
  echo "  help        - Tampilkan bantuan ini"
}

# Membersihkan file cache
cleanup() {
  print_message "Membersihkan file cache sesi..."
  node utils.js cleanup
}

# Backup session files
backup_session() {
  print_message "Backup session files..."
  node utils.js backup
}

# Memonitor penggunaan sumber daya
monitor_resources() {
  print_message "Memonitor penggunaan sumber daya..."
  node utils.js monitor
}

# Main function
main() {
  case "$1" in
    "install")
      check_chromium
      install_dependencies
      ;;
    "start")
      start_app
      ;;
    "stop")
      stop_app
      ;;
    "restart")
      restart_app
      ;;
    "status")
      check_status
      ;;
    "logs")
      show_qr
      ;;
    "cleanup")
      cleanup
      ;;
    "backup")
      backup_session
      ;;
    "monitor")
      monitor_resources
      ;;
    "help"|"")
      show_help
      ;;
    *)
      print_error "Perintah tidak dikenal: $1"
      show_help
      exit 1
      ;;
  esac
}

# Run main function
main "$@"
