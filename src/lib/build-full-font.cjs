/**
 * 把 NotoSansSC-Regular-normal.js 里的 9.5MB TTF base64
 * 转成 lib/NotoSansSC-Full.ttf.js（浏览器端可用，暴露 window.NotoSansSCFullTtfBytes）
 *
 * 母字体涵盖 ASCII + CJK U+4E00-U+9FFF + CJK 标点 + 全角字符，足以用于运行时子集化。
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'NotoSansSC-Regular-normal.js');
const OUT = path.join(__dirname, 'NotoSansSC-Full.ttf.js');

const content = fs.readFileSync(SRC, 'utf8');

// 提取 var font = '...';
const m = content.match(/var\s+font\s*=\s*'([A-Za-z0-9+/=]+)'\s*;/);
if (!m) {
  console.error('未找到 var font = "..."');
  process.exit(1);
}

const base64 = m[1];
console.log('Base64 length:', base64.length, '(decoded:', Buffer.from(base64, 'base64').length, 'bytes)');

const out =
`// NotoSansSC 母字体 (约 ${(base64.length * 0.75 / 1024 / 1024).toFixed(2)} MB base64) - 涵盖 ASCII + CJK U+4E00-U+9FFF + CJK 标点 + 全角字符
// 由 build-full-font.cjs 从 NotoSansSC-Regular-normal.js 提取，浏览器端 subset-font UMD 使用
// 暴露：window.NotoSansSCFullTtfBytes (Uint8Array)
(function () {
  var b64 = ${JSON.stringify(base64)};
  // atob 仅在 latin1 范围准确；TTF 是二进制，做手动 base64 → Uint8Array 解码更可靠
  var bin = '';
  // 分段拼接避免栈溢出（base64 长度 ~12.6MB）
  var CHUNK = 0x8000;
  for (var i = 0; i < b64.length; i += CHUNK) {
    bin += atob(b64.substr(i, CHUNK));
  }
  var len = bin.length;
  var bytes = new Uint8Array(len);
  for (var j = 0; j < len; j++) bytes[j] = bin.charCodeAt(j) & 0xFF;
  window.NotoSansSCFullTtfBytes = bytes;
  // 同时通过 ASCII key 暴露（供 subset-font UMD 包装内部读取）
  window.__NOTOSANS_FULL_TTF__ = bytes;
})();
`;

fs.writeFileSync(OUT, out, 'utf8');
console.log('Wrote', OUT, '(' + out.length, 'chars JS file)');