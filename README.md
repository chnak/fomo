# fomo — 视频创建器

基于 [fkbuilder](https://www.npmjs.com/package/fkbuilder) + MiniMax TTS 的链式视频构建工具。使用纯 JavaScript 描述视频结构，自动处理字幕配音、多场景排布和时长计算。

---

## 目录

- [快速开始](#快速开始)
- [安装](#安装)
- [核心概念](#核心概念)
- [API 参考](#api-reference)
  - [构造函数](#creator-options)
  - [addCover()](#addcoveroptions)
  - [addSlide()](#addslideoptions)
  - [addFooter()](#addfooteroptions)
  - [render()](#rendertarget-options)
  - [getTimeline()](#gettimeline)
  - [getTimelineSync()](#gettimelinesyncoptions)
  - [printTimeline() / printTimelineAsync()](#printtimeline--printtimelineasyncoptions)
- [时间线与时长](#时间线与时长)
- [TTS 字幕配置](#tts-字幕配置)
- [元素类型](#元素类型)
- [示例](#示例)

---

## 快速开始

```bash
npm install
node examples/basic.js
```

输出：`output/basic.mp4`

---

## 安装

```bash
npm install
```

**依赖：**
- [fkbuilder](https://www.npmjs.com/package/fkbuilder) — 底层视频渲染引擎
- [minimax-speech-ts](https://www.npmjs.com/package/minimax-speech-ts) — MiniMax TTS 语音合成
- `ffmpeg` / `ffprobe` — 需要在系统 PATH 中可用（用于探测媒体时长）

**环境变量：**

```bash
# MiniMax API Key（TTS 功能必须）
export MINIMAX_API_KEY=your_api_key_here
```

---

## 核心概念

### 场景（Section）

视频由三类场景组成，顺序添加：

```
[Cover] → [Slide × N] → [Footer]
```

| 场景 | 说明 |
|------|------|
| `Cover` | 片头，标题 + 副标题 + 背景色 |
| `Slide` | 内容页，任意元素组合（文字、形状、图片、字幕…） |
| `Footer` | 片尾，致谢 + 关注引导 |

### 元素（Element）

每个场景包含一个 `elements` 数组，支持以下类型：

- `text` — 静态文字
- `subtitle` — 字幕（可开启 TTS 自动配音）
- `image` — 图片
- `rect` / `circle` / `svg` — 形状
- `video` / `audio` — 媒体文件

### 时长自动解析

元素 `duration` 的来源优先级：

```
用户显式指定
  → video/audio: ffprobe 探测
  → subtitle + tts: TTS 音频真实时长
  → 其它: DEFAULT_ELEMENT_DURATION (3秒) 兜底
```

### TTS 字幕

`subtitle` 元素设置 `tts: true` 后：
1. 自动调用 MiniMax TTS API 生成语音文件
2. 音频时长作为该字幕的播放时长（不是字数估算）
3. 字幕文字与语音同步（逐字高亮动画）

---

## API Reference

### `new Creator(options)`

```js
const creator = new Creator({
  width: 1920,           // 视频宽度，默认 1920
  height: 1080,          // 视频高度，默认 1080
  fps: 30,               // 帧率，默认 30
  tts: {                 // TTS 全局默认配置
    enabled: false,      // 全局是否启用 TTS
    voice: 'female-shaonv-jingpin', // 语音 ID
    rate: 0,             // 语速，-50 ~ +100（映射到 MiniMax 0.5x ~ 2.0x）
    volume: 100,         // 音量，0 ~ 100
    model: 'speech-2.8-hd',
    apiKey: null,        // 可在此传入 API Key，或通过 MINIMAX_API_KEY 环境变量
  },
  randomTransition: {    // 随机转场/动画配置
    enabled: false,       // 开启后，每个未显式指定 transition 的场景随机选择转场
    animations: false,    // 开启后，未指定 animations 的元素随机选择一个入场动画
  },
  backgroundMusic: {      // 背景音乐配置
    src: './music.mp3',   // 音频文件路径（支持 mp3/wav 等格式）
    volume: 80,           // 音量 0~100，默认 80
    fadeIn: 0.5,          // 入场淡入（秒），默认 0.5
    fadeOut: 0.5,         // 出场淡出（秒），默认 0.5
    loop: true,            // 音乐短于视频时是否循环拼接，默认 true
    startTime: 0,         // 背景音乐在视频的哪个时间点开始播放，默认 0
    endTime: null,        // 背景音乐在视频的哪个时间点结束播放，默认 null 表示播到视频结尾
  },
});
```

---

### `addCover(options)`

添加片头。

```js
creator.addCover({
  title: '欢迎观看',                    // 主标题
  subtitle: '2025 年度总结',            // 副标题
  background: '#1a1a2e',               // 背景色（无 image 时生效）
  duration: 3,                         // 片头时长（秒），默认 3
  transition: 'fade',                   // 转场名称，传 null 禁用；未指定时由 randomTransition.enabled 决定
  titleStyle: { fontSize: 72, color: '#ffe66d' },  // 主标题样式覆盖
  subtitleStyle: { fontSize: 36, color: '#ffffff' }, // 副标题样式覆盖
  image: {                             // 图片背景（覆盖 background）
    src: './images/cover.jpg',         // 图片路径
    fit: 'cover',                      // 填充方式：'cover' | 'contain' | 'fill'
  },
});
```

> **随机转场说明：** 当 `new Creator({ randomTransition: { enabled: true } })` 时，所有未显式指定 `transition` 的场景（cover/slide/footer）自动从 100+ 种预设转场中随机选取一个。显式指定 `transition` 的场景不受影响。

---

### `addSlide(options)`

添加内容页，可调用多次。


```js
creator.addSlide({
  background: '#16213e',               // 背景色
  duration: 6,                          // 页面时长（秒），默认自动汇总
  transition: 'CrossZoom',             // 转场名称，传 null 禁用；未指定时由 randomTransition.enabled 决定
  elements: [                          // 元素数组，见下表
    { type: 'text', text: '第一页', x: '50%', y: '18%', fontSize: 64, color: '#ffe66d', anchor: [0.5, 0.5], animations: ['fadeIn'] },
    {
      type: 'subtitle',
      tts: true,                       // 开启 TTS 配音
      text: '这是一段会自动朗读的字幕文本',
      position: 'bottom',              // 预设位置：'top' | 'center' | 'bottom'
      x: '50%', y: '85%',
      fontSize: 44,
      color: '#ffd700',
      fontFamily: '微软雅黑',
      textAlign: 'center',
      split: 'letter',                // 逐字动画：'letter' | 'word'
      splitDelay: 0.08,
      splitDuration: 0.4,
      animations: ['fadeIn'],
      // 也可单独覆盖 TTS 配置
      // tts: { voice: 'male-qn-qingse', rate: -2 },
    },
  ],
});
```

---

### `addFooter(options)`

添加片尾。

```js
creator.addFooter({
  title: '谢谢观看',                    // 主标题
  subtitle: '请点赞、关注、转发',        // 副标题
  background: '#000000',               // 背景色（无 image 时生效）
  duration: 3,                         // 片尾时长（秒），默认 3
  image: {                             // 图片背景（覆盖 background）
    src: './images/footer.jpg',        // 图片路径
    fit: 'cover',                      // 填充方式：'cover' | 'contain' | 'fill'
  },
});
```

---

### `render(target, options)`

渲染并导出视频文件。

```js
await creator.render('./output/video.mp4', {
  parallel: false,   // 是否并行渲染场景，默认 false
  usePipe: true,    // 使用管道模式（减少临时文件），默认 true
  maxWorkers: 4,    // 最大并行数，默认 4
  // keepTtsAudio: true, // 调试用：保留临时音频文件
});
```

> **注意：** `render()` 调用一次后会标记已渲染，再次调用会直接返回已构建的实例。若要重新渲染，请新建 `Creator` 实例。

---

### `getTimeline()`

异步预览时间线（**不调 TTS API**，只调用 ffprobe 探测真实媒体时长，TTS 字幕用字数估算）。

```js
const timeline = await creator.getTimeline();
console.log(timeline.totalDuration);   // 视频总时长（秒）
console.log(timeline.sectionCount);    // 场景数量
console.log(timeline.elementCount);    // 元素总数量
timeline.sections.forEach(sec => {
  console.log(`[${sec.kind}] ${sec.startTime}s → ${sec.endTime}s`);
  sec.elements.forEach(el => {
    console.log(`  ${el.type}: ${el.startTime}s → ${el.endTime}s [${el.source}]`);
    // source: 'user' | 'probe' | 'estimate' | 'default'
  });
});
```

**返回结构：**
```js
{
  totalDuration: 24.83,          // 总时长（秒）
  sectionCount: 4,               // 场景数量
  elementCount: 5,              // 元素总数量
  ttsConfig: { enabled, voice, rate, volume },
  sections: [
    {
      kind: 'cover' | 'slide' | 'footer',
      index: 0,
      startTime: 0,
      duration: 3,
      endTime: 3,
      background: '#1a1a2e',
      title: '片头标题',
      subtitle: '副标题',
      elementCount: 0,
      elements: [
        {
          type: 'subtitle',
          startTime: 5,
          endTime: 10.83,
          duration: 5.83,
          source: 'estimate',      // 时长来源
          autoPlaced: true,       // 是否自动排列
          text: '字幕内容...',
          tts: true,
        }
      ]
    }
  ]
}
```

---

### `getTimelineSync(options?)`

同步快速预览（**不调 ffprobe，不调 TTS API**，所有未指定 `duration` 的元素统一用 `defaultDuration` 兜底）。

```js
const t = creator.getTimelineSync({ defaultDuration: 4 });
console.log(t.totalDuration);
```

---

### `printTimeline()` / `printTimelineAsync(options?)`

控制台可视化打印时间线。

```js
// 快速同步版
creator.printTimeline({ sync: true });

// 准确异步版
await creator.printTimelineAsync();
```

输出示例：
```
════════════════════════════════════════════════════════════════
  时间线预览  │  总时长: 18.92s  │  4 sections  │  4 elements
  TTS: voice=female-shaonv-jingpin  rate=0  volume=100
════════════════════════════════════════════════════════════════

[COVER] 0.00s → 3.00s  [█████░░░░░░░░░░░░░░░░░░░░░░░░░░░] | "片头标题"

[SLIDE[1]] 3.00s → 10.92s  [█████████████░░░░░░░░░░░░░░░░░░░]
    0.00s → 2.00s  dur=2.00s [user]  text       "显式B"
    2.00s → 5.00s  dur=3.00s (auto)  text       "自动排列A"
    5.00s → 7.92s  dur=2.92s [estimate] (auto) 🔊  subtitle "这是一段TTS..."

[FOOTER] 15.92s → 18.92s  [█████░░░░░░░░░░░░░░░░░░░░░░░░░░] | "谢谢观看"
```

---

## 时间线与时长

### 自动排列规则

多个元素没有指定 `startTime` 时，按声明顺序依次自动排列：

```
场景开始 → 元素A → 元素B → 元素C → ...
```

有 `startTime` 的元素与自动排列元素混合时：
- 自动排列元素从 `currentTime` 开始
- `currentTime` 随每个元素推进
- 若 `currentTime` 已超过某显式 `startTime`，则自动排列元素在显式元素**之后**依次排列

### 场景时长汇总

场景 `duration` 取以下两者的较大值：

```
max(用户显式指定的 duration, 所有元素的结束时间)
```

即：元素可以自动拉长场景，但不能让场景被截断。

### 时长 source 标签

| source | 含义 |
|--------|------|
| `user` | 用户显式指定 `duration` |
| `probe` | video/audio 元素，ffprobe 探测真实时长 |
| `estimate` | TTS 字幕，字数估算（不调 API） |
| `default` | 走 `DEFAULT_ELEMENT_DURATION`（3秒）兜底 |

---

## TTS 字幕配置

### 全局配置（构造函数）

```js
const creator = new Creator({
  tts: {
    enabled: true,                      // 默认关闭字幕 TTS
    voice: 'female-shaonv-jingpin',    // 语音 ID（见下方列表）
    rate: 0,                            // 语速 -50 ~ +100
    volume: 100,                        // 音量 0 ~ 100
  }
});
```

### 单个字幕覆盖

```js
{
  type: 'subtitle',
  tts: { voice: 'male-qn-qingse', rate: -5 },
  text: '单独配置的语音',
}
```

### 可用语音（MiniMax 系统语音）

| 语音 ID | 风格 |
|---------|------|
| `female-shaonv-jingpin` | 甜妹 — 温柔甜美 |
| `male-qn-qingse` | 云扬 — 知性大方 |
| `female-tianmei-jingpin` | 京哥 — 磁性低沉 |
| `clever_boy` | 少女 — 活泼可爱 |
| `lovely_girl` | 元宝 — 阳光活力 |

> 更多语音可通过 MiniMax 控制台获取。

### 字幕动画

```js
{
  type: 'subtitle',
  split: 'letter',          // 'letter' 逐字 / 'word' 逐词
  splitDelay: 0.08,          // 字符间隔（秒）
  splitDuration: 0.4,        // 字符动画时长（秒）
  animations: ['fadeIn'],    // 入场动画
}
```

---

## 元素类型

| type | 说明 | 关键属性 |
|------|------|----------|
| `text` | 静态文字 | `text`, `fontSize`, `color`, `fontFamily`, `x`, `y`, `anchor` |
| `subtitle` | 字幕（可 TTS） | `text`, `tts`, `position`, `fontSize`, `color`, `split` |
| `image` | 图片 | `src`, `x`, `y`, `width`, `height`, `anchor` |
| `rect` | 矩形 | `x`, `y`, `width`, `height`, `fillColor`, `borderRadius` |
| `circle` | 圆形 | `x`, `y`, `radius`, `fillColor` |
| `svg` | SVG | `svgContent`, `width`, `height` |
| `html` | 任意 HTML/CSS（Takumi 渲染） | `html`/`node`, `tailwind`, `emoji`, `fonts`, `keyframes` 等，详见 [HTML 元素](#html-元素) |
| `video` | 视频文件 | `src`（时长自动 ffprobe 探测） |
| `audio` | 音频文件 | `src`（时长自动 ffprobe 探测） |

### 通用属性

所有元素均支持：

```js
{
  duration: 5,          // 元素时长（秒），不指定则自动解析
  startTime: 2,          // 开始时间（秒），不指定则自动排列
  anchor: [0.5, 0.5],   // 锚点，默认 [0.5, 0.5]（元素中心）
  x: '50%',             // 横坐标，支持 px 和 %
  y: '50%',             // 纵坐标，支持 px 和 %
  animations: ['fadeIn', 'slideUp'], // 动画名称数组
}
```

---

## HTML 元素

`type: 'html'` 通过 fkbuilder 内置的 [Takumi](https://takumi.kane.tw/) 渲染器，把任意 HTML/CSS 渲染成视频帧。可以理解为"视频中的 Web 页面"。

### 基础用法

```js
creator.addSlide({
  background: '#1e1b4b',
  duration: 5,
  elements: [
    {
      type: 'html',
      x: '50%', y: '50%',
      width: 1000, height: 400,
      // 与 fkbuilder 其他元素保持一致：未指定 anchor 时默认 [0.5, 0.5]，即 (x, y) 是元素中心
      html: `
        <div style="width:100%;height:100%;display:flex;align-items:center;
                    justify-content:center;background:#312e81;border-radius:16px;
                    color:#fff;font-family:'Microsoft YaHei';font-weight:700;">
          <span style="font-size:48px;">任意 HTML · 任意样式</span>
        </div>
      `,
      duration: 5,
    },
  ],
});
```

### 完整示例

参见 [`examples/html-element-demo.js`](./examples/html-element-demo.js)，覆盖：
- 自定义 HTML/CSS
- Tailwind 零配置（`tailwind: true`）
- Emoji 彩色（`emoji: 'twemoji'`）
- 全屏 HTML（`anchor: [0, 0]`）
- 结构化 keyframes

运行：

```bash
node examples/html-element-demo.js
```

### 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `html` | `string` | - | HTML 字符串（与 `node` 二选一） |
| `node` | `object` | - | Takumi node tree 对象 |
| `x` | `number\|string` | `0` | X 坐标，支持 px 和 `%` |
| `y` | `number\|string` | `0` | Y 坐标，支持 px 和 `%` |
| `width` | `number\|string` | `800` | 元素宽度 |
| `height` | `number\|string` | `600` | 元素高度 |
| `anchor` | `[number, number]` | `[0.5, 0.5]` | 锚点；全屏 HTML 用 `[0, 0]`（见下方注意事项）|
| `opacity` | `number` | `1` | 透明度 0–1 |
| `rotation` | `number` | `0` | 旋转角度（度）|
| `duration` | `number` | `3` | 元素显示时长，未指定走 `DEFAULT_ELEMENT_DURATION`（3 秒）|
| `startTime` | `number` | `0` | 元素开始时间（秒）|
| `timeOffset` | `number` | `0` | CSS 动画起始偏移（秒）|
| `fonts` | `Array` | 自动中文字体栈 | 字体配置：URL / 系统路径 / Buffer |
| `stylesheets` | `Array<string>` | - | 外部样式表 URL 列表 |
| `keyframes` | `object \| array` | - | CSS 动画规则。**Bare / Rich 格式会自动生成 `@keyframes` 并挂上 `animation` 属性**；详见 [CSS 动画（keyframes）](#css-动画keyframes) |
| `devicePixelRatio` | `number` | - | 设备像素比 |
| `autoDefaultFont` | `boolean` | `true` | 未声明 `font-family` 时自动注入跨平台 CJK 字体栈 |
| `tailwind` | `boolean\|object` | `false` | 启用 Tailwind：`true` 用内置 158KB 通用 CSS；`{ input }` / `{ css }` 用自定义 |
| `emoji` | `boolean\|string` | `'twemoji'` | `'noto'` / `'openmoji'` 等，或 `false` 关闭 Twemoji |
| `animations` | `Array` | - | 入场 / 出场动画，可混用预设名与结构化对象 |

### 三大亮点

#### 1. 自动中文渲染（`autoDefaultFont`）

未在 HTML 中显式声明 `font-family` 时，fomo 会自动注入跨平台中文字体栈（Windows / macOS / Linux），开箱即可渲染中文。

```js
{ type: 'html', html: '<div style="font-size:48px;">直接写中文即可</div>' }
```

> 实测：中文字重请用 `400`（常规）或 `700`（粗体）。**避开 `800 / 900`**，会触发 fake-bold 合成，中文笔画会糊成一团。

#### 2. Emoji 彩色

HTML 里直接写 emoji 字符，会被自动替换为彩色 SVG（默认 Twemoji）：

```js
{
  type: 'html',
  html: `<div style="font-size:120px;text-align:center;">🚀 🎨 ⚡</div>`,
  emoji: 'twemoji',  // 也可 'noto' / 'openmoji' / 'blobmoji' / false
}
```

#### 3. Tailwind CSS

`tailwind: true` 直接启用 fkbuilder 内置的 158KB 通用 Tailwind，不需要安装 `tailwindcss` 也不调任何 CLI：

```js
{
  type: 'html',
  tailwind: true,
  html: `
    <div class="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-blue-600
                flex items-center justify-center p-12">
      <h1 class="text-7xl font-black text-white drop-shadow-lg">零配置 Tailwind</h1>
    </div>
  `,
}
```

如需自定义主题（`bg-brand` 等），自己预编译一份 CSS，传给 `tailwind: { input }` 或 `tailwind: { css }`。

### 注意事项

1. **全屏 HTML 用 `anchor: [0, 0]`**  
   fomo 默认锚点 `[0.5, 0.5]`（元素中心）。当 `width/height` 都是 `100%` 时，中心锚点会让 HTML 元素被往画布左上方各偏移 half-size，结果"画布左下空一块、右上溢出"。  
   ```js
   { type: 'html', width: '100%', height: '100%', anchor: [0, 0], html: '...' }
   ```
   当检测到全屏意图（`width/height` 都是 `100%` 且未指定 anchor）时，控制台会输出一次 warning 提醒。

2. **CSS 动画与时间轴同步**：HTML 内 `@keyframes` 通过 Takumi 每帧注入的 `timeMs` 驱动，自动与视频时间轴同步；可用 `timeOffset` 调整起点。

3. **时长自动解析**：未指定 `duration` 时回落到 `DEFAULT_ELEMENT_DURATION`（3 秒），不会触发 ffprobe 或 TTS。

4. **入场动画可混用**：HTML 元素同样支持 fomo 通用 `animations`，与原生 CSS `@keyframes` 互不冲突。

### CSS 动画（keyframes）

`keyframes` 选项支持四种写法，覆盖"全自动"到"完全手控"全光谱。**Bare / Rich 格式会自动给元素挂上 `animation` 属性**，开箱即用；只有少数需要精控的场景才用底层数组或全手控。

#### 推荐：Bare 格式（最少代码）

直接以 CSS 选择器作为 key，value 就是裸 keyframe 规则。默认值 `1s ease-in-out infinite 0s normal none` 自动应用：

```js
{
  type: 'html',
  tailwind: true,
  keyframes: {
    '.badge': {
      '0%':   { transform: 'translateY(0)' },
      '50%':  { transform: 'translateY(-30px)' },
      '100%': { transform: 'translateY(0)' },
    },
  },
  html: `<div class="badge ...">弹跳 Badge</div>`,
}
```

效果等同于自动注入：

```html
<style>
  .badge { animation: fk-anim-badge-0 1s ease-in-out infinite 0s normal none; }
  @keyframes fk-anim-badge-0 { ... }
</style>
```

#### 进阶：Rich 格式（自定义 timing + 多个动画）

每个 selector 下加 `duration` / `easing` / `iteration` / `delay` / `direction` / `fill` / `keyframes` 字段，并可一次声明多个独立动画：

```js
{
  type: 'html',
  tailwind: true,
  keyframes: {
    '.title':   { duration: '1.2s', easing: 'ease-out',   iteration: '1', fill: 'forwards',
                  keyframes: { '0%': {opacity: 0, transform: 'translateY(-40px)'},
                               '100%': {opacity: 1, transform: 'translateY(0)'} } },
    '.card':    { duration: '.6s',  easing: 'ease-in-out', iteration: 'infinite',
                  keyframes: { '0%, 100%': {transform: 'scale(1)'},
                               '50%':      {transform: 'scale(1.05)'} } },
    '.spinner': { duration: '1s',   iteration: 'infinite', easing: 'linear',
                  keyframes: { '0%': {transform: 'rotate(0deg)'},
                               '100%': {transform: 'rotate(360deg)'} } },
  },
  html: `
    <div class="w-full h-full flex flex-col items-center justify-center gap-6">
      <div class="spinner ..."></div>
      <h1 class="title ...">Rich 格式动画</h1>
      <div class="card ...">Pulse Card</div>
    </div>
  `,
}
```

#### 完全自控（手写全部 CSS）

如果你想完全掌控命名/keyframes 拼接逻辑，可以绕过 `keyframes` 选项，直接在 HTML 里写 `<style>`：

```js
{
  type: 'html',
  html: `
    <style>
      @keyframes myBounce { 0% { transform: translateY(0); } 50% { transform: translateY(-30px); } 100% { transform: translateY(0); } }
      .badge { animation: myBounce 1.2s ease-in-out infinite; }
    </style>
    <div class="badge">手控</div>
  `,
}
```

#### 底层：Takumi 原生数组（向后兼容）

直接传 `KeyframesRuleList`，命名与 `@keyframes` 拼接需自己负责：

```js
keyframes: [
  { name: 'spin', keyframes: [
    { offsets: [0],   declarations: { transform: 'rotate(0deg)' } },
    { offsets: [1],   declarations: { transform: 'rotate(360deg)' } },
  ]},
],
```

此时仍需在 HTML `<style>` 里手动写 `.elem { animation: spin ... }`。

---

## 背景音乐

背景音乐放置在独立的 `background-music` 轨道（zIndex: 1），与 TTS 音频轨道（zIndex: 0）分开，不会相互干扰。

### 配置方式

**方式一：构造函数传入**

```js
const creator = new Creator({
  backgroundMusic: {
    src: './bgm.mp3',     // 必填：音频文件路径
    volume: 80,            // 音量 0~100
    fadeIn: 0.5,           // 入场淡入（秒）
    fadeOut: 0.5,          // 出场淡出（秒）
    loop: true,            // 音乐短于视频时循环拼接
  }
});
```

**方式二：链式调用（可中途添加或替换）**

```js
// 完整写法
creator.setBackgroundMusic({ src: './bgm.mp3', volume: 70 });
// 简写别名（功能完全相同）
creator.bgm({ src: './bgm.mp3', volume: 70 });
// 清除背景音乐
creator.bgm(null);
```

### 时长处理

| 场景 | 处理方式 |
|------|----------|
| 音乐时长 = 视频时长 | 直接使用，无截断 |
| 音乐时长 < 视频时长 | 自动循环拼接至覆盖全片 |
| 音乐时长 > 视频时长 | 截断至视频总时长 |

### startTime / endTime（视频时间轴控制）
    
    ```js
    creator.bgm({
      src: './long-music.mp3',
      volume: 80,
      startTime: 10,   // 背景音乐在视频的 10s 处开始播放
      endTime: 30,     // 背景音乐在视频的 30s 处停止播放
      loop: true,
    });
    ```
    
    - `startTime`：背景音乐在视频的哪个时间点开始播放（默认 0）
    - `endTime`：背景音乐在视频的哪个时间点结束播放（默认 null，表示播到视频结尾）
    - 音频文件本身从开头播放，不裁剪音乐内容
    - 循环时，以 `[startTime, endTime]` 区间为基准进行循环拼接
    
### 淡入淡出

- 首段音频片段自动加 `fadeIn`
- 末段音频片段自动加 `fadeOut`
- 中间循环段落不加淡入淡出，保证音乐连贯

---

## 素材获取（Resource）

`resource.js` 提供网络素材搜索功能，用于自动获取视频、图片等资源。

```js
const resource = require('./resource');
```

### searchBaiduImage - 百度图片搜索

```js
// 搜索关键词图片
const images = await resource.searchBaiduImage('风景');
console.log(images);
// 返回格式:
// [
//   { url: '图片地址', width: 1920, height: 1080, ... },
//   ...
// ]
```

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `word` | string | 搜索关键词 |
| `pn` | number | 页码偏移（默认 0）|

### baiduVideos - 百度 AIGC 素材搜索

> ⚠️ **必需先登录百度获取 cookie**

```js
// 1. 登录 https://aigc.baidu.com 后，在浏览器开发者工具中复制 Cookie
// 2. 传入 header.cookie 参数

const videos = await resource.baiduVideos('科技', {
  header: {
    cookie: 'BAIDU_SPS_BROWSER_HISTORY=xxx; BAIDUID=xxx; ...'
  }
});

console.log(videos);
// 返回格式:
// [
//   {
//     id: '素材ID',
//     title: '素材标题',
//     url: '视频地址',
//     coverUrl: '封面图',
//     duration: 30,      // 时长（秒）
//     width: 1920,
//     height: 1080,
//     source: '来源'
//   },
//   ...
// ]

// 搜索图片素材
const images = await resource.baiduVideos('风景', { 
  type: 'image',
  header: { cookie: '...' }
});
```

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `text` | string | 搜索关键词 |
| `options.header.cookie` | string | **必需** - 百度登录后的 Cookie |
| `options.type` | string | `'video'` 或 `'image'`（默认 `'video'`）|
| `options.pc` | string | `'pc'` 时使用桌面端 API |

**返回字段：**

| 字段 | 说明 |
|------|------|
| `id` | 素材唯一标识 |
| `title` | 素材标题 |
| `url` | 资源下载地址 |
| `coverUrl` | 封面/缩略图 |
| `duration` | 视频时长（图片为 0）|
| `width` / `height` | 尺寸 |
| `source` | 来源平台 |

### 使用示例

```js
const Creator = require('./index');
const resource = require('./resource');

async function createVideo() {
  // 1. 先登录 https://aigc.baidu.com 获取 Cookie
  // 2. 传入 header.cookie
  
  const videos = await resource.baiduVideos('科技视频', {
    header: { cookie: '你的百度Cookie' }
  });
  const images = await resource.baiduVideos('自然风景', { 
    type: 'image',
    header: { cookie: '你的百度Cookie' }
  });

  const creator = new Creator({ width: 1920, height: 1080 });

  // 使用搜索到的素材
  if (videos.length > 0) {
    creator.addSlide({
      duration: videos[0].duration,
      elements: [
        { type: 'video', src: videos[0].url }
      ]
    });
  }

  await creator.render('./output/video.mp4');
}

createVideo();
```

---

## 示例

### basic.js — 完整示例（推荐）

```bash
node examples/basic.js
```

演示：片头 → 带 TTS 字幕的内容页 → 多元素静态页 → 长字幕页 → 片尾

### html-element-demo.js — HTML 元素示例

```bash
node examples/html-element-demo.js
```

演示 `type: 'html'` 的 6 种典型用法：基础 HTML、Tailwind 零配置、Emoji 彩色、全屏 HTML（`anchor: [0, 0]`）、Bare 格式 keyframes（默认 timing 自动应用）、Rich 格式 keyframes（自定义 timing + 多动画）。

### 时间线预览工作流

```js
const Creator = require('./index');
const c = new Creator({ width: 1920, height: 1080 });

c.addCover({ title: '片头', duration: 3 });
c.addSlide({
  elements: [
    { type: 'text', text: '欢迎', fontSize: 64 },
    { type: 'subtitle', text: '这是一段自动配音的字幕', tts: true },
  ]
});
c.addFooter({ title: '谢谢观看' });

// 1. 快速同步预览（不调 API，极快）
c.printTimeline({ sync: true });

// 2. 准确异步预览（ffprobe 探测真实时长）
await c.printTimelineAsync();

// 3. 用 JSON 进一步处理
const tl = await c.getTimeline();
if (tl.totalDuration > 60) {
  console.warn('视频超过 60 秒，考虑精简内容');
}

// 4. 满意后渲染
await c.render('./output/demo.mp4');
```

---

## 项目结构

```
fomo/
├── index.js         # Creator 主类（链式 API + render）
├── calculator.js    # SceneTimeCalculator（时间线自动排列）
├── tts.js           # MiniMax TTS 封装
├── resource.js      # 网络素材搜索（百度图片/视频）
├── package.json
└── examples/
    ├── basic.js              # 完整示例
    ├── html-element-demo.js  # HTML 元素示例
    └── _test_timeline.js     # 时间线功能测试
```