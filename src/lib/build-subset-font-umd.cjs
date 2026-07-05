/**
 * 生成 lib/subset-font.umd.js —— 浏览器端 subset-font 包装
 *
 * 用法：
 *   <script src="lib/subset-font.umd.js"></script>
 *   const subsetBytes = await window.subsetFont(originalTtfBytes, "中文 + ASCII");
 *
 * 输入：Uint8Array (TTF)
 * 输出：Uint8Array (TTF)
 */
const fs = require('fs');
const path = require('path');

const WASM_B64 = fs.readFileSync(path.join(__dirname, 'hb-subset-wasm-base64.txt'), 'utf8').trim();

const out =
`(function (global) {
  'use strict';

  // === 1. 内嵌 hb-subset.wasm (base64 → Uint8Array) ===
  var WASM_B64 = ${JSON.stringify(WASM_B64)};

  function b64ToBytes(b64) {
    var bin = '';
    var CHUNK = 0x8000;
    for (var i = 0; i < b64.length; i += CHUNK) {
      bin += atob(b64.substr(i, CHUNK));
    }
    var len = bin.length;
    var out = new Uint8Array(len);
    for (var j = 0; j < len; j++) out[j] = bin.charCodeAt(j) & 0xFF;
    return out;
  }

  // === 2. WASM 单次实例化（共享 heap） ===
  var hbPromise = null;
  function loadHB() {
    if (hbPromise) return hbPromise;
    hbPromise = (async function () {
      var wasmBytes = b64ToBytes(WASM_B64);
      var result = await WebAssembly.instantiate(wasmBytes, {});
      var hb = result.instance.exports;
      return { hb: hb, heap: new Uint8Array(hb.memory.buffer) };
    })();
    return hbPromise;
  }

  // === 3. subsetFont API ===
  /**
   * @param {Uint8Array} originalFont TTF/OTF/WOFF/WOFF2 二进制
   * @param {string} text 要保留的字符集合
   * @param {Object} [opts]
   * @returns {Promise<Uint8Array>} 新的 TTF
   */
  async function subsetFont(originalFont, text, opts) {
    if (!(originalFont instanceof Uint8Array)) {
      throw new Error('subsetFont: originalFont must be Uint8Array');
    }
    if (typeof text !== 'string') {
      throw new Error('subsetFont: text must be a string');
    }
    opts = opts || {};

    var ctx = await loadHB();
    var hb = ctx.hb;
    var heap = ctx.heap;

    // 注意：harfbuzz 的内存可能因后续操作增长；每次大操作前重新抓 heap view
    function ensureHeap() {
      if (heap.buffer !== hb.memory.buffer) {
        heap = new Uint8Array(hb.memory.buffer);
      }
    }

    var input = hb.hb_subset_input_create_or_fail();
    if (input === 0) {
      throw new Error('hb_subset_input_create_or_fail returned 0');
    }

    try {
      // -- 复制输入字体到 wasm 内存 --
      ensureHeap();
      var fontPtr = hb.malloc(originalFont.byteLength);
      heap.set(originalFont, fontPtr);

      var blob = hb.hb_blob_create(fontPtr, originalFont.byteLength, 2 /* WRITABLE */, 0, 0);
      var face = hb.hb_face_create(blob, 0);
      hb.hb_blob_destroy(blob);

      // -- layout closure：保留所有 GSUB/GPOS 表，确保中文 shaping 正常 --
      var layoutFeatures = hb.hb_subset_input_set(input, 6 /* SETS_LAYOUT_FEATURE_TAG */);
      hb.hb_set_clear(layoutFeatures);
      hb.hb_set_invert(layoutFeatures);

      // -- 添加所需 unicode --
      var inputUnicodes = hb.hb_subset_input_unicode_set(input);
      // 去重：避免浪费 hb_set_add 调用
      var seen = Object.create(null);
      for (var i = 0; i < text.length; i++) {
        var cp = text.codePointAt(i);
        if (cp > 0xFFFF) i++; // 跳过 surrogate 第二位
        if (!seen[cp]) {
          seen[cp] = 1;
          hb.hb_set_add(inputUnicodes, cp);
        }
      }

      // -- 执行子集化 --
      var subset = hb.hb_subset_or_fail(face, input);
      if (subset === 0) {
        hb.hb_face_destroy(face);
        hb.free(fontPtr);
        throw new Error('hb_subset_or_fail returned 0 (input corrupted?)');
      }

      // -- 提取结果 --
      var resultBlob = hb.hb_face_reference_blob(subset);
      var offset = hb.hb_blob_get_data(resultBlob, 0);
      var length = hb.hb_blob_get_length(resultBlob);

      ensureHeap();
      var out = new Uint8Array(length);
      out.set(heap.subarray(offset, offset + length));

      // 清理
      hb.hb_blob_destroy(resultBlob);
      hb.hb_face_destroy(subset);
      hb.hb_face_destroy(face);
      hb.free(fontPtr);

      return out;
    } finally {
      hb.hb_subset_input_destroy(input);
    }
  }

  // === 4. 暴露 ===
  global.subsetFont = subsetFont;

  // CommonJS（用于 Node 端单元测试）
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = subsetFont;
  }
})(typeof window !== 'undefined' ? window : globalThis);
`;

fs.writeFileSync(path.join(__dirname, 'subset-font.umd.js'), out, 'utf8');
console.log('Wrote subset-font.umd.js (' + out.length + ' chars)');