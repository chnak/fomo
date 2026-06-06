/**
 * TTS (Text-to-Speech) 模块
 * 使用 MiniMax API 生成语音
 */

const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const { MiniMaxSpeech } = require('minimax-speech-ts');

// MiniMax 客户端（延迟初始化）
let miniMaxClient = null;
let cachedApiKey = null;

function getMiniMaxClient(options = {}) {
  // 优先使用传入的 API key，其次使用缓存的环境变量
  const apiKey = options.apiKey || process.env.MINIMAX_API_KEY;
  
  // 如果 API key 改变，重置客户端
  if (apiKey !== cachedApiKey) {
    miniMaxClient = null;
    cachedApiKey = apiKey;
  }
  
  if (!miniMaxClient && apiKey) {
    miniMaxClient = new MiniMaxSpeech({
      apiKey: apiKey,
      //groupId: options.groupId || process.env.MINIMAX_GROUP_ID,
      apiHost: 'https://api.minimaxi.com',
    });
  }
  return miniMaxClient;
}

/**
 * TTS 配置
 */
const defaultConfig = {
  voice: 'Chinese (Mandarin)_Warm_Bestie',   // MiniMax 语音 ID
  rate: 0,                   // 语速 (0.5 到 2.0)
  volume: 100,              // 音量 (0 到 100)
  outputFormat: 'mp3',      // 输出格式：mp3, wav, pcm, flac
  outputDir: null,          // 输出目录，null 使用系统临时目录
  model: 'speech-2.8-hd',    // MiniMax 模型
};

/**
 * 可用的中文语音列表（MiniMax 系统语音）
 */
const chineseVoices = [
  'female-shaonv-jingpin',    // 甜妹 - 温柔甜美
  'male-qn-qingse',   // 云扬 - 知性大方
  'female-tianmei-jingpin',         // 京哥 - 磁性低沉
  'clever_boy',     // 少女 - 活泼可爱
  'lovely_girl',      // 元宝 - 阳光活力
];

/**
 * 获取可用的 MiniMax 语音列表
 * @returns {Promise<Array>} 语音列表
 */
async function getAvailableVoices(options = {}) {
  try {
    const client = getMiniMaxClient(options);
    if (!client) {
      return chineseVoices.map(id => ({ voiceId: id, name: id }));
    }
    const result = await client.getVoices({ voiceType: 'system' });
    return result.systemVoice || [];
  } catch (err) {
    console.warn('[TTS] 获取语音列表失败:', err.message);
    return chineseVoices.map(id => ({ voiceId: id, name: id }));
  }
}

/**
 * 生成 TTS 音频文件
 * @param {string} text - 要转换的文本
 * @param {Object} options - TTS 配置
 * @returns {Promise<string>} 生成的音频文件路径
 */
async function generateSpeech(text, options = {}) {
  if (!text || !text.trim()) {
    return null;
  }

  const config = { ...defaultConfig, ...options };
  
  // 创建输出目录
  const outputDir = config.outputDir || path.join(os.tmpdir(), 'video-tts');
  await fs.ensureDir(outputDir);

  // 生成唯一的文件名
  const timestamp = Date.now();
  const hash = Math.random().toString(36).substring(2, 8);
  const extension = config.outputFormat === 'wav' ? 'wav' : 'mp3';
  const filename = `tts_${timestamp}_${hash}`;
  const outputPath = path.join(outputDir, `${filename}.${extension}`);

  try {
    // 使用 MiniMax API 生成语音
    const client = getMiniMaxClient(config);
    
    // 计算语速 (MiniMax 使用 0.5-2.0，默认 1.0)
    // rate: -10 到 10 → 转换为 0.5 到 2.0
    const speed = config.rate !== undefined 
      ? Math.max(0.5, Math.min(2.0, 1 + config.rate / 20)) 
      : 1.0;

    const result = await client.synthesize({
      text: text,
      model: config.model || 'speech-02-hd',
      voiceSetting: {
        voiceId: config.voice || 'female-tianmei',
        speed: speed,
      },
      audioSetting: {
        format: config.outputFormat || 'mp3',
        sampleRate: 32000,
      },
    });

    // 保存音频文件
    await fs.writeFile(outputPath, result.audio);
    
    console.log(`[TTS] 语音生成成功: ${outputPath}`);
    return outputPath;
  } catch (err) {
	  console.log(err)
    throw new Error(`MiniMax TTS 生成失败: ${err.message}`);
  }
}

/**
 * 从字幕内容中提取需要语音的文本（仅 subtitle 类型）
 * @param {Object} templateConfig - 模板配置
 * @returns {Array} 字幕项列表
 */
function extractSubtitleContent(templateConfig) {
  const items = [];
  
  // 新格式: scenes 数组
  if (templateConfig.scenes && Array.isArray(templateConfig.scenes)) {
    templateConfig.scenes.forEach((scene, index) => {
      // 处理 subtitles 数组
      if (scene.subtitles && Array.isArray(scene.subtitles)) {
        scene.subtitles.forEach((sub, subIndex) => {
          const text = typeof sub === 'string' ? sub : sub.text;
          if (text && text.toString().trim()) {
            items.push({
              text: text.toString().trim(),
              type: 'subtitle',
              section: `scene_${index}_${subIndex}`,
            });
          }
        });
      }
      // 也支持单个 subtitle 字段
      if (scene.subtitle && !scene.subtitles) {
        const text = typeof scene.subtitle === 'string' ? scene.subtitle : scene.subtitle.text;
        if (text && text.toString().trim()) {
          items.push({
            text: text.toString().trim(),
            type: 'subtitle',
            section: `scene_${index}`,
          });
        }
      }
    });
  }
  
  // 旧格式: contents 数组
  if (templateConfig.contents) {
    templateConfig.contents.forEach((scene, index) => {
      if (Array.isArray(scene)) {
        scene.forEach(item => {
          if (item.type === 'subtitle' && item.text && item.text.toString().trim()) {
            items.push({
              text: item.text.toString().trim(),
              type: 'subtitle',
              section: `content_${index}`,
            });
          }
        });
      }
    });
  }
  
  return items;
}

/**
 * 获取音频文件时长（秒）- 使用 FFprobe
 * @param {string} audioPath - 音频文件路径
 * @returns {Promise<number>} 时长（秒）
 */
async function getAudioDuration(audioPath) {
  const { spawn } = require('child_process');
  
  return new Promise((resolve, reject) => {
    const ps = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      audioPath
    ]);

    let output = '';
    ps.stdout.on('data', (data) => {
      output += data.toString();
    });

    ps.on('close', (code) => {
      const duration = parseFloat(output.trim()) || 0;
      resolve(duration);
    });

    ps.on('error', () => {
      resolve(0);
    });
  });
}

async function speechText(text, options = {}) {
	console.log(`[TTS] 生成字幕语音: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`);
	const audioPath = await generateSpeech(text, options);
	let duration = 0
	if (audioPath) {
		duration = await getAudioDuration(audioPath);
        console.log(`[TTS] 语音时长: ${duration.toFixed(2)} 秒`);
	}
	return {path:audioPath,duration}
}

/**
 * 生成字幕语音（仅处理 subtitle 类型）
 * @param {Object} templateConfig - 模板配置
 * @param {Object} options - TTS 配置
 * @returns {Promise<Array>} 生成的语音文件列表 [{ text, audioPath, startTime, duration }]
 */
async function generateSubtitleSpeech(templateConfig, options = {}) {
  const textItems = extractSubtitleContent(templateConfig);
  const results = [];
  
  // 计算场景时间线
  const sceneTimeline = [];
  let sceneStartTime = 0;
  
  if (templateConfig.scenes && Array.isArray(templateConfig.scenes)) {
    templateConfig.scenes.forEach((scene, index) => {
      sceneTimeline.push({
        index,
        startTime: sceneStartTime,
        duration: scene.duration || 5,
      });
      sceneStartTime += scene.duration || 5;
    });
  }
  
  // 按场景时间线分配音频
  let currentTime = 0;
  
  for (const item of textItems) {
    try {
      console.log(`[TTS] 生成字幕语音: "${item.text.substring(0, 30)}${item.text.length > 30 ? '...' : ''}"`);
      
      const audioPath = await generateSpeech(item.text, options);
      
      if (audioPath) {
        // 获取真实音频时长
        const duration = await getAudioDuration(audioPath);
        console.log(`[TTS] 语音时长: ${duration.toFixed(2)} 秒`);
        
        // 根据 section 找到对应的场景时间
        let startTime = currentTime;
        const sectionMatch = item.section.match(/scene_(\d+)/);
        if (sectionMatch && sceneTimeline.length > 0) {
          const sceneIndex = parseInt(sectionMatch[1]);
          const scene = sceneTimeline[sceneIndex];
          if (scene) {
            startTime = scene.startTime;
          }
        }
        
        results.push({
          text: item.text,
          audioPath,
          startTime: startTime,
          duration: duration,
          type: 'subtitle',
          section: item.section,
        });
        
        // 更新时间（用于没有匹配到场景的情况）
        currentTime += duration;
      }
    } catch (err) {
      console.warn(`[TTS] 生成字幕语音失败: "${item.text.substring(0, 20)}..." - ${err.message}`);
    }
  }
  
  return results;
}

/**
 * 清理 TTS 生成的临时文件
 * @param {Array} audioFiles - 音频文件路径列表
 */
async function cleanupTempFiles(audioFiles) {
  for (const file of audioFiles) {
    try {
      if (file && await fs.pathExists(file)) {
        await fs.remove(file);
      }
    } catch (err) {
      // 忽略删除错误
    }
  }
}

module.exports = {
  generateSpeech,
  generateSubtitleSpeech,
  extractSubtitleContent,
  getAudioDuration,
  getAvailableVoices,
  cleanupTempFiles,
  chineseVoices,
  speechText,
  defaultConfig,
};