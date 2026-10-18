'use strict';

const config = require('./config');
const db = require('./config/db');
const { createApp } = require('./app');

const REQUIRED_TABLES = [
  'users',
  'routes',
  'characters',
  'chapters',
  'scene_nodes',
  'choices',
  'saves',
  'choice_logs',
  'endings',
  'user_endings',
];

/**
 * 启动前自检：连不上库、缺表都只告警，不阻止进程启动（方便先起服务再补数据）。
 */
async function preflight() {
  try {
    await db.ping();

    const rows = await db.query(
      `SELECT table_name AS name FROM information_schema.tables WHERE table_schema = ?`,
      [config.db.database]
    );
    const existing = new Set(rows.map((r) => String(r.name || r.NAME || '').toLowerCase()));
    const missing = REQUIRED_TABLES.filter((t) => !existing.has(t));

    if (missing.length) {
      console.warn(
        `[db] 数据库 "${config.db.database}" 缺少表: ${missing.join(', ')}\n` +
          '     → 请确认 .env 里的 DB_NAME 正确（脚本里写的是 lovechoice），并执行建表语句。'
      );
      return false;
    }

    console.log(`[db] 已连接 ${config.db.host}:${config.db.port}/${config.db.database}，共 ${existing.size} 张表`);
    return true;
  } catch (err) {
    console.warn(`[db] 连接失败: ${err.message}`);
    console.warn('     → 请确认 MySQL 已启动、账号密码（root/123456）与 DB_NAME 配置正确。');
    return false;
  }
}

async function main() {
  await preflight();

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log('');
    console.log('  他们的故事 · 后端服务已启动');
    console.log(`  环境:   ${config.env}`);
    console.log(`  地址:   http://127.0.0.1:${config.port}`);
    console.log(`  健康:   http://127.0.0.1:${config.port}/api/health`);
    console.log(`  数据库: ${config.db.user}@${config.db.host}:${config.db.port}/${config.db.database}`);
    console.log('');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[server] 端口 ${config.port} 已被占用，请修改 .env 里的 PORT`);
      process.exit(1);
    }
    console.error('[server] 启动失败:', err);
    process.exit(1);
  });

  const shutdown = (signal) => async () => {
    console.log(`\n[server] 收到 ${signal}，正在优雅退出...`);
    server.close(async () => {
      try {
        await db.close();
      } catch (err) {
        console.error('[server] 关闭数据库连接池失败:', err.message);
      }
      process.exit(0);
    });
    // 兜底：10 秒内没退干净就强杀
    setTimeout(() => process.exit(0), 10000).unref();
  };

  process.on('SIGINT', shutdown('SIGINT'));
  process.on('SIGTERM', shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    console.error('[server] 未处理的 Promise 拒绝:', reason);
  });
}

main().catch((err) => {
  console.error('[server] 启动异常:', err);
  process.exit(1);
});
