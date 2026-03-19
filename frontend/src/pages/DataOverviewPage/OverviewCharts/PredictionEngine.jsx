import { useState, useEffect } from 'react';
import C from '../../../constants/colors';
import { useT } from '../../../i18n';

export default function PredictionEngine() {
  const t = useT();
  const [progress, setProgress] = useState(0);
  const [predictions, setPredictions] = useState([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => (prev + 1) % 100);

      if (predictions.length < 10) {
        setPredictions(prev => [...prev, {
          time: Date.now(),
          accuracy: 85 + Math.random() * 10,
          confidence: 75 + Math.random() * 20
        }]);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [predictions.length]);

  return (
    <div style={{ width: '100%', height: '100%', padding: '20px' }}>
      {/* 引擎状态 */}
      <div style={{
        background: 'rgba(255,255,255,0.02)', borderRadius: '12px',
        padding: '24px', marginBottom: '20px',
        border: `1px solid ${C.border}`
      }}>
        <h4 style={{
          color: C.ice, fontFamily: "'Orbitron', sans-serif", fontSize: '16px',
          textAlign: 'center', marginBottom: '20px', letterSpacing: 1
        }}>
          {t('overview.charts.engineTitle')}
        </h4>

        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: C.ice60, fontSize: '13px' }}>{t('overview.charts.processingProgress')}</span>
            <span style={{ color: C.mars, fontSize: '13px', fontWeight: 'bold' }}>{progress}%</span>
          </div>
          <div style={{
            width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)',
            borderRadius: '3px', overflow: 'hidden'
          }}>
            <div style={{
              width: `${progress}%`, height: '100%',
              background: `linear-gradient(90deg, ${C.blue}, ${C.mars})`,
              transition: 'width 0.2s ease'
            }} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-around' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: C.mars, fontSize: '20px', fontWeight: 'bold', fontFamily: "'Orbitron', sans-serif" }}>7</div>
            <div style={{ color: C.ice60, fontSize: '11px', marginTop: 4 }}>{t('overview.charts.inputChannels')}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: C.blue, fontSize: '20px', fontWeight: 'bold', fontFamily: "'Orbitron', sans-serif" }}>3</div>
            <div style={{ color: C.ice60, fontSize: '11px', marginTop: 4 }}>{t('overview.charts.timeWindow')}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: C.mars, fontSize: '20px', fontWeight: 'bold', fontFamily: "'Orbitron', sans-serif" }}>36×72</div>
            <div style={{ color: C.ice60, fontSize: '11px', marginTop: 4 }}>{t('overview.charts.spatialGrid')}</div>
          </div>
        </div>
      </div>

      {/* 预测结果 */}
      <div style={{
        background: 'rgba(255,255,255,0.02)', borderRadius: '12px',
        padding: '24px', height: 'calc(100% - 220px)',
        overflow: 'hidden', border: `1px solid ${C.border}`
      }}>
        <h5 style={{
          color: C.ice, fontFamily: "'Orbitron', sans-serif", fontSize: '14px',
          marginBottom: '16px', letterSpacing: 1
        }}>
          {t('overview.charts.realtimeResult')}
        </h5>

        <svg width="100%" height="200" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="predGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={C.blue} />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
            <filter id="predGlow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {predictions.length > 1 && (
            <>
              <polyline
                points={predictions.map((p, i) => `${i * 40 + 20},${180 - p.accuracy * 1.5}`).join(' ')}
                fill="none" stroke={C.blue} strokeWidth="3" filter="url(#predGlow)"
              />
              <path
                d={`M20,${180 - predictions[0].accuracy * 1.5} ${predictions.map((p, i) =>
                  `L${i * 40 + 20},${180 - p.accuracy * 1.5}`
                ).join(' ')} L${(predictions.length - 1) * 40 + 20},180 L20,180 Z`}
                fill="url(#predGrad)" opacity="0.3"
              />
            </>
          )}
        </svg>
      </div>
    </div>
  );
}
