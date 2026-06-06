// 验证时间轴自动分配与场景时长汇总
const Creator = require('../index');
const SceneTimeCalculator = require('../calculator.js');

(async () => {
  console.log('=== Test 1: 多个字幕无 startTime，应顺序播放 ===');
  {
    const calc = new SceneTimeCalculator([
      { type: 'subtitle', text: 'A', duration: 2 },
      { type: 'subtitle', text: 'B', duration: 3 },
      { type: 'subtitle', text: 'C', duration: 1 },
    ]);
    console.log('Total:', calc.getTotal().formatted);
    console.log('Timeline:', calc.getTimeline().map(t =>
      `[${t.startTime}s -> ${t.endTime}s] ${t.name} (auto=${t.autoAssigned})`));
    // 期望: A [0->2], B [2->5], C [5->6], total=6s
  }

  console.log('\n=== Test 2: 部分有 startTime + 部分没有 ===');
  {
    const calc = new SceneTimeCalculator([
      { type: 'text', text: 'BG', duration: 10 },
      { type: 'subtitle', text: 'A', duration: 2 },          // 无 startTime
      { type: 'subtitle', text: 'B', duration: 2 },          // 无 startTime
      { type: 'subtitle', text: 'C', startTime: 3, duration: 2 },  // 显式 startTime=3
      { type: 'subtitle', text: 'D', duration: 2 },          // 无 startTime
    ]);
    console.log('Total:', calc.getTotal().formatted);
    console.log('Timeline:', calc.getTimeline().map(t =>
      `[${t.startTime}s -> ${t.endTime}s] ${t.name} (auto=${t.autoAssigned})`));
    // 期望:
    //   BG [0->10]
    //   C [3->5]  (显式)
    //   A, B, D 顺序填充，但起点从 C 末尾之后开始
  }

  console.log('\n=== Test 3: Creator.build() - 不传 duration 应自动汇总 ===');
  {
    const c = new Creator({ width: 1920, height: 1080 });
    c.addSlide({
      // 不指定 duration，让其自动汇总
      elements: [
        { type: 'subtitle', text: '第一句' },
        { type: 'subtitle', text: '第二句' },
        { type: 'subtitle', text: '第三句' },
      ]
    });
    c.addSlide({
      duration: 2,  // 显式传 2s，但下面有元素覆盖 4s，应被自动拉长
      elements: [
        { type: 'subtitle', text: 'A', duration: 2 },
        { type: 'subtitle', text: 'B', duration: 2 },
      ]
    });
    await c.build();
    const mainTrack = c._builder.tracks[0];
    mainTrack.scenes.forEach((sc, i) => {
      console.log(`Slide ${i}: duration=${sc.duration}s, startTime=${sc.startTime}s`);
      sc.elements.forEach(e => {
        const cfg = (e.element && e.element.config) || e.config || {};
        console.log(`  - ${e.type || cfg.type}: startTime=${cfg.startTime}, duration=${cfg.duration}, text=${(cfg.text || '').slice(0, 10)}`);
      });
    });
  }

  console.log('\n=== Test 4: 视觉元素无 duration，应用 3s 默认值 ===');
  {
    const c = new Creator({ width: 1920, height: 1080 });
    c.addSlide({
      elements: [
        { type: 'rect', x: '50%', y: '50%', width: 200, height: 100, fillColor: '#f00' },
        { type: 'image', x: '0%', y: '0%', src: 'fake.png' },
        { type: 'text', x: '50%', y: '20%', text: '标题', fontSize: 64 },
      ]
    });
    await c.build();
    const sc = c._builder.tracks[0].scenes[0];
    console.log(`Scene duration: ${sc.duration}s`);
    sc.elements.forEach(e => {
      const cfg = (e.element && e.element.config) || e.config || {};
      console.log(`  - ${e.type}: startTime=${cfg.startTime}, duration=${cfg.duration}`);
    });
    // 期望：scene 包含 3 个元素 (rect, image, text)，每个 3s，scene 至少 3s
  }
})();
