import { useRef, useEffect, useState, type ChangeEvent } from 'react';
import * as d3 from 'd3';

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
  const [visibleGroup, setVisibleGroup] = useState<string>("NO_GROUP");

  useEffect(() => {
    if (!data || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const margin = { top: 40, right: 40, bottom: 60, left: 100 };
    const width = canvas.width - margin.left - margin.right;
    const height = canvas.height - margin.top - margin.bottom;

    ctx.save();
    ctx.translate(margin.left, margin.top);

    const group = data.groupMapping[visibleGroup];
    const categories = group.map(d => d.categoryId);

    const allValues: number[] = group.map(item => data.dataRowMapping[item.dataRowId]?.AC || 0);

    const xScale = d3.scaleBand<string>()
      .domain(categories)
      .range([0, width])
      .padding(0.2);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(allValues) ?? 0])
      .range([height, 0]);

    // Y Axis
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, height);
    ctx.strokeStyle = "#009dff";
    ctx.stroke();

    ctx.fillStyle = "#fff";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    yScale.ticks(5).forEach((tick) => {
      const y = yScale(tick);
      ctx.beginPath();
      ctx.moveTo(-5, y);
      ctx.lineTo(0, y);
      ctx.stroke();
      ctx.fillText(tick.toLocaleString(), -10, y);
    });

    // X Axis
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(width, height);
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    categories.forEach(cat => {
      const x = (xScale(cat) ?? 0) + (xScale.bandwidth() / 2);
      ctx.fillText(cat, x, height + 5);
    });

    const groupColors: Record<string, string> = {
      "NO_GROUP": "steelblue",
      "TOTAL_GROUP": "tomato",
      "AVERAGE_GROUP": "green"
    };

    const color = groupColors[visibleGroup] ?? "gray";

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;

    group.forEach((entry, i) => {
      const ac = data.dataRowMapping[entry.dataRowId]?.AC;
      if (ac === undefined) return;

      const x = (xScale(entry.categoryId) ?? 0) + xScale.bandwidth() / 2;
      const y = yScale(ac);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    ctx.fillStyle = color; // set your fill color
ctx.stroke();           // draw outline (optional)

ctx.beginPath();
ctx.arc(x, y, 2, 0, Math.PI * 2, true); // x, y, radius, startAngle, endAngle
ctx.fillStyle = '#fff'; 
ctx.fill();             
ctx.lineWidth = 2;     
ctx.strokeStyle = color; 
// ctx.stroke();          

      ctx.fillStyle="#fff"
      ctx.fillText(ac.toLocaleString(), x, y - 20);
    });
    ctx.stroke();

    ctx.restore();

  }, [data, visibleGroup]);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
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
        <select value={visibleGroup} onChange={(e) => setVisibleGroup(e.target.value)}>
          {Object.keys(data.groupMapping).map(groupName => (
            <option key={groupName} value={groupName}>{groupName}</option>
          ))}
        </select>
      )}
      <canvas
        ref={canvasRef}
        width={900}
        height={400}
        className="chart-canvas"
      />
    </div>
  );
}
