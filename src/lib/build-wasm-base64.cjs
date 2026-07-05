/**
 * 把 harfbuzzjs 的 hb-subset.wasm 转成 base64 内嵌到 .js，
 * 浏览器加载后自动 atob + WebAssembly.instantiate，挂到 window.__HB_SUBSET_WASM__
 */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'node_modules', 'harfbuzzjs', 'hb-subset.wasm');
const OUT = path.resolve(__dirname, 'hb-subset-wasm-base64.txt');

const buf = fs.readFileSync(SRC);
const b64 = buf.toString('base64');
fs.writeFileSync(OUT, b64);
console.log('WASM bytes:', buf.length, 'base64 chars:', b64.length);
console.log('Wrote', OUT);