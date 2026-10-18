# ============================================================
#   LoveChoice · 一键部署
#
#   用法：
#     首次    docker compose up -d --build
#     之后    docker compose up -d
#     看日志  docker compose logs -f backend
#     停止    docker compose down
#     彻底删  docker compose down -v      ← 连数据库一起删，慎用
#
#   浏览器打开 http://localhost:8080
# ============================================================

@echo off
chcp 65001 > nul
setlocal

cd /d "%~dp0"

echo ============================================
echo    LoveChoice · 拣爱
echo ============================================
echo.

REM ---------- 检查 Docker ----------
docker --version > nul 2>&1
if errorlevel 1 (
  echo [错误] 没找到 Docker。
  echo        请先安装 Docker Desktop: https://www.docker.com/products/docker-desktop/
  echo        Windows 安装后需要重启一次。
  echo.
  pause
  exit /b 1
)

docker compose version > nul 2>&1
if errorlevel 1 (
  echo [错误] Docker Compose 不可用。
  echo        请升级 Docker Desktop 到较新版本。
  echo.
  pause
  exit /b 1
)

REM ---------- 检查端口占用 ----------
echo [1/4] 检查端口占用...
call :checkport 8080 WEB_PORT
call :checkport 3306 DB_PORT
call :checkport 3000 BACKEND_PORT

REM ---------- 生成生产密钥 ----------
echo.
echo [2/4] 检查生产配置...
if not exist ".env" (
  echo        .env 不存在，正在从模板生成...
  if exist ".env.docker.example" (
    copy ".env.docker.example" ".env" > nul
    echo        已生成 .env
  ) else (
    echo        [提示] 未找到 .env.docker.example，将使用 compose 内的默认值。
    echo               强烈建议先执行 deploy.bat 一键生成随机密钥。
  )
)

REM ---------- 启动 ----------
echo.
echo [3/4] 构建并启动容器...
docker compose up -d --build
if errorlevel 1 (
  echo.
  echo [失败] 启动失败，请查看日志：docker compose logs
  echo.
  pause
  exit /b 1
)

REM ---------- 等待健康 ----------
echo.
echo [4/4] 等待服务就绪...
set /a TRIES=0
:waitloop
set /a TRIES+=1
docker compose exec -T backend wget --quiet --tries=1 --spider http://127.0.0.1:3000/api/health > nul 2>&1
if not errorlevel 1 goto ready
if !TRIES! gtr 30 (
  echo        等待超时，请查看日志：docker compose logs backend
  goto done
)
timeout /t 2 /nobreak > nul
goto waitloop

:ready
echo        后端已就绪！

:done
echo.
echo ============================================
echo    启动完成
echo ============================================
echo.
echo    游戏地址   http://localhost:%WEB_PORT%
echo    健康检查   http://localhost:%WEB_PORT%/api/health
echo.
echo    常用命令:
echo      docker compose logs -f backend    查看后端日志
echo      docker compose down               停止服务
echo      docker compose down -v            停止并删除数据
echo.
pause
exit /b 0

REM ---------- 子程序：检查端口是否被占用 ----------
:checkport
setlocal enabledelayedexpansion
set "PORT=%~1"
set "NAME=%~2"
netstat -an | findstr /r /c:":%PORT% .*LISTENING" > nul 2>&1
if not errorlevel 1 (
  echo        [警告] 端口 %PORT% (%NAME%) 已被占用。
  echo               如果是本项目之前留下的容器，忽略即可；
  echo               否则请改 docker-compose.yml 里对应的端口映射。
)
endlocal
exit /b 0