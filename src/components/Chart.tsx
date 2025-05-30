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
  const [data, setData] = useState<ChartData | null>(null);
  const [visibleGroup, setVisibleGroup] = useState<string>('NO_GROUP');
  const [selectedChartType, setSelectedChartType] = useState<string>('GChart');

  useEffect(() => {
    if (!data || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    const margin = { top: 40, right: 40, bottom: 60, left: 100 };
    const width = canvas.width - margin.left - margin.right;
    const height = canvas.height - margin.top - margin.bottom;
    ctx.translate(margin.left, margin.top);

    const group = data.groupMapping[visibleGroup];
    const categories = group.map((d) => d.categoryId);
    const acValues: number[] = group
      .map((item) => data.dataRowMapping[item.dataRowId]?.AC)
      .filter((v): v is number => typeof v === 'number');

    if (acValues.length === 0) return;

    // Calculate control limits
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

    // Y Axis
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, height);
    ctx.strokeStyle = '#009dff';
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    yScale.ticks(5).forEach((tick) => {
      const y = yScale(tick);
      ctx.beginPath();
      ctx.moveTo(-5, y);
      ctx.lineTo(0, y);
      ctx.stroke();
      ctx.fillText(tick.toFixed(2), -10, y);
    });
    
    // X Axis
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(width, height);
    ctx.stroke();
    
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    categories.forEach((cat) => {
      const replace=(cat:string)=>{ 
        return cat.replace("R0-%-","")
      }
      const x = (xScale(cat) ?? 0) + xScale.bandwidth() / 2;
      ctx.fillText(replace(cat), x, height + 5);
    });
    const groupColors: Record<string, string> = {
      NO_GROUP: '#0FF0FC',
      TOTAL_GROUP: 'tomato',
      AVERAGE_GROUP: 'green',
    };
    
    const color = groupColors[visibleGroup] ?? 'gray';
    
    // Draw line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    group.forEach((entry, i) => {
      const ac = data.dataRowMapping[entry.dataRowId]?.AC;
      if (typeof ac !== 'number') return;
      const x = (xScale(entry.categoryId) ?? 0) + xScale.bandwidth() / 2;
      const y = yScale(ac);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // Draw points and labels
    group.forEach((entry) => {
      const ac = data.dataRowMapping[entry.dataRowId]?.AC;
      if (typeof ac !== 'number') return;
      const x = (xScale(entry.categoryId) ?? 0) + xScale.bandwidth() / 2;
      const y = yScale(ac);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.fillText(ac.toFixed(2), x, y - 20);
    });

    // CL Line
    ctx.strokeStyle = '#FFFF33'; // Neon Yellow
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, yScale(limits.cl));
    ctx.lineTo(width, yScale(limits.cl));
    ctx.stroke();
    ctx.fillText(`CL: ${limits.cl.toFixed(2)}`, width - 5, yScale(limits.cl) - 5);

    // UCL Line
    ctx.strokeStyle = '#39FF14'; // Neon Green
    ctx.beginPath();
    ctx.moveTo(0, yScale(limits.ucl));
    ctx.lineTo(width, yScale(limits.ucl));
    ctx.stroke();
    ctx.fillText(`UCL: ${limits.ucl.toFixed(2)}`, width - 5, yScale(limits.ucl) - 5);

    // LCL Line
    ctx.strokeStyle = '#FF073A'; // Neon Red
    ctx.beginPath();
    ctx.moveTo(0, yScale(limits.lcl));
    ctx.lineTo(width, yScale(limits.lcl));
    ctx.stroke();
    ctx.fillText(`LCL: ${limits.lcl.toFixed(2)}`, width - 5, yScale(limits.lcl) - 5);

    ctx.restore();
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
      <canvas ref={canvasRef} width={900} height={400} className="chart-canvas" />
    </div>
  );
}
