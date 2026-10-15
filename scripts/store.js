/* ==========================================================================
   store.js —— 状态中心：单一数据源 + 订阅 + 撤销栈 + 本地持久化
   设计取舍（对比三个参考项目）：
   · billryan/hijiangtao：数据即 TeX 源码，人改命令、AI 改文本，但**没有结构化校验**
   · OpenCurve：把样式集中到 .sty，模块拆到 sections/ —— 借鉴它的「样式集中 + 模块可插拔」
   · Reactive-Resume：结构化文档 + 富文本 + 版本历史 —— 借鉴它的文档模型与撤销栈
   本项目取三者交集：结构化数据（可校验）+ 样式变量集中 + 撤销栈 + 本地自动保存
   ========================================================================== */

const Store = (() => {
  const KEY = 'paper-resume:v1';

  let doc = sampleDoc();
  let style = { ...DEFAULT_STYLE };
  let past = [];
  let future = [];
  let dirty = false;
  const listeners = new Set();
  let saveTimer = null;

  /* ---------- 订阅 ---------- */
  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function emit(reason) { listeners.forEach(fn => fn(reason)); }

  /* ---------- 撤销 / 重做 ---------- */
  function snapshot() {
    return JSON.stringify({ doc, style });
  }
  function pushHistory() {
    past.push(snapshot());
    if (past.length > 60) past.shift();
    future.length = 0;
  }
  /** 内容变更：先存历史再改。mutator 收到 (doc, style) 两个可变引用 */
  function commit(mutator, reason = 'commit') {
    pushHistory();
    mutator(doc, style);
    scheduleSave();
    emit(reason);
  }
  /** 样式变更同样可撤销 */
  function commitStyle(mutator) {
    pushHistory();
    mutator(style, doc);
    scheduleSave();
    emit('style');
  }
  function undo() {
    if (!past.length) return false;
    future.push(snapshot());
    const s = JSON.parse(past.pop());
    doc = s.doc; style = s.style;
    scheduleSave(); emit('undo');
    return true;
  }
  function redo() {
    if (!future.length) return false;
    past.push(snapshot());
    const s = JSON.parse(future.pop());
    doc = s.doc; style = s.style;
    scheduleSave(); emit('redo');
    return true;
  }
  const canUndo = () => past.length > 0;
  const canRedo = () => future.length > 0;

  /* ---------- 本地持久化（数据不出浏览器） ---------- */
  function scheduleSave() {
    dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 400);
  }
  function saveNow() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ doc, style, t: Date.now() }));
      dirty = false;
      emit('saved');
    } catch (e) {
      console.warn('本地保存失败', e);
    }
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (!d || !d.doc) return false;
      doc = migrate(d.doc);
      style = { ...DEFAULT_STYLE, ...(d.style || {}) };
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ---------- 兼容与兜底：任何残缺数据都能补齐 ---------- */
  function migrate(d) {
    const base = sampleDoc();
    const out = {
      basics: {
        name: '', headline: '', photo: '', summary: '',
        contacts: [],
        ...(d.basics || {})
      },
      sections: Array.isArray(d.sections) ? d.sections : base.sections
    };
    out.basics.contacts = (out.basics.contacts || []).filter(c => c && (c.v || c.k));
    out.sections = out.sections.filter(s => s && s.type && SECTION_TYPES[s.type]);
    out.sections.forEach(s => {
      s.id = s.id || uid('sec');
      s.title = s.title || SECTION_TYPES[s.type].label;
      s.visible = s.visible !== false;
      s.items = Array.isArray(s.items) ? s.items : [];
      s.items.forEach(it => { it.id = it.id || uid('i'); it.bullets = it.bullets || []; });
    });
    return out;
  }

  function resetAll() {
    pushHistory();
    doc = sampleDoc();
    style = { ...DEFAULT_STYLE };
    saveNow();
    emit('reset');
  }
  function resetStyle() {
    pushHistory();
    style = { ...DEFAULT_STYLE };
    saveNow();
    emit('style');
  }
  function replaceDoc(newDoc, newStyle) {
    pushHistory();
    doc = migrate(newDoc);
    if (newStyle) style = { ...DEFAULT_STYLE, ...newStyle };
    saveNow();
    emit('replace');
  }

  function uid(p = 'id') {
    return p + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
  }

  return {
    get doc() { return doc; },
    get style() { return style; },
    get dirty() { return dirty; },
    subscribe, commit, commitStyle, undo, redo, canUndo, canRedo,
    saveNow, load, resetAll, resetStyle, replaceDoc, uid
  };
})();
