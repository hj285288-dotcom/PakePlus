const subsetFont = require('subset-font');
const fs = require('fs');
const path = require('path');

async function main() {
  const ttf = fs.readFileSync(path.join(__dirname, 'NotoSansSC.ttf'));

  // 构建字符集：ASCII + CJK 统一汉字 + 中文标点 + 全角字符 + 特殊符号
  let chars = '';
  // ASCII printable (0x20-0x7E)
  for (let i = 0x20; i <= 0x7E; i++) chars += String.fromCharCode(i);
  // CJK Unified Ideographs (0x4E00-0x9FFF) - 包含 GB2312 全部汉字
  for (let i = 0x4E00; i <= 0x9FFF; i++) chars += String.fromCharCode(i);
  // CJK 标点符号 (0x3000-0x303F)
  for (let i = 0x3000; i <= 0x303F; i++) chars += String.fromCharCode(i);
  // 全角字符 (0xFF00-0xFF5E)
  for (let i = 0xFF00; i <= 0xFF5E; i++) chars += String.fromCharCode(i);
  // 额外特殊符号
  chars += '\u00B0\u00B2\u00B3\u00B5\u03A9\u00B1\u00D7\u00F7\u2014\u2013\u00B7\u2026\u2018\u2019\u201C\u201D\u2103\u2109';

  console.log('Subsetting with ' + chars.length + ' characters...');
  const subset = await subsetFont(ttf, chars, { targetFormat: 'truetype' });
  
  // 保存子集 TTF
  fs.writeFileSync(path.join(__dirname, 'NotoSansSC-subset.ttf'), subset);
  console.log('Subset TTF saved: ' + subset.length + ' bytes');

  // 转为 base64 并生成 jsPDF 字体注册 JS 文件
  const base64 = subset.toString('base64');
  const jsContent = `// NotoSansSC-Regular subset font for jsPDF (auto-generated)
// Contains: ASCII + CJK Unified Ideographs (U+4E00-U+9FFF) + Chinese punctuation
(function(jsPDFAPI) {
  var font = '${base64}';
  var callAddFont = function() {
    this.addFileToVFS('NotoSansSC-Regular.ttf', font);
    this.addFont('NotoSansSC-Regular.ttf', 'NotoSansSC-Regular', 'normal');
  };
  jsPDFAPI.events.push(['addFonts', callAddFont]);
})(typeof window !== 'undefined' && window.jspdf ? window.jspdf.jsPDF.API : (typeof jsPDF !== 'undefined' ? jsPDF.API : {}));
`;

  fs.writeFileSync(path.join(__dirname, 'NotoSansSC-Regular-normal.js'), jsContent);
  console.log('Font JS saved: ' + jsContent.length + ' bytes');
}

main().catch(err => { console.error(err); process.exit(1); });
