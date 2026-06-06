exports.searchBaiduImage = async function(word, pn = 0) {
    try {
        // 构建URL参数
        const params = new URLSearchParams({
            word: word,
            tn: 'resultjson_com',
            ipn: 'r',
            pn: pn,           // 页码，从传入参数获取
            fm: 'index',
            pos: 'history',
            cl: 2,
            lm: -1,
            oe: 'utf-8',
            nc: 1,
            isAsync: 'true',
            rn: 100,          // 每页数量
            gsm: '1e',
            ie: 'utf-8'
        });
        
        const url = `https://image.baidu.com/search/acjson?${params.toString()}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2',
                'Connection': 'keep-alive',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
                'Upgrade-Insecure-Requests': '1'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        // 处理返回数据
        if (result?.data && Array.isArray(result.data)) {
            const images = result.data
                .filter(item => item.width) // 过滤没有宽度的项
                .map(item => {
                    const url = item.replaceUrl?.[0]?.ObjURL || item.middleURL;
                    return {
                        ...item,
                        url: url
                    };
                });
            
            return images;
        }
        
        return [];
        
    } catch (error) {
        console.error('百度图片搜索出错:', error.message);
        return [];
    }
};

/**
 * 百度AIGC视频/图片搜索
 * @param {string} text - 搜索关键词
 * @param {string} px - 平台类型 'pc' 或其他
 * @param {string} type - 类型 'video' 或 'image'，默认 'video'
 * @param {Object} header - 请求头配置（必需包含 cookie）
 * @returns {Promise<Array>} 素材列表
 */
exports.baiduVideos = async function(text, options={}) {
    // 参数验证
    if (!text || typeof text !== 'string') {
        console.error('搜索关键词不能为空');
        return [];
    }
    const { pc, type = "video", header = {} } = options;
    
    // 检查 cookie
    if (!header.cookie) {
        console.error('[BAIDU_VIDEOS] 缺少 cookie，请先登录百度后获取');
        return [];
    }
    try {
        const plateType = pc === 'pc' ? 3 : 1;
        const params = new URLSearchParams({
            text: text,
            type: type,
            duration: '0',
            plateType: plateType.toString()
        });
        
        const url = `https://aigc.baidu.com/aigc/saas/pc/v1/assist/searchList?${params.toString()}`;
        
        console.log('[请求URL]', url);
        
        // 设置超时
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Cache-Control': 'no-cache',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
                'Referer': 'https://aigc.baidu.com/',
                'Origin': 'https://aigc.baidu.com',
				...header
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        // 检查返回状态
        if (result.errno !== 0) {
            console.warn('[API返回错误]', result.message || '未知错误');
            return [];
        }
        
        // 获取素材列表
        const materialList = result?.data?.material?.[0]?.list || [];
        
        console.log(`[VIDEOS LIST] 共获取 ${materialList.length} 条${type === 'video' ? '视频' : '图片'}`);
        
        // 返回格式化的数据
        return materialList.map(item => ({
            id: item.id,
            title: item.title,
            url: item.url,
            coverUrl: item.coverUrl,
            duration: item.duration,
            width: item.width,
            height: item.height,
            source: item.source,
            ...item // 保留原始数据
        }));
        
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('请求超时，请检查网络连接');
        } else if (error.message.includes('fetch')) {
            console.error('网络请求失败，请检查网络连接');
        } else {
            console.error('百度视频搜索出错:', error.message);
        }
        return [];
    }
};