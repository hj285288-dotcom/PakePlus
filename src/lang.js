/* ==========================================================================
   中英切换（index.html）
   - 用 data-i18n="key" 标记静态文本
   - 用 data-i18n-attr="attr|key" 标记属性（如 placeholder、title、value）
   - 页面级文本（mode、shape、placeholder、按钮等）用字典
   - 用 localStorage 持久化偏好
   ========================================================================== */
var _moen_lang = 'zh';  // 全局快捷访问
function _t(key){ return (window.I18N_DICT && window.I18N_DICT[_moen_lang] && window.I18N_DICT[_moen_lang][key]) || key; }
window._t = _t;

(function(){
  var KEY = 'moen_lang';

  var I18N = {
    zh: {
      pageTitle: 'Moen Tech — 直驱电机选型',
      sidebarSub: '直驱电机选型系统',
      searchPh: '搜索…',
      // 顶栏
      linear: '线性电机',
      rotary: '旋转电机',
      rotaryTitle: '旋转电机（暂未开放）',
      cloud: '云上传',
      screenshot: '截图',
      pdf: 'PDF输出',
      langTitle: '中英切换',
      db: '后台数据',
      // L2 侧边栏
      l2ind: '独立运动曲线',
      l2com: '电机控制方案',
      l2ctl: '模组控制方案',
      blockNotice: '请选择 <span class="mx-1 font-semibold text-primary-600">直线马达</span> + <span class="mx-1 font-semibold text-primary-600">独立运动曲线</span>',
      blockNoticeEn: 'Please select <span class="mx-1 font-semibold text-primary-600">Linear Motor</span> + <span class="mx-1 font-semibold text-primary-600">Independent Motion Curve</span>',
      // 模式
      runMode: '运行模式',
      p2p: '点到点',
      cus: '自定义',
      shape: '形状',
      trap: '梯形',
      tri: '三角形',
      // 工况参数
      cardWork: '工况参数',
      dist: '运动行程', distUnit: 'm',
      time: '时间', timeUnit: 's',
      speed: '速度', speedUnit: 'm/s',
      accel: '加速度', accelUnit: 'm/s²',
      dwell: '停留时间', dwellUnit: 's',
      mass: '质量', massUnit: 'kg',
      mu: '摩擦系数',
      fx: '反作用力', fxUnit: 'N',
      ang: '倾斜角', angUnit: '°',
      temp: '温度', tempUnit: '°C',
      // 理论计算
      cardCalc: '理论计算',
      c0: '输入参数后自动计算',
      // 选型筛选
      cardFilter: '选型筛选',
      safetyMargin: '安全余量',
      motorType: '电机类型',
      motorSeries: '电机系列',
      matchedModel: '匹配型号',
      btnSave: '保存曲线',
      btnClear: '清空数据',
      btnSaveOver: '超限 - 无法保存',
      btnSaveSaved: '已保存',
      btnMore: 'more',
      // 曲线区
      cardVel: '时间 / 速度曲线',
      cardForce: '推力 / 时间曲线',
      // 电机参数
      m1t: '电机出厂参数',
      m0: '选择电机后显示',
      a0: '选择电机后计算',
      a1: '实际应用计算值',
      // 计算结果 key
      rk_cf: '持续推力', rk_cfunit: ' N',
      rk_pf: '峰值推力', rk_pfunit: ' N',
      rk_ff: '摩擦力', rk_ffunit: ' N',
      rk_at: '加减速时间', rk_atunit: ' s',
      rk_ad: '加减速距离', rk_adunit: ' mm',
      rk_ct: '匀速时间', rk_ctunit: ' s',
      rk_cd: '匀速距离', rk_cdunit: ' mm',
      rk_tc: '总循环周期', rk_tcunit: ' s',
      rk_fc: '推力常数', rk_fcunit: ' N/Arms',
      rk_be: '反电动势', rk_beunit: ' V/m/s',
      rk_ci: '持续电流', rk_ciunit: ' Arms',
      rk_pi: '峰值电流', rk_piunit: ' Arms',
      rk_ind: '相间电感', rk_indunit: ' mH',
      rk_res: '相间电阻', rk_resunit: ' Ω',
      rk_cm: '线圈质量', rk_cmunit: ' kg',
      rk_aCf: '持续推力', rk_aCfunit: ' N',
      rk_aPk: '峰值推力', rk_aPkunit: ' N',
      rk_cI: '持续电流', rk_cIunit: ' A',
      rk_pI: '峰值电流', rk_pIunit: ' A',
      rk_cT: '线圈温度', rk_cTunit: ' °C',
      rk_dc: '直流母线电压', rk_dcunit: ' V',
      rk_sf: '静摩擦力', rk_sfunit: ' N',
      rk_cmg: '持续推力余量', rk_cmgunit: ' %',
      rk_pmg: '峰值推力余量', rk_pmgunit: ' %',
      // 多曲线按钮（按曲线 key 映射）
      curve_s:  '运动',
      curve_v:  '速度',
      curve_a:  '加速度',
      curve_j:  '加加速度',
      curve_F:  '力',
      curve_P:  '功率',
      curve_U:  '电压',
      curve_I:  '电流',
      curve_T:  '温度',
      curve_Fv: 'F/v',
      // 错误提示
      errCd: '⚠ 加减速距离超过运动距离',
      // 加载 3D
      loading3D: '加载 3D 模型中...',
      // 单位换算提示
      jerkUnit: 'm/s³',
      // 密码弹窗
      terminal: 'Terminal',
      pwdError: '密码错误',
      // 截图
      shotTitle: '截图已保存：',
      // 限制提示（内嵌模组）
      overSpeed: '速度 ',
      overSpeedSuf: 'm/s 超过限速 ',
      overSpeedSuf2: 'm/s',
      overLoad: '负载 ',
      overLoadSuf: 'kg 超过水平安装限制 ',
      overLoadSuf2: 'kg',
      hintPrefix: '💡 ',
      warnPrefix: '⚠ ',
      // 默认无匹配
      noMatch: '无匹配，请调整参数',
      noMatchEn: 'No match, please adjust parameters',
      // 焦油/侧提示
      rotaryNudge: '请先完成计算并选择电机型号',
      p2pNudge: '请先完成计算并点击"保存曲线"',
      // "more" 按钮 title
      moreTitle: '打开多曲线视图（10 条曲线任意选 2 条对比）',
      moreTitleEn: 'Open multi-curve view (pick any 2 from 10 curves to compare)',
      // 多曲线 Jerk 提示
      jerkLabel: 'Jerk',
      jerkTitle: '加加速度功能暂未开放',
      jerkTitleEn: 'Jerk function not yet available',

      // ===== motor-control.html / control.html 通用 =====
      // 顶栏 / 侧栏
      navHome: '返回首页',
      // 运动节拍卡片
      mpTitle: '运动节拍',
      mpDist: '运行行程',
      mpVel:  '最大速度',
      mpAcc:  '最大加速度',
      mpAt:   '加速时间',
      mpCt:   '匀速时间',
      mpAd:   '加速距离',
      mpCd:   '匀速距离',
      mpDw:   '停顿时间',
      mpTc:   '循环总周期',
      // 电机信息卡片
      miTitle: '电机信息',
      miMn:    '电机型号',
      miAcf:   '持续推力',
      miApk:   '峰值推力',
      miAci:   '持续电流',
      miApi:   '峰值电流',
      miDc:    '母线电压',
      miCt:    '线圈温度',
      miCmg:   '持续余量',
      miPmg:   '峰值余量',
      // 驱动器筛选
      dfTitle:    '驱动器筛选',
      dfProtocol: '通讯协议',
      dfVoltage:  '电压类型',
      dfEncoder:  '编码器协议',
      dfHall:     '霍尔传感器',
      dfGantry:   '龙门模式',
      dfComp:     '定位精度补偿',
      dfPcom:     '位置比较输出',
      dfThSeries: '系列',
      dfThModel:  '型号',
      dfThCi:     '持续(A)',
      dfThPi:     '峰值(A)',
      dfThCode:   '代码',
      dfDblclick: '双击表格行选择驱动器',
      dfSelected: '已选择: ',
      dfNomatch:  '无匹配驱动器',
      // 通用值
      optPulse:    '脉冲',
      optVoltMid:  '中压',
      optVoltHigh: '高压',
      optEncInc:   '增量式',
      optEncAbs:   '绝对值',
      optYes:      '需要',
      optNo:       '不需要',
      // 型号预览
      mPreview:  '型号预览',
      mAnalysis: '型号解析',
      mCopy:     '复制型号',
      mCopied:   '已复制',
      mCopyFail: '复制失败',

      // ===== motor-control.html 专属 =====
      mcPageTitle:    'Moen Tech — 电机控制方案',
      mcLoadingMotor: '等待电机模型...',
      mcModelGen:     '电机型号生成',
      mcTemp:         '温度传感器',
      mcTempStd:      '标准无温控',
      mcTempPTC:      'PTC&NTC',
      mcCable:        '线缆长度',
      mcCablePh:      '标准0.5米',
      mcConnector:    '连接器规格',
      mcConnStd:      '标准规格',
      mcConnNA:       '尾部散线',
      mcVoltage:      '电压规格',
      mcDriver:       '驱动器',
      mcDriverNote:   '驱动器请与技术确认',
      mcDriverNotSel: '请双击驱动器型号',
      mcPleaseSelect: '请先在"独立运动曲线"页面选择电机',
      mcDcOver:       '母线电压过高-',
      mcPleaseUse:    '请使用',
      mcDriverSuf:    '驱动器-',
      mcHighV:        '高压',
      mcMarginWarn:   '注意余量-',
      mcLoadingPrefix:'加载 ',
      mcNoMotorData:  '无电机数据，请先选型',
      mcDataParseErr: '数据解析失败',
      mcNoMotorModel: '无电机型号',
      mcCantParse:    '无法解析型号: ',
      mcMoverFail:    '动子模型加载失败: ',
      mcDescMotor:    '电机型号：',
      mcDescTemp:     '温度传感器：',
      mcDescCable:    '线缆长度：',
      mcDescCableUnit:'米',
      mcDescCableStd: '线缆长度：标准0.5米',
      mcDescConn:     '连接器规格：',
      mcDescVolt:     '电压规格：',
      mcDescHallNeed: '需要霍尔传感器',
      mcDescDriver:   '驱动器：',
      mcDescDrvTBD:   '待选',
      mcDescDrvNo:    '不需要',
      mcStroke:       '有效行程',
      mcStrokePh:     '选填',
      mcStatorPlan:   '定子方案',

      // ===== control.html 专属 =====
      ctlPageTitle:     'Moen Tech — 电机控制方案',
      ctlLoading:       '加载中...',
      ctlModelGen:      '模组型号生成',
      ctlProfile:       '模组结构',
      ctlProfileSemi:   '半封闭',
      ctlProfileFull:   '全封闭',
      ctlProfileOpen:   '敞开式',
      ctlStroke:        '有效行程',
      ctlScale:         '栅尺类型',
      ctlScaleMag:      '磁栅',
      ctlScaleOpt:      '光栅',
      ctlRes:           '分辨率',
      ctlMovers:        '动子数量',
      ctlCable:         '线缆长度',
      ctlCableTBD:      '待定',
      ctlSensor:        '光电传感器',
      ctlOverLimit:     '型材长度限制，联系技术',
      ctlGantry:        '龙门',
      ctlGantryPrefix:  '龙门：',
      ctlModTotalLen:   '模组总长：',
      ctlOverLimitText: '超限',
      ctlGantryNoDrv:   '龙门，暂无确认驱动器',
      ctlNoDrv:         '暂无确认驱动器',
      ctlDrvPrefix:     '驱动器：',
      ctlCableTBDLine:  '线缆待定',
      ctlCablePrefix:   '线缆',
      ctlCableUnit:     '米',
      ctlNpn:           'NPN传感器',
      ctlPnp:           'PNP传感器',
      ctlHallNeed:      '需要霍尔',
      ctlMmWide:        'mm宽',
      ctlMmUnit:        'mm',
      ctlResUnit:       '微米',
      ctlMotorTBD:      '电机待选',
      ctlMoverX:        '，动子×',
      ctlPleaseFill:    '请完善型号参数',
      ctlOverLimitInfo: '（超限 ',
      ctlOverLimitInfo2:'mm）'
    },
    en: {
      pageTitle: 'Moen Tech — Direct-Drive Motor Selection',
      sidebarSub: 'Direct Drive Selection',
      searchPh: 'Search…',
      linear: 'Linear',
      rotary: 'Rotary',
      rotaryTitle: 'Rotary Motor (not yet available)',
      cloud: 'Cloud Upload',
      screenshot: 'Screenshot',
      pdf: 'PDF Output',
      langTitle: 'Switch Language',
      db: 'Database',
      l2ind: 'Independent Curve',
      l2com: 'Motor Control',
      l2ctl: 'Module Control',
      blockNotice: 'Please select <span class="mx-1 font-semibold text-primary-600">Linear Motor</span> + <span class="mx-1 font-semibold text-primary-600">Independent Motion Curve</span>',
      blockNoticeZh: '请选择 <span class="mx-1 font-semibold text-primary-600">直线马达</span> + <span class="mx-1 font-semibold text-primary-600">独立运动曲线</span>',
      runMode: 'Mode',
      p2p: 'P2P',
      cus: 'Custom',
      shape: 'Shape',
      trap: 'Trapezoid',
      tri: 'Triangle',
      cardWork: 'Operating Conditions',
      dist: 'Distance', distUnit: 'm',
      time: 'Time', timeUnit: 's',
      speed: 'Velocity', speedUnit: 'm/s',
      accel: 'Accel.', accelUnit: 'm/s²',
      dwell: 'Dwell Time', dwellUnit: 's',
      mass: 'Mass', massUnit: 'kg',
      mu: 'Friction Coeff.',
      fx: 'Reaction Force', fxUnit: 'N',
      ang: 'Tilt Angle', angUnit: '°',
      temp: 'Temperature', tempUnit: '°C',
      cardCalc: 'Theoretical',
      c0: 'Auto-calc after entering parameters',
      cardFilter: 'Motor Selection',
      safetyMargin: 'Safety Margin',
      motorType: 'Motor Type',
      motorSeries: 'Motor Series',
      matchedModel: 'Matched Models',
      btnSave: 'Save Curve',
      btnClear: 'Clear Data',
      btnSaveOver: 'Over-limit',
      btnSaveSaved: 'Saved',
      btnMore: 'more',
      cardVel: 'Time / Velocity',
      cardForce: 'Force / Time',
      m1t: 'Motor Specs',
      m0: 'Select a motor to view',
      a0: 'Select a motor to calculate',
      a1: 'Application Values',
      rk_cf: 'Cont. Force', rk_cfunit: ' N',
      rk_pf: 'Peak Force', rk_pfunit: ' N',
      rk_ff: 'Friction', rk_ffunit: ' N',
      rk_at: 'Accel/Decel Time', rk_atunit: ' s',
      rk_ad: 'Accel/Decel Dist.', rk_adunit: ' mm',
      rk_ct: 'Const. Time', rk_ctunit: ' s',
      rk_cd: 'Const. Dist.', rk_cdunit: ' mm',
      rk_tc: 'Cycle Period', rk_tcunit: ' s',
      rk_fc: 'Force Const.', rk_fcunit: ' N/Arms',
      rk_be: 'Back-EMF', rk_beunit: ' V/m/s',
      rk_ci: 'Cont. Current', rk_ciunit: ' Arms',
      rk_pi: 'Peak Current', rk_piunit: ' Arms',
      rk_ind: 'Phase Ind.', rk_indunit: ' mH',
      rk_res: 'Phase Res.', rk_resunit: ' Ω',
      rk_cm: 'Coil Mass', rk_cmunit: ' kg',
      rk_aCf: 'Cont. Force', rk_aCfunit: ' N',
      rk_aPk: 'Peak Force', rk_aPkunit: ' N',
      rk_cI: 'Cont. Current', rk_cIunit: ' A',
      rk_pI: 'Peak Current', rk_pIunit: ' A',
      rk_cT: 'Coil Temp.', rk_cTunit: ' °C',
      rk_dc: 'Vdc Bus', rk_dcunit: ' V',
      rk_sf: 'Static Friction', rk_sfunit: ' N',
      rk_cmg: 'Cont. Margin', rk_cmgunit: ' %',
      rk_pmg: 'Peak Margin', rk_pmgunit: ' %',
      // 多曲线按钮（按曲线 key 映射）
      curve_s:  'Position',
      curve_v:  'Velocity',
      curve_a:  'Accel.',
      curve_j:  'Jerk',
      curve_F:  'Force',
      curve_P:  'Power',
      curve_U:  'Voltage',
      curve_I:  'Current',
      curve_T:  'Temp.',
      curve_Fv: 'F/v',
      errCd: '⚠ Accel/Decel distance exceeds motion distance',
      loading3D: 'Loading 3D model...',
      jerkUnit: 'm/s³',
      terminal: 'Terminal',
      pwdError: 'Wrong password',
      shotTitle: 'Screenshot saved: ',
      overSpeed: 'Velocity ',
      overSpeedSuf: 'm/s exceeds limit ',
      overSpeedSuf2: 'm/s',
      overLoad: 'Load ',
      overLoadSuf: 'kg exceeds horizontal limit ',
      overLoadSuf2: 'kg',
      hintPrefix: '💡 ',
      warnPrefix: '⚠ ',
      noMatch: 'No match, please adjust parameters',
      noMatchZh: '无匹配，请调整参数',
      rotaryNudge: 'Please complete calculation and select a motor first',
      p2pNudge: 'Please complete calculation and click "Save Curve" first',
      moreTitle: 'Open multi-curve view (pick any 2 from 10 curves to compare)',
      moreTitleZh: '打开多曲线视图（10 条曲线任意选 2 条对比）',
      jerkLabel: 'Jerk',
      jerkTitle: 'Jerk function not yet available',
      jerkTitleZh: '加加速度功能暂未开放',

      // ===== motor-control.html / control.html 通用 =====
      navHome: 'Home',
      mpTitle: 'Motion Beat',
      mpDist: 'Stroke',
      mpVel:  'Max Velocity',
      mpAcc:  'Max Accel.',
      mpAt:   'Accel. Time',
      mpCt:   'Const. Time',
      mpAd:   'Accel. Dist.',
      mpCd:   'Const. Dist.',
      mpDw:   'Dwell Time',
      mpTc:   'Cycle Period',
      miTitle: 'Motor Info',
      miMn:    'Motor Model',
      miAcf:   'Cont. Force',
      miApk:   'Peak Force',
      miAci:   'Cont. Current',
      miApi:   'Peak Current',
      miDc:    'Vdc Bus',
      miCt:    'Coil Temp.',
      miCmg:   'Cont. Margin',
      miPmg:   'Peak Margin',
      dfTitle:    'Driver Filter',
      dfProtocol: 'Protocol',
      dfVoltage:  'Voltage Type',
      dfEncoder:  'Encoder',
      dfHall:     'Hall Sensor',
      dfGantry:   'Gantry Mode',
      dfComp:     'Position Comp.',
      dfPcom:     'Position Output',
      dfThSeries: 'Series',
      dfThModel:  'Model',
      dfThCi:     'Cont.(A)',
      dfThPi:     'Peak(A)',
      dfThCode:   'Code',
      dfDblclick: 'Double-click to select driver',
      dfSelected: 'Selected: ',
      dfNomatch:  'No matching driver',
      optPulse:    'Pulse',
      optVoltMid:  'Medium Voltage',
      optVoltHigh: 'High Voltage',
      optEncInc:   'Incremental',
      optEncAbs:   'Absolute',
      optYes:      'Required',
      optNo:       'Not Required',
      mPreview:  'Model Preview',
      mAnalysis: 'Model Analysis',
      mCopy:     'Copy Model',
      mCopied:   'Copied',
      mCopyFail: 'Copy Failed',

      // motor-control.html
      mcPageTitle:    'Moen Tech — Motor Control Solution',
      mcLoadingMotor: 'Waiting for motor model...',
      mcModelGen:     'Motor Model Generation',
      mcTemp:         'Temp. Sensor',
      mcTempStd:      'Standard (No)',
      mcTempPTC:      'PTC&NTC',
      mcCable:        'Cable Length',
      mcCablePh:      'Standard 0.5m',
      mcConnector:    'Connector',
      mcConnStd:      'Standard',
      mcConnNA:       'Loose Wire',
      mcVoltage:      'Voltage',
      mcDriver:       'Driver',
      mcDriverNote:   'Confirm driver with tech team',
      mcDriverNotSel: 'Please dblclick a driver',
      mcPleaseSelect: 'Please select a motor on the "Independent Curve" page',
      mcDcOver:       'DC bus over-voltage -',
      mcPleaseUse:    'Please use ',
      mcDriverSuf:    ' driver -',
      mcHighV:        'High-V',
      mcMarginWarn:   'Low margin -',
      mcLoadingPrefix:'Loading ',
      mcNoMotorData:  'No motor data, please select first',
      mcDataParseErr: 'Data parse error',
      mcNoMotorModel: 'No motor model',
      mcCantParse:    'Cannot parse model: ',
      mcMoverFail:    'Mover model load failed: ',
      mcDescMotor:    'Motor: ',
      mcDescTemp:     'Temp Sensor: ',
      mcDescCable:    'Cable: ',
      mcDescCableUnit:'m',
      mcDescCableStd: 'Cable: Standard 0.5m',
      mcDescConn:     'Connector: ',
      mcDescVolt:     'Voltage: ',
      mcDescHallNeed: 'Hall Sensor Required',
      mcDescDriver:   'Driver: ',
      mcDescDrvTBD:   'Pending',
      mcDescDrvNo:    'Not Required',
      mcStroke:       'Stroke',
      mcStrokePh:     'Optional',
      mcStatorPlan:   'Stator Plan',

      // control.html
      ctlPageTitle:     'Moen Tech — Module Control Solution',
      ctlLoading:       'Loading...',
      ctlModelGen:      'Module Model Generation',
      ctlProfile:       'Profile',
      ctlProfileSemi:   'Semi-enclosed',
      ctlProfileFull:   'Fully-enclosed',
      ctlProfileOpen:   'Open',
      ctlStroke:        'Stroke',
      ctlScale:         'Scale Type',
      ctlScaleMag:      'Magnetic',
      ctlScaleOpt:      'Optical',
      ctlRes:           'Resolution',
      ctlMovers:        'Movers',
      ctlCable:         'Cable Length',
      ctlCableTBD:      'TBD',
      ctlSensor:        'Sensor',
      ctlOverLimit:     'Profile length limit, contact tech team',
      ctlGantry:        'Gantry',
      ctlGantryPrefix:  'Gantry: ',
      ctlModTotalLen:   'Module Total Length: ',
      ctlOverLimitText: 'Over-limit',
      ctlGantryNoDrv:   'Gantry, no driver confirmed',
      ctlNoDrv:         'No driver confirmed',
      ctlDrvPrefix:     'Driver: ',
      ctlCableTBDLine:  'Cable TBD',
      ctlCablePrefix:   'Cable ',
      ctlCableUnit:     'm',
      ctlNpn:           'NPN Sensor',
      ctlPnp:           'PNP Sensor',
      ctlHallNeed:      'Hall Required',
      ctlMmWide:        'mm wide',
      ctlMmUnit:        'mm',
      ctlResUnit:       'μm',
      ctlMotorTBD:      'Motor TBD',
      ctlMoverX:        ', Mover×',
      ctlPleaseFill:    'Please fill in model parameters',
      ctlOverLimitInfo: ' (exceeds ',
      ctlOverLimitInfo2:'mm)'
    }
  };

  // --- 类型名映射（与 initTypeDropdown 中保持一致） ---
  // 内置已知类型；新增类型如果不在字典里，会走 _autoTranslateType() 自动规则降级
  var TYPE_NAMES = {
    zh: { iron:'有铁芯直线电机', ironless:'无铁芯直线电机', rod:'轴棒电机', voice:'音圈电机',
          '常规直线电机模组':'常规直线电机模组', '内嵌直线电机模组':'内嵌直线电机模组' },
    en: { iron:'Iron-core Linear Motor', ironless:'Ironless Linear Motor', rod:'Rod Motor', voice:'Voice Coil Motor',
          '常规直线电机模组':'Standard Motor Module', '内嵌直线电机模组':'Embedded Motor Module' }
  };

  // --- 关键词替换规则（按顺序匹配；长词优先，避免短词把长词吃掉）---
  var TYPE_KEYWORD_MAP = [
    // 整词
    {zh:'常规直线电机模组', en:'Standard Motor Module'},
    {zh:'内嵌直线电机模组', en:'Embedded Motor Module'},
    {zh:'直线电机模组',     en:'Motor Module'},
    {zh:'有铁芯直线电机',   en:'Iron-core Linear Motor'},
    {zh:'无铁芯直线电机',   en:'Ironless Linear Motor'},
    {zh:'直线电机',         en:'Linear Motor'},
    {zh:'轴棒电机',         en:'Rod Motor'},
    {zh:'音圈电机',         en:'Voice Coil Motor'},
    // 修饰词（在没匹配到完整词时，逐个替换）
    {zh:'常规',  en:'Standard '},
    {zh:'内嵌',  en:'Embedded '},
    {zh:'有铁芯',en:'Iron-core '},
    {zh:'无铁芯',en:'Ironless '},
    {zh:'超薄',  en:'Slim '},
    {zh:'高速',  en:'High-speed '},
    {zh:'高精',  en:'High-precision '},
    {zh:'重载',  en:'Heavy-duty '},
    {zh:'紧凑',  en:'Compact '},
    {zh:'防水',  en:'Waterproof '},
    {zh:'直线',  en:'Linear '},
    {zh:'电机模组', en:'Motor Module'},
    {zh:'电机',  en:'Motor'}
  ];

  function _autoTranslateType(zhName, lang) {
    if (!zhName) return zhName;
    if (lang !== 'en') return zhName;
    // 不含中文，直接返回
    if (!/[\u4e00-\u9fa5]/.test(zhName)) return zhName;
    var out = zhName;
    for (var i = 0; i < TYPE_KEYWORD_MAP.length; i++) {
      var rule = TYPE_KEYWORD_MAP[i];
      out = out.split(rule.zh).join(rule.en);
    }
    // 清理多余空格
    out = out.replace(/\s+/g, ' ').trim();
    return out;
  }
  window._autoTranslateType = _autoTranslateType;

  // --- 电机系列名翻译：规则是 "宽度-MXX系列" / "MXX系列" ---
  // 数字+字母代号（MTH/MTA/MUI/...）保持原样，只翻译中文部分
  function _autoTranslateSeries(zhName, lang) {
    if (!zhName || lang !== 'en') return zhName;
    if (!/[\u4e00-\u9fa5]/.test(zhName)) return zhName;
    // "XX宽-MXX系列" → "XXmm MXX Series"
    return zhName
      .replace(/(\d+)\s*宽/g, '$1mm ')
      .replace(/系列/g, '')
      .replace(/模组/g, 'Module')
      .replace(/\s+/g, ' ')
      .trim();
  }
  window._autoTranslateSeries = _autoTranslateSeries;

  // ---- 1. 静态文本（data-i18n 标记）----
  function applyI18n(lang) {
    _moen_lang = lang;
    var dict = I18N[lang];
    document.documentElement.lang = (lang === 'en' ? 'en' : 'zh-CN');
    // 优先使用 body[data-i18n-title] 指定的页面标题键，否则回退 pageTitle
    var titleKey = (document.body && document.body.getAttribute('data-i18n-title')) || 'pageTitle';
    if (dict[titleKey] !== undefined) document.title = dict[titleKey];
    else document.title = dict.pageTitle;

    document.querySelectorAll('[data-i18n]').forEach(function(el){
      var key = el.getAttribute('data-i18n');
      if (dict[key] !== undefined) el.innerHTML = dict[key];
    });
    document.querySelectorAll('[data-i18n-attr]').forEach(function(el){
      var spec = el.getAttribute('data-i18n-attr'); // "attr|key"
      var parts = spec.split('|');
      var attr = parts[0], key = parts[1];
      if (dict[key] !== undefined) el.setAttribute(attr, dict[key]);
    });

    // 中英切换按钮高亮：英文时显示与 "线性电机/Linear" toggle-option 一致的 selected 样式（灰背景+蓝色图标）
    // 通过 title 查找：覆盖 index 页面（title="中英切换"）和子页面经 layout.js 翻译后的 title
    document.querySelectorAll('.icon-btn[title="中英切换"], .icon-btn[title="Switch Language"]').forEach(function(btn) {
      var svg = btn.querySelector('svg');
      if (lang === 'en') {
        btn.style.backgroundColor = '#e5e7eb';
        if (svg) svg.style.color = '#3b82f6';
      } else {
        btn.style.backgroundColor = '';
        if (svg) svg.style.color = '';
      }
    });

    // 顶栏 tooltips
    var toolbar = document.querySelector('.icon-toolbar');
    if (toolbar) {
      var btns = toolbar.querySelectorAll('.icon-btn');
      btns.forEach(function(b){
        // 已有 data-i18n-attr 的按钮上面已经处理过，这里只兜底没有标记的按钮
        if (b.getAttribute('data-i18n-attr')) return;
        var t = b.getAttribute('title') || '';
        if (t === '线性电机' || t === 'Linear') b.setAttribute('title', dict.linear);
        else if (t === '旋转电机' || t === 'Rotary') b.setAttribute('title', dict.rotaryTitle);
        else if (t === '云上传' || t === 'Cloud Upload') b.setAttribute('title', dict.cloud);
        else if (t === '截图' || t === 'Screenshot') b.setAttribute('title', dict.screenshot);
        else if (t === 'PDF输出' || t === 'PDF Output') b.setAttribute('title', dict.pdf);
        else if (t === '中英切换' || t === 'Switch Language') b.setAttribute('title', dict.langTitle);
        else if (t === '后台数据' || t === 'Database' || t === '电机数据库') b.setAttribute('title', dict.db);
        else if (t === '返回首页' || t === 'Home') b.setAttribute('title', dict.navHome);
      });
    }

    // 限制提示（动态内容，不在 data-i18n 里）
    if (window.refreshLimitTipLang) window.refreshLimitTipLang(lang);
    // 多曲线按钮 label（动态生成）
    if (window.refreshCurveBtnsLang) window.refreshCurveBtnsLang(lang);
    // 电机类型 option 文字
    if (window.refreshTypeOptionsLang) window.refreshTypeOptionsLang(lang);
    // r1-r8 标签
    if (window.refreshR1R8Lang) window.refreshR1R8Lang(lang);
    // 电机参数 r-v 标签
    if (window.refreshM1A1Lang) window.refreshM1A1Lang(lang);
    // more 按钮 title
    var btnMore = document.getElementById('btnMoreCurves');
    if (btnMore) btnMore.setAttribute('title', dict.moreTitle);
    // 占位/标题
    var ss = document.getElementById('sidebarSearch');
    if (ss) ss.setAttribute('placeholder', dict.searchPh);

    // 重新渲染动态生成的电机参数 / 实际应用计算值
    if (window.S && window.S.sel) {
      try { showM(window.S.sel); } catch(e){}
      try { calcA(window.S.sel); } catch(e){}
    } else {
      try { clearMotorDisplay(); } catch(e){}
    }
    // 内嵌模组限制提示也要重新渲染
    if (typeof checkMotorLimits === 'function') {
      try { checkMotorLimits(); } catch(e){}
    }
    // 多曲线按钮文本（动态生成）+ 图表图例翻译
    if (typeof refreshCurveButtons === 'function') {
      try { refreshCurveButtons(); } catch(e){}
    }
    if (typeof redrawMultiChart === 'function' && window.S && window.S.overlayOpen) {
      try { redrawMultiChart(); } catch(e){}
    }
    // 「more」按钮文本本身用 data-i18n 已覆盖；title 也已用 data-i18n-attr 覆盖

    // 翻译电机类型下拉选项（三层优先级：1.字典 value 命中  2.字典文本命中  3.关键词自动降级）
    var stSel = document.getElementById('st');
    if (stSel) {
      var names = TYPE_NAMES[lang] || TYPE_NAMES.zh;
      for (var oi = 0; oi < stSel.options.length; oi++) {
        var opt = stSel.options[oi];
        var val = opt.value;
        // option 的 value 在 DB 里固定为中文 key，不会被翻译。所以优先用 value 查
        if (names[val]) {
          opt.textContent = names[val];
        } else {
          // 没在字典里：用关键词规则自动翻译（仅 en 模式生效；zh 模式直接返回 val）
          opt.textContent = _autoTranslateType(val, lang);
        }
      }
    }

    // 翻译电机系列下拉选项（用 _autoTranslateSeries 规则降级）
    var ssSel = document.getElementById('ss');
    if (ssSel) {
      for (var sj = 0; sj < ssSel.options.length; sj++) {
        var sopt = ssSel.options[sj];
        sopt.textContent = _autoTranslateSeries(sopt.value, lang);
      }
    }
  }

  // ---- 2. 公开切换函数 ----
  var curLang = 'zh';
  function _dispatchLangChange(lang) {
    try {
      var ev;
      if (typeof CustomEvent === 'function') {
        ev = new CustomEvent('moenLangChange', { detail: { lang: lang } });
      } else {
        ev = document.createEvent('CustomEvent');
        ev.initCustomEvent('moenLangChange', false, false, { lang: lang });
      }
      window.dispatchEvent(ev);
    } catch(e){}
  }
  window.toggleLang = function(){
    curLang = (curLang === 'zh' ? 'en' : 'zh');
    _moen_lang = curLang;
    try { localStorage.setItem(KEY, curLang); } catch(e){}
    applyI18n(curLang);
    _dispatchLangChange(curLang);
  };
  window.getCurLang = function(){ return curLang; };
  // 页面可以监听 moenLangChange 事件，在语言切换后重新渲染动态内容
  window.moenOnLangChange = function(handler) {
    window.addEventListener('moenLangChange', function(e){ handler(e.detail && e.detail.lang); });
  };

  // ---- 3. 提供给外部用（覆盖原 initTypeDropdown） ----
  window.I18N_TYPE_NAMES = TYPE_NAMES;
  window.I18N_DICT = I18N;

  // ---- 4. 初始化时读取偏好 ----
  document.addEventListener('DOMContentLoaded', function(){
    try {
      var saved = localStorage.getItem(KEY);
      if (saved === 'en' || saved === 'zh') curLang = saved;
    } catch(e){}
    _moen_lang = curLang;
    if (curLang !== 'zh') {
      // 等一帧再应用，确保 DOM 已构建完成
      setTimeout(function(){
        applyI18n(curLang);
        _dispatchLangChange(curLang);
      }, 0);
    } else {
      // 中文模式：仍然通知页面渲染中文动态内容
      setTimeout(function(){ _dispatchLangChange(curLang); }, 0);
    }
  });
})();
