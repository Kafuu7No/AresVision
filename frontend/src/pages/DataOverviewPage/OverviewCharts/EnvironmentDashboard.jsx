import C from '../../../constants/colors';
import { useT } from '../../../i18n';

export default function EnvironmentDashboard() {
  const t = useT();
  const gauges = [
    { nameKey: 'temperature', value: -63, unit: '°C', max: 27, min: -143, color: C.mars },
    { nameKey: 'pressure',    value: 0.6, unit: 'kPa', max: 1.2, min: 0, color: C.ice },
    { nameKey: 'dust',        value: 0.3, unit: 'τ', max: 1, min: 0, color: C.mars },
    { nameKey: 'wind',        value: 5.8, unit: 'm/s', max: 15, min: 0, color: C.ice }
  ];

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'grid', gridTemplateColumns: '1fr 1fr',
      gap: '24px', padding: '10px'
    }}>
      {gauges.map((gauge, i) => {
        const percent = ((gauge.value - gauge.min) / (gauge.max - gauge.min)) * 100;
        const angle = (percent / 100) * 180;

        return (
          <div key={i} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            background: 'rgba(255,255,255,0.02)', borderRadius: '16px',
            padding: '24px', border: `1px solid ${C.border}`
          }}>
            <h4 style={{
              color: gauge.color, fontFamily: "'Orbitron', sans-serif",
              fontSize: '14px', fontWeight: 'bold', margin: '0 0 20px 0',
              textShadow: `0 0 8px ${gauge.color}`, letterSpacing: 1
            }}>
              {t(`overview.env.${gauge.nameKey}`)}
            </h4>

            {/* 仪表盘 */}
            <svg width="150" height="100" viewBox="0 0 200 120">
              <defs>
                <linearGradient id={`gauge-grad-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={gauge.color} />
                  <stop offset="50%" stopColor={gauge.color === C.ice ? '#4acfac' : C.blue} />
                  <stop offset="100%" stopColor={C.mars} />
                </linearGradient>
              </defs>

              <path
                d="M40,100 A60,60 0 0,1 160,100"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="10"
                fill="none"
              />

              <path
                d={`M40,100 A60,60 0 ${angle > 90 ? 1 : 0},1 ${40 + 120 * Math.cos((180 - angle) * Math.PI / 180)},${100 - 60 * Math.sin((180 - angle) * Math.PI / 180)}`}
                stroke={`url(#gauge-grad-${i})`}
                strokeWidth="10"
                fill="none"
                filter="drop-shadow(0 0 4px currentColor)"
              />

              <text x="100" y="105" textAnchor="middle" fill={C.ice} fontSize="20" fontFamily="'Orbitron', sans-serif" fontWeight="bold">
                {gauge.value}
              </text>
              <text x="100" y="125" textAnchor="middle" fill={C.ice60} fontSize="11" fontFamily="'Exo 2', sans-serif">
                {gauge.unit}
              </text>
            </svg>
          </div>
        );
      })}
    </div>
  );
}
