import React from 'react';
import C from '../constants/colors';
import { useT } from '../i18n';

/**
 * 模型训练实时进度监控组件
 * 支持双主题适配与国际化
 * 具有渐变进度条与动态指标盘
 */
const TrainingProgressMonitor = ({ 
  progress = 0, 
  currentEpoch = 0, 
  totalEpochs = 0, 
  loss = null, 
  eta = '--:--', 
  isLight = false,
  status = 'running'
}) => {
  const t = useT();

  // 进度百分比限制在 0-100
  const percent = Math.min(100, Math.max(0, progress));
  
  // 状态颜色
  const getStatusColor = () => {
    if (status === 'completed') return '#4CAF50';
    if (status === 'failed') return '#F44336';
    if (status === 'running' || status === 'pending') return C.mars;
    return isLight ? '#999' : '#444';
  };

  const statusColor = getStatusColor();

  const getStatusText = () => {
    if (status === 'completed') return t('modelTraining.statusCompleted');
    if (status === 'failed') return t('modelTraining.statusFailed');
    if (status === 'running') return t('modelTraining.statusRunning');
    if (status === 'pending') return t('modelTraining.statusPending');
    return t('modelTraining.idle');
  };

  const containerStyle = {
    marginTop: 16,
    padding: '20px 24px',
    borderRadius: 12,
    background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.03)',
    backdropFilter: 'blur(10px)',
    border: `1px solid ${isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    transition: 'all 0.3s ease',
    boxShadow: isLight ? '0 10px 30px rgba(0,0,0,0.05)' : '0 10px 40px rgba(0,0,0,0.4)',
    transform: 'translateY(0)',
    animation: 'slideIn 0.5s ease-out',
    zIndex: 10
  };

  const progressTrackStyle = {
    height: 12,
    width: '100%',
    background: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.05)',
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative'
  };

  const progressFillStyle = {
    height: '100%',
    width: `${percent}%`,
    background: `linear-gradient(90deg, ${C.mars} 0%, ${C.blue} 100%)`,
    borderRadius: 6,
    transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: `0 0 10px ${C.blueGlow}`
  };

  const metricsGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 12
  };

  const metricBoxStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  };

  const metricLabelStyle = {
    fontSize: 'calc(11px * var(--font-scale, 1))',
    fontWeight: 700,
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: isLight ? '#333' : '#fff'
  };

  const metricValueStyle = {
    fontSize: 'calc(18px * var(--font-scale, 1))',
    fontWeight: 800,
    fontFamily: "'Orbitron', monospace",
    color: isLight ? '#111' : C.ice
  };

  return (
    <div style={containerStyle}>
      {/* 顶部标题与百分比 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ 
            width: 8, height: 8, borderRadius: '50%', 
            background: statusColor, 
            boxShadow: `0 0 8px ${statusColor}`,
            animation: status === 'running' ? 'pulse 2s infinite' : 'none'
          }} />
          <span style={{ fontSize: 'calc(13px * var(--font-scale, 1))', fontWeight: 700, opacity: 0.8 }}>
            {t('modelTraining.statsProgress')}
          </span>
        </div>
        <span style={{ 
          fontSize: 'calc(24px * var(--font-scale, 1))', 
          fontWeight: 900, 
          fontFamily: "'Orbitron', sans-serif",
          background: `linear-gradient(135deg, ${C.mars}, ${C.blue})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          {percent.toFixed(1)}%
        </span>
      </div>

      {/* 进度条 */}
      <div style={progressTrackStyle}>
        <div style={progressFillStyle} />
      </div>

      {/* 指标盘 */}
      <div style={metricsGridStyle}>
        <div style={metricBoxStyle}>
          <div style={metricLabelStyle}>{t('modelTraining.statsEpoch')}</div>
          <div style={metricValueStyle}>
            {currentEpoch} <span style={{ fontSize: 'calc(12px * var(--font-scale, 1))', opacity: 0.4 }}>/ {totalEpochs}</span>
          </div>
        </div>
        
        <div style={metricBoxStyle}>
          <div style={metricLabelStyle}>{t('modelTraining.statsLoss')}</div>
          <div style={{ ...metricValueStyle, color: C.mars }}>
            {loss !== null ? loss.toFixed(4) : '--'}
          </div>
        </div>

        <div style={metricBoxStyle}>
          <div style={metricLabelStyle}>{t('modelTraining.statsETA')}</div>
          <div style={{ ...metricValueStyle, color: C.blue }}>
            {eta}
          </div>
        </div>

        <div style={metricBoxStyle}>
          <div style={metricLabelStyle}>{t('modelTraining.status')}</div>
          <div style={{ ...metricValueStyle, fontSize: 'calc(13px * var(--font-scale, 1))', color: statusColor }}>
            {getStatusText()}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default TrainingProgressMonitor;
