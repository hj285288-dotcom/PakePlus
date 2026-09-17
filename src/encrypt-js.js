#!/usr/bin/env node
/**
 * 一键 JS 加密工具
 * 用法（二选一）：
 *   1. 双击 encrypt-js.bat（Windows）
 *   2. node encrypt-js.js
 *
 * 逻辑：
 *   - 读取 encrypt-config.json 中 files 列表的 JS，用 javascript-obfuscator 混淆；
 *   - 输出到 outputDir（默认 dist/），不覆盖源码；
 *   - 把 index.html 里对这些文件的引用替换为混淆后的文件，生成 dist/index.html；
 *   - 其余资源（css/png/字体等）原样复制到 dist。
 *
 * 关键约束：项目里的 JS 通过 window.xxx 互相通信（DRIVER_PARAMETER_RULES 等），
 * 所以 options 里必须 renameGlobals=false，否则跨文件引用会被重命名打断。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const CONFIG_PATH = path.join(ROOT, 'encrypt-config.json');
const MODULE_DIR = 'C:\\Users\\65464\\.workbuddy\\binaries\\node\\workspace\\node_modules';

function resolveObfuscator() {
  // 优先从隔离的 workspace 加载；找不到再退回全局 require。
  try {
    return require(path.join(MODULE_DIR, 'javascript-obfuscator'));
  } catch (e) {
    return require('javascript-obfuscator');
  }
}

function readConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error('找不到 encrypt-config.json，请先创建配置。');
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

// 不需要复制到发布目录的文件/目录（历史遗留、备份、工具自身、文档等）
const EXCLUDED_DIRS = new Set(['dist', 'node_modules', '_backup_original', '_cleanup_backup_20260914_132506']);
const EXCLUDED_FILES = new Set([
  'index.html.bak-before-winstrip', 'database.html', 'overview.md',
  'encrypt-config.json', 'encrypt-js.js', 'encrypt-js.bat'
]);

function listAllFiles(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || entry.name.startsWith('_') || EXCLUDED_DIRS.has(entry.name)) continue;
      result.push(...listAllFiles(full));
    } else if (!EXCLUDED_FILES.has(entry.name)) {
      result.push(full);
    }
  }
  return result;
}

function main() {
  const config = readConfig();
  const outputDir = path.join(ROOT, config.outputDir || 'dist');
  const files = config.files || [];
  const options = config.options || {};

  if (!files.length) {
    console.log('配置里没有要加密的文件（files 为空）。');
    return;
  }

  const JavaScriptObfuscator = resolveObfuscator();
  console.log('已加载 javascript-obfuscator 版本:', JavaScriptObfuscator.version || '未知');

  // 1. 清空并重建输出目录
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outputDir, { recursive: true });

  // 2. 需要替换引用的目标（相对文件名，含子目录则保留）
  const encryptedSet = new Set(files.map((f) => f.replace(/\\/g, '/')));

  // 3. 逐个混淆目标文件
  const encryptedNames = new Map(); // 原始相对路径 -> 输出文件名（都在 dist 根下用原名）
  let total = 0;
  for (const rel of files) {
    const srcPath = path.join(ROOT, rel);
    if (!fs.existsSync(srcPath)) {
      console.warn('  [跳过] 找不到文件:', rel);
      continue;
    }
    const code = fs.readFileSync(srcPath, 'utf8');
    const result = JavaScriptObfuscator.obfuscate(code, options);
    const outName = path.basename(rel);
    const outPath = path.join(outputDir, outName);
    fs.writeFileSync(outPath, result.getObfuscatedCode(), 'utf8');
    encryptedNames.set(rel.replace(/\\/g, '/'), outName);
    const srcKB = (Buffer.byteLength(code) / 1024).toFixed(1);
    const dstKB = (Buffer.byteLength(result.getObfuscatedCode()) / 1024).toFixed(1);
    console.log(`  [加密] ${rel}  ${srcKB}KB -> ${dstKB}KB`);
    total++;
  }

  if (!total) {
    console.log('没有成功加密任何文件，终止。');
    return;
  }

  // 4. 复制其余资源 + 生成 index.html（替换 script 引用）
  for (const full of listAllFiles(ROOT)) {
    const rel = path.relative(ROOT, full).replace(/\\/g, '/');
    if (rel.startsWith('dist/') || rel === 'encrypt-config.json' || rel === 'encrypt-js.js' || rel === 'encrypt-js.bat') continue;
    if (encryptedSet.has(rel)) continue; // 已加密，跳过原始文件

    const dstPath = path.join(outputDir, rel);
    fs.mkdirSync(path.dirname(dstPath), { recursive: true });

    if (rel === 'index.html') {
      // 替换被加密文件的 script 引用
      let html = fs.readFileSync(full, 'utf8');
      for (const [orig, outName] of encryptedNames) {
        const base = path.basename(orig);
        html = html.split(`src="${base}"`).join(`src="${outName}"`);
        html = html.split(`src="./${base}"`).join(`src="./${outName}"`);
      }
      fs.writeFileSync(dstPath, html, 'utf8');
      console.log(`  [复制] index.html（已替换加密后的 JS 引用）`);
    } else {
      fs.copyFileSync(full, dstPath);
    }
  }

  console.log('\n完成！加密结果在:', path.relative(ROOT, outputDir) || '.');
  console.log('提示：加密只是提高逆向成本，无法做到绝对安全。');
}

try {
  main();
} catch (err) {
  console.error('\n[错误]', err && err.message ? err.message : err);
  process.exit(1);
}
