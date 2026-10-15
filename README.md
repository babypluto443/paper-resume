# 纸样 Resume · 在线简历生成器

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![零依赖](https://img.shields.io/badge/dependencies-0-808080?label=dependencies)](https://github.com/babypluto443/paper-resume)
[![纯前端](https://img.shields.io/badge/backend-none-4F94C4?label=backend)](https://github.com/babypluto443/paper-resume)

一个纯前端、零依赖、数据不出浏览器的在线简历生成器。左侧编辑、右侧 A4 实时预览，支持字体/字号/行距/页边距/配色等全量排版自定义，一键导出 PDF。

## 运行

```bash
git clone https://github.com/babypluto443/paper-resume.git
cd paper-resume
python3 -m http.server 8899
# 打开 http://localhost:8899
```

直接双击 `index.html` 也能打开（Google Fonts 需联网，其余完全离线）。没有构建步骤，改完源码刷新即可。

## 从三个参考项目吸收了什么

| 参考项目 | 它的优点 | 本项目的取舍 |
|---|---|---|
| **billryan/resume**<br>**hijiangtao/resume** | 优雅克制的 LaTeX 单栏，居中姓名 + 细分隔线，章节标题配下划线，中文排版干净 | 做成 `雅致单栏` 模板。但 LaTeX 要求用户装 TeX 环境、命令门槛高，所以换成表单 + 实时预览，所见即所得 |
| **OpenCurVe Resume** | 样式全部集中在 `.sty`，模块拆到 `sections/` 可插拔；公司 Banner 用品牌色竖条 + 浅色底 + 圆角，视觉分层清晰 | 样式全部走 CSS 变量，模块用 schema 元定义描述可插拔；`品牌分栏` 模板复刻了 Banner 机制，并把"品牌色"做成全局主色，任意公司都能统一 |
| **Reactive-Resume** | 结构化文档 + 实时 PDF 预览 + 18 模板 + ATS 文本视图 + 导出 PDF/DOCX/MD/JSON | 采纳它的文档模型、撤销栈、ATS 视图和多格式导出。放弃后端与账号体系——简历是敏感数据，纯前端更安全 |

额外参考：Deedy-Resume 的双栏结构 → `深色侧栏` 模板；jsonresume 的数据规范思路 → JSON 导出格式。

## 功能

**内容编辑**
- 7 种模块：教育、实习/工作、项目、技能、荣誉、自定义文本、链接
- 每个模块可增删条目、上下移动、复制、显示/隐藏
- 模块本身可排序（改变简历里的章节顺序）
- 条目可任意增删，要点逐条添加（换行即新条）
- 照片支持本地图片上传（转 base64 内嵌，不外传）
- 内联标记：`**粗体**` `*斜体*` `` `代码` `` `[文字](链接)`，裸网址自动识别

**排版定制（全部实时生效）**

| 维度 | 可调范围 |
|---|---|
| 模板版式 | 雅致单栏 / 品牌分栏 / 深色侧栏 / 极简留白 |
| 配色 | 7 套预设 + 任意自定义主色 |
| 中文字体 | 思源黑体、思源宋体、苹方、微软雅黑、宋体、楷体、仿宋 |
| 西文字体 | Archivo、Times New Roman、Helvetica、Georgia、IBM Plex Mono、Playfair Display |
| 正文字号 | 8–14 pt |
| 行距 | 1.10–2.00 |
| 姓名字号 | 18–40 pt |
| 章节标题字号 | 10–20 pt |
| 模块间距 | 4–28 pt |
| 页边距 | 6–28 mm |
| 内容密度 | 70%–140% |
| 纸张 | A4 / US Letter |
| 项目符号 | 圆点 / 短横线 / 数字编号 / 无 |
| 姓名区对齐 | 居左 / 居中 / 左右分栏 |

**导出**
- **PDF** — 浏览器打印管线，文字是矢量可选中可复制，ATS 能解析（不是截图）
- **HTML** — 单文件、样式内联、离线可开
- **Markdown** — 纯文本，便于放 Git 做版本管理
- **JSON** — 完整数据 + 样式，可再次导入继续编辑
- **ATS 文本视图** — 一键查看招聘系统实际能读到的纯文本，用于对照 JD 查关键词

**其他**
- 60 步撤销/重做（⌘Z / ⇧⌘Z）
- 自动保存到 localStorage，关掉页面不丢
- 页数实时提示：单页显示绿色，多页显示黄色提醒
- 快捷键：⌘P 打印、⌘S 保存 JSON
- 响应式：≤1024px 切换为底部标签栏布局

## 技术说明

### 分页引擎

浏览器 CSS 没有真正的"排版分页"能力（`columns` 只能近似）。所以 `render.js` 采取**测量 → 装箱**：

1. 建一个离屏 `.paper.is-measure` 容器，宽度与纸张内容区完全一致，注入同一套 CSS 变量
2. 把所有顶层块（头部 + 各章节）作为 flex 子元素渲染进去 —— flex 会阻止外边距合并，因此 `offsetHeight + margin` 就是真实占位
3. 贪心装箱：累加 advance 高度，超过可用高度就换新页

双栏模板（`sidebar`）则左右两栏各自独立装箱，再按页配对。

### 状态管理

`store.js` 是单一数据源：订阅制 + 60 步撤销栈 + localStorage 持久化。
`commit(mutator)` 把 `(doc, style)` 传给 mutator 直接改，改完广播；所有视图（编辑器、预览、样式面板）都只订阅这一个入口。

### 表单自动生成

`schema.js` 里每个字段用元数据描述（label / 类型 / 宽度 / placeholder），
`editor.js` 据此生成表单。**新增一个字段只需在 schema 加一行**，表单、校验、预览渲染、导出格式自动跟上。

## 文件结构

```
paper-resume/
├── index.html              # 三栏骨架
├── styles/
│   ├── tokens.css          # 设计令牌（界面配色、字阶、间距、动效）
│   ├── components.css      # 界面组件
│   └── paper.css           # 纸张排版引擎 + 四套模板差异
└── scripts/
    ├── schema.js           # 数据模型、字段元定义、示例数据
    ├── store.js            # 状态中心、撤销栈、本地持久化
    ├── render.js           # 纸张渲染 + A4 分页引擎
    ├── editor.js           # 表单编辑器（元定义驱动）
    ├── stylepanel.js       # 样式面板
    ├── exporters.js        # PDF/HTML/MD/JSON/ATS 导出
    └── main.js             # 预览控制器与全局装配
```

## 开发提示

分页依赖真实渲染高度，如果改动影响排版，务必在浏览器里确认：

1. 页数徽标是否合理（单页绿 / 多页黄）
2. 切换四种模板后是否都能正常分页
3. `#measureHost` 里不应残留任何 `.p-sec`（离屏测量容器测完会清空，
   若你改动了 `render.js` 的 `measure()`，注意保留 `ruler.innerHTML = ''`）

新增排版维度：改 `schema.js` 的 `DEFAULT_STYLE` 加字段，
`stylepanel.js` 加控件，`paper.css` 用新变量消费，三处各一行即可。

## 隐私

没有任何后端。数据只存在浏览器 localStorage，导出的文件在你自己的磁盘上。
清浏览器数据会丢简历，重要版本建议用「保存 JSON」留档。

## License

MIT
