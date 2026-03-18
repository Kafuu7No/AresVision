import { useState, useEffect } from 'react';
import C from '../../../constants/colors';
import { useT } from '../../../i18n';

export default function RealtimeMonitor() {
  const t = useT();
  const [dataPoints, setDataPoints] = useState([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setDataPoints(prev => {
        const newPoint = {
          x: prev.length * 15 + 60,
          y: 200 + Math.sin(prev.length * 0.2) * 80 + Math.random() * 30
        };
        return [...prev.slice(-40), newPoint]; // 保持最后40个点
      });
    }, 300);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <svg width="100%" height="100%" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="realtimeGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke={C.border} strokeWidth="1" />
          </pattern>
          <filter id="realtimeGlow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width="100%" height="100%" fill="url(#realtimeGrid)" />

        {/* 实时曲线 */}
        {dataPoints.length > 1 && (
          <polyline
            points={dataPoints.map(p => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={C.blue}
            strokeWidth="3"
            filter="url(#realtimeGlow)"
          />
        )}

        {/* 数据点 */}
        {dataPoints.map((point, i) => (
          <circle
            key={i}
            cx={point.x}
            cy={point.y}
            r={i === dataPoints.length - 1 ? "5" : "2"}
            fill={i === dataPoints.length - 1 ? C.mars : C.ice}
            opacity={0.4 + (i / dataPoints.length) * 0.6}
            filter="url(#realtimeGlow)"
          />
        ))}

        {/* 实时数值显示 */}
        {dataPoints.length > 0 && (
          <g>
            <rect
              x="650"
              y="60"
              width="120"
              height="60"
              fill="rgba(10, 10, 15, 0.8)"
              stroke={C.border}
              strokeWidth="1"
              rx="8"
            />
            <text
              x="710"
              y="80"
              textAnchor="middle"
              fill={C.ice60}
              fontSize="12"
              fontFamily="'Exo 2', sans-serif"
            >
              {t('overview.charts.currentValue')}
            </text>
            <text
              x="710"
              y="105"
              textAnchor="middle"
              fill={C.mars}
              fontSize="16"
              fontFamily="'Orbitron', sans-serif"
              fontWeight="bold"
            >
              {((400 - dataPoints[dataPoints.length - 1]?.y || 200) / 2).toFixed(2)}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
