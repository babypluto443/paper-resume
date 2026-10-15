/* ==========================================================================
   stylepanel.js —— 样式面板：把「排版意图」翻译成 CSS 变量
   所有控件都只是修改 Store.style 里的一个字段，预览随之重排。
   这样做的价值：样式集合是可枚举、可导出的（见 exporters.js 的 styleToJson）
   ========================================================================== */

const StylePanel = (() => {
  let refs = {};
  let zoomFit = true;

  /* ---------------- 模板缩略图：用真实结构画骨架，不用伪元素 ---------------- */
  function thumb(tpl) {
    const L = (w, cls = 'd') => `<i class="${cls}" style="width:${w}"></i>`;
    const GAP = 'gap:2.5px';
    if (tpl === 'sidebar') {
      return `<div class="tpl-thumb">
        <div class="col-b" style="width:34%;background:#eae7e0;padding:3px;${GAP}">
          <i class="a" style="width:70%;height:4px"></i>
          ${L('100%')}${L('85%')}${L('92%')}
          <i class="a" style="width:55%;height:3px;margin-top:2px"></i>
          ${L('100%')}${L('70%')}
        </div>
        <div class="col-a" style="${GAP}">
          <i class="a" style="width:66%;height:5px"></i>
          <i style="width:100%;height:1px;background:#d8d2c6"></i>
          ${L('100%')}${L('76%')}
          <i style="width:100%;height:1px;background:#d8d2c6;margin-top:2px"></i>
          ${L('100%')}${L('60%')}
        </div>
      </div>`;
    }
    if (tpl === 'curve') {
      return `<div class="tpl-thumb">
        <div class="col-a" style="${GAP}">
          <div style="display:flex;gap:4px;align-items:flex-start">
            <i class="a" style="flex:1;height:7px"></i>
            <i class="d" style="width:13px;height:15px"></i>
          </div>
          <i style="width:100%;height:2.5px;background:#d8a441;margin-top:2px"></i>
          ${L('100%')}${L('72%')}
          <i style="height:7px;width:100%;background:#f0e6d2;border-left:2px solid #d8a441"></i>
          ${L('88%')}
        </div>
      </div>`;
    }
    if (tpl === 'minimal') {
      return `<div class="tpl-thumb" style="padding:9px 12px">
        <div class="col-a" style="gap:3px">
          <i class="a" style="height:5px;width:42%;margin:0 auto"></i>
          ${L('100%')}${L('90%')}
          <i class="a" style="height:3px;width:26%;margin-top:3px"></i>
          ${L('100%')}${L('66%')}
        </div>
      </div>`;
    }
    return `<div class="tpl-thumb" style="padding:9px 12px">
      <div class="col-a" style="gap:3px;align-items:center">
        <i class="a" style="height:6px;width:46%"></i>
        <i style="width:64%;height:1.5px;background:#cfc8ba"></i>
        <i class="a" style="height:3.5px;width:30%;margin-top:2px"></i>
        ${L('100%')}${L('84%')}
        <i class="a" style="height:3.5px;width:30%;margin-top:2px"></i>
        ${L('100%')}${L('58%')}
      </div>
    </div>`;
  }

  function renderTemplates() {
    const el = refs.tplGrid;
    el.innerHTML = TEMPLATES.map(t => `
      <button class="tpl-card${Store.style.template === t.v ? ' is-active' : ''}"
              data-tpl="${t.v}" role="radio" aria-checked="${Store.style.template === t.v}" title="${esc(t.desc)}">
        ${thumb(t.v)}<span class="tpl-card__name">${esc(t.name)}</span>
      </button>`).join('');
  }

  function renderThemes() {
    refs.themeRow.innerHTML = THEMES.map(t => `
      <button class="swatch${Store.style.accent === t.accent ? ' is-active' : ''}"
              data-accent="${t.accent}" data-tname="${esc(t.name)}"
              role="radio" aria-checked="${Store.style.accent === t.accent}"
              title="${esc(t.name)} ${t.accent}" aria-label="${esc(t.name)}"
              style="background:${t.accent}"></button>`).join('');
  }

  /* ---------------- 控件同步 ---------------- */
  function fillSelect(sel, list, val) {
    sel.innerHTML = list.map(o => `<option value="${esc(o.v)}"${o.v === val ? ' selected' : ''}>${esc(o.label)}</option>`).join('');
  }

  function syncControls() {
    const st = Store.style;
    fillSelect(refs.fontCn, FONTS_CN, st.fontCn);
    fillSelect(refs.fontEn, FONTS_EN, st.fontEn);
    refs.weight.value = st.weight;
    refs.paper.value = st.paper;
    refs.align.value = st.align;

    const map = [
      ['base', refs.base, refs.oBase, v => (+v).toFixed(1) + 'pt'],
      ['line', refs.line, refs.oLine, v => (+v).toFixed(2)],
      ['nameSize', refs.nameSize, refs.oName, v => v + 'pt'],
      ['sectionSize', refs.sectionSize, refs.oSection, v => (+v).toFixed(1) + 'pt'],
      ['margin', refs.margin, refs.oMargin, v => v + 'mm'],
      ['gap', refs.gap, refs.oGap, v => v + 'pt'],
      ['density', refs.dense, refs.oDense, v => v + '%']
    ];
    map.forEach(([k, input, out, fmt]) => {
      input.value = st[k];
      out.textContent = fmt(st[k]);
    });

    refs.accent.value = st.accent;
    refs.photo.checked = !!st.photo;
    refs.icon.checked = !!st.icon;
    refs.rule.checked = !!st.rule;
    if (refs.smartMark) refs.smartMark.checked = !!st.smartMark;
    refs.dateRight.checked = !!st.dateRight;
    refs.compact.checked = !!st.compact;
    refs.ats.checked = !!st.ats;

    const sel = refs.bullets;
    sel.innerHTML = `
      <option value="dot"${st.bullets === 'dot' ? ' selected' : ''}>圆点项目符号</option>
      <option value="dash"${st.bullets === 'dash' ? ' selected' : ''}>短横线符号</option>
      <option value="num"${st.bullets === 'num' ? ' selected' : ''}>数字编号</option>
      <option value="plain"${st.bullets === 'plain' ? ' selected' : ''}>无符号（最安全）</option>`;
    refs.zoomLabel.textContent = zoomFit ? '适应' : refs.zoom.value + '%';
  }

  /* ---------------- 选中态同步（不重建 DOM，避免打断正在操作的控件） ----------------
     早期 bug：样式变更后只调 syncControls()，而它不负责模板卡与色块的
     is-active 类，导致点完模板/配色后高亮仍停在旧的那一项 ——
     数据变了、预览变了，只有选中态没变。
     这里只切 class，不重建 innerHTML。 */
  function syncSelection() {
    const st = Store.style;
    document.querySelectorAll('.tpl-card').forEach(card => {
      const on = card.dataset.tpl === st.template;
      card.classList.toggle('is-active', on);
      card.setAttribute('aria-checked', String(on));
    });
    document.querySelectorAll('.swatch').forEach(sw => {
      const on = sw.dataset.accent.toLowerCase() === String(st.accent).toLowerCase();
      sw.classList.toggle('is-active', on);
      sw.setAttribute('aria-checked', String(on));
    });
  }

  /* ---------------- 预览刷新（全量，仅初始化与结构性变更时用） ---------------- */
  function repaint() {
    Preview.paint();
    renderTemplates();
    renderThemes();
    syncControls();
  }

  /** 样式微调：只更新选中态 + 控件值，不重建 DOM */
  function onStyleChange() {
    Preview.paint();
    syncSelection();
    syncControls();
  }

  function init() {
    refs = {
      tplGrid: document.getElementById('tplGrid'),
      themeRow: document.getElementById('themeRow'),
      fontCn: document.getElementById('selFontCn'),
      fontEn: document.getElementById('selFontEn'),
      weight: document.getElementById('selWeight'),
      base: document.getElementById('rBase'),
      oBase: document.getElementById('oBase'),
      line: document.getElementById('rLine'),
      oLine: document.getElementById('oLine'),
      nameSize: document.getElementById('rName'),
      oName: document.getElementById('oName'),
      sectionSize: document.getElementById('rSection'),
      oSection: document.getElementById('oSection'),
      paper: document.getElementById('selPaper'),
      margin: document.getElementById('rMargin'),
      oMargin: document.getElementById('oMargin'),
      gap: document.getElementById('rGap'),
      oGap: document.getElementById('oGap'),
      dense: document.getElementById('rDense'),
      oDense: document.getElementById('oDense'),
      accent: document.getElementById('cAccent'),
      bullets: document.getElementById('selBullets'),
      align: document.getElementById('selAlign'),
      photo: document.getElementById('ckPhoto'),
      icon: document.getElementById('ckIcon'),
      rule: document.getElementById('ckRule'),
      smartMark: document.getElementById('ckSmartMark'),
      dateRight: document.getElementById('ckDateRight'),
      compact: document.getElementById('ckCompact'),
      ats: document.getElementById('ckAts'),
      zoom: document.getElementById('rZoom'),
      zoomLabel: document.getElementById('zoomLabel')
    };

    bindEvents();
    repaint();
  }

  function bindEvents() {
    const live = (el, fn) => {
      const h = () => fn(el);
      el.addEventListener('input', h);
      el.addEventListener('change', h);
    };

    live(refs.fontCn, el => Store.commitStyle(s => { s.fontCn = el.value; }));
    live(refs.fontEn, el => Store.commitStyle(s => { s.fontEn = el.value; }));
    live(refs.weight, el => Store.commitStyle(s => { s.weight = el.value; }));
    live(refs.paper, el => Store.commitStyle(s => { s.paper = el.value; }));
    live(refs.align, el => Store.commitStyle(s => { s.align = el.value; }));
    live(refs.bullets, el => Store.commitStyle(s => { s.bullets = el.value; }));
    live(refs.accent, el => Store.commitStyle(s => { s.accent = el.value; s.themeName = '自定义'; }));

    const ranges = [
      [refs.base, 'base'], [refs.line, 'line'], [refs.nameSize, 'nameSize'],
      [refs.sectionSize, 'sectionSize'], [refs.margin, 'margin'],
      [refs.gap, 'gap'], [refs.dense, 'density']
    ];
    ranges.forEach(([el, key]) => live(el, () => {
      Store.commitStyle(s => { s[key] = +el.value; });
    }));

    const cks = [
      [refs.photo, 'photo'], [refs.icon, 'icon'],
      [refs.rule, 'rule'], [refs.smartMark, 'smartMark'],
      [refs.dateRight, 'dateRight'], [refs.compact, 'compact'], [refs.ats, 'ats']
    ];
    cks.forEach(([el, key]) => live(el, () => Store.commitStyle(s => { s[key] = el.checked; })));

    refs.tplGrid.addEventListener('click', e => {
      const b = e.target.closest('[data-tpl]');
      if (!b) return;
      Store.commitStyle(s => {
        s.template = b.dataset.tpl;
        if (s.template === 'classic') s.align = 'center';
      });
    });

    refs.themeRow.addEventListener('click', e => {
      const b = e.target.closest('[data-accent]');
      if (!b) return;
      Store.commitStyle(s => { s.accent = b.dataset.accent; s.themeName = b.dataset.tname; });
    });

    refs.zoom.addEventListener('input', () => {
      zoomFit = false;
      refs.zoomLabel.textContent = refs.zoom.value + '%';
      Preview.setZoom(+refs.zoom.value);
    });

    document.getElementById('btnResetStyle').addEventListener('click', () => {
      Store.resetStyle();
      Toast.show('样式已恢复默认');
    });

    bindPanelToggle();
  }

  /* ---------------- 样式面板开合 ----------------
     按钮是 .workspace 的子元素而非面板子元素，
     所以面板隐藏后按钮依然可点，能再次拉出（bug 修复）。 */
  function bindPanelToggle() {
    const ws = document.getElementById('workspace');
    const btn = document.getElementById('btnToggleStyle');
    if (!ws || !btn) return;

    btn.addEventListener('click', () => {
      const hidden = ws.classList.toggle('is-style-hidden');
      btn.setAttribute('aria-expanded', String(!hidden));
      btn.title = hidden ? '展开样式面板' : '收起样式面板';
      // 面板显隐会改变预览可用宽度，需要重算缩放
      setTimeout(() => Preview.fit(), 340);
    });

    // 窄屏下切换面板时若样式栏被隐藏，需要同时恢复可见性，
    // 否则切回「样式」标签会看到空白
    const originalPaneSwitch = () => {
      if (window.innerWidth <= 1024 && ws.classList.contains('is-style-hidden')) {
        ws.classList.remove('is-style-hidden');
        btn.setAttribute('aria-expanded', 'true');
      }
    };
    document.querySelectorAll('.mobilebar__btn').forEach(b => {
      b.addEventListener('click', originalPaneSwitch);
    });
  }

  return { init, repaint, syncControls, syncSelection, onStyleChange };
})();
