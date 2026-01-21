@echo off
REM Windows Script untuk Force Delete Session WhatsApp

echo ================================================
echo WhatsApp Session Manager - Windows
echo ================================================
echo.

if "%1"=="delete" goto delete
if "%1"=="restart" goto restart
if "%1"=="force-new" goto force_new
goto help

:delete
echo Menghapus session WhatsApp...
if exist ".wwebjs_auth" (
    rmdir /s /q .wwebjs_auth
    echo Session berhasil dihapus!
) else (
    echo Tidak ada session yang ditemukan.
)
goto end

:restart
echo Merestart PM2 dengan session baru...
call :delete
timeout /t 2 /nobreak >nul
pm2 restart wa-express
echo.
echo Silakan tunggu beberapa detik dan cek log:
echo pm2 logs wa-express
goto end

:force_new
echo Setting FORCE_NEW_SESSION dan restart...
set FORCE_NEW_SESSION=true
pm2 restart wa-express --update-env
echo.
echo Session akan dihapus saat startup.
echo Cek log: pm2 logs wa-express
goto end

:help
echo Penggunaan:
echo   session-manager.bat delete      - Hapus session manual
echo   session-manager.bat restart     - Hapus session dan restart PM2
echo   session-manager.bat force-new   - Set env dan restart (session dihapus otomatis)
echo.
echo Atau manual:
echo   1. Hapus folder: rmdir /s /q .wwebjs_auth
echo   2. Restart PM2: pm2 restart wa-express
echo   3. Cek log: pm2 logs wa-express
goto end

:end
echo.
echo ================================================
