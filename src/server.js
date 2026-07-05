/**
 * Moen Tech 电机数据库管理服务器
 * 
 * 用途：从 Firefox 浏览器打开数据库管理页面，编辑后自动保存到 motor-data.js
 * 
 * 启动方式：
 *   cd neonmotion/cyberpunk
 *   node server.js
 * 
 * 然后在 Firefox 中打开 http://localhost:3456
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3456;
const BASE_DIR = __dirname;

// MIME 类型映射
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json'
};

const server = http.createServer(function(req, res) {
  // CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API: 保存电机数据库到 motor-data.js
  if (req.method === 'POST' && req.url === '/api/save-db') {
    let body = '';
    req.on('data', function(chunk) { body += chunk; });
    req.on('end', function() {
      try {
        var data = JSON.parse(body);
        var jsContent = generateMotorDataJS(data);
        var filePath = path.join(BASE_DIR, 'motor-data.js');
        
        // 先备份
        var backupPath = path.join(BASE_DIR, 'motor-data.backup.js');
        if (fs.existsSync(filePath)) {
          fs.copyFileSync(filePath, backupPath);
        }
        
        fs.writeFileSync(filePath, jsContent, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: '已保存到 motor-data.js' }));
        console.log('[' + new Date().toLocaleTimeString() + '] motor-data.js 已更新');
      } catch(e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: '保存失败: ' + e.message }));
        console.error('保存失败:', e.message);
      }
    });
    return;
  }

  // API: 保存驱动器数据库到 driver-data.js
  if (req.method === 'POST' && req.url === '/api/save-driver-db') {
    let body = '';
    req.on('data', function(chunk) { body += chunk; });
    req.on('end', function() {
      try {
        var data = JSON.parse(body);
        var jsContent = 'var DRIVER_DB = ' + JSON.stringify(data) + ';\n';
        var filePath = path.join(BASE_DIR, 'driver-data.js');
        
        // 先备份
        var backupPath = path.join(BASE_DIR, 'driver-data.backup.js');
        if (fs.existsSync(filePath)) {
          fs.copyFileSync(filePath, backupPath);
        }
        
        fs.writeFileSync(filePath, jsContent, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: '已保存到 driver-data.js' }));
        console.log('[' + new Date().toLocaleTimeString() + '] driver-data.js 已更新');
      } catch(e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: '保存失败: ' + e.message }));
        console.error('驱动器数据保存失败:', e.message);
      }
    });
    return;
  }

  // 静态文件服务
  var urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';
  
  // 解码 URL 中的中文编码（如 %E6%9C%89%E9%93%81%E8%8A%AF → 有铁芯）
  var decodedPath = decodeURIComponent(urlPath);
  var filePath = path.join(BASE_DIR, decodedPath);
  
  // 安全检查：防止路径遍历
  if (!filePath.startsWith(BASE_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, function(err, data) {
    if (err) {
      res.writeHead(404);
      res.end('Not Found: ' + urlPath);
      return;
    }
    var ext = path.extname(filePath);
    var mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
});

/**
 * 将完整的数据库对象生成为 motor-data.js 文件内容
 */
function generateMotorDataJS(dbObj) {
  var lines = [];
  lines.push('');
  lines.push('// === Motor Database - Generated from 直线马达参数.xlsx ===');
  lines.push('// Fields: n=型号, pf=峰值推力(N), cf=持续推力(N), fc=推力常数(N/Arms), mc=电机常数(N²/W),');
  lines.push('//         pi=峰值电流(Arms), ci=持续电流(Arms), be=反电动势(V/m/s), res=单相电阻(Ω),');
  lines.push('//         ind=单相电感(mH), pw=最大持续功率(W), tr=热阻(℃/W), cm=线圈重量(kg),');
  lines.push('//         cl=线圈长度(mm), at=电机吸引力(N), pt=磁节距(mm), sm=滑动座质量(kg)');
  lines.push('');
  lines.push('var DB = ' + JSON.stringify(dbObj, null, 2) + ';');
  return lines.join('\n');
}

server.listen(PORT, function() {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║  Moen Tech 电机数据库管理服务器已启动       ║');
  console.log('  ║                                              ║');
  console.log('  ║  地址: http://localhost:' + PORT + '               ║');
  console.log('  ║  数据库管理: http://localhost:' + PORT + '/motor-db.html ║');
  console.log('  ║                                              ║');
  console.log('  ║  按 Ctrl+C 停止服务器                       ║');
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log('');
});