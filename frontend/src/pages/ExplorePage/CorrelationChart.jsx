import { useState, useEffect } from 'react';
import C from '../../constants/colors';
import { useT } from '../../i18n';
import { rdbuRgb } from '../../utils/colormaps';
import { LoadingBox, InsightBlock } from './ExploreComponents';

const VAR_ABBREV = {
  o3col: 'O₃',
  U_Wind: 'U Wind',
  V_Wind: 'V Wind',
  Pressure: 'Press',
  Temperature: 'Temp',
  Dust_Optical_Depth: 'DOD',
  Solar_Flux_DN: 'SolFlx',
};

export default function CorrelationChart({ data, year, h = 320 }) {
  const [insight, setInsight] = useState('');
  const t = useT();

  useEffect(() => {
    if (!data?.matrix || !data?.variable_names) return;
    const o3Row = data.matrix[0];
    let maxAbsCorr = 0, maxCorrVal = 0, maxCorrIdx = -1;
    o3Row.forEach((v, i) => {
      if (i === 0) return;
      if (v == null || isNaN(v)) return;
      if (Math.abs(v) > maxAbsCorr) {
        maxAbsCorr = Math.abs(v);
        maxCorrVal = v;
        maxCorrIdx = i;
      }
    });
    const maxVar = maxCorrIdx >= 0 ? (data.variable_names[maxCorrIdx] || '-') : '-';
    const corrSign = maxCorrVal >= 0 ? t('common.positive') : t('common.negative');
    const corrStr = maxCorrIdx >= 0 ? maxCorrVal.toFixed(3) : 'N/A';
    setInsight(t('explore.corrInsight', {
      year,
      varName: VAR_ABBREV[maxVar] || maxVar,
      corrVal: corrStr,
      corrSign,
    }));
  }, [data, year, t]);

  if (!data || !data.matrix) return <LoadingBox h={h} />;

  const { matrix, variable_names } = data;
  const n = matrix.length;
  const abbrevNames = variable_names.map(v => VAR_ABBREV[v] || v);

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
          <div style={{ width: '100%', maxWidth: 520 }}>
            {/* 表头行 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: `64px repeat(${n}, 1fr)`,
              gap: 2, marginBottom: 2,
            }}>
              <div />
              {abbrevNames.map((v, i) => (
                <div key={`h${i}`} style={{
                  fontSize: 10, color: C.ice60,
                  textAlign: 'center', padding: '2px 1px', lineHeight: 1.3,
                }}>{v}</div>
              ))}
            </div>

            {/* 数据行 */}
            {matrix.map((row, ri) => (
              <div key={`r${ri}`} style={{
                display: 'grid',
                gridTemplateColumns: `64px repeat(${n}, 1fr)`,
                gap: 2, marginBottom: 2,
              }}>
                <div style={{
                  fontSize: 10, color: C.ice60,
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'flex-end', paddingRight: 6,
                }}>
                  {abbrevNames[ri]}
                </div>
                {row.map((val, ci) => {
                  const isDiag = ri === ci;
                  let bg, textColor;
                  if (isDiag) {
                    bg = 'rgba(199,91,57,0.65)';
                    textColor = '#fff';
                  } else {
                    const [r, g, b] = rdbuRgb((val + 1) / 2);
                    bg = `rgb(${r},${g},${b})`;
                    const brightness = r * 0.299 + g * 0.587 + b * 0.114;
                    textColor = brightness > 160 ? '#111' : '#fff';
                  }
                  return (
                    <div key={`${ri}-${ci}`} style={{
                      background: bg,
                      borderRadius: 3,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, color: textColor,
                      fontWeight: Math.abs(val) > 0.5 ? 700 : 400,
                      minHeight: 34,
                    }}>
                      {val.toFixed(2)}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <InsightBlock text={insight} />
    </div>
  );
}
