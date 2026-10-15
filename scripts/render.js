/* ==========================================================================
   render.js —— 纸张渲染 + A4 分页引擎
   分页思路（关键工程点）：
   浏览器 CSS 无法真正"排版分页"（除非用 columns 之类的近似手段），所以这里做的是
   「测量 → 装箱」：把每个顶层块（头部 / 章节）渲染到与纸张同宽的隐藏容器里，
   逐块读取实际高度，再贪心地装进一页一页的可用高度里。测量用 flex 容器
   阻止外边距合并，保证读到的 advance 高度与视觉一致。
   ========================================================================== */

/* ---------------- 工具 ---------------- */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 内联标记：**粗** *斜* `代码` [文字](链接) 以及裸 URL */
function inline(s) {
  let t = esc(s);
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_, txt, href) => `<a href="${href}" target="_blank" rel="noopener">${txt}</a>`);
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  t = t.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g,
    (_, pre, url) => `${pre}<a href="${url}" target="_blank" rel="noopener">${url}</a>`);
  return t;
}

function nz(s) { return String(s == null ? '' : s).trim(); }
function has(v) { return nz(v) !== ''; }

/* ---------------- 样式变量 → CSS ---------------- */
function styleVars(st) {
  return [
    `--accent:${st.accent}`,
    `--f-cn:${st.fontCn}`,
    `--f-en:${st.fontEn}`,
    `--fw:${st.weight}`,
    `--fw-strong:${st.weight >= 600 ? 700 : (st.weight >= 500 ? 600 : 700)}`,
    `--f-base-base:${st.base}pt`,
    `--f-base:${st.base}pt`,
    `--lh:${st.line}`,
    `--fs-name:${st.nameSize}pt`,
    `--fs-section:${st.sectionSize}pt`,
    `--gap:${st.gap}pt`,
    `--m:${st.margin}mm`,
    `--scale:${(st.density / 100).toFixed(3)}`
  ].join(';');
}

function paperClass(st) {
  return [
    'paper',
    st.template === 'sidebar' ? 'p-sb-body' : '',
    st.paper === 'Letter' ? 'is-letter' : '',
    st.compact ? 'compact' : '',
    !st.icon ? 'no-icon' : '',
    !st.rule ? 'no-rule' : '',
    st.bullets === 'plain' ? 'no-bullets' : '',
    !st.photo ? 'no-photo' : '',
    st.ats ? 'ats' : ''
  ].filter(Boolean).join(' ');
}

/* ---------------- 头部 ---------------- */
function renderHead(doc, st) {
  const b = doc.basics || {};
  const cls = st.template === 'classic' ? 'center' : (st.align || 'left');
  const contacts = (b.contacts || []).filter(c => has(c.v));
  const cHtml = contacts.map(c => {
    const href = c.href || (/^https?:/i.test(c.v) ? c.v : '');
    const val = href
      ? `<a href="${esc(href)}" target="_blank" rel="noopener">${inline(c.v)}</a>`
      : `<span>${inline(c.v)}</span>`;
    return `<span class="p-contact__item">${has(c.k) ? `<b>${esc(c.k)}</b>` : ''}${val}</span>`;
  }).join('');

  const photo = b.photo
    ? `<img src="${esc(b.photo)}" alt="">`
    : `<span>照片</span>`;

  return `
  <header class="p-head" data-align="${esc(cls)}">
    <div class="p-head__row">
      <div class="p-head__main">
        <h1 class="p-name${st.template === 'curve' ? ' p-name--accent' : ''}">${inline(b.name || '姓名')}</h1>
        ${has(b.headline) ? `<p class="p-tagline">${inline(b.headline)}</p>` : ''}
        ${cHtml ? `<div class="p-contact">${cHtml}</div>` : ''}
      </div>
      ${st.photo && st.align === 'split' ? `<div class="p-head__aside"><div class="p-photo">${photo}</div></div>` : ''}
    </div>
    ${has(b.summary) ? `<p class="p-summary">${inline(b.summary)}</p>` : ''}
  </header>`;
}

/* ---------------- 章节壳 ---------------- */
function sectionShell(sec, st, inner) {
  const meta = SECTION_TYPES[sec.type] || {};
  // 章节前缀用「中文语义缩写」（学历/经历/项目…），不用 emoji：
  // emoji 在 PDF 里常被渲染成彩色错字，字宽也不可控，还可能被 ATS 读成乱码
  const title = sec.title || meta.label || '';
  // 标记只在「与标题语义不重叠」时显示，避免出现"学历教育经历"这种重复。
  // 判定用去重关键词而非缩写本身：标题写"教育经历"、缩写是"学历"，
  // 字符串并不相交，但语义上却是同一个东西。
  const raw = sec.abbr || meta.abbr || '';
  const DUP = {
    '学历': '教育', '经历': '经历', '项目': '项目', '技能': '技能',
    '荣誉': '荣誉', '自述': '评价', '链接': '链接'
  };
  const key = DUP[raw] || raw;
  const mark = raw && !title.includes(key) ? raw : '';
  const showMark = st.icon && !st.ats && has(mark);
  const showRule = st.rule && !st.ats;
  return `
  <section class="p-sec" data-sec="${esc(sec.id)}">
    <div class="p-sec__head">
      <h2 class="p-sec__title">${showMark ? `<span class="p-sec__mark">${esc(mark)}</span>` : ''}${esc(title)}</h2>
      ${showRule ? '<i class="p-sec__line"></i>' : ''}
      ${has(sec.en) && !st.ats ? `<span class="p-sec__en">${esc(sec.en)}</span>` : ''}
    </div>
    <div class="p-sec__body">${inner}</div>
  </section>`;
}

function bulletsHtml(it, st) {
  const list = (it.bullets || []).filter(b => has(b));
  if (!list.length) return '';
  const style = st.bullets === 'plain' ? 'p-bullets--plain' :
    st.bullets === 'dash' ? 'p-bullets--dash' :
    st.bullets === 'num' ? 'p-bullets--num' : '';
  return `<ul class="p-bullets ${style}">${list.map(b => `<li>${inline(b)}</li>`).join('')}</ul>`;
}

function dateHtml(it, st) {
  if (!has(it.date)) return '';
  return st.dateRight
    ? `<div class="p-item__date">${esc(it.date)}</div>`
    : `<div class="p-item__date p-item__date--below">${esc(it.date)}</div>`;
}

/* ---------------- 各 kind 的条目渲染 ---------------- */
const ItemRender = {
  education(it) {
    return `
      <div class="p-item">
        <div class="p-item__head">
          <div class="p-item__main">
            <h3 class="p-item__title">${inline(it.org)}</h3>
            ${has(it.title) ? `<p class="p-item__sub">${inline(it.title)}</p>` : ''}
          </div>
          ${dateHtml(it, window.__st || {})}
        </div>
        ${has(it.meta) ? `<div class="p-item__meta">${inline(it.meta)}</div>` : ''}
        ${bulletsHtml(it, window.__st || {})}
      </div>`;
  },
  experience(it) {
    return `
      <div class="p-item">
        <div class="p-item__head">
          <div class="p-item__main">
            <h3 class="p-item__title"><span class="p-item__org">${inline(it.org)}</span>${
              has(it.title) ? `<span class="sep">·</span>${inline(it.title)}` : ''}</h3>
          </div>
          ${dateHtml(it, window.__st || {})}
        </div>
        ${has(it.meta) ? `<div class="p-item__meta p-item__tech">${inline(it.meta)}</div>` : ''}
        ${bulletsHtml(it, window.__st || {})}
      </div>`;
  },
  project(it) {
    const link = has(it.link)
      ? `<div class="p-links"><a href="${esc(it.link)}" target="_blank" rel="noopener">${esc(it.link.replace(/^https?:\/\//, ''))}</a></div>`
      : '';
    return `
      <div class="p-item">
        <div class="p-item__head">
          <div class="p-item__main">
            <h3 class="p-item__title">${inline(it.title)}</h3>
            ${has(it.org) ? `<p class="p-item__sub">${inline(it.org)}</p>` : ''}
          </div>
          ${dateHtml(it, window.__st || {})}
        </div>
        ${has(it.meta) ? `<div class="p-item__meta p-item__tech">${inline(it.meta)}</div>` : ''}
        ${bulletsHtml(it, window.__st || {})}
        ${link}
      </div>`;
  },
  skill(it) {
    const lv = Number(it.level);
    const bar = (window.__st || {}).template === 'sidebar' && lv > 0
      ? `<div class="p-skill__bar"><i style="width:${Math.max(4, Math.min(100, lv))}%"></i></div>` : '';
    const tagMode = (window.__st || {}).template === 'minimal';
    const items = (it.bullets || []).filter(has);
    const body = tagMode
      ? `<div class="p-skill__items">${items.map(t => `<span class="p-tag">${esc(t)}</span>`).join('')}</div>`
      : `<span class="p-skill__items">${items.map((t, i) => `<span>${esc(t)}${i < items.length - 1 ? '、' : ''}</span>`).join('')}</span>`;
    return `<div class="p-skill${tagMode ? ' p-skill--tags' : ''}">
      <div class="p-skill__label">${esc(it.title)}</div>${body}${bar}</div>`;
  },
  honor(it) {
    return `<div class="p-item"><div class="p-honor">
      <span class="p-honor__t">${inline(it.title)}${has(it.org) ? ` <span class="sep" style="color:var(--muted);font-weight:400">·</span> <span style="font-weight:400;color:var(--ink-3)">${esc(it.org)}</span>` : ''}</span>
      ${has(it.date) ? `<span class="p-honor__d">${esc(it.date)}</span>` : ''}
    </div></div>`;
  },
  text(it) {
    return `<p class="p-text">${inline(it.body || '').replace(/\n/g, '<br>')}</p>`;
  },
  link(it) {
    return `<div class="p-item">
      <div class="p-item__head">
        <div class="p-item__main"><h3 class="p-item__title">${inline(it.title)}</h3>
        ${has(it.meta) ? `<p class="p-item__sub">${inline(it.meta)}</p>` : ''}</div>
      </div>
      ${has(it.link) ? `<div class="p-links"><a href="${esc(it.link)}" target="_blank" rel="noopener">${esc(it.link.replace(/^https?:\/\//, ''))}</a></div>` : ''}
    </div>`;
  }
};

/* ---------------- 章节内条目：普通模板 ---------------- */
function renderItems(sec, st) {
  const kind = SECTION_TYPES[sec.type].kind;
  const fn = ItemRender[kind] || ItemRender.text;
  return (sec.items || []).filter(it => it).map(it => fn(it, st)).join('');
}

/* ---------------- curve 模板：公司 Banner 版式 ---------------- */
function renderBannerSection(sec, st) {
  return (sec.items || []).map(it => {
    const initial = (nz(it.org) || '?').trim().charAt(0).toUpperCase();
    return `
    <div class="p-item">
      <div class="p-banner">
        <span class="p-banner__logo" aria-hidden="true">${esc(initial)}</span>
        <span class="p-banner__name">${inline(it.org)}</span>
        ${has(it.title) ? `<span class="p-banner__role">${esc(it.title)}</span>` : ''}
        ${has(it.date) ? `<span class="p-banner__date">${esc(it.date)}</span>` : ''}
      </div>
      ${has(it.meta) ? `<div class="p-item__meta p-item__tech" style="margin-top:4px">${inline(it.meta)}</div>` : ''}
      ${bulletsHtml(it, st)}
    </div>`;
  }).join('');
}

function renderSection(sec, st) {
  let inner;
  if (sec.type === 'experience' && st.template === 'curve') {
    inner = renderBannerSection(sec, st);
  } else if (sec.type === 'skill' && st.template === 'curve') {
    inner = renderItems(sec, st);
  } else {
    inner = renderItems(sec, st);
  }
  if (!nz(inner)) return '';
  return sectionShell(sec, st, inner);
}

/* ---------------- flow：拆成 head / main / side 三组块 ---------------- */
function buildFlow(doc, st) {
  window.__st = st;
  const head = renderHead(doc, st);
  const main = [], side = [];

  const secs = (doc.sections || []).filter(s => s.visible !== false);
  secs.forEach(sec => {
    const meta = SECTION_TYPES[sec.type];
    if (!meta) return;
    const html = renderSection(sec, st);
    if (!html) return;
    const target = (st.template === 'sidebar' && meta.side) ? side : main;
    target.push({ id: sec.id, html });
  });

  if (st.template === 'sidebar') {
    // 侧栏模板下，联系方式与姓名进侧栏顶部
    if (side.length) {
      const headHtml = renderHead(doc, st);
      side.unshift({ id: '__head__', html: headHtml });
    }
  }
  return { head, main, side };
}

/* ==========================================================================
   分页引擎
   ========================================================================== */
const Paper = (() => {
  let host = null, ruler = null;

  function ensureHost() {
    if (host) return;
    host = document.createElement('div');
    host.id = 'measureHost';
    host.setAttribute('aria-hidden', 'true');
    Object.assign(host.style, {
      position: 'absolute', left: '-10000px', top: '0',
      visibility: 'hidden', pointerEvents: 'none', zIndex: '-1'
    });
    ruler = document.createElement('div');
    // 类名保持 `paper` 以复用全部排版样式，但额外挂 is-measure 与 data-measure，
    // 便于打印样式和自动化选择器把测量容器排除掉
    ruler.setAttribute('data-measure', '');
    host.appendChild(ruler);
    document.body.appendChild(host);
  }

  const MM = 96 / 25.4; // CSS px per mm

  /** 纸张内容区尺寸（px） */
  function metrics(st) {
    const m = st.margin * MM;
    const pageW = (st.paper === 'Letter' ? 215.9 : 210) * MM;
    const pageH = (st.paper === 'Letter' ? 279.4 : 297) * MM;
    return { m, pageW, pageH, innerW: pageW - m * 2, innerH: pageH - m * 2 };
  }

  /** 把一组块渲染进测量容器，逐块返回 advance 高度 */
  function measure(blocks, width, st) {
    if (!blocks.length) return [];
    ensureHost();
    ruler.className = paperClass(st) + ' is-measure';
    ruler.setAttribute('data-tpl', st.template);
    ruler.style.cssText = `width:${width}px;padding:0;min-height:0;display:flex;flex-direction:column;` + styleVars(st);

    ruler.innerHTML = blocks.map(b => b.html).join('');
    const kids = Array.from(ruler.children);
    const out = kids.map((k, i) => {
      const cs = getComputedStyle(k);
      const mt = parseFloat(cs.marginTop) || 0;
      const mb = parseFloat(cs.marginBottom) || 0;
      return { block: blocks[i], h: k.offsetHeight + mt + mb, mt, mb };
    });
    // 测完立刻清空。测量容器留在 DOM 里会被 querySelectorAll、打印管线
    // 和浏览器自动化误选，属于真实隐患（曾导致预览统计到 2 张纸、12 个章节）
    ruler.innerHTML = '';
    return out;
  }

  /** 贪心装箱：blocks → pages[[block,...]] */
  function pack(measured, availH) {
    const pages = [];
    let cur = [], curH = 0;
    measured.forEach(mb => {
      const need = mb.h - mb.mt; // 首块的 margin 不额外占位
      if (cur.length && curH + need > availH) {
        pages.push(cur); cur = []; curH = 0;
      }
      cur.push(mb.block);
      curH += mb.h;
    });
    if (cur.length) pages.push(cur);
    return pages.length ? pages : [[]];
  }

  /** 渲染一页 */
  function pageHtml(pageBlocks, st) {
    const inner = pageBlocks.map(b => b.html).join('');
    if (st.template === 'sidebar') {
      return `<div class="p-sb-body">
        <aside class="p-sb-side">${inner}</aside>
        <div class="p-sb-main"></div>
      </div>`;
    }
    return inner;
  }

  /** 对 sidebar：侧栏与主栏各自装箱，再按页配对 */
  function renderSidebarPages(flow, st) {
    const { innerW, innerH } = metrics(st);
    const sideW = 62 * MM;
    const gapPad = st.margin * MM * 0.86 * 2;
    const mainW = innerW - sideW - gapPad;

    const sPages = pack(measure(flow.side, sideW, st), innerH - st.margin * MM * 0.9);
    const mPages = pack(measure(flow.main, mainW, st), innerH - st.margin * MM * 1.8);

    const n = Math.max(sPages.length, mPages.length);
    const out = [];
    for (let i = 0; i < n; i++) {
      const side = (sPages[i] || []).map(b => b.html).join('');
      const main = (mPages[i] || []).map(b => b.html).join('');
      out.push(`<div class="p-sb-body">
        <aside class="p-sb-side">${side}</aside>
        <div class="p-sb-main">${main}</div>
      </div>`);
    }
    return out.length ? out : ['<div class="p-sb-body"><aside class="p-sb-side"></aside><div class="p-sb-main"></div></div>'];
  }

  /** 主入口：把 doc + style 渲染成 N 页 HTML */
  function render(doc, st) {
    const flow = buildFlow(doc, st);
    const { innerW, innerH } = metrics(st);

    if (st.template === 'sidebar') return renderSidebarPages(flow, st);

    const blocks = (has(flow.head) ? [{ id: '__head__', html: flow.head }] : []).concat(flow.main);
    const measured = measure(blocks, innerW, st);
    const pages = pack(measured, innerH);
    return pages.map(p => p.map(b => b.html).join(''));
  }

  /** 单页 HTML（用于 HTML 导出：保持浏览器原生分页） */
  function renderSingle(doc, st) {
    const flow = buildFlow(doc, st);
    const blocks = (has(flow.head) ? [{ id: '__head__', html: flow.head }] : []).concat(flow.main);
    const body = blocks.map(b => b.html).join('');
    if (st.template === 'sidebar') {
      return `<div class="p-sb-body">
        <aside class="p-sb-side">${flow.side.map(b => b.html).join('')}</aside>
        <div class="p-sb-main">${body}</div>
      </div>`;
    }
    return body;
  }

  return { render, renderSingle, metrics, paperClass, styleVars };
})();
