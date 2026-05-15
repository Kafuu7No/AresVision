import { useMemo, useState } from 'react';
import C from '../constants/colors';
import { useT } from '../i18n';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import SectionTitle from '../components/SectionTitle';
import GlowCard from '../components/GlowCard';
import DefaultDatasetTab from './ExplorePage/DefaultDatasetTab';
import MyDataTab from './ExplorePage/MyDataTab';

function createCopy(isZh) {
  return {
    lead: isZh
      ? '数据管理页应该先回答“我要做什么”，而不是先把所有能力堆出来。这里按真实任务拆成多个视图：了解平台官方资产、接入个人数据源、把合格数据贡献给平台，以及管理员审核并入。'
      : 'This page should answer "what am I here to do?" before showing every capability at once. The content is split by real user tasks: understand official assets, ingest a personal source, contribute qualified datasets, and review merges as an admin.',
    tabAsset: isZh ? '官方数据资产' : 'Official Assets',
    tabAssetDesc: isZh ? '查看平台已有系统数据和状态' : 'View platform-owned datasets and readiness',
    tabMySource: isZh ? '我的数据源' : 'My Data Source',
    tabMySourceDesc: isZh ? '上传并接入个人可用数据源' : 'Upload and ingest a personal source',
    tabContribute: isZh ? '平台贡献' : 'Platform Contribution',
    tabContributeDesc: isZh ? '把合格数据送审并查看贡献记录' : 'Submit qualified datasets for review',
    tabAdmin: isZh ? '管理员审核' : 'Admin Review',
    tabAdminDesc: isZh ? '审核并入官方数据集' : 'Review and merge official assets',
    assetIntroTitle: isZh ? '平台自己的数据集信息与状态展示中心' : 'Platform Dataset Status Center',
    assetIntroBody: isZh
      ? '这一页只负责说明平台当前官方数据底座是什么、覆盖到哪里、能支持什么，不与用户上传流程混在一起。'
      : 'This view is only about the current official data foundation: what it contains, how far it covers, and what it can support.',
    mySourceIntroTitle: isZh ? '把上传数据接入成个人数据源' : 'Turn Uploads Into A Personal Source',
    mySourceIntroBody: isZh
      ? '这一页只保留与“上传、校验、处理、接入、预览、供其他页面使用”直接相关的动作和状态。'
      : 'This view keeps only the actions and status directly tied to upload, validation, processing, ingestion, preview, and downstream usage.',
    contributeIntroTitle: isZh ? '把个人数据贡献给平台' : 'Contribute Personal Data To The Platform',
    contributeIntroBody: isZh
      ? '这一页聚焦公共贡献，不再混入个人接入细节。你只需要看到哪些数据能贡献、为什么能贡献，以及贡献后的审核记录。'
      : 'This view focuses on public contribution only. It separates contribution eligibility and review history from the rest of personal ingestion.',
    contributeTipTitle: isZh ? '贡献前提' : 'Contribution Requirements',
    contributeTipBody: isZh
      ? '当前系统只有状态为 valid 的数据可以提交公共贡献。提交后状态会变为 pending_review，审核通过后进入 approved。'
      : 'Only datasets currently in valid status can be submitted for public contribution. After submission they move to pending_review, then approved if accepted.',
    adminIntroTitle: isZh ? '管理员审核并入系统数据集' : 'Admin Merge Console',
    adminIntroBody: isZh
      ? '管理员入口单独放在一个视图中，避免对普通用户造成干扰。这里只承担平台级审核与并入，不负责用户的普通上传管理。'
      : 'The admin console lives in its own view to avoid distracting regular users. It is only for platform-level review and merge decisions.',
    adminOpen: isZh ? '打开审核面板' : 'Open Review Panel',
    adminNoAccess: isZh ? '当前账号没有管理员权限，只显示流程说明。' : 'This account is not an admin, so only the process overview is shown.',
    quickTitle: isZh ? '任务导航' : 'Task Navigation',
    quickDesc: isZh
      ? '按任务进入，而不是在一页里来回找模块。'
      : 'Enter by task instead of scanning one overloaded page.',
  };
}

function ViewTab({ active, label, desc, accent, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left',
        border: `1px solid ${active ? accent : C.border}`,
        borderRadius: 16,
        padding: '16px 18px',
        background: active ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
        cursor: 'pointer',
        transition: 'all 0.2s',
        fontFamily: 'inherit',
      }}
    >
      <div
        style={{
          fontSize: 'calc(10px * var(--font-scale, 1))',
          color: active ? accent : C.ice30,
          fontWeight: 700,
          letterSpacing: 1.8,
          fontFamily: "'Orbitron', sans-serif",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 'calc(12px * var(--font-scale, 1))', color: C.ice60, lineHeight: 1.7 }}>{desc}</div>
    </button>
  );
}

function IntroCard({ eyebrow, title, body, accent = C.blue, action = null }) {
  return (
    <GlowCard style={{ padding: '18px 20px' }}>
      <div
        style={{
          fontSize: 'calc(11px * var(--font-scale, 1))',
          fontWeight: 700,
          color: accent,
          fontFamily: "'Orbitron', sans-serif",
          letterSpacing: 2,
          marginBottom: 10,
        }}
      >
        {eyebrow}
      </div>
      <div style={{ fontSize: 'calc(15px * var(--font-scale, 1))', color: C.ice, fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 'calc(13px * var(--font-scale, 1))', color: C.ice60, lineHeight: 1.85, maxWidth: 1040 }}>{body}</div>
      {action ? <div style={{ marginTop: 14 }}>{action}</div> : null}
    </GlowCard>
  );
}

function AdminWorkspace({ onOpenAdmin, isAdmin, copy, isZh }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <IntroCard
        eyebrow="ADMIN MERGE"
        title={copy.adminIntroTitle}
        body={copy.adminIntroBody}
        accent={C.mars}
        action={
          isAdmin ? (
            <button
              onClick={onOpenAdmin}
              style={{
                padding: '10px 16px',
                borderRadius: 10,
                border: '1px solid rgba(199,91,57,0.35)',
                background: 'rgba(199,91,57,0.12)',
                color: C.mars,
                fontSize: 'calc(12px * var(--font-scale, 1))',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {copy.adminOpen}
            </button>
          ) : null
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        <GlowCard style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 'calc(12px * var(--font-scale, 1))', color: C.ice, fontWeight: 700, marginBottom: 8 }}>
            {isZh ? '这里负责什么' : 'What This View Owns'}
          </div>
          <div style={{ fontSize: 'calc(12px * var(--font-scale, 1))', color: C.ice60, lineHeight: 1.8 }}>
            {isZh
              ? '处理用户贡献数据的待审核、通过、撤销三类动作，并决定哪些数据正式进入平台官方资产。'
              : 'It handles pending review, approval, and revoke actions for user-contributed datasets, and decides what formally enters official platform assets.'}
          </div>
        </GlowCard>

        <GlowCard style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 'calc(12px * var(--font-scale, 1))', color: C.ice, fontWeight: 700, marginBottom: 8 }}>
            {isZh ? '为什么单独成页' : 'Why It Is Separate'}
          </div>
          <div style={{ fontSize: 'calc(12px * var(--font-scale, 1))', color: C.ice60, lineHeight: 1.8 }}>
            {isZh
              ? '管理员并入流程和普通用户的上传接入目标不同，分开后普通用户不会被后台概念打扰，管理员也能更直接进入审核工作。'
              : 'Admin merge work is different from ordinary upload ingestion. Separating it keeps regular users focused and gives admins a cleaner review entry point.'}
          </div>
        </GlowCard>

        <GlowCard style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 'calc(12px * var(--font-scale, 1))', color: C.ice, fontWeight: 700, marginBottom: 8 }}>
            {isZh ? '当前权限' : 'Current Access'}
          </div>
          <div style={{ fontSize: 'calc(12px * var(--font-scale, 1))', color: C.ice60, lineHeight: 1.8 }}>
            {isAdmin ? copy.adminOpen : copy.adminNoAccess}
          </div>
        </GlowCard>
      </div>
    </div>
  );
}

export default function ExplorePage({ onOpenAdmin, reviewSignal = 0 }) {
  const t = useT();
  const { user } = useAuth();
  const { settings } = useSettings();
  const isZh = settings.language !== 'en';
  const isAdmin = user?.role === 'admin';
  const copy = useMemo(() => createCopy(isZh), [isZh]);
  const [activeView, setActiveView] = useState('official');

  const views = useMemo(() => {
    return [
      { key: 'official', label: copy.tabAsset, desc: copy.tabAssetDesc, accent: C.blue },
      { key: 'personal', label: copy.tabMySource, desc: copy.tabMySourceDesc, accent: C.green },
      { key: 'admin', label: copy.tabAdmin, desc: copy.tabAdminDesc, accent: '#f59e0b' },
    ];
  }, [copy]);

  return (
    <div className="page-enter" style={{ padding: '100px 40px 60px', maxWidth: 1400, margin: '0 auto' }}>
      <SectionTitle title={t('explore.title')} subtitle={t('explore.subtitle')} />

      <GlowCard style={{ padding: '18px 20px', marginTop: 18 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div>
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
              {copy.quickTitle}
            </div>
            <div style={{ fontSize: 'calc(12px * var(--font-scale, 1))', color: C.ice30, lineHeight: 1.8 }}>{copy.quickDesc}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
          {views.map((view) => (
            <ViewTab
              key={view.key}
              active={activeView === view.key}
              label={view.label}
              desc={view.desc}
              accent={view.accent}
              onClick={() => setActiveView(view.key)}
            />
          ))}
        </div>
      </GlowCard>

      <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {activeView === 'official' && <DefaultDatasetTab />}

        {activeView === 'personal' && <MyDataTab reviewSignal={reviewSignal} />}

        {activeView === 'admin' && (
          <AdminWorkspace onOpenAdmin={onOpenAdmin} isAdmin={isAdmin} copy={copy} isZh={isZh} />
        )}
      </div>
    </div>
  );
}
