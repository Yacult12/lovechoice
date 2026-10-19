@echo off
chcp 65001 > nul
title 清理 Steam++ hosts 屏蔽记录

REM ============================================================
REM  自动提权启动器
REM  双击本文件即可 —— 会弹出 UAC 请求管理员权限，
REM  然后自动用管理员权限运行同目录下的 PowerShell 脚本。
REM ============================================================

set SCRIPT=%~dp0Clean-SteamPlusHosts.ps1

if not exist "%SCRIPT%" (
    echo [X] 找不到 %SCRIPT%
    echo     请确保两个文件在同一个目录。
    pause
    exit /b 1
)

REM 已在管理员权限下则直接运行
net session >nul 2>&1
if %errorlevel% == 0 (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"
    exit /b %errorlevel%
)

REM 否则请求提权
echo.
echo  即将请求管理员权限...
echo.

powershell -NoProfile -Command ^
  "Start-Process PowerShell -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','\"%SCRIPT%\"'"

if errorlevel 1 (
    echo.
    echo [X] 提权被取消或失败
    echo     请右键本文件，选择「以管理员身份运行」
) else (
    echo.
    echo 已在管理员窗口中启动，请到那个窗口查看结果。
)

echo.
pause