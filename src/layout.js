
/**
 * layout.js - 公共布局组件
 * 注入 sidebar、顶部 50px 标题栏（含汉堡包菜单）、密码弹窗到页面中
 *
 * 使用方式：
 * 1. 在 <body> 上添加 data-page 属性标识当前页面（ind / ctl / motor-ctl）
 * 2. 在 body 内放一个 <div id="layout-body"> 作为内容容器，里面只放 <main>
 * 3. 在 </body> 前引入此文件：<script src="layout.js"></script>
 *
 * 注入后的 DOM 结构（与 index.html 1:1 一致）：
 *   #layout-body
 *     ├─ aside#sidebar       （侧边栏）
 *     └─ div.flex-col       （主体列）
 *         ├─ div#topBar      （50px 顶部标题栏 + 汉堡包菜单）
 *         └─ main            （页面原有内容）
 */
(function() {
  'use strict';

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    var page = document.body.getAttribute('data-page') || '';
    injectCSS();
    if (!document.getElementById('sidebar')) injectSidebar(page);
    // 注入 50px 顶部标题栏 + 汉堡包菜单（包裹 main）
    if (!document.getElementById('topBar')) injectTopBarWithMenu();
    injectPwdOverlay();
    initBurgerLogic();
    initPwdLogic();
  }

  // === html2canvas 已移除：截图功能在打包版本中禁用 ===

  // === CSS 注入（与 index.html 完全一致的汉堡包 + topBar 样式） ===
  function injectCSS() {
    var style = document.createElement('style');
    style.id = 'layout-burger-css';
    style.textContent = [
      // 顶栏极简交互（汉堡包 + 向左展开）— 类名与 index.html 1:1 一致
      '.nav-wrapper{display:flex;align-items:center;flex-direction:row-reverse;position:relative;height:100%}',
      '.hidden-toggle{display:none}',
      '.burger{position:relative;width:18px;height:14px;background:transparent;cursor:pointer;display:block;z-index:10;flex-shrink:0}',
      '.burger span{display:block;position:absolute;height:1.5px;width:100%;background:#4b5563;border-radius:9px;opacity:1;left:0;transform:rotate(0deg);transition:.3s cubic-bezier(0.4,0,0.2,1)}',
      '.burger span:nth-of-type(1){top:0;transform-origin:left center}',
      '.burger span:nth-of-type(2){top:6px;transform-origin:left center}',
      '.burger span:nth-of-type(3){top:12px;transform-origin:left center}',
      '.hidden-toggle:checked ~ .burger span:nth-of-type(1){transform:rotate(45deg);width:50%;top:0;left:9px}',
      '.hidden-toggle:checked ~ .burger span:nth-of-type(2){width:0;opacity:0}',
      '.hidden-toggle:checked ~ .burger span:nth-of-type(3){transform:rotate(-45deg);width:50%;top:13px;left:9px}',
      '.icon-toolbar{display:flex;align-items:center;margin-right:15px;opacity:0;transform:translateX(15px) scale(0.95);pointer-events:none;transition:opacity .3s ease,transform .3s cubic-bezier(0.34,1.56,0.64,1)}',
      '.hidden-toggle:checked ~ .icon-toolbar{opacity:1;transform:translateX(0) scale(1);pointer-events:auto}',
      '.icon-btn{background:transparent;border:none;padding:0.4rem 0.6rem;cursor:pointer;display:flex;align-items:center;justify-content:center;border-radius:0.375rem;transition:background-color .2s ease;position:relative}',
      '.icon-btn:hover{background-color:#e5e7eb}',
      '.icon-btn svg{width:1.5rem;height:1.5rem;color:#4b5563;transition:color .3s ease,transform .3s cubic-bezier(0.34,1.56,0.64,1);will-change:transform}',
      '.icon-btn:hover svg{color:#3b82f6;transform:scale(1.25)}',
      '.icon-btn.text-btn{padding:0.5rem 0.85rem;font-family:"Plus Jakarta Sans",system-ui,sans-serif;font-size:13px;font-weight:400;color:#4b5563;letter-spacing:0.01em}',
      '.icon-btn.text-btn .btn-label{transition:color .3s ease}',
      '.icon-btn.text-btn:hover{background-color:#e5e7eb}',
      '.icon-btn.text-btn:hover .btn-label{color:#3b82f6}',
      '.icon-btn.text-btn.toggle-option.selected{background-color:#e5e7eb}',
      '.icon-btn.text-btn.toggle-option.selected .btn-label{color:#3b82f6}',
      // 密码终端弹窗动画
      '@keyframes layoutModalFadeIn{from{opacity:0}to{opacity:1}}',
      '@keyframes layoutModalScaleIn{from{opacity:0;transform:scale(0.95) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}',
      '#pwd-overlay.show{animation:layoutModalFadeIn .25s cubic-bezier(0.4,0,0.2,1) both}',
      '#pwd-overlay.show > div{animation:layoutModalScaleIn .3s cubic-bezier(0.34,1.56,0.64,1) .05s both}',
      // sidebar 样式
      '.layout-sidebar-item{display:flex;align-items:center;width:100%;text-align:left;padding:10px 14px;font-size:13px;font-weight:500;font-family:"Plus Jakarta Sans",system-ui,sans-serif;color:#64748B;border:none;background:none;cursor:pointer;border-left:3px solid transparent;border-radius:0 8px 8px 0;transition:all .3s cubic-bezier(0.4, 0, 0.2, 1);margin-bottom:2px}',
      '.layout-sidebar-item:hover{background:rgba(79,70,229,.04);color:#4F46E5;transform:translateX(2px)}',
      '.layout-sidebar-item:active{transform:scale(0.97) translateX(2px)}',
      '.layout-sidebar-item.active{background:rgba(79,70,229,.06);color:#4F46E5;border-left-color:#4F46E5;font-weight:500}',
      '.layout-sidebar-search{width:calc(100% - 4px);background:rgba(255,255,255,.7);border:1px solid #E2E8F0;border-radius:8px;padding:4px 8px 4px 28px;font-size:12px;font-family:"Plus Jakarta Sans",system-ui,sans-serif;outline:none;transition:all .25s cubic-bezier(0.4, 0, 0.2, 1)}',
      '.layout-sidebar-search:focus{border-color:#818cf8;box-shadow:0 0 0 3px rgba(79,70,229,0.12)}',
      '.layout-sidebar-search::placeholder{color:#94A3B8}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // === Sidebar（与 index.html 完全一致）===
  function injectSidebar(page) {
    var mainWrap = document.getElementById('layout-body');
    if (!mainWrap) return;

    var aside = document.createElement('aside');
    aside.id = 'sidebar';
    aside.className = 'shrink-0 px-2 border-r border-slate-100';
    aside.style.cssText = "width:172.8px;padding-top:22px;background:url('sidebar-bg.png') center/cover no-repeat;backdrop-filter:blur(8px);";

    var _lt = (window._t || function(k){ return k; });
    var items = [
      { id: 'ind', label: _lt('l2ind'), href: 'index.html', icon: '<polyline points="4 18 8 10 12 14 16 6 20 12"/>' },
      { id: 'com', label: _lt('l2com'), href: '#', icon: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>' },
      { id: 'ctl', label: _lt('l2ctl'), href: 'control.html', icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="3" y1="9" x2="9" y2="9"/>' }
    ];

    var html = '';
    html += '<div class="flex flex-col items-center mb-3 mx-auto" style="width:96px;transform:translateX(-5px);">' +
      '<img src="moenlogo.png" alt="Moen Tech" style="width:100%;height:auto;display:block;">' +
      '<span style="font-size:11.7px;" class="font-medium text-slate-500 tracking-wide mt-1 whitespace-nowrap" data-i18n="sidebarSub">' + _lt('sidebarSub') + '</span>' +
      '</div>';
    html += '<div class="relative mb-3 mx-auto" style="width:calc(100% - 4px)">' +
      '<svg class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
      '<input id="sidebarSearch" type="text" placeholder="' + _lt('searchPh') + '" data-i18n-attr="placeholder|searchPh" class="w-full pl-8 pr-2 py-1 text-[12px] rounded-lg border border-slate-200 focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-200" style="background:rgba(255,255,255,.7);">' +
      '</div>';
    html += '<div class="mt-5">';
    var activeIds = [page];
    if (page === 'motor-ctl') activeIds.push('ind', 'com');
    if (page === 'ctl') activeIds.push('ind', 'ctl');
    var currentItemId = (page === 'motor-ctl') ? 'com' : page;
    var isRestrictedPage = (page === 'motor-ctl' || page === 'ctl');
    items.forEach(function(item) {
      var isActiveItem = (activeIds.indexOf(item.id) !== -1);
      var isActive = isActiveItem ? ' active' : '';
      var canNavigate = !isRestrictedPage || (isActiveItem && item.id !== currentItemId);
      var onclick = '';
      var extraStyle = '';
      if (canNavigate) {
        if (item.id === 'ind') {
          onclick = ' onclick="window.location.href=\'index.html\'"';
        } else if (item.id === 'ctl') {
          onclick = ' onclick="window.location.href=\'control.html\'"';
        }
      } else {
        extraStyle = ' style="pointer-events:none;cursor:default"';
      }
      var i18nKey = (item.id === 'ind') ? 'l2ind' : (item.id === 'com') ? 'l2com' : 'l2ctl';
      html += '<button class="layout-sidebar-item' + isActive + '"' + onclick + extraStyle + '>' +
        '<svg class="mr-2.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + item.icon + '</svg>' +
        '<span data-i18n="' + i18nKey + '">' + item.label + '</span></button>';
    });
    html += '</div>';

    aside.innerHTML = html;
    mainWrap.insertBefore(aside, mainWrap.firstChild);
  }

  // === 50px 顶部标题栏 + 汉堡包菜单（包裹 main，与 index.html 1:1 一致）===
  function injectTopBarWithMenu() {
    var mainWrap = document.getElementById('layout-body');
    if (!mainWrap) return;
    var mainEl = mainWrap.querySelector(':scope > main');
    if (!mainEl) return;

    // flex-col 容器：包裹 topBar + main
    var col = document.createElement('div');
    col.className = 'flex-1 flex flex-col min-w-0';

    // 50px 顶部标题栏（CSS 与 index.html 完全一致）
    var topBar = document.createElement('div');
    topBar.id = 'topBar';
    topBar.className = 'shrink-0 flex items-center justify-end';
    topBar.style.cssText = 'height:50px;border-bottom:1px solid #F1F5F9;background:rgba(255,255,255,0.6);padding-right:38px;';

    // 汉堡包 + 工具栏（与 index.html 完全一致）
    var nav = document.createElement('div');
    nav.className = 'nav-wrapper';
    nav.id = 'navContainer';
    nav.setAttribute('role', 'navigation');
    nav.setAttribute('aria-label', '工具菜单');
    nav.innerHTML = [
      '<input type="checkbox" id="burger-toggle" class="hidden-toggle" aria-hidden="true" tabindex="-1">',
      '<label class="burger" for="burger-toggle" role="button" tabindex="0" aria-controls="burger-toggle" aria-expanded="false" aria-label="展开工具菜单"><span></span><span></span><span></span></label>',
      '<div class="icon-toolbar" id="iconToolbar" role="toolbar" aria-label="页面工具" aria-hidden="true">',
      '  <button class="icon-btn" title="返回首页" onclick="window.location.href=\'index.html\'">',
      '    <svg stroke="currentColor" stroke-width="1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">',
      '      <path d="M2.25 12l8.954-8.955a1.5 1.5 0 012.122 0L22.28 12M4.5 9.75v10.125A1.125 1.125 0 005.625 21h3.375a1.125 1.125 0 001.125-1.125V15a1.125 1.125 0 011.125-1.125h3a1.125 1.125 0 011.125 1.125v4.875c0 .621.504 1.125 1.125 1.125h3.375A1.125 1.125 0 0020.25 19.875V9.75" stroke-linejoin="round" stroke-linecap="round"></path>',
      '    </svg>',
      '  </button>',
      '  <button class="icon-btn" title="云上传">',
      '    <svg stroke="currentColor" stroke-width="1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">',
      '      <path d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" stroke-linejoin="round" stroke-linecap="round"></path>',
      '    </svg>',
      '  </button>',
      '  <button class="icon-btn" title="截图">',
      '    <svg stroke="currentColor" stroke-width="1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">',
      '      <path d="M7.5 3.75H6A2.25 2.25 0 003.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0120.25 6v1.5m0 9V18A2.25 2.25 0 0118 20.25h-1.5m-9 0H6A2.25 2.25 0 013.75 18v-1.5M15 12a3 3 0 11-6 0 3 3 0 016 0z" stroke-linejoin="round" stroke-linecap="round"></path>',
      '    </svg>',
      '  </button>',
      '  <button class="icon-btn" title="PDF输出">',
      '    <svg stroke="currentColor" stroke-width="1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">',
      '      <path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" stroke-linejoin="round" stroke-linecap="round"></path>',
      '    </svg>',
      '  </button>',
      '  <button class="icon-btn" title="中英切换" onclick="if(window.toggleLang)toggleLang()">',
      '    <svg stroke="currentColor" stroke-width="1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">',
      '      <path d="M4 15l3-8 3 8M5.2 12.5h3.6M13.5 10h5.5v4.5h-5.5z M16.25 7v10.5" stroke-linejoin="round" stroke-linecap="round"></path>',
      '    </svg>',
      '  </button>',
      '  <button class="icon-btn" title="电机数据库" onclick="window._showPwdTerminal()">',
      '    <svg stroke="currentColor" stroke-width="1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">',
      '      <path d="M4.5 6.5c0 1.75 3.36 3 7.5 3s7.5-1.25 7.5-3s-3.36-3-7.5-3s-7.5 1.25-7.5 3z M4.5 6.5v5c0 1.75 3.36 3 7.5 3s7.5-1.25 7.5-3v-5 M4.5 11.5v5c0 1.75 3.36 3 7.5 3s7.5-1.25 7.5-3v-5" stroke-linejoin="round" stroke-linecap="round"></path>',
      '    </svg>',
      '  </button>',
      '</div>'
    ].join('\n');
    topBar.appendChild(nav);

    // 把 main 移入 col，topBar 在前
    mainWrap.insertBefore(col, mainEl);
    col.appendChild(topBar);
    col.appendChild(mainEl);
  }

  // === 密码弹窗 HTML ===
  function injectPwdOverlay() {
    if (document.getElementById('pwd-overlay')) return;
    var div = document.createElement('div');
    div.id = 'pwd-overlay';
    div.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);z-index:99999;justify-content:center;align-items:center;';
    div.innerHTML = [
      '<div style="padding:1rem;overflow:hidden;border:1px solid #c5c5c5;border-radius:12px;background-color:#d9d9d92f;backdrop-filter:blur(8px);min-width:344px;">',
      '  <div style="display:flex;flex-direction:column;gap:1rem;position:relative;z-index:10;border:0.5px solid #525252;border-radius:8px;overflow:hidden;">',
      '    <div style="display:flex;flex-direction:column;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,\'Liberation Mono\',\'Courier New\',monospace;">',
      '      <hgroup style="display:flex;align-items:center;justify-content:space-between;overflow:hidden;min-height:40px;padding-inline:12px;border-top-left-radius:8px;border-top-right-radius:8px;background-color:#202425;">',
      '        <p style="display:flex;align-items:center;gap:8px;height:2.5rem;user-select:none;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#8e8e8e;">',
      '          <svg width="16px" height="16px" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-linejoin="round" stroke-linecap="round" stroke-width="2" stroke="currentColor" fill="none" style="color:#006adc">',
      '            <path d="M7 15L10 12L7 9M13 15H17M7.8 21H16.2C17.8802 21 18.7202 21 19.362 20.673C19.9265 20.3854 20.3854 19.9265 20.673 19.362C21 18.7202 21 17.8802 21 16.2V7.8C21 6.11984 21 5.27976 20.673 4.63803C20.3854 4.07354 19.9265 3.6146 19.362 3.32698C18.7202 3 17.8802 3 16.2 3H7.8C6.11984 3 5.27976 3 4.63803 3.32698C4.07354 3.6146 3.6146 4.07354 3.32698 4.63803C3 5.27976 3 6.11984 3 7.8V16.2C3 17.8802 3 18.7202 3.32698 19.362C3.6146 19.9265 4.07354 20.3854 4.63803 20.673C5.27976 21 6.11984 21 7.8 21Z"></path>',
      '          </svg>',
      '          Terminal',
      '        </p>',
      '      </hgroup>',
      '      <div style="display:flex;flex-direction:column;position:relative;border-bottom-right-radius:8px;border-bottom-left-radius:8px;overflow-x:auto;padding:1rem;line-height:19px;color:white;background-color:black;white-space:nowrap;cursor:text;" onclick="document.getElementById(\'layout-pwd-input\').focus()">',
      '        <pre style="display:flex;flex-direction:row;align-items:center;text-wrap:nowrap;white-space:pre;background-color:transparent;overflow:hidden;box-sizing:border-box;font-size:16px;"><code style="color:#575757">- </code><code style="color:#e34ba9">npx </code><input type="password" id="layout-pwd-input" autocomplete="off" spellcheck="false" style="background:transparent;border:none;color:#fff;font-family:inherit;font-size:inherit;outline:none;width:100%;caret-color:#e34ba9;padding:0;margin:0;" placeholder=""></pre>',
      '        <div id="layout-pwd-error" style="color:#ef4444;font-size:12px;margin-top:8px;display:none;">密码错误</div>',
      '      </div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');
    document.body.appendChild(div);
  }

  // === 汉堡包菜单交互逻辑 ===
  // 权威实现（与 index.html 行 1170-1232 完全同步）：
  //   - 幂等守卫 window.__burgerHoverHooked：内联页脚 IIFE 可安全共存
  //   - mouseenter 展开、mouseleave 后 3000ms 延迟收起（期间 mouseenter 会 clearTimeout）
  //   - 触摸设备：仅 matchMedia('(hover: none)') 判定，命中则跳过 hover 仅走 click
  //   - ARIA：aria-expanded / aria-hidden 通过 syncAria 同步，暴露 window.__syncBurgerAria
  //   - 键盘可达：label 支持 Enter/Space；focusin/focusout 保持展开
  function initBurgerLogic() {
    if (window.__burgerHoverHooked) return;
    var navContainer = document.getElementById('navContainer');
    var burgerToggle = document.getElementById('burger-toggle');
    var burgerLabel = navContainer && navContainer.querySelector('.burger');
    var iconToolbar = document.getElementById('iconToolbar');
    if (!navContainer || !burgerToggle) return;
    window.__burgerHoverHooked = true;

    var isTouchDevice = window.matchMedia && window.matchMedia('(hover: none)').matches;

    function syncAria(){
      var open = !!burgerToggle.checked;
      if (burgerLabel) {
        burgerLabel.setAttribute('aria-expanded', open ? 'true' : 'false');
        burgerLabel.setAttribute('aria-label', open ? '收起工具菜单' : '展开工具菜单');
      }
      if (iconToolbar) iconToolbar.setAttribute('aria-hidden', open ? 'false' : 'true');
    }
    syncAria();
    // 暴露给 _showPwdTerminal / pdf-dialog 等主动改 checked 的入口调用
    window.__syncBurgerAria = syncAria;

    // label 键盘可达（点击已由 label→for 覆盖）
    if (burgerLabel) {
      burgerLabel.addEventListener('keydown', function(e){
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar'){
          e.preventDefault();
          burgerToggle.checked = !burgerToggle.checked;
          syncAria();
        }
      });
    }
    burgerToggle.addEventListener('change', syncAria);

    // 触摸设备：不绑 hover，仅走原生 click / 键盘
    if (!isTouchDevice) {
      var HOVER_CLOSE_DELAY = 3000;
      var closeTimeout = null;

      function openMenu(){
        if (closeTimeout){ clearTimeout(closeTimeout); closeTimeout = null; }
        if (!burgerToggle.checked){
          burgerToggle.checked = true;
          syncAria();
        }
      }
      function scheduleClose(){
        if (closeTimeout) clearTimeout(closeTimeout);
        if (!burgerToggle.checked) return;
        closeTimeout = setTimeout(function(){
          burgerToggle.checked = false;
          syncAria();
          closeTimeout = null;
        }, HOVER_CLOSE_DELAY);
      }
      // mouseenter/mouseleave 天然不冒泡，绑定在最外层 #navContainer
      navContainer.addEventListener('mouseenter', openMenu);
      navContainer.addEventListener('mouseleave', scheduleClose);
      // 键盘焦点：进入容器展开，离开容器安排收起
      navContainer.addEventListener('focusin', openMenu);
      navContainer.addEventListener('focusout', function(e){
        if (navContainer.contains(e.relatedTarget)) return;
        scheduleClose();
      });
    }

    // Toast 提示
    window._layoutToast = function(text){
      var toast = document.createElement('div');
      toast.textContent = text;
      toast.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%) translateY(-20px);background:rgba(15,23,42,0.92);color:white;padding:10px 20px;border-radius:20px;font-size:13px;font-weight:600;z-index:99999;opacity:0;transition:all .3s;font-family:"Plus Jakarta Sans",system-ui,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,0.2);';
      document.body.appendChild(toast);
      requestAnimationFrame(function(){
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
      });
      setTimeout(function(){
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-20px)';
        setTimeout(function(){ toast.remove(); }, 300);
      }, 2200);
    };

    // 截图功能已禁用（打包版本不加载 html2canvas）
    window._captureScreen = function(){};
    window.captureScreen = window._captureScreen;
  }

  // === 密码弹窗交互逻辑 ===
  function initPwdLogic() {
    window._showPwdTerminal = function() {
      var bt = document.getElementById('burger-toggle');
      if (bt) bt.checked = false;
      if (typeof window.__syncBurgerAria === 'function') window.__syncBurgerAria();
      if (sessionStorage.getItem('moen_db_auth') === 'true') {
        window.location.href = 'motor-db.html';
        return;
      }
      var overlay = document.getElementById('pwd-overlay');
      overlay.style.display = 'flex';
      void overlay.offsetWidth;
      overlay.classList.add('show');
      var inp = document.getElementById('layout-pwd-input');
      inp.value = '';
      setTimeout(function(){ inp.focus(); }, 200);
    };

    window.showPwdTerminal = window._showPwdTerminal;

    document.getElementById('pwd-overlay').addEventListener('click', function(e) {
      if (e.target === this) {
        this.style.display = 'none';
        this.classList.remove('show');
        document.getElementById('layout-pwd-input').value = '';
        document.getElementById('layout-pwd-error').style.display = 'none';
      }
    });

    document.getElementById('layout-pwd-input').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        var pwd = this.value.trim();
        if (pwd === 'moen-sjk.12') {
          sessionStorage.setItem('moen_db_auth', 'true');
          window.location.href = 'motor-db.html';
        } else {
          this.value = '';
          document.getElementById('layout-pwd-error').style.display = 'block';
          setTimeout(function(){ document.getElementById('layout-pwd-error').style.display = 'none'; }, 2000);
        }
      }
      if (e.key === 'Escape') {
        var ov = document.getElementById('pwd-overlay');
        ov.style.display = 'none';
        ov.classList.remove('show');
        this.value = '';
      }
    });
  }

})();
