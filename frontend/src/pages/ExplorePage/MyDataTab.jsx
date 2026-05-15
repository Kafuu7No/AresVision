import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import C from '../../constants/colors';
import { useT } from '../../i18n';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
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
  getMyUploads,
} from '../../services/api';
import HeatmapCanvas from './HeatmapCanvas';
import LineChart from './LineChart';
import GlobePlot from './GlobePlot';
import { LoadingBox } from './ExploreComponents';

const ACTIVE_UPLOAD_STATUSES = new Set(['valid', 'pending_review', 'approved']);

function createCopy(isZh) {
  return {
    myHubTitle: isZh ? '个人数据接入与贡献工作台' : 'Personal Ingestion & Contribution Workbench',
    myHubDesc: isZh
      ? '这里负责两件事：把你上传的数据接入为个人数据源，并在你愿意时把合格数据提交给平台审核，争取进入官方数据中心。'
      : 'This area does two things: it ingests your uploads into a personal data source, and it lets you submit qualified datasets for platform review when you want to contribute them.',
    contributionTitle: isZh ? '贡献给平台' : 'Contribute To Platform',
    contributionDesc: isZh
      ? '只有通过基础校验且处于可管理状态的数据，才适合进入公共贡献流程。贡献后会进入管理员审核，不会立刻成为官方数据。'
      : 'Only datasets that passed base validation and remain in a manageable state should enter the public contribution flow. After submission they go to admin review, not directly into official assets.',
    contributionOpen: isZh ? '选择数据集并贡献' : 'Select Datasets To Contribute',
    contributionHistory: isZh ? '查看贡献记录' : 'View Contribution History',
    contributionNone: isZh ? '当前没有可提交贡献的数据集。' : 'No datasets are currently eligible for contribution.',
    canUseTitle: isZh ? '分析使用条件' : 'Analysis Usage Conditions',
    canUseYes: isZh ? '满足分析使用' : 'Analysis-ready',
    canUseNo: isZh ? '暂不满足分析使用' : 'Not analysis-ready',
    canUseDesc: isZh
      ? '能否被数据概览、分析、预测、训练等页面真正当作个人数据源调用。'
      : 'Whether other pages can actually consume it through the personal data-source path.',
    canContributeTitle: isZh ? '公共贡献条件' : 'Contribution Conditions',
    canContributeYes: isZh ? '可提交公共贡献' : 'Contribution-ready',
    canContributeNo: isZh ? '暂不可贡献' : 'Not ready for contribution',
    canContributeDesc: isZh
      ? '是否适合送入平台审核流程，争取并入官方数据资产。'
      : 'Whether it is suitable to enter the platform review flow and potentially become an official asset.',
    lifeCycleTitle: isZh ? '生命周期状态' : 'Lifecycle Status',
    sourceModeTitle: isZh ? '进入的数据源模式' : 'Source Mode',
    sourceModeDesc: isZh
      ? '个人页面切换到 Personal 时，系统最终会使用哪一种数据源组合。'
      : 'What source combination the system ultimately uses when other pages switch to Personal mode.',
    ruleValid: isZh ? '上传校验通过' : 'Upload validation passed',
    ruleBuildReady: isZh ? '个人数据源构建完成' : 'Personal source build is ready',
    ruleAdopted: isZh ? '已进入个人/混合数据源' : 'Actually adopted into personal or mixed source',
    ruleRejected: isZh ? '未被拒绝或构建失败' : 'Not rejected and not failed',
    ruleContributeBase: isZh ? '状态仍为 valid，可提交审核' : 'Status is still valid and can be submitted',
    ruleContributePending: isZh ? '已进入审核队列' : 'Already in admin review queue',
    ruleContributeApproved: isZh ? '已并入平台官方数据' : 'Already merged into official platform assets',
    ruleContributeRejected: isZh ? '被驳回后需重新整理再上传' : 'Rejected datasets need a new upload/fix cycle',
    lifecycleUploading: isZh ? '上传后待系统处理' : 'Uploaded and waiting for system processing',
    lifecycleBuilding: isZh ? '系统正在构建个人数据源' : 'System is building the personal source',
    lifecycleReady: isZh ? '已进入个人使用链路' : 'Connected to the personal usage path',
    lifecyclePending: isZh ? '已提交平台审核' : 'Submitted for admin review',
    lifecycleApproved: isZh ? '已并入平台官方数据' : 'Merged into official platform assets',
    lifecycleRejected: isZh ? '审核未通过' : 'Rejected in review',
    lifecycleInvalid: isZh ? '基础校验未通过' : 'Failed base validation',
    lifecycleFallback: isZh ? '已上传但未进入有效使用路径' : 'Uploaded but not in the active source path',
    officialCenterLink: isZh ? '官方数据中心会显示已并入的平台数据状态。' : 'Approved platform datasets are reflected in the official dataset center above.',
  };
}

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

function MetaRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
      <span style={{ fontSize: 10, color: C.ice30, whiteSpace: 'nowrap', minWidth: 58 }}>{label}</span>
      <span style={{ fontSize: 12, color: C.ice60, fontWeight: 500 }}>{value ?? '—'}</span>
    </div>
  );
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

function StatTile({ label, value, desc, accent = C.blue }) {
  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: '14px 16px',
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <div style={{ fontSize: 10, color: C.ice30 }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 24, color: accent, fontWeight: 700, fontFamily: "'Orbitron', sans-serif" }}>
        {value}
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: C.ice30, lineHeight: 1.7 }}>{desc}</div>
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

function getBuildStatusKey(personalInfo) {
  const raw = personalInfo?.source_meta?.build_status;
  if (raw) return raw;
  if (personalInfo?.source_meta?.effective_source === 'personal_available') return 'ready';
  return 'idle';
}

function getBuildStatusMeta(status, t) {
  const map = {
    idle: {
      label: t('explore.myData.buildStatus.idle'),
      color: C.ice30,
      bg: 'rgba(255,255,255,0.05)',
    },
    building: {
      label: t('explore.myData.buildStatus.building'),
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.1)',
    },
    ready: {
      label: t('explore.myData.buildStatus.ready'),
      color: C.green,
      bg: 'rgba(74,207,172,0.1)',
    },
    failed: {
      label: t('explore.myData.buildStatus.failed'),
      color: C.mars,
      bg: 'rgba(199,91,57,0.1)',
    },
  };
  return map[status] || map.idle;
}

function getEffectiveSourceLabel(sourceMeta, t) {
  const effectiveSource = sourceMeta?.effective_source;
  if (effectiveSource === 'personal_available') return t('explore.myData.effectiveSource.personal');
  return t('explore.myData.effectiveSource.default');
}

function getYearModeMeta(rawMode, t) {
  const map = {
    personal_full_year: {
      label: t('explore.myData.yearMode.personal_full_year'),
      color: C.green,
      bg: 'rgba(74,207,172,0.1)',
    },
    personal_mcd_plus_system_openmars: {
      label: t('explore.myData.yearMode.personal_mcd_plus_system_openmars'),
      color: C.blue,
      bg: 'rgba(74,158,255,0.1)',
    },
    default: {
      label: t('explore.myData.yearMode.default'),
      color: C.ice30,
      bg: 'rgba(255,255,255,0.05)',
    },
  };
  return map[rawMode] || map.default;
}

function normalizeType(type) {
  return String(type || '').trim().toLowerCase();
}

function deriveDatasetState(upload, personalInfo, buildStatus, t) {
  const yearKey = upload?.mars_year != null ? `MY${upload.mars_year}` : null;
  const detail = yearKey ? personalInfo?.details?.[yearKey] : null;
  const rawMode = detail?.source_mode || 'default';
  const type = normalizeType(upload?.data_type);

  if (!upload) {
    return {
      key: 'inactive',
      usable: false,
      label: t('explore.myData.datasetState.inactive'),
      desc: t('explore.myData.datasetStateDesc.inactive'),
      color: C.ice30,
      bg: 'rgba(255,255,255,0.05)',
      modeMeta: getYearModeMeta(rawMode, t),
      usagePages: [],
    };
  }

  if (upload.status === 'invalid') {
    return {
      key: 'invalid',
      usable: false,
      label: t('explore.myData.datasetState.invalid'),
      desc: upload.validation_message || t('explore.myData.datasetStateDesc.invalid'),
      color: C.mars,
      bg: 'rgba(199,91,57,0.1)',
      modeMeta: getYearModeMeta(rawMode, t),
      usagePages: [],
    };
  }

  if (upload.status === 'rejected') {
    return {
      key: 'rejected',
      usable: false,
      label: t('explore.myData.datasetState.rejected'),
      desc: upload.validation_message || t('explore.myData.datasetStateDesc.rejected'),
      color: C.mars,
      bg: 'rgba(199,91,57,0.1)',
      modeMeta: getYearModeMeta(rawMode, t),
      usagePages: [],
    };
  }

  if (!ACTIVE_UPLOAD_STATUSES.has(upload.status)) {
    return {
      key: 'inactive',
      usable: false,
      label: t('explore.myData.datasetState.inactive'),
      desc: t('explore.myData.datasetStateDesc.inactive'),
      color: C.ice30,
      bg: 'rgba(255,255,255,0.05)',
      modeMeta: getYearModeMeta(rawMode, t),
      usagePages: [],
    };
  }

  if (buildStatus === 'failed') {
    return {
      key: 'failed',
      usable: false,
      label: t('explore.myData.datasetState.failed'),
      desc: t('explore.myData.datasetStateDesc.failed'),
      color: C.mars,
      bg: 'rgba(199,91,57,0.1)',
      modeMeta: getYearModeMeta(rawMode, t),
      usagePages: [],
    };
  }

  if (buildStatus === 'building') {
    return {
      key: 'building',
      usable: false,
      label: t('explore.myData.datasetState.building'),
      desc: t('explore.myData.datasetStateDesc.building'),
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.1)',
      modeMeta: getYearModeMeta(rawMode, t),
      usagePages: [],
    };
  }

  if (rawMode === 'personal_full_year') {
    return {
      key: 'personal',
      usable: true,
      label: t('explore.myData.datasetState.personal'),
      desc: t('explore.myData.datasetStateDesc.personal'),
      color: C.green,
      bg: 'rgba(74,207,172,0.1)',
      modeMeta: getYearModeMeta(rawMode, t),
      usagePages: [
        t('explore.myData.usage.visual'),
        t('explore.myData.usage.analysis'),
        t('explore.myData.usage.predict'),
        t('explore.myData.usage.training'),
      ],
    };
  }

  if (rawMode === 'personal_mcd_plus_system_openmars') {
    if (type === 'mcd') {
      return {
        key: 'mixed',
        usable: true,
        label: t('explore.myData.datasetState.mixed'),
        desc: t('explore.myData.datasetStateDesc.mixed'),
        color: C.blue,
        bg: 'rgba(74,158,255,0.1)',
        modeMeta: getYearModeMeta(rawMode, t),
        usagePages: [
          t('explore.myData.usage.visual'),
          t('explore.myData.usage.analysis'),
          t('explore.myData.usage.predict'),
          t('explore.myData.usage.training'),
        ],
      };
    }

    if (type === 'openmars') {
      return {
        key: 'fallback',
        usable: false,
        label: t('explore.myData.datasetState.fallback'),
        desc: t('explore.myData.datasetStateDesc.fallback'),
        color: C.ice30,
        bg: 'rgba(255,255,255,0.05)',
        modeMeta: getYearModeMeta(rawMode, t),
        usagePages: [],
      };
    }
  }

  return {
    key: 'inactive',
    usable: false,
    label: t('explore.myData.datasetState.inactive'),
    desc: t('explore.myData.datasetStateDesc.inactive'),
    color: C.ice30,
    bg: 'rgba(255,255,255,0.05)',
    modeMeta: getYearModeMeta(rawMode, t),
    usagePages: [],
  };
}

function deriveAnalysisCondition(datasetState, buildStatus, copy) {
  const passedValidation = !['invalid', 'rejected'].includes(datasetState.key);
  const buildReady = buildStatus === 'ready';
  const adopted = datasetState.usable;
  const stable = !['failed', 'building', 'inactive', 'fallback'].includes(datasetState.key);

  return {
    ok: passedValidation && buildReady && adopted && stable,
    rules: [
      { label: copy.ruleValid, ok: passedValidation },
      { label: copy.ruleBuildReady, ok: buildReady },
      { label: copy.ruleAdopted, ok: adopted },
      { label: copy.ruleRejected, ok: stable },
    ],
  };
}

function deriveContributionCondition(upload, copy) {
  const status = upload?.status;
  const isValid = status === 'valid';
  const isPending = status === 'pending_review';
  const isApproved = status === 'approved';
  const isRejected = status === 'rejected';

  return {
    ok: isValid,
    rules: [
      { label: copy.ruleContributeBase, ok: isValid },
      { label: copy.ruleContributePending, ok: isPending },
      { label: copy.ruleContributeApproved, ok: isApproved },
      { label: copy.ruleContributeRejected, ok: !isRejected },
    ],
  };
}

function deriveLifecycleLabel(upload, datasetState, buildStatus, copy) {
  if (upload?.status === 'invalid') return copy.lifecycleInvalid;
  if (upload?.status === 'rejected') return copy.lifecycleRejected;
  if (upload?.status === 'approved') return copy.lifecycleApproved;
  if (upload?.status === 'pending_review') return copy.lifecyclePending;
  if (buildStatus === 'building' || datasetState.key === 'building') return copy.lifecycleBuilding;
  if (datasetState.usable) return copy.lifecycleReady;
  if (datasetState.key === 'fallback' || datasetState.key === 'inactive') return copy.lifecycleFallback;
  return copy.lifecycleUploading;
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

function CurrentSourceCard({ personalInfo, buildStatus, t }) {
  const buildMeta = getBuildStatusMeta(buildStatus, t);
  const activeYears = Object.entries(personalInfo?.details || {}).filter(([, detail]) => detail?.source_mode && detail.source_mode !== 'default');
  const sourceMeta = personalInfo?.source_meta || {};

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
        {t('explore.myData.currentSourceTitle')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <StatTile label={t('explore.myData.currentSourceBuild')} value={buildMeta.label} desc={t('explore.myData.currentSourceBuildDesc')} accent={buildMeta.color} />
        <StatTile label={t('explore.myData.currentSourceEffective')} value={getEffectiveSourceLabel(sourceMeta, t)} desc={t('explore.myData.currentSourceEffectiveDesc')} accent={sourceMeta.effective_source === 'personal_available' ? C.green : C.ice30} />
        <StatTile label={t('explore.myData.currentSourceYears')} value={activeYears.length} desc={t('explore.myData.currentSourceYearsDesc')} accent={activeYears.length > 0 ? C.blue : C.ice30} />
      </div>

      <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {activeYears.length > 0 ? (
          activeYears.map(([yearKey, detail]) => {
            const modeMeta = getYearModeMeta(detail.source_mode, t);
            return <Badge key={yearKey} label={`${yearKey} · ${modeMeta.label}`} color={modeMeta.color} bg={modeMeta.bg} />;
          })
        ) : (
          <div style={{ fontSize: 11, color: C.ice30 }}>{t('explore.myData.currentSourceEmpty')}</div>
        )}
      </div>

      <div
        style={{
          marginTop: 14,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: '12px 14px',
          background: 'rgba(255,255,255,0.02)',
          fontSize: 11,
          color: C.ice60,
          lineHeight: 1.8,
        }}
      >
        <div>{sourceMeta.message || t('explore.myData.currentSourceHint')}</div>
        <div style={{ marginTop: 6, color: C.ice30 }}>{t('explore.myData.currentSourceUseHint')}</div>
      </div>
    </GlowCard>
  );
}

function RuleList({ title, ok, desc, rules }) {
  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: '12px 14px',
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontSize: 11, color: C.ice, fontWeight: 700 }}>{title}</div>
        <Badge
          label={ok ? 'YES' : 'NO'}
          color={ok ? C.green : C.mars}
          bg={ok ? 'rgba(74,207,172,0.1)' : 'rgba(199,91,57,0.1)'}
        />
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: C.ice30, lineHeight: 1.7 }}>{desc}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
        {rules.map((rule) => (
          <div key={rule.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: rule.ok ? C.green : C.mars,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 11, color: rule.ok ? C.ice60 : C.ice30 }}>{rule.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function UploadCard({ ctx, t, actionLoading, isViewing, onView, onDelete, onContribute, copy, showContributionDetails = true }) {
  const { upload, datasetState, buildMeta, analysisCondition, contributionCondition, lifecycleLabel } = ctx;
  const loading = actionLoading[upload.id];
  const contributed = upload.is_public;
  const canContribute = contributionCondition.ok;

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
        maxWidth: 390,
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
        <Badge label={datasetState.label} color={datasetState.color} bg={datasetState.bg} />
        <Badge label={datasetState.modeMeta.label} color={datasetState.modeMeta.color} bg={datasetState.modeMeta.bg} />
        <Badge label={buildMeta.label} color={buildMeta.color} bg={buildMeta.bg} />
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

      <div style={{ fontSize: 11, color: C.ice60, lineHeight: 1.8 }}>{datasetState.desc}</div>

      <div style={{ display: 'grid', gridTemplateColumns: showContributionDetails ? '1fr 1fr' : '1fr', gap: 10 }}>
        <RuleList
          title={copy.canUseTitle}
          ok={analysisCondition.ok}
          desc={copy.canUseDesc}
          rules={analysisCondition.rules}
        />
        {showContributionDetails && (
          <RuleList
            title={copy.canContributeTitle}
            ok={contributionCondition.ok}
            desc={copy.canContributeDesc}
            rules={contributionCondition.rules}
          />
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div
          style={{
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: '12px 14px',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <div style={{ fontSize: 11, color: C.ice30 }}>{copy.lifeCycleTitle}</div>
          <div style={{ marginTop: 8, fontSize: 13, color: C.ice, fontWeight: 700 }}>{lifecycleLabel}</div>
        </div>
        <div
          style={{
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: '12px 14px',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <div style={{ fontSize: 11, color: C.ice30 }}>{copy.sourceModeTitle}</div>
          <div style={{ marginTop: 8, fontSize: 13, color: datasetState.modeMeta.color, fontWeight: 700 }}>
            {datasetState.modeMeta.label}
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: C.ice30, lineHeight: 1.7 }}>{copy.sourceModeDesc}</div>
        </div>
      </div>

      {datasetState.usable && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {datasetState.usagePages.map((page) => (
            <Badge key={`${upload.id}-${page}`} label={page} color={C.blue} bg="rgba(74,158,255,0.1)" />
          ))}
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
        {showContributionDetails && (
          <ActionBtn
            label={contributed ? t('explore.contribute.contributed') : t('explore.myData.contributeBtn')}
            borderColor={canContribute ? 'rgba(74,158,255,0.5)' : C.border}
            textColor={canContribute ? C.blue : C.ice30}
            activeBg="rgba(74,158,255,0.10)"
            onClick={onContribute}
            disabled={loading || contributed || !canContribute}
          />
        )}
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

export default function MyDataTab({ reviewSignal = 0, showContributionSection = true, showContributionDetails = true }) {
  const t = useT();
  const { user, openAuthModal } = useAuth();
  const { settings } = useSettings();
  const { showToast } = useToast();
  const isZh = settings.language !== 'en';
  const copy = useMemo(() => createCopy(isZh), [isZh]);

  const [uploadState, setUploadState] = useState('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState('uploading');
  const [uploadResult, setUploadResult] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const [uploads, setUploads] = useState([]);
  const [uploadsLoading, setUploadsLoading] = useState(false);
  const [personalSourceInfo, setPersonalSourceInfo] = useState(null);
  const [viewingId, setViewingId] = useState(null);

  const [viewData, setViewData] = useState({
    summary: null,
    globe: null,
    heatmap: null,
    bands: null,
    loading: false,
    error: null,
  });
  const [viewLs, setViewLs] = useState(90);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [contributeOpen, setContributeOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const loadWorkbench = useCallback(async () => {
    if (!user) return;
    setUploadsLoading(true);

    const [uploadsRes, sourceRes] = await Promise.allSettled([
      getMyUploads(),
      fetchDataInfo({ dataSource: 'personal' }),
    ]);

    if (uploadsRes.status === 'fulfilled') {
      setUploads(Array.isArray(uploadsRes.value) ? uploadsRes.value : []);
    } else {
      console.error('Load uploads error:', uploadsRes.reason);
    }

    if (sourceRes.status === 'fulfilled') {
      setPersonalSourceInfo(sourceRes.value);
    } else {
      setPersonalSourceInfo(null);
    }

    setUploadsLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) loadWorkbench();
  }, [user, loadWorkbench, reviewSignal]);

  const loadViewData = useCallback(async (uploadId) => {
    setViewData({ summary: null, globe: null, heatmap: null, bands: null, loading: true, error: null });
    try {
      const summary = await fetchUserDataSummary(uploadId);
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

      setViewData({ summary, globe, heatmap, bands, loading: false, error: null });
    } catch (e) {
      setViewData((prev) => ({ ...prev, loading: false, error: e.message || t('common.error') }));
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
      setViewData((prev) => ({ ...prev, globe }));
    } catch {
      // keep old data
    }
  }, [viewingId]);

  const buildStatus = useMemo(() => getBuildStatusKey(personalSourceInfo), [personalSourceInfo]);
  const buildMeta = useMemo(() => getBuildStatusMeta(buildStatus, t), [buildStatus, t]);

  const uploadContexts = useMemo(() => {
    return uploads.map((upload) => {
      const datasetState = deriveDatasetState(upload, personalSourceInfo, buildStatus, t);
      return {
        upload,
        buildMeta,
        datasetState,
        analysisCondition: deriveAnalysisCondition(datasetState, buildStatus, copy),
        contributionCondition: deriveContributionCondition(upload, copy),
        lifecycleLabel: deriveLifecycleLabel(upload, datasetState, buildStatus, copy),
      };
    });
  }, [uploads, buildMeta, personalSourceInfo, buildStatus, t, copy]);

  const uploadContextMap = useMemo(() => new Map(uploadContexts.map((ctx) => [ctx.upload.id, ctx])), [uploadContexts]);
  const validContributionUploads = useMemo(
    () => uploadContexts.filter((ctx) => ctx.contributionCondition.ok).map((ctx) => ctx.upload),
    [uploadContexts]
  );

  const summaryStats = useMemo(() => {
    const activeYears = Object.values(personalSourceInfo?.details || {}).filter((detail) => detail?.source_mode && detail.source_mode !== 'default').length;
    const usable = uploadContexts.filter((ctx) => ctx.datasetState.usable).length;
    return {
      total: uploads.length,
      usable,
      activeYears,
    };
  }, [uploads.length, uploadContexts, personalSourceInfo]);

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
      }, 700);
    });

    xhr.addEventListener('error', () => {
      setUploadResult({ ok: false, data: { detail: '网络错误，请检查连接' }, status: 0 });
      setUploadState('result');
    });

    xhr.open('POST', '/api/upload/nc');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  }, [loadWorkbench, showToast, t]);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <GlowCard style={{ padding: '18px 20px' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.blue,
            fontFamily: "'Orbitron', sans-serif",
            letterSpacing: 2,
            marginBottom: 10,
          }}
        >
          {t('explore.myData.ingestTitle')}
        </div>
        <div style={{ fontSize: 13, color: C.ice60, lineHeight: 1.85, maxWidth: 1050 }}>
          {t('explore.myData.ingestDesc')}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          <Badge label="OpenMARS (.nc)" color={C.blue} bg="rgba(74,158,255,0.1)" />
          <Badge label="MCD (.nc)" color={C.mars} bg="rgba(199,91,57,0.1)" />
          <Badge label={t('explore.myData.ingestCheck1')} color={C.ice60} bg="rgba(255,255,255,0.05)" />
          <Badge label={t('explore.myData.ingestCheck2')} color={C.ice60} bg="rgba(255,255,255,0.05)" />
          <Badge label={t('explore.myData.ingestCheck3')} color={C.ice60} bg="rgba(255,255,255,0.05)" />
        </div>
      </GlowCard>

      {showContributionSection && (
        <GlowCard style={{ padding: '18px 20px' }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.mars,
              fontFamily: "'Orbitron', sans-serif",
              letterSpacing: 2,
              marginBottom: 10,
            }}
          >
            PUBLIC CONTRIBUTION FLOW
          </div>
          <div style={{ fontSize: 15, color: C.ice, fontWeight: 700, marginBottom: 8 }}>{copy.contributionTitle}</div>
          <div style={{ fontSize: 13, color: C.ice60, lineHeight: 1.85, maxWidth: 1050 }}>{copy.contributionDesc}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
            <button
              onClick={() => setContributeOpen(true)}
              disabled={validContributionUploads.length === 0}
              style={{
                padding: '9px 16px',
                borderRadius: 9,
                border: '1px solid rgba(74,158,255,0.35)',
                background: validContributionUploads.length > 0 ? 'rgba(74,158,255,0.12)' : 'rgba(255,255,255,0.04)',
                color: validContributionUploads.length > 0 ? C.blue : C.ice30,
                fontSize: 12,
                fontWeight: 700,
                cursor: validContributionUploads.length > 0 ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
              }}
            >
              {copy.contributionOpen}
            </button>
            <button
              onClick={() => setHistoryOpen(true)}
              style={{
                padding: '9px 16px',
                borderRadius: 9,
                border: `1px solid ${C.border}`,
                background: 'rgba(255,255,255,0.04)',
                color: C.ice60,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {copy.contributionHistory}
            </button>
            {validContributionUploads.length === 0 && (
              <span style={{ fontSize: 11, color: C.ice30, alignSelf: 'center' }}>{copy.contributionNone}</span>
            )}
          </div>
        </GlowCard>
      )}

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <StatTile label={t('explore.myData.statUploads')} value={summaryStats.total} desc={t('explore.myData.statUploadsDesc')} accent={C.blue} />
        <StatTile label={t('explore.myData.statUsable')} value={summaryStats.usable} desc={t('explore.myData.statUsableDesc')} accent={summaryStats.usable > 0 ? C.green : C.ice30} />
        <StatTile label={t('explore.myData.statYears')} value={summaryStats.activeYears} desc={t('explore.myData.statYearsDesc')} accent={summaryStats.activeYears > 0 ? C.mars : C.ice30} />
      </div>

      <CurrentSourceCard personalInfo={personalSourceInfo} buildStatus={buildStatus} t={t} />

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2 }}>
            {t('explore.myData.title')}
          </div>
          {uploads.length > 0 && <div style={{ fontSize: 11, color: C.ice30 }}>{t('explore.myData.count', { n: uploads.length })}</div>}
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
                onContribute={() => setContributeOpen(true)}
                copy={copy}
                showContributionDetails={showContributionDetails}
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
                {t('explore.myData.viewerTitle')}
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

          {viewingCtx && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              <Badge label={viewingCtx.datasetState.label} color={viewingCtx.datasetState.color} bg={viewingCtx.datasetState.bg} />
              <Badge label={viewingCtx.datasetState.modeMeta.label} color={viewingCtx.datasetState.modeMeta.color} bg={viewingCtx.datasetState.modeMeta.bg} />
              <Badge label={viewingCtx.buildMeta.label} color={viewingCtx.buildMeta.color} bg={viewingCtx.buildMeta.bg} />
            </div>
          )}

          {viewData.loading && <LoadingBox h={300} />}

          {!viewData.loading && viewData.error && (
            <div style={{ padding: '24px', textAlign: 'center', color: C.mars, fontSize: 13, border: `1px dashed ${C.border}`, borderRadius: 12 }}>
              {viewData.error}
            </div>
          )}

          {!viewData.loading && !viewData.error && viewData.summary && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif", minWidth: 50, textAlign: 'right' }}>
                        {viewLs}°
                      </span>
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

      {showContributionSection && (
        <>
          <ContributeModal
            open={contributeOpen}
            onClose={() => setContributeOpen(false)}
            validUploads={validContributionUploads}
            onDone={loadWorkbench}
          />

          <ContributeHistoryPanel open={historyOpen} onClose={() => setHistoryOpen(false)} />
        </>
      )}
    </div>
  );
}
