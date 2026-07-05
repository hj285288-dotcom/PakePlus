// 保留 position 为 Float32，只量化 normal/texcoord/color，再加 meshopt 编码
const fs = require('fs');
const path = require('path');
const { Document, NodeIO } = require('@gltf-transform/core');
const { MeshoptCompression } = require('@gltf-transform/extensions');
const { reorder, prune, dedup, quantize } = require('@gltf-transform/functions');
const { MeshoptEncoder, MeshoptDecoder } = require('meshoptimizer');

const FOLDER = 'motor-models/iron-core';

async function compressOne(inputPath, outputPath) {
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  const io = new NodeIO()
    .registerExtensions([MeshoptCompression])
    .registerDependencies({
      'meshopt.encoder': MeshoptEncoder,
      'meshopt.decoder': MeshoptDecoder
    });
  const doc = await io.read(inputPath);
  // 1) 顶点重排
  await doc.transform(reorder({ encoder: MeshoptEncoder }));
  // 2) 量化：跳过 POSITION（让 shader 中 position 保持 mm 单位）
  await doc.transform(quantize({
    exclude: ['POSITION', 'WEIGHTS_0', 'JOINTS_0']
  }));
  // 3) 应用 EXT_meshopt_compression buffer 编码
  doc.createExtension(MeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: MeshoptCompression.EncoderMethod.FILTER });
  await doc.transform(prune());
  await doc.transform(dedup());
  await io.write(outputPath, doc);
  const orig = fs.statSync(inputPath).size;
  const comp = fs.statSync(outputPath).size;
  return { orig, comp };
}

async function main() {
  const files = fs.readdirSync(FOLDER).filter(f => f.endsWith('.glb') && f !== '_backup');
  const results = [];
  for (const f of files) {
    const src = path.join(FOLDER, f);
    const tmp = src + '.tmp';
    try {
      const r = await compressOne(src, tmp);
      fs.renameSync(tmp, src);
      results.push({ f, ...r });
      console.log(`${f}: ${r.orig} -> ${r.comp} (${((1 - r.comp/r.orig)*100).toFixed(1)}%)`);
    } catch (e) {
      console.error('FAIL', f, e.message);
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    }
  }
  const totalOrig = results.reduce((s, r) => s + r.orig, 0);
  const totalComp = results.reduce((s, r) => s + r.comp, 0);
  console.log(`\n=== TOTAL: ${totalOrig} -> ${totalComp} (${((1 - totalComp/totalOrig)*100).toFixed(1)}%) ===`);
}
main().catch(e => { console.error(e); process.exit(1); });
