/**
 * 视频创建器(统一入口)
 * 基于 fkbuilder + tts.js 实现:
 *   - 链式 API 描述视频结构(cover / slides / footer)
 *   - 字幕元素内置 TTS 支持(自动生成语音并与字幕时长同步)
 *
 * 用法示例:
 *   const Creator = require('./index');
 *   const creator = new Creator({ width: 1920, height: 1080, tts: { voice: 'female-shaonv-jingpin' } });
 *   creator.addCover({ title: '片头', duration: 3 });
 *   creator.addSlide({
 *     duration: 6,
 *     elements: [
 *       { type: 'text', text: '标题', x: '50%', y: '20%', fontSize: 64, color: '#fff' },
 *       { type: 'subtitle', text: '这是一段会自动朗读的字幕', tts: true, position: 'bottom' }
 *     ]
 *   });
 *   creator.addFooter({ title: '谢谢观看', duration: 3 });
 *   await creator.render('./output/video.mp4');
 */

const { VideoBuilder } = require('fkbuilder');
const resource = require('./resource.js')
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const SceneTimeCalculator = require('./calculator.js');
// 加载 TTS 模块(失败时降级为不使用 TTS)
const tts = require('./tts.js');
const PRESET_ANIMATIONS=[
  'fadeIn',            'fadeOut',         'slideInTop',
  'slideInBottom',     'slideInLeft',     'slideInRight',
  'slideOutTop',       'slideOutBottom',  'slideOutLeft',
  'slideOutRight',     'zoomIn',          'zoomOut',
  'bigIn',             'bigOut',          'rotateIn',
  'rotateOut',         'fadeInUp',        'fadeInDown',
  'fadeOutUp',         'fadeOutDown',     'bounceIn',
  'bounceOut',         'rotateInLeft',    'rotateInRight',
  'rotateOutLeft',     'rotateOutRight',  'zoomInFade',
  'zoomOutFade',       'zoomRotateIn',    'zoomRotateOut',
  'bounceInUp',        'bounceInDown',    'bounceInLeft',
  'bounceInRight',     'bounceOutUp',     'bounceOutDown',
  'zoomInUp',          'zoomInDown',      'zoomInLeft',
  'zoomInRight',       'zoomOutUp',       'zoomOutDown',
  'zoomOutLeft',       'zoomOutRight',    'flipInX',
  'flipInY',           'flipOutX',        'flipOutY',
  'elasticIn',         'elasticOut',      'swing',
  'pulse',             'shake',           'flash',
  'fadeInScale',       'fadeOutScale',    'fadeInRotate',
  'fadeOutRotate',     'slideFadeInLeft', 'slideFadeInRight',
  'slideFadeInUp',     'slideFadeInDown', 'slideFadeOutLeft',
  'slideFadeOutRight', 'slideFadeOutUp',  'slideFadeOutDown'
]
const PRESET_TRANSACTIONS=[
  'Bounce',                'BowTieHorizontal',  'BowTieVertical',
  'ButterflyWaveScrawler', 'CircleCrop',        'ColourDistance',
  'CrazyParametricFun',    'CrossZoom',         'Directional',
  'DoomScreenTransition',  'Dreamy',            'DreamyZoom',
  'GlitchDisplace',        'GlitchMemories',    'GridFlip',
  'InvertedPageCurl',      'LinearBlur',        'Mosaic',
  'PolkaDotsCurtain',      'Radial',            'SimpleZoom',
  'StereoViewer',          'Swirl',             'WaterDrop',
  'ZoomInCircles',         'angular',           'burn',
  'cannabisleaf',          'circle',            'circleopen',
  'colorphase',            'crosshatch',        'crosswarp',
  'cube',                  'directionalwarp',   'directionalwipe',
  'displacement',          'doorway',           'fade',
  'fadecolor',             'fadegrayscale',     'flyeye',
  'heart',                 'hexagonalize',      'kaleidoscope',
  'luma',                  'luminance_melt',    'morph',
  'multiply_blend',        'perlin',            'pinwheel',
  'pixelize',              'polar_function',    'randomsquares',
  'ripple',                'rotate_scale_fade', 'squareswire',
  'squeeze',               'swap',              'undulatingBurnOut',
  'wind',                  'windowblinds',      'windowslice',
  'wipeDown',              'wipeLeft',          'wipeRight',
  'wipeUp',                'directional-left',  'directional-right',
  'directional-down',      'directional-up'
]
/**
 * 元素未指定 duration 时的兜底时长(秒)
 * 仅对纯视觉元素(text/image/rect/circle/svg)生效,
 * 视频/音频会用 ffprobe 探测真实时长,字幕有 TTS 时会取 TTS 音频时长。
 */
const DEFAULT_ELEMENT_DURATION = 3;

/**
 * 给元素配置补上默认 anchor = [0.5, 0.5]
 * 这样 (x, y) 描述的就是元素的中心点,与常见视觉编辑器的体验一致。
 * 用户显式传入 anchor 时不会被覆盖。
 */
function withDefaultAnchor(config) {
  if (!config || typeof config !== 'object') return config;
  if (config.anchor === undefined) {
    return { ...config, anchor: [0.5, 0.5] };
  }
  return config;
}

/**
 * 用 ffprobe 探测媒体文件时长(秒)
 * 失败或 ffprobe 不可用时返回 null
 */
function probeMediaDuration(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    exec(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${src}"`,
      { timeout: 10000 },
      (err, stdout) => {
        if (err) return resolve(null);
        const d = parseFloat((stdout || '').trim());
        resolve(isFinite(d) && d > 0 ? d : null);
      }
    );
  });
}

class Creator {
  /**
   * @param {Object} options
   * @param {number} [options.width=1920]   视频宽度
   * @param {number} [options.height=1080]  视频高度
   * @param {number} [options.fps=30]       帧率
   * @param {Object} [options.tts]          TTS 全局默认配置
   * @param {string} [options.tts.voice]    语音 ID
   * @param {number} [options.tts.rate]     语速
   * @param {number} [options.tts.volume]   音量
   * @param {string} [options.tts.model]    模型名
   * @param {string} [options.tts.apiKey]   MiniMax API Key(也可通过环境变量 MINIMAX_API_KEY 传入)
   * @param {boolean}[options.tts.enabled]  全局是否启用 TTS;为 false 时字幕里的 tts:true 才会单独触发
   */
  constructor(options = {}) {
    this.width = options.width || 1920;
    this.height = options.height || 1080;
    this.fps = options.fps || 30;
	this.transactions=PRESET_TRANSACTIONS
	this.animations=PRESET_ANIMATIONS

    /**
     * 随机转场/动画配置
     * @param {boolean} [options.randomTransition.enabled=false]   开启随机转场
     * @param {boolean} [options.randomTransition.animations=false]  同时随机元素动画(每元素从 PRESET_ANIMATIONS 随机选一个)
     */
    this.randomTransition = {
      enabled: false,
      animations: false,
      ...(options.randomTransition || {}),
    };

    this.ttsConfig = {
      enabled: false,
      voice: 'female-shaonv-jingpin',
      rate: 0,
      volume: 100,
      model: 'speech-2.8-hd',
      apiKey: null,
      ...(options.tts || {}),
    };

    this.cover = null;
    this.slides = [];
    this.footer = null;

    /**
     * 背景音乐配置
     * @param {string}   options.backgroundMusic.src       音频文件路径
     * @param {number}  [options.backgroundMusic.volume=80]  音量 0~100
     * @param {number}  [options.backgroundMusic.fadeIn=0.5]  入场淡入（秒）
     * @param {number}  [options.backgroundMusic.fadeOut=0.5] 出场淡出（秒）
     * @param {boolean} [options.backgroundMusic.loop=true]    音乐短于视频时是否循环
     */
    this.backgroundMusic = options.backgroundMusic
      ? {
          src: options.backgroundMusic.src,
          volume: options.backgroundMusic.volume ?? 80,
          fadeIn: options.backgroundMusic.fadeIn ?? 0.5,
          fadeOut: options.backgroundMusic.fadeOut ?? 0.5,
          loop: options.backgroundMusic.loop ?? true,
          startTime: options.backgroundMusic.startTime ?? 0,
          endTime: options.backgroundMusic.endTime ?? null,
        }
      : null;

    this._builder = null;
    this._built = false;
    this._ttsAudioFiles = []; // 渲染结束后统一清理
  }

  /* ============================================================
   * 场景描述 API(链式调用)
   * ============================================================ */

  /**
   * 添加片头场景
   * @param {Object} options
   * @param {string} [options.background='#1a1a2e'] 背景色
   * @param {number} [options.duration=3]          时长(秒)
   * @param {string} [options.title]                主标题
   * @param {string} [options.subtitle]             副标题
   * @param {Object} [options.titleStyle]           主标题样式(覆盖 addText 默认值)
   * @param {Object} [options.subtitleStyle]        副标题样式
   * @param {string} [options.transition='fade']    切到下一个场景的转场名,传 null 不使用转场
   */
  /**
   * 从数组中随机返回一个元素
   */
  _randomFrom(arr) {
    if (!arr || !arr.length) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  addCover(options = {}) {
    const transition =
      options.transition !== undefined
        ? options.transition
        : this.randomTransition.enabled
          ? this._randomFrom(this.transactions)
          : 'fade';

    this.cover = {
      background: options.background || '#1a1a2e',
      duration: options.duration, // 不再兜底,未指定时由 _buildSection 自动汇总
      title: options.title || '',
      subtitle: options.subtitle || '',
      titleStyle: options.titleStyle || {},
      subtitleStyle: options.subtitleStyle || {},
      transition,
    };
    return this;
  }

  /**
   * 添加内容场景
   * @param {Object} options
   * @param {string} [options.background='#1a1a2e'] 背景色
   * @param {number} [options.duration=5]          时长(秒)
   * @param {Array}  [options.elements]            元素列表(也可用 contents 别名)
   * @param {string} [options.transition]           转场名,不传则自动判断
   * @param {Array}  [options.contents]            elements 的别名
   */
  addSlide(options = {}) {
    const rawElements = options.elements || options.contents || [];
    const elements = rawElements.map(el => {
      const cloned = { ...el };
      if (
        this.randomTransition.animations &&
        cloned.animations === undefined &&
        ['text', 'subtitle', 'image', 'rect', 'circle'].includes(cloned.type)
      ) {
        cloned.animations = [this._randomFrom(this.animations)];
      }
      return cloned;
    });

    const transition =
      options.transition !== undefined
        ? options.transition
        : this.randomTransition.enabled
          ? this._randomFrom(this.transactions)
          : null;

    this.slides.push({
      background: options.background || '#1a1a2e',
      duration: options.duration,
      transition,
      elements,
    });
    return this;
  }

  /**
   * 添加片尾场景
   * @param {Object} options 同 addCover
   */
  addFooter(options = {}) {
    const transition =
      options.transition !== undefined
        ? options.transition
        : this.randomTransition.enabled
          ? this._randomFrom(this.transactions)
          : 'fade';

    this.footer = {
      background: options.background || '#1a1a2e',
      duration: options.duration,
      title: options.title || '',
      subtitle: options.subtitle || '',
      titleStyle: options.titleStyle || {},
      subtitleStyle: options.subtitleStyle || {},
      transition,
    };
    return this;
  }

  /* ============================================================
   * 构建 / 渲染
   * ============================================================ */

  /**
   * 构建视频结构(内部方法,render 之前会自动调用)
   */
  async build() {
    if (this._built) return this._builder;

    this._builder = new VideoBuilder({
      width: this.width,
      height: this.height,
      fps: this.fps,
    });

    // 主视觉轨道
    const mainTrack = this._builder.createTrack({ zIndex: 10, name: 'main' });
    // 音频轨道(单独管理 TTS 语音,避免与视觉元素混在一起)
    const audioTrack = this._builder.createTrack({ zIndex: 0, name: 'audio' });

    const sections = [...this._collectSections()];
    let currentTime = 0;
    const TRANSITION_DURATION = 1;

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const isFirst = i === 0;
      const hasNext = i < sections.length - 1;

      // 非首段且配置了转场时，让场景与上一段重叠 1 秒以执行转场
      let startTime = currentTime;
      // if (!isFirst && section.transition) {
        // startTime = currentTime - TRANSITION_DURATION;
      // }

      // _buildSection 返回解析后的场景时长（可能由 _buildSection 自动汇总）
      const sceneDuration = await this._buildSection(section, startTime, mainTrack, audioTrack);

      // 当前段的实际结束时间
      currentTime = startTime + sceneDuration;

      // 在当前段尾部加转场（指向下一段）
      if (hasNext && section.transition) {
        mainTrack.addTransition({
          name: section.transition,
          duration: TRANSITION_DURATION
        });
      }
    }

    // 所有 section 构建完毕，currentTime 即为视频总时长
    if (this.backgroundMusic && this.backgroundMusic.src) {
      await this._addBackgroundMusic(mainTrack, currentTime);
    }

    this._built = true;
    return this._builder;
  }

  /**
   * 设置/替换背景音乐（链式调用）
   * @param {Object} config  背景音乐配置，同构造函数 backgroundMusic
   * @returns {Creator} this
   */
  setBackgroundMusic(config) {
    if (!config || !config.src) {
      this.backgroundMusic = null;
    } else {
      this.backgroundMusic = {
        src: config.src,
        volume: config.volume ?? 80,
        fadeIn: config.fadeIn ?? 0.5,
        fadeOut: config.fadeOut ?? 0.5,
        loop: config.loop ?? true,
        startTime: config.startTime ?? 0,
        endTime: config.endTime ?? null,
		cutFrom:config.cutFrom||0,
		cutTo:config.cutTo||null
      };
    }
    return this;
  }

  /**
   * setBackgroundMusic 的简写别名
   */
  bgm(config) {
    return this.setBackgroundMusic(config);
  }


  /**
   * 添加背景音乐到独立音乐轨道
   * @param {number} startTime  视频时间轴：背景音乐从哪个时间点开始播放
   * @param {number|null} endTime  视频时间轴：背景音乐从哪个时间点结束播放（null=播到视频结尾）
   */
  async _addBackgroundMusic(mainTrack, totalDuration) {
    const { src, volume, fadeIn, fadeOut, loop, startTime = 0, endTime = null,cutFrom=0,cutTo } = this.backgroundMusic;
    if (!src) return;


    // 探测音乐文件时长
    const musicDuration = await probeMediaDuration(src) || 0;
    if (!musicDuration) {
      console.warn('[Creator] 背景音乐 ffprobe 探测失败，跳过');
      return;
    }
	let re_start_time=startTime
	let re_cut_to=cutTo
    const musicTrack = this._builder.createTrack({ zIndex: 1, name: 'background-music' });
	let segDur=musicDuration
	if(musicDuration>=totalDuration){
		segDur=totalDuration
	}
	if(re_start_time){
		segDur-=re_start_time
	}
	if(!re_cut_to){
		re_cut_to=segDur
	}
	const scene = musicTrack.createScene({ duration: totalDuration, startTime: 0 });
	scene.addAudio({
		src:src,
		volume:volume,
		fadeIn:fadeIn,
		fadeOut:fadeOut,
		loop:loop,
		startTime:re_start_time,
		duration:segDur,
		cutFrom:cutFrom,
		cutTo:re_cut_to
	});
  }
    
  /**
   * 渲染并导出视频
   * @param {string} outputPath                    输出视频路径,默认 ./output/video.mp4
   * @param {Object} [options]                     透传给 builder.render
   * @param {boolean}[options.parallel=true]       并行渲染
   * @param {boolean}[options.usePipe=true]         管道模式
   * @param {number} [options.maxWorkers=4]         并行 Worker 数
   * @param {boolean}[options.keepTtsAudio=false]   保留 TTS 临时音频文件(便于调试)
   */
  async render(outputPath, options = {}) {
    await this.build();

    const finalPath = outputPath || path.join(process.cwd(), 'output', 'video.mp4');
    const outputDir = path.dirname(finalPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const renderOptions = {
      parallel: false,
      usePipe: true,
      maxWorkers: 4,
      ...options,
    };

    try {
      return await this._builder.render(finalPath, renderOptions);
    } finally {
      // 渲染结束再清理 TTS 临时文件
      if (!options.keepTtsAudio && tts && this._ttsAudioFiles.length) {
        try {
          await tts.cleanupTempFiles(this._ttsAudioFiles);
        } catch (err) {
          /* 忽略清理失败 */
        }
      }
    }
  }

  /* ============================================================
   * TTS 辅助
   * ============================================================ */

  /**
   * 获取可用的语音列表
   */
  async getVoices() {
    if (!tts) return [];
    try {
      return await tts.getAvailableVoices(this.ttsConfig);
    } catch (err) {
      return tts.chineseVoices.map(id => ({ voiceId: id, name: id }));
    }
  }

  /**
   * 获取内置中文语音 ID 列表
   */
  getChineseVoices() {
    return tts ? tts.chineseVoices : [];
  }

  /* ============================================================
   * 内部实现
   * ============================================================ */

  _collectSections() {
    const sections = [];
    if (this.cover) sections.push({ ...this.cover, _kind: 'cover' });
    this.slides.forEach(s => sections.push({ ...s, _kind: 'slide' }));
    if (this.footer) sections.push({ ...this.footer, _kind: 'footer' });
    return sections;
  }

  async _buildSection(section, startTime, mainTrack, audioTrack) {
    const elements = section.elements || [];

    // 1. 为所有元素补上 duration（探测媒体 / 调用 TTS / 走默认值）
    for (const el of elements) {
      if (el.type==='subtitle' && el.tts) {
        el.duration = await this._resolveElementDuration(el);
      }
    }

    // 2. 用 SceneTimeCalculator 填齐 startTime，计算总时长
    const calc = new SceneTimeCalculator(elements.filter(a=>a.type==='subtitle'));
    const processedElements = calc.processedElements;
    const calculatedTotal = calc.totalDuration;

    // 3. 决定最终的场景时长
    //    - 用户显式传了 duration：使用用户值，但不少于所有元素覆盖的最大区间
    //    - 未传：按计算结果自动汇总；cover/footer 无元素时退到 3s
    let sceneDuration;
    if (section.duration != null) {
      sceneDuration = Math.max(section.duration, calculatedTotal);
    } else {
      const fallback = section._kind === 'slide' ? 1 : 3;
      sceneDuration = Math.max(calculatedTotal, fallback);
    }
	
    // 4. 创建场景
    const scene = mainTrack.createScene({
      duration: sceneDuration,
      startTime,
    });

    if (section.background) {
      scene.addBackground({ color: section.background });
    }

    // 5. cover / footer 的标题与副标题(填满整个场景)
    if (section._kind !== 'slide') {
      if (section.title) {
        scene.addText(withDefaultAnchor({
          text: section.title,
          x: '50%',
          y: section._kind === 'cover' ? '42%' : '45%',
          fontSize: 80,
          color: '#ffffff',
          textAlign: 'center',
          duration: sceneDuration,
          startTime: 0,
          animations: ['fadeIn'],
          ...section.titleStyle,
        }));
      }
      if (section.subtitle) {
        scene.addText(withDefaultAnchor({
          text: section.subtitle,
          x: '50%',
          y: section._kind === 'cover' ? '56%' : '60%',
          fontSize: 40,
          color: '#cccccc',
          textAlign: 'center',
          duration: sceneDuration,
          startTime: 0,
          animations: ['fadeIn'],
          ...section.subtitleStyle,
        }));
      }
    }

    // 6. 业务元素(startTime 与 duration 已被 calc 补齐)
    for (const el of elements) {
      await this._addElement(scene, audioTrack, el, startTime);
    }

    return sceneDuration;
  }

  /**
   * 解析一个元素未指定 duration 时的实际时长
   * - video / audio:ffprobe 探测
   * - subtitle + tts:调用 TTS,取返回的音频时长(同时把 TTS 路径缓存到 el._ttsPath)
   * - 其他:DEFAULT_ELEMENT_DURATION 兑底
   */
  async _resolveElementDuration(el) {
    // if (el.duration != null) return el.duration;

    // if (el.type === 'video' || el.type === 'audio') {
      // const d = await probeMediaDuration(el.src);
      // return d || DEFAULT_ELEMENT_DURATION;
    // }

    if (el.type === 'subtitle' && el.tts) {
      const ttsResult = await this._generateTts(el);
      return ttsResult.duration || DEFAULT_ELEMENT_DURATION;
    }

    return DEFAULT_ELEMENT_DURATION;
  }

  /**
   * 调用 TTS 模块生成语音,并把结果缓存到 el 上供后续 _addSubtitle 复用。
   * 返回 { path, duration },失败时返回 { path: null, duration: 0 }
   */
  async _generateTts(el) {
    if (!tts || !el.text) return { path: null, duration: 0 };

    // 复用之前的生成结果(避免重复调用)
    if (el._ttsPath) {
      return { path: el._ttsPath, duration: el._ttsDuration || 0 };
    }

    const {
      text,
      tts: ttsFlag,
      voice, rate, volume,
    } = el;
	const model = this.ttsConfig.model
	const apiKey = this.ttsConfig.apiKey
    const ttsOptions = {
      ...this.ttsConfig,
      ...(voice != null && { voice }),
      ...(rate != null && { rate }),
      ...(volume != null && { volume }),
      ...(model != null && { model }),
      ...(apiKey != null && { apiKey }),
      ...(typeof ttsFlag === 'object' && ttsFlag !== null ? ttsFlag : {}),
    };

    try {
      const result = await tts.speechText(text, ttsOptions);
      if (result && result.path) {
        el._ttsPath = result.path;
        el._ttsDuration = result.duration || 0;
        this._ttsAudioFiles.push(result.path);
        return { path: result.path, duration: result.duration || 0 };
      }
    } catch (err) {
      console.warn(`[Creator] TTS 生成失败("${text.slice(0, 20)}..."): ${err.message}`);
    }
    return { path: null, duration: 0 };
  }

  async _addElement(scene, audioTrack, el, sceneStartTime) {
    // el 的 startTime / duration 已经在 _buildSection 中被
    // SceneTimeCalculator 补齐,这里直接读
    const {
      type = 'text',
      startTime = 0,
      ...rest
    } = el;

    switch (type) {
	  case 'bg':
	  case 'background':
        scene.addBackground({...rest});
        break;
      case 'text':
        scene.addText(withDefaultAnchor({ ...rest, startTime }));
        break;

      case 'image':
        scene.addImage(withDefaultAnchor({ ...rest, startTime }));
        break;

      case 'video':
        scene.addVideo(withDefaultAnchor({ ...rest, startTime}));
        break;

      case 'rect':
        scene.addRect(withDefaultAnchor({ ...rest, startTime}));
        break;

      case 'circle':
        scene.addCircle(withDefaultAnchor({ ...rest, startTime}));
        break;

      case 'svg':
        scene.addSVG(withDefaultAnchor({ ...rest, startTime}));
        break;

      case 'subtitle':
        await this._addSubtitle(scene, audioTrack, el, startTime, sceneStartTime);
        break;

      case 'audio':
        scene.addAudio({ ...rest, startTime});
        break;

      default:
        console.warn(`[Creator] 未知的元素类型: ${type}`);
    }
  }

  /**
   * 添加字幕元素,集成 TTS:
   *   - TTS 已在 _resolveElementDuration 中生成,路径/时长缓存在 el._ttsPath / el._ttsDuration
   *   - 这里直接复用,不重复调用
   *   - 语音作为音频元素放入独立音频轨道,与字幕同步
   */
  async _addSubtitle(scene, audioTrack, el, startTime=0, sceneStartTime) {
    let {
      text,
      volume,
      // 字幕显示相关
      fontSize = 48,
      color = '#ffffff',
      maxLength = 20,
	  textAlign = 'center',
      textShadow = false,
	  x: '50%',
	  y: '85%', 
	  position,
      animations = ['fadeIn'],
    } = el;

    // 复用 _resolveElementDuration 中生成的 TTS 缓存
    const audioPath = el._ttsPath || null;
    const audioDuration = Math.ceil(el._ttsDuration > 0 ? el._ttsDuration : duration);
    // 把语音加到独立的音频轨道上,保持时间轴与字幕同步
    if (audioPath) {
      const audioScene = audioTrack.createScene({
        duration: audioDuration,
        startTime: sceneStartTime + startTime,
      });
      audioScene.addAudio({
        src: audioPath,
        duration: audioDuration,
        volume: (volume != null ? volume : (this.ttsConfig.volume || 100)) / 100,
        fadeIn: 0.1,
        fadeOut: 0.2,
      });
    }
	if(position==='bottom'){
		x="50%"
		y="85%"
	}
	if(position==='top'){
		x="50%"
		y="15%"
	}
	if(position==='center'){
		x="50%"
		y="50%"
	}
    // 字幕本身(显示用)使用与语音相同的时长
    // 字幕元素自带 position(top/center/bottom) 控制位置,anchor 仅在用户显式传入时生效
    scene.addSubtitle(withDefaultAnchor({
      text,
      fontSize,
      color,
      maxLength,
      animations,
	  textAlign:textAlign,
	  x:x,
	  y:y,
      ...el,
      duration: audioDuration,
      startTime,
    }));
  }

  /**
   * TTS 时长估算(纯本地计算,不调 API)
   * - 中文字符 ~4 字/秒
   * - 英文单词 ~3 词/秒
   * - 数字/标点按 8 字/秒
   * - 语速 rate(-50 ~ +100)按线性调整
   */
  _estimateTtsDuration(text, ttsConfig = {}) {
    if (!text) return 0;
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    const otherChars = text.length - chineseChars - englishWords;
    const baseDuration = chineseChars / 4 + englishWords / 3 + otherChars / 8;
    const rate = ttsConfig.rate ?? 0;
    const speedFactor = 1 / (1 + rate / 100);
    return Math.max(baseDuration * speedFactor, 0.5);
  }

  /**
   * 与 _resolveElementDuration 行为一致,但对 TTS 用估算值(不调用 API)
   * 返回 { duration, source }:
   *   source ∈ 'user' | 'probe' | 'estimate' | 'default'
   */
  async _resolveTimelineElementDuration(el) {
    if (el.duration != null) {
      return { duration: el.duration, source: 'user' };
    }
    if (el.type === 'video' || el.type === 'audio') {
      const d = await probeMediaDuration(el.src);
      return { duration: d || DEFAULT_ELEMENT_DURATION, source: d ? 'probe' : 'default' };
    }
    if (el.type === 'subtitle' && el.tts) {
      const ttsConfig = el.ttsConfig || this.ttsConfig || {};
      return { duration: this._estimateTtsDuration(el.text, ttsConfig), source: 'estimate' };
    }
    return { duration: DEFAULT_ELEMENT_DURATION, source: 'default' };
  }

  /**
   * 获取整个视频的时间线预览(可在 render() 之前调用)
   *
   * 设计原则:
   *   - 不会真正调用 TTS API(用文字长度估算,避免无谓开销)
   *   - video/audio 元素仍用 ffprobe 探测真实时长
   *   - 不会修改原始 cover/slides/footer(深拷贝处理)
   *   - 输出的 source 字段标注时长来源,方便排查
   *
   * @returns {Promise<{
   *   totalDuration: number,
   *   sectionCount: number,
   *   elementCount: number,
   *   ttsConfig: Object,
   *   sections: Array<{
   *     kind: 'cover'|'slide'|'footer',
   *     index: number,
   *     startTime: number,
   *     duration: number,
   *     endTime: number,
   *     background?: string,
   *     title?: string,
   *     subtitle?: string,
   *     elementCount: number,
   *     elements: Array<{
   *       type: string,
   *       startTime: number,
   *       endTime: number,
   *       duration: number,
   *       source: 'user'|'probe'|'estimate'|'default',
   *       autoPlaced: boolean,
   *       text?: string,
   *       src?: string,
   *       tts?: boolean,
   *     }>
   *   }>
   * }>}
   */
  async getTimeline() {
    const sections = this._collectSections();
    if (!sections.length) {
      return {
        totalDuration: 0,
        sectionCount: 0,
        elementCount: 0,
        ttsConfig: { ...this.ttsConfig },
        sections: [],
      };
    }

    // 深拷贝,避免污染原数据
    const cloned = sections.map(s => ({
      ...s,
      elements: (s.elements || []).map(e => ({ ...e })),
    }));

    const resultSections = [];
    let currentTime = 0;
    let totalElementCount = 0;

    for (let i = 0; i < cloned.length; i++) {
      const section = cloned[i];
      const elements = section.elements || [];

      // 解析每个元素的时长(用估算版,避免调用 TTS)
      for (const el of elements) {
        const { duration, source } = await this._resolveTimelineElementDuration(el);
        el.duration = duration;
        el._timelineSource = source;
      }

      // 用 SceneTimeCalculator 汇总
      const calc = new SceneTimeCalculator(elements);
      const calculatedTotal = calc.totalDuration;

      // section 时长:与 _buildSection 保持一致的判定规则
      let sectionDuration;
      if (section.duration != null) {
        sectionDuration = Math.max(section.duration, calculatedTotal);
      } else {
        const fallback = section._kind === 'slide' ? 1 : 3;
        sectionDuration = Math.max(calculatedTotal, fallback);
      }

      resultSections.push({
        kind: section._kind,
        index: i,
        startTime: currentTime,
        duration: sectionDuration,
        endTime: currentTime + sectionDuration,
        background: section.background,
        title: section.title,
        subtitle: section.subtitle,
        elementCount: elements.length,
        elements: calc.processedElements.map(el => ({
          type: el.type,
          startTime: el.startTime,
          endTime: el.startTime + (el.duration || 0),
          duration: el.duration || 0,
          source: el._timelineSource || 'default',
          autoPlaced: el.autoAssigned === true,
          text: el.text,
          src: el.src,
          tts: el.tts === true,
        })),
      });

      totalElementCount += elements.length;
      currentTime += sectionDuration;
    }

    return {
      totalDuration: currentTime,
      sectionCount: cloned.length,
      elementCount: totalElementCount,
      ttsConfig: { ...this.ttsConfig },
      sections: resultSections,
    };
  }

  /**
   * 同步版时间线预览(不调 ffprobe,不调 TTS API,全部走 DEFAULT)
   * 用于快速验证场景结构是否符合预期,不走网络,极快
   *
   * @param {Object} [options]
   * @param {number} [options.defaultDuration=3]  默认元素兜底时长
   * @param {number} [options.fallbackDuration=1] slide 无元素时的 fallback 时长
   * @returns {{ totalDuration: number, sectionCount: number, elementCount: number, sections: Array }}
   */
  getTimelineSync(options = {}) {
    const {
      defaultDuration = DEFAULT_ELEMENT_DURATION,
      fallbackDuration = 1,
    } = options;

    const sections = this._collectSections();
    if (!sections.length) {
      return {
        totalDuration: 0,
        sectionCount: 0,
        elementCount: 0,
        sections: [],
      };
    }

    const cloned = sections.map(s => ({
      ...s,
      elements: (s.elements || []).map(e => ({ ...e })),
    }));

    const resultSections = [];
    let currentTime = 0;
    let totalElementCount = 0;

    for (let i = 0; i < cloned.length; i++) {
      const section = cloned[i];
      const elements = section.elements || [];

      // 所有元素统一用 defaultDuration
      const processed = elements.filter(a=>a.type==='subtitle').map((el, idx) => ({
        ...el,
        duration: el.duration ?? defaultDuration,
        startTime: el.startTime,
        _timelineSource: 'default',
        _idx: idx,
      }));

      const calc = new SceneTimeCalculator(processed);
      const calculatedTotal = calc.totalDuration;

      const sectionFallback = section._kind === 'slide' ? fallbackDuration : 3;
      const sectionDuration = section.duration != null
        ? Math.max(section.duration, calculatedTotal)
        : Math.max(calculatedTotal, sectionFallback);

      resultSections.push({
        kind: section._kind,
        index: i,
        startTime: currentTime,
        duration: sectionDuration,
        endTime: currentTime + sectionDuration,
        background: section.background,
        title: section.title,
        subtitle: section.subtitle,
        elementCount: elements.length,
        elements: calc.processedElements.map(el => ({
          type: el.type,
          startTime: el.startTime,
          endTime: el.startTime + (el.duration || 0),
          duration: el.duration || 0,
          source: el._timelineSource || 'default',
          autoPlaced: el.autoAssigned === true,
          text: el.text,
          src: el.src,
          tts: el.tts === true,
        })),
      });

      totalElementCount += elements.length;
      currentTime += sectionDuration;
    }

    return {
      totalDuration: currentTime,
      sectionCount: cloned.length,
      elementCount: totalElementCount,
      sections: resultSections,
    };
  }

  /**
   * 获取视频总时长(秒)
   * @returns {number} 总时长(秒)
   */
  getTotalDuration() {
    const cover = this.cover;
    const footer = this.footer;

    // 计算 cover 时长
    let total = (cover && cover.duration) ? cover.duration : 3;

    // 累加所有 slide
    for (const slide of this.slides) {
      if (slide.duration != null) {
        total += slide.duration;
      } else if (slide.elements && slide.elements.length > 0) {
        // 估算:取最后一个元素的 startTime + duration
        let lastEnd = 0;
        for (const el of slide.elements) {
          const elEnd = (el.startTime || 0) + (el.duration || DEFAULT_ELEMENT_DURATION);
          if (elEnd > lastEnd) lastEnd = elEnd;
        }
        total += Math.max(lastEnd, 1);
      } else {
        total += 1;
      }
    }

    // 累加 footer 时长
    total += (footer && footer.duration) ? footer.duration : 3;

    // 减去转场重叠部分(最后一个 section + footer 不减)
    const TRANSITION_DURATION = 0.5;
    const sectionCount = (cover ? 1 : 0) + this.slides.length + (footer ? 1 : 0);
    if (sectionCount > 1) {
      total -= TRANSITION_DURATION * (sectionCount - 1);
    }

    return Math.max(0, total);
  }

  /**
   * 打印时间线到控制台(人类可读格式)
   * @param {Object} [options]
   * @param {boolean} [options.compact=false]  紧凑单行模式
   * @param {boolean} [options.sync=false]    true=用 getTimelineSync(快), false=用 getTimeline(准)
   * @param {number}  [options.defaultDuration=3]  sync 模式下默认元素时长
   */
  printTimeline(options = {}) {
    const { compact = false, sync = false, defaultDuration = 3 } = options;

    const timeline = sync
      ? this.getTimelineSync({ defaultDuration })
      : null; // async 版本由调用方自己处理

    if (!sync) {
      console.log('[Creator.printTimeline] 请使用 async/await 调用 printTimelineAsync()');
      return;
    }

    if (!timeline.sections.length) {
      console.log('[Creator] 时间线为空,请先 addCover / addSlide / addFooter');
      return;
    }

    const total = timeline.totalDuration;
    const fmt = (n) => `${n.toFixed(2)}s`;

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  时间线预览  │  总时长: ${fmt(total)}  │  ${timeline.sectionCount} sections  │  ${timeline.elementCount} elements`);
    console.log(`${'═'.repeat(60)}`);

    for (const sec of timeline.sections) {
      const barLen = 30;
      const ratio = sec.duration / total;
      const filled = Math.max(1, Math.round(ratio * barLen));
      const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);
      const kindLabel = { cover: 'COVER', slide: `SLIDE[${sec.index}]`, footer: 'FOOTER' }[sec.kind];

      console.log(`\n[${kindLabel}]  ${fmt(sec.startTime)} → ${fmt(sec.endTime)}  [${bar}]`);

      if (!compact && sec.elements.length) {
        for (const el of sec.elements) {
          const src = el.source === 'default' ? '' : ` [${el.source}]`;
          const placed = el.autoPlaced ? '(auto)' : '';
          const tts = el.tts ? ' 🔊' : '';
          const label = el.text ? `"${el.text.slice(0, 18)}${el.text.length > 18 ? '…' : ''}"` : el.src || '';
          console.log(`    ${fmt(el.startTime)} → ${fmt(el.endTime)}  ${fmt(el.duration)}${src}${placed}${tts}  ${el.type} ${label}`);
        }
      }
    }

    console.log(`\n${'═'.repeat(60)}\n`);
  }

  /**
   * 异步打印时间线(用 getTimeline,最准确)
   * @param {Object} [options]  同 printTimeline
   */
  async printTimelineAsync(options = {}) {
    const { compact = false } = options;
    const timeline = await this.getTimeline();

    if (!timeline.sections.length) {
      console.log('[Creator] 时间线为空,请先 addCover / addSlide / addFooter');
      return;
    }

    const total = timeline.totalDuration;
    const fmt = (n) => `${n.toFixed(2)}s`;

    console.log(`\n${'═'.repeat(64)}`);
    console.log(`  时间线预览  │  总时长: ${fmt(total)}  │  ${timeline.sectionCount} sections  │  ${timeline.elementCount} elements`);
    if (timeline.ttsConfig?.enabled) {
      console.log(`  TTS: voice=${timeline.ttsConfig.voice}  rate=${timeline.ttsConfig.rate}  volume=${timeline.ttsConfig.volume}`);
    }
    console.log(`${'═'.repeat(64)}`);

    for (const sec of timeline.sections) {
      const barLen = 32;
      const ratio = total > 0 ? sec.duration / total : 0;
      const filled = Math.max(1, Math.round(ratio * barLen));
      const bar = '█'.repeat(filled) + '░'.repeat(Math.max(0, barLen - filled));
      const kindLabel = { cover: 'COVER', slide: `SLIDE[${sec.index}]`, footer: 'FOOTER' }[sec.kind];

      const titleStr = sec.title ? ` | "${sec.title}"` : '';
      console.log(`\n[${kindLabel}] ${fmt(sec.startTime)} → ${fmt(sec.endTime)}  [${bar}]${titleStr}`);

      if (!compact && sec.elements.length) {
        for (const el of sec.elements) {
          const srcTag = el.source !== 'default' ? ` [${el.source}]` : '';
          const placed = el.autoPlaced ? ' (auto)' : '';
          const ttsFlag = el.tts ? ' 🔊' : '';
          const label = el.text
            ? `"${el.text.slice(0, 20)}${el.text.length > 20 ? '…' : ''}"`
            : (el.src ? `[${el.src}]` : '');
          console.log(`    ${fmt(el.startTime)} → ${fmt(el.endTime)}  dur=${fmt(el.duration)}${srcTag}${placed}${ttsFlag}  ${el.type.padEnd(10)} ${label}`);
        }
      }
    }

    console.log(`\n${'═'.repeat(64)}\n`);
  }
}

module.exports = {Creator,resource};
