/**
 * 无铁芯直线电机 3D 渲染模块
 * 完整复刻 motor-control.html 中无铁芯系列(MUA/MUB/MUC/MUD/MUF/MUI)的渲染方式：
 *   - 加载 MUD-stator.glb（定子，按 mesh 跨度分组：磁铁块=黑色环氧；框架=不锈钢）
 *   - 加载 MUD-9.glb（动子，Y > 0 黑色磨砂金属；Y <= 0 黑色环氧线圈体）
 */
(function() {
  'use strict';

  var state = {
    container: null,
    loadingEl: null,
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    motorGroup: null,
    modelReady: false,
    ro: null,
    lastTypeKey: null,
    animating: false
  };

  var FOLDER = 'motor-models/ironless/';
  var STATOR_URL = FOLDER + 'MUD-stator.glb';
  var MOVER_URL = FOLDER + 'MUD-9.glb';

  // 通用 PBR shader 工厂（与 motor-control.html createSimplePBRMaterial 一致）
  function createSimplePBRMaterial(baseColorVec, metalnessVal, roughnessVal) {
    return new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: {
        ambientLightColor: { value: new THREE.Color(0xffffff) },
        ambientIntensity: { value: 0.5 },
        dirLightColor: { value: new THREE.Color(0xFFAA44) },
        dirLightDir: { value: new THREE.Vector3(-3, 8, 5).normalize() },
        dirLightIntensity: { value: 0.7 },
        dirLight2Color: { value: new THREE.Color(0x4488BB) },
        dirLight2Dir: { value: new THREE.Vector3(5, 5, -5).normalize() },
        dirLight2Intensity: { value: 0.4 },
        cameraPos: { value: new THREE.Vector3() },
        baseColor: { value: new THREE.Vector3(baseColorVec[0], baseColorVec[1], baseColorVec[2]) },
        metalness: { value: metalnessVal },
        roughness: { value: roughnessVal }
      },
      vertexShader: [
        'varying vec3 vWorldPos;',
        'varying vec3 vWorldNormal;',
        'void main(){',
        '  vec4 worldPos = modelMatrix * vec4(position, 1.0);',
        '  vWorldPos = worldPos.xyz;',
        '  vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);',
        '  gl_Position = projectionMatrix * viewMatrix * worldPos;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 ambientLightColor;',
        'uniform float ambientIntensity;',
        'uniform vec3 dirLightColor;',
        'uniform vec3 dirLightDir;',
        'uniform float dirLightIntensity;',
        'uniform vec3 dirLight2Color;',
        'uniform vec3 dirLight2Dir;',
        'uniform float dirLight2Intensity;',
        'uniform vec3 cameraPos;',
        'uniform vec3 baseColor;',
        'uniform float metalness;',
        'uniform float roughness;',
        'varying vec3 vWorldPos;',
        'varying vec3 vWorldNormal;',
        'void main(){',
        '  vec3 N = normalize(vWorldNormal);',
        '  vec3 V = normalize(cameraPos - vWorldPos);',
        '  vec3 ambient = ambientLightColor * ambientIntensity * baseColor;',
        '  float NdotL1 = max(dot(N, dirLightDir), 0.0);',
        '  vec3 H1 = normalize(dirLightDir + V);',
        '  float spec1 = pow(max(dot(N, H1), 0.0), mix(8.0, 64.0, 1.0 - roughness));',
        '  vec3 diff1 = dirLightColor * dirLightIntensity * NdotL1 * baseColor * (1.0 - metalness);',
        '  vec3 specColor1 = mix(vec3(0.04), baseColor, metalness);',
        '  vec3 specular1 = dirLightColor * dirLightIntensity * spec1 * specColor1;',
        '  float NdotL2 = max(dot(N, dirLight2Dir), 0.0);',
        '  vec3 H2 = normalize(dirLight2Dir + V);',
        '  float spec2 = pow(max(dot(N, H2), 0.0), mix(8.0, 64.0, 1.0 - roughness));',
        '  vec3 diff2 = dirLight2Color * dirLight2Intensity * NdotL2 * baseColor * (1.0 - metalness);',
        '  vec3 specColor2 = mix(vec3(0.04), baseColor, metalness);',
        '  vec3 specular2 = dirLight2Color * dirLight2Intensity * spec2 * specColor2;',
        '  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0) * metalness * 0.4;',
        '  vec3 fresnelColor = baseColor * fresnel;',
        '  // 伪 IBL：根据反射向量采样天空渐变作为环境反射',
        '  vec3 R = reflect(-V, N);',
        '  float skyT = clamp(R.y * 0.5 + 0.5, 0.0, 1.0);',
        '  vec3 skyColor = mix(vec3(0.18, 0.20, 0.24), vec3(0.92, 0.95, 1.00), skyT);',
        '  vec3 envF0 = mix(vec3(0.04), baseColor, metalness);',
        '  vec3 envSpec = envF0 * skyColor * (1.0 - roughness * 0.7) * metalness;',
        '  vec3 finalColor = ambient + diff1 + specular1 + diff2 + specular2 + fresnelColor + envSpec;',
        '  finalColor = pow(finalColor, vec3(1.0/2.2));',
        '  gl_FragColor = vec4(finalColor, 1.0);',
        '}'
      ].join('\n')
    });
  }

  // 无铁芯定子框架材质（不锈钢框架 + 螺丝区域亮白金属）
  function createIronlessFrameMaterial() {
    return new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: {
        ambientLightColor: { value: new THREE.Color(0xffffff) },
        ambientIntensity: { value: 0.5 },
        dirLightColor: { value: new THREE.Color(0xFFAA44) },
        dirLightDir: { value: new THREE.Vector3(-3, 8, 5).normalize() },
        dirLightIntensity: { value: 0.7 },
        dirLight2Color: { value: new THREE.Color(0x4488BB) },
        dirLight2Dir: { value: new THREE.Vector3(5, 5, -5).normalize() },
        dirLight2Intensity: { value: 0.4 },
        cameraPos: { value: new THREE.Vector3() }
      },
      vertexShader: [
        'varying vec3 vWorldPos;',
        'varying vec3 vWorldNormal;',
        'varying vec3 vLocalNormal;',
        'varying vec3 vLocalPos;',
        'void main(){',
        '  vLocalPos = position;',
        '  vLocalNormal = normal;',
        '  vec4 worldPos = modelMatrix * vec4(position, 1.0);',
        '  vWorldPos = worldPos.xyz;',
        '  vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);',
        '  gl_Position = projectionMatrix * viewMatrix * worldPos;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 ambientLightColor;',
        'uniform float ambientIntensity;',
        'uniform vec3 dirLightColor;',
        'uniform vec3 dirLightDir;',
        'uniform float dirLightIntensity;',
        'uniform vec3 dirLight2Color;',
        'uniform vec3 dirLight2Dir;',
        'uniform float dirLight2Intensity;',
        'uniform vec3 cameraPos;',
        'varying vec3 vWorldPos;',
        'varying vec3 vWorldNormal;',
        'varying vec3 vLocalNormal;',
        'varying vec3 vLocalPos;',
        'void main(){',
        '  vec3 N = normalize(vWorldNormal);',
        '  vec3 V = normalize(cameraPos - vWorldPos);',
        '  vec3 LN = normalize(vLocalNormal);',
        '  vec3 baseColor;',
        '  float metalness;',
        '  float roughness;',
        '  float ny = abs(LN.y);',
        '  float nz = abs(LN.z);',
        '  float nx = abs(LN.x);',
        '  if (nx > 0.7 && ny < 0.5 && nz < 0.5) {',
        '    baseColor = vec3(0.82, 0.83, 0.85);',
        '    metalness = 1.0;',
        '    roughness = 0.2;',
        '  } else {',
        '    baseColor = vec3(0.72, 0.73, 0.76);',
        '    metalness = 0.95;',
        '    roughness = 0.3;',
        '  }',
        '  vec3 ambient = ambientLightColor * ambientIntensity * baseColor;',
        '  float NdotL1 = max(dot(N, dirLightDir), 0.0);',
        '  vec3 H1 = normalize(dirLightDir + V);',
        '  float spec1 = pow(max(dot(N, H1), 0.0), mix(8.0, 64.0, 1.0 - roughness));',
        '  vec3 diff1 = dirLightColor * dirLightIntensity * NdotL1 * baseColor * (1.0 - metalness);',
        '  vec3 specColor1 = mix(vec3(0.04), baseColor, metalness);',
        '  vec3 specular1 = dirLightColor * dirLightIntensity * spec1 * specColor1;',
        '  float NdotL2 = max(dot(N, dirLight2Dir), 0.0);',
        '  vec3 H2 = normalize(dirLight2Dir + V);',
        '  float spec2 = pow(max(dot(N, H2), 0.0), mix(8.0, 64.0, 1.0 - roughness));',
        '  vec3 diff2 = dirLight2Color * dirLight2Intensity * NdotL2 * baseColor * (1.0 - metalness);',
        '  vec3 specColor2 = mix(vec3(0.04), baseColor, metalness);',
        '  vec3 specular2 = dirLight2Color * dirLight2Intensity * spec2 * specColor2;',
        '  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0) * metalness * 0.4;',
        '  vec3 fresnelColor = baseColor * fresnel;',
        '  // 伪 IBL：根据反射向量采样天空渐变作为环境反射',
        '  vec3 R = reflect(-V, N);',
        '  float skyT = clamp(R.y * 0.5 + 0.5, 0.0, 1.0);',
        '  vec3 skyColor = mix(vec3(0.18, 0.20, 0.24), vec3(0.92, 0.95, 1.00), skyT);',
        '  vec3 envF0 = mix(vec3(0.04), baseColor, metalness);',
        '  vec3 envSpec = envF0 * skyColor * (1.0 - roughness * 0.7) * metalness;',
        '  vec3 finalColor = ambient + diff1 + specular1 + diff2 + specular2 + fresnelColor + envSpec;',
        '  finalColor = pow(finalColor, vec3(1.0/2.2));',
        '  gl_FragColor = vec4(finalColor, 1.0);',
        '}'
      ].join('\n')
    });
  }

  // 无铁芯定子磁铁块（黑色环氧）
  function createIronlessMagnetMaterial() {
    return createSimplePBRMaterial([0.06, 0.06, 0.07], 0.2, 0.15);
  }

  // 无铁芯动子线圈组件（Y > 0 黑色磨砂金属；Y <= 0 黑色环氧）
  function createIronlessMoverMaterial() {
    return new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: {
        ambientLightColor: { value: new THREE.Color(0xffffff) },
        ambientIntensity: { value: 0.5 },
        dirLightColor: { value: new THREE.Color(0xFFAA44) },
        dirLightDir: { value: new THREE.Vector3(-3, 8, 5).normalize() },
        dirLightIntensity: { value: 0.7 },
        dirLight2Color: { value: new THREE.Color(0x4488BB) },
        dirLight2Dir: { value: new THREE.Vector3(5, 5, -5).normalize() },
        dirLight2Intensity: { value: 0.4 },
        cameraPos: { value: new THREE.Vector3() }
      },
      vertexShader: [
        'varying vec3 vWorldPos;',
        'varying vec3 vWorldNormal;',
        'varying vec3 vLocalPos;',
        'void main(){',
        '  vLocalPos = position;',
        '  vec4 worldPos = modelMatrix * vec4(position, 1.0);',
        '  vWorldPos = worldPos.xyz;',
        '  vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);',
        '  gl_Position = projectionMatrix * viewMatrix * worldPos;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 ambientLightColor;',
        'uniform float ambientIntensity;',
        'uniform vec3 dirLightColor;',
        'uniform vec3 dirLightDir;',
        'uniform float dirLightIntensity;',
        'uniform vec3 dirLight2Color;',
        'uniform vec3 dirLight2Dir;',
        'uniform float dirLight2Intensity;',
        'uniform vec3 cameraPos;',
        'varying vec3 vWorldPos;',
        'varying vec3 vWorldNormal;',
        'varying vec3 vLocalPos;',
        'void main(){',
        '  vec3 N = normalize(vWorldNormal);',
        '  vec3 V = normalize(cameraPos - vWorldPos);',
        '  vec3 baseColor;',
        '  float metalness;',
        '  float roughness;',
        '  if (vLocalPos.y > 0.0) {',
        '    baseColor = vec3(0.08, 0.08, 0.09);',
        '    metalness = 0.95;',
        '    roughness = 0.35;',
        '  } else {',
        '    baseColor = vec3(0.08, 0.08, 0.09);',
        '    metalness = 0.2;',
        '    roughness = 0.15;',
        '  }',
        '  vec3 ambient = ambientLightColor * ambientIntensity * baseColor;',
        '  float NdotL1 = max(dot(N, dirLightDir), 0.0);',
        '  vec3 H1 = normalize(dirLightDir + V);',
        '  float spec1 = pow(max(dot(N, H1), 0.0), mix(8.0, 64.0, 1.0 - roughness));',
        '  vec3 diff1 = dirLightColor * dirLightIntensity * NdotL1 * baseColor * (1.0 - metalness);',
        '  vec3 specColor1 = mix(vec3(0.04), baseColor, metalness);',
        '  vec3 specular1 = dirLightColor * dirLightIntensity * spec1 * specColor1;',
        '  float NdotL2 = max(dot(N, dirLight2Dir), 0.0);',
        '  vec3 H2 = normalize(dirLight2Dir + V);',
        '  float spec2 = pow(max(dot(N, H2), 0.0), mix(8.0, 64.0, 1.0 - roughness));',
        '  vec3 diff2 = dirLight2Color * dirLight2Intensity * NdotL2 * baseColor * (1.0 - metalness);',
        '  vec3 specColor2 = mix(vec3(0.04), baseColor, metalness);',
        '  vec3 specular2 = dirLight2Color * dirLight2Intensity * spec2 * specColor2;',
        '  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0) * metalness * 0.4;',
        '  vec3 fresnelColor = baseColor * fresnel;',
        '  // 伪 IBL：根据反射向量采样天空渐变作为环境反射',
        '  vec3 R = reflect(-V, N);',
        '  float skyT = clamp(R.y * 0.5 + 0.5, 0.0, 1.0);',
        '  vec3 skyColor = mix(vec3(0.18, 0.20, 0.24), vec3(0.92, 0.95, 1.00), skyT);',
        '  vec3 envF0 = mix(vec3(0.04), baseColor, metalness);',
        '  vec3 envSpec = envF0 * skyColor * (1.0 - roughness * 0.7) * metalness;',
        '  vec3 finalColor = ambient + diff1 + specular1 + diff2 + specular2 + fresnelColor + envSpec;',
        '  finalColor = pow(finalColor, vec3(1.0/2.2));',
        '  gl_FragColor = vec4(finalColor, 1.0);',
        '}'
      ].join('\n')
    });
  }

  function loadGLB(url) {
    return new Promise(function(resolve) {
      var loader = new THREE.GLTFLoader();
      if (typeof MeshoptDecoder !== 'undefined') {
        loader.setMeshoptDecoder(MeshoptDecoder);
      }
      loader.load(url, function(gltf) {
        resolve(gltf.scene);
      }, undefined, function(err) {
        console.error('[motor-ironless-3d] GLB 加载失败:', url, err);
        resolve(null);
      });
    });
  }

  // 定子着色：按 mesh 的 z 跨度分组判定磁铁/框架（与 motor-control.html 一致）
  function applyStatorMaterials(model) {
    var frameMat = createIronlessFrameMaterial();
    var magnetMat = createIronlessMagnetMaterial();
    var meshList = [];
    var maxZSpan = 0;
    var minSignificantZSpan = Infinity;
    model.traverse(function(child) {
      if (child.isMesh) {
        child.geometry.computeBoundingBox();
        var box = child.geometry.boundingBox;
        var zSpan = box.max.z - box.min.z;
        meshList.push({ mesh: child, zSpan: zSpan });
        if (zSpan > maxZSpan) maxZSpan = zSpan;
        if (zSpan >= 3 && zSpan < minSignificantZSpan) minSignificantZSpan = zSpan;
      }
    });
    if (minSignificantZSpan === Infinity) minSignificantZSpan = maxZSpan;

    var spanGroups = {};
    meshList.forEach(function(item) {
      if (item.zSpan >= 3) {
        var key = Math.round(item.zSpan);
        if (!spanGroups[key]) spanGroups[key] = { count: 0, span: item.zSpan };
        spanGroups[key].count++;
      }
    });
    var magnetSpanKey = null;
    var maxCount = 0;
    Object.keys(spanGroups).forEach(function(key) {
      if (spanGroups[key].count > maxCount) {
        maxCount = spanGroups[key].count;
        magnetSpanKey = key;
      }
    });
    var magnetSpan = magnetSpanKey ? spanGroups[magnetSpanKey].span : 0;
    var hasMagnets = (maxCount >= 10) && (Math.round(magnetSpan) !== Math.round(maxZSpan));
    var magnetRoundKey = Math.round(magnetSpan);
    meshList.forEach(function(item) {
      var itemRoundKey = Math.round(item.zSpan);
      if (hasMagnets && item.zSpan >= 3 && itemRoundKey === magnetRoundKey) {
        item.mesh.material = magnetMat.clone();
      } else {
        item.mesh.material = frameMat.clone();
      }
    });
  }

  function buildMotor() {
    if (state.motorGroup) {
      state.scene.remove(state.motorGroup);
      state.motorGroup.traverse(function(obj) {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(function(m) { m.dispose(); });
          else obj.material.dispose();
        }
      });
      state.motorGroup = null;
    }

    state.motorGroup = new THREE.Group();
    Promise.all([loadGLB(STATOR_URL), loadGLB(MOVER_URL)]).then(function(results) {
      var statorScene = results[0];
      var moverScene = results[1];
      if (statorScene) {
        applyStatorMaterials(statorScene);
        state.motorGroup.add(statorScene);
      }
      if (moverScene) {
        var moverMat = createIronlessMoverMaterial();
        moverScene.traverse(function(child) {
          if (child.isMesh) child.material = moverMat.clone();
        });
        state.motorGroup.add(moverScene);
      }
      var bbox = new THREE.Box3().setFromObject(state.motorGroup);
      var size = bbox.getSize(new THREE.Vector3());
      var maxDim = Math.max(size.x, size.y, size.z) || 1;
      var scaleFactor = 4.0 / maxDim;
      state.motorGroup.scale.set(scaleFactor, scaleFactor, scaleFactor);
      bbox.setFromObject(state.motorGroup);
      var center = bbox.getCenter(new THREE.Vector3());
      state.motorGroup.position.sub(center);
      state.scene.add(state.motorGroup);
      state.camera.position.set(3.5, 2.2, 4.8);
      state.controls.target.set(0, 0, 0);
      state.controls.update();
      state.modelReady = true;
      if (state.loadingEl) state.loadingEl.style.display = 'none';
    });
  }

  function clearMotor() {
    if (state.motorGroup) {
      state.scene.remove(state.motorGroup);
      state.motorGroup.traverse(function(obj) {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(function(m) { m.dispose(); });
          else obj.material.dispose();
        }
      });
      state.motorGroup = null;
    }
  }

  var MotorIronless3D = {
    init: function(containerId) {
      var container = document.getElementById(containerId);
      if (!container) return;
      // 已初始化：把自己的 canvas 重新挂回容器（防止被其他渲染器 init 时移除）
      if (state.renderer) {
        state.container = container;
        while (container.firstChild && container.firstChild !== state.renderer.domElement) {
          container.removeChild(container.firstChild);
        }
        if (state.renderer.domElement.parentNode !== container) {
          container.appendChild(state.renderer.domElement);
        }
        state.renderer.setSize(container.clientWidth, container.clientHeight);
        state.camera.aspect = container.clientWidth / container.clientHeight;
        state.camera.updateProjectionMatrix();
        if (state.ro) { state.ro.disconnect(); state.ro.observe(container); }
        return;
      }
      state.container = container;
      state.loadingEl = document.getElementById('module-3d-loading');
      if (state.loadingEl) state.loadingEl.style.display = '';

      state.scene = new THREE.Scene();
      state.scene.background = null;

      state.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
      state.camera.position.set(3.5, 2.2, 4.8);

      state.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      state.renderer.setSize(container.clientWidth, container.clientHeight);
      state.renderer.setClearColor(0x000000, 0);
      state.renderer.setPixelRatio(window.devicePixelRatio);
      state.renderer.outputEncoding = THREE.sRGBEncoding;
      state.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      state.renderer.toneMappingExposure = 1.5;
      while (container.firstChild) container.removeChild(container.firstChild);
      container.appendChild(state.renderer.domElement);

      state.controls = new THREE.OrbitControls(state.camera, state.renderer.domElement);
      state.controls.enableDamping = true;
      state.controls.dampingFactor = 0.05;
      state.controls.enableZoom = false;
      state.controls.autoRotate = true;
      state.controls.autoRotateSpeed = 0.6;

      var idleTimer = null;
      function onUserInteract() {
        state.controls.autoRotate = false;
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(function() { state.controls.autoRotate = true; }, 1000);
      }
      state.renderer.domElement.addEventListener('pointerdown', onUserInteract);
      state.renderer.domElement.addEventListener('wheel', function(e) { e.preventDefault(); onUserInteract(); }, { passive: false });

      state.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
      var dirLight = new THREE.DirectionalLight(0xFFAA44, 0.7);
      dirLight.position.set(-3, 8, 5);
      state.scene.add(dirLight);
      var dirLight2 = new THREE.DirectionalLight(0x4488BB, 0.4);
      dirLight2.position.set(5, 5, -5);
      state.scene.add(dirLight2);
      var fillLight = new THREE.DirectionalLight(0xE8A838, 0.3);
      fillLight.position.set(0, -8, 0);
      state.scene.add(fillLight);

      if (!state.animating) {
        state.animating = true;
        (function animate() {
          requestAnimationFrame(animate);
          if (state.controls) state.controls.update();
          if (state.renderer && state.scene && state.camera) {
            state.scene.traverse(function(child) {
              if (child.isMesh && child.material && child.material.uniforms && child.material.uniforms.cameraPos) {
                child.material.uniforms.cameraPos.value.copy(state.camera.position);
              }
            });
            state.renderer.render(state.scene, state.camera);
          }
        })();
      }

      if (state.ro) state.ro.disconnect();
      state.ro = new ResizeObserver(function() {
        var w = container.clientWidth;
        var h = container.clientHeight;
        if (w === 0 || h === 0) return;
        state.camera.aspect = w / h;
        state.camera.updateProjectionMatrix();
        state.renderer.setSize(w, h);
      });
      state.ro.observe(container);
    },

    show: function(typeKey) {
      var key = typeKey || 'ironless';
      if (state.lastTypeKey === key && state.motorGroup) return;
      state.lastTypeKey = key;
      buildMotor();
    },

    clear: function() {
      state.lastTypeKey = null;
      clearMotor();
    }
  };

  window.MotorIronless3D = MotorIronless3D;
})();
