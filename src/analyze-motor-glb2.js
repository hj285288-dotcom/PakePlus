const fs = require('fs');
const path = require('path');

const glbPath = path.join(__dirname, 'motor-models', 'iron-core', 'MTA-3N.glb');
const buf = fs.readFileSync(glbPath);

let offset = 12;
let jsonData = null;
let binOffset = 0;
let binData = null;

while (offset < buf.length) {
  const chunkLen = buf.readUInt32LE(offset);
  const chunkType = buf.toString('ascii', offset + 4, offset + 8);
  if (chunkType === 'JSON') {
    jsonData = JSON.parse(buf.toString('utf8', offset + 8, offset + 8 + chunkLen));
  } else if (chunkType === 'BIN\x00' || chunkType === 'BIN ') {
    binOffset = offset + 8;
    binData = buf.slice(binOffset, binOffset + chunkLen);
  }
  offset += 8 + chunkLen;
}

// 分析每个 mesh 的顶点范围
jsonData.meshes.forEach(function(mesh, mi) {
  mesh.primitives.forEach(function(prim, pi) {
    var posAccessorIdx = prim.attributes.POSITION;
    var accessor = jsonData.accessors[posAccessorIdx];
    var bv = jsonData.bufferViews[accessor.bufferView];
    
    var min = accessor.min;
    var max = accessor.max;
    
    console.log('Mesh[' + mi + '] node:', jsonData.nodes[mi].name);
    console.log('  Position range:');
    console.log('    X: [' + min[0].toFixed(4) + ', ' + max[0].toFixed(4) + ']  width:', (max[0]-min[0]).toFixed(4));
    console.log('    Y: [' + min[1].toFixed(4) + ', ' + max[1].toFixed(4) + ']  height:', (max[1]-min[1]).toFixed(4));
    console.log('    Z: [' + min[2].toFixed(4) + ', ' + max[2].toFixed(4) + ']  depth:', (max[2]-min[2]).toFixed(4));
    console.log('  Vertex count:', accessor.count);
    console.log('');
  });
});