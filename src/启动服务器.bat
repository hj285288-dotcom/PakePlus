@echo off
echo ========================================
echo   Moen Tech 电机数据库管理服务器
echo ========================================
echo.
echo 启动后请在 Firefox 中打开:
echo   http://localhost:3456/motor-db.html
echo.
echo 按 Ctrl+C 停止服务器
echo ========================================
echo.
cd /d "%~dp0"
node server.js
pause