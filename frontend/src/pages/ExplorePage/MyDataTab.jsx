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
import PersonalSourceWarmupBar from '../../components/PersonalSourceWarmupBar';
import {
  deleteUpload,
  fetchDataInfo,
  fetchPersonalBuildStatus,
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

const ACTIVE_UPLOAD_STATUSES = new Set(['valid', 'pending_review', 'approved', 'rejected']);

function createCopy(isZh) {
  return {
    myHubTitle: isZh ? '个人数据接入与贡献工作台' : 'Personal Ingestion & Contribution Workbench',
    myHubDesc: isZh
      ? '把上传文件变成真正可被站内页面使用的个人数据源，并在准备好时进入平台贡献流程。页面按真实任务拆成总览、数据队列和详情预览三层，避免把所有状态堆在一起。'
      : 'Turn uploads into a usable personal data source, then move ready datasets into platform contribution. The page is organized as overview, dataset queue, and detail preview instead of one overloaded canvas.',
    contributionTitle: isZh ? '平台贡献流程' : 'Platform Contribution Flow',
    contributionDesc: isZh
      ? '只有通过基础校验并保持可管理状态的数据，才适合进入公共贡献。提交后会先进入管理员审核，而不会直接并入官方资产。'
      : 'Only datasets that passed base validation and remain manageable should enter public contribution. After submission they go to admin review instead of directly becoming official assets.',
    contributionOpen: isZh ? '打开贡献流程' : 'Open Contribution Flow',
    contributionHistory: isZh ? '查看贡献记录' : 'View Contribution History',
    contributionNone: isZh ? '当前没有可提交贡献的数据集。' : 'No datasets are currently eligible for contribution.',
    canUseTitle: isZh ? '分析使用条件' : 'Analysis Usage Conditions',
    canUseDesc: isZh
      ? '能否被数据概览、分析、预测和训练页面真正当作个人数据源调用。'
      : 'Whether overview, analysis, prediction, and training pages can truly consume it through the Personal source path.',
    canContributeTitle: isZh ? '公共贡献条件' : 'Contribution Conditions',
    canContributeDesc: isZh
      ? '是否适合进入平台审核流程，争取成为平台公共数据资产。'
      : 'Whether it is suitable to enter the platform review flow and potentially become a shared platform asset.',
    lifeCycleTitle: isZh ? '生命周期状态' : 'Lifecycle Status',
    sourceModeTitle: isZh ? '进入的数据源模式' : 'Source Mode',
    sourceModeDesc: isZh
      ? '当其他页面切换到个人模式时，系统最终会使用哪一种数据源组合。'
      : 'What source combination the system ultimately uses when other pages switch to Personal mode.',
    ruleValid: isZh ? '上传校验通过' : 'Upload validation passed',
    ruleBuildReady: isZh ? '个人数据源构建完成' : 'Personal source build is ready',
    ruleAdopted: isZh ? '已进入个人或混合数据源' : 'Actually adopted into personal or mixed source',
    ruleRejected: isZh ? '个人使用链路稳定可用' : 'Stable for personal use',
    ruleContributeBase: isZh ? '状态仍为 valid，可提交审核' : 'Status is still valid and can be submitted',
    ruleContributePending: isZh ? '已进入管理员审核队列' : 'Already in admin review queue',
    ruleContributeApproved: isZh ? '已并入平台官方数据资产' : 'Already merged into official platform assets',
    ruleContributeRejected: isZh ? '被驳回后需重新整理再上传' : 'Rejected datasets need a new upload and fix cycle',
    lifecycleUploading: isZh ? '上传后等待系统处理' : 'Uploaded and waiting for system processing',
    lifecycleBuilding: isZh ? '系统正在构建个人数据源' : 'System is building the personal source',
    lifecycleReady: isZh ? '已进入个人使用链路' : 'Connected to the personal usage path',
    lifecyclePending: isZh ? '已提交平台审核' : 'Submitted for admin review',
    lifecycleApproved: isZh ? '已并入平台官方资产' : 'Merged into official platform assets',
    lifecycleRejected: isZh ? '审核未通过' : 'Rejected in review',
    lifecycleInvalid: isZh ? '基础校验未通过' : 'Failed base validation',
    lifecycleFallback: isZh ? '已上传但未进入生效使用路径' : 'Uploaded but not in the active source path',
    overviewTitle: isZh ? '当前工作重点' : 'Operational Focus',
    overviewDesc: isZh
      ? '先确认哪些数据已接入可用，哪些还在处理中，哪些值得送审，再进入单条数据的处理。'
      : 'Confirm what is already usable, what is still processing, and what is ready for review before working on a specific file.',
    filterAll: isZh ? '全部数据' : 'All datasets',
    filterUsable: isZh ? '已接入使用' : 'In use',
    filterAttention: isZh ? '需要关注' : 'Needs attention',
    filterContribution: isZh ? '贡献流程' : 'Contribution flow',
    searchPlaceholder: isZh ? '按文件名、类型或火星年搜索' : 'Search by filename, type, or Mars year',
    queueTitle: isZh ? '数据队列' : 'Dataset Queue',
    queueDesc: isZh
      ? '先在队列里筛选和定位数据，再到右侧集中查看状态、动作和内容预览。'
      : 'Filter and locate datasets in the queue, then inspect status, actions, and preview on the right.',
    noMatchTitle: isZh ? '没有匹配的数据' : 'No matching datasets',
    noMatchDesc: isZh ? '试试切换筛选条件或修改搜索关键词。' : 'Try another filter or change the search term.',
    detailTitle: isZh ? '数据详情与预览' : 'Dataset Detail & Preview',
    detailEmptyTitle: isZh ? '选择一条数据开始查看' : 'Select a dataset to inspect',
    detailEmptyDesc: isZh
      ? '从左侧数据队列中选中一条记录后，这里会集中展示它的接入状态、可执行动作和内容预览。'
      : 'Choose a record from the dataset queue to see its ingestion status, available actions, and content preview in one place.',
    uploadStatusTitle: isZh ? '上传状态' : 'Upload Status',
    accessTitle: isZh ? '可用页面' : 'Available In',
    accessEmpty: isZh ? '当前还没有进入下游页面使用链路。' : 'This dataset is not currently in the downstream usage path.',
    contributionReadyStat: isZh ? '可送审' : 'Ready to submit',
    contributionReadyDesc: isZh ? '满足基础校验并可进入平台贡献的数据。' : 'Datasets that passed base validation and can enter platform contribution.',
    reviewQueueStat: isZh ? '审核中' : 'In review',
    reviewQueueDesc: isZh ? '已经提交给平台管理员审核的数据。' : 'Datasets already submitted to platform review.',
    approvedStat: isZh ? '已并入' : 'Approved',
    approvedDesc: isZh ? '已经进入平台官方数据资产层的数据。' : 'Datasets already merged into official platform assets.',
    buildPendingStat: isZh ? '处理中' : 'Building',
    buildPendingDesc: isZh ? '后台仍在构建个人数据源或等待系统处理的数据。' : 'Datasets still building into the personal source or awaiting processing.',
    readySignal: isZh ? '当前可直接用于个人模式' : 'Ready for Personal mode now',
    attentionSignal: isZh ? '建议优先关注这条数据的状态' : 'This item likely needs attention first',
    contributionSignal: isZh ? '满足公共贡献基础条件' : 'Eligible for public contribution',
    reviewSignalLabel: isZh ? '已进入平台审核流程' : 'Already in platform review',
    approvedSignalLabel: isZh ? '已并入官方数据资产' : 'Already merged into official assets',
    officialCenterLink: isZh ? '官方数据中心会显示已并入的平台数据状态。' : 'Approved platform datasets are reflected in the official dataset center above.',
    yes: isZh ? '是' : 'YES',
    no: isZh ? '否' : 'NO',
    unknownError: isZh ? '未知错误' : 'Unknown error',
    autoClose: isZh ? '后自动关闭' : 'auto close',
    uploadNetworkError: isZh ? '网络异常，请检查连接。' : 'Network error, please check your connection.',
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

function SearchIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '--';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(iso) {
  if (!iso) return '--';
  return iso.replace('T', ' ').slice(0, 16);
}

function formatLsLabel(start, end, digits = 1) {
  if (start == null || end == null) return '--';
  return `${Number(start).toFixed(digits)}° - ${Number(end).toFixed(digits)}°`;
}

function MetaRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
      <span style={{ fontSize: 'calc(10px * var(--font-scale, 1))', color: C.ice30, whiteSpace: 'nowrap', minWidth: 58 }}>{label}</span>
      <span style={{ fontSize: 'calc(12px * var(--font-scale, 1))', color: C.ice60, fontWeight: 500 }}>{value ?? '--'}</span>
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
        fontSize: 'calc(10px * var(--font-scale, 1))',
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

function TopMetric({ label, value, accent = C.ice }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 12,
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${C.border}`,
      }}
    >
      <div style={{ fontSize: 'calc(10px * var(--font-scale, 1))', color: C.ice30, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 'calc(18px * var(--font-scale, 1))', color: accent, fontWeight: 700, fontFamily: "'Orbitron', sans-serif" }}>{value}</div>
    </div>
  );
}

function ActionBtn({ label, borderColor, textColor, activeBg, active, onClick, disabled, loading }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '8px 13px',
        background: active ? activeBg : 'rgba(255,255,255,0.04)',
        border: `1px solid ${borderColor ?? C.border}`,
        borderRadius: 10,
        color: loading ? C.ice30 : textColor ?? C.ice60,
        fontSize: 'calc(11px * var(--font-scale, 1))',
        fontWeight: 700,
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

function FilterPill({ active, label, accent = C.blue, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 12px',
        borderRadius: 999,
        border: `1px solid ${active ? accent : C.border}`,
        background: active ? `${accent}1a` : 'rgba(255,255,255,0.03)',
        color: active ? accent : C.ice60,
        fontSize: 'calc(11px * var(--font-scale, 1))',
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );
}

function EmptyState({ icon, title, desc }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        minHeight: 260,
        textAlign: 'center',
        padding: '32px 20px',
        border: `1px dashed ${C.border}`,
        borderRadius: 16,
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <div style={{ color: C.ice30, opacity: 0.55 }}>{icon}</div>
      <div style={{ fontSize: 'calc(15px * var(--font-scale, 1))', color: C.ice, fontWeight: 700 }}>{title}</div>
      <div style={{ maxWidth: 420, fontSize: 'calc(12px * var(--font-scale, 1))', color: C.ice30, lineHeight: 1.8 }}>{desc}</div>
    </div>
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

function getUploadStatusMeta(status, t) {
  const palette = {
    valid: { color: C.blue, bg: 'rgba(74,158,255,0.1)' },
    invalid: { color: C.mars, bg: 'rgba(199,91,57,0.1)' },
    pending_review: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    approved: { color: C.green, bg: 'rgba(74,207,172,0.1)' },
    rejected: { color: C.mars, bg: 'rgba(199,91,57,0.1)' },
  };
  const base = palette[status] || { color: C.ice30, bg: 'rgba(255,255,255,0.05)' };
  return {
    ...base,
    label: status ? t(`explore.myData.status.${status}`) : '--',
  };
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
      key: upload.status === 'rejected' ? 'rejected_personal' : 'personal',
      usable: true,
      label: t('explore.myData.datasetState.personal'),
      desc: upload.status === 'rejected'
        ? t('explore.myData.datasetStateDesc.rejected')
        : t('explore.myData.datasetStateDesc.personal'),
      color: upload.status === 'rejected' ? C.mars : C.green,
      bg: upload.status === 'rejected' ? 'rgba(199,91,57,0.1)' : 'rgba(74,207,172,0.1)',
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
        key: upload.status === 'rejected' ? 'rejected_mixed' : 'mixed',
        usable: true,
        label: t('explore.myData.datasetState.mixed'),
        desc: upload.status === 'rejected'
          ? t('explore.myData.datasetStateDesc.rejectedMixed')
          : t('explore.myData.datasetStateDesc.mixed'),
        color: upload.status === 'rejected' ? C.mars : C.blue,
        bg: upload.status === 'rejected' ? 'rgba(199,91,57,0.1)' : 'rgba(74,158,255,0.1)',
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
  const passedValidation = !['invalid'].includes(datasetState.key);
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

function isAttentionState(ctx) {
  return ['invalid', 'failed', 'building', 'fallback', 'inactive', 'rejected_personal', 'rejected_mixed'].includes(ctx?.datasetState?.key);
}

function isContributionFlowItem(ctx) {
  if (!ctx?.upload) return false;
  return ctx.contributionCondition.ok || ctx.upload.status === 'pending_review' || ctx.upload.status === 'approved';
}

function deriveSignalMeta(ctx, copy) {
  if (ctx.upload.status === 'approved') {
    return {
      label: copy.approvedSignalLabel,
      color: C.green,
      bg: 'rgba(74,207,172,0.12)',
    };
  }
  if (ctx.upload.status === 'pending_review') {
    return {
      label: copy.reviewSignalLabel,
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.12)',
    };
  }
  if (ctx.datasetState.usable) {
    return {
      label: copy.readySignal,
      color: C.green,
      bg: 'rgba(74,207,172,0.12)',
    };
  }
  if (ctx.contributionCondition.ok) {
    return {
      label: copy.contributionSignal,
      color: C.blue,
      bg: 'rgba(74,158,255,0.12)',
    };
  }
  return {
    label: copy.attentionSignal,
    color: C.mars,
    bg: 'rgba(199,91,57,0.12)',
  };
}

function UploadZone({
  t,
  copy,
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
        borderRadius: 18,
        background: bgColor,
        padding: '32px 28px',
        minHeight: 250,
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
          <div style={{ color: isDragging ? C.blue : C.ice30, marginBottom: 12, opacity: isDragging ? 1 : 0.72 }}>
            <CloudUploadIcon size={42} color="currentColor" />
          </div>
          <div
            style={{
              fontSize: 'calc(16px * var(--font-scale, 1))',
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
              <div style={{ fontSize: 'calc(12px * var(--font-scale, 1))', color: C.ice60, maxWidth: 640, textAlign: 'center', lineHeight: 1.8, marginBottom: 18 }}>
                {t('explore.upload.subtitle')}
              </div>
              <div
                style={{
                  fontSize: 'calc(11px * var(--font-scale, 1))',
                  color: C.ice30,
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: '6px 14px',
                  letterSpacing: 0.3,
                }}
              >
                {t('explore.upload.dragHint')} | {t('explore.upload.clickHint')}
              </div>
            </>
          )}
        </>
      )}

      {isUploading && (
        <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: C.ice60, flexShrink: 0 }}>
              <FileIcon size={18} color="currentColor" />
            </span>
            <span style={{ fontSize: 'calc(12px * var(--font-scale, 1))', color: C.ice60, flex: 1 }}>
              {uploadPhase === 'validating' ? t('explore.upload.validating') : t('explore.upload.uploading')}
            </span>
            <span style={{ fontSize: 'calc(12px * var(--font-scale, 1))', color: C.ice60, fontWeight: 600, minWidth: 38, textAlign: 'right' }}>
              {uploadProgress}%
            </span>
          </div>
          <div style={{ height: 6, background: C.border, borderRadius: 999, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${uploadProgress}%`,
                background: uploadPhase === 'validating' ? '#f59e0b' : C.blue,
                borderRadius: 999,
                transition: 'width 0.25s ease, background 0.3s',
              }}
            />
          </div>
        </div>
      )}

      {isResult && uploadResult && (
        <div style={{ width: '100%', maxWidth: 620, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div
              style={{
                fontSize: 'calc(14px * var(--font-scale, 1))',
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
                borderRadius: 8,
                color: C.ice60,
                fontSize: 'calc(11px * var(--font-scale, 1))',
                cursor: 'pointer',
                padding: '4px 11px',
                fontFamily: 'inherit',
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
                padding: '14px 16px',
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${C.border}`,
                borderRadius: 12,
              }}
            >
              {uploadResult.data.data_type && <MetaRow label={t('explore.upload.dataType')} value={uploadResult.data.data_type} />}
              {uploadResult.data.mars_year != null && <MetaRow label={t('explore.upload.marsYear')} value={`MY ${uploadResult.data.mars_year}`} />}
              {uploadResult.data.ls_range?.[0] != null && uploadResult.data.ls_range?.[1] != null && (
                <MetaRow label={t('explore.upload.lsRange')} value={formatLsLabel(uploadResult.data.ls_range[0], uploadResult.data.ls_range[1])} />
              )}
              {uploadResult.data.grid_size && (
                <MetaRow label={t('explore.upload.gridSize')} value={`${uploadResult.data.grid_size[0]} x ${uploadResult.data.grid_size[1]}`} />
              )}
              {uploadResult.data.variables?.length > 0 && <MetaRow label={t('explore.upload.variables')} value={uploadResult.data.variables.join(', ')} />}
            </div>
          )}

          {hasWarnings && (
            <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: '#f59e0b', lineHeight: 1.6 }}>
              <span style={{ fontWeight: 700 }}>{t('explore.upload.warnings')}: </span>
              {uploadResult.data.warnings.join(' | ')}
            </div>
          )}

          {!resultOk && (
            <div
              style={{
                fontSize: 'calc(12px * var(--font-scale, 1))',
                color: C.mars,
                lineHeight: 1.6,
                padding: '10px 14px',
                background: 'rgba(199,91,57,0.06)',
                border: '1px solid rgba(199,91,57,0.25)',
                borderRadius: 10,
              }}
            >
              <span style={{ fontWeight: 700 }}>{t('explore.upload.errorDetail')}: </span>
              {uploadResult.data?.error || uploadResult.data?.detail || copy.unknownError}
            </div>
          )}

          <div style={{ fontSize: 'calc(10px * var(--font-scale, 1))', color: C.ice30, textAlign: 'right' }}>{`${resultOk ? '5s' : '8s'} ${copy.autoClose}`}</div>
        </div>
      )}
    </div>
  );
}

function CurrentSourcePanel({ personalInfo, buildStatus, t }) {
  const buildMeta = getBuildStatusMeta(buildStatus, t);
  const activeYears = Object.entries(personalInfo?.details || {}).filter(([, detail]) => detail?.source_mode && detail.source_mode !== 'default');
  const sourceMeta = personalInfo?.source_meta || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: '100%' }}>
      <div
        style={{
          fontSize: 'calc(11px * var(--font-scale, 1))',
          fontWeight: 700,
          color: C.blue,
          fontFamily: "'Orbitron', sans-serif",
          letterSpacing: 2,
        }}
      >
        {t('explore.myData.currentSourceTitle')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
        <TopMetric label={t('explore.myData.currentSourceBuild')} value={buildMeta.label} accent={buildMeta.color} />
        <TopMetric
          label={t('explore.myData.currentSourceEffective')}
          value={getEffectiveSourceLabel(sourceMeta, t)}
          accent={sourceMeta.effective_source === 'personal_available' ? C.green : C.ice60}
        />
        <TopMetric
          label={t('explore.myData.currentSourceYears')}
          value={activeYears.length}
          accent={activeYears.length > 0 ? C.blue : C.ice60}
        />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {activeYears.length > 0 ? (
          activeYears.map(([yearKey, detail]) => {
            const modeMeta = getYearModeMeta(detail.source_mode, t);
            return <Badge key={yearKey} label={`${yearKey} | ${modeMeta.label}`} color={modeMeta.color} bg={modeMeta.bg} />;
          })
        ) : (
          <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice30 }}>{t('explore.myData.currentSourceEmpty')}</div>
        )}
      </div>

      <div
        style={{
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: '12px 14px',
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice60, lineHeight: 1.75 }}>
          {sourceMeta.message || t('explore.myData.currentSourceHint')}
        </div>
        <div style={{ marginTop: 6, fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice30, lineHeight: 1.7 }}>
          {t('explore.myData.currentSourceUseHint')}
        </div>
      </div>
    </div>
  );
}

function RuleList({ title, ok, desc, rules, copy }) {
  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: '14px 15px',
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice, fontWeight: 700 }}>{title}</div>
        <Badge
          label={ok ? copy.yes : copy.no}
          color={ok ? C.green : C.mars}
          bg={ok ? 'rgba(74,207,172,0.1)' : 'rgba(199,91,57,0.1)'}
        />
      </div>
      <div style={{ marginTop: 6, fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice30, lineHeight: 1.7 }}>{desc}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 12 }}>
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
            <span style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: rule.ok ? C.ice60 : C.ice30 }}>{rule.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function QueueItem({ ctx, selected, onSelect, copy, t }) {
  const { upload, datasetState, contributionCondition, lifecycleLabel } = ctx;
  const signalMeta = deriveSignalMeta(ctx, copy);

  return (
    <button
      onClick={onSelect}
      style={{
        width: '100%',
        textAlign: 'left',
        border: `1px solid ${selected ? C.blue : C.border}`,
        borderRadius: 14,
        padding: '14px 15px',
        background: selected ? 'rgba(74,158,255,0.08)' : 'rgba(255,255,255,0.02)',
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: C.ice30, flexShrink: 0 }}>
              <FileIcon size={14} color="currentColor" />
            </span>
            <span
              style={{
                fontSize: 'calc(13px * var(--font-scale, 1))',
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
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <Badge label={datasetState.label} color={datasetState.color} bg={datasetState.bg} />
            <Badge label={datasetState.modeMeta.label} color={datasetState.modeMeta.color} bg={datasetState.modeMeta.bg} />
          </div>
        </div>

        <div style={{ flexShrink: 0, fontSize: 'calc(10px * var(--font-scale, 1))', color: C.ice30 }}>{formatDate(upload.created_at)}</div>
      </div>

      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px 10px' }}>
        <MetaRow label={t('explore.myData.cardType')} value={upload.data_type || '--'} />
        <MetaRow label={t('explore.myData.cardMarsYear')} value={upload.mars_year != null ? `MY ${upload.mars_year}` : '--'} />
        <MetaRow label={t('explore.myData.cardLs')} value={formatLsLabel(upload.ls_start, upload.ls_end)} />
        <MetaRow label={t('explore.myData.cardSize')} value={formatFileSize(upload.file_size)} />
      </div>

      <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Badge label={signalMeta.label} color={signalMeta.color} bg={signalMeta.bg} />
        {contributionCondition.ok && <Badge label={copy.canContributeTitle} color={C.blue} bg="rgba(74,158,255,0.1)" />}
      </div>

      <div style={{ marginTop: 10, fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice30, lineHeight: 1.7 }}>
        {lifecycleLabel}
      </div>
    </button>
  );
}

function SnapshotTile({ label, value, desc, accent = C.ice }) {
  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: '14px 15px',
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice30 }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 'calc(14px * var(--font-scale, 1))', color: accent, fontWeight: 700 }}>{value}</div>
      {desc ? <div style={{ marginTop: 7, fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice30, lineHeight: 1.7 }}>{desc}</div> : null}
    </div>
  );
}

function UsagePanel({ pages, copy }) {
  if (!pages.length) {
    return (
      <div
        style={{
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          padding: '14px 15px',
          background: 'rgba(255,255,255,0.02)',
          fontSize: 'calc(11px * var(--font-scale, 1))',
          color: C.ice30,
          lineHeight: 1.7,
        }}
      >
        <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice, fontWeight: 700, marginBottom: 8 }}>{copy.accessTitle}</div>
        {copy.accessEmpty}
      </div>
    );
  }

  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: '14px 15px',
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice, fontWeight: 700, marginBottom: 10 }}>{copy.accessTitle}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {pages.map((page) => (
          <Badge key={page} label={page} color={C.blue} bg="rgba(74,158,255,0.1)" />
        ))}
      </div>
    </div>
  );
}

function PreviewContent({ viewData, viewLs, onLsChange, t }) {
  if (viewData.loading) return <LoadingBox h={320} />;

  if (viewData.error) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: C.mars, fontSize: 'calc(13px * var(--font-scale, 1))', border: `1px dashed ${C.border}`, borderRadius: 14 }}>
        {viewData.error}
      </div>
    );
  }

  if (!viewData.summary) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {viewData.summary.has_ozone && (
        <>
          {viewData.summary.ls_range && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice60, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1, whiteSpace: 'nowrap' }}>Ls</span>
              <input
                type="range"
                min={Math.round(viewData.summary.ls_range[0])}
                max={Math.round(viewData.summary.ls_range[1])}
                step={5}
                value={viewLs}
                onChange={(e) => onLsChange(Number(e.target.value))}
                style={{ flex: 1, accentColor: C.mars }}
              />
              <span style={{ fontSize: 'calc(14px * var(--font-scale, 1))', fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif", minWidth: 56, textAlign: 'right' }}>
                {viewLs}°
              </span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <div>
              <div style={{ fontSize: 'calc(10px * var(--font-scale, 1))', fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 8 }}>
                {t('explore.viewer.globeTitle')}
              </div>
              {viewData.globe ? <GlobePlot data={viewData.globe} h={260} /> : <LoadingBox h={260} />}
            </div>
            <div>
              <div style={{ fontSize: 'calc(10px * var(--font-scale, 1))', fontWeight: 700, color: C.blue, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 8 }}>
                {t('explore.viewer.heatmapTitle')}
              </div>
              {viewData.heatmap ? <HeatmapCanvas data={viewData.heatmap} h={260} /> : <LoadingBox h={260} />}
            </div>
          </div>

          {viewData.bands && (
            <div>
              <div style={{ fontSize: 'calc(10px * var(--font-scale, 1))', fontWeight: 700, color: C.blue, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 8 }}>
                {t('explore.viewer.bandsTitle')}
              </div>
              <LineChart data={viewData.bands} h={210} />
            </div>
          )}
        </>
      )}

      {!viewData.summary.has_ozone && viewData.summary.has_mcd_vars?.length > 0 && (
        <div style={{ padding: '32px 20px', textAlign: 'center', border: `1px dashed ${C.border}`, borderRadius: 14 }}>
          <div style={{ fontSize: 'calc(13px * var(--font-scale, 1))', color: C.ice60, marginBottom: 8 }}>{t('explore.viewer.mcdOnly')}</div>
          <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice30 }}>
            {t('explore.viewer.mcdVars')}: {viewData.summary.has_mcd_vars.join(', ')}
          </div>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '8px 16px',
          padding: '14px 16px',
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          fontSize: 'calc(11px * var(--font-scale, 1))',
        }}
      >
        <div>
          <span style={{ color: C.ice30 }}>{t('explore.viewer.dataType')}: </span>
          <span style={{ color: C.ice60 }}>{viewData.summary.data_type}</span>
        </div>
        <div>
          <span style={{ color: C.ice30 }}>{t('explore.viewer.gridSize')}: </span>
          <span style={{ color: C.ice60 }}>{viewData.summary.lat_points}x{viewData.summary.lon_points}</span>
        </div>
        <div>
          <span style={{ color: C.ice30 }}>{t('explore.viewer.lsPoints')}: </span>
          <span style={{ color: C.ice60 }}>{viewData.summary.ls_points}</span>
        </div>
        {viewData.summary.ls_range && (
          <div>
            <span style={{ color: C.ice30 }}>{t('explore.viewer.lsRange')}: </span>
            <span style={{ color: C.ice60 }}>
              {formatLsLabel(viewData.summary.ls_range[0], viewData.summary.ls_range[1])}
            </span>
          </div>
        )}
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
      <div style={{ fontSize: 'calc(16px * var(--font-scale, 1))', color: C.ice, fontWeight: 600 }}>{t('explore.upload.loginPrompt')}</div>
      <button
        onClick={() => openAuthModal('login')}
        style={{
          padding: '10px 28px',
          borderRadius: 10,
          background: C.mars,
          border: 'none',
          color: '#fff',
          fontSize: 'calc(13px * var(--font-scale, 1))',
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

export default function MyDataTab({ reviewSignal = 0 }) {
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
  const [personalBuildStatus, setPersonalBuildStatus] = useState(null);
  const [viewingId, setViewingId] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

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

  useEffect(() => {
    if (!user) {
      setPersonalBuildStatus(null);
      return undefined;
    }

    let active = true;
    let timerId = null;

    const poll = async () => {
      try {
        const status = await fetchPersonalBuildStatus();
        if (!active) return;
        setPersonalBuildStatus(status);
        const stage = status?.stage || 'idle';
        if (['queued', 'building_cache', 'warming_analysis', 'warming_predict'].includes(stage)) {
          timerId = window.setTimeout(poll, 1200);
        } else if (stage === 'ready') {
          loadWorkbench().catch(() => {});
        }
      } catch {
        if (!active) return;
        timerId = window.setTimeout(poll, 2400);
      }
    };

    poll();
    return () => {
      active = false;
      if (timerId) window.clearTimeout(timerId);
    };
  }, [user, reviewSignal, loadWorkbench]);

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
      // keep previous preview
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
        uploadStatusMeta: getUploadStatusMeta(upload.status, t),
        datasetState,
        analysisCondition: deriveAnalysisCondition(datasetState, buildStatus, copy),
        contributionCondition: deriveContributionCondition(upload, copy),
        lifecycleLabel: deriveLifecycleLabel(upload, datasetState, buildStatus, copy),
      };
    });
  }, [uploads, buildMeta, personalSourceInfo, buildStatus, t, copy]);

  const uploadContextMap = useMemo(() => new Map(uploadContexts.map((ctx) => [ctx.upload.id, ctx])), [uploadContexts]);
  const sortedUploadContexts = useMemo(() => {
    return [...uploadContexts].sort((a, b) => {
      const aCreated = a.upload.created_at || '';
      const bCreated = b.upload.created_at || '';
      if (aCreated === bCreated) return Number(b.upload.id || 0) - Number(a.upload.id || 0);
      return bCreated.localeCompare(aCreated);
    });
  }, [uploadContexts]);

  const validContributionUploads = useMemo(
    () => uploadContexts.filter((ctx) => ctx.contributionCondition.ok).map((ctx) => ctx.upload),
    [uploadContexts]
  );

  const summaryStats = useMemo(() => {
    const activeYears = Object.values(personalSourceInfo?.details || {}).filter((detail) => detail?.source_mode && detail.source_mode !== 'default').length;
    const usable = uploadContexts.filter((ctx) => ctx.datasetState.usable).length;
    const building = uploadContexts.filter((ctx) => ctx.datasetState.key === 'building' || ctx.lifecycleLabel === copy.lifecycleUploading).length;
    const contributionReady = uploadContexts.filter((ctx) => ctx.contributionCondition.ok).length;
    const inReview = uploadContexts.filter((ctx) => ctx.upload.status === 'pending_review').length;
    const approved = uploadContexts.filter((ctx) => ctx.upload.status === 'approved').length;

    return {
      total: uploads.length,
      usable,
      activeYears,
      building,
      contributionReady,
      inReview,
      approved,
    };
  }, [uploads.length, uploadContexts, personalSourceInfo, copy.lifecycleUploading]);

  const filterDefs = useMemo(() => ([
    { key: 'all', label: copy.filterAll, accent: C.blue },
    { key: 'usable', label: copy.filterUsable, accent: C.green },
    { key: 'attention', label: copy.filterAttention, accent: C.mars },
    { key: 'contribution', label: copy.filterContribution, accent: '#f59e0b' },
  ]), [copy]);

  const filteredUploadContexts = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return sortedUploadContexts.filter((ctx) => {
      const matchesFilter = (() => {
        if (activeFilter === 'usable') return ctx.datasetState.usable;
        if (activeFilter === 'attention') return isAttentionState(ctx);
        if (activeFilter === 'contribution') return isContributionFlowItem(ctx);
        return true;
      })();

      if (!matchesFilter) return false;
      if (!keyword) return true;

      const haystack = [
        ctx.upload.filename,
        ctx.upload.data_type,
        ctx.upload.mars_year != null ? `my ${ctx.upload.mars_year}` : '',
        ctx.datasetState.label,
        ctx.lifecycleLabel,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [sortedUploadContexts, activeFilter, searchTerm]);

  useEffect(() => {
    if (!sortedUploadContexts.length) {
      setViewingId(null);
      return;
    }
    const validIds = new Set(sortedUploadContexts.map((ctx) => ctx.upload.id));
    if (!viewingId || !validIds.has(viewingId)) {
      setViewingId(sortedUploadContexts[0].upload.id);
    }
  }, [sortedUploadContexts, viewingId]);

  useEffect(() => {
    if (!filteredUploadContexts.length) return;
    const visibleIds = new Set(filteredUploadContexts.map((ctx) => ctx.upload.id));
    if (!visibleIds.has(viewingId)) {
      setViewingId(filteredUploadContexts[0].upload.id);
    }
  }, [filteredUploadContexts, viewingId]);

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
          payload = { ok: false, data: { detail: 'Response parse failed' }, status: xhr.status };
        }

        setUploadResult(payload);
        setUploadState('result');
        await loadWorkbench();
      }, 700);
    });

    xhr.addEventListener('error', () => {
      setUploadResult({ ok: false, data: { detail: copy.uploadNetworkError }, status: 0 });
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
      showToast(e.message || 'Delete failed', 'error');
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
  const viewingSignal = viewingCtx ? deriveSignalMeta(viewingCtx, copy) : null;
  const viewActionLoading = viewingUpload ? actionLoading[viewingUpload.id] : false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <GlowCard style={{ padding: '22px 24px', background: 'linear-gradient(135deg, rgba(74,158,255,0.08), rgba(255,255,255,0.02))' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <div
              style={{
                fontSize: 'calc(11px * var(--font-scale, 1))',
                fontWeight: 700,
                color: C.blue,
                fontFamily: "'Orbitron', sans-serif",
                letterSpacing: 2,
                marginBottom: 10,
              }}
            >
              {t('explore.myData.ingestTitle')}
            </div>
            <div style={{ fontSize: 'calc(20px * var(--font-scale, 1))', color: C.ice, fontWeight: 700, lineHeight: 1.4 }}>{copy.myHubTitle}</div>
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Badge label={t('explore.defaultDataset.heroTags.openmars')} color={C.blue} bg="rgba(74,158,255,0.1)" />
              <Badge label={t('explore.defaultDataset.heroTags.mcd')} color={C.mars} bg="rgba(199,91,57,0.1)" />
              <Badge label={t('explore.myData.ingestCheck1')} color={C.ice60} bg="rgba(255,255,255,0.05)" />
              <Badge label={t('explore.myData.ingestCheck2')} color={C.ice60} bg="rgba(255,255,255,0.05)" />
              <Badge label={t('explore.myData.ingestCheck3')} color={C.ice60} bg="rgba(255,255,255,0.05)" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            <TopMetric label={t('explore.myData.statUploads')} value={summaryStats.total} accent={C.blue} />
            <TopMetric label={t('explore.myData.statUsable')} value={summaryStats.usable} accent={summaryStats.usable > 0 ? C.green : C.ice60} />
            <TopMetric label={copy.contributionReadyStat} value={summaryStats.contributionReady} accent={summaryStats.contributionReady > 0 ? C.blue : C.ice60} />
            <TopMetric label={copy.reviewQueueStat} value={summaryStats.inReview} accent={summaryStats.inReview > 0 ? '#f59e0b' : C.ice60} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18, alignItems: 'start' }}>
            <UploadZone
              t={t}
              copy={copy}
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <CurrentSourcePanel personalInfo={personalSourceInfo} buildStatus={buildStatus} t={t} />
              <PersonalSourceWarmupBar status={personalBuildStatus || personalSourceInfo?.source_meta} />

              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice30, lineHeight: 1.7 }}>
                  {validContributionUploads.length > 0
                    ? `${copy.contributionReadyStat}: ${summaryStats.contributionReady} | ${copy.reviewQueueStat}: ${summaryStats.inReview}`
                    : copy.contributionNone}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  <button
                    onClick={() => setContributeOpen(true)}
                    disabled={validContributionUploads.length === 0}
                    style={{
                      padding: '9px 16px',
                      borderRadius: 10,
                      border: '1px solid rgba(74,158,255,0.35)',
                      background: validContributionUploads.length > 0 ? 'rgba(74,158,255,0.12)' : 'rgba(255,255,255,0.04)',
                      color: validContributionUploads.length > 0 ? C.blue : C.ice30,
                      fontSize: 'calc(12px * var(--font-scale, 1))',
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
                      borderRadius: 10,
                      border: `1px solid ${C.border}`,
                      background: 'rgba(255,255,255,0.04)',
                      color: C.ice60,
                      fontSize: 'calc(12px * var(--font-scale, 1))',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {copy.contributionHistory}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </GlowCard>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18, alignItems: 'start' }}>
        <GlowCard style={{ padding: '18px 18px 16px' }}>
          <div
            style={{
              fontSize: 'calc(11px * var(--font-scale, 1))',
              fontWeight: 700,
              color: C.blue,
              fontFamily: "'Orbitron', sans-serif",
              letterSpacing: 2,
              marginBottom: 8,
            }}
          >
            {copy.queueTitle}
          </div>
          <div style={{ fontSize: 'calc(12px * var(--font-scale, 1))', color: C.ice60, lineHeight: 1.8, marginBottom: 14 }}>{copy.queueDesc}</div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {filterDefs.map((filter) => (
              <FilterPill
                key={filter.key}
                active={activeFilter === filter.key}
                label={filter.label}
                accent={filter.accent}
                onClick={() => setActiveFilter(filter.key)}
              />
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.02)',
              marginBottom: 14,
            }}
          >
            <span style={{ color: C.ice30, flexShrink: 0 }}>
              <SearchIcon size={16} color="currentColor" />
            </span>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={copy.searchPlaceholder}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: C.ice,
                fontSize: 'calc(12px * var(--font-scale, 1))',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10 }}>
            <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice30 }}>{uploadsLoading ? t('common.loading') : t('explore.myData.count', { n: filteredUploadContexts.length })}</div>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: C.ice30,
                  fontSize: 'calc(11px * var(--font-scale, 1))',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {t('explore.myData.cancelBtn')}
              </button>
            )}
          </div>

          {uploadsLoading && <LoadingBox h={320} />}

          {!uploadsLoading && !sortedUploadContexts.length && (
            <EmptyState
              icon={<FolderOpenIcon size={34} color="currentColor" />}
              title={t('explore.myData.emptyHint')}
              desc={t('explore.myData.ingestDesc')}
            />
          )}

          {!uploadsLoading && !!sortedUploadContexts.length && !filteredUploadContexts.length && (
            <EmptyState
              icon={<SearchIcon size={28} color="currentColor" />}
              title={copy.noMatchTitle}
              desc={copy.noMatchDesc}
            />
          )}

          {!uploadsLoading && filteredUploadContexts.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 980, overflowY: 'auto', paddingRight: 2 }}>
              {filteredUploadContexts.map((ctx) => (
                <QueueItem
                  key={ctx.upload.id}
                  ctx={ctx}
                  selected={viewingId === ctx.upload.id}
                  onSelect={() => setViewingId(ctx.upload.id)}
                  copy={copy}
                  t={t}
                />
              ))}
            </div>
          )}
        </GlowCard>

        <GlowCard breathe style={{ padding: 22 }}>
          <div
            style={{
              fontSize: 'calc(11px * var(--font-scale, 1))',
              fontWeight: 700,
              color: C.blue,
              fontFamily: "'Orbitron', sans-serif",
              letterSpacing: 2,
              marginBottom: 10,
            }}
          >
            {copy.detailTitle}
          </div>

          {!viewingUpload || !viewingCtx ? (
            <EmptyState
              icon={<FileIcon size={34} color="currentColor" />}
              title={copy.detailEmptyTitle}
              desc={copy.detailEmptyDesc}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 'calc(18px * var(--font-scale, 1))', color: C.ice, fontWeight: 700, lineHeight: 1.45 }} title={viewingUpload.filename}>
                    {viewingUpload.filename}
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <Badge label={viewingCtx.datasetState.label} color={viewingCtx.datasetState.color} bg={viewingCtx.datasetState.bg} />
                    <Badge label={viewingCtx.datasetState.modeMeta.label} color={viewingCtx.datasetState.modeMeta.color} bg={viewingCtx.datasetState.modeMeta.bg} />
                    <Badge label={viewingCtx.buildMeta.label} color={viewingCtx.buildMeta.color} bg={viewingCtx.buildMeta.bg} />
                    <Badge label={viewingCtx.uploadStatusMeta.label} color={viewingCtx.uploadStatusMeta.color} bg={viewingCtx.uploadStatusMeta.bg} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <ActionBtn
                    label={viewingUpload.is_public ? t('explore.contribute.contributed') : t('explore.myData.contributeBtn')}
                    borderColor={viewingCtx.contributionCondition.ok ? 'rgba(74,158,255,0.5)' : C.border}
                    textColor={viewingCtx.contributionCondition.ok ? C.blue : C.ice30}
                    activeBg="rgba(74,158,255,0.10)"
                    onClick={() => setContributeOpen(true)}
                    disabled={viewActionLoading || viewingUpload.is_public || !viewingCtx.contributionCondition.ok}
                  />
                  <ActionBtn
                    label={t('explore.myData.deleteBtn')}
                    borderColor="rgba(199,91,57,0.5)"
                    textColor={C.mars}
                    onClick={() => setConfirmDelete(viewingUpload.id)}
                    disabled={viewActionLoading}
                    loading={viewActionLoading}
                  />
                </div>
              </div>

              {viewingSignal && (
                <div
                  style={{
                    border: `1px solid ${viewingSignal.color}33`,
                    borderRadius: 14,
                    padding: '12px 14px',
                    background: viewingSignal.bg,
                    color: viewingSignal.color,
                    fontSize: 'calc(12px * var(--font-scale, 1))',
                    fontWeight: 700,
                  }}
                >
                  {viewingSignal.label}
                </div>
              )}

              <div style={{ fontSize: 'calc(12px * var(--font-scale, 1))', color: C.ice60, lineHeight: 1.85 }}>
                {viewingCtx.datasetState.desc}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                <RuleList
                  title={copy.canUseTitle}
                  ok={viewingCtx.analysisCondition.ok}
                  desc={copy.canUseDesc}
                  rules={viewingCtx.analysisCondition.rules}
                  copy={copy}
                />
                <RuleList
                  title={copy.canContributeTitle}
                  ok={viewingCtx.contributionCondition.ok}
                  desc={copy.canContributeDesc}
                  rules={viewingCtx.contributionCondition.rules}
                  copy={copy}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <SnapshotTile label={copy.lifeCycleTitle} value={viewingCtx.lifecycleLabel} accent={C.ice} />
                <SnapshotTile label={copy.sourceModeTitle} value={viewingCtx.datasetState.modeMeta.label} desc={copy.sourceModeDesc} accent={viewingCtx.datasetState.modeMeta.color} />
                <SnapshotTile label={copy.uploadStatusTitle} value={viewingCtx.uploadStatusMeta.label} accent={viewingCtx.uploadStatusMeta.color} />
              </div>

              <UsagePanel pages={viewingCtx.datasetState.usagePages} copy={copy} />

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '8px 14px',
                  padding: '14px 16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${C.border}`,
                  borderRadius: 14,
                }}
              >
                <MetaRow label={t('explore.myData.cardType')} value={viewingUpload.data_type || '--'} />
                <MetaRow label={t('explore.myData.cardMarsYear')} value={viewingUpload.mars_year != null ? `MY ${viewingUpload.mars_year}` : '--'} />
                <MetaRow label={t('explore.myData.cardLs')} value={formatLsLabel(viewingUpload.ls_start, viewingUpload.ls_end)} />
                <MetaRow label={t('explore.myData.cardSize')} value={formatFileSize(viewingUpload.file_size)} />
                <MetaRow label={t('explore.myData.cardTime')} value={formatDate(viewingUpload.created_at)} />
              </div>

              <div>
                <div
                  style={{
                    fontSize: 'calc(11px * var(--font-scale, 1))',
                    fontWeight: 700,
                    color: C.blue,
                    fontFamily: "'Orbitron', sans-serif",
                    letterSpacing: 2,
                    marginBottom: 10,
                  }}
                >
                  {t('explore.myData.viewerTitle')}
                </div>
                <PreviewContent viewData={viewData} viewLs={viewLs} onLsChange={handleViewLsChange} t={t} />
              </div>
            </div>
          )}
        </GlowCard>
      </div>

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

      <>
        <ContributeModal
          open={contributeOpen}
          onClose={() => setContributeOpen(false)}
          validUploads={validContributionUploads}
          onDone={loadWorkbench}
        />

        <ContributeHistoryPanel open={historyOpen} onClose={() => setHistoryOpen(false)} />
      </>
    </div>
  );
}
