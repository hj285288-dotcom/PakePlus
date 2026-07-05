/**
 * 将 MTA-3N.glb 拆分为 定子(stator) 和 动子(mover) 两个 GLB 文件
 * 
 * 定子: mesh[0], mesh[1], mesh[2] (Z: 0~8.2, 下方磁铁板)
 * 动子: mesh[3] (Z: 8.6~40, 上方线圈)
 */

const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, 'motor-models', 'iron-core', 'MTA-3N.glb');
const statorOutPath = path.join(__dirname, 'motor-models', 'iron-core', 'stator.glb');
const moverOutPath = path.join(__dirname, 'motor-models', 'iron-core', 'MTA-3N-mover.glb');

const buf = fs.readFileSync(inputPath);

// 解析 GLB
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

/**
 * 从原始 GLB 中提取指定 mesh 索引，生成新的 GLB
 */
function extractMeshes(meshIndices, outputPath) {
  // 收集需要的 accessor 索引
  var usedAccessors = new Set();
  var newMeshes = [];
  
  meshIndices.forEach(function(mi) {
    var mesh = jsonData.meshes[mi];
    var newPrims = [];
    mesh.primitives.forEach(function(prim) {
      // 收集所有属性的 accessor
      Object.values(prim.attributes).forEach(function(ai) { usedAccessors.add(ai); });
      if (prim.indices !== undefined) usedAccessors.add(prim.indices);
      newPrims.push(JSON.parse(JSON.stringify(prim)));
    });
    newMeshes.push({ primitives: newPrims });
  });

  // 收集需要的 bufferView 索引
  var usedBufferViews = new Set();
  usedAccessors.forEach(function(ai) {
    var acc = jsonData.accessors[ai];
    if (acc.bufferView !== undefined) usedBufferViews.add(acc.bufferView);
  });

  // 重建 bufferViews 和 binary 数据
  var sortedBVs = Array.from(usedBufferViews).sort(function(a, b) { return a - b; });
  var bvMap = {}; // old index -> new index
  var newBufferViews = [];
  var binChunks = [];
  var currentOffset = 0;

  sortedBVs.forEach(function(oldIdx, newIdx) {
    bvMap[oldIdx] = newIdx;
    var bv = jsonData.bufferViews[oldIdx];
    var start = bv.byteOffset || 0;
    var len = bv.byteLength;
    var chunk = binData.slice(start, start + len);
    
    // 4字节对齐
    var padding = (4 - (len % 4)) % 4;
    var paddedChunk = Buffer.alloc(len + padding);
    chunk.copy(paddedChunk);
    
    var newBV = { buffer: 0, byteOffset: currentOffset, byteLength: len };
    if (bv.target) newBV.target = bv.target;
    if (bv.byteStride) newBV.byteStride = bv.byteStride;
    newBufferViews.push(newBV);
    binChunks.push(paddedChunk);
    currentOffset += paddedChunk.length;
  });

  // 重建 accessors
  var sortedAccessors = Array.from(usedAccessors).sort(function(a, b) { return a - b; });
  var accMap = {}; // old index -> new index
  var newAccessors = [];

  sortedAccessors.forEach(function(oldIdx, newIdx) {
    accMap[oldIdx] = newIdx;
    var acc = JSON.parse(JSON.stringify(jsonData.accessors[oldIdx]));
    if (acc.bufferView !== undefined) {
      acc.bufferView = bvMap[acc.bufferView];
    }
    newAccessors.push(acc);
  });

  // 更新 mesh 中的 accessor 引用
  newMeshes.forEach(function(mesh) {
    mesh.primitives.forEach(function(prim) {
      var newAttrs = {};
      Object.keys(prim.attributes).forEach(function(key) {
        newAttrs[key] = accMap[prim.attributes[key]];
      });
      prim.attributes = newAttrs;
      if (prim.indices !== undefined) {
        prim.indices = accMap[prim.indices];
      }
      // 移除材质引用（我们会在代码中重新赋材质）
      delete prim.material;
    });
  });

  // 构建节点
  var newNodes = meshIndices.map(function(mi, i) {
    return { name: jsonData.nodes[mi].name, mesh: i };
  });

  // 构建场景
  var newSceneNodes = newNodes.map(function(n, i) { return i; });

  // 合并 binary
  var newBin = Buffer.concat(binChunks);

  // 构建新的 JSON
  var newJson = {
    asset: { version: '2.0', generator: 'MoenTech GLB Splitter' },
    scene: 0,
    scenes: [{ nodes: newSceneNodes }],
    nodes: newNodes,
    meshes: newMeshes,
    accessors: newAccessors,
    bufferViews: newBufferViews,
    buffers: [{ byteLength: newBin.length }]
  };

  // 编码 JSON
  var jsonStr = JSON.stringify(newJson);
  // 4字节对齐
  while (jsonStr.length % 4 !== 0) jsonStr += ' ';
  var jsonBuf = Buffer.from(jsonStr, 'utf8');

  // 构建 GLB
  var totalLen = 12 + 8 + jsonBuf.length + 8 + newBin.length;
  var glb = Buffer.alloc(totalLen);
  var pos = 0;

  // Header
  glb.write('glTF', pos); pos += 4;
  glb.writeUInt32LE(2, pos); pos += 4;
  glb.writeUInt32LE(totalLen, pos); pos += 4;

  // JSON chunk
  glb.writeUInt32LE(jsonBuf.length, pos); pos += 4;
  glb.write('JSON', pos); pos += 4;
  jsonBuf.copy(glb, pos); pos += jsonBuf.length;

  // BIN chunk
  glb.writeUInt32LE(newBin.length, pos); pos += 4;
  glb.write('BIN\x00', pos); pos += 4;
  newBin.copy(glb, pos);

  fs.writeFileSync(outputPath, glb);
  console.log('Written:', outputPath, '(' + glb.length + ' bytes)');
}

// 拆分
console.log('Splitting MTA-3N.glb...');
console.log('');

// 定子: mesh 0, 1, 2
extractMeshes([0, 1, 2], statorOutPath);

// 动子: mesh 3
extractMeshes([3], moverOutPath);

console.log('');
console.log('Done! Stator and mover GLB files created.');