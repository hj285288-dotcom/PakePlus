
(function() {
  'use strict';

  var HOLE_CONFIG = {
    A: 35,
    P_PITCH: 200,
    HOLE_RADIUS: 4.81,
    HOLE_DEPTH: 32,
    ROW_X: [-46.5, 46.5],
    BASE_LENGTH: 200
  };

  function calcProfileHoles(stroke, motorLength, moversCount, moverZLength) {
    motorLength = motorLength || 100;
    moversCount = moversCount || 1;
    moverZLength = moverZLength || 111.3;
    var profileLength = stroke + motorLength + 68;
    if (moversCount > 1) {
      profileLength += (moversCount - 1) * (moverZLength + 34);
    }
    var P = 0;
    if (stroke >= 200) {
      P = 1 + 2 * Math.floor((stroke - 200) / 400);
    }
    var BC = (profileLength - 2 * HOLE_CONFIG.A - P * HOLE_CONFIG.P_PITCH) / 2;
    var N = (P + 3) * 2;
    var halfLen = profileLength / 2;
    var holeZPositions = [];
    holeZPositions.push(-halfLen + HOLE_CONFIG.A);
    holeZPositions.push(-halfLen + HOLE_CONFIG.A + BC);
    var midStart = -halfLen + HOLE_CONFIG.A + BC;
    for (var i = 1; i <= P; i++) {
      holeZPositions.push(midStart + i * HOLE_CONFIG.P_PITCH);
    }
    holeZPositions.push(halfLen - HOLE_CONFIG.A - BC);
    holeZPositions.push(halfLen - HOLE_CONFIG.A);
    holeZPositions = Array.from(new Set(holeZPositions.map(function(z) { return Math.round(z * 10) / 10; }))).sort(function(a, b) { return a - b; });
    return { profileLength: profileLength, P: P, BC: BC, N: N, holeZPositions: holeZPositions };
  }

  var state = {
    container: null,
    loadingEl: null,
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    profileModel: null,
    endCapModel: null,
    motorModelCache: {},
    moduleGroup: null,
    modelReady: false,
    modelsLoaded: 0,
    MODELS_TOTAL: 2,
    ro: null,
    // 当前 3D 显示对应的电机类型 key（电机类型变化时才重建）
    lastTypeKey: null
  };

  function loadMotorModel(motorNum) {
    var key = 'MTB-' + motorNum;
    if (state.motorModelCache[key] !== undefined) {
      return Promise.resolve(state.motorModelCache[key]);
    }
    var fileName = 'models/' + key + '.glb';
    return new Promise(function(resolve) {
      var loader = new THREE.GLTFLoader();
      if (typeof MeshoptDecoder !== 'undefined') {
        loader.setMeshoptDecoder(MeshoptDecoder);
      }
      loader.load(fileName, function(gltf) {
        var motorScene = gltf.scene;
        var motorAluminumMat = new THREE.MeshStandardMaterial({
          color: 0x1A1A1A, metalness: 0.75, roughness: 0.3
        });
        motorScene.traverse(function(child) {
          if (!child.isMesh) return;
          child.material = motorAluminumMat;
        });
        var bbox = new THREE.Box3().setFromObject(motorScene);
        var rawZLength = bbox.max.z - bbox.min.z;
        var correctedZLength = (motorNum === 3) ? 100 : rawZLength;
        var motorData = {
          scene: motorScene,
          zMin: bbox.min.z,
          zMax: bbox.max.z,
          zLength: correctedZLength
        };
        state.motorModelCache[key] = motorData;
        resolve(motorData);
      }, undefined, function(err) {
        state.motorModelCache[key] = null;
        resolve(null);
      });
    });
  }

  function checkAllModelsLoaded() {
    state.modelsLoaded++;
    if (state.modelsLoaded >= state.MODELS_TOTAL) {
      state.modelReady = true;
      if (state.loadingEl) state.loadingEl.style.display = 'none';
    }
  }

  function preLoadAssets() {
    var loader = new THREE.GLTFLoader();
    if (typeof MeshoptDecoder !== 'undefined') {
      loader.setMeshoptDecoder(MeshoptDecoder);
    }
    loader.load('models/178.glb', function(gltf) {
      state.profileModel = gltf.scene;
      checkAllModelsLoaded();
    }, undefined, function(err) {
      checkAllModelsLoaded();
    });
    loader.load('models/178-duangaiban.glb', function(gltf) {
      state.endCapModel = gltf.scene;
      var capBodyMat = new THREE.MeshStandardMaterial({ color: 0x1A1A1A, metalness: 0.75, roughness: 0.3 });
      var bumperMat = new THREE.MeshStandardMaterial({ color: 0x0A0A0A, metalness: 0.0, roughness: 0.85 });
      var steelPlateMat = new THREE.MeshStandardMaterial({ color: 0x3A3A3A, metalness: 0.6, roughness: 0.55 });
      state.endCapModel.traverse(function(child) {
        if (!child.isMesh) return;
        if (child.name === 'empty_4') {
          child.material = capBodyMat;
        } else if (child.name === 'empty_2' || child.name === 'empty_3') {
          child.material = bumperMat;
        } else if (child.name === 'empty_5' || child.name === 'empty_6') {
          child.material = steelPlateMat;
        }
      });
      checkAllModelsLoaded();
    }, undefined, function(err) {
      checkAllModelsLoaded();
    });
  }

  function buildFixedModule() {
    if (!state.profileModel) return;
    loadMotorModel(6).then(function(motorData) {
      _buildModule(600, 178, motorData, 6, 1);
    });
  }

  function _buildModule(stroke, profileWidth, motorData, motorNum, moversCount) {
    if (!state.profileModel) return;

    if (state.moduleGroup) {
      state.scene.remove(state.moduleGroup);
      state.moduleGroup.traverse(function(obj) {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(function(m) { m.dispose(); });
          else obj.material.dispose();
        }
      });
    }
    state.moduleGroup = new THREE.Group();
    state.moduleGroup.rotation.y = Math.PI;

    var motorLength = Math.round((motorNum / 3) * 50 + 50);

    var holeData = calcProfileHoles(stroke, motorLength, moversCount, motorData ? motorData.zLength : 100);
    var targetLength = holeData.profileLength;
    var zScale = targetLength / HOLE_CONFIG.BASE_LENGTH;

    var profileClone = state.profileModel.clone();
    var profileOrigZCenter = (251 + 451) / 2;
    profileClone.position.z = -profileOrigZCenter * zScale;
    profileClone.position.y = 1;
    profileClone.scale.set(1, 1, zScale);

    var anodizedMat = new THREE.MeshStandardMaterial({ color: 0x1A1A1A, metalness: 0.75, roughness: 0.3, envMapIntensity: 0.8 });
    var milledAluminumMat = new THREE.MeshStandardMaterial({ color: 0xD0D0D0, metalness: 0.85, roughness: 0.15, envMapIntensity: 1.0 });

    profileClone.traverse(function(child) {
      if (!child.isMesh) return;
      var geo = child.geometry;
      var posAttr = geo.attributes.position;
      var normAttr = geo.attributes.normal;
      var indexAttr = geo.index;
      if (!posAttr || !normAttr || !indexAttr) {
        child.material = anodizedMat;
        return;
      }
      var indices = indexAttr.array;
      var triCount = indices.length / 3;
      var milledIndices = [];
      var anodizedIndices = [];
      for (var ti = 0; ti < triCount; ti++) {
        var idx0 = indices[ti * 3];
        var idx1 = indices[ti * 3 + 1];
        var idx2 = indices[ti * 3 + 2];
        var ny0 = normAttr.getY(idx0);
        var ny1 = normAttr.getY(idx1);
        var ny2 = normAttr.getY(idx2);
        var avgNy = (ny0 + ny1 + ny2) / 3;
        var y0 = posAttr.getY(idx0);
        var y1 = posAttr.getY(idx1);
        var y2 = posAttr.getY(idx2);
        var avgY = (y0 + y1 + y2) / 3;
        var avgNx = (normAttr.getX(idx0) + normAttr.getX(idx1) + normAttr.getX(idx2)) / 3;
        var avgX = (posAttr.getX(idx0) + posAttr.getX(idx1) + posAttr.getX(idx2)) / 3;
        var maxAbsX = Math.max(Math.abs(posAttr.getX(idx0)), Math.abs(posAttr.getX(idx1)), Math.abs(posAttr.getX(idx2)));
        var isTopFace = (avgNy > 0.9) && (avgY > 56);
        var isOuterSideFace = (avgNx < -0.9) && (maxAbsX > 83) && (avgY > 33) && (avgX < 0);
        var isMilled = isTopFace || isOuterSideFace;
        if (isMilled) {
          milledIndices.push(idx0, idx1, idx2);
        } else {
          anodizedIndices.push(idx0, idx1, idx2);
        }
      }
      geo.clearGroups();
      geo.addGroup(0, anodizedIndices.length, 0);
      geo.addGroup(anodizedIndices.length, milledIndices.length, 1);
      var newIndices = new Uint32Array(anodizedIndices.length + milledIndices.length);
      newIndices.set(anodizedIndices, 0);
      newIndices.set(milledIndices, anodizedIndices.length);
      geo.setIndex(new THREE.BufferAttribute(newIndices, 1));
      child.material = [anodizedMat, milledAluminumMat];
    });

    state.moduleGroup.add(profileClone);
    var halfTarget = targetLength / 2;

    if (state.endCapModel) {
      var capAlignZ = -451;
      var leftCap = state.endCapModel.clone();
      leftCap.position.z = -halfTarget - capAlignZ;
      leftCap.position.y = 1;
      state.moduleGroup.add(leftCap);
      var rightCap = state.endCapModel.clone();
      rightCap.rotation.y = Math.PI;
      rightCap.position.z = halfTarget + capAlignZ;
      rightCap.position.y = 1;
      state.moduleGroup.add(rightCap);
    }

    var steelBandGeo = new THREE.BoxGeometry(142, 0.2, targetLength);
    var steelBandMat = new THREE.MeshStandardMaterial({ color: 0xb0b0b0, metalness: 0.7, roughness: 0.4 });
    var steelBand = new THREE.Mesh(steelBandGeo, steelBandMat);
    steelBand.position.set(0, 85.1, 0);
    state.moduleGroup.add(steelBand);

    var holeMaterial = new THREE.MeshStandardMaterial({ color: 0x050505, metalness: 0.0, roughness: 1.0, transparent: false });
    var holeGeometry = new THREE.CylinderGeometry(HOLE_CONFIG.HOLE_RADIUS, HOLE_CONFIG.HOLE_RADIUS, HOLE_CONFIG.HOLE_DEPTH + 2, 16);
    HOLE_CONFIG.ROW_X.forEach(function(xPos) {
      holeData.holeZPositions.forEach(function(zPos) {
        var hole = new THREE.Mesh(holeGeometry, holeMaterial);
        hole.position.set(xPos, HOLE_CONFIG.HOLE_DEPTH / 2 + 1, zPos);
        state.moduleGroup.add(hole);
      });
    });

    if (motorData && motorData.scene) {
      var motorZMin = motorData.zMin;
      var motorZLength = motorData.zLength;
      var firstMotorZ = (-halfTarget + 34) - motorZMin;
      var spacing = motorZLength + 34;
      for (var mi = 0; mi < moversCount; mi++) {
        var motorClone = motorData.scene.clone();
        motorClone.position.set(0, 0, firstMotorZ + mi * spacing);
        state.moduleGroup.add(motorClone);
      }
    }

    var groupBox = new THREE.Box3().setFromObject(state.moduleGroup);
    var groupSize = groupBox.getSize(new THREE.Vector3());
    var maxDim = Math.max(groupSize.x, groupSize.y, groupSize.z);
    var scaleFactor = 4.2 / maxDim;
    state.moduleGroup.scale.set(scaleFactor, scaleFactor, scaleFactor);

    groupBox.setFromObject(state.moduleGroup);
    var groupCenter = groupBox.getCenter(new THREE.Vector3());
    state.moduleGroup.position.sub(groupCenter);

    state.scene.add(state.moduleGroup);

    state.camera.position.set(3.5, 2.2, 4.8);
    state.controls.target.set(0, 0, 0);
    state.controls.update();
  }

  function clearModule() {
    if (state.moduleGroup) {
      state.scene.remove(state.moduleGroup);
      state.moduleGroup.traverse(function(obj) {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(function(m) { m.dispose(); });
          else obj.material.dispose();
        }
      });
      state.moduleGroup = null;
    }
    state.camera.position.set(3, 2, 5);
    state.controls.target.set(0, 0, 0);
    state.controls.update();
  }

  var Module3D = {
    init: function(containerId) {
      var container = document.getElementById(containerId);
      if (!container) return;
      // 已初始化：确保自己的 canvas 重新挂回容器（避免被其他渲染器 init 时移除）
      if (state.renderer) {
        state.container = container;
        // 清掉容器里其他渲染器的 canvas
        while (container.firstChild && container.firstChild !== state.renderer.domElement) {
          container.removeChild(container.firstChild);
        }
        if (state.renderer.domElement.parentNode !== container) {
          container.appendChild(state.renderer.domElement);
        }
        // 重置尺寸
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
      // 清空容器避免其他渲染器残留 canvas
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

      preLoadAssets();

      function animate() {
        requestAnimationFrame(animate);
        state.controls.update();
        state.renderer.render(state.scene, state.camera);
      }
      animate();

      if (state.ro) state.ro.disconnect();
      state.ro = new ResizeObserver(function() {
        var w = container.clientWidth;
        var h = container.clientHeight;
        state.camera.aspect = w / h;
        state.camera.updateProjectionMatrix();
        state.renderer.setSize(w, h);
      });
      state.ro.observe(container);
    },

    show: function(typeKey) {
      // 默认 key（向后兼容旧调用）
      var key = typeKey || 'default';

      // 已经显示同一 type 且 moduleGroup 还在 → 不重建（保留用户视角与状态）
      if (state.lastTypeKey === key && state.moduleGroup) {
        return;
      }

      if (!state.modelReady) {
        var waitReady = setInterval(function() {
          if (state.modelReady) {
            clearInterval(waitReady);
            state.lastTypeKey = key;
            buildFixedModule();
          }
        }, 100);
        return;
      }
      state.lastTypeKey = key;
      buildFixedModule();
    },

    clear: function() {
      state.lastTypeKey = null;
      clearModule();
    }
  };

  window.Module3D = Module3D;
})();
