import React from 'react';
import { useT } from '../../i18n';
import C from '../../constants/colors';

const ShapImportanceChart = ({ data, loading }) => {
  const t = useT();

  if (loading) {
    return (
      <div className="shap-loading" style={{ 
        height: 240, display: 'flex', flexDirection: 'column', 
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,255,255,0.02)', borderRadius: 12
      }}>
        <div style={{
          width: 32, height: 32, border: `3px solid ${C.border}`,
          borderTop: `3px solid ${C.mars}`, borderRadius: '50%',
          animation: 'spin-slow 1s linear infinite'
        }} />
        <div style={{ marginTop: 12, fontSize: 'calc(13px * var(--font-scale, 1))', color: C.ice30 }}>{t('predict.shap.computing')}</div>
      </div>
    );
  }

  if (!data || !data.variable_importance) return null;

  const { base_value: baseValue, variable_importance: importance } = data;
  const sortedVars = Object.entries(importance).sort((a, b) => b[1].abs - a[1].abs);
  
  // 计算瀑布流各个阶段的数据
  let currentPos = baseValue;
  const waterfallSteps = sortedVars.map(([key, item]) => {
    const start = currentPos;
    currentPos += item.val;
    return {
      key,
      label: t(`predict.variables.${key}`) || key,
      val: item.val,
      start,
      end: currentPos,
      isPositive: item.val >= 0
    };
  });

  const finalValue = currentPos;
  
  // 计算坐标轴动态范围
  const allValues = [baseValue, finalValue, ...waterfallSteps.flatMap(s => [s.start, s.end])];
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const range = maxVal - minVal;
  const padding = range * 0.1; // 留出 10% 边距
  const axisMin = minVal - padding;
  const axisMax = maxVal + padding;
  const axisRange = axisMax - axisMin;

  const getX = (v) => ((v - axisMin) / axisRange) * 100;

  return (
    <div className="shap-chart-container" style={{ padding: '16px 8px' }}>
      <div style={{ marginBottom: 20 }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: 'calc(13px * var(--font-scale, 1))', color: C.ice60, letterSpacing: 0.5 }}>
          {t('predict.shap.waterfallTitle') || 'WATERFALL ATTRIBUTION / 瀑布归因分析'}
        </h4>
        <p style={{ margin: 0, fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice30, lineHeight: 1.5 }}>
          {t('predict.shap.waterfallDesc') || '从基准值到预测值的逐级演化过程 (O₃ μm-atm)'}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* 1. 基准值条 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'calc(10px * var(--font-scale, 1))', color: C.ice50 }}>
            <span>{t('predict.shap.baseValue') || 'Base (E[f(x)])'}</span>
            <span style={{ fontFamily: "'Orbitron', sans-serif" }}>{baseValue.toFixed(4)}</span>
          </div>
          <div style={{ height: 10, width: '100%', position: 'relative' }}>
            <div style={{ 
              position: 'absolute', left: `${getX(0)}%`, width: `${getX(baseValue) - getX(0)}%`, 
              height: '100%', background: 'rgba(255,255,255,0.15)', borderRadius: 2 
            }} />
          </div>
        </div>

        {/* 2. 贡献步进条 */}
        {waterfallSteps.map((step) => {
          const barLeft = Math.min(getX(step.start), getX(step.end));
          const barWidth = Math.abs(getX(step.end) - getX(step.start));
          const barColor = step.isPositive ? C.mars : C.blue;
          
          return (
            <div key={step.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'calc(10px * var(--font-scale, 1))' }}>
                <span style={{ color: C.ice80 }}>{step.label}</span>
                <span style={{ color: barColor, fontWeight: 600 }}>
                  {step.val > 0 ? '+' : ''}{step.val.toFixed(4)}
                </span>
              </div>
              <div style={{ height: 12, width: '100%', position: 'relative' }}>
                {/* 连接虚线 */}
                <div style={{ 
                  position: 'absolute', left: `${getX(step.start)}%`, top: '50%', 
                  width: 1, height: 16, borderLeft: '1px dashed rgba(255,255,255,0.1)',
                  zIndex: 0, transform: 'translateY(-50%)'
                }} />
                
                {/* 贡献条 */}
                <div style={{ 
                  position: 'absolute', left: `${barLeft}%`, width: `${barWidth}%`, 
                  height: '100%', background: barColor, borderRadius: 2,
                  boxShadow: `0 0 10px ${barColor}33`, zIndex: 1,
                  transition: 'all 0.5s ease-out'
                }} />
              </div>
            </div>
          );
        })}

        {/* 3. 最终预测值条 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'calc(10px * var(--font-scale, 1))', color: C.ice80, fontWeight: 700 }}>
            <span>{t('predict.shap.totalValue') || 'Prediction (f(x))'}</span>
            <span style={{ color: C.ice, fontFamily: "'Orbitron', sans-serif" }}>{finalValue.toFixed(4)}</span>
          </div>
          <div style={{ height: 10, width: '100%', position: 'relative' }}>
            <div style={{ 
              position: 'absolute', left: `${getX(0)}%`, width: `${getX(finalValue) - getX(0)}%`, 
              height: '100%', background: C.mars, borderRadius: 2,
              boxShadow: `0 0 15px ${C.mars}44`
            }} />
          </div>
        </div>
      </div>

      {/* 坐标轴 */}
      <div style={{ 
        position: 'relative', height: 20, marginTop: 12, 
        borderTop: `1px solid ${C.border}`, fontSize: 'calc(9px * var(--font-scale, 1))', color: C.ice30,
        fontFamily: "'Orbitron', sans-serif"
      }}>
        <div style={{ position: 'absolute', left: `${getX(axisMin)}%`, top: 4 }}>{axisMin.toFixed(3)}</div>
        <div style={{ position: 'absolute', left: `${getX(baseValue)}%`, top: 4, transform: 'translateX(-50%)' }}>{baseValue.toFixed(3)}</div>
        <div style={{ position: 'absolute', left: `${getX(axisMax)}%`, top: 4, transform: 'translateX(-100%)' }}>{axisMax.toFixed(3)}</div>
      </div>

      <div style={{ 
        marginTop: 16, paddingTop: 12, borderTop: `1px dotted ${C.border}`, 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 'calc(10px * var(--font-scale, 1))', color: C.ice20
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ color: C.blue }}>← {t('predict.shap.inhibitory') || 'Inhibitory'}</span>
          <span style={{ color: C.mars }}>{t('predict.shap.promotional') || 'Facilitating'} →</span>
        </div>
        <span>{t('predict.shap.method') || 'GradientExplainer'}</span>
      </div>
    </div>
  );
};

export default ShapImportanceChart;
