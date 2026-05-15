import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import C from '../../constants/colors';
import { useT } from '../../i18n';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import GlowCard from '../../components/GlowCard';
import ConfirmDialog from '../../components/ConfirmDialog';
import ContributeModal from '../../components/ContributeModal';
import ContributeHistoryPanel from '../../components/ContributeHistoryPanel';
import {
  deleteUpload,
  fetchDataInfo,
  fetchUserBands,
  fetchUserDataSummary,
  fetchUserGlobeData,
  fetchUserHeatmap,
  getDataGovernanceLineage,
  getDataGovernanceOverview,
  getDataGovernanceQuality,
  getMyUploads,
} from '../../services/api';
import HeatmapCanvas from './HeatmapCanvas';
import LineChart from './LineChart';
import GlobePlot from './GlobePlot';
import { LoadingBox } from './ExploreComponents';

function CloudUploadIcon({ size = 40, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  );
}

function FolderOpenIcon({ size = 32, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function FileIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </svg>
  );
}

function LockIcon({ size = 48, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function GiftIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  );
}

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return iso.replace('T', ' ').slice(0, 16);
}

function formatScore(v) {
  if (v == null || Number.isNaN(Number(v))) return '--';
  return Number(v).toFixed(1);
}

function formatPct(v) {
  if (v == null || Number.isNaN(Number(v))) return '--';
  return `${(Number(v) * 100).toFixed(1)}%`;
}

function formatSourceModeText(mode, t) {
  const map = {
    personal: t('explore.myData.sourceMode.personal'),
    mixed: t('explore.myData.sourceMode.mixed'),
    inactive: t('explore.myData.sourceMode.inactive'),
  };
  return map[mode] || map.inactive;
}

function getLifecycleMeta(status, t) {
  const map = {
    valid: {
      key: 'valid',
      label: t('explore.myData.lifecycle.valid'),
      color: C.green,
      bg: 'rgba(74,207,172,0.1)',
    },
    invalid: {
      key: 'invalid',
      label: t('explore.myData.lifecycle.invalid'),
      color: C.mars,
      bg: 'rgba(199,91,57,0.1)',
    },
    pending_review: {
      key: 'pending_review',
      label: t('explore.myData.lifecycle.pending_review'),
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.1)',
    },
    approved: {
      key: 'approved',
      label: t('explore.myData.lifecycle.approved'),
      color: C.blue,
      bg: 'rgba(74,158,255,0.1)',
    },
    rejected: {
      key: 'rejected',
      label: t('explore.myData.lifecycle.rejected'),
      color: '#fb7185',
      bg: 'rgba(251,113,133,0.1)',
    },
  };
  return map[status] || map.invalid;
}

function resolveSourceMode(upload, personalInfo) {
  if (!upload || ['invalid', 'rejected'].includes(upload.status)) return 'inactive';
  const detail = personalInfo?.details?.[`MY${upload.mars_year}`];
  const rawMode = detail?.source_mode;
  if (rawMode === 'personal_full_year') return 'personal';
  if (rawMode === 'personal_mcd_plus_system_openmars') return 'mixed';
  return 'inactive';
}

function isAnalysisReady(upload, asset, sourceMode, qualityScore) {
  if (!upload || ['invalid', 'rejected'].includes(upload.status)) return false;
  if (sourceMode === 'inactive') return false;
  if (asset?.effective_status === 'missing' || asset?.effective_status === 'approved_but_missing') return false;
  if (qualityScore == null) return true;
  return Number(qualityScore) >= 60;
}

function getContributionState(upload) {
  if (!upload) return 'blocked';
  if (upload.status === 'approved') return 'approved';
  if (upload.status === 'pending_review') return 'pending';
  if (upload.status === 'valid') return 'ready';
  return 'blocked';
}

function contributionStateText(state, t) {
  const map = {
    ready: t('explore.myData.publicState.ready'),
    pending: t('explore.myData.publicState.pending'),
    approved: t('explore.myData.publicState.approved'),
    blocked: t('explore.myData.publicState.blocked'),
  };
  return map[state] || map.blocked;
}

function gradeFromScore(score) {
  if (score == null || Number.isNaN(Number(score))) return '--';
  const n = Number(score);
  if (n >= 90) return 'A';
  if (n >= 80) return 'B';
  if (n >= 70) return 'C';
  if (n >= 60) return 'D';
  return 'E';
}

function qualityColor(score) {
  if (score == null || Number.isNaN(Number(score))) return C.ice30;
  const n = Number(score);
  if (n >= 90) return C.green;
  if (n >= 75) return C.blue;
  if (n >= 60) return '#f59e0b';
  return C.mars;
}

function buildUploadContext(upload, asset, personalInfo, t) {
  const sourceMode = resolveSourceMode(upload, personalInfo);
  const qualityScore = asset?.quality_score ?? null;
  const lifecycle = getLifecycleMeta(upload.status, t);
  const analysisReady = isAnalysisReady(upload, asset, sourceMode, qualityScore);
  const contributionState = getContributionState(upload);
  return {
    upload,
    asset,
    sourceMode,
    lifecycle,
    qualityScore,
    qualityGrade: gradeFromScore(qualityScore),
    analysisReady,
    contributionState,
  };
}

function Badge({ label, color, bg }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: 999,
        background: bg,
        color,
        fontSize: 10,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

function MiniMetric({ label, value, accent = C.ice60 }) {
  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: '10px 12px',
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <div style={{ fontSize: 10, color: C.ice30 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 13, color: accent, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function WorkbenchStat({ eyebrow, value, label, desc, accent = C.blue }) {
  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: '16px 18px',
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: accent,
          fontWeight: 700,
          letterSpacing: 1.5,
          fontFamily: "'Orbitron', sans-serif",
        }}
      >
        {eyebrow}
      </div>
      <div style={{ marginTop: 10, fontSize: 26, color: C.ice, fontWeight: 700, fontFamily: "'Orbitron', sans-serif" }}>
        {value}
      </div>
      <div style={{ marginTop: 4, fontSize: 12, color: C.ice60, fontWeight: 600 }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 11, color: C.ice30, lineHeight: 1.75 }}>{desc}</div>
    </div>
  );
}

function MetaRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
      <span style={{ fontSize: 10, color: C.ice30, whiteSpace: 'nowrap', minWidth: 58 }}>{label}</span>
      <span style={{ fontSize: 12, color: C.ice60, fontWeight: 500 }}>{value ?? '—'}</span>
    </div>
  );
}

function UploadZone({
  t,
  uploadState,
  uploadProgress,
  uploadPhase,
  uploadResult,
  isDragging,
  fileInputRef,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileChange,
  onReset,
}) {
  const isIdle = uploadState === 'idle';
  const isUploading = uploadState === 'uploading';
  const isResult = uploadState === 'result';

  const resultOk = uploadResult?.ok;
  const hasWarnings = resultOk && uploadResult?.data?.warnings?.length > 0;
  const resultType = !uploadResult ? null : resultOk ? (hasWarnings ? 'warning' : 'success') : 'error';

  const borderColor = isDragging
    ? C.blue
    : isResult
      ? resultType === 'success'
        ? '#22c55e'
        : resultType === 'warning'
          ? '#f59e0b'
          : C.mars
      : C.border;

  const bgColor = isDragging
    ? 'rgba(74,158,255,0.05)'
    : isResult
      ? resultType === 'success'
        ? 'rgba(34,197,94,0.03)'
        : resultType === 'warning'
          ? 'rgba(245,158,11,0.03)'
          : 'rgba(199,91,57,0.03)'
      : 'transparent';

  const resultIconColor = resultType === 'success' ? '#22c55e' : resultType === 'warning' ? '#f59e0b' : C.mars;

  return (
    <div
      style={{
        border: `2px ${isDragging || isResult ? 'solid' : 'dashed'} ${borderColor}`,
        borderRadius: 16,
        background: bgColor,
        padding: '32px 28px',
        minHeight: 210,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: isIdle ? 'pointer' : 'default',
        transition: 'border-color 0.2s, background 0.2s',
        userSelect: 'none',
      }}
      onClick={() => isIdle && fileInputRef.current?.click()}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input ref={fileInputRef} type="file" accept=".nc,.nc4,.netcdf" style={{ display: 'none' }} onChange={onFileChange} />

      {isIdle && (
        <>
          <div style={{ color: isDragging ? C.blue : C.ice30, marginBottom: 12, opacity: isDragging ? 1 : 0.7 }}>
            <CloudUploadIcon size={40} color="currentColor" />
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: isDragging ? C.blue : C.ice,
              fontFamily: "'Orbitron', sans-serif",
              marginBottom: 8,
              textAlign: 'center',
            }}
          >
            {isDragging ? t('explore.upload.dragActive') : t('explore.upload.title')}
          </div>
          {!isDragging && (
            <>
              <div style={{ fontSize: 12, color: C.ice60, maxWidth: 620, textAlign: 'center', lineHeight: 1.75, marginBottom: 16 }}>
                {t('explore.upload.subtitle')}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: C.ice30,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: '5px 14px',
                  letterSpacing: 0.4,
                }}
              >
                {t('explore.upload.dragHint')} · {t('explore.upload.clickHint')}
              </div>
            </>
          )}
        </>
      )}

      {isUploading && (
        <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: C.ice60, flexShrink: 0 }}>
              <FileIcon size={18} color="currentColor" />
            </span>
            <span style={{ fontSize: 12, color: C.ice60, flex: 1 }}>
              {uploadPhase === 'validating' ? t('explore.upload.validating') : t('explore.upload.uploading')}
            </span>
            <span style={{ fontSize: 12, color: C.ice60, fontWeight: 600, minWidth: 38, textAlign: 'right' }}>
              {uploadProgress}%
            </span>
          </div>
          <div style={{ height: 5, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${uploadProgress}%`,
                background: uploadPhase === 'validating' ? '#f59e0b' : C.blue,
                borderRadius: 3,
                transition: 'width 0.25s ease, background 0.3s',
              }}
            />
          </div>
        </div>
      )}

      {isResult && uploadResult && (
        <div style={{ width: '100%', maxWidth: 580, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: resultIconColor,
                fontFamily: "'Orbitron', sans-serif",
                letterSpacing: 1,
              }}
            >
              {resultType === 'success' ? t('explore.upload.success') : resultType === 'warning' ? t('explore.upload.warning') : t('explore.upload.failed')}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReset();
              }}
              style={{
                background: 'none',
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                color: C.ice60,
                fontSize: 11,
                cursor: 'pointer',
                padding: '3px 10px',
              }}
            >
              {t('explore.upload.closeResult')}
            </button>
          </div>

          {resultOk && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: '8px 16px',
                padding: '12px 16px',
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${C.border}`,
                borderRadius: 10,
              }}
            >
              {uploadResult.data.data_type && <MetaRow label={t('explore.upload.dataType')} value={uploadResult.data.data_type} />}
              {uploadResult.data.mars_year != null && <MetaRow label={t('explore.upload.marsYear')} value={`MY ${uploadResult.data.mars_year}`} />}
              {uploadResult.data.ls_range?.[0] != null && uploadResult.data.ls_range?.[1] != null && (
                <MetaRow label={t('explore.upload.lsRange')} value={`${Number(uploadResult.data.ls_range[0]).toFixed(1)}° – ${Number(uploadResult.data.ls_range[1]).toFixed(1)}°`} />
              )}
              {uploadResult.data.grid_size && (
                <MetaRow label={t('explore.upload.gridSize')} value={`${uploadResult.data.grid_size[0]} × ${uploadResult.data.grid_size[1]}`} />
              )}
              {uploadResult.data.variables?.length > 0 && <MetaRow label={t('explore.upload.variables')} value={uploadResult.data.variables.join(', ')} />}
            </div>
          )}

          {hasWarnings && (
            <div style={{ fontSize: 11, color: '#f59e0b', lineHeight: 1.6 }}>
              <span style={{ fontWeight: 600 }}>{t('explore.upload.warnings')}: </span>
              {uploadResult.data.warnings.join('；')}
            </div>
          )}

          {!resultOk && (
            <div
              style={{
                fontSize: 12,
                color: C.mars,
                lineHeight: 1.6,
                padding: '10px 14px',
                background: 'rgba(199,91,57,0.06)',
                border: '1px solid rgba(199,91,57,0.25)',
                borderRadius: 8,
              }}
            >
              <span style={{ fontWeight: 600 }}>{t('explore.upload.errorDetail')}: </span>
              {uploadResult.data?.error || uploadResult.data?.detail || '未知错误'}
            </div>
          )}

          <div style={{ fontSize: 10, color: C.ice30, textAlign: 'right' }}>{resultOk ? '5' : '8'}s 后自动关闭</div>
        </div>
      )}
    </div>
  );
}

function ContributeBanner({ t, onOpenModal }) {
  const [hovBtn, setHovBtn] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 22px',
        background: 'linear-gradient(90deg, rgba(74,158,255,0.07) 0%, rgba(199,91,57,0.06) 100%)',
        border: '1px solid rgba(74,158,255,0.18)',
        borderRadius: 14,
        gap: 16,
      }}
    >
      <div style={{ fontSize: 13, color: C.ice60, flex: 1, minWidth: 0 }}>{t('explore.contribute.bannerText')}</div>
      <button
        onClick={onOpenModal}
        onMouseEnter={() => setHovBtn(true)}
        onMouseLeave={() => setHovBtn(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '8px 18px',
          borderRadius: 9,
          border: 'none',
          background: hovBtn ? C.mars : 'rgba(199,91,57,0.85)',
          color: '#fff',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'background 0.15s',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        <GiftIcon size={14} color="#fff" />
        {t('explore.contribute.bannerBtn')}
      </button>
    </div>
  );
}

function ActionBtn({ label, borderColor, textColor, activeBg, active, onClick, disabled, loading }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '5px 12px',
        background: active ? activeBg : 'rgba(255,255,255,0.04)',
        border: `1px solid ${borderColor ?? C.border}`,
        borderRadius: 7,
        color: loading ? C.ice30 : textColor ?? C.ice60,
        fontSize: 11,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
        fontFamily: 'inherit',
      }}
    >
      {loading ? '...' : label}
    </button>
  );
}

function UploadCard({ ctx, t, actionLoading, isViewing, onView, onDelete }) {
  const { upload, asset, lifecycle, sourceMode, qualityScore, analysisReady, contributionState } = ctx;
  const loading = actionLoading[upload.id];
  const qualityAccent = qualityColor(qualityScore);

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${isViewing ? C.blue : C.border}`,
        borderRadius: 14,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minWidth: 300,
        maxWidth: 380,
        flex: '1 1 320px',
        transition: 'border-color 0.2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: C.ice30, flexShrink: 0 }}>
          <FileIcon size={14} color="currentColor" />
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: C.ice,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={upload.filename}
        >
          {upload.filename}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Badge label={lifecycle.label} color={lifecycle.color} bg={lifecycle.bg} />
        <Badge label={formatSourceModeText(sourceMode, t)} color={sourceMode === 'inactive' ? C.ice30 : C.blue} bg={sourceMode === 'inactive' ? 'rgba(255,255,255,0.05)' : 'rgba(74,158,255,0.1)'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 8px' }}>
        <MetaRow label={t('explore.myData.cardType')} value={upload.data_type || '—'} />
        <MetaRow label={t('explore.myData.cardMarsYear')} value={upload.mars_year != null ? `MY ${upload.mars_year}` : '—'} />
        {upload.ls_start != null && upload.ls_end != null && (
          <MetaRow label={t('explore.myData.cardLs')} value={`${Number(upload.ls_start).toFixed(1)}° – ${Number(upload.ls_end).toFixed(1)}°`} />
        )}
        <MetaRow label={t('explore.myData.cardSize')} value={formatFileSize(upload.file_size)} />
        <MetaRow label={t('explore.myData.cardTime')} value={formatDate(upload.created_at)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <MiniMetric label={t('explore.myData.metricQuality')} value={qualityScore != null ? `${formatScore(qualityScore)} / 100` : '--'} accent={qualityAccent} />
        <MiniMetric label={t('explore.myData.metricAnalysis')} value={analysisReady ? t('explore.myData.readiness.pass') : t('explore.myData.readiness.fail')} accent={analysisReady ? C.green : C.mars} />
        <MiniMetric label={t('explore.myData.metricPublic')} value={contributionStateText(contributionState, t)} accent={contributionState === 'blocked' ? C.mars : contributionState === 'ready' ? C.green : C.blue} />
        <MiniMetric label={t('explore.myData.metricSource')} value={asset?.storage_zone || 'user_uploads'} accent={C.ice60} />
      </div>

      {upload.validation_message && (
        <div style={{ fontSize: 11, color: lifecycle.key === 'invalid' || lifecycle.key === 'rejected' ? C.mars : C.ice30, lineHeight: 1.7 }}>
          {upload.validation_message}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
        <ActionBtn
          label={t('explore.myData.viewBtn')}
          borderColor={isViewing ? C.blue : C.border}
          textColor={isViewing ? C.blue : C.ice60}
          activeBg="rgba(74,158,255,0.10)"
          active={isViewing}
          onClick={onView}
          disabled={loading}
        />
        <ActionBtn label={t('explore.myData.deleteBtn')} borderColor="rgba(199,91,57,0.5)" textColor={C.mars} onClick={onDelete} disabled={loading} loading={loading} />
      </div>
    </div>
  );
}

function LoginPrompt({ t, openAuthModal }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 40px', gap: 20, textAlign: 'center' }}>
      <div style={{ color: C.ice30, opacity: 0.5 }}>
        <LockIcon size={52} color="currentColor" />
      </div>
      <div style={{ fontSize: 16, color: C.ice, fontWeight: 600 }}>{t('explore.upload.loginPrompt')}</div>
      <button
        onClick={() => openAuthModal('login')}
        style={{
          padding: '10px 28px',
          borderRadius: 10,
          background: C.mars,
          border: 'none',
          color: '#fff',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: "'Orbitron', sans-serif",
          letterSpacing: 1,
        }}
      >
        {t('explore.upload.loginBtn')}
      </button>
    </div>
  );
}

function UploadReviewCard({ title, ctx, quality, lineage, t }) {
  if (!ctx) return null;
  const contributionState = contributionStateText(ctx.contributionState, t);

  return (
    <GlowCard style={{ padding: '18px 20px' }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: C.blue,
          fontFamily: "'Orbitron', sans-serif",
          letterSpacing: 2,
          marginBottom: 12,
        }}
      >
        {title}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 14 }}>
        <MiniMetric label={t('explore.myData.metricQuality')} value={ctx.qualityScore != null ? `${formatScore(ctx.qualityScore)} / 100` : '--'} accent={qualityColor(ctx.qualityScore)} />
        <MiniMetric label={t('explore.myData.metricLifecycle')} value={ctx.lifecycle.label} accent={ctx.lifecycle.color} />
        <MiniMetric label={t('explore.myData.metricAnalysis')} value={ctx.analysisReady ? t('explore.myData.readiness.pass') : t('explore.myData.readiness.fail')} accent={ctx.analysisReady ? C.green : C.mars} />
        <MiniMetric label={t('explore.myData.metricPublic')} value={contributionState} accent={ctx.contributionState === 'blocked' ? C.mars : ctx.contributionState === 'ready' ? C.green : C.blue} />
        <MiniMetric label={t('explore.myData.metricMode')} value={formatSourceModeText(ctx.sourceMode, t)} accent={ctx.sourceMode === 'inactive' ? C.ice30 : C.blue} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        <div
          style={{
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: '14px 16px',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <div style={{ fontSize: 11, color: C.ice30, marginBottom: 8 }}>{t('explore.myData.qualityCardTitle')}</div>
          <div style={{ fontSize: 24, color: qualityColor(ctx.qualityScore), fontWeight: 700, fontFamily: "'Orbitron', sans-serif" }}>
            {ctx.qualityScore != null ? formatScore(ctx.qualityScore) : '--'}
            <span style={{ fontSize: 13, color: C.ice30, marginLeft: 6 }}>{ctx.qualityGrade}</span>
          </div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, color: C.ice60 }}>
            <div>{`${t('explore.governance.missingRate')}: ${formatPct(quality?.metrics?.missing_rate)}`}</div>
            <div>{`${t('explore.governance.validRatio')}: ${formatPct(quality?.metrics?.valid_value_ratio)}`}</div>
            <div>{`${t('explore.myData.storageZone')}: ${lineage?.current_effective_data_source?.storage_zone || ctx.asset?.storage_zone || '--'}`}</div>
          </div>
        </div>

        <div
          style={{
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: '14px 16px',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <div style={{ fontSize: 11, color: C.ice30, marginBottom: 8 }}>{t('explore.myData.accessChecklistTitle')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Badge label={`${t('explore.myData.analysisCondition')}: ${ctx.analysisReady ? t('explore.myData.readiness.pass') : t('explore.myData.readiness.fail')}`} color={ctx.analysisReady ? C.green : C.mars} bg={ctx.analysisReady ? 'rgba(74,207,172,0.1)' : 'rgba(199,91,57,0.1)'} />
            <Badge label={`${t('explore.myData.publicCondition')}: ${contributionState}`} color={ctx.contributionState === 'blocked' ? C.mars : ctx.contributionState === 'ready' ? C.green : C.blue} bg={ctx.contributionState === 'blocked' ? 'rgba(199,91,57,0.1)' : 'rgba(74,158,255,0.1)'} />
            <Badge label={`${t('explore.myData.lifecycleLabel')}: ${ctx.lifecycle.label}`} color={ctx.lifecycle.color} bg={ctx.lifecycle.bg} />
            <Badge label={`${t('explore.myData.metricMode')}: ${formatSourceModeText(ctx.sourceMode, t)}`} color={ctx.sourceMode === 'inactive' ? C.ice30 : C.blue} bg={ctx.sourceMode === 'inactive' ? 'rgba(255,255,255,0.05)' : 'rgba(74,158,255,0.1)'} />
          </div>
        </div>
      </div>
    </GlowCard>
  );
}

export default function MyDataTab() {
  const t = useT();
  const { user, openAuthModal } = useAuth();
  const { showToast } = useToast();

  const [uploadState, setUploadState] = useState('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState('uploading');
  const [uploadResult, setUploadResult] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const [uploads, setUploads] = useState([]);
  const [uploadsLoading, setUploadsLoading] = useState(false);
  const [viewingId, setViewingId] = useState(null);
  const [governanceOverview, setGovernanceOverview] = useState(null);
  const [personalSourceInfo, setPersonalSourceInfo] = useState(null);

  const [viewData, setViewData] = useState({
    summary: null,
    globe: null,
    heatmap: null,
    bands: null,
    quality: null,
    lineage: null,
    loading: false,
    error: null,
  });
  const [viewLs, setViewLs] = useState(90);
  const [latestReview, setLatestReview] = useState({ uploadId: null, quality: null, lineage: null });

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [contributeOpen, setContributeOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const loadWorkbench = useCallback(async () => {
    if (!user) return;
    setUploadsLoading(true);

    const [uploadsRes, overviewRes, personalRes] = await Promise.allSettled([
      getMyUploads(),
      getDataGovernanceOverview('mine'),
      fetchDataInfo({ dataSource: 'personal' }),
    ]);

    if (uploadsRes.status === 'fulfilled') {
      setUploads(Array.isArray(uploadsRes.value) ? uploadsRes.value : []);
    } else {
      console.error('Load uploads error:', uploadsRes.reason);
    }

    if (overviewRes.status === 'fulfilled') {
      setGovernanceOverview(overviewRes.value);
    } else {
      setGovernanceOverview(null);
    }

    if (personalRes.status === 'fulfilled') {
      setPersonalSourceInfo(personalRes.value);
    } else {
      setPersonalSourceInfo(null);
    }

    setUploadsLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) loadWorkbench();
  }, [user, loadWorkbench]);

  const hydrateLatestReview = useCallback(async (uploadId) => {
    if (!uploadId) return;
    const [qualityRes, lineageRes] = await Promise.allSettled([
      getDataGovernanceQuality(uploadId),
      getDataGovernanceLineage(uploadId),
    ]);

    setLatestReview({
      uploadId,
      quality: qualityRes.status === 'fulfilled' ? qualityRes.value : null,
      lineage: lineageRes.status === 'fulfilled' ? lineageRes.value : null,
    });
  }, []);

  const loadViewData = useCallback(async (uploadId) => {
    setViewData({
      summary: null,
      globe: null,
      heatmap: null,
      bands: null,
      quality: null,
      lineage: null,
      loading: true,
      error: null,
    });

    try {
      const [summary, quality, lineage] = await Promise.all([
        fetchUserDataSummary(uploadId),
        getDataGovernanceQuality(uploadId).catch(() => null),
        getDataGovernanceLineage(uploadId).catch(() => null),
      ]);

      let defaultLs = 90;
      if (summary.ls_range) {
        defaultLs = Math.round((summary.ls_range[0] + summary.ls_range[1]) / 2);
      }
      setViewLs(defaultLs);

      let globe = null;
      let heatmap = null;
      let bands = null;
      if (summary.has_ozone) {
        [globe, heatmap, bands] = await Promise.all([
          fetchUserGlobeData(uploadId, defaultLs).catch(() => null),
          fetchUserHeatmap(uploadId, 'o3col').catch(() => null),
          fetchUserBands(uploadId).catch(() => null),
        ]);
      }

      setViewData({
        summary,
        globe,
        heatmap,
        bands,
        quality,
        lineage,
        loading: false,
        error: null,
      });
    } catch (e) {
      setViewData((prev) => ({ ...prev, loading: false, error: e.message || t('common.error') }));
    }
  }, [t]);

  useEffect(() => {
    if (viewingId != null) {
      loadViewData(viewingId);
    } else {
      setViewData({
        summary: null,
        globe: null,
        heatmap: null,
        bands: null,
        quality: null,
        lineage: null,
        loading: false,
        error: null,
      });
    }
  }, [viewingId, loadViewData]);

  const handleViewLsChange = useCallback(async (newLs) => {
    setViewLs(newLs);
    if (viewingId == null) return;
    try {
      const globe = await fetchUserGlobeData(viewingId, newLs);
      setViewData((prev) => ({ ...prev, globe }));
    } catch {
      // keep old data
    }
  }, [viewingId]);

  const assetMap = useMemo(() => {
    const map = new Map();
    (governanceOverview?.assets || []).forEach((asset) => map.set(asset.upload_id, asset));
    return map;
  }, [governanceOverview]);

  const uploadContexts = useMemo(() => {
    return uploads.map((upload) => buildUploadContext(upload, assetMap.get(upload.id), personalSourceInfo, t));
  }, [uploads, assetMap, personalSourceInfo, t]);

  const uploadContextMap = useMemo(() => new Map(uploadContexts.map((ctx) => [ctx.upload.id, ctx])), [uploadContexts]);

  const validUploads = useMemo(() => uploads.filter((u) => u.status === 'valid'), [uploads]);

  const workbenchStats = useMemo(() => {
    const total = uploadContexts.length;
    const analysisReady = uploadContexts.filter((ctx) => ctx.analysisReady).length;
    const contributionReady = uploadContexts.filter((ctx) => ctx.contributionState === 'ready').length;
    const publicFlow = uploadContexts.filter((ctx) => ['pending', 'approved'].includes(ctx.contributionState)).length;
    const activeYears = Object.values(personalSourceInfo?.details || {}).filter((detail) => detail?.source_mode && detail.source_mode !== 'default').length;
    return { total, analysisReady, contributionReady, publicFlow, activeYears };
  }, [uploadContexts, personalSourceInfo]);

  const handleFile = useCallback((file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['nc', 'nc4', 'netcdf'].includes(ext)) {
      showToast(t('explore.upload.wrongFormat'), 'error');
      return;
    }

    setUploadState('uploading');
    setUploadProgress(0);
    setUploadPhase('uploading');
    setUploadResult(null);
    setLatestReview({ uploadId: null, quality: null, lineage: null });

    const token = localStorage.getItem('aresvision_token');
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const pct = Math.min(88, Math.round((e.loaded / e.total) * 88));
        setUploadProgress(pct);
      }
    });

    xhr.addEventListener('load', () => {
      setUploadPhase('validating');
      setUploadProgress(100);

      setTimeout(async () => {
        let payload;
        try {
          const data = JSON.parse(xhr.responseText);
          const ok = xhr.status >= 200 && xhr.status < 400 && data.status !== 'invalid';
          payload = { ok, data, status: xhr.status };
        } catch {
          payload = { ok: false, data: { detail: '响应解析失败' }, status: xhr.status };
        }

        setUploadResult(payload);
        setUploadState('result');

        await loadWorkbench();
        if (payload.ok && payload.data?.upload_id) {
          await hydrateLatestReview(payload.data.upload_id);
        }
      }, 700);
    });

    xhr.addEventListener('error', () => {
      setUploadResult({ ok: false, data: { detail: '网络错误，请检查连接' }, status: 0 });
      setUploadState('result');
    });

    xhr.open('POST', '/api/upload/nc');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  }, [hydrateLatestReview, loadWorkbench, showToast, t]);

  useEffect(() => {
    if (uploadState !== 'result') return;
    const delay = uploadResult?.ok ? 5000 : 8000;
    const timer = setTimeout(() => {
      setUploadState('idle');
      setUploadResult(null);
      setUploadProgress(0);
    }, delay);
    return () => clearTimeout(timer);
  }, [uploadState, uploadResult]);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    if (uploadState === 'idle') setIsDragging(true);
  }, [uploadState]);

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onFileChange = useCallback((e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
    e.target.value = '';
  }, [handleFile]);

  const handleDeleteConfirm = async () => {
    const id = confirmDelete;
    setConfirmDelete(null);
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      await deleteUpload(id);
      setUploads((prev) => prev.filter((u) => u.id !== id));
      if (viewingId === id) setViewingId(null);
      if (latestReview.uploadId === id) setLatestReview({ uploadId: null, quality: null, lineage: null });
      showToast(t('explore.myData.deleteSuccess'), 'success');
      await loadWorkbench();
    } catch (e) {
      showToast(e.message || '删除失败', 'error');
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  if (!user) {
    return <LoginPrompt t={t} openAuthModal={openAuthModal} />;
  }

  const viewingUpload = viewingId != null ? uploads.find((u) => u.id === viewingId) : null;
  const viewingCtx = viewingId != null ? uploadContextMap.get(viewingId) : null;
  const latestCtx = latestReview.uploadId != null ? uploadContextMap.get(latestReview.uploadId) : null;
  const personalMessage = personalSourceInfo?.source_meta?.message;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <GlowCard style={{ padding: 20 }}>
        <UploadZone
          t={t}
          uploadState={uploadState}
          uploadProgress={uploadProgress}
          uploadPhase={uploadPhase}
          uploadResult={uploadResult}
          isDragging={isDragging}
          fileInputRef={fileInputRef}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onFileChange={onFileChange}
          onReset={() => {
            setUploadState('idle');
            setUploadResult(null);
            setUploadProgress(0);
          }}
        />
      </GlowCard>

      <GlowCard style={{ padding: '18px 20px' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.blue,
            fontFamily: "'Orbitron', sans-serif",
            letterSpacing: 2,
            marginBottom: 12,
          }}
        >
          {t('explore.myData.workbenchTitle')}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <WorkbenchStat eyebrow="INGESTED" value={workbenchStats.total} label={t('explore.myData.workbenchTotal')} desc={t('explore.myData.workbenchTotalDesc')} accent={C.blue} />
          <WorkbenchStat eyebrow="ANALYSIS READY" value={workbenchStats.analysisReady} label={t('explore.myData.workbenchAnalysis')} desc={t('explore.myData.workbenchAnalysisDesc')} accent={C.green} />
          <WorkbenchStat eyebrow="PUBLIC READY" value={workbenchStats.contributionReady} label={t('explore.myData.workbenchPublic')} desc={t('explore.myData.workbenchPublicDesc')} accent={C.mars} />
          <WorkbenchStat eyebrow="ACTIVE YEARS" value={workbenchStats.activeYears} label={t('explore.myData.workbenchYears')} desc={t('explore.myData.workbenchYearsDesc')} accent="#f59e0b" />
        </div>

        {personalMessage && (
          <div
            style={{
              marginTop: 14,
              fontSize: 11,
              color: C.ice30,
              lineHeight: 1.75,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            {personalMessage}
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          <Badge label={`${t('explore.myData.workbenchBadge1')}: ${workbenchStats.publicFlow}`} color={C.blue} bg="rgba(74,158,255,0.1)" />
          <Badge label={`${t('explore.myData.workbenchBadge2')}: ${uploads.filter((u) => u.status === 'invalid').length}`} color={C.mars} bg="rgba(199,91,57,0.1)" />
          <Badge label={`${t('explore.myData.workbenchBadge3')}: ${workbenchStats.analysisReady}`} color={C.green} bg="rgba(74,207,172,0.1)" />
        </div>
      </GlowCard>

      {latestCtx && (
        <UploadReviewCard title={t('explore.myData.latestReviewTitle')} ctx={latestCtx} quality={latestReview.quality} lineage={latestReview.lineage} t={t} />
      )}

      {validUploads.length > 0 && <ContributeBanner t={t} onOpenModal={() => setContributeOpen(true)} />}

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2 }}>
            {t('explore.myData.title')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {uploads.length > 0 && <div style={{ fontSize: 11, color: C.ice30 }}>{t('explore.myData.count', { n: uploads.length })}</div>}
            {uploads.some((u) => u.is_public) && (
              <button
                onClick={() => setHistoryOpen(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 11,
                  color: C.blue,
                  fontFamily: 'inherit',
                  padding: 0,
                  textDecoration: 'underline',
                  textUnderlineOffset: 3,
                }}
              >
                {t('explore.contribute.historyLink')}
              </button>
            )}
          </div>
        </div>

        {uploadsLoading && <div style={{ textAlign: 'center', color: C.ice30, padding: '40px 0', fontSize: 12 }}>{t('common.loading')}</div>}

        {!uploadsLoading && uploads.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              padding: '40px 20px',
              textAlign: 'center',
              border: `1px dashed ${C.border}`,
              borderRadius: 12,
            }}
          >
            <div style={{ color: C.ice30, opacity: 0.45 }}>
              <FolderOpenIcon size={36} color="currentColor" />
            </div>
            <div style={{ fontSize: 12, color: C.ice30 }}>{t('explore.myData.emptyHint')}</div>
          </div>
        )}

        {!uploadsLoading && uploads.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {uploadContexts.map((ctx) => (
              <UploadCard
                key={ctx.upload.id}
                ctx={ctx}
                t={t}
                actionLoading={actionLoading}
                isViewing={viewingId === ctx.upload.id}
                onView={() => setViewingId(viewingId === ctx.upload.id ? null : ctx.upload.id)}
                onDelete={() => setConfirmDelete(ctx.upload.id)}
              />
            ))}
          </div>
        )}
      </div>

      {viewingUpload && (
        <GlowCard breathe style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 4 }}>
                DATA VIEWER
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: C.ice60,
                  maxWidth: 620,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {viewingUpload.filename}
                {viewData.summary && (
                  <span style={{ marginLeft: 8, color: C.ice30, fontSize: 11 }}>
                    ({viewData.summary.data_type}
                    {viewData.summary.ls_range ? ` · Ls ${viewData.summary.ls_range[0].toFixed(0)}°–${viewData.summary.ls_range[1].toFixed(0)}°` : ''})
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setViewingId(null)}
              style={{
                background: 'none',
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                color: C.ice30,
                fontSize: 11,
                cursor: 'pointer',
                padding: '4px 12px',
                fontFamily: 'inherit',
              }}
            >
              {t('explore.myData.cancelBtn')}
            </button>
          </div>

          {viewData.loading && <LoadingBox h={300} />}

          {!viewData.loading && viewData.error && (
            <div style={{ padding: '24px', textAlign: 'center', color: C.mars, fontSize: 13, border: `1px dashed ${C.border}`, borderRadius: 12 }}>
              {viewData.error}
            </div>
          )}

          {!viewData.loading && !viewData.error && viewData.summary && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <UploadReviewCard title={t('explore.myData.detailReviewTitle')} ctx={viewingCtx} quality={viewData.quality} lineage={viewData.lineage} t={t} />

              {viewData.summary.has_ozone && (
                <>
                  {viewData.summary.ls_range && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 11, color: C.ice60, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1, whiteSpace: 'nowrap' }}>Ls</span>
                      <input
                        type="range"
                        min={Math.round(viewData.summary.ls_range[0])}
                        max={Math.round(viewData.summary.ls_range[1])}
                        step={5}
                        value={viewLs}
                        onChange={(e) => handleViewLsChange(Number(e.target.value))}
                        style={{ flex: 1, accentColor: C.mars }}
                      />
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif", minWidth: 50, textAlign: 'right' }}>{viewLs}°</span>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 8 }}>
                        {t('explore.viewer.globeTitle')}
                      </div>
                      {viewData.globe ? <GlobePlot data={viewData.globe} h={260} /> : <LoadingBox h={260} />}
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.blue, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 8 }}>
                        {t('explore.viewer.heatmapTitle')}
                      </div>
                      {viewData.heatmap ? <HeatmapCanvas data={viewData.heatmap} h={260} /> : <LoadingBox h={260} />}
                    </div>
                  </div>

                  {viewData.bands && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.blue, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 8 }}>
                        {t('explore.viewer.bandsTitle')}
                      </div>
                      <LineChart data={viewData.bands} h={200} />
                    </div>
                  )}
                </>
              )}

              {!viewData.summary.has_ozone && viewData.summary.has_mcd_vars?.length > 0 && (
                <div style={{ padding: '32px 20px', textAlign: 'center', border: `1px dashed ${C.border}`, borderRadius: 12 }}>
                  <div style={{ fontSize: 13, color: C.ice60, marginBottom: 8 }}>{t('explore.viewer.mcdOnly')}</div>
                  <div style={{ fontSize: 11, color: C.ice30 }}>
                    {t('explore.viewer.mcdVars')}: {viewData.summary.has_mcd_vars.join(', ')}
                  </div>
                </div>
              )}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: '8px 16px',
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  fontSize: 11,
                }}
              >
                <div>
                  <span style={{ color: C.ice30 }}>{t('explore.viewer.dataType')}: </span>
                  <span style={{ color: C.ice60 }}>{viewData.summary.data_type}</span>
                </div>
                <div>
                  <span style={{ color: C.ice30 }}>{t('explore.viewer.gridSize')}: </span>
                  <span style={{ color: C.ice60 }}>{viewData.summary.lat_points}×{viewData.summary.lon_points}</span>
                </div>
                <div>
                  <span style={{ color: C.ice30 }}>{t('explore.viewer.lsPoints')}: </span>
                  <span style={{ color: C.ice60 }}>{viewData.summary.ls_points}</span>
                </div>
                {viewData.summary.ls_range && (
                  <div>
                    <span style={{ color: C.ice30 }}>{t('explore.viewer.lsRange')}: </span>
                    <span style={{ color: C.ice60 }}>
                      {viewData.summary.ls_range[0].toFixed(1)}° – {viewData.summary.ls_range[1].toFixed(1)}°
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </GlowCard>
      )}

      {confirmDelete != null && (
        <ConfirmDialog
          title={t('explore.myData.confirmDeleteTitle')}
          message={t('explore.myData.confirmDeleteMsg')}
          confirmLabel={t('explore.myData.confirmDeleteBtn')}
          cancelLabel={t('explore.myData.cancelBtn')}
          confirmColor={C.mars}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <ContributeModal open={contributeOpen} onClose={() => setContributeOpen(false)} validUploads={validUploads} onDone={loadWorkbench} />

      <ContributeHistoryPanel
        open={historyOpen}
        onClose={() => {
          setHistoryOpen(false);
          loadWorkbench();
        }}
      />
    </div>
  );
}
