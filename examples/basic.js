/**
 * 基本用法示例
 * 运行：  node examples/basic.js
 *
 * 演示：
 *   1. 通过 index.js 创建视频
 *   2. 字幕元素启用 TTS，自动生成语音并与字幕同步
 *   3. 多场景、转场、不同元素混排
 */

const path = require('path');
const {Creator,resource} = require('../index');

const colors = {
  deepRed: '#8B0000',        // 深红色 - 碧血、殉葬
  bloodRed: '#DC143C',       // 血红色 - 血色、悲壮
  gold: '#FFD700',           // 金色 - 皇家、盛装
  darkGold: '#B8860B',       // 暗金色 - 古典、庄重
  lightGold: '#FFECB3',      // 浅金色 - 月光、温柔
  darkPurple: '#4B0082',     // 深紫色 - 悲壮、深沉
  darkNavy: '#1a1a2e',       // 深蓝黑 - 乱世、深沉
  white: '#ffffff',          // 白色 - 落花、纯洁
  palePink: '#FFE4E1',       // 淡粉色 - 落花、温柔
  lightYellow: '#FFFACD',    // 淡黄色 - 月光、温柔
  moonWhite: '#F0F8FF',      // 月白色 - 月光
  candleFlame: '#FFA500',    // 烛光橙 - 花烛
  wineRed: '#722F37',        // 酒红色 - 葡萄酿
  black: '#000000',          // 黑色 - 深沉、庄重
  starWhite: '#E6E6FA',      // 星白色 - 星星
};
async function main() {
	
	
  const creator = new Creator({
    width: 1280,
    height: 720,
    fps: 30,
	randomTransition: {
      enabled: true,      // 开启后，未指定 transition 的场景自动随机选转场
      animations: true,   // 开启后，未指定 animations 的元素自动随机选动画
    },
    tts: {
      // 留空时从环境变量 MINIMAX_API_KEY 读取
      voice: 'female-shaonv-jingpin',
      rate: 0,
      volume: 100,
    },
  });

  // 1) 片头
  creator.addCover({
    title: '我的第一个视频',
    subtitle: '使用 fkbuilder + TTS 制作',
	image:{
		src:"https://pics3.baidu.com/feed/dc54564e9258d109777298ee907150ae6d814d97.jpeg@f_auto?token=f646ab6eefbc42e7b9f02b344d911fbf",
		fit:"cover"
	},
	titleStyle:{ fontPath: 'http://45.77.38.55:28021/down/mqCePBPAU43u.ttc',},
	subtitleStytle:{fontPath: 'http://45.77.38.55:28021/down/mqCePBPAU43u.ttc',},
    duration: 3
  });

  // 2) 第一个内容页 - 包含会朗读的字幕
  creator.addSlide({
    background: '#0f3460',
    duration: 6,
    elements: [
      {
		startTime:0,
        type: 'text',
        text: '第一页',
        x: '50%', y: '18%',
        fontSize: 64,
        color: '#ffe66d',
		anchor: [0.5, 0.5],
        textAlign: 'center',
        animations: ['fadeIn'],
      },
      {
		startTime:0,
        type: 'subtitle',
        // 开启 TTS，会自动调用 MiniMax 生成语音
        tts: true,
        text: '大家好，这是一段会自动朗读出来的字幕文本',
        position: 'bottom',
		x: '50%',
		y: '85%', 
		fontSize: 44,
		color: colors.gold,
		fontFamily: 'Microsoft YaHei',
		textAlign: 'center',
		duration: 3,
		split: 'letter',
		splitDelay: 0.08,
		splitDuration: 0.4,
		animations: ['fadeIn']
        // 可以单独覆盖全局 TTS 配置
        // voice: 'male-qn-qingse',
        // rate: -2,
      },
    ],
  });

  // 3) 第二个内容页 - 多个元素 + 不带 TTS 的字幕
  creator.addSlide({
    background: '#16213e',
    duration: 5,
    elements: [
      { type: 'rect', x: '50%', y: '50%', width: 600, height: 360, fillColor: '#e94560', borderRadius: 20, anchor: [0.5, 0.5], animations: ['bigIn'] },
      {type: 'text', text: '静态文字 + 形状', x: '50%', y: '50%', fontSize: 48, color: '#ffffff', textAlign: 'center', anchor: [0.5, 0.5] },
    ],
  });

  // 4) 第三个内容页 - 带 TTS 的长字幕，验证自动分句朗读
  creator.addSlide({
    background: '#1a1a2e',
    duration: 8,
    transition: 'fade',
    elements: [
      {
		tts: true,
		startTime:0,
        type: 'subtitle',
        tts: { voice: 'male-qn-qingse', rate: -1 },
        text: '欢迎使用视频创建器，字幕会先调用 TTS 引擎合成语音，然后与画面时长保持同步。',
        x: '50%',
		y: '85%', 
		fontSize: 44,
		color: '#fff',
		fontFamily: '微软雅黑',
		textAlign: 'center',
		duration: 3,
		split: 'letter',
		splitDelay: 0.08,
		splitDuration: 0.4,
		animations: ['fadeIn']
      },
    ],
  });
  
  // creator.addSlide({
    // background: '#1a1a2e',
    // duration: 8,
    // elements: [
      // {
		// src:"http://vd3.bdstatic.com/mda-qcpgv5huhbhujfpf/360p/h264/1711281253069791287/mda-qcpgv5huhbhujfpf.mp4",
		// x: '50%',
		// y: '50%', 
		// width:"100%",
		// height:"100%",
		// startTime:0,
		// anchor: [0.5, 0.5],
        // type: 'video',
		// fit: 'cover', 
		// mute: true,
        // loop:true,
		// animations: ['fadeIn']
      // },
    // ],
  // });

  // 5) 片尾
  creator.addFooter({
    title: '谢谢观看',
    subtitle: '请点赞、关注、转发',
    duration: 3,
  });

  // 渲染
  const output = path.join(__dirname, '..', 'output', 'basic.mp4');

  await creator.render(output, {
    parallel: false,
    usePipe: true,
    maxWorkers: 4,
    // keepTtsAudio: true, // 调试时打开，保留临时音频文件
  });

  console.log('视频已生成:', output);
}

main().catch(err => {
  console.error('渲染失败:', err);
  process.exit(1);
});
