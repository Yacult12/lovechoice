<#
  清理 Steam++（Watt Toolkit）写入的 hosts 屏蔽记录

  作用
    删除 hosts 里 # Steam++ Start 到 # Steam++ End 之间的全部内容，
    保留其他所有条目（Docker、localhost 等不受影响）。

  安全性
    - 修改前自动备份，出错可一键还原
    - 只删带 Steam++ 标记的那一段，不碰其他内容
    - 需要管理员权限才能写入 hosts

  用法
    右键本文件 → 以管理员身份运行
#>

$ErrorActionPreference = 'Stop'

Write-Host ''
Write-Host '============================================================'
Write-Host '  清理 Steam++ 写入的 hosts 屏蔽记录'
Write-Host '============================================================'
Write-Host ''
Write-Host '  将删除：# Steam++ Start ~ # Steam++ End 之间的全部内容'
Write-Host '  保留  ：其他所有条目（Docker、localhost 等）'
Write-Host ''

# ---------- 权限检查 ----------
$id = [Security.Principal.WindowsIdentity]::GetCurrent()
$isAdmin = (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host '  [X] 需要管理员权限！' -ForegroundColor Red
    Write-Host ''
    Write-Host '  请右键点击本文件，选择「以管理员身份运行」' -ForegroundColor Yellow
    Write-Host ''
    pause
    exit 1
}

$hostsPath = Join-Path $env:SystemRoot 'System32\drivers\etc\hosts'

if (-not (Test-Path $hostsPath)) {
    Write-Host "  [X] 找不到 hosts 文件：$hostsPath" -ForegroundColor Red
    pause
    exit 1
}

# ---------- 备份 ----------
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = "$hostsPath.bak-$stamp"

try {
    Copy-Item $hostsPath $backup -Force
    Write-Host "  [1/4] 已备份到 hosts.bak-$stamp" -ForegroundColor Green
} catch {
    Write-Host '  [X] 备份失败，未做任何修改' -ForegroundColor Red
    Write-Host "     $($_.Exception.Message)"
    pause
    exit 1
}

# ---------- 读取并处理 ----------
# 用 UTF8 读写。hosts 通常是 ANSI，但内容全是 ASCII 域名，
# 按 UTF8 读不会丢东西，且写回时不会被加上 BOM。
$raw = Get-Content $hostsPath -Encoding UTF8
$kept = New-Object System.Collections.Generic.List[string]
$inside = $false
$removed = 0

foreach ($line in $raw) {
    if ($line -match '^\s*#\s*Steam\+\+\s*Start') { $inside = $true; continue }
    if ($line -match '^\s*#\s*Steam\+\+\s*End')   { $inside = $false; continue }
    if ($inside) { $removed++; continue }
    $kept.Add($line)
}

if ($removed -eq 0) {
    Write-Host '  [!] 没有找到 Steam++ 段，可能已经清理过了' -ForegroundColor Yellow
    Remove-Item $backup -Force -ErrorAction SilentlyContinue
    Write-Host ''
    pause
    exit 0
}

Write-Host "  [2/4] 找到 $removed 行属于 Steam++ 段，将删除"
Write-Host "        保留 $($kept.Count) 行"

# ---------- 写入 ----------
try {
    # -NoNewline 逐行写回，避免结尾多出空行
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($hostsPath, (($kept -join "`r`n") + "`r`n"), $utf8NoBom)
    Write-Host '  [3/4] 写入完成' -ForegroundColor Green
} catch {
    Write-Host '  [X] 写入失败' -ForegroundColor Red
    Write-Host "     $($_.Exception.Message)"
    Write-Host "     hosts 未被修改，备份在 hosts.bak-$stamp" -ForegroundColor Yellow
    pause
    exit 1
}

# ---------- 刷新 DNS ----------
Write-Host '  [4/4] 刷新 DNS 缓存'
Start-Process ipconfig -ArgumentList '/flushdns' -Wait -WindowStyle Hidden

Write-Host ''
Write-Host '------------------------------------------------------------'
Write-Host '  验证'
Write-Host '------------------------------------------------------------'
Write-Host ''

# 内容校验
$after = Get-Content $hostsPath -Raw -Encoding UTF8

$checks = @(
    @{ Name = 'Steam++ 标记已清除'; Pass = ($after -notmatch 'Steam\+\+') }
    @{ Name = 'github.com 已移除';   Pass = ($after -notmatch 'github\.com') }
    @{ Name = 'Docker 记录已保留';   Pass = ($after -match 'Docker Desktop') }
    @{ Name = 'localhost 未被破坏'; Pass = ($after -match 'localhost name resolution') }
)

foreach ($c in $checks) {
    if ($c.Pass) {
        Write-Host "  [OK] $($c.Name)" -ForegroundColor Green
    } else {
        Write-Host "  [!] $($c.Name)" -ForegroundColor Yellow
    }
}

# 解析验证
Write-Host ''
Write-Host '  测试 github.com 解析...'
Start-Sleep -Seconds 1
try {
    $ips = [Net.Dns]::GetHostAddresses('github.com')
    $real = $ips | Where-Object { $_.IPAddressToString -ne '127.0.0.1' }
    if ($real) {
        Write-Host "  [OK] 已解析到真实 IP：$($real[0].IPAddressToString)" -ForegroundColor Green
    } else {
        Write-Host '  [!] 仍解析到 127.0.0.1' -ForegroundColor Yellow
        Write-Host '      可能还有其他工具在干扰（见下方说明）' -ForegroundColor DarkGray
    }
} catch {
    Write-Host "  [!] 解析失败：$($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ''
Write-Host '============================================================'
Write-Host '  完成'
Write-Host '============================================================'
Write-Host ''
Write-Host '  备份文件：hosts.bak-' + $stamp
Write-Host ''
Write-Host '  如果 GitHub 仍无法访问，按顺序检查：'
Write-Host '   1. 奇游 / UU 加速器是否在运行并启用了 Hosts 代理'
Write-Host '      —— 这类工具退出时会重新写入屏蔽记录'
Write-Host '   2. 浏览器可能缓存了旧 DNS，重启浏览器再试'
Write-Host '   3. 奇游安装了内核过滤驱动 JYNetFilter8.sys，'
Write-Host '      若仍被劫持，在「设备管理器 → 非即插即用驱动程序」'
Write-Host '      中禁用 JYNetFilter'
Write-Host ''
Write-Host '  如需还原，用管理员权限把备份复制回 hosts：'
Write-Host "    copy /y `"$backup`" `"$hostsPath`""
Write-Host ''
pause