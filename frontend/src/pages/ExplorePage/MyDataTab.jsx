/**
 * MyDataTab — "我的数据" Tab 内容
 * 包含：上传区域（拖拽/点击）+ 贡献横幅 + 数据列表
 * 审核相关状态和贡献功能独立到 ContributeModal / ContributeHistoryPanel
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import C from '../../constants/colors';
import { useT } from '../../i18n';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import GlowCard from '../../components/GlowCard';
import ConfirmDialog from '../../components/ConfirmDialog';
import ContributeModal from '../../components/ContributeModal';
import ContributeHistoryPanel from '../../components/ContributeHistoryPanel';
import { getMyUploads, deleteUpload, fetchUserDataSummary, fetchUserGlobeData, fetchUserHeatmap, fetchUserBands } from '../../services/api';
import HeatmapCanvas from './HeatmapCanvas';
import LineChart from './LineChart';
import GlobePlot from './GlobePlot';
import { LoadingBox } from './ExploreComponents';

// ─── SVG Icons ───────────────────────────────────────────────────────────────

function CloudUploadIcon({ size = 40, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  );
}

function FolderOpenIcon({ size = 32, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function FileIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </svg>
  );
}

function LockIcon({ size = 48, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function SearchIcon({ size = 40, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function GiftIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── StatusBadge（仅显示校验相关状态）────────────────────────────────────────

function StatusBadge({ status, t }) {
  // 只有校验失败才显示红色标签；valid 不显示（上传成功即已验证，无需强调）
  if (status !== 'invalid') return null;
  const label = t(`explore.myData.status.${status}`) || status;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20,
      background: 'rgba(199,91,57,0.10)', color: C.mars,
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%',
        background: C.mars, flexShrink: 0, display: 'inline-block',
      }} />
      {label}
    </span>
  );
}

// ─── MetaRow ─────────────────────────────────────────────────────────────────

function MetaRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
      <span style={{ fontSize: 10, color: C.ice30, whiteSpace: 'nowrap', minWidth: 58 }}>{label}</span>
      <span style={{ fontSize: 12, color: C.ice60, fontWeight: 500 }}>{value ?? '—'}</span>
    </div>
  );
}

// ─── UploadZone ──────────────────────────────────────────────────────────────

function UploadZone({ t, uploadState, uploadProgress, uploadPhase, uploadResult, isDragging, fileInputRef, onDragOver, onDragLeave, onDrop, onFileChange, onReset }) {
  const isIdle      = uploadState === 'idle';
  const isUploading = uploadState === 'uploading';
  const isResult    = uploadState === 'result';

  const resultOk    = uploadResult?.ok;
  const hasWarnings = resultOk && uploadResult?.data?.warnings?.length > 0;
  const resultType  = !uploadResult ? null
    : (resultOk ? (hasWarnings ? 'warning' : 'success') : 'error');

  const borderColor = isDragging ? C.blue
    : isResult
      ? (resultType === 'success' ? '#22c55e' : resultType === 'warning' ? '#f59e0b' : C.mars)
      : C.border;

  const bgColor = isDragging ? 'rgba(74,158,255,0.05)'
    : isResult
      ? (resultType === 'success' ? 'rgba(34,197,94,0.03)'
        : resultType === 'warning' ? 'rgba(245,158,11,0.03)'
        : 'rgba(199,91,57,0.03)')
      : 'transparent';

  const resultIconColor = resultType === 'success' ? '#22c55e'
    : resultType === 'warning' ? '#f59e0b'
    : C.mars;

  return (
    <div
      style={{
        border: `2px ${isDragging || isResult ? 'solid' : 'dashed'} ${borderColor}`,
        borderRadius: 16,
        background: bgColor,
        padding: '32px 28px',
        minHeight: 200,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        cursor: isIdle ? 'pointer' : 'default',
        transition: 'border-color 0.2s, background 0.2s',
        userSelect: 'none',
      }}
      onClick={() => isIdle && fileInputRef.current?.click()}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".nc,.nc4,.netcdf"
        style={{ display: 'none' }}
        onChange={onFileChange}
      />

      {/* ── Idle ── */}
      {isIdle && (
        <>
          <div style={{ color: isDragging ? C.blue : C.ice30, marginBottom: 12, opacity: isDragging ? 1 : 0.7 }}>
            <CloudUploadIcon size={40} color="currentColor" />
          </div>
          <div style={{
            fontSize: 15, fontWeight: 700, color: isDragging ? C.blue : C.ice,
            fontFamily: "'Orbitron', sans-serif", marginBottom: 8, textAlign: 'center',
          }}>
            {isDragging ? t('explore.upload.dragActive') : t('explore.upload.title')}
          </div>
          {!isDragging && (
            <>
              <div style={{ fontSize: 12, color: C.ice60, maxWidth: 520, textAlign: 'center', lineHeight: 1.7, marginBottom: 16 }}>
                {t('explore.upload.subtitle')}
              </div>
              <div style={{
                fontSize: 11, color: C.ice30,
                border: `1px solid ${C.border}`, borderRadius: 8,
                padding: '5px 14px', letterSpacing: 0.4,
              }}>
                {t('explore.upload.dragHint')} · {t('explore.upload.clickHint')}
              </div>
            </>
          )}
        </>
      )}

      {/* ── Uploading ── */}
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
            <div style={{
              height: '100%',
              width: `${uploadProgress}%`,
              background: uploadPhase === 'validating' ? '#f59e0b' : C.blue,
              borderRadius: 3,
              transition: 'width 0.25s ease, background 0.3s',
            }} />
          </div>
        </div>
      )}

      {/* ── Result ── */}
      {isResult && uploadResult && (
        <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{
              fontSize: 14, fontWeight: 700, color: resultIconColor,
              fontFamily: "'Orbitron', sans-serif", letterSpacing: 1,
            }}>
              {resultType === 'success' ? t('explore.upload.success')
                : resultType === 'warning' ? t('explore.upload.warning')
                : t('explore.upload.failed')}
            </div>
            <button
              onClick={e => { e.stopPropagation(); onReset(); }}
              style={{
                background: 'none', border: `1px solid ${C.border}`, borderRadius: 6,
                color: C.ice60, fontSize: 11, cursor: 'pointer', padding: '3px 10px',
              }}
            >
              {t('explore.upload.closeResult')}
            </button>
          </div>

          {resultOk && (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: '8px 16px', padding: '12px 16px',
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${C.border}`, borderRadius: 10,
            }}>
              {uploadResult.data.data_type && (
                <MetaRow label={t('explore.upload.dataType')} value={uploadResult.data.data_type} />
              )}
              {uploadResult.data.mars_year != null && (
                <MetaRow label={t('explore.upload.marsYear')} value={`MY ${uploadResult.data.mars_year}`} />
              )}
              {uploadResult.data.ls_range?.[0] != null && uploadResult.data.ls_range?.[1] != null && (
                <MetaRow
                  label={t('explore.upload.lsRange')}
                  value={`${Number(uploadResult.data.ls_range[0]).toFixed(1)}° – ${Number(uploadResult.data.ls_range[1]).toFixed(1)}°`}
                />
              )}
              {uploadResult.data.grid_size && (
                <MetaRow
                  label={t('explore.upload.gridSize')}
                  value={`${uploadResult.data.grid_size[0]} × ${uploadResult.data.grid_size[1]}`}
                />
              )}
              {uploadResult.data.variables?.length > 0 && (
                <MetaRow label={t('explore.upload.variables')} value={uploadResult.data.variables.join(', ')} />
              )}
            </div>
          )}

          {hasWarnings && (
            <div style={{ fontSize: 11, color: '#f59e0b', lineHeight: 1.6 }}>
              <span style={{ fontWeight: 600 }}>{t('explore.upload.warnings')}: </span>
              {uploadResult.data.warnings.join('；')}
            </div>
          )}

          {!resultOk && (
            <div style={{
              fontSize: 12, color: C.mars, lineHeight: 1.6,
              padding: '10px 14px',
              background: 'rgba(199,91,57,0.06)',
              border: `1px solid rgba(199,91,57,0.25)`, borderRadius: 8,
            }}>
              <span style={{ fontWeight: 600 }}>{t('explore.upload.errorDetail')}: </span>
              {uploadResult.data?.error || uploadResult.data?.detail || '未知错误'}
            </div>
          )}

          <div style={{ fontSize: 10, color: C.ice30, textAlign: 'right' }}>
            {resultOk ? '5' : '8'}s 后自动关闭
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ContributeBanner ────────────────────────────────────────────────────────

function ContributeBanner({ t, onOpenModal }) {
  const [hovBtn, setHovBtn] = useState(false);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 22px',
      background: 'linear-gradient(90deg, rgba(74,158,255,0.07) 0%, rgba(199,91,57,0.06) 100%)',
      border: `1px solid rgba(74,158,255,0.18)`,
      borderRadius: 14,
      gap: 16,
    }}>
      <div style={{ fontSize: 13, color: C.ice60, flex: 1, minWidth: 0 }}>
        {t('explore.contribute.bannerText')}
      </div>
      <button
        onClick={onOpenModal}
        onMouseEnter={() => setHovBtn(true)}
        onMouseLeave={() => setHovBtn(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '8px 18px', borderRadius: 9, border: 'none',
          background: hovBtn ? C.mars : 'rgba(199,91,57,0.85)',
          color: '#fff', fontSize: 12, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
          transition: 'background 0.15s',
          whiteSpace: 'nowrap', flexShrink: 0,
        }}
      >
        <GiftIcon size={14} color="#fff" />
        {t('explore.contribute.bannerBtn')}
      </button>
    </div>
  );
}

// ─── ActionBtn ───────────────────────────────────────────────────────────────

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
        color: loading ? C.ice30 : (textColor ?? C.ice60),
        fontSize: 11, fontWeight: 600,
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

// ─── UploadCard ───────────────────────────────────────────────────────────────

function UploadCard({ upload, t, actionLoading, isViewing, onView, onDelete }) {
  const loading = actionLoading[upload.id];

  // 是否已进入贡献流程
  const isContributed = ['pending_review', 'approved', 'rejected'].includes(upload.status);

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid ${isViewing ? C.blue : C.border}`,
      borderRadius: 14,
      padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 10,
      minWidth: 280, maxWidth: 360, flex: '1 1 300px',
      transition: 'border-color 0.2s',
    }}>
      {/* Filename */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: C.ice30, flexShrink: 0 }}>
          <FileIcon size={14} color="currentColor" />
        </span>
        <span style={{
          fontSize: 13, fontWeight: 700, color: C.ice,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }} title={upload.filename}>
          {upload.filename}
        </span>
      </div>

      {/* Meta */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 8px' }}>
        <MetaRow label={t('explore.myData.cardType')}     value={upload.data_type || '—'} />
        <MetaRow label={t('explore.myData.cardMarsYear')} value={upload.mars_year != null ? `MY ${upload.mars_year}` : '—'} />
        {upload.ls_start != null && upload.ls_end != null && (
          <MetaRow
            label={t('explore.myData.cardLs')}
            value={`${Number(upload.ls_start).toFixed(1)}° – ${Number(upload.ls_end).toFixed(1)}°`}
          />
        )}
        <MetaRow label={t('explore.myData.cardSize')} value={formatFileSize(upload.file_size)} />
        <MetaRow label={t('explore.myData.cardTime')} value={formatDate(upload.created_at)} />
      </div>

      {/* Status — 只显示 valid / invalid */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <StatusBadge status={upload.status} t={t} />
        {/* 已贡献小标记 — 低调灰色小字 */}
        {isContributed && (
          <span style={{
            fontSize: 11, color: C.ice30,
            whiteSpace: 'nowrap',
          }}>
            {t('explore.contribute.contributed')}
          </span>
        )}
      </div>

      {/* Actions — 只有查看 + 删除 */}
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
        <ActionBtn
          label={t('explore.myData.deleteBtn')}
          borderColor="rgba(199,91,57,0.5)"
          textColor={C.mars}
          onClick={onDelete}
          disabled={loading}
          loading={loading}
        />
      </div>
    </div>
  );
}

// ─── LoginPrompt ──────────────────────────────────────────────────────────────

function LoginPrompt({ t, openAuthModal }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '80px 40px', gap: 20, textAlign: 'center',
    }}>
      <div style={{ color: C.ice30, opacity: 0.5 }}>
        <LockIcon size={52} color="currentColor" />
      </div>
      <div style={{ fontSize: 16, color: C.ice, fontWeight: 600 }}>
        {t('explore.upload.loginPrompt')}
      </div>
      <button
        onClick={() => openAuthModal('login')}
        style={{
          padding: '10px 28px', borderRadius: 10,
          background: C.mars, border: 'none', color: '#fff',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
          fontFamily: "'Orbitron', sans-serif", letterSpacing: 1,
        }}
      >
        {t('explore.upload.loginBtn')}
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MyDataTab() {
  const t = useT();
  const { user, openAuthModal } = useAuth();
  const { showToast } = useToast();

  // Upload state machine
  const [uploadState, setUploadState]       = useState('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase]       = useState('uploading');
  const [uploadResult, setUploadResult]     = useState(null);
  const [isDragging, setIsDragging]         = useState(false);
  const fileInputRef = useRef(null);

  // List state
  const [uploads, setUploads]               = useState([]);
  const [uploadsLoading, setUploadsLoading] = useState(false);
  const [viewingId, setViewingId]           = useState(null);

  // View data state
  const [viewData, setViewData] = useState({
    summary: null, globe: null, heatmap: null, bands: null,
    loading: false, error: null,
  });
  const [viewLs, setViewLs] = useState(90);

  // Confirm + action
  const [confirmDelete, setConfirmDelete]   = useState(null);
  const [actionLoading, setActionLoading]   = useState({});

  // Modals
  const [contributeOpen, setContributeOpen]   = useState(false);
  const [historyOpen, setHistoryOpen]         = useState(false);

  // ── Load uploads ──────────────────────────────────────────────────────────
  const loadUploads = useCallback(async () => {
    if (!user) return;
    setUploadsLoading(true);
    try {
      const data = await getMyUploads();
      setUploads(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Load uploads error:', e);
    } finally {
      setUploadsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) loadUploads();
  }, [user, loadUploads]);

  // ── Load view data ─────────────────────────────────────────────────────────
  const loadViewData = useCallback(async (uploadId) => {
    setViewData({ summary: null, globe: null, heatmap: null, bands: null, loading: true, error: null });
    try {
      const summary = await fetchUserDataSummary(uploadId);
      let defaultLs = 90;
      if (summary.ls_range) {
        defaultLs = Math.round((summary.ls_range[0] + summary.ls_range[1]) / 2);
      }
      setViewLs(defaultLs);

      let globe = null, heatmap = null, bands = null;
      if (summary.has_ozone) {
        [globe, heatmap, bands] = await Promise.all([
          fetchUserGlobeData(uploadId, defaultLs).catch(() => null),
          fetchUserHeatmap(uploadId, 'o3col').catch(() => null),
          fetchUserBands(uploadId).catch(() => null),
        ]);
      }

      setViewData({ summary, globe, heatmap, bands, loading: false, error: null });
    } catch (e) {
      setViewData(prev => ({ ...prev, loading: false, error: e.message || t('common.error') }));
    }
  }, [t]);

  useEffect(() => {
    if (viewingId != null) {
      loadViewData(viewingId);
    } else {
      setViewData({ summary: null, globe: null, heatmap: null, bands: null, loading: false, error: null });
    }
  }, [viewingId, loadViewData]);

  const handleViewLsChange = useCallback(async (newLs) => {
    setViewLs(newLs);
    if (viewingId == null) return;
    try {
      const globe = await fetchUserGlobeData(viewingId, newLs);
      setViewData(prev => ({ ...prev, globe }));
    } catch {
      // 静默失败，保留旧数据
    }
  }, [viewingId]);

  // valid datasets available for contribution (not yet in review/approved flow)
  const validUploads = uploads.filter(u => u.status === 'valid');

  // ── File upload via XHR ───────────────────────────────────────────────────
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
      setTimeout(() => {
        try {
          const data = JSON.parse(xhr.responseText);
          // HTTP 200 只表示请求处理完成；data.status === 'invalid' 表示校验失败
          const ok = xhr.status >= 200 && xhr.status < 400 && data.status !== 'invalid';
          setUploadResult({ ok, data, status: xhr.status });
        } catch {
          setUploadResult({ ok: false, data: { detail: '响应解析失败' }, status: xhr.status });
        }
        setUploadState('result');
        loadUploads();
      }, 700);
    });

    xhr.addEventListener('error', () => {
      setUploadResult({ ok: false, data: { detail: '网络错误，请检查连接' }, status: 0 });
      setUploadState('result');
    });

    xhr.open('POST', '/api/upload/nc');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  }, [loadUploads, showToast, t]);

  // Auto reset result
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

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const onDragOver  = useCallback((e) => { e.preventDefault(); if (uploadState === 'idle') setIsDragging(true); }, [uploadState]);
  const onDragLeave = useCallback(() => setIsDragging(false), []);
  const onDrop      = useCallback((e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }, [handleFile]);
  const onFileChange = useCallback((e) => { const f = e.target.files[0]; if (f) handleFile(f); e.target.value = ''; }, [handleFile]);

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    const id = confirmDelete;
    setConfirmDelete(null);
    setActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      await deleteUpload(id);
      setUploads(prev => prev.filter(u => u.id !== id));
      if (viewingId === id) setViewingId(null);
      showToast(t('explore.myData.deleteSuccess'), 'success');
    } catch (e) {
      showToast(e.message || '删除失败', 'error');
    } finally {
      setActionLoading(prev => { const n = { ...prev }; delete n[id]; return n; });
    }
  };

  // ── Not logged in ─────────────────────────────────────────────────────────
  if (!user) {
    return <LoginPrompt t={t} openAuthModal={openAuthModal} />;
  }

  const viewingUpload = viewingId != null ? uploads.find(u => u.id === viewingId) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ─── Upload Zone ─── */}
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
          onReset={() => { setUploadState('idle'); setUploadResult(null); setUploadProgress(0); }}
        />
      </GlowCard>

      {/* ─── Contribute Banner（仅当有可贡献数据集时显示）─── */}
      {validUploads.length > 0 && (
        <ContributeBanner t={t} onOpenModal={() => setContributeOpen(true)} />
      )}

      {/* ─── My Uploads List ─── */}
      <div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: C.blue,
            fontFamily: "'Orbitron', sans-serif", letterSpacing: 2,
          }}>
            {t('explore.myData.title')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {uploads.length > 0 && (
              <div style={{ fontSize: 11, color: C.ice30 }}>
                {t('explore.myData.count', { n: uploads.length })}
              </div>
            )}
            {/* 查看贡献记录入口 — 只要有任何贡献记录就始终显示 */}
            {uploads.some(u => u.is_public) && (
              <button
                onClick={() => setHistoryOpen(true)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 11, color: C.blue, fontFamily: 'inherit',
                  padding: 0,
                  textDecoration: 'underline', textUnderlineOffset: 3,
                }}
              >
                {t('explore.contribute.historyLink')}
              </button>
            )}
          </div>
        </div>

        {uploadsLoading && (
          <div style={{ textAlign: 'center', color: C.ice30, padding: '40px 0', fontSize: 12 }}>
            {t('common.loading')}
          </div>
        )}

        {!uploadsLoading && uploads.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 10, padding: '40px 20px', textAlign: 'center',
            border: `1px dashed ${C.border}`, borderRadius: 12,
          }}>
            <div style={{ color: C.ice30, opacity: 0.45 }}>
              <FolderOpenIcon size={36} color="currentColor" />
            </div>
            <div style={{ fontSize: 12, color: C.ice30 }}>
              {t('explore.myData.emptyHint')}
            </div>
          </div>
        )}

        {!uploadsLoading && uploads.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {uploads.map(upload => (
              <UploadCard
                key={upload.id}
                upload={upload}
                t={t}
                actionLoading={actionLoading}
                isViewing={viewingId === upload.id}
                onView={() => setViewingId(viewingId === upload.id ? null : upload.id)}
                onDelete={() => setConfirmDelete(upload.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── Data Viewer ─── */}
      {viewingUpload && (
        <GlowCard breathe style={{ padding: 24 }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 16,
          }}>
            <div>
              <div style={{
                fontSize: 11, fontWeight: 700, color: C.blue,
                fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 4,
              }}>
                DATA VIEWER
              </div>
              <div style={{
                fontSize: 12, color: C.ice60, maxWidth: 420,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {viewingUpload.filename}
                {viewData.summary && (
                  <span style={{ marginLeft: 8, color: C.ice30, fontSize: 11 }}>
                    ({viewData.summary.data_type}
                    {viewData.summary.ls_range
                      ? ` · Ls ${viewData.summary.ls_range[0].toFixed(0)}°–${viewData.summary.ls_range[1].toFixed(0)}°`
                      : ''})
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setViewingId(null)}
              style={{
                background: 'none', border: `1px solid ${C.border}`, borderRadius: 6,
                color: C.ice30, fontSize: 11, cursor: 'pointer', padding: '4px 12px',
                fontFamily: 'inherit',
              }}
            >
              {t('explore.myData.cancelBtn')}
            </button>
          </div>

          {/* Loading */}
          {viewData.loading && <LoadingBox h={300} />}

          {/* Error */}
          {!viewData.loading && viewData.error && (
            <div style={{
              padding: '24px', textAlign: 'center', color: C.mars,
              fontSize: 13, border: `1px dashed ${C.border}`, borderRadius: 12,
            }}>
              {viewData.error}
            </div>
          )}

          {/* Visualizations */}
          {!viewData.loading && !viewData.error && viewData.summary && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* OpenMARS: ozone charts */}
              {viewData.summary.has_ozone && (
                <>
                  {/* Ls slider */}
                  {viewData.summary.ls_range && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{
                        fontSize: 11, color: C.ice60, fontFamily: "'Orbitron', sans-serif",
                        letterSpacing: 1, whiteSpace: 'nowrap',
                      }}>Ls</span>
                      <input
                        type="range"
                        min={Math.round(viewData.summary.ls_range[0])}
                        max={Math.round(viewData.summary.ls_range[1])}
                        step={5}
                        value={viewLs}
                        onChange={e => handleViewLsChange(Number(e.target.value))}
                        style={{ flex: 1, accentColor: C.mars }}
                      />
                      <span style={{
                        fontSize: 14, fontWeight: 700, color: C.mars,
                        fontFamily: "'Orbitron', sans-serif", minWidth: 50, textAlign: 'right',
                      }}>
                        {viewLs}°
                      </span>
                    </div>
                  )}

                  {/* Globe + heatmap side by side */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <div style={{
                        fontSize: 10, fontWeight: 700, color: C.mars,
                        fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 8,
                      }}>
                        {t('explore.viewer.globeTitle')}
                      </div>
                      {viewData.globe ? <GlobePlot data={viewData.globe} h={260} /> : <LoadingBox h={260} />}
                    </div>
                    <div>
                      <div style={{
                        fontSize: 10, fontWeight: 700, color: C.blue,
                        fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 8,
                      }}>
                        {t('explore.viewer.heatmapTitle')}
                      </div>
                      {viewData.heatmap ? <HeatmapCanvas data={viewData.heatmap} h={260} /> : <LoadingBox h={260} />}
                    </div>
                  </div>

                  {/* Bands (full width) */}
                  {viewData.bands && (
                    <div>
                      <div style={{
                        fontSize: 10, fontWeight: 700, color: C.blue,
                        fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 8,
                      }}>
                        {t('explore.viewer.bandsTitle')}
                      </div>
                      <LineChart data={viewData.bands} h={200} />
                    </div>
                  )}
                </>
              )}

              {/* MCD-only: no ozone */}
              {!viewData.summary.has_ozone && viewData.summary.has_mcd_vars?.length > 0 && (
                <div style={{
                  padding: '32px 20px', textAlign: 'center',
                  border: `1px dashed ${C.border}`, borderRadius: 12,
                }}>
                  <div style={{ fontSize: 13, color: C.ice60, marginBottom: 8 }}>
                    {t('explore.viewer.mcdOnly')}
                  </div>
                  <div style={{ fontSize: 11, color: C.ice30 }}>
                    {t('explore.viewer.mcdVars')}: {viewData.summary.has_mcd_vars.join(', ')}
                  </div>
                </div>
              )}

              {/* Info cards */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: '8px 16px', padding: '12px 16px',
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${C.border}`, borderRadius: 10,
                fontSize: 11,
              }}>
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

      {/* ─── Confirm Delete ─── */}
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

      {/* ─── Contribute Modal ─── */}
      <ContributeModal
        open={contributeOpen}
        onClose={() => setContributeOpen(false)}
        validUploads={validUploads}
        onDone={loadUploads}
      />

      {/* ─── Contribution History Panel ─── */}
      <ContributeHistoryPanel
        open={historyOpen}
        onClose={() => { setHistoryOpen(false); loadUploads(); }}
      />
    </div>
  );
}
