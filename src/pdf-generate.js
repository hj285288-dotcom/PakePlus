/**
 * PDF 报告生成器 — 专业工程选型报告
 * 依赖：
 *   - jspdf.umd.min.js（必须）
 *   - NotoSansSC-Regular-normal.js（中文子集字体）
 *   - 页面已加载 app.js（含 gv / S / fm 等全局函数）
 *
 *  暴露：
 *   window.generateIndexPDF(formData, opts?) → Promise<void>
 *     formData: { customer, project, salesman, remark }
 *     opts.fileHandle: 可选，来自 showSaveFilePicker() 的 FileSystemFileHandle。
 *                     若提供则把最终 PDF 写入该 handle（用于在用户手势栈里预先
 *                     拿到路径，绕过异步流程后手势失效的问题）；未提供时回退到
 *                     savePdfWithPicker() 内部的 doc.save 兜底下载。
 *     opts.onProgress: 可选，进度回调 onProgress(label, percent)。
 *                     percent: 0-100 数字。用于在 UI 上显示阶段提示。
 */
(function () {
  'use strict';

  // === 调色板（专业工程报告风格） ===
  var COLOR_TITLE       = [30, 41, 59];      // #1E293B 深蓝灰（标题）
  var COLOR_TEXT        = [15, 23, 42];      // #0F172A 正文
  var COLOR_TEXT_SUB    = [100, 116, 139];   // #64748B key文字/副文字
  var COLOR_ACCENT      = [154, 195, 94];    // #9AC35E 品牌绿竖条
  var COLOR_LINE        = [226, 232, 240];   // #E2E8F0 分隔线
  var COLOR_LINE_DARK   = [71, 85, 105];     // #475569 页眉分隔线
  var COLOR_BG_CARD     = [248, 250, 252];   // #F8FAFC 浅灰卡片背景
  var COLOR_WHITE       = [255, 255, 255];

  var FONT_CN = 'NotoSansSC-Regular';

  // === 语言辅助：按当前 _moen_lang 返回中文或英文 ===
  function L(zh, en) {
    return (typeof _moen_lang !== 'undefined' && _moen_lang === 'en') ? en : zh;
  }
  // 曲线 Y 轴标签（依赖 sim-curves.js 提供的 _curveYName / _curveLabel）
  function _cy(k) {
    if (typeof _curveYName === 'function') return _curveYName(k);
    var m = CURVE_META && CURVE_META[k];
    return m ? m.yNameZh : k;
  }
  function _cl(k) {
    if (typeof _curveLabel === 'function') return _curveLabel(k);
    var m = CURVE_META && CURVE_META[k];
    return m ? m.yNameZh : k;
  }

  // === A4 尺寸（mm，纵向） ===
  var PAGE_W = 210;
  var PAGE_H = 297;
  var MARGIN_L = 14;
  var MARGIN_R = 14;
  var MARGIN_T = 14;
  var MARGIN_B = 16;
  var CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;

  /**
   * 获取 jsPDF 构造器（兼容 UMD）
   */
  function getJsPDFCtor() {
    if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
    if (window.jsPDF) return window.jsPDF;
    return null;
  }

  /**
   * 读取 DOM/S 状态的值
   */
  function safeGv(id) {
    try {
      var el = document.getElementById(id);
      if (!el) return 0;
      var v = parseFloat(el.value);
      return isNaN(v) ? 0 : v;
    } catch (e) { return 0; }
  }

  function fmt(v, d) {
    if (v === undefined || v === null || isNaN(v)) return '—';
    if (typeof d !== 'number') d = 2;
    return Number(v).toFixed(d);
  }

  function todayStr() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function safeStr(v) {
    if (v === undefined || v === null) return '';
    return String(v);
  }

  /**
   * 识别当前页面类型
   *   'index'          → 电机选型主页
   *   'control'        → 模组控制方案页（直线电机模组配置）
   *   'motor-control'  → 电机控制方案页（动定子配置）
   */
  function detectPageType() {
    var path = (window.location.pathname || '').toLowerCase();
    if (path.indexOf('motor-control') >= 0) return 'motor-control';
    if (path.indexOf('control') >= 0) return 'control';
    return 'index';
  }

  /**
   * 收集配置页数据（模组型号 + 型号解析）
   */
  function collectConfigData() {
    var modelEl = document.getElementById('model-output');
    var analysisEl = document.getElementById('model-analysis');
    var modelCode = modelEl ? (modelEl.textContent || '').trim() : '';
    // 解析 analysis：innerText 保留换行结构
    var analysisText = '';
    if (analysisEl) {
      // 使用 innerText（浏览器会保留换行），并按行拆分
      analysisText = (analysisEl.innerText || analysisEl.textContent || '').trim();
    }
    var lines = analysisText.split(/\r?\n/).map(function(s){ return s.trim(); }).filter(function(s){ return s.length > 0; });

    // === 定子方案（仅 motor-control 且有效行程有值时存在）===
    var statorPlanLines = [];
    var statorPlanDist = '';
    var planWrap = document.getElementById('stator-plan-wrap');
    var planEl = document.getElementById('stator-plan');
    var planDistEl = document.getElementById('stator-plan-dist');
    var strokeEl = document.getElementById('mc-stroke');
    var strokeVal = strokeEl ? parseFloat(strokeEl.value) : NaN;
    var strokeValid = !isNaN(strokeVal) && strokeVal > 0;
    // 仅当定子方案容器未隐藏 且 有效行程有效时才输出
    if (strokeValid && planEl && planWrap && !planWrap.classList.contains('hidden')) {
      // 通过子 div 逐行读取，避免 NBSP 在 innerText 被规范化丢量
      var divs = planEl.querySelectorAll('div');
      if (divs && divs.length > 0) {
        for (var di = 0; di < divs.length; di++) {
          var line = (divs[di].textContent || '').trim();
          if (line) statorPlanLines.push(line);
        }
      }
      // 兑底：如果没拿到 <div>，退回 innerText
      if (statorPlanLines.length === 0) {
        var planText = (planEl.innerText || planEl.textContent || '').trim();
        if (planText) {
          statorPlanLines = planText.split(/\r?\n/).map(function(s){ return s.trim(); }).filter(function(s){ return s.length > 0; });
        }
      }
      if (planDistEl) {
        statorPlanDist = (planDistEl.textContent || '').trim();
      }
    }

    return {
      modelCode: modelCode,
      analysisLines: lines,
      statorPlanLines: statorPlanLines,
      statorPlanDist: statorPlanDist,
      strokeValid: strokeValid
    };
  }

  /**
   * 主入口
   * formData = { customer, project, salesman, remark }
   * 页面顺序：
   *   index.html:     1 信息表 → 2 曲线(s+v, v+a[+j], F+I) — 中间图按 jerk 启用动态
   *   control/mc:    1 信息表 → 2 曲线(s+v, v+a[+j], F+I) → 3 配置页
   */
  // =========================================================================
  //  字符扫描：把渲染时收集到的字符串合并 + 加固定字符集，返回去重字符串
  // =========================================================================
  function scanUsedChars(capturedTexts) {
    var seen = Object.create(null);
    // 硬编码进入子集的字符集：ASCII 可打印 + 常用中文/西文标点 + 单位符号
    // 目的：即便扫描漏掉，避免线上出现"某个符号显示不出"的情况
    var extra = '';
    for (var i = 0x20; i <= 0x7E; i++) extra += String.fromCharCode(i);
    extra += ' \n\r\t\u00A0\u2002\u2003\u3000';
    extra += '\u3001\u3002\u300A\u300B\u2014\u2013\u2018\u2019\u201C\u201D\u2026';
    extra += '\uFF01\uFF08\uFF09\uFF0C\uFF1A\uFF1B\uFF1F';
    extra += '\u00B0\u00B2\u00B3\u00B5\u00D7\u00F7\u2103\u03A9\u00B1';
    for (var e = 0; e < extra.length; e++) {
      var ecp = extra.codePointAt(e);
      if (ecp > 0xFFFF) e++;
      seen[ecp] = 1;
    }
    // 收集所有 doc.text 参数中的字符
    if (capturedTexts && capturedTexts.length) {
      for (var pi = 0; pi < capturedTexts.length; pi++) {
        var s = capturedTexts[pi];
        if (typeof s !== 'string') continue;
        for (var k = 0; k < s.length; k++) {
          var cp = s.codePointAt(k);
          if (cp > 0xFFFF) k++;
          seen[cp] = 1;
        }
      }
    }
    var out = '';
    var codes = Object.keys(seen);
    for (var ci = 0; ci < codes.length; ci++) {
      out += String.fromCodePoint(parseInt(codes[ci], 10));
    }
    return out;
  }

  // =========================================================================
  //  异步子集化字体并注册到 jsPDF，返回注册名
  //  依赖：window.subsetFont / window.NotoSansSCFullTtfBytes
  // =========================================================================
  function ensureSubsetFont(doc, usedChars) {
    var fontName = FONT_CN; // 'NotoSansSC-Regular'
    if (typeof window.subsetFont !== 'function') {
      return Promise.reject(new Error('subsetFont 未加载，请确认已引入 lib/subset-font.umd.js'));
    }
    if (!window.NotoSansSCFullTtfBytes) {
      return Promise.reject(new Error('NotoSansSCFullTtfBytes 未加载，请确认已引入 lib/NotoSansSC-Full.ttf.js'));
    }
    var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
    return window.subsetFont(window.NotoSansSCFullTtfBytes, usedChars).then(function (subsetBytes) {
      // Uint8Array → base64（分片避免栈溢出）
      var bin = '';
      var CHUNK = 0x8000;
      for (var i = 0; i < subsetBytes.length; i += CHUNK) {
        bin += String.fromCharCode.apply(null, subsetBytes.subarray(i, i + CHUNK));
      }
      var b64 = btoa(bin);
      doc.addFileToVFS(fontName + '.ttf', b64);
      doc.addFont(fontName + '.ttf', fontName, 'normal');
      var dt = (((window.performance && performance.now) ? performance.now() : Date.now()) - t0) | 0;
      try {
        console.log('[PDF] 子集化字体完成: chars=' + usedChars.length + ', ttf=' + (subsetBytes.length/1024).toFixed(1) + 'KB, base64=' + (b64.length/1024).toFixed(1) + 'KB, took=' + dt + 'ms');
      } catch (e) {}
      return fontName;
    });
  }

  // =========================================================================
  //  运行完整渲染流水线（信息表 → 曲线页 → 配置页 → 页脚）
  //  data / configData / pageType / curves 都在外面备好
  //  onDone(doc) 完成后回调
  // =========================================================================
  function runRenderPipeline(doc, data, configData, pageType, curves, onDone) {
    // === 第一页：信息表 ===
    var cursorY = MARGIN_T;
    cursorY = renderHeader(doc, cursorY, data);
    cursorY = renderSectionProject(doc, cursorY, data);
    cursorY = renderSectionBasic(doc, cursorY, data);
    cursorY = renderSectionMotor(doc, cursorY, data);
    cursorY = renderSectionApp(doc, cursorY, data);
    cursorY = renderSectionRemark(doc, cursorY, data);

    // === 收尾：每页页脚 ===
    function finalize() {
      var pageCount = doc.internal.getNumberOfPages();
      for (var p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        renderFooter(doc, p, pageCount, data);
      }
      onDone(doc);
    }

    var stepIndex = 0;
    function nextStep() {
      if (pageType === 'control' || pageType === 'motor-control') {
        if (stepIndex === 0) {
          stepIndex++;
          if (curves && curves.t && curves.t.length > 0) {
            renderFIJerkPage(doc, data, curves, nextStep);
          } else {
            nextStep();
          }
          return;
        }
        if (stepIndex === 1) {
          stepIndex++;
          renderConfigPage(doc, data, configData, pageType, finalize);
          return;
        }
        finalize();
        return;
      }
      if (stepIndex === 0) {
        stepIndex++;
        if (curves && curves.t && curves.t.length > 0) {
          renderCurvesPage(doc, data, curves, finalize);
        } else {
          finalize();
        }
        return;
      }
      finalize();
    }
    nextStep();
  }

  // 获取曲线数据（index 用 window.S.curves；control/motor-control 用运动学重算）
  function getCurves(pageType, data) {
    if (window.S && window.S.curves && window.S.curves.t && window.S.curves.t.length > 0) {
      return window.S.curves;
    }
    if ((pageType === 'control' || pageType === 'motor-control')
        && typeof kinematicsTrap === 'function' && typeof sampleOneway === 'function'
        && data.motor && data.dist > 0 && data.speed > 0 && data.accel > 0) {
      try {
        var kin = data.jerkEnabled && typeof kinematicsS === 'function'
          ? kinematicsS(data.dist, data.speed, data.accel, data.jerk || 10000)
          : kinematicsTrap(data.dist, data.speed, data.accel);
        if (kin) {
          return sampleOneway(kin, data.motor, data.mass, 0.05, 0, 0, data.temp || 25);
        }
      } catch (e) { console.warn('曲线重算失败:', e); }
    }
    return null;
  }

  /**
   * 生成 PDF 主入口（异步）
   *
   * 两阶段流程：
   *   Phase 1: 用一个"扫描 doc"跑一遍渲染，doc.text 被拦截 → 仅收集字符不写入
   *            （其余操作照常，但产物弃用；PNG 生成也会跑一次）
   *   Phase 2: 用完整字符集做子集化 → 创建最终 doc → 完整渲染 → 保存
   *
   *  jsPDF 特性说明：doc.text() 会立即把字符编码进 PDF page stream，与当前字体
   *  绑定；因此只有事先注册好子集字体，才能让文字正确显示。而子集化又必须先
   *  知道所有要用的字符 —— 这就是两阶段的原因。
   */
  function generateIndexPDF(formData, opts) {
    var Ctor = getJsPDFCtor();
    if (!Ctor) {
      return Promise.reject(new Error('jsPDF 未加载，请确认已引入 lib/jspdf.umd.min.js'));
    }
    opts = opts || {};
    var report = typeof opts.onProgress === 'function' ? opts.onProgress : function () {};

    // === 收集数据 ===
    report('准备数据…', 8);
    var data = collectData(formData || {});
    var pageType = detectPageType();
    var configData = (pageType === 'control' || pageType === 'motor-control') ? collectConfigData() : null;
    var curves = getCurves(pageType, data);

    return new Promise(function (resolve, reject) {
      // ==== Phase 1：扫描字符 ====
      // 用 helvetica（jsPDF 内建）跑扫描 —— 布局精度无关紧要，重点是收集字符
      report('扫描字符…', 15);
      var scanDoc = new Ctor({ orientation: 'p', unit: 'mm', format: 'a4' });
      try { scanDoc.setFont('helvetica', 'normal'); } catch (e) {}

      // 拦截 setFont：把对 FONT_CN 的引用重定向到 helvetica，避免"font not defined"
      var origSetFont = scanDoc.setFont.bind(scanDoc);
      scanDoc.setFont = function (name, style) {
        if (name === FONT_CN) return origSetFont('helvetica', style || 'normal');
        try { return origSetFont(name, style); } catch (e) { return origSetFont('helvetica', 'normal'); }
      };

      var capturedTexts = [];
      var origText = scanDoc.text.bind(scanDoc);
      scanDoc.text = function () {
        for (var ti = 0; ti < arguments.length; ti++) {
          var a = arguments[ti];
          if (typeof a === 'string') {
            capturedTexts.push(a);
          } else if (a && typeof a.length === 'number' && typeof a !== 'function') {
            for (var tj = 0; tj < a.length; tj++) {
              if (typeof a[tj] === 'string') capturedTexts.push(a[tj]);
            }
          }
        }
        // 把 string / string[] 换成空字符，避免 helvetica 遇到 UTF-8 汉字报错；
        // 其它坐标/选项参数原样传给 jsPDF 以维持"页面推进"等副作用
        try {
          var args = Array.prototype.slice.call(arguments);
          for (var k = 0; k < args.length; k++) {
            if (typeof args[k] === 'string') args[k] = '';
            else if (Array.isArray(args[k])) args[k] = args[k].map(function () { return ''; });
          }
          return origText.apply(null, args);
        } catch (e) { /* 忽略：扫描阶段异常不影响后续 */ }
      };

      // splitTextToSize 在 helvetica 下遇到 UTF-8 汉字可能吃字节；用一个降级实现
      var origSplit = scanDoc.splitTextToSize.bind(scanDoc);
      scanDoc.splitTextToSize = function (text, maxSize) {
        try { return origSplit(text, maxSize); }
        catch (e) { return typeof text === 'string' ? [text] : []; }
      };

      runRenderPipeline(scanDoc, data, configData, pageType, curves, function () {
        // ==== Phase 2：子集化字体 + 真实渲染 ====
        report('压缩字体…', 35);
        var usedChars = scanUsedChars(capturedTexts);
        var finalDoc = new Ctor({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });

        ensureSubsetFont(finalDoc, usedChars).then(function (fontName) {
          report('渲染 PDF…', 75);
          finalDoc.setFont(fontName, 'normal');
          runRenderPipeline(finalDoc, data, configData, pageType, curves, function () {
            report('保存文件…', 92);
            var filename = (data.customer || L('客户', 'Customer')) + '_' + (data.project || L('轴', 'Axis')) + '_' + todayStr() + '.pdf';
            // 若外部已在用户手势栈里预先拿到 fileHandle（保留另存为体验），则用它写入；
            // 否则回退到 savePdfWithPicker（异步链里再调用 showSaveFilePicker 会被浏览器
            // 视为无用户手势 → 静默失败 → 走默认下载）
            var blob = finalDoc.output('blob');
            if (opts.fileHandle && typeof opts.fileHandle.createWritable === 'function') {
              opts.fileHandle.createWritable().then(function (writable) {
                return writable.write(blob).then(function () { return writable.close(); });
              }).then(function () {
                report('完成', 100);
                resolve();
              }).catch(function (err) {
                // 写入失败 → 兜底为普通下载，避免用户白等
                try { finalDoc.save(filename); } catch (e) {}
                reject(err);
              });
            } else {
              savePdfWithPicker(finalDoc, filename);
              report('完成', 100);
              resolve();
            }
          });
        }).catch(function (err) {
          reject(err);
        });
      });
    });
  }

  // =========================================================================
  //  配置页：control.html → 直线电机模组配置，motor-control.html → 动定子配置
  //  内容包括：模组型号大字号显示 + 型号解析
  // =========================================================================
  function renderConfigPage(doc, data, configData, pageType, callback) {
    doc.addPage();
    doc.setFont(FONT_CN, 'normal');
    var y = MARGIN_T;
    var configTitle = (pageType === 'motor-control')
      ? L('动定子配置 / Mover & Stator Configuration', 'Mover & Stator Configuration')
      : L('直线电机模组配置 / Linear Motor Module Configuration', 'Linear Motor Module Configuration');
    y = drawSectionTitle(doc, y, configTitle);
    y += 4;

    // === 模块1：模组型号（大字号） ===
    doc.setFontSize(9);
    doc.setTextColor.apply(doc, COLOR_TEXT_SUB);
    doc.text(L('产品型号 / Product Code', 'Product Code'), MARGIN_L, y);
    y += 4;

    // 浅灰背景卡片
    var modelBoxH = 22;
    var x = MARGIN_L;
    var w = CONTENT_W;
    doc.setFillColor.apply(doc, COLOR_BG_CARD);
    doc.setDrawColor.apply(doc, COLOR_LINE);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, w, modelBoxH, 2, 2, 'FD');

    // 型号大字号（变紫色品牌色）
    var code = configData.modelCode || '—';
    doc.setFontSize(16);
    doc.setTextColor(124, 58, 237); // #7C3AED 紫色
    doc.text(code, x + w / 2, y + modelBoxH / 2 + 2, { align: 'center' });
    y += modelBoxH + 8;

    // === 模块2：型号解析 ===
    doc.setFontSize(9);
    doc.setTextColor.apply(doc, COLOR_TEXT_SUB);
    doc.text(L('型号解析 / Model Analysis', 'Model Analysis'), MARGIN_L, y);
    y += 4;

    var analysisLines = configData.analysisLines || [];
    var padding = 4;
    if (analysisLines.length > 0) {
      // 按行渲染
      var cardH = 6 + analysisLines.length * 5.5 + padding;
      doc.setFillColor.apply(doc, COLOR_BG_CARD);
      doc.setDrawColor.apply(doc, COLOR_LINE);
      doc.setLineWidth(0.2);
      doc.roundedRect(x, y, w, cardH, 1.5, 1.5, 'FD');

      doc.setFontSize(10);
      doc.setTextColor.apply(doc, COLOR_TEXT);
      var lineY = y + padding + 3.5;
      for (var i = 0; i < analysisLines.length; i++) {
        doc.text(analysisLines[i], x + padding, lineY);
        lineY += 5.5;
      }
      y += cardH;
    } else {
      var emptyH = 18;
      doc.setFillColor.apply(doc, COLOR_BG_CARD);
      doc.setDrawColor.apply(doc, COLOR_LINE);
      doc.setLineWidth(0.2);
      doc.roundedRect(x, y, w, emptyH, 1.5, 1.5, 'FD');
      doc.setFontSize(10);
      doc.setTextColor.apply(doc, COLOR_TEXT_SUB);
      doc.text(L('尚未生成型号解析', 'Model analysis not generated'), x + padding, y + emptyH / 2 + 1.2);
      y += emptyH;
    }

    // === 模块3：定子方案（仅 motor-control + 有效行程有效时） ===
    var statorPlanLines = configData.statorPlanLines || [];
    if (pageType === 'motor-control' && statorPlanLines.length > 0) {
      // 小节间距
      y += 8;

      // 标题
      var planTitle = L('定子方案 / Stator Plan', 'Stator Plan');
      if (configData.statorPlanDist) {
        planTitle += '  ' + configData.statorPlanDist;
      }
      y = drawSectionTitle(doc, y, planTitle);
      y += 2;

      // 卡片背景
      var planCardH = 6 + statorPlanLines.length * 5.5 + padding;
      doc.setFillColor.apply(doc, COLOR_BG_CARD);
      doc.setDrawColor.apply(doc, COLOR_LINE);
      doc.setLineWidth(0.2);
      doc.roundedRect(x, y, w, planCardH, 1.5, 1.5, 'FD');

      doc.setFontSize(10);
      doc.setTextColor.apply(doc, COLOR_TEXT);
      var planLineY = y + padding + 3.5;
      for (var pi = 0; pi < statorPlanLines.length; pi++) {
        // 将 NBSP (\u00A0) 统一为单空格，保证 \u00D7 N 数量能清晰可见不被多余空白截出
        var lineText = String(statorPlanLines[pi]).replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
        doc.text(lineText, x + padding, planLineY);
        planLineY += 5.5;
      }
      y += planCardH;
    }

    callback();
  }

  // =========================================================================
  //  第二页（control/motor-control 专用）：三条曲线
  //    顺序：位移 & 速度 / Position & Velocity
  //          速度 & 加速度 (& 加加速度) — 是否含 j 视 jerkEnabled 而定
  //          力 & 电流 / Force & Current
  //  每张 75mm 高，与原第二页同尺寸不拉伸
  // =========================================================================
  function renderFIJerkPage(doc, data, curves, callback) {
    doc.addPage();
    doc.setFont(FONT_CN, 'normal');
    var y = MARGIN_T;
    y = drawSectionTitle(doc, y, L('运动曲线 / Motion Curves', 'Motion Curves'));
    y += 2;

    // 中间那张图：jerk 启用 = v+a+j 三轴；未启用 = v+a 双轴
    var midChart = data.jerkEnabled
      ? { title: L('速度 & 加速度 & 加加速度 / Velocity, Acceleration & Jerk', 'Velocity, Acceleration & Jerk'), keys: ['v', 'a', 'j'] }
      : { title: L('速度 & 加速度 / Velocity & Acceleration', 'Velocity & Acceleration'), keys: ['v', 'a'] };

    var chartConfigs = [
      { title: L('位移 & 速度 / Position & Velocity', 'Position & Velocity'), keys: ['s', 'v'] },
      midChart,
      { title: L('力 & 电流 / Force & Current', 'Force & Current'), keys: ['F', 'I'] }
    ];

    // 固定 75mm 高（与原曲线图一致，不拉伸）
    var titleLineH = 5;
    var gap = 3;
    var chartH_mm = 75;
    var chartW_mm = CONTENT_W;

    var images = [];
    var idx = 0;

    function renderNext() {
      if (idx >= chartConfigs.length) {
        // 嵌入 PDF
        var curY = y;
        for (var ci = 0; ci < images.length; ci++) {
          doc.setFontSize(10);
          doc.setTextColor.apply(doc, COLOR_TEXT_SUB);
          doc.text(chartConfigs[ci].title, MARGIN_L, curY + 4);
          curY += titleLineH;
          doc.addImage(images[ci], 'PNG', MARGIN_L, curY, chartW_mm, chartH_mm);
          curY += chartH_mm + gap;
        }
        callback();
        return;
      }
      _renderChartToPng(curves, chartConfigs[idx], function(imgData) {
        images.push(imgData);
        idx++;
        renderNext();
      });
    }
    renderNext();
  }

  // =========================================================================
  //  共享 helper：把 curves 按 chartCfg.keys 渲染成 PNG（宽画布 1400x520）
  //   - 2 轴 (s+v / F+I / P+U)：右侧 margin 100mm
  //   - 3 轴 (v+a+j)         ：第三个 Y 轴 offset 70，右侧 margin 170mm
  //  过滤 NaN/Infinity 值（防止 trapezoidal 边界样本导致折线断裂）
  // =========================================================================
  function _renderChartToPng(curves, chartCfg, callback) {
    var keys = chartCfg.keys;
    var pxW = 1400;
    var pxH = 520;

    var container = document.createElement('div');
    container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:' + pxW + 'px;height:' + pxH + 'px;';
    document.body.appendChild(container);

    var step = Math.max(1, Math.floor(curves.t.length / 600));
    var yAxis = [];
    var series = [];

    for (var ki = 0; ki < keys.length; ki++) {
      var k = keys[ki];
      var meta = CURVE_META[k];
      var sampledData = [];
      for (var si = 0; si < curves.t.length; si += step) {
        var val = curves[k][si];
        if (isFinite(val)) sampledData.push([curves.t[si], val]);
      }
      if (sampledData.length > 0) {
        var lastVal = curves[k][curves[k].length - 1];
        if (isFinite(lastVal) && sampledData[sampledData.length - 1][0] < curves.t[curves.t.length - 1]) {
          sampledData.push([curves.t[curves.t.length - 1], lastVal]);
        }
      }

      yAxis.push({
        type: 'value',
        position: ki === 0 ? 'left' : 'right',
        name: _cy(k) + ' (' + meta.unit + ')',
        nameLocation: 'middle',
        nameGap: 50,
        nameTextStyle: { color: meta.color, fontSize: 13, fontWeight: 600 },
        axisLine: { show: true, lineStyle: { color: meta.color } },
        axisLabel: { color: meta.color, fontSize: 11, formatter: function(v) { return (+v).toFixed(2); } },
        splitLine: { show: ki === 0, lineStyle: { color: '#F1F5F9', type: 'dashed' } }
      });

      series.push({
        name: _cl(k),
        type: 'line',
        yAxisIndex: ki,
        data: sampledData,
        lineStyle: { color: meta.color, width: 2.5 },
        itemStyle: { color: meta.color },
        symbol: 'none',
        smooth: 0
      });
    }

    // 3 轴模式：第三个 Y 轴外挪 70px 避免和第二个重叠
    if (keys.length === 3) {
      yAxis[1].offset = 0;
      yAxis[2].offset = 70;
      yAxis[2].nameGap = 55;
    }
    var rightMargin = (keys.length === 3) ? 170 : 100;

    var chart = echarts.init(container, null, { renderer: 'canvas', width: pxW, height: pxH });
    chart.setOption({
      backgroundColor: '#FFFFFF',
      animation: false,
      grid: { top: 60, right: rightMargin, bottom: 50, left: 100 },
      legend: {
        show: true, top: 12,
        textStyle: { fontSize: 14, color: '#334155', fontWeight: 600 },
        itemWidth: 18, itemHeight: 10
      },
      xAxis: {
        type: 'value',
        axisLabel: { color: '#64748B', fontSize: 11, formatter: function(v) { return v.toFixed(3) + ' s'; } },
        axisLine: { lineStyle: { color: '#94A3B8' } },
        splitLine: { show: false }
      },
      yAxis: yAxis,
      series: series,
      tooltip: { show: false }
    });

    setTimeout(function() {
      var imgData = chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#FFFFFF' });
      document.body.removeChild(container);
      chart.dispose();
      callback(imgData);
    }, 200);
  }

  // =========================================================================
  //  第三页：加加速度启用时，渲染速度+加速度+加加速度 三合一图
  //  尺寸与第二页的单张图一致（75mm 高）
  // =========================================================================
  function renderJerkPage(doc, data, curves, callback) {
    doc.addPage();
    doc.setFont(FONT_CN, 'normal');
    var y = MARGIN_T;
    y = drawSectionTitle(doc, y, '加加速度曲线 / Jerk Profile');
    y += 2;

    // 与第二页单图完全一致的尺寸
    var titleLineH = 5;
    var chartH_mm = 75;
    var chartW_mm = CONTENT_W;

    // 高清画布（与第二页一致：1400×520）
    var pxW = 1400;
    var pxH = 520;

    var container = document.createElement('div');
    container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:' + pxW + 'px;height:' + pxH + 'px;';
    document.body.appendChild(container);

    var step = Math.max(1, Math.floor(curves.t.length / 600));
    var keys = ['v', 'a', 'j'];

    var yAxis = [];
    var series = [];
    for (var ki = 0; ki < keys.length; ki++) {
      var k = keys[ki];
      var meta = CURVE_META[k];
      var sampledData = [];
      for (var si = 0; si < curves.t.length; si += step) {
        sampledData.push([curves.t[si], curves[k][si]]);
      }
      if (sampledData[sampledData.length - 1][0] < curves.t[curves.t.length - 1]) {
        sampledData.push([curves.t[curves.t.length - 1], curves[k][curves[k].length - 1]]);
      }

      // 三个 Y 轴：v 左、a 右(offset=0)、j 右(offset=70)
      var position = ki === 0 ? 'left' : 'right';
      yAxis.push({
        type: 'value',
        position: position,
        name: meta.yNameZh + ' (' + meta.unit + ')',
        nameLocation: 'middle',
        nameGap: ki === 2 ? 55 : 50,
        nameTextStyle: { color: meta.color, fontSize: 13, fontWeight: 600 },
        axisLine: { show: true, lineStyle: { color: meta.color } },
        axisLabel: { color: meta.color, fontSize: 11, formatter: function(v) { return (+v).toFixed(2); } },
        splitLine: { show: ki === 0, lineStyle: { color: '#F1F5F9', type: 'dashed' } }
      });

      series.push({
        name: meta.yNameZh,
        type: 'line',
        yAxisIndex: ki,
        data: sampledData,
        lineStyle: { color: meta.color, width: 2.5 },
        itemStyle: { color: meta.color },
        symbol: 'none',
        smooth: 0
      });
    }

    // 第三个 Y 轴（j）偏移以免和 a 重叠
    yAxis[1].offset = 0;
    yAxis[2].offset = 70;

    var chart = echarts.init(container, null, { renderer: 'canvas', width: pxW, height: pxH });
    chart.setOption({
      backgroundColor: '#FFFFFF',
      animation: false,
      grid: { top: 60, right: 170, bottom: 50, left: 100 },
      legend: {
        show: true, top: 12,
        textStyle: { fontSize: 14, color: '#334155', fontWeight: 600 },
        itemWidth: 18, itemHeight: 10
      },
      xAxis: {
        type: 'value',
        axisLabel: { color: '#64748B', fontSize: 11, formatter: function(v) { return v.toFixed(3) + ' s'; } },
        axisLine: { lineStyle: { color: '#94A3B8' } },
        splitLine: { show: false }
      },
      yAxis: yAxis,
      series: series,
      tooltip: { show: false }
    });

    setTimeout(function() {
      var imgData = chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#FFFFFF' });
      document.body.removeChild(container);
      chart.dispose();
      // 小标题
      doc.setFontSize(10);
      doc.setTextColor.apply(doc, COLOR_TEXT_SUB);
      doc.text('速度 & 加速度 & 加加速度 / Velocity, Acceleration & Jerk', MARGIN_L, y + 4);
      // 图片
      doc.addImage(imgData, 'PNG', MARGIN_L, y + titleLineH, chartW_mm, chartH_mm);
      callback();
    }, 250);
  }

  // =========================================================================
  //  index.html 第二页：3 张曲线
  //    顺序：位移 & 速度 / Position & Velocity
  //          速度 & 加速度 (& 加加速度) — 是否含 j 视 jerkEnabled 而定
  //          力 & 电流 / Force & Current
  //  每张 75mm 高，与 control/mc 风格一致
  // =========================================================================
  function renderCurvesPage(doc, data, curves, callback) {
    doc.addPage();
    doc.setFont(FONT_CN, 'normal');
    var y = MARGIN_T;
    y = drawSectionTitle(doc, y, L('运动曲线 / Motion Curves', 'Motion Curves'));
    y += 2;

    // 中间图：jerk 启用 = v+a+j；未启用 = v+a
    var midChart = data.jerkEnabled
      ? { title: L('速度 & 加速度 & 加加速度 / Velocity, Acceleration & Jerk', 'Velocity, Acceleration & Jerk'), keys: ['v', 'a', 'j'] }
      : { title: L('速度 & 加速度 / Velocity & Acceleration', 'Velocity & Acceleration'), keys: ['v', 'a'] };

    var chartConfigs = [
      { title: L('位移 & 速度 / Position & Velocity', 'Position & Velocity'), keys: ['s', 'v'] },
      midChart,
      { title: L('力 & 电流 / Force & Current', 'Force & Current'), keys: ['F', 'I'] }
    ];

    // 固定 75mm 高（与 control/mc 一致）
    var titleLineH = 5;
    var gap = 3;
    var chartH_mm = 75;
    var chartW_mm = CONTENT_W;

    var images = [];
    var idx = 0;

    function renderNext() {
      if (idx >= chartConfigs.length) {
        // 全部渲染完，嵌入 PDF
        var curY = y;
        for (var ci = 0; ci < images.length; ci++) {
          doc.setFontSize(10);
          doc.setTextColor.apply(doc, COLOR_TEXT_SUB);
          doc.text(chartConfigs[ci].title, MARGIN_L, curY + 4);
          curY += titleLineH;
          doc.addImage(images[ci], 'PNG', MARGIN_L, curY, chartW_mm, chartH_mm);
          curY += chartH_mm + gap;
        }
        callback();
        return;
      }
      _renderChartToPng(curves, chartConfigs[idx], function(imgData) {
        images.push(imgData);
        idx++;
        renderNext();
      });
    }
    renderNext();
  }

  /**
   * 尝试用 File System Access API 让用户选择保存路径；不支持时回退到普通下载
   */
  function savePdfWithPicker(doc, defaultName) {
    var blob = doc.output('blob');
    if (typeof window.showSaveFilePicker === 'function') {
      window.showSaveFilePicker({
        suggestedName: defaultName,
        types: [{ description: 'PDF 文件', accept: { 'application/pdf': ['.pdf'] } }]
      }).then(function(handle) {
        return handle.createWritable().then(function(writable) {
          return writable.write(blob).then(function() {
            return writable.close();
          });
        });
      }).catch(function(err) {
        if (err.name !== 'AbortError') {
          doc.save(defaultName);
        }
      });
    } else {
      doc.save(defaultName);
    }
  }

  /**
   * 收集报告所需的所有数据
   * - index.html: 从 window.S / DOM(i1~i11) 读取
   * - control/motor-control: 从 sessionStorage.moen_control_data + moen_input_state 读取
   */
  function collectData(formData) {
    var pageType = detectPageType();
    var S, sel, app, c, inputState;

    if (pageType === 'index') {
      S = window.S || {};
      sel = S.sel || null;
      app = S.app || null;
      c = S.c || {};
      inputState = null;
    } else {
      // 从 sessionStorage 还原
      S = {};
      var ctl = window.CTL || {};
      try {
        var raw = sessionStorage.getItem('moen_control_data');
        if (raw && !window.CTL) ctl = JSON.parse(raw);
      } catch (e) {}
      sel = ctl.sel || null;
      app = ctl.app || null;
      c = ctl.c || {};
      try {
        var rawInp = sessionStorage.getItem('moen_input_state');
        inputState = rawInp ? JSON.parse(rawInp) : null;
      } catch (e) { inputState = null; }
      S.jerkEnabled = inputState && !!inputState.jerkEnabled;
      S.j = inputState ? parseFloat(inputState.i11) : NaN;
      S.mode = inputState ? inputState.mode : 'cus';
    }

    // 从 DOM 读值（index）或从 inputState 读值（其他页）
    function readVal(id) {
      if (pageType === 'index') return safeGv(id);
      if (inputState && inputState[id] !== undefined && inputState[id] !== '') {
        var v = parseFloat(inputState[id]);
        return isNaN(v) ? 0 : v;
      }
      return 0;
    }

    // 工况输入
    var dist = (pageType === 'index') ? safeGv('i1')
             : (typeof (window.CTL && window.CTL.dist) === 'number' ? window.CTL.dist : readVal('i1'));
    var dwell = (typeof c.dw === 'number') ? c.dw : readVal('i5');
    var mu = readVal('i7');
    var fx = readVal('i8');
    var ang = readVal('i9');
    var temp = readVal('i10');
    var massVal = (window.CTL && typeof window.CTL.mass === 'number') ? window.CTL.mass : readVal('i6');

    // 模式分流下的 v / a / t
    var speed, accel, motionTime;
    if (S.mode === 'p2p') {
      motionTime = readVal('i2');
      speed = c.mV || 0;
      accel = c.mA || 0;
    } else {
      motionTime = c.mT || 0;
      speed = (pageType === 'index') ? readVal('i3') : (c.mV || readVal('i3'));
      accel = (pageType === 'index') ? readVal('i4') : (c.mA || readVal('i4'));
    }

    // Jerk
    var jerkEnabled = !!S.jerkEnabled;
    var jerk = jerkEnabled ? (S.j || readVal('i11') || 10000) : null;

    // 静摩擦力
    var ff = (typeof c.ff === 'number') ? c.ff : 0;

    // 电机类型 + 系列
    var typeName = '', seriesName = '';
    if (pageType === 'index') {
      try {
        var st = document.getElementById('st');
        var ss = document.getElementById('ss');
        if (st && st.selectedOptions[0]) typeName = st.selectedOptions[0].textContent;
        if (ss && ss.selectedOptions[0]) seriesName = ss.selectedOptions[0].textContent;
      } catch (e) {}
    } else if (window.CTL) {
      typeName = window.CTL.typeName || '';
      seriesName = window.CTL.seriesName || '';
    }

    // 加/减/匀速时间和距离
    var accTime = c.at || 0;
    var decTime = c.at || 0;
    var constTime = c.ct || 0;
    var accDist = (c.ad || 0) * 1000;
    var decDist = accDist;
    var constDist = (c.cd || 0) * 1000;

    return {
      customer: safeStr(formData.customer),
      project: safeStr(formData.project),
      salesman: safeStr(formData.salesman),
      remark: safeStr(formData.remark),
      selectionDate: todayStr(),

      typeName: typeName,
      seriesName: seriesName,
      motorName: sel ? safeStr(sel.n) : '',

      dist: dist,
      speed: speed,
      accel: accel,
      jerk: jerk,
      jerkEnabled: jerkEnabled,
      temp: temp,
      mass: massVal,
      motionTime: motionTime,
      dwellTime: dwell,
      accTime: accTime,
      decTime: decTime,
      constTime: constTime,
      accDist: accDist,
      decDist: decDist,
      constDist: constDist,

      motor: sel,
      app: app,
      ff: ff
    };
  }

  // =========================================================================
  //  页眉：左上 Moen Tech，右上日期，细线分隔，居中标题
  // =========================================================================
  function renderHeader(doc, y, data) {
    var titleY = y + 5;
    doc.setFontSize(16);
    doc.setTextColor(154, 195, 94); // #9AC35E
    doc.text(L('Moen Tech \u76F4\u9A71\u7535\u673A\u9009\u578B\u62A5\u544A', 'Moen Tech Linear Motor Selection Report'), PAGE_W / 2, titleY, { align: 'center' });

    var subTitleY = titleY + 5.5;
    doc.setFontSize(10);
    doc.setTextColor(66, 80, 99);
    doc.text(L('Linear Motor Selection Report', 'Direct Drive Motor — Engineering Report'), PAGE_W / 2, subTitleY, { align: 'center' });

    doc.setFontSize(9);
    doc.setTextColor.apply(doc, COLOR_TEXT_SUB);
    doc.text(L('\u9009\u578B\u65E5\u671F\uFF1A', 'Date: ') + data.selectionDate, PAGE_W - MARGIN_R, titleY, { align: 'right' });

    // 页眉分隔线（在标题下方）
    var lineY = subTitleY + 4;
    doc.setDrawColor.apply(doc, COLOR_LINE_DARK);
    doc.setLineWidth(0.3);
    doc.line(MARGIN_L, lineY, PAGE_W - MARGIN_R, lineY);

    return lineY + 4;
  }

  // =========================================================================
  //  项目信息（单列四行）
  // =========================================================================
  function renderSectionProject(doc, y, data) {
    y = ensureSpace(doc, y, 40);
    y = drawSectionTitle(doc, y, L('项目信息 / Project Information', 'Project Information'));

    var rows = [
      [L('客户名称', 'Customer'),     data.customer || '—'],
      [L('轴名称',   'Axis Name'),    data.project  || '—'],
      [L('业务员',   'Salesman'),     data.salesman || '—'],
      [L('选型日期', 'Date'),         data.selectionDate]
    ];
    y = drawSingleColTable(doc, y, rows, 7);

    return y + 4;
  }

  // =========================================================================
  //  基本参数（双栏）
  // =========================================================================
  function renderSectionBasic(doc, y, data) {
    y = ensureSpace(doc, y, 80);
    y = drawSectionTitle(doc, y, L('基本参数 / Basic Parameters', 'Basic Parameters'));

    var jerkTxt = data.jerkEnabled ? fmt(data.jerk, 0) + ' m/s³' : L('未启用', 'Disabled');

    var rows = [
      [L('距离',     'Distance'),       fmt(data.dist, 3) + ' m'],
      [L('速度',     'Velocity'),       fmt(data.speed, 3) + ' m/s'],
      [L('加速度',   'Accel.'),         fmt(data.accel, 3) + ' m/s²'],
      [L('加加速度', 'Jerk'),           jerkTxt],
      [L('环境温度', 'Amb. Temp.'),     fmt(data.temp, 1) + ' °C'],
      [L('负载质量', 'Load Mass'),      fmt(data.mass, 1) + ' kg'],
      [L('运动时间', 'Motion Time'),    fmt(data.motionTime, 4) + ' s'],
      [L('停顿时间', 'Dwell Time'),     fmt(data.dwellTime, 3) + ' s'],
      [L('加速时间', 'Accel. Time'),    fmt(data.accTime, 4) + ' s'],
      [L('减速时间', 'Decel. Time'),    fmt(data.decTime, 4) + ' s'],
      [L('匀速时间', 'Const. Time'),    fmt(data.constTime, 4) + ' s'],
      [L('加速距离', 'Accel. Dist.'),   fmt(data.accDist, 2) + ' mm'],
      [L('减速距离', 'Decel. Dist.'),   fmt(data.decDist, 2) + ' mm'],
      [L('匀速距离', 'Const. Dist.'),   fmt(data.constDist, 2) + ' mm']
    ];
    y = drawTwoColTable(doc, y, rows, 7);

    return y + 4;
  }

  // =========================================================================
  //  电机参数（双栏）
  // =========================================================================
  function renderSectionMotor(doc, y, data) {
    y = ensureSpace(doc, y, 80);
    var motorLabel = L('电机参数 / Motor Specifications', 'Motor Specifications') + (data.motorName ? ' - ' + data.motorName : '');
    y = drawSectionTitle(doc, y, motorLabel);

    if (!data.motor) {
      y = drawCardBox(doc, y, [['—', L('尚未选择电机型号', 'No motor selected')]], 8);
      return y + 4;
    }

    var m = data.motor;
    var rows = [
      [L('持续推力', 'Cont. Force'),   fmt(m.cf, 2) + ' N'],
      [L('峰值推力', 'Peak Force'),    fmt(m.pf, 2) + ' N'],
      [L('推力常数', 'Force Const.'),  fmt(m.fc, 2) + ' N/Arms'],
      [L('反电动势', 'Back-EMF'),      fmt(m.be, 2) + ' V/m/s'],
      [L('持续电流', 'Cont. Current'), fmt(m.ci, 2) + ' Arms'],
      [L('峰值电流', 'Peak Current'),  fmt(m.pi, 2) + ' Arms'],
      [L('相间电感', 'Phase Ind.'),    fmt(m.ind, 2) + ' mH'],
      [L('相间电阻', 'Phase Res.'),    fmt(m.res, 2) + ' Ω'],
      [L('线圈质量', 'Coil Mass'),     fmt(m.cm, 2) + ' kg'],
      [L('功率',     'Power'),         (typeof m.pw === 'number') ? fmt(m.pw, 1) + ' W' : '—'],
      [L('热阻',     'Therm. Res.'),   (typeof m.tr === 'number') ? fmt(m.tr, 2) + ' °C/W' : '—'],
      [L('吸引力',   'Attraction'),    (typeof m.at === 'number') ? fmt(m.at, 1) + ' N' : '—']
    ];
    y = drawTwoColTable(doc, y, rows, 7);

    return y + 4;
  }

  // =========================================================================
  //  使用数据（双栏）
  // =========================================================================
  function renderSectionApp(doc, y, data) {
    y = ensureSpace(doc, y, 70);
    y = drawSectionTitle(doc, y, L('使用数据 / Application Values', 'Application Values'));

    if (!data.app) {
      y = drawCardBox(doc, y, [['—', L('未生成实际应用计算值', 'No application values')]], 8);
      return y + 4;
    }

    var a = data.app;
    var rows = [
      [L('持续推力',     'Cont. Force'),    fmt(a.aCf, 2) + ' N'],
      [L('峰值推力',     'Peak Force'),     fmt(a.aPk, 2) + ' N'],
      [L('持续电流',     'Cont. Current'),  fmt(a.cI, 2)  + ' Arms'],
      [L('峰值电流',     'Peak Current'),   fmt(a.pI, 2)  + ' Arms'],
      [L('线圈温度',     'Coil Temp.'),     fmt(a.cT, 1)  + ' °C'],
      [L('直流母线电压', 'Vdc Bus'),        fmt(a.dc, 1)  + ' V'],
      [L('静摩擦力',     'Static Friction'),fmt(data.ff, 2) + ' N'],
      [L('持续推力余量', 'Cont. Margin'),   fmt(a.cmg, 1) + ' %'],
      [L('峰值推力余量', 'Peak Margin'),    fmt(a.pmg, 1) + ' %']
    ];
    y = drawTwoColTable(doc, y, rows, 7);

    return y + 4;
  }

  // =========================================================================
  //  备注信息（单列，浅灰背景）
  // =========================================================================
  function renderSectionRemark(doc, y, data) {
    y = ensureSpace(doc, y, 24);
    y = drawSectionTitle(doc, y, L('备注信息 / Remarks', 'Remarks'));

    var x = MARGIN_L;
    var w = CONTENT_W;
    var padding = 4;

    // 计算文字高度
    doc.setFontSize(10);
    var remarkText = data.remark || '';
    var lines = remarkText ? doc.splitTextToSize(remarkText, w - padding * 2) : [];
    var textH = lines.length * 4.5;
    var boxH = Math.max(30, textH + padding * 2);

    // 浅灰背景卡片
    doc.setFillColor.apply(doc, COLOR_BG_CARD);
    doc.setDrawColor.apply(doc, COLOR_LINE);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, w, boxH, 1.5, 1.5, 'FD');

    // 文字
    if (lines.length > 0) {
      doc.setTextColor.apply(doc, COLOR_TEXT);
      doc.text(lines, x + padding, y + padding + 3.5);
    }

    return y + boxH + 4;
  }

  // =========================================================================
  //  小节标题：左侧深蓝短竖线 + 加粗深色文字（无背景色块）
  // =========================================================================
  function drawSectionTitle(doc, y, title) {
    var barH = 5;
    var barW = 2.5;

    // 左侧深蓝竖条
    doc.setFillColor.apply(doc, COLOR_ACCENT);
    doc.rect(MARGIN_L, y + 0.5, barW, barH, 'F');

    // 标题文字
    doc.setFontSize(11);
    doc.setTextColor.apply(doc, COLOR_TITLE);
    doc.text(title, MARGIN_L + barW + 3, y + 4.5);

    return y + barH + 3;
  }

  // =========================================================================
  //  单列表格（项目信息用）—— 一列 key + 一列 value，全宽
  // =========================================================================
  function drawSingleColTable(doc, y, rows, rowH) {
    var x = MARGIN_L;
    var w = CONTENT_W;
    var kColW = 28;
    var totalH = rows.length * rowH;

    // 浅灰背景卡片
    doc.setFillColor.apply(doc, COLOR_BG_CARD);
    doc.setDrawColor.apply(doc, COLOR_LINE);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, w, totalH, 1.5, 1.5, 'FD');

    for (var i = 0; i < rows.length; i++) {
      var rowY = y + i * rowH;

      // 行分隔线（第一行不画）
      if (i > 0) {
        doc.setDrawColor.apply(doc, COLOR_LINE);
        doc.setLineWidth(0.15);
        doc.line(x + 2, rowY, x + w - 2, rowY);
      }

      // key
      doc.setFontSize(9);
      doc.setTextColor.apply(doc, COLOR_TEXT_SUB);
      doc.text(String(rows[i][0]), x + 5, rowY + rowH / 2 + 1.2);

      // value
      doc.setFontSize(10);
      doc.setTextColor.apply(doc, COLOR_TEXT);
      doc.text(String(rows[i][1]), x + kColW + 8, rowY + rowH / 2 + 1.2);
    }

    return y + totalH;
  }

  // =========================================================================
  //  双栏表格（基本参数 / 电机参数 / 使用数据）
  //  左右各一组 key-value，纯白背景，细分隔线
  // =========================================================================
  function drawTwoColTable(doc, y, rows, rowH) {
    var x = MARGIN_L;
    var w = CONTENT_W;
    var halfW = w / 2;

    // 分成左右两栏
    var leftRows = [];
    var rightRows = [];
    for (var ri = 0; ri < rows.length; ri++) {
      if (ri % 2 === 0) leftRows.push(rows[ri]);
      else rightRows.push(rows[ri]);
    }
    var maxRows = Math.max(leftRows.length, rightRows.length);
    var totalH = maxRows * rowH;

    // 纯白背景 + 细边框
    doc.setFillColor.apply(doc, COLOR_WHITE);
    doc.setDrawColor.apply(doc, COLOR_LINE);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, w, totalH, 1.5, 1.5, 'FD');

    // 中间竖分割线
    doc.setDrawColor.apply(doc, COLOR_LINE);
    doc.setLineWidth(0.15);
    doc.line(x + halfW, y + 1, x + halfW, y + totalH - 1);

    // 绘制行
    for (var i = 0; i < maxRows; i++) {
      var rowY = y + i * rowH;

      // 行分隔线
      if (i > 0) {
        doc.setDrawColor.apply(doc, COLOR_LINE);
        doc.setLineWidth(0.15);
        doc.line(x + 2, rowY, x + w - 2, rowY);
      }

      // 左栏
      if (leftRows[i]) {
        doc.setFontSize(9);
        doc.setTextColor.apply(doc, COLOR_TEXT_SUB);
        doc.text(String(leftRows[i][0]), x + 4, rowY + rowH / 2 + 1.2);
        doc.setFontSize(10);
        doc.setTextColor.apply(doc, COLOR_TEXT);
        doc.text(String(leftRows[i][1]), x + halfW - 4, rowY + rowH / 2 + 1.2, { align: 'right' });
      }

      // 右栏
      if (rightRows[i]) {
        doc.setFontSize(9);
        doc.setTextColor.apply(doc, COLOR_TEXT_SUB);
        doc.text(String(rightRows[i][0]), x + halfW + 4, rowY + rowH / 2 + 1.2);
        doc.setFontSize(10);
        doc.setTextColor.apply(doc, COLOR_TEXT);
        doc.text(String(rightRows[i][1]), x + w - 4, rowY + rowH / 2 + 1.2, { align: 'right' });
      }
    }

    return y + totalH;
  }

  // =========================================================================
  //  单值卡片（用于"未选择"提示）
  // =========================================================================
  function drawCardBox(doc, y, rows, minH) {
    var rowH = 7;
    var h = Math.max(minH, rows.length * rowH);
    var x = MARGIN_L;
    var w = CONTENT_W;

    doc.setFillColor.apply(doc, COLOR_BG_CARD);
    doc.setDrawColor.apply(doc, COLOR_LINE);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, w, h, 1.5, 1.5, 'FD');

    for (var i = 0; i < rows.length; i++) {
      var rowY = y + i * rowH + rowH / 2 + 1.2;
      if (rows[i][0]) {
        doc.setFontSize(9);
        doc.setTextColor.apply(doc, COLOR_TEXT_SUB);
        doc.text(String(rows[i][0]), x + 4, rowY);
      }
      if (rows[i][1]) {
        doc.setFontSize(10);
        doc.setTextColor.apply(doc, COLOR_TEXT);
        var tx = rows[i][0] ? x + 20 : x + 4;
        doc.text(String(rows[i][1]), tx, rowY);
      }
    }
    return y + h;
  }

  // =========================================================================
  //  页脚：Moen Tech · Direct Drive Motor Selection + 日期 + 页码
  // =========================================================================
  function renderFooter(doc, page, total, data) {
    var y = PAGE_H - 8;
    doc.setDrawColor.apply(doc, COLOR_LINE);
    doc.setLineWidth(0.2);
    doc.line(MARGIN_L, y - 3, PAGE_W - MARGIN_R, y - 3);

    doc.setFontSize(8);
    doc.setTextColor.apply(doc, COLOR_TEXT_SUB);
    doc.text('Moen Tech  \u00B7  Direct Drive Motor Selection', MARGIN_L, y);
    doc.text(data.selectionDate, PAGE_W / 2, y, { align: 'center' });
    doc.text(page + ' / ' + total, PAGE_W - MARGIN_R, y, { align: 'right' });
  }

  // =========================================================================
  //  若剩余空间不够 h，自动翻页
  // =========================================================================
  function ensureSpace(doc, y, h) {
    if (y + h > PAGE_H - MARGIN_B) {
      doc.addPage();
      return MARGIN_T;
    }
    return y;
  }

  // === 暴露接口 ===
  window.generateIndexPDF = generateIndexPDF;
})();
