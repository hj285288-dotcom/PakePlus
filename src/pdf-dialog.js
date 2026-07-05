/**
 * PDF 输出弹窗 — 三页面共享
 * 依赖：页面已存在 modalFadeIn / modalScaleIn 动画 keyframes
 */
(function () {
  'use strict';

  /* ========== 1. 注入弹窗 HTML ========== */
  var overlayHTML = [
    '<div id="pdf-overlay" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);z-index:99999;justify-content:center;align-items:center;">',
    '  <div style="background:#fff;border-radius:14px;padding:28px 32px;min-width:340px;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,0.25);font-family:\'Plus Jakarta Sans\',system-ui,sans-serif;">',
    '    <h3 style="margin:0 0 18px;font-size:15px;font-weight:700;color:#0F172A;">PDF 报告信息</h3>',
    '    <form autocomplete="off">',
    '    <div style="margin-bottom:14px;">',
    '      <label style="display:block;font-size:11px;font-weight:600;color:#64748B;margin-bottom:4px;">客户名称 <span style="color:#EF4444">*</span></label>',
    '      <input id="pdf-customer" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" name="pdf-customer-' + Date.now() + '" style="width:100%;padding:7px 10px;border:1px solid #E2E8F0;border-radius:6px;font-size:13px;outline:none;transition:border-color .2s;" placeholder="请输入客户名称">',
    '    </div>',
    '    <div style="margin-bottom:14px;">',
    '      <label style="display:block;font-size:11px;font-weight:600;color:#64748B;margin-bottom:4px;">轴名称 <span style="color:#EF4444">*</span></label>',
    '      <input id="pdf-project" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" name="pdf-project-' + Date.now() + '" style="width:100%;padding:7px 10px;border:1px solid #E2E8F0;border-radius:6px;font-size:13px;outline:none;transition:border-color .2s;" placeholder="请输入轴名称">',
    '    </div>',
    '    <div style="margin-bottom:14px;">',
    '      <label style="display:block;font-size:11px;font-weight:600;color:#64748B;margin-bottom:4px;">业务员 <span style="color:#EF4444">*</span></label>',
    '      <input id="pdf-salesman" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" name="pdf-salesman-' + Date.now() + '" style="width:100%;padding:7px 10px;border:1px solid #E2E8F0;border-radius:6px;font-size:13px;outline:none;transition:border-color .2s;" placeholder="请输入业务员姓名">',
    '    </div>',
    '    <div style="margin-bottom:20px;">',
    '      <label style="display:block;font-size:11px;font-weight:600;color:#64748B;margin-bottom:4px;">信息备注</label>',
    '      <textarea id="pdf-remark" rows="3" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" name="pdf-remark-' + Date.now() + '" style="width:100%;padding:7px 10px;border:1px solid #E2E8F0;border-radius:6px;font-size:13px;outline:none;resize:vertical;transition:border-color .2s;" placeholder="选填"></textarea>',
    '    </div>',
    '    </form>',
    '    <div id="pdf-error" style="display:none;margin-bottom:12px;font-size:11px;color:#EF4444;font-weight:600;"></div>',
    '    <div id="pdf-progress" style="display:none;margin-bottom:12px;padding:8px 12px;border-radius:6px;background:#F8FAFC;border:1px solid #E2E8F0;">',
    '      <div style="display:flex;align-items:center;gap:8px;">',
    '        <svg id="pdf-progress-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:pdfSpin 1s linear infinite;flex-shrink:0;">',
    '          <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>',
    '        </svg>',
    '        <span id="pdf-progress-text" style="font-size:11px;font-weight:600;color:#475569;">生成中…</span>',
    '      </div>',
    '      <div style="margin-top:6px;height:3px;background:#E2E8F0;border-radius:2px;overflow:hidden;">',
    '        <div id="pdf-progress-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#4F46E5,#7C3AED);border-radius:2px;transition:width .4s cubic-bezier(0.4,0,0.2,1);"></div>',
    '      </div>',
    '    </div>',
    '    <div style="display:flex;gap:10px;justify-content:flex-end;">',
    '      <button id="pdf-cancel-btn" type="button" style="padding:7px 18px;font-size:12px;font-weight:600;border:1px solid #E2E8F0;border-radius:8px;background:#fff;color:#64748B;cursor:pointer;transition:all .2s;">取消</button>',
    '      <button id="pdf-submit-btn" type="button" style="padding:7px 18px;font-size:12px;font-weight:600;border:1px solid #7C3AED;border-radius:8px;background:linear-gradient(135deg,#4F46E5,#7C3AED);color:#fff;cursor:pointer;box-shadow:0 4px 14px rgba(79,70,229,0.3);transition:all .2s;">生成报告</button>',
    '    </div>',
    '  </div>',
    '</div>'
  ].join('\n');

  // 等 DOM 就绪后注入
  function inject() {
    if (document.getElementById('pdf-overlay')) return;
    var wrapper = document.createElement('div');
    wrapper.innerHTML = overlayHTML;
    document.body.appendChild(wrapper.firstElementChild);
    bindEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }

  /* ========== 2. 动画 class（复用 modalFadeIn / modalScaleIn） ========== */
  // 注入仅针对 #pdf-overlay 的动画规则（避免与 pwd-overlay 冲突）
  var styleEl = document.createElement('style');
  styleEl.textContent = [
    '#pdf-overlay.show{animation:modalFadeIn .25s cubic-bezier(0.4,0,0.2,1) both;display:flex!important}',
    '#pdf-overlay.show > div{animation:modalScaleIn .3s cubic-bezier(0.34,1.56,0.64,1) .05s both}',
    '#pdf-overlay input:focus,#pdf-overlay textarea:focus{border-color:#4F46E5;box-shadow:0 0 0 3px rgba(79,70,229,0.12)}',
    '#pdf-cancel-btn:hover{background:#F8FAFC;border-color:#CBD5E1;color:#334155}',
    '#pdf-submit-btn:hover:not(:disabled){box-shadow:0 6px 18px rgba(79,70,229,0.4);transform:translateY(-1px)}',
    '#pdf-submit-btn:active:not(:disabled){transform:scale(0.96)}',
    '#pdf-submit-btn:disabled{cursor:wait;opacity:0.7}',
    '@keyframes pdfSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}'
  ].join('\n');
  document.head.appendChild(styleEl);

  /* ========== 3. 显示 / 隐藏 ========== */
  function showPdfDialog() {
    var overlay = document.getElementById('pdf-overlay');
    if (!overlay) return;
    // 收起顶栏汉堡包 + 同步 ARIA
    var bt = document.getElementById('burger-toggle');
    if (bt) bt.checked = false;
    if (typeof window.__syncBurgerAria === 'function') window.__syncBurgerAria();
    // 重置表单
    var customer = document.getElementById('pdf-customer');
    var project = document.getElementById('pdf-project');
    var salesman = document.getElementById('pdf-salesman');
    var remark = document.getElementById('pdf-remark');
    var errEl = document.getElementById('pdf-error');
    var progressEl = document.getElementById('pdf-progress');
    if (customer) customer.value = '';
    if (project) project.value = '';
    if (salesman) salesman.value = '';
    if (remark) remark.value = '';
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    if (progressEl) progressEl.style.display = 'none';
    // 显示
    overlay.style.display = 'flex';
    void overlay.offsetWidth; // trigger reflow
    overlay.classList.add('show');
    setTimeout(function () { if (customer) customer.focus(); }, 280);
  }

  function hidePdfDialog() {
    var overlay = document.getElementById('pdf-overlay');
    if (!overlay) return;
    overlay.classList.remove('show');
    setTimeout(function () { overlay.style.display = 'none'; }, 250);
  }

  /* ========== 4. 事件绑定 ========== */
  function bindEvents() {
    var overlay = document.getElementById('pdf-overlay');
    if (!overlay) return;
    // 点击遮罩关闭
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) hidePdfDialog();
    });
    // 取消按钮
    var cancelBtn = document.getElementById('pdf-cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', hidePdfDialog);
    // 生成报告按钮
    var submitBtn = document.getElementById('pdf-submit-btn');
    if (submitBtn) submitBtn.addEventListener('click', onSubmit);
    // ESC 关闭
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('show')) {
        hidePdfDialog();
      }
    });
  }

  /* ========== 5. 提交验证 ========== */
  //
  // 关键点：generateIndexPDF 是异步的（扫描 + WASM 子集化 ~1-2s），
  // 若把 showSaveFilePicker 放到 .then 里，用户手势已过期，浏览器会静默拒绝
  // 弹出"另存为"对话框，直接走默认下载。
  //
  // 解决方案：在用户点击"生成报告"这个同步栈里 —— 也就是用户手势仍然有效时
  // —— 立即调用 showSaveFilePicker() 拿到 fileHandle；随后启动异步 PDF 生成；
  // 完成后把 blob 写入这个已经拿到的 handle。
  function onSubmit() {
    var customer = (document.getElementById('pdf-customer').value || '').trim();
    var project = (document.getElementById('pdf-project').value || '').trim();
    var salesman = (document.getElementById('pdf-salesman').value || '').trim();
    var remark = (document.getElementById('pdf-remark').value || '').trim();
    var errEl = document.getElementById('pdf-error');
    var submitBtn = document.getElementById('pdf-submit-btn');

    if (!customer || !project || !salesman) {
      if (errEl) {
        errEl.textContent = '请填写客户名称、轴名称和业务员';
        errEl.style.display = 'block';
      }
      return;
    }
    if (errEl) errEl.style.display = 'none';

    if (typeof window.generateIndexPDF !== 'function') {
      if (errEl) {
        errEl.textContent = 'PDF 生成模块未加载';
        errEl.style.display = 'block';
      }
      return;
    }

    // 默认文件名（与 pdf-generate.js 保持一致）
    function todayStr() {
      var d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    var defaultName = customer + '_' + project + '_' + todayStr() + '.pdf';

    // 生成期间禁用按钮
    var origBtnText = submitBtn ? submitBtn.textContent : '';
    function setBtnBusy() {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '生成中…';
      }
    }
    function restoreBtn() {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = origBtnText || '生成报告';
      }
    }

    // 进度条控制
    var progressEl = document.getElementById('pdf-progress');
    var progressText = document.getElementById('pdf-progress-text');
    var progressBar = document.getElementById('pdf-progress-bar');
    var progressSpinner = document.getElementById('pdf-progress-spinner');
    function setProgress(label, percent) {
      if (!progressEl) return;
      progressEl.style.display = 'block';
      if (progressText) {
        progressText.textContent = label;
        progressText.style.color = '#475569';
      }
      if (progressSpinner) {
        progressSpinner.style.animation = 'pdfSpin 1s linear infinite';
        progressSpinner.style.stroke = '#7C3AED';
      }
      if (progressBar && typeof percent === 'number') {
        progressBar.style.width = Math.max(0, Math.min(100, percent)) + '%';
      }
    }
    function showDone() {
      if (progressText) {
        progressText.textContent = '✓ 已保存';
        progressText.style.color = '#15803D';
      }
      if (progressBar) progressBar.style.width = '100%';
      if (progressSpinner) {
        progressSpinner.style.animation = 'none';
        progressSpinner.style.stroke = '#15803D';
      }
    }

    // === 关键：在用户手势栈内同步调用 showSaveFilePicker ===
    // 如果浏览器支持 File System Access API，则先让用户选保存位置，拿到 handle 后
    // 再开始耗时的异步生成。否则走 generateIndexPDF 内部的 doc.save() 兜底下载。
    var pickerPromise;
    if (typeof window.showSaveFilePicker === 'function') {
      try {
        pickerPromise = window.showSaveFilePicker({
          suggestedName: defaultName,
          types: [{ description: 'PDF 文件', accept: { 'application/pdf': ['.pdf'] } }]
        });
      } catch (e) {
        pickerPromise = Promise.reject(e);
      }
    } else {
      pickerPromise = Promise.resolve(null); // 不支持时传 null，让 generateIndexPDF 回退到 doc.save()
    }

    // 用户手势内先禁用按钮 —— 但先不显示进度条（避免和另存为对话框争夺注意力）
    setBtnBusy();

    pickerPromise.then(function (fileHandle) {
      // 用户已选好保存位置（或环境不支持 picker）→ 启动 PDF 生成
      // 从此刻起开始显示进度条
      setProgress('准备生成…', 5);

      var result;
      try {
        result = window.generateIndexPDF({
          customer: customer,
          project: project,
          salesman: salesman,
          remark: remark
        }, {
          fileHandle: fileHandle,
          onProgress: setProgress
        });
      } catch (e) {
        restoreBtn();
        if (errEl) {
          errEl.textContent = 'PDF 生成失败：' + (e.message || e);
          errEl.style.display = 'block';
        }
        return;
      }
      if (result && typeof result.then === 'function') {
        result.then(function () {
          showDone();
          // 短暂显示"已保存"后关闭弹窗，避免感觉突然消失
          setTimeout(function () {
            restoreBtn();
            hidePdfDialog();
          }, 600);
        }).catch(function (e) {
          restoreBtn();
          if (progressEl) progressEl.style.display = 'none';
          if (errEl) {
            errEl.textContent = 'PDF 生成失败：' + (e && e.message ? e.message : e);
            errEl.style.display = 'block';
          }
        });
      } else {
        restoreBtn();
        hidePdfDialog();
      }
    }).catch(function (err) {
      // 用户在另存为对话框里点了"取消"（AbortError）→ 静默恢复按钮，不弹错
      restoreBtn();
      if (err && err.name === 'AbortError') return;
      if (errEl) {
        errEl.textContent = '另存为失败：' + (err && err.message ? err.message : err);
        errEl.style.display = 'block';
      }
    });
  }

  /* ========== 6. 暴露全局接口 ========== */
  window.showPdfDialog = showPdfDialog;
  window.hidePdfDialog = hidePdfDialog;
})();
