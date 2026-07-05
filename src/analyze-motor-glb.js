const fs = require('fs');
const path = require('path');

const glbPath = path.join(__dirname, 'motor-models', 'iron-core', 'MTA-3N.glb');
const buf = fs.readFileSync(glbPath);

console.log('File size:', buf.length, 'bytes');
const magic = buf.toString('ascii', 0, 4);
console.log('Magic:', magic);
const version = buf.readUInt32LE(4);
console.log('Version:', version);
const totalLength = buf.readUInt32LE(8);
console.log('Total length:', totalLength);

let offset = 12;
while (offset < totalLength) {
  const chunkLen = buf.readUInt32LE(offset);
  const chunkType = buf.toString('ascii', offset + 4, offset + 8);
  console.log('\nChunk:', chunkType, 'length:', chunkLen);
  
  if (chunkType === 'JSON') {
    const json = JSON.parse(buf.toString('utf8', offset + 8, offset + 8 + chunkLen));
    
    console.log('\n--- Meshes:', json.meshes ? json.meshes.length : 0, '---');
    if (json.meshes) {
      json.meshes.forEach(function(m, i) {
        console.log('  mesh[' + i + ']:', m.name || 'unnamed', 'primitives:', m.primitives.length);
        m.primitives.forEach(function(p, j) {
          console.log('    prim[' + j + '] material:', p.material);
        });
      });
    }
    
    console.log('\n--- Materials:', json.materials ? json.materials.length : 0, '---');
    if (json.materials) {
      json.materials.forEach(function(m, i) {
        var pbr = m.pbrMetallicRoughness || {};
        var color = pbr.baseColorFactor || 'none';
        console.log('  mat[' + i + ']:', m.name || 'unnamed', 'color:', JSON.stringify(color), 'metallic:', pbr.metallicFactor, 'roughness:', pbr.roughnessFactor);
      });
    }
    
    console.log('\n--- Nodes:', json.nodes ? json.nodes.length : 0, '---');
    if (json.nodes) {
      json.nodes.forEach(function(n, i) {
        console.log('  node[' + i + ']:', n.name || 'unnamed', 'mesh:', n.mesh !== undefined ? n.mesh : '-', 'children:', n.children || '-');
      });
    }
  }
  
  offset += 8 + chunkLen;
}