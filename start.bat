@echo off
chcp 65001 > nul
setlocal

echo ============================================
echo   拣爱 LoveChoice - 一键启动
echo ============================================
echo.

cd /d "%~dp0server"

if not exist node_modules (
  echo [1/3] 安装后端依赖...
  call npm install
)

echo [1/3] 检查数据库...
call npm run db:check

echo.
echo [2/3] 启动后端 (端口 3000)...
start "LoveChoice-API" cmd /k "cd /d "%~dp0server" && npm start"

timeout /t 3 /nobreak > nul

cd /d "%~dp0client"

echo [3/3] 启动前端 (端口 5500)...
start "LoveChoice-Web" cmd /k "cd /d "%~dp0client" && npx --yes serve -l 5500 ."

timeout /t 3 /nobreak > nul

start "" http://127.0.0.1:5500/

echo.
echo ============================================
echo   全部就绪，浏览器应已自动打开
echo   前端: http://127.0.0.1:5500/
echo   后端: http://127.0.0.1:3000/api/health
echo   关闭两个新开的命令行窗口即可停止服务
echo ============================================

endlocal