/**
 * HTML 元素示例
 * 运行：  node examples/html-element-demo.js
 *
 * 演示 fomo 中 type: 'html' 元素的几种典型用法：
 *   1. 基础 HTML（自定义样式）
 *   2. Tailwind 零配置模式
 *   3. Emoji 彩色渲染
 *   4. 全屏 HTML（anchor: [0, 0] 显式指定）
 *   5. 结构化 keyframes 动画
 *
 * 注意：
 *   - 渲染需要 fkbuilder 启用 Takumi 渲染器（@takumi-rs/core 依赖）
 *   - 这里默认只打印时间线，不主动 render；如需实际输出 mp4，
 *     把最后的 render 示例代码取消注释。
 */
const path=require('path')
const { Creator } = require('../index');

function section(title) {
  console.log('\n────────── ' + title + ' ──────────');
}

async function main() {
  const creator = new Creator({
    width: 1280,
    height: 720,
    fps: 30,
    // 背景音乐用 None 保持纯净
  });

  /* ─────────────────────────────────────────────
   * 1) 基础 HTML：自定义 div + CSS
   * ───────────────────────────────────────────── */
  section('1) 基础 HTML');
  creator.addSlide({
    background: '#1e1b4b',
    duration: 4,
    elements: [
      {
        type: 'html',
        startTime: 0,
        duration: 4,
        x: '50%', y: '50%',
        width: 800, height: 240,
        html: `
          <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;
                      background:#312e81;color:#fff;border-radius:16px;
                      font-family:'Microsoft YaHei';font-weight:700;letter-spacing:4px;">
            <span style="font-size:48px;">HELLO · 你好 · こんにちは</span>
          </div>
        `,
        // 预设动画可混用
        animations: ['fadeIn'],
      },
    ],
  });

  /* ─────────────────────────────────────────────
   * 2) Tailwind 零配置
   * ───────────────────────────────────────────── */
  section('2) Tailwind 零配置');
  creator.addSlide({
    background: '#0f172a',
    duration: 4,
    elements: [
      {
        type: 'html',
        startTime: 0,
        duration: 4,
        x: '50%', y: '50%',
        width: 1000, height: 320,
        tailwind: true,   // 开启内置 158KB 通用 Tailwind
        html: `
          <div class="w-full h-full flex items-center justify-center
                      bg-gradient-to-br from-purple-600 via-pink-600 to-blue-600
                      rounded-3xl shadow-2xl">
            <h1 class="text-7xl font-black text-white drop-shadow-lg tracking-wide">
              零配置 Tailwind
            </h1>
          </div>
        `,
        animations: ['zoomIn'],
      },
    ],
  });

  /* ─────────────────────────────────────────────
   * 3) Emoji 彩色渲染
   * ───────────────────────────────────────────── */
  section('3) Emoji 自动彩色');
  creator.addSlide({
    background: '#111827',
    duration: 4,
    elements: [
      {
        type: 'html',
        startTime: 0,
        duration: 4,
        x: '50%', y: '50%',
        width: 900, height: 260,
        emoji: 'twemoji', // 默认即 twemoji，显式写出来便于阅读
        html: `
          <div style="width:100%;height:100%;display:flex;flex-direction:column;
                      align-items:center;justify-content:center;gap:20px;">
            <div style="font-size:120px;line-height:1;">🚀 🎨 ⚡</div>
            <h1 style="font-size:48px;color:#fff;margin:0;
                       font-family:'Microsoft YaHei';font-weight:700;">
              FKbuilder 真棒 🎬
            </h1>
          </div>
        `,
      },
    ],
  });

  /* ─────────────────────────────────────────────
   * 4) 全屏 HTML：必须 anchor: [0, 0]
   * ───────────────────────────────────────────── */
  section('4) 全屏 HTML（anchor: [0, 0]）');
  creator.addSlide({
    duration: 5,
    elements: [
      {
        type: 'html',
        startTime: 0,
        duration: 5,
        // 全屏覆盖整个画布
        x: 0, y: 0,
        width: '100%', height: '100%',
        anchor: [0, 0],   // ← 关键：全屏 HTML 用左上角锚点
        tailwind: true,
        html: `
          <div class="w-full h-full min-h-screen bg-gradient-to-br
                      from-indigo-900 to-purple-900
                      flex flex-col items-center justify-center p-12">
            <div class="text-9xl mb-8">🎉</div>
            <h1 class="text-7xl font-black text-white mb-6">全屏 HTML</h1>
            <p class="text-3xl text-white/80">用 anchor: [0,0] 实现画布对齐</p>
          </div>
        `,
      },
    ],
  });

  /* ─────────────────────────────────────────────
   * 5) 结构化 keyframes - Bare 格式（默认值 1s ease-in-out infinite）
   *
   * 只写 keyframes 规则,fkbuilder 自动生成 @keyframes 定义 + animation 规则,
   * 无需手动写 animation: ...。本节用 Bare 格式（offset 直接当 key）。
   * ───────────────────────────────────────────── */
  section('5) 结构化 keyframes (Bare 格式)');
  creator.addSlide({
    background: '#0c4a6e',
    duration: 4,
    elements: [
      {
        type: 'html',
        startTime: 0,
        duration: 4,
        x: '50%', y: '50%',
        width: 600, height: 200,
        tailwind: true,
        // CSS 选择器作为 key,value 就是裸 keyframe 规则
        // fkbuilder 自动注入:
        //   <style>.badge { animation: fk-anim-badge-0 1s ease-in-out infinite 0s normal none; }</style>
        keyframes: {
          '.badge': {
            '0%':   { transform: 'translateY(0)' },
            '50%':  { transform: 'translateY(-30px)' },
            '100%': { transform: 'translateY(0)' },
          },
        },
        html: `
          <div class="badge w-full h-full flex items-center justify-center
                      bg-blue-500 text-white text-5xl font-black rounded-2xl
                      shadow-lg">
            弹跳 Badge
          </div>
        `,
      },
    ],
  });

  /* ─────────────────────────────────────────────
   * 6) 结构化 keyframes - Rich 格式（自定义 timing + 多动画）
   *
   * Rich 格式:在每个 selector 下加 duration/easing/iteration 等字段,
   * 同时支持设置嵌套的 keyframes。
   * ───────────────────────────────────────────── */
  section('6) 结构化 keyframes (Rich 格式)');
  creator.addSlide({
    background: '#0c0a09',
    duration: 5,
    elements: [
      {
        type: 'html',
        startTime: 0,
        duration: 5,
        x: '50%', y: '50%',
        width: 900, height: 320,
        tailwind: true,
        keyframes: {
          // 标题:滑入,播 1 次
          '.title': {
            duration: '1.2s',
            easing: 'ease-out',
            iteration: '1',
            fill: 'forwards',
            keyframes: {
              '0%':   { opacity: 0, transform: 'translateY(-40px)' },
              '100%': { opacity: 1, transform: 'translateY(0)' },
            },
          },
          // 卡片:脉冲,无限循环
          '.card': {
            duration: '.6s',
            easing: 'ease-in-out',
            iteration: 'infinite',
            keyframes: {
              '0%, 100%': { transform: 'scale(1)' },
              '50%':      { transform: 'scale(1.05)' },
            },
          },
          // 加载环:旋转,线性无限循环
          '.spinner': {
            duration: '1s',
            iteration: 'infinite',
            easing: 'linear',
            keyframes: {
              '0%':   { transform: 'rotate(0deg)' },
              '100%': { transform: 'rotate(360deg)' },
            },
          },
        },
        html: `
          <div class="w-full h-full flex flex-col items-center justify-center gap-6">
            <div class="spinner w-16 h-16 rounded-full border-8 border-white/20
                        border-t-cyan-400"></div>
            <h1 class="title text-6xl font-black text-white">Rich 格式动画</h1>
            <div class="card w-64 h-24 bg-gradient-to-br from-purple-600 to-pink-600
                        rounded-2xl flex items-center justify-center
                        text-white text-3xl font-bold shadow-2xl">
              Pulse Card
            </div>
          </div>
        `,
      },
    ],
  });

  /* ─────────────────────────────────────────────
   * 7) 片尾
   * ───────────────────────────────────────────── */
  section('7) 片尾');
  creator.addFooter({
    title: '谢谢观看',
    subtitle: 'fomo · HTML 元素演示',
    background: '#1e1b4b',
    duration: 3,
  });

  /* ─────────────────────────────────────────────
   * 打印时间线
   * ───────────────────────────────────────────── */
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  时间线预览（同步模式，不调用 TTS / ffprobe）');
  console.log('══════════════════════════════════════════════════════');
  creator.printTimeline({ sync: true });

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  JSON 形式时间线（包含 source 字段）');
  console.log('══════════════════════════════════════════════════════');
  const tl = await creator.getTimeline();
  console.log('总时长:', tl.totalDuration.toFixed(2), 's');
  console.log('场景数:', tl.sectionCount, '  元素数:', tl.elementCount);

  /* ─────────────────────────────────────────────
   * 如需实际渲染输出 mp4，取消下面注释
   * （需要 fkbuilder@1.1.86 已内置 Takumi 支持，
   *  对应依赖 @takumi-rs/core 已作为 peer 安装）
   * ───────────────────────────────────────────── */
  // const path = require('path');
  await creator.render(path.join(__dirname, '..', 'output', 'html-demo.mp4'), {
    parallel: false,
    usePipe: true,
  });
  // console.log('已输出:', path.join(__dirname, '..', 'output', 'html-demo.mp4'));
}

main().catch(err => {
  console.error('演示失败:', err);
  process.exit(1);
});
