/**
 * 有铁芯直线电机 3D 渲染模块
 * 加载 motor-models/iron-core/MTA-6.glb（目录名已改为英文以兼容 macOS DMG）
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
    motorModel: null,
    modelReady: false,
    ro: null,
    lastTypeKey: null,
    animating: false
  };

  var FOLDER = 'motor-models/iron-core/';
  var STATOR_URL = FOLDER + 'MTA-stator.glb';
  var MOVER_URL = FOLDER + 'MTA-6.glb';

  // 与 motor-control.html createStatorMaterial 完全一致
  // Z > zThreshold = 黑色环氧；Z <= zThreshold = 镀镍暖黄
  function createStatorMaterial(zThreshold) {
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
        zThreshold: { value: zThreshold }
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
        'uniform float zThreshold;',
        'varying vec3 vWorldPos;',
        'varying vec3 vWorldNormal;',
        'varying vec3 vLocalPos;',
        'void main(){',
        '  vec3 N = normalize(vWorldNormal);',
        '  vec3 V = normalize(cameraPos - vWorldPos);',
        '  vec3 baseColor;',
        '  float metalness;',
        '  float roughness;',
        '  if (vLocalPos.z > zThreshold) {',
        '    baseColor = vec3(0.08, 0.08, 0.09);',
        '    metalness = 0.3;',
        '    roughness = 0.1;',
        '  } else {',
        '    baseColor = vec3(0.72, 0.66, 0.50);',
        '    metalness = 1.0;',
        '    roughness = 0.35;',
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
        '  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0) * metalness * 0.5;',
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

  // 与 motor-control.html createMoverMaterial 完全一致
  // Z > zThreshold = 镀镍顶板；Z <= zThreshold = 黑色环氧
  function createMoverMaterial(zThreshold) {
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
        zThreshold: { value: zThreshold }
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
        'uniform float zThreshold;',
        'varying vec3 vWorldPos;',
        'varying vec3 vWorldNormal;',
        'varying vec3 vLocalPos;',
        'void main(){',
        '  vec3 N = normalize(vWorldNormal);',
        '  vec3 V = normalize(cameraPos - vWorldPos);',
        '  vec3 baseColor;',
        '  float metalness;',
        '  float roughness;',
        '  bool isNickel = (vLocalPos.z > zThreshold);',
        '  if (isNickel) {',
        '    baseColor = vec3(0.72, 0.66, 0.50);',
        '    metalness = 1.0;',
        '    roughness = 0.35;',
        '  } else {',
        '    baseColor = vec3(0.08, 0.08, 0.09);',
        '    metalness = 0.3;',
        '    roughness = 0.1;',
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
        '  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0) * metalness * 0.5;',
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
        console.error('[motor-iron-3d] GLB 加载失败:', url, err);
        resolve(null);
      });
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
    // 与 motor-control.html 完全一致：定子 + 动子 分开加载着色
    Promise.all([loadGLB(STATOR_URL), loadGLB(MOVER_URL)]).then(function(results) {
      var statorScene = results[0];
      var moverScene = results[1];
      if (statorScene) {
        var statorMat = createStatorMaterial(4.0);
        statorScene.traverse(function(child) {
          if (child.isMesh) child.material = statorMat.clone();
        });
        state.motorGroup.add(statorScene);
      }
      if (moverScene) {
        var moverMat = createMoverMaterial(39.5);
        moverScene.traverse(function(child) {
          if (child.isMesh) child.material = moverMat.clone();
        });
        state.motorGroup.add(moverScene);
      }
      // 整体自适应缩放与居中
      var bbox = new THREE.Box3().setFromObject(state.motorGroup);
      var size = bbox.getSize(new THREE.Vector3());
      var maxDim = Math.max(size.x, size.y, size.z) || 1;
      var scaleFactor = 4.0 / maxDim;
      state.motorGroup.scale.set(scaleFactor, scaleFactor, scaleFactor);
      bbox.setFromObject(state.motorGroup);
      var center = bbox.getCenter(new THREE.Vector3());
      state.motorGroup.position.sub(center);
      state.scene.add(state.motorGroup);
      // 相机：仰视角，Y 再低一些使仰角更明显
      state.camera.position.set(3.0, -3.7, 4.2);
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

  var MotorIron3D = {
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
            // 每帧更新 ShaderMaterial 的 cameraPos uniform（PBR 高光/菲涅尔需要）
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
      var key = typeKey || 'iron';
      if (state.lastTypeKey === key && state.motorGroup) return;
      state.lastTypeKey = key;
      buildMotor();
    },

    clear: function() {
      state.lastTypeKey = null;
      clearMotor();
    }
  };

  window.MotorIron3D = MotorIron3D;
})();
