/**
 * Moen Tech 电机与驱动器数据库管理服务器
 * 启动：npm install && npm start，然后访问 http://localhost:3456/driver-db.html
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
// Excel 导入导出功能已移除；服务端不再依赖第三方 npm 包。

const PORT = 3456;
const BASE_DIR = __dirname;
const DRIVER_FILE = path.join(BASE_DIR, 'driver-data.js');
const MAX_BODY_SIZE = 25 * 1024 * 1024;
const BUILTIN_FEATURES = [
  { key: 'protocol', name: '通讯协议', builtin: true },
  { key: 'voltage', name: '电压', builtin: true },
  { key: 'hall', name: '霍尔', builtin: true },
  { key: 'incremental', name: '增量式', builtin: true },
  { key: 'absolute', name: '绝对值', builtin: true },
  { key: 'gantry', name: '龙门', builtin: true },
  { key: 'compensation', name: '补偿', builtin: true },
  { key: 'pcom', name: '位置比较', builtin: true }
];
const CORE_COLUMNS = [
  { key: 'series', name: '系列', required: true },
  { key: 'model', name: '型号', required: true },
  { key: 'ci', name: '持续电流(A)', required: true, number: true },
  { key: 'pi', name: '峰值电流(A)', required: true, number: true },
  { key: 'code', name: '驱动器代码', required: true }
];
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json'
};

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req, callback) {
  let body = '';
  let tooLarge = false;
  req.on('data', chunk => {
    body += chunk;
    if (body.length > MAX_BODY_SIZE) { tooLarge = true; req.destroy(); }
  });
  req.on('end', () => {
    if (tooLarge) return callback(new Error('上传文件超过 25MB 限制'));
    try { callback(null, JSON.parse(body)); } catch (error) { callback(new Error('请求数据不是有效 JSON')); }
  });
  req.on('error', error => callback(error));
}

function readDriverData() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(DRIVER_FILE, 'utf-8'), context, { filename: DRIVER_FILE });
  return {
    drivers: Array.isArray(context.DRIVER_DB) ? context.DRIVER_DB : [],
    features: Array.isArray(context.DRIVER_FEATURES) && context.DRIVER_FEATURES.length ? context.DRIVER_FEATURES : BUILTIN_FEATURES
  };
}

function normalizeText(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function hasReplacementCharacter(value) {
  return normalizeText(value).includes('\uFFFD');
}

function validateDriverText(drivers, features) {
  const errors = [];
  const fields = CORE_COLUMNS.map(column => ({ key: column.key, name: column.name }))
    .concat(features.map(feature => ({ key: feature.key, name: feature.name, builtin: feature.builtin })));
  drivers.forEach((driver, index) => {
    fields.forEach(field => {
      const value = field.builtin === false
        ? driver.features && driver.features[field.key]
        : driver[field.key];
      if (hasReplacementCharacter(value)) {
        errors.push('第 ' + (index + 1) + ' 条记录（型号“' + (driver.model || '未填写') + '”）的“' + field.name + '”含有乱码替换字符');
      }
    });
  });
  return errors;
}

function uniqueFeatures(features) {
  const names = new Set();
  return features.filter(feature => {
    if (!feature || !feature.key || !feature.name || names.has(feature.key)) return false;
    names.add(feature.key);
    return true;
  });
}

function writeDriverData(drivers, features) {
  const content = 'var DRIVER_FEATURES = ' + JSON.stringify(features) + ';\n' +
    'var DRIVER_DB = ' + JSON.stringify(drivers) + ';\n';
  const backup = path.join(BASE_DIR, 'driver-data.backup.js');
  if (fs.existsSync(DRIVER_FILE)) fs.copyFileSync(DRIVER_FILE, backup);
  fs.writeFileSync(DRIVER_FILE, content, 'utf-8');
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (req.method === 'POST' && req.url === '/api/save-db') {
    return readJsonBody(req, (error, data) => {
      if (error) return sendJson(res, 400, { success: false, message: error.message });
      try {
        const filePath = path.join(BASE_DIR, 'motor-data.js');
        if (fs.existsSync(filePath)) fs.copyFileSync(filePath, path.join(BASE_DIR, 'motor-data.backup.js'));
        fs.writeFileSync(filePath, generateMotorDataJS(data), 'utf-8');
        return sendJson(res, 200, { success: true, message: '已保存到 motor-data.js' });
      } catch (saveError) { return sendJson(res, 500, { success: false, message: '保存失败：' + saveError.message }); }
    });
  }

  if (req.method === 'POST' && req.url === '/api/save-driver-db') {
    return readJsonBody(req, (error, data) => {
      if (error) return sendJson(res, 400, { success: false, message: error.message });
      try {
        const drivers = Array.isArray(data) ? data : data.drivers;
        const features = Array.isArray(data) ? BUILTIN_FEATURES : data.features;
        if (!Array.isArray(drivers) || !Array.isArray(features)) throw new Error('驱动器数据格式无效');
        const normalizedFeatures = uniqueFeatures(features);
        const textErrors = validateDriverText(drivers, normalizedFeatures);
        if (textErrors.length) throw new Error('保存已取消：' + textErrors.slice(0, 3).join('；'));
        writeDriverData(drivers, normalizedFeatures);
        return sendJson(res, 200, { success: true, message: '已保存到 driver-data.js' });
      } catch (saveError) { return sendJson(res, 500, { success: false, message: '保存失败：' + saveError.message }); }
    });
  }

  const urlPath = req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0];
  let filePath;
  try { filePath = path.join(BASE_DIR, decodeURIComponent(urlPath)); }
  catch (error) { res.writeHead(400); return res.end('Bad Request'); }
  if (!filePath.startsWith(BASE_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (error, file) => {
    if (error) { res.writeHead(404); return res.end('Not Found: ' + urlPath); }
    res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream' });
    res.end(file);
  });
});

function generateMotorDataJS(dbObj) {
  return '\n// === Motor Database - Generated from 直线马达参数.xlsx ===\nvar DB = ' + JSON.stringify(dbObj, null, 2) + ';';
}

server.listen(PORT, () => {
  console.log('Moen Tech 数据库管理服务器已启动');
  console.log('地址: http://localhost:' + PORT + '/driver-db.html');
});
