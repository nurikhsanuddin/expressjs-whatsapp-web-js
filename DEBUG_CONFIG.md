# 🐛 Debug Mode Configuration Guide

## 🔧 **Konfigurasi ALLOWED_IPS untuk Debugging**

### **✅ YA, Anda bisa menggunakan `ALLOWED_IPS=*` untuk debugging!**

## 📋 **Berbagai Mode Konfigurasi**

### **1. Debug Mode - Allow All IPs:**

```env
DEBUG_MODE=true
DISABLE_IP_WHITELIST_IN_DEBUG=true
ALLOWED_IPS=*
RATE_LIMIT_ENABLED=false          # Optional: disable rate limit juga
ENABLE_API_LOGGING=true           # Keep logging untuk monitoring
```

### **2. Development Mode - Specific IPs:**

```env
DEBUG_MODE=false
ALLOWED_IPs=127.0.0.1,localhost,192.168.1.100,10.0.0.1
RATE_LIMIT_ENABLED=true
MAX_REQUESTS_PER_MINUTE=120       # Lebih longgar untuk testing
```

### **3. Production Mode - Sangat Terbatas:**

```env
DEBUG_MODE=false
ALLOWED_IPS=127.0.0.1,localhost
RATE_LIMIT_ENABLED=true
MAX_REQUESTS_PER_MINUTE=60
```

---

## 🛡️ **Fitur Keamanan dengan Debug Support**

### **Auto Debug Detection:**

Sistem sekarang mendukung:

- **DEBUG_MODE=true** - Mengaktifkan mode debugging
- **DISABLE_IP_WHITELIST_IN_DEBUG=true** - Bypass IP whitelist saat debug
- **Logging tetap aktif** - Semua akses tetap tercatat meski debug mode

### **Contoh Log saat Debug Mode:**

```
[SECURITY] IP Whitelist disabled - DEBUG MODE active
[SECURITY] IP_WHITELIST_BYPASSED_DEBUG: 192.168.1.50 POST /send-message
[SECURITY] IP_ALLOWED_WILDCARD: 203.0.113.10 GET /status
```

---

## 🚀 **Cara Switching Mode**

### **Untuk Debugging (Temporary):**

```bash
# Edit .env
DEBUG_MODE=true
DISABLE_IP_WHITELIST_IN_DEBUG=true
ALLOWED_IPS=*

# Restart aplikasi
pm2 restart wa-express
```

### **Kembali ke Production:**

```bash
# Edit .env
DEBUG_MODE=false
DISABLE_IP_WHITELIST_IN_DEBUG=false
ALLOWED_IPS=127.0.0.1,localhost

# Restart aplikasi
pm2 restart wa-express
```

---

## ⚠️ **Security Best Practices**

### **1. Temporary Debug Only:**

```env
# ❌ JANGAN untuk production
ALLOWED_IPS=*

# ✅ Gunakan untuk debugging sementara saja
# ✅ Segera kembalikan ke IP spesifik setelah selesai debug
```

### **2. Monitor Logs saat Debug:**

```bash
# Monitor real-time logs
pm2 logs wa-express

# Check security logs
tail -f logs/security.log
```

### **3. Alternative Debugging Methods:**

```env
# Opsi A: Allow subnet lokal saja
ALLOWED_IPS=192.168.1.0/24,10.0.0.0/8,127.0.0.1

# Opsi B: Add specific IP untuk testing
ALLOWED_IPS=127.0.0.1,localhost,YOUR_TESTING_IP

# Opsi C: Temporarily disable rate limit tapi keep IP restriction
RATE_LIMIT_ENABLED=false
ALLOWED_IPS=127.0.0.1,localhost,192.168.1.100
```

---

## 🔍 **Testing & Verification**

### **Test IP Whitelist:**

```bash
# Test dari IP yang diizinkan
curl -H "bypass-apikey: YOUR_API_KEY" http://your-server:3626/status

# Test dari IP yang tidak diizinkan (jika tidak debug mode)
# Harus dapat 403 Forbidden
```

### **Verify Debug Mode Active:**

```bash
# Check logs untuk konfirmasi debug mode
pm2 logs wa-express | grep "DEBUG MODE"

# Output expected:
# [SECURITY] IP Whitelist disabled - DEBUG MODE active
```

### **Check Security Logs:**

```bash
# Lihat semua akses yang tercatat
tail -n 50 logs/security.log

# Filter hanya event tertentu
grep "IP_ALLOWED" logs/security.log
grep "IP_BLOCKED" logs/security.log
```

---

## 📝 **Quick Commands**

### **Enable Debug Mode:**

```bash
# Edit .env file
sed -i 's/DEBUG_MODE=false/DEBUG_MODE=true/' .env
sed -i 's/DISABLE_IP_WHITELIST_IN_DEBUG=false/DISABLE_IP_WHITELIST_IN_DEBUG=true/' .env

# Restart app
pm2 restart wa-express
```

### **Disable Debug Mode:**

```bash
# Edit .env file
sed -i 's/DEBUG_MODE=true/DEBUG_MODE=false/' .env
sed -i 's/ALLOWED_IPS=\*/ALLOWED_IPS=127.0.0.1,localhost/' .env

# Restart app
pm2 restart wa-express
```

---

## 🎯 **Kesimpulan**

**✅ YA, Anda bisa menggunakan `ALLOWED_IPS=*` untuk debugging**

**Tapi dengan catatan:**

1. **Hanya untuk debugging sementara**
2. **Monitoring logs tetap aktif**
3. **Segera kembalikan ke production setting**
4. **Gunakan DEBUG_MODE untuk kontrol yang lebih baik**

**🛡️ Dengan konfigurasi ini, debugging jadi mudah tapi tetap aman!**
