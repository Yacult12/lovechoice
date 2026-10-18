/**
 * 从零建库并导入全部数据，模拟 CI 与 Docker 初始化的完整流程
 *   node verify-bootstrap.js
 *
 * 起因：CI 第三次失败——
 *   ERROR 1048 (23000): Column 'route_id' cannot be null
 * 根因是仓库里从来没有创建 routes / characters 数据的脚本，
 * 这批数据当初是我在数据库里手工插的。
 * 结果是任何「从零建库」的流程都会失败 ——
 * 不只是 CI，Docker 首次初始化、换新机器，全都跑不起来。
 *
 * 本脚本会真的建一个临时库，按正确顺序导入所有 SQL，
 * 然后核对最终数据量。任何一步失败都能立刻暴露。
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SQL = path.join(ROOT, 'server', 'sql');
const TEST_DB = 'love_bootstrap_probe';

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}

/**
 * 导入顺序至关重要：
 *   schema.sql      建表
 *   base_data.sql   灌 routes + characters（full_story 依赖它）
 *   full_story.sql  灌章节与全部剧情
 *   expand_dialogue.sql  扩写台词
 *   avatars.sql     修正立绘路径
 */
const ORDER = [
  ['schema.sql', '建表'],
  ['base_data.sql', '基础数据（routes / characters）'],
  ['full_story.sql', '章节与剧情'],
  ['expand_dialogue.sql', '台词扩写'],
  ['avatars.sql', '立绘路径修正']
];

(async () => {
  console.log('\n=== 从零建库全流程验证 ===\n');
  console.log('  探测库: ' + TEST_DB + '（结束后删除，不碰 love 库）\n');

  // ---------- 1. 文件齐全性 ----------
  console.log('[1] SQL 文件齐全');
  ORDER.forEach(([f]) => {
    const p = path.join(SQL, f);
    check('存在 ' + f, fs.existsSync(p));
  });

  // base_data.sql 是这次新加的，必须在 full_story 之前
  const baseIdx = ORDER.findIndex(([f]) => f === 'base_data.sql');
  const storyIdx = ORDER.findIndex(([f]) => f === 'full_story.sql');
  check('base_data.sql 在 full_story.sql 之前执行',
    baseIdx >= 0 && storyIdx >= 0 && baseIdx < storyIdx,
    '顺序错了：full_story 查 routes 时会拿到 NULL');

  const c = await mysql.createConnection({
    host: '127.0.0.1', port: 3306, user: 'root', password: '123456', multipleStatements: true
  });

  // ---------- 2. 逐个导入 ----------
  console.log('\n[2] 依次导入');
  try {
    await c.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
    await c.query(`CREATE DATABASE \`${TEST_DB}\` DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await c.query(`USE \`${TEST_DB}\``);
    pass++;
    console.log('  ✓ 创建空库 ' + TEST_DB);
  } catch (err) {
    fail++;
    console.log('  ✗ 建库失败: ' + err.message);
    await c.end();
    process.exit(1);
  }

  for (const [file, desc] of ORDER) {
    const sql = fs.readFileSync(path.join(SQL, file), 'utf8');
    try {
      await c.query(sql);
      pass++;
      console.log(`  ✓ ${file.padEnd(22)} ${desc}`);
    } catch (err) {
      fail++;
      console.log(`  ✗ ${file.padEnd(22)} ${desc}`);
      console.log('    ' + err.message);
      console.log('    sqlState=' + err.sqlState + ' errno=' + err.errno);
      // 报出出错行附近的内容，便于定位
      const m = /at line (\d+)/.exec(err.message);
      if (m) {
        const lines = sql.split('\n');
        const ln = Number(m[1]);
        console.log('    出错行 ' + ln + ' 附近:');
        for (let i = Math.max(0, ln - 2); i < Math.min(lines.length, ln + 1); i++) {
          console.log('      ' + (i + 1) + ': ' + (lines[i] || '').slice(0, 90));
        }
      }
      break;
    }
  }

  // ---------- 3. 数据完整性 ----------
  console.log('\n[3] 数据完整性');
  const counts = {};
  const q = async (sql) => {
    const [r] = await c.query(sql);
    return Number(r[0].n);
  };

  const EXPECT = {
    routes: 2, chapters: 10, scene_nodes: 65, choices: 33, endings: 8, characters: 4
  };

  try {
    for (const [t, want] of Object.entries(EXPECT)) {
      counts[t] = await q(`SELECT COUNT(*) AS n FROM \`${t}\``);
      check(`${t.padEnd(13)} = ${String(counts[t]).padStart(3)}（期望 ${want}）`,
        counts[t] === want, '实际 ' + counts[t]);
    }
  } catch (err) {
    fail++;
    console.log('  ✗ 统计失败: ' + err.message);
  }

  // ---------- 4. 关键完整性：没有孤儿数据 ----------
  console.log('\n[4] 关联完整性');
  try {
    const orphans = await q(
      `SELECT COUNT(*) AS n FROM scene_nodes sn
         JOIN chapters c ON c.id = sn.chapter_id
        WHERE c.route_id IS NULL`
    );
    check('无 chapter 的 route_id 为空', orphans === 0, '孤儿节点 ' + orphans);

    // 注意 routes 表本身没有 route_id 字段（主键就是 id），
    // 早先在这里写 WHERE route_id IS NULL 会直接报 Unknown column。
    const nullId = await q(`SELECT COUNT(*) AS n FROM routes WHERE id IS NULL`);
    check('routes 表无 NULL 主键', nullId === 0);

    const chWithRoute = await q(
      `SELECT COUNT(*) AS n FROM chapters c JOIN routes r ON r.id = c.route_id`
    );
    check('所有章节都挂到了路由上', chWithRoute === counts.chapters,
      chWithRoute + ' / ' + counts.chapters);

    // 每条线章节数
    const [perRoute] = await c.query(
      `SELECT r.route_code, COUNT(c.id) AS n
         FROM routes r LEFT JOIN chapters c ON c.route_id = r.id
        GROUP BY r.route_code ORDER BY r.route_code`
    );
    perRoute.forEach((r) => {
      check(`${r.route_code} 线 5 章`, Number(r.n) === 5, '实际 ' + r.n);
    });

    // 立绘路径必须是 assets/ 开头（不是 ../../img/）
    const [badAvatar] = await c.query(
      `SELECT COUNT(*) AS n FROM characters WHERE avatar_url LIKE '../%'`
    );
    check('立绘路径无 ../../ 越界写法', Number(badAvatar[0].n) === 0,
      'avatars.sql 可能没跑到');

    const [avatars] = await c.query(
      `SELECT COUNT(*) AS n FROM characters WHERE avatar_url LIKE 'assets/%'`
    );
    check('立绘路径已修正为 assets/ 开头', Number(avatars[0].n) >= 4,
      '实际 ' + avatars[0].n);

  } catch (err) {
    fail++;
    console.log('  ✗ 完整性检查失败: ' + err.message);
  }

  // ---------- 5. 服务端依赖的查询能否跑通 ----------
  console.log('\n[5] 服务端关键查询');
  try {
    // playService 靠这个拿章节首节点
    const [startNodes] = await c.query(
      `SELECT c.chapter_no, c.title, sn.node_key, sn.node_type
         FROM chapters c
         LEFT JOIN scene_nodes sn ON sn.node_key = c.start_node AND sn.chapter_id = c.id
        WHERE c.chapter_no = 1 ORDER BY c.route_id`
    );
    check('每条线第 1 章都能找到 start_node',
      startNodes.filter((r) => r.node_key).length >= 2,
      '查到 ' + startNodes.length + ' 章，其中 ' +
      startNodes.filter((r) => r.node_key).length + ' 章有节点');

    const [choiceTargets] = await c.query(
      `SELECT COUNT(*) AS n FROM choices ch
         JOIN scene_nodes n ON n.id = ch.node_id
        WHERE ch.next_node_key IS NULL OR ch.next_node_key = ''`
    );
    check('所有选项都指向了后继节点',
      Number(choiceTargets[0].n) === 0, '有 ' + choiceTargets[0].n + ' 个选项缺后继');

  } catch (err) {
    fail++;
    console.log('  ✗ 关键查询失败: ' + err.message);
  }

  // ---------- 清理 ----------
  await c.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
  await c.end();
  console.log('\n  （探测库已删除，love 库未受影响）');

  console.log('\n' + '='.repeat(52));
  console.log(fail === 0
    ? `  全部通过 ${pass} 项 ✅ 从零建库可行`
    : `  通过 ${pass} / 失败 ${fail}`);
  console.log('='.repeat(52));
  process.exit(fail ? 1 : 0);
})();