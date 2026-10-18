-- 立绘 / 背景路径修正
--
-- 之前存的是 '../../img/...'，这是按「脚本文件所在目录」算的。
-- 但浏览器把相对 URL 解析到「文档地址」即 http://host:5500/，
-- 于是 ../../ 从根目录又往上跳两级 → /img/... → 全部 404。
--
-- 正确写法：从站点根起算，即 assets/img/...
-- （客户端 UI.assetUrl 也会兜底剥掉 ../ 前缀，两层保险）

UPDATE characters SET avatar_url = 'assets/img/avatar/female-soft.svg'
 WHERE char_key = 'female';
UPDATE characters SET avatar_url = 'assets/img/avatar/male-soft.svg'
 WHERE char_key = 'male';