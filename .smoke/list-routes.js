/**
 * 枚举 Express 实际注册的所有路由
 *   node list-routes.js
 */
const app = require('../server/src/app.js').createApp();

const out = [];

function walk(stack, prefix) {
  for (const layer of stack) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).filter((m) => m !== '_all').map((m) => m.toUpperCase());
      methods.forEach((m) => out.push(`${m.padEnd(6)} ${prefix}${layer.route.path}`));
    } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      let seg = '';
      if (layer.regexp && layer.regexp.source) {
        const s = layer.regexp.source;
        const m = s.match(/^\^\\\/(?:([^\\\^$?|()[\]{}]+))/);
        if (m) seg = m[1].replace('\\/', '/');
      }
      walk(layer.handle.stack, prefix + seg);
    }
  }
}

// Express 4：路由栈在 app._router
const root = app._router;
if (root && root.stack) {
  walk(root.stack, '');
} else {
  console.log('无法访问路由栈，app keys =', Object.keys(app));
}

out.sort();
console.log(`\n共 ${out.length} 个路由：\n`);
out.forEach((r) => console.log('  ' + r));