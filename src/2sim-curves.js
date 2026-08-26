
// === sim-curves.js ===
// S 曲线运动学 + 9+1 条曲线采样 + overlay 多曲线绘图控制
// 依赖：全局 S (app.js state)、echarts、motor-data.js (DB)

// === 曲线元数据 ===
var CURVE_META = {
  s:  {i18n:'curve_s',  unit:'m',     color:'#06B6D4', yNameZh:'位移', yNameEn:'Position'},
  v:  {i18n:'curve_v',  unit:'m/s',   color:'#4F46E5', yNameZh:'速度', yNameEn:'Velocity'},
  a:  {i18n:'curve_a',  unit:'m/s²',  color:'#10B981', yNameZh:'加速度', yNameEn:'Accel.'},
  j:  {i18n:'curve_j',  unit:'m/s³',  color:'#F59E0B', yNameZh:'加加速度', yNameEn:'Jerk'},
  F:  {i18n:'curve_F',  unit:'N',     color:'#7C3AED', yNameZh:'力', yNameEn:'Force'},
  P:  {i18n:'curve_P',  unit:'W',     color:'#EC4899', yNameZh:'功率', yNameEn:'Power'},
  U:  {i18n:'curve_U',  unit:'V',     color:'#3B82F6', yNameZh:'电压', yNameEn:'Voltage'},
  I:  {i18n:'curve_I',  unit:'Arms',  color:'#EF4444', yNameZh:'电流', yNameEn:'Current'},
  T:  {i18n:'curve_T',  unit:'°C',    color:'#F97316', yNameZh:'温度', yNameEn:'Temp.'},
  Fv: {i18n:'curve_Fv', unit:'N',     color:'#8B5CF6', yNameZh:'力', yNameEn:'Force', special:true}
};
function _curveLabel(k){ var m=CURVE_META[k]; if(!m) return k; var v=(_moen_lang==='en'?(window.I18N_DICT&&window.I18N_DICT.en&&window.I18N_DICT.en[m.i18n]):null); return v || (window._t?window._t(m.i18n):m.i18n); }
function _curveYName(k){ var m=CURVE_META[k]; if(!m) return k; return (_moen_lang==='en') ? m.yNameEn : m.yNameZh; }
function _curveLabelWithFallback(k){ return _curveLabel(k); }
var CURVE_KEYS = ['s','v','a','j','F','P','U','I','T','Fv'];
var NEED_MOTOR_KEYS = ['F','P','U','I','T','Fv'];

// === 梯形运动学（j→∞ 退化版：纯梯形加减速，无 jerk 段）===
// 输入：S_dist=行程(m), Vmax=最大速度(m/s), aMax=最大加速度(m/s²)
// 输出格式与 kinematicsS 一致（t_j=0，可直接送入 sampleOneway）
function kinematicsTrap(S_dist, Vmax, aMax) {
  var at = Vmax / aMax;
  var S_acc = 0.5 * aMax * at * at;
  var S_dec = S_acc;
  if (S_acc + S_dec > S_dist) {
    // 三角形情况：达不到 Vmax，重新算
    Vmax = Math.sqrt(S_dist * aMax);
    at = Vmax / aMax;
    S_acc = 0.5 * aMax * at * at;
    S_dec = S_acc;
  }
  var t_const = (S_dist - S_acc - S_dec) / Vmax;
  if (t_const < 0) t_const = 0;
  return {
    t_j: 0, t_a: at, t_const: t_const,
    t_acc: at, t_dec: at,
    t_total: at * 2 + t_const,
    Vpeak: Vmax, S_acc: S_acc, S_dec: S_dec,
    a_actual: aMax, jerk: Infinity
  };
}

// === S 曲线七段运动学（单程：加速 + 匀速 + 减速）===
// 输入：S_dist=行程(m), Vmax=最大速度(m/s), aMax=最大加速度(m/s²), jerk=加加速度(m/s³)
// 输出：各段时间 + Vpeak
function kinematicsS(S_dist, Vmax, aMax, jerk) {
  // 限制递归深度
  var MAX_ITER = 20;
  function _solve(S_dist, Vmax, aMax, jerk, iter) {
    if (iter > MAX_ITER) return null;
    // 加加速度作用时间（加速度从 0 → aMax 需要的时间）
    var t_j = aMax / jerk;
    // 在加加速度作用时间内达到的速度增量
    var v_j = 0.5 * jerk * t_j * t_j;  // = 0.5 * aMax * t_j
    // 匀加速度阶段的时间（如果 Vmax 太小，可能不需要匀加速段）
    var v_needed = Vmax - 2 * v_j;  // 匀加速段贡献的速度
    var t_a;
    if (v_needed <= 0) {
      // Vmax 太小，加加速度阶段就已经超过了 → 减小 aMax 使得 t_j 正好让 v 达到 Vmax
      // 此时没有匀加速段，且 t_j 缩短
      t_j = Math.sqrt(Vmax / jerk);
      t_a = 0;
    } else {
      t_a = v_needed / aMax;
    }
    // 加速段总时间和距离
    var t_acc = t_j + t_a + t_j;
    // 加速段距离（解析积分）
    // 第1段(0→t_j): s1 = (1/6)*j*t_j³
    var s1 = (1.0/6.0) * jerk * t_j * t_j * t_j;
    // 第1段末速度
    var v1 = 0.5 * jerk * t_j * t_j;
    // 第1段末加速度
    var a1 = jerk * t_j;  // = aMax (或缩短后的值)
    var a_actual = jerk * t_j;
    // 第2段(匀加速, t_a): s2 = v1*t_a + 0.5*a_actual*t_a²
    var s2 = v1 * t_a + 0.5 * a_actual * t_a * t_a;
    // 第2段末速度
    var v2 = v1 + a_actual * t_a;
    // 第3段(减加速度, t_j): s3 = v2*t_j + 0.5*a_actual*t_j² - (1/6)*jerk*t_j³
    var s3 = v2 * t_j + 0.5 * a_actual * t_j * t_j - (1.0/6.0) * jerk * t_j * t_j * t_j;

    var S_acc = s1 + s2 + s3;
    // 减速对称
    var S_dec = S_acc;
    var t_dec = t_acc;

    // 检查是否需要三角形处理
    if (S_acc + S_dec > S_dist) {
      // 迭代减小 Vmax
      var newVmax = Vmax * Math.sqrt(S_dist / (S_acc + S_dec));
      if (newVmax < 0.001) return null;
      return _solve(S_dist, newVmax, aMax, jerk, iter + 1);
    }

    // 匀速段
    var Vpeak = v2 + 0.5 * jerk * t_j * t_j;  // 应该 ≈ Vmax
    if (Vpeak < 0.001) Vpeak = Vmax;
    var t_const = (S_dist - S_acc - S_dec) / Vpeak;
    if (t_const < 0) t_const = 0;

    return {
      t_j: t_j, t_a: t_a, t_const: t_const,
      t_acc: t_acc, t_dec: t_dec,
      t_total: t_acc + t_const + t_dec,
      Vpeak: Vpeak, S_acc: S_acc, S_dec: S_dec,
      a_actual: a_actual, jerk: jerk
    };
  }
  return _solve(S_dist, Vmax, aMax, jerk, 0);
}

// === 单程采样（去程：加速+匀速+减速，无 dwell）===
// motor: 电机参数对象 {fc, be, res, cm, at, sm, ...}
function sampleOneway(kin, motor, m_load, mu, ang, F_ext, T_amb) {
  if (!kin) return null;
  var g = 9.81;
  var rad = ang * Math.PI / 180;
  var sm = motor.sm || 0;
  var m_total = m_load + motor.cm + sm;
  var atForce = motor.at || 0;
  // 摩擦力大小（常量）
  var F_fric_mag = m_total * g * mu * Math.cos(rad) + atForce * mu;
  // 重力分量
  var Fg = m_total * g * Math.sin(rad);

  var KT = motor.fc || 1;
  var KE = motor.be || 0;
  var R = motor.res || 0;
  var Rth = motor.tr || 1;
  var tau_thermal = 60;  // 热时间常数(s)

  // 时间节点（七段：加速3段 + 匀速1段 + 减速3段）
  var tj = kin.t_j, ta = kin.t_a;
  var T1 = tj;                    // 第1段结束（加加速度→加速度上升）
  var T2 = T1 + ta;               // 第2段结束（匀加速度）
  var T3 = T2 + tj;               // 第3段结束（减加速度，加速度→0）= 加速段结束
  var T4 = T3 + kin.t_const;      // 匀速段结束
  var T5 = T4 + tj;               // 减速第1段（加加速度，加速度 0→-a）
  var T6 = T5 + ta;               // 减速第2段（匀减速）
  var T7 = T6 + tj;               // 减速第3段结束 = 运动结束
  var T_end = T7;

  // === 自适应采样步长 ===
  // 问题：dt 固定为 1ms 时，若 t_j < dt（jerk 段比采样步长还短），
  //   jerk 平台会被完全跳过 → 曲线塌陷成 0。
  //   例如 aMax=5, jerk=10000 → t_j = 0.0005s < 1ms，jerk 曲线完全消失。
  // 解决：dt = min(1ms, t_j/4)，保证每个 jerk 段内至少有 4 个采样点。
  //   下限：T_end/10000 防止采样点数爆炸。
  var dt = 0.001;
  if (tj > 0 && isFinite(kin.jerk)) {
    dt = Math.min(0.001, tj / 4);
    var minDt = T_end / 10000;
    if (dt < minDt) dt = minDt;
  }

  var a_max = kin.a_actual;
  var jerk = kin.jerk;

  // 分段加速度函数
  // 兼容梯形模式（jerk === Infinity, t_j = 0）：
  //   - 梯形模式下所有 jerk 段时间为 0，a 在边界处阶跃（0 → a_max → 0 → -a_max → 0）
  //   - 若不特判，`jerk * t` 在 t=0 会得到 NaN（Infinity × 0），污染起点 F/I/U/P
  //   - 为了让起点 F 从 0 附近开始（仅静态力 Fg+F_ext），t=0 返回 a=0
  var isTrap = !isFinite(jerk);
  function getAJ(t) {
    if (isTrap) {
      // 梯形：边界处阶跃，t=0 时 a=0（静态起点）
      if (t === 0) return [0, 0];        // 起点：a=0
      if (t < T2) return [a_max, 0];     // 加速段（0+ → T2 = ta）
      if (t < T4) return [0, 0];         // 匀速段
      if (t < T6) return [-a_max, 0];    // 减速段
      return [0, 0];
    }
    if (t <= T1) {
      // 加速段1：加速度从0线性增加到 a_max
      // 特判 t=0：jerk 从 0 开始（更符合"静止启动"直觉），避免起点出现 jerk 尖峰
      if (t === 0) return [0, 0];
      return [jerk * t, jerk];
    }
    if (t <= T2) {
      // 加速段2：匀加速度 = a_max
      return [a_max, 0];
    }
    if (t <= T3) {
      // 加速段3：加速度从 a_max 线性减到 0
      var dt3 = t - T2;
      return [a_max - jerk * dt3, -jerk];
    }
    if (t <= T4) {
      // 匀速段：加速度 = 0
      return [0, 0];
    }
    if (t <= T5) {
      // 减速段1：加速度从 0 线性减到 -a_max
      var dt5 = t - T4;
      return [-jerk * dt5, -jerk];
    }
    if (t <= T6) {
      // 减速段2：匀减速 = -a_max
      return [-a_max, 0];
    }
    if (t <= T7) {
      // 减速段3：加速度从 -a_max 线性增到 0
      var dt7 = t - T6;
      return [-a_max + jerk * dt7, jerk];
    }
    return [0, 0];
  }

  // 采样数组
  var arr_t = [], arr_s = [], arr_v = [], arr_a = [], arr_j = [];
  var arr_F = [], arr_P = [], arr_U = [], arr_I = [];
  var arr_E = [], arr_IR = [];  // 电压分量：反电动势 E = Ke·v，电阻压降 IR = |I|·R

  var v_cur = 0, s_cur = 0;
  var nSteps = Math.ceil(T_end / dt) + 1;

  for (var n = 0; n < nSteps; n++) {
    var t = n * dt;
    if (t > T_end + 0.0001) break;

    var aj = getAJ(t);
    var a_cur = aj[0], j_cur = aj[1];

    // 积分速度和位移
    if (n > 0) {
      v_cur += a_cur * dt;
      // 防止速度穿越 0 变负（单程运动，v 到 0 后停止）
      // 注意：只归零 v_cur 和 a_cur，保留 j_cur。
      //   否则 jerk 平台会被错误地中断（v→0 那一采样点的 j 被设为 0，
      //   后续继承 lastJ 时会停在 0，而不是平台值 10000），
      //   这也是 jerk=10000 曲线末端停在 0 而非平台值的原因。
      if (v_cur < 0) { v_cur = 0; a_cur = 0; }
      s_cur += v_cur * dt;
      // v 已到 0 且已过加速段（n > 10 排除起点）→ 追加最后一个 "停止" 数据点后中断循环
      if (v_cur === 0 && n > 10) {
        // 停止点：位移/速度/加速度归零，但 jerk 继承**当前时刻的 j_cur**（而非已 push 的前一个值）。
        // 原因：v→0 那一刻 j_cur 是 getAJ(t) 返回的段 7 的 +jerk 值（已保留，未归零），
        //   这才是"正在进行中的 jerk 平台值"，应该让停止点延续它。
        //   如果取 arr_j[length-1]，当 t===0 特判返回 j=0 时，lastJ=0 会错误传播到末端。
        arr_t.push(t); arr_s.push(s_cur); arr_v.push(0); arr_a.push(0); arr_j.push(j_cur);
        arr_F.push(Fg + F_ext); arr_P.push(0); arr_U.push(0); arr_I.push(0);
        arr_E.push(0); arr_IR.push(0);
        break;
      }
    }

    // 力 = 惯性力 + 摩擦力 + 重力 + 外力
    // 摩擦力方向与速度方向相反（线性平滑过渡，消除零速跳变）
    // 关键：v 接近 0 时 a_cur 和 F_fric 都按 ramp=1 处理 → v=0 仍保留静摩擦推力，
    // 与 tecnotion 图“起步 14V / 结尾 12V”（即静摩擦驱动的电流 · R）一致。
    var v_eps = 0.05;
    var ramp = v_cur > v_eps ? 1 : Math.max(0, v_cur / v_eps);
    // a：加速段用真实 a，减速段按 ramp 衰减 → 减小 v→0 时的冲击
    var a_eff = a_cur >= 0 ? a_cur : a_cur * ramp;
    // F_fric：v 接近 0 时按 ramp 衰减（避免减速过零点跳变）
    var F_fric = F_fric_mag * ramp;
    var F_cur = m_total * a_eff + F_fric + Fg + F_ext;

    // 电流 = F / KT（KT = cf/ci，故 I = F · ci / cf）
    // 这里使用 F 总量直接除以 KT，不再叠加额外的 v_ramp——
    // 这样 v=0 时仍能保留 Fg / F_fric / F_ext 产生的稳态电流，
    // 代入后的端电压 |KE·v + I·R| 也就不为 0，与 tecnotion 准静态值一致。
    var I_cur = F_cur * motor.ci / motor.cf;
    // 端电压 = |Ke·v + I·R|（先按物理定义求代数和，再取绝对值 → 驱动器输出电压幅值）
    // - 加速段 I>0：Ke·v 与 I·R 同号相加 → 电压 > 反电动势
    // - 匀速段 I≈0：电压 ≈ Ke·v
    // - 减速段 I<0 (回馈)：Ke·v 与 I·R 反号相加 → 电压 < 反电动势，
    //   |Ke·v| 与 |I·R| 相等时电压可短暂穿过 0（tecnotion 电压曲线末端的 V 型底部）
    // 驱动器需要输出的直流母线电压 = 端电压 / 0.85（0.85 为安全余量系数）
    var U_cur = Math.abs(KE * v_cur + I_cur * R) / 0.85;
    // 功率 = 机械功率 = 速度 × 推力（严格 P = F·v；起点 v=0 → P=0，从原点出发）
    var P_cur = F_cur * v_cur;

    // 电压分量（用于拆解可视化）
    var E_cur = KE * v_cur;
    var IR_cur = Math.abs(I_cur) * R;

    arr_t.push(t);
    arr_s.push(s_cur);
    arr_v.push(v_cur);
    arr_a.push(a_cur);
    arr_j.push(j_cur);
    arr_F.push(F_cur);
    arr_P.push(P_cur);
    arr_U.push(U_cur);
    arr_I.push(I_cur);
    arr_E.push(E_cur);
    arr_IR.push(IR_cur);
  }

  // === 温度曲线：横穿时间轴的水平线，数值严格等于「实际应用计算值 → 线圈温度」===
  // 优先读 S.lastCT（calcA() 算完后会写入），保证曲线值与卡片显示完全一致；
  // 兜底：用 calcA 同款公式重算
  var arr_T = [];
  var cT_steady = T_amb;
  if (typeof S !== 'undefined' && typeof S.lastCT === 'number' && !isNaN(S.lastCT)) {
    cT_steady = S.lastCT;
  } else if (kin.t_total > 0) {
    var aFa_th = m_total * (kin.a_actual || 0) + F_fric_mag + Fg + F_ext;
    var aFc_th = F_fric_mag + Fg + F_ext;
    var aFd_th = -m_total * (kin.a_actual || 0) + F_fric_mag + Fg + F_ext;
    var aR2_th = (aFa_th*aFa_th*kin.t_acc + aFc_th*aFc_th*kin.t_const + aFd_th*aFd_th*kin.t_acc) / kin.t_total;
    var F_rms_th = Math.sqrt(aR2_th);
    var cf_motor = motor.cf || 1;
    cT_steady = T_amb + Math.pow(F_rms_th / cf_motor, 2) * (100 - T_amb);
  }
  for (var ti = 0; ti < arr_t.length; ti++) arr_T.push(cT_steady);

  return {t: arr_t, s: arr_s, v: arr_v, a: arr_a, j: arr_j, F: arr_F, P: arr_P, U: arr_U, I: arr_I, T: arr_T, E: arr_E, IR: arr_IR};
}

// === 纯几何采样（无电机依赖，用于"参数错误"时按错误节拍绘制 s/v/a/j 曲线）===
// 输入 kin 来自 kinematicsTrap / kinematicsS 或手动构造的 kin 对象。
// 与 sampleOneway 的区别：不算 F/P/U/I/T，力相关数组填 0，不需要 motor 参数。
// 目的：cd<0 时，用用户输入的 mV/mA 构造三角形节拍（S_acc+S_dec 会大于 dist），
//        采样得到的 s 曲线会冲过 dist 参考线 → 用户直观看到"错误的节拍"。
function sampleKinematicsOnly(kin) {
  if (!kin) return null;
  var tj = kin.t_j || 0, ta = kin.t_a || 0;
  var T1 = tj;
  var T2 = T1 + ta;
  var T3 = T2 + tj;
  var T4 = T3 + (kin.t_const || 0);
  var T5 = T4 + tj;
  var T6 = T5 + ta;
  var T7 = T6 + tj;
  var T_end = T7;

  // 与 sampleOneway 保持一致：jerk 段短于 1ms 时改用更细采样，避免 jerk 平台被漏采。
  var dt = 0.001;
  if (tj > 0 && isFinite(kin.jerk)) {
    dt = Math.min(0.001, tj / 4);
    var minDt = T_end / 10000;
    if (dt < minDt) dt = minDt;
  }
  var a_max = kin.a_actual;
  var jerk = kin.jerk;
  function getAJ(t) {
    if (t <= T1) return [jerk === Infinity ? 0 : jerk * t, jerk === Infinity ? 0 : jerk];
    if (t <= T2) return [a_max, 0];
    if (t <= T3) { var d3 = t - T2; return [a_max - (jerk === Infinity ? 0 : jerk * d3), jerk === Infinity ? 0 : -jerk]; }
    if (t <= T4) return [0, 0];
    if (t <= T5) { var d5 = t - T4; return [-(jerk === Infinity ? 0 : jerk * d5), jerk === Infinity ? 0 : -jerk]; }
    if (t <= T6) return [-a_max, 0];
    if (t <= T7) { var d7 = t - T6; return [-a_max + (jerk === Infinity ? 0 : jerk * d7), jerk === Infinity ? 0 : jerk]; }
    return [0, 0];
  }
  // 特化：三角形（tj=0，纯梯形其实也走这里）时，加速段 a=a_max，减速段 a=-a_max
  var arr_t = [], arr_s = [], arr_v = [], arr_a = [], arr_j = [];
  var arr_F = [], arr_P = [], arr_U = [], arr_I = [], arr_T = [];
  var v_cur = 0, s_cur = 0;
  var nSteps = Math.ceil(T_end / dt) + 1;
  for (var n = 0; n < nSteps; n++) {
    var t = n * dt;
    if (t > T_end + 0.0001) break;
    var aj = getAJ(t);
    var a_cur = aj[0], j_cur = aj[1];
    if (n > 0) {
      v_cur += a_cur * dt;
      if (v_cur < 0) { v_cur = 0; a_cur = 0; j_cur = 0; }
      s_cur += v_cur * dt;
    }
    arr_t.push(t);
    arr_s.push(s_cur);
    arr_v.push(v_cur);
    arr_a.push(a_cur);
    arr_j.push(j_cur);
    arr_F.push(0); arr_P.push(0); arr_U.push(0); arr_I.push(0); arr_T.push(0);
  }
  return {t: arr_t, s: arr_s, v: arr_v, a: arr_a, j: arr_j, F: arr_F, P: arr_P, U: arr_U, I: arr_I, T: arr_T, E: [], IR: []};
}

// === 从采样数据计算 RMS/峰值（用于更新"实际应用计算值"）===
function calcActualFromCurves(curves, motor, Te) {
  if (!curves || !motor) return null;
  var T_total = curves.t[curves.t.length - 1];
  if (T_total <= 0) return null;

  // F_rms（梯形积分）
  // 注意：sampleOneway 会根据 t_j 使用自适应 dt，这里必须使用相邻时间点差值，不能固定 1ms。
  var sumF2 = 0;
  for (var i = 0; i < curves.F.length - 1; i++) {
    var dtSeg = curves.t[i+1] - curves.t[i];
    sumF2 += (curves.F[i] * curves.F[i] + curves.F[i+1] * curves.F[i+1]) / 2 * dtSeg;
  }
  var F_rms = Math.sqrt(sumF2 / T_total);
  var F_peak = 0;
  for (var i = 0; i < curves.F.length; i++) {
    var absF = Math.abs(curves.F[i]);
    if (absF > F_peak) F_peak = absF;
  }

  // 电流
  var I_rms = F_rms / motor.fc;
  var I_peak = F_peak / motor.fc;
  // 温度：直接取 T 数组末值（热模型收敛值）
  var T_max = curves.T[curves.T.length - 1];
  // 端电压峰值（取正向最大值 = 驱动器需要输出的最高电压）
   var U_max = 0;
   for (var i = 0; i < curves.U.length; i++) {
     if (curves.U[i] > U_max) U_max = curves.U[i];
   }
  // 余量
  var cmg = (motor.cf - F_rms) / F_rms * 100;
  var pmg = (motor.pf - F_peak) / F_peak * 100;

  // 线圈温度（简化：基于 RMS 力比例）
  var cT = Te + Math.pow(F_rms / motor.cf, 2) * (100 - Te);

  return {
    aCf: F_rms, aPk: F_peak,
    cI: I_rms, pI: I_peak,
    cT: cT, dc: U_max,
    cmg: cmg, pmg: pmg
  };
}

// === Overlay 控制逻辑 ===
var multiChart = null;

function _positionOverlay() {
  var ov = document.getElementById('overlayCurves');
  var main = document.getElementById('mc');
  var cardWork = document.getElementById('cardWork');
  var cardActual = document.getElementById('cardActual');
  // 实际应用卡展开后变为 fixed，卡片自身的矩形会移到覆盖区域，
  // 因而必须使用原位置占位元素，确保“更多曲线”始终在下方原始行之前结束。
  var actualSlot = document.querySelector('.actual-card-slot');
  if (!ov || !main || !cardWork || !cardActual) return;
  // position:absolute 元素的 left/right/top/bottom 相对父元素的 padding-edge（= border 内侧）。
  var cs = window.getComputedStyle(main);
  var pL = parseFloat(cs.paddingLeft) || 0;
  var pB = parseFloat(cs.paddingBottom) || 0;
  var mR = main.getBoundingClientRect();
  var wR = cardWork.getBoundingClientRect();
  var aR = (actualSlot || cardActual).getBoundingClientRect();

  // overlay 左缘 = 工况参数卡片右缘 + 8px 呼吸空间
  // 包含块（main）padding-edge 左边 = mR.left（main 无 border），absolute 元素的 left 相对它
  var leftPx = wR.right + 8 - mR.left;
  ov.style.left = leftPx + 'px';
  ov.style.right = '30px';
  // top
  ov.style.top = '0px';
  // 底缘 = cardActual 顶缘上方 8px，再额外向上收 25px（高度下方减少 20+5px）
  var bottomPx = mR.bottom - pB - aR.top + 8 + 25;
  if (bottomPx < 0) bottomPx = 0;
  ov.style.bottom = bottomPx + 'px';
}

function toggleMoreCurves() {
  S.overlayOpen = !S.overlayOpen;
  var ov = document.getElementById('overlayCurves');
  var old = document.getElementById('oldCharts');
  var card3D = document.getElementById('card3D');
  var btnMC = document.getElementById('btnMoreCurves');
  if (!ov || !old) return;

  if (S.overlayOpen) {
    // 先把 3D 模型卡片彻底隐藏（display:none 直接退出渲染，比 visibility:hidden 即时）
    if (card3D) card3D.style.display = 'none';
    old.style.display = 'none';
    _positionOverlay();
    ov.style.display = 'flex';
    if (btnMC) btnMC.classList.add('active');
    if (!multiChart) {
      multiChart = echarts.init(document.getElementById('multiChart'));
      new ResizeObserver(function(){ if(multiChart) multiChart.resize(); }).observe(document.getElementById('multiChart'));
    }
    // overlay 打开时：如果参数无效（S.badBeat 为 true，sampleKinematicsOnly 已生成曲线），
    // 调用 redrawMultiChart 会自动叠加 dist 参考线 + 警告条；这里不再重跑 calc 避免副作用。
    refreshCurveButtons();
    redrawMultiChart();
    // 触发实际应用计算值用 S 曲线重算
    if (S.sel && typeof calcA === 'function') calcA(S.sel);
  } else {
    ov.style.display = 'none';
    old.style.display = '';
    if (card3D) card3D.style.display = '';
    if (btnMC) btnMC.classList.remove('active');
    // 恢复旧图 + 恢复实际应用计算值（用梯形）
    if (typeof drawC === 'function' && S.ok) drawC();
    if (S.sel && typeof calcA === 'function') calcA(S.sel);
  }
}

// 窗口尺寸变化时重新定位 overlay。延迟到下一帧，确保 flex 布局和展开卡占位元素已更新。
var _overlayResizeFrame = null;
window.addEventListener('resize', function(){
  if (!S.overlayOpen) return;
  if (_overlayResizeFrame) cancelAnimationFrame(_overlayResizeFrame);
  _overlayResizeFrame = requestAnimationFrame(function(){
    _overlayResizeFrame = null;
    _positionOverlay();
    if (multiChart) multiChart.resize();
  });
});

function selectCurve(key) {
  // 后 5 条需要已选电机
  if (NEED_MOTOR_KEYS.indexOf(key) >= 0 && !S.sel) return;

  var idx = S.selectedCurves.indexOf(key);
  if (idx >= 0) {
    // 取消选中
    S.selectedCurves.splice(idx, 1);
  } else {
    // 添加（超过 2 个替换最早的）
    if (S.selectedCurves.length >= 2) S.selectedCurves.shift();
    S.selectedCurves.push(key);
  }
  refreshCurveButtons();
  redrawMultiChart();
}

function refreshCurveButtons() {
  var el = document.getElementById('curveOptions');
  if (!el) return;
  var needMotor = !S.sel;
  function renderOne(k) {
    var m = CURVE_META[k];
    var idx = S.selectedCurves.indexOf(k);
    var selected = (idx >= 0);
    var cls = 'curve-opt';
    if (idx === 0) cls += ' on';
    if (idx === 1) cls += ' on c2';
    // 加加速度按钮在 jerk 未启用时禁用
    var dis = '';
    if (k === 'j' && !S.jerkEnabled) {
      dis = ' disabled';
    } else if (needMotor && NEED_MOTOR_KEYS.indexOf(k) >= 0) {
      dis = ' disabled';
    }
    var styleAttr = selected ? ' style="color:' + m.color + '"' : '';
    return '<button class="' + cls + '"' + dis + styleAttr + ' onclick="selectCurve(\'' + k + '\')">' + _curveLabel(k) + '</button>';
  }
  // 10 个按钮分上下两排，每排 5 个；右对齐
  var row1 = CURVE_KEYS.slice(0, 5).map(renderOne).join('');
  var row2 = CURVE_KEYS.slice(5, 10).map(renderOne).join('');
  el.innerHTML =
    '<div class="flex gap-1.5 justify-end">' + row1 + '</div>' +
    '<div class="flex gap-1.5 justify-end">' + row2 + '</div>';
}

function onJerkChange() {
  // 只在 jerkEnabled 时才生效
  if (!S.jerkEnabled) return;
  var val = parseFloat(document.getElementById('i11').value);
  S.j = (val && val > 0) ? val : 10000;
  if (typeof calc === 'function') calc();
  if (S.overlayOpen) redrawMultiChart();
}

// 勾选/取消勾选 Jerk 复选框
function onJerkEnableToggle() {
  var chk = document.getElementById('chkJerk');
  var inp = document.getElementById('i11');
  if (!chk) return;
  S.jerkEnabled = chk.checked;
  // 启用时：解锁 i11 输入框；禁用时：锁定
  if (inp) inp.disabled = !S.jerkEnabled;
  // 同步当前 jerk 值
  if (S.jerkEnabled) {
    var val = parseFloat(inp && inp.value);
    S.j = (val && val > 0) ? val : 10000;
  }
  // 重新计算（calc() 内部会根据 S.jerkEnabled 切换梯形 / S 曲线）
  if (typeof calc === 'function') calc();
  // 刷新多曲线图与按钮状态（jerk 按钮的 disabled 取决于 S.jerkEnabled）
  if (S.overlayOpen) {
    if (typeof refreshCurveButtons === 'function') refreshCurveButtons();
    if (typeof redrawMultiChart === 'function') redrawMultiChart();
  }
}

// === 多曲线绘图 ===
function redrawMultiChart() {
  if (!multiChart) return;
  // 错误节拍模式（cd<0）：S.ok=false，但需要以错误曲线渲染 → 跳过 ok 检查
  if (!S.curves || (!S.ok && !S.badBeat)) {
    S.badBeat = false;
    multiChart.clear();
    return;
  }
  var sel = S.selectedCurves;
  if (sel.length === 0) { S.badBeat = false; multiChart.clear(); return; }

  // === 错误节拍模式（cd<0）：在 s 曲线的 Y 轴上叠加 dist 参考线 ===
  var badBeat = !!S.badBeat;
  var badBeatDist = badBeat ? (S.badBeatDist || 0) : 0;

  // F/v 特殊模式
  if (sel.indexOf('Fv') >= 0) {
    drawVFChart();
    return;
  }

  // 普通时序图（1~2条曲线，双 Y 轴）
  // 注：Y 轴不显示名称（用户要求节省绘图空间），仅在数值后追加单位
  // 背景：完全不画网格线
  var yAxis = sel.map(function(k, i) {
    var m = CURVE_META[k];
    return {
      type: 'value',
      position: i === 0 ? 'left' : 'right',
      // 隐藏 Y 轴的竖线和刻度线，仅保留数值标签
      axisLine: {show: false},
      axisTick: {show: false},
      axisLabel: {color: m.color, fontSize: 9, formatter: function(v) { return (+v).toFixed(2) + ' ' + m.unit; }},
      splitLine: {show: false}
    };
  });

  var series = sel.map(function(k, i) {
    var m = CURVE_META[k];
    var data = S.curves.t.map(function(tt, idx) { return [tt, S.curves[k][idx]]; });
    // 降采样：每隔 N 个点取 1 个，避免画太多点卡顿
    // jerk 曲线特殊处理：本身是"平台+归零"的分段常值信号，一旦降采样跳过平台边界，
    // 矩形就会塌成单点尖峰（与 tecnotion 参考图不一致）。此处直接不降采样。
    var isSteppy = (k === 'j' || k === 'a');  // 分段常值 / 分段线性，保留细节
    var step = isSteppy ? 1 : Math.max(1, Math.floor(data.length / 600));
    var sampled = [];
    // 收集关键时间点的索引（±1 步保留，用于跨越阶跃保留矩形边界）
    var keyIndices = {};
    if (S.curves && S.curves.t.length > 0) {
      // 1) F 差分：兼顾其他曲线（力阶跃点）
      for (var ki = 1; ki < S.curves.F.length; ki++) {
        var dF = Math.abs(S.curves.F[ki] - S.curves.F[ki-1]);
        if (dF > 5) { keyIndices[ki-1] = true; keyIndices[ki] = true; if(ki+1 < data.length) keyIndices[ki+1] = true; }
      }
      // 2) 当前曲线自身差分：阈值按自身幅值的 5% 计算
      //    → 保证 jerk 的平台起点/终点、a 的拐点都被保留
      var yArr = S.curves[k];
      if (yArr && yArr.length > 1) {
        var yAbsMax = 0;
        for (var yi = 0; yi < yArr.length; yi++) {
          var yv = Math.abs(yArr[yi]);
          if (yv > yAbsMax) yAbsMax = yv;
        }
        var yThr = Math.max(yAbsMax * 0.05, 1e-6);
        for (var kj = 1; kj < yArr.length; kj++) {
          var dY = Math.abs(yArr[kj] - yArr[kj-1]);
          if (dY > yThr) {
            if (kj-1 >= 0) keyIndices[kj-1] = true;
            keyIndices[kj] = true;
            if (kj+1 < yArr.length) keyIndices[kj+1] = true;
          }
        }
      }
    }
    for (var si = 0; si < data.length; si += step) sampled.push(data[si]);
    // 补入关键点（去重）
    Object.keys(keyIndices).forEach(function(idx) {
      idx = +idx;
      if (idx >= 0 && idx < data.length) sampled.push(data[idx]);
    });
    // 按时间排序去重
    sampled.sort(function(a, b) { return a[0] - b[0]; });
    // 去重（相邻同 t 的）
    var deduped = [sampled[0]];
    for (var di = 1; di < sampled.length; di++) {
      if (sampled[di][0] !== sampled[di-1][0]) deduped.push(sampled[di]);
    }
    sampled = deduped;
    if (data.length - 1 > 0 && sampled[sampled.length-1][0] < data[data.length-1][0]) sampled.push(data[data.length - 1]);

    // === 错误节拍：在 s 曲线的 Y 轴上叠加 dist 水平参考线（红色 dashed）===
    var seriesObj = {
      name: _curveLabel(k),
      type: 'line',
      yAxisIndex: i,
      data: sampled,
      lineStyle: {color: m.color, width: 1.2},
      itemStyle: {color: m.color},
      symbol: 'none',
      smooth: 0,
      // a / j 为了保留阶跃细节不降采样，点数可能超过 ECharts 默认动画阈值（约 2000）导致动画被自动关闭。
      // 提高阈值，让加速度和加加速度也能像其他曲线一样从 0s 动画绘制到末端。
      animationThreshold: 20000
    };
    if (badBeat && k === 's' && badBeatDist > 0) {
      seriesObj.markLine = {
        silent: true,
        symbol: 'none',
        lineStyle: {color: '#EF4444', width: 1, type: 'dashed'},
        label: {
          show: true,
          position: 'end',
          formatter: 'dist=' + (+badBeatDist).toFixed(3) + ' m',
          color: '#EF4444',
          fontSize: 10,
          fontWeight: 600
        },
        data: [{yAxis: badBeatDist}]
      };
    }
    return seriesObj;
  });

  // === 电压分量辅助线：当 U 被选中时，额外叠加 I·R（红色点线）===
  var uIdx = sel.indexOf('U');
  if (uIdx >= 0 && S.curves.IR) {
    var uYAxisIdx = uIdx;  // U 使用的 Y 轴索引
    var stepRef = Math.max(1, Math.floor(S.curves.t.length / 600));
    // 电阻压降 I·R（红色点线）
    var dataIR = [];
    for (var ri = 0; ri < S.curves.t.length; ri += stepRef) dataIR.push([S.curves.t[ri], S.curves.IR[ri] / 0.85]);
    if (dataIR[dataIR.length-1][0] < S.curves.t[S.curves.t.length-1]) dataIR.push([S.curves.t[S.curves.t.length-1], S.curves.IR[S.curves.IR.length-1] / 0.85]);
    series.push({
      name: (_moen_lang === 'en') ? 'IR Drop' : '电阻压降 I·R',
      type: 'line', yAxisIndex: uYAxisIdx, data: dataIR,
      lineStyle: {color: '#EF4444', width: 0.8, type: 'dotted'},
      itemStyle: {color: '#EF4444'}, symbol: 'none', smooth: 0
    });
  }

  // 只有速度/加速度输入变化时，才按用户要求重播“从 0s 到末端”的初始动画；
  // 其他参数变化保持 ECharts 原本的更新行为，不额外改动。
  if (S.replayCurveAnimation) {
    multiChart.clear();
    S.replayCurveAnimation = false;
  }

  // 错误节拍状态下：调高 grid.top 给徽章留位（避免曲线顶到 0 边界）
  multiChart.setOption({
    backgroundColor: 'transparent',
    // 无 Y 轴名称，左/右边距可以收紧
    grid: {top: badBeat ? 40 : 12, right: sel.length === 2 ? 60 : 14, bottom: 26, left: 60},
    graphic: [],
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.96)',
      borderColor: '#E2E8F0', borderWidth: 1,
      extraCssText: 'box-shadow:0 10px 25px -5px rgba(79,70,229,0.12);border-radius:8px;',
      textStyle: {color: '#0F172A', fontSize: 11, fontFamily: '"Plus Jakarta Sans",system-ui,sans-serif'},
      formatter: function(params) {
        if (!params || !params.length) return '';
        var html = (+params[0].axisValue).toFixed(2) + ' s';
        for (var pi = 0; pi < params.length; pi++) {
          var p = params[pi];
          var val = (p.data && p.data.length === 2) ? p.data[1] : p.value;
          // 找单位：从 series name 反查 CURVE_META，或保留原 IR 类名
          var unit = '';
          for (var ck in CURVE_META) {
            if (CURVE_META[ck] && _curveLabel(ck) === p.seriesName) { unit = CURVE_META[ck].unit; break; }
          }
          if (!unit && (p.seriesName === '电阻压降 I·R' || p.seriesName === 'IR Drop')) unit = 'V';
          html += '<br/>' + p.marker + p.seriesName + '：<b>' + (+val).toFixed(2) + '</b> ' + unit;
        }
        return html;
      }
    },
    legend: {show: false},
    xAxis: {
      type: 'value',
      // X 轴时间线固定在图表底部（不跟随 y=0 移动）
      // 当选中的曲线有正有负时，若 onZero:true，X 轴会跑到中间；这里强制贴底
      axisLine: {onZero: false, lineStyle: {color: '#CBD5E1'}},
      axisTick: {show: false},
      axisLabel: {color: '#64748B', fontSize: 9, formatter: function(v) { return v.toFixed(2) + ' s'; }},
      // X 轴不画网格（竖直方向隐藏，避免横竖交叉）
      splitLine: {show: false}
    },
    yAxis: yAxis,
    series: series
  }, true);
}

// === F/v 坐标系（V-F 图：X=速度，Y=力，叠加电机安全区）===
function drawVFChart() {
  if (!multiChart || !S.sel || !S.curves) { if(multiChart) multiChart.clear(); return; }
  var motor = S.sel;
  var KT = motor.fc, KE = motor.be, R = motor.res;
  var Udc = 311;  // AC220V 整流后

  // 电机 V-F 持续区曲线
  var vfCont = [];
  var vfPeak = [];
  var maxV = Math.max(5, S.curves.v.reduce(function(a,b){return Math.max(a,Math.abs(b))},0) * 1.3);
  for (var vi = 0; vi <= 50; vi++) {
    var V = vi / 50 * maxV;
    // 持续力限制：电流 ≤ ci
    var F_cont = motor.cf;
    // 反电动势限速：V_limit = (Udc - sqrt(3) * I * R) / (sqrt(3) * KE)
    var I_cont = motor.ci;
    var V_limit_cont = (Udc - Math.sqrt(3) * I_cont * R) / (Math.sqrt(3) * KE);
    if (V > V_limit_cont) F_cont = Math.max(0, (Udc / Math.sqrt(3) - KE * V) / R * KT);
    vfCont.push([V, Math.max(0, F_cont)]);

    var F_peak_val = motor.pf;
    var I_peak = motor.pi;
    var V_limit_peak = (Udc - Math.sqrt(3) * I_peak * R) / (Math.sqrt(3) * KE);
    if (V > V_limit_peak) F_peak_val = Math.max(0, (Udc / Math.sqrt(3) - KE * V) / R * KT);
    vfPeak.push([V, Math.max(0, F_peak_val)]);
  }

  // 用户工作点轨迹
  var workPoints = [];
  var step = Math.max(1, Math.floor(S.curves.t.length / 400));
  for (var i = 0; i < S.curves.t.length; i += step) {
    workPoints.push([Math.abs(S.curves.v[i]), S.curves.F[i]]);
  }
  workPoints.push([Math.abs(S.curves.v[S.curves.v.length-1]), S.curves.F[S.curves.F.length-1]]);

  // 关键标记点
  var F_peak_actual = Math.max.apply(null, S.curves.F.map(Math.abs));
  var V_peak_actual = Math.max.apply(null, S.curves.v.map(Math.abs));

  multiChart.setOption({
    backgroundColor: 'transparent',
    // 无轴名称，收紧边距
    grid: {top: 30, right: 14, bottom: 26, left: 60},
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.96)',
      borderColor: '#E2E8F0',
      formatter: function(params) {
        if (!params || !params.length) return '';
        var html = (+params[0].axisValue).toFixed(2) + ' m/s';
        for (var pi = 0; pi < params.length; pi++) {
          var p = params[pi];
          var val = (p.data && p.data.length === 2) ? p.data[1] : p.value;
          html += '<br/>' + p.marker + p.seriesName + '：<b>' + (+val).toFixed(2) + '</b> N';
        }
        return html;
      }
    },
    legend: {show: true, top: 4, textStyle: {fontSize: 10, color: '#64748B'}},
    xAxis: {
      type: 'value',
      axisLabel: {color: '#64748B', fontSize: 9, formatter: function(v){return (+v).toFixed(2) + ' m/s'}},
      splitLine: {lineStyle: {color: '#F1F5F9', type: 'dashed'}}
    },
    yAxis: {
      type: 'value',
      axisLabel: {color: '#64748B', fontSize: 9, formatter: function(v){return (+v).toFixed(2) + ' N'}},
      splitLine: {lineStyle: {color: '#F1F5F9', type: 'dashed'}}
    },
    series: [
      // 峰值区
      {name: '峰值区', type: 'line', data: vfPeak, lineStyle: {color: '#10B981', width: 1, type: 'dashed'}, itemStyle: {color: '#10B981'}, symbol: 'none',
       areaStyle: {color: 'rgba(16,185,129,0.08)'}},
      // 持续区
      {name: '持续区', type: 'line', data: vfCont, lineStyle: {color: '#7C3AED', width: 1.2}, itemStyle: {color: '#7C3AED'}, symbol: 'none',
       areaStyle: {color: 'rgba(124,58,237,0.06)'}},
      // 工作轨迹
      {name: '工作点', type: 'line', data: workPoints, lineStyle: {color: '#06B6D4', width: 1.5}, itemStyle: {color: '#06B6D4'}, symbol: 'none', smooth: 0.1},
      // Fpeak 标记
      {name: 'Fpeak', type: 'scatter', data: [[V_peak_actual, F_peak_actual]], symbolSize: 12,
       itemStyle: {color: '#EF4444', borderColor: '#FFF', borderWidth: 2},
       label: {show: true, position: 'top', formatter: 'Fpeak', color: '#EF4444', fontWeight: 600, fontSize: 10}}
    ]
  }, true);
}
