/* ==========================================================================
   editor.js —— 由 schema 元定义自动生成的表单编辑器
   为什么用元定义驱动：新增一个字段只需要在 schema.js 里加一行，
   表单、校验、预览渲染会自动跟上 —— 这正是 OpenCurve 把样式集中到 .sty
   的思路在应用层的对应物。
   ========================================================================== */

const Editor = (() => {
  let root = null;
  let openSet = new Set();

  function init(el) { root = el; }

  /* ---------------- 折叠状态持久化（按条目 id 记忆） ---------------- */
  function toggle(id) {
    if (openSet.has(id)) openSet.delete(id); else openSet.add(id);
    render();
  }

  /* ---------------- 通用控件 ---------------- */
  function fieldHtml(f, it, sec) {
    const v = it[f.k];
    const val = v == null ? '' : v;
    // 每个控件生成唯一 id，label 用 for 关联 —— 保证读屏软件能念出字段名
    const fid = `f_${sec.id}_${it.id}_${f.k}`.replace(/[^a-zA-Z0-9_]/g, '_');

    if (f.type === 'bullets') {
      const list = Array.isArray(v) ? v : [];
      const rows = list.map((b, i) => `
        <div class="bullet-row">
          <span class="bullet-row__dot" aria-hidden="true">▪</span>
          <input type="text" id="${fid}_b${i}" data-sec="${sec.id}" data-item="${it.id}" data-k="${f.k}__b" data-i="${i}"
                 value="${esc(b)}" placeholder="${esc(f.ph || '一行一条')}" style="flex:1"
                 aria-label="${esc(f.label)}第 ${i + 1} 条">
          <button class="iconbtn iconbtn--danger" data-act="delBullet" data-sec="${sec.id}" data-item="${it.id}" data-k="${f.k}" data-i="${i}" aria-label="删除该条">×</button>
        </div>`).join('');
      return `<div class="ed-field">
        <label id="${fid}_lb"><i>${esc(f.label)}</i></label>
        ${rows || '<p class="hint">还没有内容，点下方按钮添加。</p>'}
        <div class="ed-actions">
          <button class="iconbtn" data-act="addBullet" data-sec="${sec.id}" data-item="${it.id}" data-k="${f.k}" aria-label="添加一条${esc(f.label)}">＋</button>
        </div>
      </div>`;
    }

    if (f.type === 'textarea') {
      return `<div class="ed-field">
        <label for="${fid}"><i>${esc(f.label)}</i></label>
        <textarea id="${fid}" rows="4" data-sec="${sec.id}" data-item="${it.id}" data-k="${f.k}" placeholder="${esc(f.ph || '')}">${esc(val)}</textarea>
      </div>`;
    }

    if (f.type === 'level') {
      return `<div class="ed-field">
        <label for="${fid}"><i>${esc(f.label)}</i><output class="mono" for="${fid}">${val === '' || val == null ? '不显示' : val}</output></label>
        <input type="range" id="${fid}" min="0" max="100" step="5" value="${val === '' || val == null ? 0 : val}"
               data-sec="${sec.id}" data-item="${it.id}" data-k="${f.k}">
      </div>`;
    }

    return `<div class="ed-field">
      <label for="${fid}"><i>${esc(f.label)}</i></label>
      <input type="text" id="${fid}" data-sec="${sec.id}" data-item="${it.id}" data-k="${f.k}"
             value="${esc(val)}" placeholder="${esc(f.ph || '')}">
    </div>`;
  }

  function layoutFields(fields, it, sec) {
    const rows = [];
    let buf = [];
    let bufW = 0;
    const flush = () => {
      if (!buf.length) return;
      const total = bufW;
      const cls = total >= 3 ? 'ed-row--3' : total === 2 ? 'ed-row' : 'ed-row ed-row--1';
      rows.push(`<div class="${cls}">${buf.join('')}</div>`);
      buf = []; bufW = 0;
    };
    fields.forEach(f => {
      const w = f.w === 'full' ? 1 : (f.w === '2' ? 2 : 1);
      buf.push(fieldHtml(f, it, sec));
      bufW += w;
      if (bufW >= 3) flush();
    });
    flush();
    return rows.join('');
  }

  /* ---------------- 基本信息 ---------------- */
  function renderBasics(doc) {
    const b = doc.basics;
    const contacts = (b.contacts || []).map((c, i) => `
      <div class="bullet-row">
        <input type="text" id="ctK${i}" data-bk="k" data-bi="${i}" value="${esc(c.k || '')}" placeholder="标签" aria-label="联系方式 ${i + 1} 的标签" style="flex:0 0 84px">
        <input type="text" id="ctV${i}" data-bk="v" data-bi="${i}" value="${esc(c.v || '')}" placeholder="内容（邮箱/网址会自动识别为链接）" aria-label="联系方式 ${i + 1} 的内容" style="flex:1">
        <button class="iconbtn iconbtn--danger" data-act="delContact" data-i="${i}" aria-label="删除联系方式">×</button>
      </div>`).join('');

    return `
    <div class="ed-group">
      <div class="ed-group__head">
        <h3 class="ed-group__title">基本信息</h3>
        <span class="ed-group__spacer"></span>
      </div>
      <div class="ed-item is-open"><div class="ed-item__body" style="display:block;border-top:none">
        <div class="ed-row">
          <div class="ed-field"><label for="bbName"><i>姓名</i></label><input type="text" id="bbName" data-bb="name" value="${esc(b.name)}" placeholder="张三"></div>
          <div class="ed-field"><label for="bbHeadline"><i>一句话定位</i></label><input type="text" id="bbHeadline" data-bb="headline" value="${esc(b.headline || '')}" placeholder="后端开发实习生 · Go 方向"></div>
        </div>
        <div class="ed-field" style="margin-top:9px">
          <label for="bbPhoto"><i>照片（可粘贴图片 URL，或点下方按钮选择本地图片）</i></label>
          <input type="text" id="bbPhoto" data-bb="photo" value="${esc(b.photo || '')}" placeholder="https://... 或 data:image">
          <div class="ed-actions">
            <button class="iconbtn" data-act="pickPhoto" aria-label="选择本地照片">⬆</button>
            ${b.photo ? '<button class="iconbtn iconbtn--danger" data-act="clearPhoto" aria-label="清除照片">×</button>' : ''}
          </div>
        </div>
        <div class="ed-field" style="margin-top:9px">
          <label for="bbSummary"><i>个人简介 / 自我概述</i></label>
          <textarea rows="4" id="bbSummary" data-bb="summary" placeholder="两三句说明你是谁、擅长什么、用什么证据支撑">${esc(b.summary || '')}</textarea>
        </div>
        <div class="ed-field" style="margin-top:9px">
          <label><i>联系方式</i></label>
          ${contacts}
          <div class="ed-actions"><button class="iconbtn" data-act="addContact" aria-label="添加联系方式">＋</button></div>
        </div>
      </div></div>
    </div>`;
  }

  /* ---------------- 章节 ---------------- */
  function renderSection(sec, doc) {
    const meta = SECTION_TYPES[sec.type];
    const items = sec.items || [];
    const rows = items.map((it, idx) => {
      const open = openSet.has(it.id);
      const label = nz(it.org) || nz(it.title) || `条目 ${idx + 1}`;
      const sub = nz(it.title) && nz(it.org) ? `<em> · ${esc(it.title)}</em>` : '';
      return `
      <div class="ed-item${open ? ' is-open' : ''}" data-itemwrap="${it.id}">
        <div class="ed-item__bar" data-act="toggleItem" data-id="${it.id}" role="button" tabindex="0" aria-expanded="${open}">
          <span class="ed-item__idx mono">${idx + 1}</span>
          <span class="ed-item__title">${esc(label)}${sub}</span>
          <span class="ed-item__caret" aria-hidden="true">▶</span>
        </div>
        <div class="ed-item__body">
          ${layoutFields(meta.fields, it, sec)}
          <div class="ed-actions">
            <button class="iconbtn" data-act="dupItem" data-sec="${sec.id}" data-item="${it.id}" title="复制">⧉</button>
            <button class="iconbtn" data-act="upItem" data-sec="${sec.id}" data-item="${it.id}" title="上移">↑</button>
            <button class="iconbtn" data-act="downItem" data-sec="${sec.id}" data-item="${it.id}" title="下移">↓</button>
            <button class="iconbtn iconbtn--danger" data-act="delItem" data-sec="${sec.id}" data-item="${it.id}" title="删除">×</button>
          </div>
        </div>
      </div>`;
    }).join('');

    return `
    <div class="ed-group" data-secwrap="${sec.id}">
      <div class="ed-group__head">
        <h3 class="ed-group__title">${sec.icon || meta.icon} ${esc(sec.title)}</h3>
        <span class="chip chip--quiet mono">${items.length}</span>
        <span class="ed-group__spacer"></span>
        <button class="iconbtn" data-act="addItem" data-sec="${sec.id}" title="添加条目">＋</button>
        <button class="iconbtn" data-act="upSec" data-sec="${sec.id}" title="上移模块">↑</button>
        <button class="iconbtn" data-act="downSec" data-sec="${sec.id}" title="下移模块">↓</button>
        <button class="iconbtn" data-act="toggleSec" data-sec="${sec.id}" title="显示/隐藏">${sec.visible !== false ? '◉' : '○'}</button>
        <button class="iconbtn iconbtn--danger" data-act="delSec" data-sec="${sec.id}" title="删除模块">×</button>
      </div>
      ${items.length ? rows : `<div class="empty"><strong>这个模块还是空的</strong>点右上角 ＋ 添加第一条内容</div>`}
    </div>`;
  }

  /* ---------------- 整页渲染 ---------------- */
  function render() {
    if (!root) return;
    const doc = Store.doc;
    const secs = doc.sections || [];
    root.innerHTML =
      renderBasics(doc) +
      secs.map(s => renderSection(s, doc)).join('') +
      addSectionBlock(doc);
  }

  function addSectionBlock(doc) {
    const used = new Set((doc.sections || []).map(s => s.type));
    const avail = DEFAULT_SECTION_ORDER.filter(t => !used.has(t));
    if (!avail.length) return '';
    return `
    <div class="ed-group">
      <div class="ed-group__head"><h3 class="ed-group__title">＋ 添加模块</h3></div>
      <div class="tagline">
        ${avail.map(t => `<span class="tag">${SECTION_TYPES[t].icon}
          <button data-act="addSec" data-type="${t}" style="background:none;border:none;color:inherit;cursor:pointer;padding:0;font-size:12px">${SECTION_TYPES[t].label}</button>
        </span>`).join('')}
      </div>
    </div>`;
  }

  /* ---------------- 事件委托 ---------------- */
  function findSec(id) { return Store.doc.sections.find(s => s.id === id); }
  function findItem(sec, id) { return (sec.items || []).find(i => i.id === id); }

  function move(arr, from, to) {
    if (to < 0 || to >= arr.length || from === to) return;
    const [x] = arr.splice(from, 1);
    arr.splice(to, 0, x);
  }

  function handleClick(e) {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;

    if (act === 'toggleItem') { toggle(t.dataset.id); return; }
    if (act === 'toggleSec') {
      Store.commit(d => { const s = findSec(t.dataset.sec); s.visible = s.visible === false; }, 'editor');
      return;
    }
    if (act === 'pickPhoto') { pickPhoto(); return; }
    if (act === 'clearPhoto') { Store.commit(d => { d.basics.photo = ''; }, 'editor'); return; }

    if (act === 'addContact') {
      Store.commit(d => { d.basics.contacts.push({ k: '', v: '' }); }, 'editor'); return;
    }
    if (act === 'delContact') {
      Store.commit(d => { d.basics.contacts.splice(+t.dataset.i, 1); }, 'editor'); return;
    }
    if (act === 'addSec') {
      const type = t.dataset.type;
      Store.commit(d => {
        d.sections.push({
          id: Store.uid('sec'), type, title: SECTION_TYPES[type].label,
          en: '', icon: SECTION_TYPES[type].icon, visible: true, items: []
        });
      }, 'editor');
      return;
    }
    if (act === 'delSec') {
      Store.commit(d => { d.sections = d.sections.filter(s => s.id !== t.dataset.sec); }, 'editor'); return;
    }
    if (act === 'upSec' || act === 'downSec') {
      const dir = act === 'upSec' ? -1 : 1;
      Store.commit(d => {
        const i = d.sections.findIndex(s => s.id === t.dataset.sec);
        move(d.sections, i, i + dir);
      }, 'editor');
      return;
    }
    if (act === 'addItem') {
      Store.commit(d => {
        const s = findSec(t.dataset.sec);
        s.items = s.items || [];
        s.items.push({ id: Store.uid('i'), bullets: [] });
      }, 'editor');
      return;
    }
    if (act === 'delItem') {
      Store.commit(d => {
        const s = findSec(t.dataset.sec);
        const i = s.items.findIndex(x => x.id === t.dataset.item);
        if (i > -1) s.items.splice(i, 1);
      }, 'editor');
      return;
    }
    if (act === 'dupItem') {
      Store.commit(d => {
        const s = findSec(t.dataset.sec);
        const i = s.items.findIndex(x => x.id === t.dataset.item);
        const copy = JSON.parse(JSON.stringify(s.items[i]));
        copy.id = Store.uid('i');
        s.items.splice(i + 1, 0, copy);
      }, 'editor');
      return;
    }
    if (act === 'upItem' || act === 'downItem') {
      const dir = act === 'upItem' ? -1 : 1;
      Store.commit(d => {
        const s = findSec(t.dataset.sec);
        move(s.items, s.items.findIndex(x => x.id === t.dataset.item),
          s.items.findIndex(x => x.id === t.dataset.item) + dir);
      }, 'editor');
      return;
    }
    if (act === 'addBullet') {
      Store.commit(d => {
        const it = findItem(findSec(t.dataset.sec), t.dataset.item);
        it[t.dataset.k] = it[t.dataset.k] || [];
        it[t.dataset.k].push('');
      }, 'editor');
      return;
    }
    if (act === 'delBullet') {
      Store.commit(d => {
        const it = findItem(findSec(t.dataset.sec), t.dataset.item);
        it[t.dataset.k].splice(+t.dataset.i, 1);
      }, 'editor');
      return;
    }
  }

  function handleInput(e) {
    const el = e.target;

    // basics 字段
    if (el.dataset.bb) {
      const k = el.dataset.bb;
      clearTimeout(el._t);
      el._t = setTimeout(() => Store.commit(d => { d.basics[k] = el.value; }, 'editor'), 260);
      return;
    }
    if (el.dataset.bk) {
      const i = +el.dataset.bi, k = el.dataset.bk;
      clearTimeout(el._t);
      el._t = setTimeout(() => Store.commit(d => { d.basics.contacts[i][k] = el.value; }, 'editor'), 260);
      return;
    }
    // 章节条目字段
    if (el.dataset.item && el.dataset.k) {
      const secId = el.dataset.sec, itemId = el.dataset.item, k = el.dataset.k;
      if (k.endsWith('__b')) {
        const arr = k.slice(0, -3), idx = +el.dataset.i;
        clearTimeout(el._t);
        el._t = setTimeout(() => Store.commit(d => {
          const it = findItem(findSec(secId), itemId);
          it[arr][idx] = el.value;
        }, 'editor'), 260);
      } else {
        const isRange = el.type === 'range';
        const out = el.closest('.ed-field')?.querySelector('output');
        if (out) out.textContent = (k === 'level') ? (el.value === '0' ? '不显示' : el.value) : el.value;
        clearTimeout(el._t);
        el._t = setTimeout(() => Store.commit(d => {
          const it = findItem(findSec(secId), itemId);
          it[k] = isRange ? +el.value : el.value;
        }, 'editor'), isRange ? 0 : 260);
      }
    }
  }

  /* 折叠时同步摘要标题（不重绘整页，避免打断输入） */
  function refreshTitles() {
    document.querySelectorAll('[data-itemwrap]').forEach(wrap => {
      const id = wrap.dataset.itemwrap;
      let found = null;
      Store.doc.sections.forEach(s => (s.items || []).forEach(i => { if (i.id === id) found = { i, s }; }));
      if (!found) return;
      const titleEl = wrap.querySelector('.ed-item__title');
      if (!titleEl) return;
      const label = nz(found.i.org) || nz(found.i.title) || '条目';
      const sub = nz(found.i.title) && nz(found.i.org) ? `<em> · ${esc(found.i.title)}</em>` : '';
      titleEl.innerHTML = esc(label) + sub;
    });
  }

  function pickPhoto() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => Store.commit(d => { d.basics.photo = r.result; }, 'editor');
      r.readAsDataURL(f);
    };
    inp.click();
  }

  function bind() {
    root.addEventListener('click', handleClick);
    root.addEventListener('input', handleInput);
    root.addEventListener('keydown', e => {
      const t = e.target.closest('[data-act="toggleItem"]');
      if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(t.dataset.id); }
    });
  }

  return { init, render, bind, refreshTitles, pickPhoto };
})();
