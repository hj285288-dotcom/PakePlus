// 分析 134caokao.glb 参考模型的各组件坐标
const fs = require('fs');
const path = require('path');

// 简单解析 GLB (Binary glTF)
function parseGLB(filepath) {
  const buf = fs.readFileSync(filepath);
  
  // GLB Header: magic(4) + version(4) + length(4)
  const magic = buf.readUInt32LE(0);
  if (magic !== 0x46546C67) { // 'glTF'
    console.error('Not a valid GLB file');
    return null;
  }
  
  // Chunk 0: JSON
  const chunk0Length = buf.readUInt32LE(12);
  const chunk0Type = buf.readUInt32LE(16);
  const jsonStr = buf.slice(20, 20 + chunk0Length).toString('utf8');
  const gltf = JSON.parse(jsonStr);
  
  // Chunk 1: Binary buffer
  const chunk1Offset = 20 + chunk0Length;
  const chunk1Length = buf.readUInt32LE(chunk1Offset);
  const binData = buf.slice(chunk1Offset + 8, chunk1Offset + 8 + chunk1Length);
  
  return { gltf, binData };
}

function getAccessorData(gltf, binData, accessorIdx) {
  const accessor = gltf.accessors[accessorIdx];
  const bufferView = gltf.bufferViews[accessor.bufferView];
  const offset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
  const componentType = accessor.componentType;
  const count = accessor.count;
  const type = accessor.type;
  
  let components = 1;
  if (type === 'VEC2') components = 2;
  else if (type === 'VEC3') components = 3;
  else if (type === 'VEC4') components = 4;
  else if (type === 'MAT4') components = 16;
  
  let arr;
  const totalElements = count * components;
  if (componentType === 5126) { // FLOAT
    arr = new Float32Array(binData.buffer, binData.byteOffset + offset, totalElements);
  } else if (componentType === 5123) { // UNSIGNED_SHORT
    arr = new Uint16Array(binData.buffer, binData.byteOffset + offset, totalElements);
  } else if (componentType === 5125) { // UNSIGNED_INT
    arr = new Uint32Array(binData.buffer, binData.byteOffset + offset, totalElements);
  }
  
  return { data: arr, count, components, min: accessor.min, max: accessor.max };
}

// 分析每个 mesh/node 的位置范围
function analyzeMeshBounds(gltf, binData) {
  console.log('=== 134caokao.glb 参考模型分析 ===\n');
  
  // 打印 node 树
  console.log('--- Nodes ---');
  if (gltf.nodes) {
    gltf.nodes.forEach((node, i) => {
      const info = [];
      if (node.name) info.push(`name="${node.name}"`);
      if (node.translation) info.push(`T=[${node.translation.map(v => v.toFixed(2)).join(', ')}]`);
      if (node.rotation) info.push(`R=[${node.rotation.map(v => v.toFixed(4)).join(', ')}]`);
      if (node.scale) info.push(`S=[${node.scale.map(v => v.toFixed(4)).join(', ')}]`);
      if (node.matrix) info.push(`matrix=[${node.matrix.map(v => v.toFixed(3)).join(', ')}]`);
      if (node.mesh !== undefined) info.push(`mesh=${node.mesh}`);
      if (node.children) info.push(`children=[${node.children.join(',')}]`);
      console.log(`  Node[${i}]: ${info.join(', ')}`);
    });
  }
  
  console.log('\n--- Meshes ---');
  if (gltf.meshes) {
    gltf.meshes.forEach((mesh, mi) => {
      console.log(`  Mesh[${mi}]: name="${mesh.name || ''}", primitives=${mesh.primitives.length}`);
      mesh.primitives.forEach((prim, pi) => {
        if (prim.attributes.POSITION !== undefined) {
          const posData = getAccessorData(gltf, binData, prim.attributes.POSITION);
          // 计算边界
          let minX = Infinity, minY = Infinity, minZ = Infinity;
          let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
          for (let i = 0; i < posData.count; i++) {
            const x = posData.data[i * 3];
            const y = posData.data[i * 3 + 1];
            const z = posData.data[i * 3 + 2];
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
            if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
          }
          console.log(`    Prim[${pi}]: vertices=${posData.count}`);
          console.log(`      X: [${minX.toFixed(2)}, ${maxX.toFixed(2)}] (width=${(maxX-minX).toFixed(2)})`);
          console.log(`      Y: [${minY.toFixed(2)}, ${maxY.toFixed(2)}] (height=${(maxY-minY).toFixed(2)})`);
          console.log(`      Z: [${minZ.toFixed(2)}, ${maxZ.toFixed(2)}] (depth=${(maxZ-minZ).toFixed(2)})`);
        }
      });
    });
  }
}

// 同样分析 134.glb 和 134-duangaiban.glb
function analyzeFile(filepath) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`分析文件: ${filepath}`);
  console.log('='.repeat(60));
  const result = parseGLB(filepath);
  if (!result) return;
  analyzeMeshBounds(result.gltf, result.binData);
}

analyzeFile(path.join(__dirname, 'models', '134caokao.glb'));
analyzeFile(path.join(__dirname, 'models', '134.glb'));
analyzeFile(path.join(__dirname, 'models', '134-duangaiban.glb'));
analyzeFile(path.join(__dirname, 'models', 'MTA-3.glb'));
// 对比 178 的参考
analyzeFile(path.join(__dirname, 'models', '178.glb'));
analyzeFile(path.join(__dirname, 'models', '178-duangaiban.glb'));
