/**
 * PDF 依赖按需加载器
 * 
 * 使用方式：
 *   点击 PDF 按钮时调用 await ensurePdfReady()，首次调用会动态注入所有依赖脚本，
 *   后续调用直接返回已完成的 Promise。
 * 
 * 依赖加载顺序（保证执行顺序）：
 *   1. subset-font.umd.js（WASM 字体子集化库）
 *   2. NotoSansSC-Full.ttf.js（9.5MB 完整中文字体 base64）
 *   3. jspdf.umd.min.js（PDF 生成核心库）
 *   4. [页面类型判断] 若为子页面（control/motor-control），额外加载 echarts + sim-curves
 *   5. pdf-generate.js（PDF 报告生成主逻辑）
 *   6. pdf-dialog.js（PDF 对话框 UI）
 */
(function () {
  'use strict';

  var loadingPromise = null; // 单例：防止重复加载

  /**
   * 动态注入 script 标签并返回 Promise
   * @param {string} src - 脚本路径
   * @returns {Promise<void>}
   */
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.async = false; // 关键：保持顺序执行
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error('加载失败: ' + src)); };
      document.head.appendChild(script);
    });
  }

  /**
   * 检测当前页面类型
   * @returns {'index'|'control'|'motor-control'}
   */
  function detectPageType() {
    var path = (window.location.pathname || '').toLowerCase();
    if (path.indexOf('motor-control') >= 0) return 'motor-control';
    if (path.indexOf('control') >= 0) return 'control';
    return 'index';
  }

  /**
   * 按需加载 PDF 依赖（Promise 单例）
   * @returns {Promise<void>}
   */
  function ensurePdfReady() {
    // 已加载过，直接返回缓存的 Promise
    if (loadingPromise) return loadingPromise;

    var pageType = detectPageType();
    var isSubPage = (pageType === 'control' || pageType === 'motor-control');

    // 启动加载流水线（按顺序依次注入脚本）
    loadingPromise = Promise.resolve()
      .then(function () {
        // Step 1: 字体子集化库（WASM，约 830KB）
        return loadScript('lib/subset-font.umd.js');
      })
      .then(function () {
        // Step 2: 完整中文字体 base64（9.5MB，耗时最长）
        return loadScript('lib/NotoSansSC-Full.ttf.js');
      })
      .then(function () {
        // Step 3: jsPDF 核心库（360KB）
        return loadScript('lib/jspdf.umd.min.js');
      })
      .then(function () {
        // Step 4: 子页面需要 echarts + sim-curves（主页面已在 <head> 同步加载）
        if (isSubPage) {
          return loadScript('echarts.min.js')
            .then(function () { return loadScript('sim-curves.js'); });
        }
        return Promise.resolve();
      })
      .then(function () {
        // Step 5: PDF 报告生成主逻辑
        return loadScript('pdf-generate.js');
      })
      .then(function () {
        // Step 6: PDF 对话框 UI
        return loadScript('pdf-dialog.js');
      })
      .catch(function (err) {
        // 加载失败：清空缓存，允许用户重试
        loadingPromise = null;
        throw err;
      });

    return loadingPromise;
  }

  // 暴露全局接口
  window.ensurePdfReady = ensurePdfReady;
})();
