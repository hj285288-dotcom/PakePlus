/**
 * 将定子 GLB 按 Z 坐标拆分为：
 * - 环氧树脂部分（Z 较高的凸出面）
 * - 镀镍钢板部分（Z 较低的底板面）
 * 
 * 分析定子 mesh 的顶点 Z 分布来确定分割阈值
 */

const fs = require('fs');
const path = require('path');

const glbPath = path.join(__dirname, 'motor-models', 'iron-core', 'MTA-3N.glb');
const buf = fs.readFileSync(glbPath);

let jsonData = null;
let binData = null;
let offset = 12;

while (offset < buf.length) {
  const chunkLen = buf.readUInt32LE(offset);
  const chunkType = buf.toString('ascii', offset + 4, offset + 8);
  if (chunkType === 'JSON') {
    jsonData = JSON.parse(buf.toString('utf8', offset + 8, offset + 8 + chunkLen));
  } else {
    binData = buf.slice(offset + 8, offset + 8 + chunkLen);
  }
  offset += 8 + chunkLen;
}

// 分析定子 mesh (0, 1, 2) 的顶点 Z 值分布
[0, 1, 2].forEach(function(mi) {
  var mesh = jsonData.meshes[mi];
  var prim = mesh.primitives[0];
  var posIdx = prim.attributes.POSITION;
  var accessor = jsonData.accessors[posIdx];
  var bv = jsonData.bufferViews[accessor.bufferView];
  
  var byteOffset = (bv.byteOffset || 0) + (accessor.byteOffset || 0);
  var stride = bv.byteStride || 12; // 3 floats * 4 bytes
  var count = accessor.count;
  
  // 收集所有 Z 值
  var zValues = [];
  for (var i = 0; i < count; i++) {
    var z = binData.readFloatLE(byteOffset + i * stride + 8); // Z is 3rd float
    zValues.push(z);
  }
  
  // 统计 Z 值分布
  zValues.sort(function(a, b) { return a - b; });
  var uniqueZ = {};
  zValues.forEach(function(z) {
    var rounded = Math.round(z * 100) / 100;
    uniqueZ[rounded] = (uniqueZ[rounded] || 0) + 1;
  });
  
  console.log('Mesh[' + mi + '] (' + jsonData.nodes[mi].name + ') Z value distribution:');
  Object.keys(uniqueZ).sort(function(a, b) { return parseFloat(a) - parseFloat(b); }).forEach(function(z) {
    console.log('  Z=' + z + ': ' + uniqueZ[z] + ' vertices');
  });
  console.log('');
});

// 也分析 mesh[3] (动子)
var mesh3 = jsonData.meshes[3];
var prim3 = mesh3.primitives[0];
var posIdx3 = prim3.attributes.POSITION;
var accessor3 = jsonData.accessors[posIdx3];
var bv3 = jsonData.bufferViews[accessor3.bufferView];
var byteOffset3 = (bv3.byteOffset || 0) + (accessor3.byteOffset || 0);
var stride3 = bv3.byteStride || 12;
var count3 = accessor3.count;

var zValues3 = [];
for (var i = 0; i < count3; i++) {
  var z = binData.readFloatLE(byteOffset3 + i * stride3 + 8);
  zValues3.push(z);
}
zValues3.sort(function(a, b) { return a - b; });
var uniqueZ3 = {};
zValues3.forEach(function(z) {
  var rounded = Math.round(z * 100) / 100;
  uniqueZ3[rounded] = (uniqueZ3[rounded] || 0) + 1;
});
console.log('Mesh[3] (mover - ' + jsonData.nodes[3].name + ') Z value distribution:');
Object.keys(uniqueZ3).sort(function(a, b) { return parseFloat(a) - parseFloat(b); }).forEach(function(z) {
  console.log('  Z=' + z + ': ' + uniqueZ3[z] + ' vertices');
});