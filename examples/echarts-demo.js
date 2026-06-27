/**
 * ECharts 图表视频示例
 * 演示：片头 → 多个 ECharts 图表场景 → 片尾
 *
 * 运行： node examples/echarts-demo.js
 */

const path = require('path');
const { Creator } = require('../index');

async function main() {
  const creator = new Creator({
    width: 1280,
    height: 720,
    fps: 30,
    randomTransition: {
      enabled: true,
      animations: true,
    },
  });

  // 1) 片头
  creator.addCover({
    title: '数据可视化报告',
    subtitle: 'ECharts + fomo 视频生成',
    duration: 3,
  });

  // 2) 柱状图 - 各月销售额
  creator.addSlide({
    background: '#1a1a2e',
    duration: 6,
    elements: [
      {
        type: 'text',
        text: '月度销售额',
        x: '50%', y: '8%',
        fontSize: 48,
        color: '#ffe66d',
        anchor: [0.5, 0.5],
        textAlign: 'center',
        startTime: 0,
        animations: ['fadeIn'],
      },
      {
        type: 'echarts',
        x: '50%', y: '50%',
        width: '85%', height: '75%',
        startTime: 0,
        option: {
          backgroundColor: 'transparent',
          animation: true,
          animationDuration: 1500,
          grid: { left: '8%', right: '5%', top: '10%', bottom: '12%' },
          xAxis: {
            type: 'category',
            data: ['1月', '2月', '3月', '4月', '5月', '6月'],
            axisLabel: { color: '#ccc', fontSize: 16 },
            axisLine: { lineStyle: { color: '#555' } },
          },
          yAxis: {
            type: 'value',
            axisLabel: { color: '#ccc', fontSize: 14 },
            splitLine: { lineStyle: { color: '#333' } },
          },
          series: [{
            type: 'bar',
            data: [120, 200, 150, 80, 270, 310],
            itemStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: '#ff6b6b' },
                  { offset: 1, color: '#ee5a24' },
                ],
              },
              borderRadius: [6, 6, 0, 0],
            },
            barWidth: '50%',
          }],
        },
      },
    ],
  });

  // 3) 折线图 - 用户增长趋势
  creator.addSlide({
    background: '#0f3460',
    duration: 6,
    elements: [
      {
        type: 'text',
        text: '用户增长趋势',
        x: '50%', y: '8%',
        fontSize: 48,
        color: '#ffe66d',
        anchor: [0.5, 0.5],
        textAlign: 'center',
        startTime: 0,
        animations: ['fadeIn'],
      },
      {
        type: 'echarts',
        x: '50%', y: '50%',
        width: '85%', height: '75%',
        startTime: 0,
        option: {
          backgroundColor: 'transparent',
          animation: true,
          animationDuration: 2000,
          grid: { left: '8%', right: '5%', top: '10%', bottom: '12%' },
          xAxis: {
            type: 'category',
            data: ['Q1', 'Q2', 'Q3', 'Q4'],
            axisLabel: { color: '#ccc', fontSize: 16 },
            axisLine: { lineStyle: { color: '#555' } },
          },
          yAxis: {
            type: 'value',
            axisLabel: { color: '#ccc', fontSize: 14 },
            splitLine: { lineStyle: { color: '#333' } },
          },
          series: [{
            type: 'line',
            data: [1500, 3200, 5800, 12000],
            smooth: true,
            lineStyle: { width: 4, color: '#00d2ff' },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(0, 210, 255, 0.4)' },
                  { offset: 1, color: 'rgba(0, 210, 255, 0.05)' },
                ],
              },
            },
            symbol: 'circle',
            symbolSize: 10,
            itemStyle: { color: '#00d2ff' },
          }],
        },
      },
    ],
  });

  // 4) 饼图 - 市场份额
  creator.addSlide({
    background: '#16213e',
    duration: 6,
    elements: [
      {
        type: 'text',
        text: '市场份额分布',
        x: '50%', y: '8%',
        fontSize: 48,
        color: '#ffe66d',
        anchor: [0.5, 0.5],
        textAlign: 'center',
        startTime: 0,
        animations: ['fadeIn'],
      },
      {
        type: 'echarts',
        x: '50%', y: '52%',
        width: '70%', height: '78%',
        startTime: 0,
        option: {
          backgroundColor: 'transparent',
          animation: true,
          animationDuration: 1200,
          tooltip: { trigger: 'item' },
          series: [{
            type: 'pie',
            radius: ['0%', '65%'],
            center: ['50%', '50%'],
            roseType: 'area',
            label: {
              color: '#fff',
              fontSize: 16,
              formatter: '{b}: {d}%',
            },
            labelLine: { lineStyle: { color: '#666' } },
            data: [
              { value: 35, name: '产品A', itemStyle: { color: '#ff6b6b' } },
              { value: 28, name: '产品B', itemStyle: { color: '#48dbfb' } },
              { value: 22, name: '产品C', itemStyle: { color: '#ffd93d' } },
              { value: 15, name: '产品D', itemStyle: { color: '#6bcb77' } },
            ],
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: 'rgba(0, 0, 0, 0.5)',
              },
            },
          }],
        },
      },
    ],
  });

  // 5) 片尾
  creator.addFooter({
    title: '谢谢观看',
    subtitle: '数据驱动决策',
    duration: 3,
  });

  // 渲染
  const output = path.join(__dirname, '..', 'output', 'echarts-demo.mp4');
  await creator.render(output, {
    parallel: false,
    usePipe: true,
    maxWorkers: 4,
  });

  console.log('视频已生成:', output);
}

main().catch(err => {
  console.error('渲染失败:', err);
  process.exit(1);
});
