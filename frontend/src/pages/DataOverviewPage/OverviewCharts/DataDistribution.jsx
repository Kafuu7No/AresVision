import C from '../../../constants/colors';
import { useT } from '../../../i18n';

export default function DataDistribution() {
  const t = useT();
  const histogramData = Array.from({ length: 20 }, (_, i) => ({
    bin: i * 0.05,
    count: Math.random() * 100 + 10
  }));

  return (
    <div style={{ width: '100%', height: '100%', padding: '20px' }}>
      <h4 style={{
        color: C.ice, fontFamily: "'Orbitron', sans-serif", fontSize: '16px',
        textAlign: 'center', marginBottom: '30px', letterSpacing: 1
      }}>
        {t('overview.charts.ozoneDist')}
      </h4>

      <svg width="100%" height="300" viewBox="0 0 600 300" preserveAspectRatio="xMidYMid meet">
        {histogramData.map((bar, i) => (
          <g key={i}>
            <rect
              x={50 + i * 25}
              y={250 - bar.count * 2}
              width="18"
              height={bar.count * 2}
              fill={`rgba(199,91,57,${0.3 + (bar.count / 110) * 0.7})`}
              stroke={C.mars}
              strokeWidth="1"
              rx="4"
            />
            {i % 4 === 0 && (
              <text
                x={59 + i * 25}
                y={270}
                textAnchor="middle"
                style={{ fill: 'var(--text-60)' }}
                fontSize="11"
                fontFamily="'Exo 2', sans-serif"
              >
                {bar.bin.toFixed(2)}
              </text>
            )}
          </g>
        ))}

        <text x="300" y="295" textAnchor="middle" style={{ fill: 'var(--text-60)' }} fontSize="12" fontFamily="'Exo 2', sans-serif">
          OZONE COLUMN (DU)
        </text>
        <text x="20" y="150" textAnchor="middle" style={{ fill: 'var(--text-60)' }} fontSize="12" fontFamily="'Exo 2', sans-serif"
          transform="rotate(-90 20 150)">
          FREQUENCY
        </text>
      </svg>
    </div>
  );
}
