(function () {
  'use strict';

  // 电气时间常数 = 单相电感(mH) ÷ 单相电阻(Ω)，结果天然为 ms；仅在搜索详情中展示。
  var MOTOR_FIELDS = [['pf','峰值推力','N'],['cf','持续推力','N'],['fc','推力常数','N/Arms'],['mc','电机常数','N²/W'],['pi','峰值电流','Arms'],['ci','持续电流','Arms'],['be','反电动势','V/m/s'],['res','单相电阻','Ω'],['ind','单相电感','mH'],['etc','电气时间常数','ms'],['pw','最大持续功率','W'],['tr','热阻','℃/W'],['cm','线圈重量','kg'],['cl','线圈长度','mm'],['at','吸引力','N'],['pt','磁节距','mm']];
  var MOTOR_FIELD_PRESENTATION = {
    pf:{name:'峰值推力',unit:'N',order:10,group:'推力与功率'},cf:{name:'持续推力',unit:'N',order:20,group:'推力与功率'},
    fc:{name:'推力常数',unit:'N/Arms',order:30,group:'推力与功率'},mc:{name:'电机常数',unit:'N²/W',order:40,group:'推力与功率'},
    pw:{name:'最大持续功率',unit:'W',order:50,group:'推力与功率'},pi:{name:'峰值电流',unit:'Arms',order:60,group:'电气参数'},
    ci:{name:'持续电流',unit:'Arms',order:70,group:'电气参数'},be:{name:'反电动势',unit:'V/m/s',order:80,group:'电气参数'},
    res:{name:'单相电阻',unit:'Ω',order:90,group:'电气参数'},ind:{name:'单相电感',unit:'mH',order:100,group:'电气参数'},
    etc:{name:'电气时间常数',unit:'ms',order:110,group:'电气参数'},tr:{name:'热阻',unit:'℃/W',order:120,group:'热与结构参数'},
    cm:{name:'线圈重量',unit:'kg',order:130,group:'热与结构参数'},cl:{name:'线圈长度',unit:'mm',order:140,group:'热与结构参数'},
    at:{name:'吸引力',unit:'N',order:150,group:'热与结构参数'},pt:{name:'磁节距',unit:'mm',order:160,group:'热与结构参数'}
  };
  var DRIVER_FIELDS = [['ci','持续电流','Arms'],['pi','峰值电流','Arms']];
  var DEFAULT_DRIVER_FEATURES = [
    {key:'protocol',name:'通讯协议',builtin:true},{key:'voltage',name:'电压',builtin:true},
    {key:'hall',name:'霍尔传感器',builtin:true},{key:'incremental',name:'增量式ABZ',builtin:true},
    {key:'absolute',name:'绝对值编码器',builtin:true},{key:'gantry',name:'龙门同动',builtin:true},
    {key:'compensation',name:'绝对定位补偿',builtin:true},{key:'pcom',name:'位置比较输出',builtin:true}
  ];
  var DRIVER_FEATURE_PRESENTATION = {
    protocol:{name:'通讯协议',order:10,group:'基础规格'},feature_额定功率:{name:'额定功率',order:20,group:'基础规格'},
    voltage:{name:'电压',order:30,group:'基础规格'},feature_输入电源:{name:'输入电源',order:40,group:'基础规格'},
    hall:{name:'霍尔传感器',order:50,group:'反馈与编码器'},incremental:{name:'增量式ABZ',order:60,group:'反馈与编码器'},
    absolute:{name:'绝对值编码器',order:70,group:'反馈与编码器'},gantry:{name:'龙门同动',order:80,group:'其他功能'},
    compensation:{name:'绝对定位补偿',order:90,group:'其他功能'},pcom:{name:'位置比较输出',order:100,group:'其他功能'},
    feature_STO安全功能:{name:'STO安全功能',order:110,group:'其他功能'}
  };

  function text(value) { return value === undefined || value === null || value === '' ? '—' : String(value); }
  function esc(value) { return text(value).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function norm(value) { return String(value || '').replace(/\s+/g, '').toUpperCase(); }
  function score(value, query) { var target = norm(value); return target === query ? 0 : target.indexOf(query) === 0 ? 1 : target.indexOf(query) >= 0 ? 2 : 99; }
  // 搜索结果按用户看到的型号/代码去重，保留排序后的第一条完整记录供详情弹窗使用。
  function uniqueBy(items, valueOf) {
    var seen = {};
    return items.filter(function (item) {
      var key = norm(valueOf(item));
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }
  function kv(label, value) { return '<div class="search-kv"><b>' + esc(label) + '</b><span>' + esc(value) + '</span></div>'; }
  function fieldValue(item, key) {
    if (key === 'etc') {
      var inductance = Number(item.ind), resistance = Number(item.res);
      if (!isFinite(inductance) || !isFinite(resistance) || resistance === 0) return null;
      return Math.round((inductance / resistance) * 1000) / 1000;
    }
    if (typeof key !== 'object') return item[key];
    return key.feature.builtin ? item[key.feature.key] : (item.features || {})[key.feature.key];
  }
  function grid(fields, item) { return '<div class="search-grid">' + fields.map(function (field) { return kv(field[1], text(fieldValue(item, field[0])) + field[2]); }).join('') + '</div>'; }
  function motorGrid(motor) {
    var lastGroup = '';
    return '<div class="search-driver-grid">' + MOTOR_FIELDS.map(function(field) {
      var presentation = MOTOR_FIELD_PRESENTATION[field[0]], group = presentation.group !== lastGroup ? '<div class="search-driver-group">' + esc(presentation.group) + '</div>' : '';
      lastGroup = presentation.group;
      return group + kv(presentation.name, text(fieldValue(motor, field[0])) + presentation.unit);
    }).join('') + '</div>';
  }
  function driverGrid(driver) {
    var features = Array.isArray(window.DRIVER_FEATURES) && window.DRIVER_FEATURES.length ? window.DRIVER_FEATURES : DEFAULT_DRIVER_FEATURES;
    var entries = features.map(function(feature, index) {
      var presentation = DRIVER_FEATURE_PRESENTATION[feature.key];
      return { name:presentation ? presentation.name : feature.name, value:feature.builtin ? driver[feature.key] : (driver.features || {})[feature.key], order:presentation ? presentation.order : 1000 + index, group:presentation ? presentation.group : '其他信息' };
    }).filter(function(entry) { return entry.value !== undefined && entry.value !== null && entry.value !== ''; })
      .sort(function(a, b) { return a.order - b.order; });
    var lastGroup = '';
    return '<div class="search-driver-grid">' + entries.map(function(entry) {
      var group = entry.group !== lastGroup ? '<div class="search-driver-group">' + esc(entry.group) + '</div>' : '';
      lastGroup = entry.group;
      return group + kv(entry.name, entry.value);
    }).join('') + '</div>';
  }

  function allMotors() {
    var list = [];
    Object.keys(window.DB || {}).forEach(function (type) {
      var seriesMap = window.DB[type] && window.DB[type].series || {};
      Object.keys(seriesMap).forEach(function (series) { seriesMap[series].forEach(function (motor) { list.push({type:type,series:series,motor:motor}); }); });
    });
    return list;
  }

  function positionDetailModal() {
    var main = document.getElementById('mainWorkspace');
    var modal = document.getElementById('sidebarSearchDetail');
    if (!main || !modal) return;
    var rect = main.getBoundingClientRect();
    var breathing = Math.max(20, Math.min(Math.min(rect.width, rect.height) * 0.1, 150));
    // 上边距减少 70px、下边距相应增加 70px，使弹窗整体上移且高度不变。
    modal.style.setProperty('--search-modal-top', Math.round(rect.top + breathing + 5) + 'px');
    modal.style.setProperty('--search-modal-right', Math.round(window.innerWidth - rect.right + breathing + 30) + 'px');
    // 下边距额外减少 60px；整体上移时相应增加 70px，以保持当前弹窗高度。
    modal.style.setProperty('--search-modal-bottom', Math.round(window.innerHeight - rect.bottom + breathing - 15) + 'px');
    // 左右边距各减少 20px，使弹窗两端分别向外扩展 20px。
    modal.style.setProperty('--search-modal-left', Math.round(rect.left + breathing + 30) + 'px');
  }
  function setDetailFogVisible(visible) {
    var fog = document.getElementById('sidebarSearchFog');
    var modeFog = document.getElementById('modeBarSearchFog');
    if (visible) positionDetailModal();
    if (fog) fog.hidden = !visible;
    if (modeFog) modeFog.hidden = !visible;
  }
  function closeDetail() { var modal = document.getElementById('sidebarSearchDetail'); if (modal) modal.hidden = true; setDetailFogVisible(false); var main = document.getElementById('mainWorkspace'); if (main) main.classList.remove('search-modal-open'); }
  function closeCandidates() { var panel = document.getElementById('sidebarSearchResults'); var input = document.getElementById('sidebarSearch'); if (panel) panel.hidden = true; if (input) input.setAttribute('aria-expanded', 'false'); }
  function detailShell(title, body, contentClass) { return '<div class="search-detail-head"><h3>' + esc(title) + '</h3><button class="search-detail-close" type="button" aria-label="关闭" onclick="window.closeSidebarSearchDetail()">×</button></div><div class="search-detail-content' + (contentClass ? ' ' + contentClass : '') + '">' + body + '</div>'; }

  function showMotor(entry) {
    var modal = document.getElementById('sidebarSearchDetail'); if (!modal) return;
    modal.innerHTML = detailShell('电机参数 · ' + entry.motor.n, '<article class="search-card"><h4>' + esc(entry.motor.n) + '</h4><div class="search-meta">类型：' + esc(entry.type) + ' · 系列：' + esc(entry.series) + '</div>' + motorGrid(entry.motor) + '</article>');
    modal.hidden = false; setDetailFogVisible(true); document.getElementById('mainWorkspace').classList.add('search-modal-open'); closeCandidates();
  }
  function showDriver(driver, title) {
    var modal = document.getElementById('sidebarSearchDetail'); if (!modal) return;
    modal.innerHTML = detailShell(title || ('驱动器参数 · ' + driver.model), '<article class="search-card"><h4>' + esc(driver.model) + '</h4><div class="search-meta">系列：' + esc(driver.series) + ' · 驱动器代码：' + esc(driver.code) + '</div><div class="search-driver-current">' + kv('持续电流', text(driver.ci) + ' Arms') + kv('峰值电流', text(driver.pi) + ' Arms') + '</div>' + driverGrid(driver) + '</article>');
    modal.hidden = false; setDetailFogVisible(true); document.getElementById('mainWorkspace').classList.add('search-modal-open'); closeCandidates();
  }
  function showModule(raw, motors) {
    // 型号末尾的半角/全角括号内容为非标标识；主体型号照常解析，非标内容以实际 BOM 为准。
    var nonStandardMatch = String(raw).trim().match(/[（(]([^（）()]+)[）)]\s*$/);
    var nonStandard = nonStandardMatch ? nonStandardMatch[1].trim() : '';
    var moduleCode = nonStandardMatch ? String(raw).trim().slice(0, nonStandardMatch.index).trim() : String(raw).trim();
    var normalized = norm(moduleCode), gantry = normalized.indexOf('G-') === 0;
    if (gantry) normalized = normalized.slice(2);
    var parts = normalized.split('-'), head = (parts[0] || '').match(/^(SXSW|SXW|SXK)(\d+)$/);
    if (!head) return false;
    var profileNames = {SXW:'半封闭', SXSW:'全封闭', SXK:'开放式'};
    var encoderNames = {I:'增量式编码器', A:'绝对值编码器'};
    var scaleNames = {F:'磁栅', M:'光栅'};
    var cableNames = {O:'待定',L5:'5 m',L7:'7 m',L10:'10 m',L15:'15 m'};
    var sensorNames = {N:'NPN',P:'PNP'};
    var motorCode = parts[2] || '', driverCode = parts[8] || '';
    // 模组解析不返回“常规直线电机模组”内重复维护的电机记录，避免同一型号产生歧义。
    var matchedMotors = motors.filter(function(entry){ return entry.type !== '常规直线电机模组' && norm(entry.motor.n.replace(/^M/i,'').replace(/-/g,'')) === motorCode; });
    var matchedDrivers = (window.DRIVER_DB || []).filter(function(driver){ return norm(driver.code) === driverCode; });
    var lines = [
      '模组结构：' + (gantry ? '龙门 · ' : '') + profileNames[head[1]] + '，型材宽度 ' + head[2] + ' mm',
      '有效行程：' + (parts[1] ? parts[1] + ' mm' : '未提供'),
      '电机代码：' + (motorCode || '未提供') + (matchedMotors.length ? ' → ' + matchedMotors.map(function(entry){ return entry.motor.n; }).join(' / ') : ''),
      '动子数量：' + (parts[3] || '未提供'),
      '编码器：' + (encoderNames[parts[4]] || parts[4] || '未提供') + '；栅尺：' + (scaleNames[parts[5]] || parts[5] || '未提供') + '；分辨率：' + (parts[6] ? parts[6] + ' μm' : '未提供'),
      '线缆：' + (cableNames[parts[7]] || parts[7] || '未提供') + '；驱动器代码：' + (driverCode || '未提供') + (matchedDrivers.length ? ' → ' + matchedDrivers.map(function(driver){ return driver.model; }).join(' / ') : ''),
      '光电传感器：' + (sensorNames[parts[9]] || parts[9] || '未提供') + (parts[10] === 'H' ? '；需要霍尔传感器' : '')
    ];
    if (nonStandard) lines.push('非标：' + nonStandard + '（以实际 BOM 为准）');
    var moduleDetail = '<article class="search-card"><h4>' + esc(raw) + '</h4><div class="search-analysis">' + lines.map(function(line){ return '<div>' + esc(line) + '</div>'; }).join('') + '</div></article>';
    // 左列：模组解析下方仅保留一个对应驱动器（同型号去重）。
    var driverDetail = uniqueBy(matchedDrivers, function(driver){ return driver.model; }).map(function(driver){
      return '<article class="search-card"><h4>对应驱动器：' + esc(driver.model) + '</h4><div class="search-meta">系列：' + esc(driver.series) + ' · 驱动器代码：' + esc(driver.code) + '</div><div class="search-driver-current">' + kv('持续电流', text(driver.ci) + ' Arms') + kv('峰值电流', text(driver.pi) + ' Arms') + '</div>' + driverGrid(driver) + '</article>';
    }).join('');
    // 右列：只放对应电机，避免与左侧模组分析、驱动器信息交错。
    var motorDetail = matchedMotors.map(function(entry){
      return '<article class="search-card"><h4>对应电机：' + esc(entry.motor.n) + '</h4><div class="search-meta">模组类型：' + esc(entry.type) + ' · 系列：' + esc(entry.series) + '</div>' + motorGrid(entry.motor) + '</article>';
    }).join('');
    var detail = '<div class="search-module-detail-column">' + moduleDetail + driverDetail + '</div><div class="search-module-detail-column">' + motorDetail + '</div>';
    var modal = document.getElementById('sidebarSearchDetail');
    if (modal) { modal.innerHTML = detailShell('模组型号解析', detail, 'search-module-detail-content'); modal.hidden = false; setDetailFogVisible(true); document.getElementById('mainWorkspace').classList.add('search-modal-open'); closeCandidates(); }
    return true;
  }

  function render(query) {
    var input = document.getElementById('sidebarSearch'), panel = document.getElementById('sidebarSearchResults');
    if (!input || !panel) return;
    var q = norm(query);
    if (!q) { closeCandidates(); closeDetail(); return; }
    var motors = allMotors();
    // 常规直线电机模组的数据用于模组型号解析关联，但不作为独立电机型号搜索结果返回。
    var searchableMotors = motors.filter(function (entry) { return entry.type !== '常规直线电机模组'; });
    if (/^(G-)?SX(SW|W|K)\d+/i.test(String(query).trim())) { showModule(query, motors); return; }
    var motorResults = uniqueBy(searchableMotors.filter(function (entry) { return score(entry.motor.n, q) < 99; }).sort(function(a,b){ return score(a.motor.n,q)-score(b.motor.n,q); }), function (entry) { return entry.motor.n; }).slice(0,16);
    var driverModelResults = uniqueBy((window.DRIVER_DB || []).filter(function (driver) { return score(driver.model, q) < 99; }).sort(function(a,b){ return score(a.model,q)-score(b.model,q); }), function (driver) { return driver.model; }).slice(0,16);
    var driverCodeResults = uniqueBy((window.DRIVER_DB || []).filter(function (driver) { return score(driver.code, q) < 99; }).sort(function(a,b){ return score(a.code,q)-score(b.code,q); }), function (driver) { return driver.code; }).slice(0,16);
    var exactMotor = motorResults.filter(function (entry) { return score(entry.motor.n, q) === 0; });
    var exactDriverModel = driverModelResults.filter(function (driver) { return score(driver.model, q) === 0; });
    var exactDriverCode = driverCodeResults.filter(function (driver) { return score(driver.code, q) === 0; });

    if (exactMotor.length === 1) { showMotor(exactMotor[0]); return; }
    if (exactDriverModel.length === 1) { showDriver(exactDriverModel[0]); return; }
    if (exactDriverCode.length === 1) { showDriver(exactDriverCode[0], '驱动器代码参数 · ' + exactDriverCode[0].code); return; }
    closeDetail();

    var groups = [];
    if (motorResults.length) groups.push('<section class="search-group"><div class="search-group-title">电机型号</div>' + motorResults.map(function(entry, index){ return '<button class="search-candidate" type="button" data-kind="motor" data-index="' + index + '"><strong>' + esc(entry.motor.n) + '</strong></button>'; }).join('') + '</section>');
    if (driverModelResults.length) groups.push('<section class="search-group"><div class="search-group-title">驱动器型号</div>' + driverModelResults.map(function(driver, index){ return '<button class="search-candidate" type="button" data-kind="driver-model" data-index="' + index + '"><strong>' + esc(driver.model) + '</strong><span>' + esc(driver.series) + '</span></button>'; }).join('') + '</section>');
    if (driverCodeResults.length) groups.push('<section class="search-group"><div class="search-group-title">驱动器代码</div>' + driverCodeResults.map(function(driver, index){ return '<button class="search-candidate" type="button" data-kind="driver-code" data-index="' + index + '"><strong>' + esc(driver.code) + '</strong><span>' + esc(driver.series) + '</span></button>'; }).join('') + '</section>');
    panel.innerHTML = groups.length ? groups.join('') : '<div class="search-empty">未找到匹配的电机型号、驱动器型号或驱动器代码。</div>';
    panel.hidden = false; input.setAttribute('aria-expanded', 'true');
    panel.querySelectorAll('.search-candidate').forEach(function(button){ button.addEventListener('click', function(){ var i = Number(this.dataset.index); if (this.dataset.kind === 'motor') showMotor(motorResults[i]); else if (this.dataset.kind === 'driver-model') showDriver(driverModelResults[i]); else showDriver(driverCodeResults[i], '驱动器代码参数 · ' + driverCodeResults[i].code); }); });
  }

  function init() {
    var input = document.getElementById('sidebarSearch'), panel = document.getElementById('sidebarSearchResults');
    if (!input || !panel) return;
    window.closeSidebarSearchDetail = closeDetail;
    input.addEventListener('input', function(){ render(this.value); });
    input.addEventListener('focus', function(){ if (this.value.trim()) render(this.value); });
    input.addEventListener('keydown', function(event){ if (event.key === 'Escape') { closeCandidates(); closeDetail(); input.blur(); } });
    document.addEventListener('pointerdown', function(event){ if (!event.target.closest('#sidebarSearch') && !event.target.closest('#sidebarSearchResults') && !event.target.closest('#sidebarSearchDetail')) closeCandidates(); });
    window.addEventListener('resize', function(){ var modal = document.getElementById('sidebarSearchDetail'); if (modal && !modal.hidden) positionDetailModal(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
