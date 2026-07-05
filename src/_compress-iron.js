// Compress GLB files in iron-core (有铁芯直线电机模型) folder
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = 'C:\\Users\\65464\\Documents\\neonmotion\\cyberpunk';
const folder = path.join(root, 'motor-models', 'iron-core');
const backup = path.join(folder, '_backup');

if (!fs.existsSync(backup)) fs.mkdirSync(backup, { recursive: true });

const files = fs.readdirSync(folder).filter(n => n.toLowerCase().endsWith('.glb'));
console.log('Found', files.length, 'GLB files');

for (const name of files) {
  const full = path.join(folder, name);
  const bak = path.join(backup, name);
  if (!fs.existsSync(bak)) {
    fs.copyFileSync(full, bak);
  }
  const before = fs.statSync(full).size;
  console.log('=== ' + name + ' (' + (before/1024).toFixed(1) + ' KB) ===');
  try {
    const out = execSync('npx gltf-transform meshopt "' + full + '" "' + full + '" --level medium', {
      cwd: root, encoding: 'utf8', stdio: 'pipe'
    });
    out.split(/\r?\n/).forEach(line => {
      if (line.includes('info:') || line.includes('error:')) console.log('  ' + line.trim());
    });
  } catch (e) {
    console.log('  ERROR: ' + e.message);
  }
  const after = fs.statSync(full).size;
  const pct = ((1 - after/before) * 100).toFixed(1);
  console.log('  -> ' + (after/1024).toFixed(1) + ' KB (-' + pct + '%)');
}
console.log('Done.');
