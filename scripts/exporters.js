/* ==========================================================================
   exporters.js —— 导出与导入
   导出策略（各取所长）：
   · PDF      → 浏览器打印管线，@page 零边距，靠 .paper-wrap 的 break-after 分页，
                             矢量文字、可选中、可被 ATS 解析（优于截图式方案）
   · HTML     → 单文件、样式内联、浏览器原生分页，别人打开就能看
   · Markdown → 纯文本可 diff 版本化，适合放 Git
   · JSON     → 完整数据 + 样式，可再次导入继续编辑
   ========================================================================== */

const Exporters = (() => {

  function download(name, content, mime) {
    const blob = new Blob([content], { type: mime + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function baseName() {
    const n = (Store.doc.basics.name || 'resume').trim().replace(/\s+/g, '_');
    return n || 'resume';
  }

  /* ---------------- JSON ---------------- */
  function toJson() {
    return JSON.stringify({
      $schema: 'paper-resume/1',
      exportedAt: new Date().toISOString(),
      style: Store.style,
      ...Store.doc
    }, null, 2);
  }
  function exportJson() {
    download(baseName() + '.json', toJson(), 'application/json');
    Toast.show('已导出 JSON（可再次导入继续编辑）');
  }

  function importJson(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (!d || (!d.basics && !d.sections)) throw new Error('缺少 basics / sections');
        Store.replaceDoc({ basics: d.basics, sections: d.sections }, d.style);
        Toast.show('导入成功');
      } catch (e) {
        Toast.show('导入失败：' + e.message);
      }
    };
    r.readAsText(file);
  }

  /* ---------------- Markdown ---------------- */
  function toMarkdown() {
    const doc = Store.doc, st = Store.style;
    const L = [];
    const b = doc.basics;
    L.push(`# ${nz(b.name) || '姓名'}`);
    if (has(b.headline)) L.push(`**${nz(b.headline)}**`);
    const cs = (b.contacts || []).filter(c => has(c.v));
    if (cs.length) L.push(cs.map(c => (has(c.k) ? `**${c.k}**: ` : '') + c.v).join(' · '));
    if (has(b.summary)) { L.push(''); L.push('> ' + nz(b.summary)); }

    (doc.sections || []).filter(s => s.visible !== false).forEach(sec => {
      const meta = SECTION_TYPES[sec.type];
      if (!meta) return;
      const items = (sec.items || []).filter(it => it);
      if (!items.length) return;
      L.push('');
      L.push(`## ${sec.title || meta.label}`);

      items.forEach(it => {
        const line = [nz(it.org), nz(it.title)].filter(Boolean).join(' · ');
        if (line) L.push(`### ${line}`);
        if (has(it.date)) L.push(`\`${nz(it.date)}\``);
        if (has(it.meta)) L.push(`*${nz(it.meta)}*`);
        if (has(it.link)) L.push(`<${nz(it.link)}>`);
        (it.bullets || []).filter(has).forEach(x => L.push(`- ${stripMd(nz(x))}`));
        if (sec.type === 'text' && has(it.body)) {
          L.push('');
          L.push(stripMd(nz(it.body)));
        }
        if (sec.type === 'link' && has(it.link)) L.push(`- [${nz(it.title) || nz(it.link)}](${nz(it.link)})`);
        L.push('');
      });
    });
    L.push('');
    return L.join('\n');
  }
  function stripMd(s) {
    return s.replace(/\*\*(.+?)\*\*/g, '**$1**').replace(/`/g, '').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
  }
  function exportMd() {
    download(baseName() + '.md', toMarkdown(), 'text/markdown');
    Toast.show('已导出 Markdown');
  }

  /* ---------------- 独立 HTML ---------------- */
  function toHtml() {
    const st = Store.style;
    const body = Paper.renderSingle(Store.doc, st);
    const cls = Paper.paperClass(st);
    const vars = Paper.styleVars(st);
    const css = collectCss();
    const fontLink = document.querySelector('link[href*="fonts.googleapis.com"]');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${esc(nz(Store.doc.basics.name) || '简历')} · 纸样 Resume</title>
${fontLink ? fontLink.outerHTML : ''}
<style>
${css}
body { background:#e9e4da; margin:0; padding:28px 0; display:flex; justify-content:center;
  font-family:'Noto Sans SC',sans-serif; }
.paper { box-shadow:0 4px 22px rgba(0,0,0,.16); margin:0 0 24px; }
@media print {
  /* @page margin 固定 0：版心边距已由 .paper 的 padding 负责。
     若这里再叠一层用户边距，满高的 .paper 装不下被二次压缩的可打印区，
     末尾就会多出空白页（用户反馈的"多一页"）。 */
  html, body { background:#fff; margin:0 !important; padding:0 !important; }
  .paper {
    box-shadow:none !important;
    margin:0 auto !important;
    padding:var(--m) !important;
    break-after:page; page-break-after:always;
    break-inside:avoid; overflow:visible;
  }
  .paper:last-child { break-after:auto; page-break-after:auto; }
  @page { size:${st.paper === 'Letter' ? 'letter' : 'A4'}; margin:0; }
}
</style>
</head>
<body>
<article class="${cls}" data-tpl="${esc(st.template)}" style="${vars}">
${body}
</article>
</body>
</html>`;
  }

  function collectCss() {
    let out = '';
    for (const ss of document.styleSheets) {
      try {
        for (const rule of ss.cssRules) out += rule.cssText + '\n';
      } catch (e) { /* 跨域（Google Fonts）跳过，字体由 <link> 保证 */ }
    }
    return out;
  }
  function exportHtml() {
    download(baseName() + '.html', toHtml(), 'text/html');
    Toast.show('已导出独立 HTML（双击即可打开）');
  }

  /* ---------------- 打印 / PDF ---------------- */
  function print() {
    /*
      打印前必须把「预览态」清干净，否则会多出一页空白。

      预览区为了在屏幕上缩放适配，写了两个内联样式：
        transform: scale(s)             缩放
        margin-bottom: -(1-s)*height   负边距补偿占位
      内联样式无法被 @media print 里的 CSS 覆盖（除非加 !important），
      于是这两条会被带进打印：
        · scale 使纸张被视觉缩放，与 @page 的真实尺寸冲突
        · 负 margin-bottom 抽掉了纸张应有的占位高度，
          后续分页计算基于被压缩后的高度，末尾溢出成第二页

      所以这里在打印前统一复位，打印后再恢复用户原本的缩放。
    */
    document.body.classList.add('is-printing');
    Preview.beginPrint();
    const prevZoom = document.getElementById('rZoom').value;
    document.getElementById('rZoom').value = '100';
    Preview.setZoom(100, true);

    const done = () => {
      document.body.classList.remove('is-printing');
      document.getElementById('rZoom').value = prevZoom;
      Preview.endPrint();
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    // 部分浏览器不触发 afterprint，兜底在窗口重新获得焦点时复位
    window.addEventListener('focus', () => setTimeout(done, 400), { once: true });
    setTimeout(() => window.print(), 80);
  }

  /* ---------------- ATS 纯文本视图 ---------------- */
  function toAtsText() {
    const doc = Store.doc, b = doc.basics;
    const L = [];
    L.push(nz(b.name));
    if (has(b.headline)) L.push(nz(b.headline));
    (b.contacts || []).filter(c => has(c.v)).forEach(c => L.push((has(c.k) ? c.k + ': ' : '') + nz(c.v)));
    if (has(b.summary)) { L.push(''); L.push(nz(b.summary)); }

    (doc.sections || []).filter(s => s.visible !== false).forEach(sec => {
      const meta = SECTION_TYPES[sec.type];
      if (!meta) return;
      const items = (sec.items || []).filter(it => it);
      if (!items.length) return;
      L.push(''); L.push('## ' + nz(sec.title || meta.label));
      items.forEach(it => {
        [it.org, it.title, it.date, it.meta, it.link].forEach(v => { if (has(v)) L.push('  ' + nz(v)); });
        (it.bullets || []).filter(has).forEach(x => L.push('  - ' + nz(x)));
        if (has(it.body)) L.push('  ' + nz(it.body));
      });
    });
    return L.join('\n');
  }

  return { exportJson, importJson, exportMd, exportHtml, print, toAtsText, toHtml, toMarkdown, toJson, download };
})();
