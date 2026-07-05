// 生成脚本：从 Excel 读取驱动器数据并生成 driver-data.js
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// 读取 Excel
const excelPath = path.join(__dirname, '../server/src/data/驱动器数据.xlsx');
const wb = XLSX.readFile(excelPath);
const ws = wb.Sheets[wb.SheetNames[0]];
const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });

// 表头: 驱动器系列, 型号, 持续电流, 峰值电流, 代码, 上位机通讯协议, 电压类型, 霍尔传感器, 增量式, 绝对值, 龙门模式, 定位精度补偿, 位置比较输出
const headers = rawData[0].map(h => String(h).trim());

// 转换数据
const records = [];
for (let i = 1; i < rawData.length; i++) {
  const row = rawData[i];
  if (!row[0] || !row[1]) continue; // 跳过空行
  
  const obj = {
    series: String(row[0]).trim(),
    model: String(row[1]).trim(),
    ci: Number(row[2]) || 0,
    pi: Number(row[3]) || 0,
    code: String(row[4]).trim(),
    protocol: String(row[5]).trim(),
    voltage: String(row[6]).trim(),
    hall: String(row[7]).trim(),
    incremental: String(row[8]).trim(),
    absolute: String(row[9]).trim(),
    gantry: String(row[10]).trim(),
    compensation: String(row[11]).trim(),
    pcom: String(row[12]).trim()
  };
  records.push(obj);
}

// 生成 JS 文件内容
const jsContent = 'var DRIVER_DB = ' + JSON.stringify(records) + ';';

// 写入文件
const outPath = path.join(__dirname, 'driver-data.js');
fs.writeFileSync(outPath, jsContent, 'utf8');

console.log('生成完成，共 ' + records.length + ' 条记录');
console.log('系列: ' + [...new Set(records.map(r => r.series))].join(', '));