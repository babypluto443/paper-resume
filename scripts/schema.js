/* ==========================================================================
   schema.js —— 数据模型 + 字段元定义 + 示例数据
   设计原则：
   1. 数据与视图彻底分离（借鉴 Reactive-Resume 的文档模型 + jsonresume 规范）
   2. 每个可编辑字段都用「元定义」描述，编辑器由元定义自动生成，新增字段不用改 UI
   3. 全文内联标记：**粗体** / *斜体* / `代码` / [链接](url)，渲染时解析
   ========================================================================== */

const FONTS_CN = [
  { v: "'Noto Sans SC'", label: '思源黑体（黑体，ATS 安全）' },
  { v: "'Noto Serif SC'", label: '思源宋体（宋体，学术感）' },
  { v: "'Songti SC'", label: '宋体-简（macOS 系统）' },
  { v: "'PingFang SC'", label: '苹方（macOS 系统黑体）' },
  { v: "'Microsoft YaHei'", label: '微软雅黑（Windows）' },
  { v: "'Kaiti SC'", label: '楷体-简' },
  { v: "'STFangsong'", label: '仿宋' }
];

const FONTS_EN = [
  { v: "'Archivo'", label: 'Archivo（几何无衬线）' },
  { v: "'Times New Roman'", label: 'Times New Roman（LaTeX 风）' },
  { v: "'Helvetica Neue'", label: 'Helvetica（瑞士风）' },
  { v: "'Georgia'", label: 'Georgia（屏幕衬线）' },
  { v: "'IBM Plex Mono'", label: 'IBM Plex Mono（等宽技术风）' },
  { v: "'Playfair Display'", label: 'Playfair Display（高对比衬线）' }
];

const TEMPLATES = [
  { v: 'classic', name: '雅致单栏', desc: '致敬 billryan / hijiangtao 的 LaTeX 单栏' },
  { v: 'curve', name: '品牌分栏', desc: '致敬 OpenCurVe：公司 Banner + 主色粗线' },
  { v: 'sidebar', name: '深色侧栏', desc: '致敬 Deedy-Resume：左技能右经历' },
  { v: 'minimal', name: '极简留白', desc: '极致克制，只有排版没有装饰' }
];

const THEMES = [
  { name: '藏蓝', accent: '#173a86' },
  { name: '朱砂', accent: '#c0392b' },
  { name: '石墨', accent: '#333333' },
  { name: '松绿', accent: '#1f6f5c' },
  { name: '紫罗兰', accent: '#5b4b8a' },
  { name: '橙金', accent: '#b5651d' },
  { name: '青碧', accent: '#12708f' }
];

/* ---------------- 默认样式（全部排版意图都以变量的形式被暴露） ---------------- */
const DEFAULT_STYLE = {
  template: 'classic',
  accent: '#173a86',
  themeName: '藏蓝',
  fontCn: "'Noto Sans SC'",
  fontEn: "'Archivo'",
  weight: '400',
  base: 10,          // pt
  line: 1.38,
  nameSize: 25,      // pt
  sectionSize: 12.5, // pt
  paper: 'A4',
  margin: 13,        // mm
  gap: 9,            // pt
  density: 100,      // %
  align: 'center',   // classic 固定居中，其余可选 left / center / split
  photo: true,
  icon: true,
  rule: true,
  bullets: 'dot',    // dot | dash | num | plain
  dateRight: true,
  compact: false,
  ats: false
};

const DEFAULT_BULLET_STYLE = 'dot';

/* ---------------- 模块（section）元定义 ----------------
   kind: 渲染器决定用哪个 item 渲染函数
   side: 是否默认进侧栏（sidebar 模板生效）
------------------------------------------------------------------- */
const SECTION_TYPES = {
  education: { label: '教育经历', abbr: '学历', side: false, kind: 'education',
    fields: [
      { k: 'org', label: '学校 / 机构', w: 'full', req: true, ph: '某某大学' },
      { k: 'title', label: '专业 / 学位', w: 'full', ph: '计算机科学与技术 · 工学学士' },
      { k: 'date', label: '起止时间', w: 'full', ph: '2019.09 - 2023.06' },
      { k: 'meta', label: '补充（GPA / 排名 / 荣誉）', w: 'full', ph: 'GPA 3.8/4.0 · 专业前 5%' },
      { k: 'bullets', label: '要点（每行一条）', w: 'full', type: 'bullets' }
    ] },
  experience: { label: '实习 / 工作经历', abbr: '经历', side: false, kind: 'experience',
    fields: [
      { k: 'org', label: '公司 / 团队', w: 'full', req: true, ph: '某某科技有限公司' },
      { k: 'title', label: '职位', w: 'full', ph: '后端开发实习生' },
      { k: 'date', label: '起止时间', w: 'full', ph: '2024.07 - 2024.10' },
      { k: 'meta', label: '技术栈（用 / 分隔）', w: 'full', ph: 'Go / Gin / GORM / MySQL / Redis' },
      { k: 'bullets', label: '要点（每行一条，建议量化成果）', w: 'full', type: 'bullets' }
    ] },
  project: { label: '项目经历', abbr: '项目', side: false, kind: 'project',
    fields: [
      { k: 'title', label: '项目名称', w: 'full', req: true, ph: '类小红书 Feed 系统' },
      { k: 'org', label: '角色 / 归属', w: 'full', ph: '个人项目 · 负责后端全流程' },
      { k: 'date', label: '起止时间', w: 'full', ph: '2025.03 - 2025.08' },
      { k: 'meta', label: '技术栈 / 亮点标签', w: 'full', ph: 'Go · 游标分页 · Redis 缓存' },
      { k: 'link', label: '链接（可选）', w: 'full', ph: 'https://github.com/xxx/yyy' },
      { k: 'bullets', label: '要点（每行一条）', w: 'full', type: 'bullets' }
    ] },
  skill: { label: '专业技能', abbr: '技能', side: true, kind: 'skill',
    fields: [
      { k: 'title', label: '技能分类', w: 'full', req: true, ph: '后端语言' },
      { k: 'bullets', label: '具体条目（每行一条）', w: 'full', type: 'bullets' },
      { k: 'level', label: '熟练度条（0-100，留空则不显示；仅 sidebar 模板可见）', w: 'full', type: 'level' }
    ] },
  honor: { label: '荣誉奖项', abbr: '荣誉', side: true, kind: 'honor',
    fields: [
      { k: 'title', label: '奖项名称', w: 'full', req: true, ph: '国家奖学金' },
      { k: 'org', label: '颁发方', w: 'full', ph: '教育部' },
      { k: 'date', label: '时间', w: 'full', ph: '2023.10' }
    ] },
  text: { label: '自定义文本块', abbr: '自述', side: false, kind: 'text',
    fields: [
      { k: 'title', label: '块标题', w: 'full', ph: '自我评价' },
      { k: 'body', label: '正文（支持 **粗体** *斜体* `代码` [链接](url)）', w: 'full', type: 'textarea' }
    ] },
  link: { label: '链接 / 作品集', abbr: '链接', side: true, kind: 'link',
    fields: [
      { k: 'title', label: '标题', w: 'full', ph: 'GitHub' },
      { k: 'link', label: '地址', w: 'full', ph: 'https://github.com/xxx' },
      { k: 'meta', label: '说明', w: 'full', ph: '后端方向的几个小项目' }
    ] }
};

const DEFAULT_SECTION_ORDER = ['education', 'experience', 'project', 'skill', 'honor', 'text', 'link'];

/* ---------------- 示例数据：一份可直接参考的 Go 后端简历骨架 ---------------- */
function sampleDoc() {
  return {
    basics: {
      name: '张三',
      headline: '后端开发实习生 · Go / 微服务方向',
      photo: '',
      contacts: [
        { k: '手机', v: '138-0000-0000' },
        { k: '邮箱', v: 'zhangsan@example.com', href: 'mailto:zhangsan@example.com' },
        { k: 'GitHub', v: 'github.com/zhangsan', href: 'https://github.com/zhangsan' },
        { k: '城市', v: '杭州' }
      ],
      summary: '计算机科学与技术专业本科在读，熟悉 Go、Gin、GORM、MySQL、Redis。独立完成过类社交 Feed 系统的后端从 0 到 1 实现，习惯用 EXPLAIN 和压测数据验证设计，而不是凭感觉调优。'
    },
    sections: [
      {
        id: 'sec_edu', type: 'education', title: '教育经历', en: 'Education', abbr: '学历', visible: true,
        items: [
          { id: 'i1', org: '某某大学', title: '计算机科学与技术 · 工学学士', date: '2019.09 - 2023.06',
            meta: 'GPA 3.82/4.0（专业前 5%）· 校级一等奖学金 ×2',
            bullets: ['主修：数据结构、操作系统、计算机网络、数据库原理、分布式系统'] }
        ]
      },
      {
        id: 'sec_exp', type: 'experience', title: '实习经历', en: 'Experience', abbr: '经历', visible: true,
        items: [
          { id: 'i1', org: '某某科技有限公司', title: '后端开发实习生', date: '2024.07 - 2024.10',
            meta: 'Go / Gin / GORM / MySQL / Redis / RocketMQ',
            bullets: [
              '负责用户与内容模块的接口开发，共 42 个接口，全部通过自测用例',
              '把推荐流接口 P99 从 **380ms 降到 90ms**，做法是游标分页 + Redis 缓存热点数据',
              '排查并修复一处因未加互斥锁导致的数据竞争问题，用 `go build -race` 定位'
            ] }
        ]
      },
      {
        id: 'sec_proj', type: 'project', title: '项目经历', en: 'Projects', abbr: '项目', visible: true,
        items: [
          { id: 'i1', title: '类小红书 Feed 系统（个人项目）', org: '独立开发 · 负责后端全流程', date: '2025.03 - 2025.08',
            meta: 'Go · Gin · GORM · MySQL 8.0 · Redis · Docker',
            link: 'https://github.com/zhangsan/feed',
            bullets: [
              '按 handler / service / repository 三层拆分，接口逻辑与存储逻辑解耦',
              '自研游标分页（`idx_user_time` 复合索引），深翻 500 页无重复无遗漏',
              '用 Docker Compose 搭建独立开发环境，避免污染本地其他项目'
            ] }
        ]
      },
      {
        id: 'sec_skill', type: 'skill', title: '专业技能', en: 'Skills', abbr: '技能', visible: true,
        items: [
          { id: 'i1', title: '后端语言', level: 85, bullets: ['Go（主力，能读标准库源码）', 'Python（能写脚本与小服务）'] },
          { id: 'i2', title: '框架与存储', level: 80, bullets: ['Gin / GORM', 'MySQL（索引与事务优化）', 'Redis / RabbitMQ'] },
          { id: 'i3', title: '工程与工具', level: 75, bullets: ['Docker / Git / Linux / GoLand', '正在补：Kubernetes、分布式一致性'] }
        ]
      },
      {
        id: 'sec_honor', type: 'honor', title: '荣誉奖项', en: 'Honors', abbr: '荣誉', visible: true,
        items: [
          { id: 'i1', title: '国家励志奖学金', org: '教育部', date: '2022.10' }
        ]
      },
      {
        id: 'sec_self', type: 'text', title: '自我评价', en: 'Summary', abbr: '自述', visible: true,
        items: [
          { id: 'i1', title: '', body: '写代码先想清楚再动手：习惯先用 `EXPLAIN` 验证索引假设，再用压测看真实数据，而不是凭感觉调优。对不确定的地方会先做最小可验证实验，验证完再往下推进。' }
        ]
      },
      {
        id: 'sec_link', type: 'link', title: '作品集', en: 'Links', abbr: '链接', visible: false,
        items: [
          { id: 'i1', title: 'GitHub', link: 'https://github.com/zhangsan', meta: '后端小项目集合' },
          { id: 'i2', title: '博客', link: 'https://zhangsan.dev', meta: '学习笔记' }
        ]
      }
    ]
  };
}
