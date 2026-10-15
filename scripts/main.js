/* ==========================================================================
   main.js —— 预览控制器 + 全局装配
   ========================================================================== */

/* ---------------- Toast ---------------- */
const Toast = (() => {
  let el = null, timer = null;
  function show(msg, ms = 2200) {
    if (!el) el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove('is-on'), ms);
  }
  return { show };
})();

/* ---------------- 预览控制器 ---------------- */
const Preview = (() => {
  let stage = null, scroll = null;
  let zoom = 70;          // 百分比
  let printing = false;   // 打印中：屏蔽缩放相关的内联样式
  let atsMode = false;    // ATS 纯文本视图
  let twoUp = false;      // 双栏并排
  let lastPages = 1;

  function init() {
    stage = document.getElementById('paperStage');
    scroll = document.getElementById('previewScroll');
  }

  function applyZoom() {
    if (!stage) return;
    const s = zoom / 100;
    // 打印前把缩放相关样式清干净。
    // 缩放靠 transform + 一个负 margin-bottom 补偿占位，两者都是内联样式，
    // @media print 里的规则盖不住内联（除非 !important）。
    // 若带着负边距去打印，纸张高度会算错、末尾溢出成空白第二页。
    // 这里提前清零，由 print() 负责恢复。
    if (printing) {
      stage.style.transform = '';
      stage.style.marginBottom = '';
      return;
    }
    stage.style.transform = s < 1 ? `scale(${s})` : '';
    stage.style.marginBottom = s < 1 ? `-${Math.round((1 - s) * stage.offsetHeight)}px` : '';
    stage.style.transformOrigin = 'top center';
  }
  function setZoom(v, silent) {
    zoom = v;
    applyZoom();
    if (!silent) { /* label 由 StylePanel 更新 */ }
  }

  /** 自适应：按容器宽度决定缩放，保证整页可见 */
  function fit() {
    const st = Store.style;
    const mm = 96 / 25.4;
    const paperW = (st.paper === 'Letter' ? 215.9 : 210) * mm;
    const avail = scroll.clientWidth - 34;
    const z = Math.max(30, Math.min(140, Math.floor(avail / paperW * 100)));
    zoom = z;
    applyZoom();
    document.getElementById('rZoom').value = z;
    document.getElementById('zoomLabel').textContent = z + '%';
  }

  function paint() {
    const st = Store.style;
    const pages = Paper.render(Store.doc, st);
    lastPages = pages.length;

    if (atsMode) {
      stage.style.transform = '';
      stage.innerHTML = `<div class="ats-view">${Exporters.toAtsText()
        .replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
        .replace(/^(## .+)$/gm, '<h4>$1</h4>')}</div>`;
      setBadge();
      return;
    }

    const cls = Paper.paperClass(st);
    const vars = Paper.styleVars(st);
    const isLetter = st.paper === 'Letter';

    stage.innerHTML = pages.map((html, i) => `
      <div class="paper-wrap${twoUp ? ' paper-wrap--two' : ''}" data-page="${i + 1}">
        <div class="paper-badge">PAGE ${i + 1} / ${pages.length}</div>
        <article class="${cls}${isLetter ? ' is-letter' : ''}" data-tpl="${esc(st.template)}" style="${vars}">${html}</article>
      </div>`).join('');

    applyZoom();
    setBadge();
  }

  function setBadge() {
    const chip = document.getElementById('pageCount');
    if (!chip) return;
    const st = Store.style;
    const full = lastPages === 1;
    chip.textContent = full ? '1 页 · 单页' : lastPages + ' 页';
    chip.className = 'chip mono ' + (full ? 'chip--ok' : 'chip--warn');
    chip.title = full ? '正好一页，符合国内校招简历惯例' : '内容超过一页，建议压缩或接受多页';
  }

  function toggleAts(force) {
    atsMode = force != null ? force : !atsMode;
    const btn = document.getElementById('btnToggleAts');
    btn.setAttribute('aria-pressed', String(atsMode));
    btn.textContent = atsMode ? '返回排版预览' : 'ATS 文本视图';
    paint();
    if (atsMode) Toast.show('这是招聘系统实际能读到的纯文本，可复制到 JD 里做关键词自查');
  }

  function toggleTwoUp(force) {
    twoUp = force != null ? force : !twoUp;
    const btn = document.getElementById('btnAtsWrap');
    btn.setAttribute('aria-pressed', String(twoUp));
    btn.textContent = twoUp ? '单页视图' : '双栏视图';
    document.querySelectorAll('.paper-wrap').forEach((w, i) => {
      w.style.display = twoUp && i % 2 === 1 ? '' : '';
    });
    if (twoUp) {
      const wraps = document.querySelectorAll('.paper-wrap');
      wraps.forEach((w, i) => { w.style.display = (i % 2 === 0) ? '' : ''; });
      stage.style.display = 'grid';
      stage.style.gridTemplateColumns = `repeat(2, max-content)`;
      stage.style.justifyContent = 'center';
      stage.style.columnGap = '22px';
    } else {
      stage.style.display = '';
      stage.style.gridTemplateColumns = '';
      stage.style.justifyContent = '';
      stage.style.columnGap = '';
    }
    setTimeout(fit, 10);
  }

  /** 供 Exporters.print() 调用：打印期间屏蔽缩放内联样式 */
  function beginPrint() { printing = true; applyZoom(); }
  function endPrint() { printing = false; applyZoom(); }

  return { init, paint, fit, setZoom, applyZoom, toggleAts, toggleTwoUp,
    beginPrint, endPrint, get pages() { return lastPages; } };
})();

/* ---------------- 全局装配 ---------------- */
(function boot() {
  Store.load();

  Editor.init(document.getElementById('editorRoot'));
  Preview.init();
  StylePanel.init();

  Editor.bind();
  Editor.render();
  Preview.paint();
  requestAnimationFrame(() => Preview.fit());

  /* 订阅：内容变更 → 重绘预览
     Editor.render() 内部会判断是否处于输入态：
     输入过程中（reason==='typing'）只重绘预览，不重建编辑器 DOM，
     否则正在输入的 input 会被销毁导致失焦、打不了字 */
  Store.subscribe(reason => {
    if (reason === 'style') {
      // 走 onStyleChange：除了重绘预览，还要同步模板卡/色块的选中态。
      // 原先只调 syncControls()，导致点了模板高亮不动。
      StylePanel.onStyleChange();
      return;
    }
    Editor.render();
    Preview.paint();
  });

  /* 顶栏操作 */
  document.getElementById('btnUndo').addEventListener('click', () => {
    if (!Store.undo()) Toast.show('没有可撤销的操作');
  });
  document.getElementById('btnRedo').addEventListener('click', () => {
    if (!Store.redo()) Toast.show('没有可重做的操作');
  });
  document.getElementById('btnSaveJson').addEventListener('click', () => Exporters.exportJson());
  document.getElementById('btnExportMd').addEventListener('click', () => Exporters.exportMd());
  document.getElementById('btnExportHtml').addEventListener('click', () => Exporters.exportHtml());
  document.getElementById('btnPrint').addEventListener('click', () => Exporters.print());
  document.getElementById('fileJson').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if (f) Exporters.importJson(f);
    e.target.value = '';
  });

  /* 视图切换 */
  document.getElementById('btnToggleAts').addEventListener('click', () => Preview.toggleAts());
  document.getElementById('btnAtsWrap').addEventListener('click', () => Preview.toggleTwoUp());

  /* 快捷键 */
  document.addEventListener('keydown', e => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      e.shiftKey ? Store.redo() : Store.undo();
    } else if (mod && e.key.toLowerCase() === 'p') {
      e.preventDefault(); Exporters.print();
    } else if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault(); Exporters.exportJson();
    }
  });

  /* 窄屏面板切换 */
  document.querySelectorAll('.mobilebar__btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mobilebar__btn').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('is-active'));
      const map = { editor: '.panel--editor', style: '.panel--style', preview: '.panel--preview' };
      document.querySelector(map[btn.dataset.pane]).classList.add('is-active');
      if (btn.dataset.pane === 'preview') setTimeout(() => Preview.fit(), 60);
    });
  });
  document.querySelector('.panel--editor').classList.add('is-active');

  /* 离开前落盘 */
  window.addEventListener('beforeunload', () => Store.saveNow());
  window.addEventListener('resize', () => { clearTimeout(window._rz); window._rz = setTimeout(() => Preview.fit(), 180); });

  /* 打印页尺寸：@page 的 margin 必须为 0
     ---------------------------------------------------------------
     边距只能由一处负责。早先这里写的是 `margin: ${Store.style.margin}mm`，
     与 components.css 里的 `@page { margin: 0 }` 冲突且后注入者胜出，
     于是外层 @page 又缩进 13mm，而 .paper 本身是满高 297mm（A4），
     实际可打印区域只剩 297-13×2=271mm → 必然溢出成空白第二页。

     职责划分：
     · @page 负责纸张尺寸与零外边距（不能有边距，否则内容被二次压缩）
     · .paper 的 padding 负责版心边距（也就是界面上的「页边距」滑块）
     这样屏幕上看到的排版与打印结果严格一致。 */
  const syncPageSize = () => {
    let tag = document.getElementById('pageSizeTag');
    if (!tag) {
      tag = document.createElement('style');
      tag.id = 'pageSizeTag';
      document.head.appendChild(tag);
    }
    const size = Store.style.paper === 'Letter' ? 'letter' : 'A4';
    // margin 固定 0；额外禁止浏览器默认注入页眉页脚，
    // 否则 Chrome 会在页面顶部/底部加日期与网址，正是用户看到的"水印"
    tag.textContent = `@media print {
  @page { size: ${size}; margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; }
}`;
  };
  Store.subscribe(syncPageSize);
  syncPageSize();

  /* 缩略图式入场：给三栏一个编排好的序列 */
  document.querySelectorAll('.panel').forEach((p, i) => {
    p.classList.add('reveal');
    p.style.animationDelay = (i * 90) + 'ms';
  });

  console.log('%c纸样 Resume', 'font:700 15px/1 monospace;color:#d94f2b',
    '\n数据全部保存在浏览器 localStorage，不上传任何服务器。');
})();
