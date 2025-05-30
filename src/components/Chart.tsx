import { useRef, useEffect, useState, type ChangeEvent } from 'react';
import * as d3 from 'd3';
import {
  calculateGChartLimits,
  calculateTChartLimits,
  calculateIChartLimits,
  type ChartLimits,
} from './calculate';

type GroupItem = {
  categoryId: string;
  dataRowId: string;
};

type GroupMapping = {
  [groupName: string]: GroupItem[];
};

type DataRow = {
  AC: number;
  WATERFALL_AC: number[];
};

type DataRowMapping = {
  [dataRowId: string]: DataRow;
};

type ChartData = {
  groupMapping: GroupMapping;
  dataRowMapping: DataRowMapping;
};

export default function ChartFromFile() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Offscreen canvases refs
  const offscreenLineCanvas = useRef<HTMLCanvasElement | null>(null);
  const offscreenQualityCanvas = useRef<HTMLCanvasElement | null>(null);

  const [data, setData] = useState<ChartData | null>(null);
  const [visibleGroup, setVisibleGroup] = useState<string>('NO_GROUP');
  const [selectedChartType, setSelectedChartType] = useState<string>('GChart');

  useEffect(() => {
    if (!data || !canvasRef.current) return;

    const ratio = window.devicePixelRatio || 1;
    const logicalWidth = 900;
    const logicalHeight = 400;

    const margin = { top: 40, right: 40, bottom: 60, left: 100 };
    const width = logicalWidth - margin.left - margin.right;
    const height = logicalHeight - margin.top - margin.bottom;

    // Initialize offscreen canvas
    if (!offscreenLineCanvas.current) {
      offscreenLineCanvas.current = document.createElement('canvas');
      offscreenLineCanvas.current.width = logicalWidth * ratio;
      offscreenLineCanvas.current.height = logicalHeight * ratio;
      offscreenLineCanvas.current.style.width = logicalWidth + 'px';
      offscreenLineCanvas.current.style.height = logicalHeight + 'px';
    }
    if (!offscreenQualityCanvas.current) {
      offscreenQualityCanvas.current = document.createElement('canvas');
      offscreenQualityCanvas.current.width = logicalWidth * ratio;
      offscreenQualityCanvas.current.height = logicalHeight * ratio;
      offscreenQualityCanvas.current.style.width = logicalWidth + 'px';
      offscreenQualityCanvas.current.style.height = logicalHeight + 'px';
    }

    // Get contexts
    const lineCtx = offscreenLineCanvas.current.getContext('2d');
    const qualityCtx = offscreenQualityCanvas.current.getContext('2d');
    const mainCanvas = canvasRef.current;
    const mainCtx = mainCanvas.getContext('2d');

    if (!lineCtx || !qualityCtx || !mainCtx) return;

    // Setup main canvas
    mainCanvas.width = logicalWidth * ratio;
    mainCanvas.height = logicalHeight * ratio;
    mainCanvas.style.width = logicalWidth + 'px';
    mainCanvas.style.height = logicalHeight + 'px';

    mainCtx.setTransform(1, 0, 0, 1, 0, 0);
    mainCtx.scale(ratio, ratio);

    // Setup offscreen canvases contexts scale
    [lineCtx, qualityCtx].forEach((ctx) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(ratio, ratio);
      ctx.clearRect(0, 0, logicalWidth, logicalHeight);
      ctx.save();
      ctx.translate(margin.left, margin.top);
    });

    // Prepare common data
    const group = data.groupMapping[visibleGroup];
    const categories = group.map((d) => d.categoryId);
    const acValues: number[] = group
      .map((item) => data.dataRowMapping[item.dataRowId]?.AC)
      .filter((v): v is number => typeof v === 'number');

    if (acValues.length === 0) return;

    // Calculate limits
    let limits: ChartLimits;
    if (selectedChartType === 'TChart') {
      limits = calculateTChartLimits(acValues);
    } else if (selectedChartType === 'IChart') {
      limits = calculateIChartLimits(acValues);
    } else {
      limits = calculateGChartLimits(acValues);
    }

    const yMax = Math.max(d3.max(acValues) ?? 0, limits.ucl);

    const xScale = d3.scaleBand<string>().domain(categories).range([0, width]).padding(0.2);
    const yScale = d3.scaleLinear().domain([0, yMax * 1.05]).range([height, 0]);

    // Draw Y axis on quality canvas
    qualityCtx.strokeStyle = '#009dff';
    qualityCtx.beginPath();
    qualityCtx.moveTo(0, 0);
    qualityCtx.lineTo(0, height);
    qualityCtx.stroke();

    qualityCtx.fillStyle = '#fff';
    qualityCtx.textAlign = 'right';
    qualityCtx.textBaseline = 'middle';
    yScale.ticks(5).forEach((tick) => {
      const y = yScale(tick);
      qualityCtx.beginPath();
      qualityCtx.moveTo(-5, y);
      qualityCtx.lineTo(0, y);
      qualityCtx.stroke();
      qualityCtx.fillText(tick.toFixed(2), -10, y);
    });

    // Draw X axis on quality canvas
    qualityCtx.beginPath();
    qualityCtx.moveTo(0, height);
    qualityCtx.lineTo(width, height);
    qualityCtx.stroke();

    qualityCtx.textAlign = 'center';
    qualityCtx.textBaseline = 'top';
    categories.forEach((cat) => {
      const replace = (cat: string) => cat.replace("R0-%-", "");
      const x = (xScale(cat) ?? 0) + xScale.bandwidth() / 2;
      qualityCtx.fillText(replace(cat), x, height + 5);
    });

    // Draw control limit lines on quality canvas
    const drawLimitLine = (ctx: CanvasRenderingContext2D, value: number, color: string, label: string) => {
      ctx.strokeStyle = color;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(0, yScale(value));
      ctx.lineTo(width, yScale(value));
      ctx.stroke();
      ctx.fillText(`${label}: ${value.toFixed(2)}`, width - 5, yScale(value) - 5);
    };

    drawLimitLine(qualityCtx, limits.cl, '#FFFF33', 'CL'); 
    drawLimitLine(qualityCtx, limits.ucl, '#39FF14', 'UCL'); 
    drawLimitLine(qualityCtx, limits.lcl, '#FF073A', 'LCL'); 

    qualityCtx.restore();

    //line chart on line canvas
    const groupColors: Record<string, string> = {
      NO_GROUP: '#0FF0FC',
      TOTAL_GROUP: 'tomato',
      AVERAGE_GROUP: 'green',
    };
    const color = groupColors[visibleGroup] ?? 'gray';

    lineCtx.strokeStyle = color;
    lineCtx.lineWidth = 2;
    lineCtx.beginPath();
    group.forEach((entry, i) => {
      const ac = data.dataRowMapping[entry.dataRowId]?.AC;
      if (typeof ac !== 'number') return;
      const x = (xScale(entry.categoryId) ?? 0) + xScale.bandwidth() / 2;
      const y = yScale(ac);
      if (i === 0) lineCtx.moveTo(x, y);
      else lineCtx.lineTo(x, y);
    });
    lineCtx.stroke();

    // Draw points and labels on line canvas
    group.forEach((entry) => {
      const ac = data.dataRowMapping[entry.dataRowId]?.AC;
      if (typeof ac !== 'number') return;
      const x = (xScale(entry.categoryId) ?? 0) + xScale.bandwidth() / 2;
      const y = yScale(ac);
      lineCtx.beginPath();
      lineCtx.arc(x, y, 4, 0, Math.PI * 2);
      lineCtx.fillStyle = '#fff';
      lineCtx.fill();
      lineCtx.lineWidth = 2;
      lineCtx.strokeStyle = color;
      lineCtx.stroke();
      lineCtx.fillStyle = '#fff';
      lineCtx.fillText(ac.toFixed(2), x, y - 20);
    });

    lineCtx.restore();

    // Clear main canvas
    mainCtx.clearRect(0, 0, logicalWidth, logicalHeight);

    // quality
    mainCtx.drawImage(offscreenQualityCanvas.current, 0, 0, logicalWidth, logicalHeight);

    //line 
    mainCtx.drawImage(offscreenLineCanvas.current, 0, 0, logicalWidth, logicalHeight);

  }, [data, visibleGroup, selectedChartType]);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      if (typeof evt.target?.result === 'string') {
        const json = JSON.parse(evt.target.result) as ChartData;
        setData(json);
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="chart-container">
      <input type="file" accept=".json" onChange={handleFileChange} />
      {data && (
        <>
          <select value={visibleGroup} onChange={(e) => setVisibleGroup(e.target.value)}>
            {Object.keys(data.groupMapping).map((groupName) => (
              <option key={groupName} value={groupName}>
                {groupName}
              </option>
            ))}
          </select>

          <select value={selectedChartType} onChange={(e) => setSelectedChartType(e.target.value)}>
            <option value="GChart">GChart</option>
            <option value="TChart">TChart</option>
            <option value="IChart">IChart</option>
          </select>
        </>
      )}
      <canvas ref={canvasRef} className="chart-canvas" />
    </div>
  );
}
