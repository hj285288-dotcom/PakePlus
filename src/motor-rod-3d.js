/**
 * 轴棒电机 3D 渲染模块
 * 完整复刻 motor-control.html 中轴棒电机系列(MD8/MD16/MD25/MD30)的渲染方式：
 *   - 加载 MD30-12.glb（无定子，仅动子）
 *   - 按 mesh 形状分色：圆柱形 (Y/Z 跨度接近且较大) = 冷银色不锈钢；其余 = 黑色磨砂
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

  var FOLDER = 'motor-models/rod/';
  var MOVER_URL = FOLDER + 'MD30-12.glb';

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
        console.error('[motor-rod-3d] GLB 加载失败:', url, err);
        resolve(null);
      });
    });
  }

  // 轴棒电机动子着色：与 motor-control.html 完全一致
  // 圆柱/轴：Y 与 Z 跨度接近（比率 < 1.3）且 max(Y,Z) > 5 → 银色
  // 其他 → 黑色
  function applyRodMaterials(model) {
    var rodSilverMat = createSimplePBRMaterial([0.72, 0.73, 0.76], 0.95, 0.3);
    var rodBlackMat = createSimplePBRMaterial([0.08, 0.08, 0.09], 0.85, 0.55);
    model.traverse(function(child) {
      if (!child.isMesh) return;
      child.geometry.computeBoundingBox();
      var box = child.geometry.boundingBox;
      var ySpan = box.max.y - box.min.y;
      var zSpan = box.max.z - box.min.z;
      var maxYZ = Math.max(ySpan, zSpan);
      var yzRatio = (ySpan > 0.1 && zSpan > 0.1) ? Math.max(ySpan, zSpan) / Math.min(ySpan, zSpan) : 99;
      var isShaft = (maxYZ > 5) && (yzRatio < 1.3);
      child.material = isShaft ? rodSilverMat.clone() : rodBlackMat.clone();
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
    loadGLB(MOVER_URL).then(function(moverScene) {
      if (moverScene) {
        applyRodMaterials(moverScene);
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

  var MotorRod3D = {
    init: function(containerId) {
      var container = document.getElementById(containerId);
      if (!container) return;
      // 已初始化：把自己的 canvas 重新挂回容器
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
      var key = typeKey || 'rod';
      if (state.lastTypeKey === key && state.motorGroup) return;
      state.lastTypeKey = key;
      buildMotor();
    },

    clear: function() {
      state.lastTypeKey = null;
      clearMotor();
    }
  };

  window.MotorRod3D = MotorRod3D;
})();
