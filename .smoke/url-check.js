const base = 'http://127.0.0.1:5500/';
console.log('DB 存的 ../../img/... =>', new URL('../../img/bg/library.svg', base).href);
console.log('应该用 assets/img/... =>', new URL('assets/img/bg/library.svg', base).href);