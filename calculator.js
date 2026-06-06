/**
 * 完整的场景时间计算器
 * 支持：有/无 startTime，有/无 duration
 */
class SceneTimeCalculator {
  constructor(elements) {
    this.elements = elements || [];
    this.processedElements = [];
    this.totalDuration = 0;
    this.process();
  }
  
  process() {
    if (!this.elements.length) return;
    
    // 1. 分离有 startTime 和无 startTime 的元素
    const withStartTime = [];
    const withoutStartTime = [];
    
    for (const el of this.elements) {
      if (el.startTime !== undefined && el.startTime !== null) {
        withStartTime.push({ ...el });
      } else {
        withoutStartTime.push({ ...el });
      }
    }
    
    // 2. 排序有 startTime 的元素
    withStartTime.sort((a, b) => a.startTime - b.startTime);
    
    // 3. 合并处理，自动填充无 startTime 的元素
    let currentTime = 0;
    let withoutIndex = 0;
    const allElements = [];
    
    for (const element of withStartTime) {
      // 在当前有 startTime 的元素之前，插入无 startTime 的元素
      while (withoutIndex < withoutStartTime.length && currentTime < element.startTime) {
        const waitingEl = withoutStartTime[withoutIndex];
        waitingEl.startTime = currentTime;
        waitingEl.autoAssigned = true;
        allElements.push(waitingEl);
        
        // 更新当前时间
          currentTime += (waitingEl.duration ?? 0);
        withoutIndex++;
      }
      
      // 添加当前有 startTime 的元素
      element.autoAssigned = false;
      allElements.push(element);
      
      // 更新当前时间
      const elementEnd = element.startTime + (element.duration ?? 0);
      currentTime = Math.max(currentTime, elementEnd);
    }
    
    // 添加剩余的无 startTime 元素
    while (withoutIndex < withoutStartTime.length) {
      const remainingEl = withoutStartTime[withoutIndex];
      remainingEl.startTime = currentTime;
      remainingEl.autoAssigned = true;
      allElements.push(remainingEl);
      
      currentTime += (remainingEl.duration ?? 0);
      withoutIndex++;
    }
    
    this.processedElements = allElements;
    this.totalDuration = currentTime;
  }
  
  /**
   * 获取总时长
   */
  getTotal() {
    return {
      seconds: this.totalDuration,
      formatted: this.formatTime(this.totalDuration)
    };
  }
  
  /**
   * 获取所有元素的时间线
   */
  getTimeline() {
    return this.processedElements.map((el, index) => ({
      index: index,
      name: el.name || el.id || `Element-${index}`,
      startTime: el.startTime,
      endTime: el.startTime + (el.duration ?? 0),
      duration: el.duration ?? 0,
      autoAssigned: el.autoAssigned,
      originalStartTime: el.originalStartTime
    }));
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    const withAutoAssign = this.processedElements.filter(el => el.autoAssigned).length;
    const totalElements = this.processedElements.length;
    
    return {
      totalElements: totalElements,
      autoAssignedCount: withAutoAssign,
      manuallyPlacedCount: totalElements - withAutoAssign,
      totalDuration: this.totalDuration,
      averageDuration: this.totalDuration / totalElements
    };
  }
  
  /**
   * 格式化时间
   */
  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return minutes > 0 ? `${minutes}:${secs.padStart(5, '0')}` : `${secs}s`;
  }
}


module.exports = SceneTimeCalculator