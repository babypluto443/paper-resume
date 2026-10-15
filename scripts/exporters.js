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
  body { background:#fff; padding:0; }
  .paper { box-shadow:none; margin:0; break-after:page; page-break-after:always; }
  .paper:last-child { break-after:auto; page-break-after:auto; }
  @page { size:${st.paper === 'Letter' ? 'letter' : 'A4'}; margin:${st.margin}mm; }
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
    // 打印前把缩放归零，由 @page 控制真实尺寸
    document.body.classList.add('is-printing');
    const prevZoom = document.getElementById('rZoom').value;
    document.getElementById('rZoom').value = '100';
    Preview.setZoom(100, true);
    const done = () => {
      document.body.classList.remove('is-printing');
      document.getElementById('rZoom').value = prevZoom;
      Preview.applyZoom();
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 60);
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
