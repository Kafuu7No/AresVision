import { useCallback, useEffect, useMemo, useState } from 'react';
import C from '../../constants/colors';
import { useT } from '../../i18n';
import GlowCard from '../../components/GlowCard';
import { fetchDataInfo } from '../../services/api';
import { LoadingBox } from './ExploreComponents';

const OFFICIAL_VARIABLE_GROUPS = [
  {
    name: 'Ozone Core',
    coverage: 100,
    variables: ['o3col'],
    color: C.mars,
  },
  {
    name: 'Atmospheric Drivers',
    coverage: 100,
    variables: ['Temperature', 'Pressure', 'Dust_Optical_Depth'],
    color: C.blue,
  },
  {
    name: 'Radiative Forcing',
    coverage: 100,
    variables: ['Solar_Flux_DN'],
    color: C.green,
  },
  {
    name: 'Circulation Field',
    coverage: 100,
    variables: ['U_Wind', 'V_Wind'],
    color: '#9bd2ff',
  },
];

const OFFICIAL_CAPABILITY_TAGS = [
  'Ozone seasonal diagnosis',
  'Environmental driver coupling',
  'Prediction model training',
  'Cross-year comparative analysis',
  'Feature engineering baseline',
  'Spatial-temporal unified ingestion',
];

function toYearRows(info) {
  const years = Array.isArray(info?.available_years) ? info.available_years : [];
  const details = info?.details || {};

  return years
    .map((year) => {
      const detail = details[`MY${year}`] || {};
      const range = Array.isArray(detail.ls_range) ? detail.ls_range : [null, null];
      return {
        year,
        lsStart: range[0],
        lsEnd: range[1],
        sourceMode: detail.source_mode || 'default',
      };
    })
    .sort((a, b) => a.year - b.year);
}

function formatLs(v) {
  return Number.isFinite(v) ? `${Number(v).toFixed(1)}°` : '--';
}

function pct(value) {
  return `${Math.max(0, Math.min(100, Number(value || 0))).toFixed(0)}%`;
}

function YearCoverageCard({ row, t }) {
  const coverage = row.lsStart != null && row.lsEnd != null
    ? Math.max(0, Math.min(100, ((row.lsEnd - row.lsStart) / 360) * 100))
    : 0;

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minHeight: 188,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: C.ice,
            fontFamily: "'Orbitron', sans-serif",
            letterSpacing: 1.2,
          }}
        >
          {`MY ${row.year}`}
        </div>
        <span
          style={{
            fontSize: 10,
            color: C.blue,
            border: '1px solid rgba(74,158,255,0.35)',
            background: 'rgba(74,158,255,0.08)',
            borderRadius: 999,
            padding: '3px 9px',
            fontWeight: 600,
          }}
        >
          {t('explore.defaultDataset.labelOfficial')}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif" }}>
          {pct(coverage)}
        </div>
        <div style={{ fontSize: 11, color: C.ice30 }}>{t('explore.defaultDataset.coverageHint')}</div>
      </div>

      <div style={{ height: 7, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.08)' }}>
        <div
          style={{
            width: `${coverage}%`,
            height: '100%',
            background: coverage >= 90 ? C.green : coverage >= 70 ? '#f59e0b' : C.mars,
          }}
        />
      </div>

      <div style={{ fontSize: 11, color: C.ice60, lineHeight: 1.8 }}>
        <div>{`${t('explore.defaultDataset.metaLsRange')}: ${formatLs(row.lsStart)} - ${formatLs(row.lsEnd)}`}</div>
        <div>{`${t('explore.defaultDataset.metaGrid')}: 5° x 5°`}</div>
        <div>{`${t('explore.defaultDataset.metaSourceMode')}: ${row.sourceMode}`}</div>
      </div>
    </div>
  );
}

function MetricCard({ eyebrow, value, label, desc, accent = C.blue }) {
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
          letterSpacing: 1.6,
          fontFamily: "'Orbitron', sans-serif",
        }}
      >
        {eyebrow}
      </div>
      <div style={{ marginTop: 10, fontSize: 28, color: C.ice, fontWeight: 700, fontFamily: "'Orbitron', sans-serif" }}>
        {value}
      </div>
      <div style={{ marginTop: 4, fontSize: 12, color: C.ice60, fontWeight: 600 }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 11, color: C.ice30, lineHeight: 1.75 }}>{desc}</div>
    </div>
  );
}

function SourceCard({ title, subtitle, tags, body }) {
  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: '16px 18px',
        background: 'rgba(255,255,255,0.02)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: C.ice,
              fontFamily: "'Orbitron', sans-serif",
              letterSpacing: 1.2,
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: 11, color: C.ice30, marginTop: 3 }}>{subtitle}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {tags.map((tag) => (
          <span
            key={tag}
            style={{
              fontSize: 10,
              color: C.ice60,
              padding: '3px 8px',
              borderRadius: 999,
              border: `1px solid ${C.border}`,
              background: 'rgba(255,255,255,0.03)',
            }}
          >
            {tag}
          </span>
        ))}
      </div>
      <div style={{ fontSize: 11, color: C.ice60, lineHeight: 1.8 }}>{body}</div>
    </div>
  );
}

function VariableGroupCard({ group }) {
  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: '16px 18px',
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ fontSize: 13, color: C.ice, fontWeight: 700 }}>{group.name}</div>
        <div style={{ fontSize: 12, color: group.color, fontWeight: 700 }}>{pct(group.coverage)}</div>
      </div>
      <div style={{ marginTop: 10, height: 7, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.08)' }}>
        <div style={{ width: `${group.coverage}%`, height: '100%', background: group.color }} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {group.variables.map((variable) => (
          <span
            key={variable}
            style={{
              fontSize: 10,
              color: C.ice60,
              padding: '4px 9px',
              borderRadius: 999,
              border: `1px solid ${C.border}`,
              background: 'rgba(255,255,255,0.03)',
            }}
          >
            {variable}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function DefaultDatasetTab() {
  const t = useT();
  const [dataInfo, setDataInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const info = await fetchDataInfo();
      setDataInfo(info);
    } catch (e) {
      setError(e?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const yearRows = useMemo(() => toYearRows(dataInfo), [dataInfo]);
  const lsCoverageStats = useMemo(() => {
    if (!yearRows.length) return { avg: '--', min: '--', max: '--' };
    const values = yearRows
      .map((row) => (row.lsStart != null && row.lsEnd != null ? ((row.lsEnd - row.lsStart) / 360) * 100 : null))
      .filter((value) => value != null);
    if (!values.length) return { avg: '--', min: '--', max: '--' };
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    return {
      avg: pct(avg),
      min: pct(Math.min(...values)),
      max: pct(Math.max(...values)),
    };
  }, [yearRows]);

  const sourceMeta = dataInfo?.source_meta || {};
  const officialYearCount = yearRows.length;
  const variableCount = OFFICIAL_VARIABLE_GROUPS.reduce((sum, group) => sum + group.variables.length, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <GlowCard style={{ padding: '20px 22px' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.blue,
            fontFamily: "'Orbitron', sans-serif",
            letterSpacing: 2,
            marginBottom: 8,
          }}
        >
          {t('explore.defaultDataset.header')}
        </div>
        <div style={{ fontSize: 13, color: C.ice60, lineHeight: 1.8, maxWidth: 1050 }}>
          {t('explore.defaultDataset.headerDesc')}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          {['OpenMARS', 'MCD 6.1', 'Official Benchmark', 'Unified Grid', 'Cross-module Feature Space'].map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 10,
                color: C.blue,
                padding: '4px 10px',
                borderRadius: 999,
                border: '1px solid rgba(74,158,255,0.25)',
                background: 'rgba(74,158,255,0.08)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </GlowCard>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <MetricCard
          eyebrow={t('explore.defaultDataset.metricCoverageEyebrow')}
          value={officialYearCount}
          label={t('explore.defaultDataset.metricCoverageLabel')}
          desc={t('explore.defaultDataset.metricCoverageDesc')}
          accent={C.blue}
        />
        <MetricCard
          eyebrow={t('explore.defaultDataset.metricGridEyebrow')}
          value="5° x 5°"
          label={t('explore.defaultDataset.metricGridLabel')}
          desc={t('explore.defaultDataset.metricGridDesc')}
          accent={C.green}
        />
        <MetricCard
          eyebrow={t('explore.defaultDataset.metricVariableEyebrow')}
          value={variableCount}
          label={t('explore.defaultDataset.metricVariableLabel')}
          desc={t('explore.defaultDataset.metricVariableDesc')}
          accent={C.mars}
        />
        <MetricCard
          eyebrow={t('explore.defaultDataset.metricReadinessEyebrow')}
          value={sourceMeta.effective_source === 'default' ? '100%' : 'Fallback'}
          label={t('explore.defaultDataset.metricReadinessLabel')}
          desc={t('explore.defaultDataset.metricReadinessDesc')}
          accent="#f59e0b"
        />
      </div>

      <GlowCard style={{ padding: '18px 20px' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.blue,
            fontFamily: "'Orbitron', sans-serif",
            letterSpacing: 2,
            marginBottom: 14,
          }}
        >
          {t('explore.defaultDataset.sourceTitle')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 14 }}>
          <SourceCard
            title="OpenMARS"
            subtitle={t('explore.defaultDataset.openmarsSubtitle')}
            tags={['O3 Column', 'Global Field', 'Ls-Time', 'Planetary Baseline']}
            body={t('explore.defaultDataset.openmarsBody')}
          />
          <SourceCard
            title="MCD 6.1"
            subtitle={t('explore.defaultDataset.mcdSubtitle')}
            tags={['Temperature', 'Pressure', 'Wind', 'Dust', 'Solar Flux']}
            body={t('explore.defaultDataset.mcdBody')}
          />
        </div>
      </GlowCard>

      <GlowCard style={{ padding: 20 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 14,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.blue,
              fontFamily: "'Orbitron', sans-serif",
              letterSpacing: 2,
            }}
          >
            {t('explore.defaultDataset.listTitle')}
          </div>
          {!loading && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, color: C.ice30 }}>
              <span>{t('explore.defaultDataset.yearCount', { n: yearRows.length })}</span>
              <span>{`${t('explore.defaultDataset.coverageAvg')}: ${lsCoverageStats.avg}`}</span>
              <span>{`${t('explore.defaultDataset.coverageRange')}: ${lsCoverageStats.min} - ${lsCoverageStats.max}`}</span>
            </div>
          )}
        </div>

        {loading && <LoadingBox h={170} label={t('common.loading')} />}

        {!loading && error && (
          <div
            style={{
              border: `1px dashed ${C.border}`,
              borderRadius: 12,
              padding: '20px 16px',
              textAlign: 'center',
              color: C.mars,
              fontSize: 12,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span>{error}</span>
            <button
              onClick={load}
              style={{
                border: `1px solid ${C.border}`,
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 8,
                color: C.ice60,
                fontSize: 12,
                padding: '5px 12px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {t('common.retry')}
            </button>
          </div>
        )}

        {!loading && !error && yearRows.length === 0 && (
          <div
            style={{
              border: `1px dashed ${C.border}`,
              borderRadius: 12,
              padding: '26px 14px',
              textAlign: 'center',
              color: C.ice30,
              fontSize: 12,
            }}
          >
            {t('common.noData')}
          </div>
        )}

        {!loading && !error && yearRows.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 14 }}>
            {yearRows.map((row) => (
              <YearCoverageCard key={row.year} row={row} t={t} />
            ))}
          </div>
        )}
      </GlowCard>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: 16 }}>
        <GlowCard style={{ padding: '16px 20px' }}>
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
            {t('explore.defaultDataset.variableTitle')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {OFFICIAL_VARIABLE_GROUPS.map((group) => (
              <VariableGroupCard key={group.name} group={group} />
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: C.ice30, lineHeight: 1.8 }}>
            {t('explore.defaultDataset.variableDesc')}
          </div>
        </GlowCard>

        <GlowCard style={{ padding: '16px 20px' }}>
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
            {t('explore.defaultDataset.capabilityTitle')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {OFFICIAL_CAPABILITY_TAGS.map((name) => (
              <span
                key={name}
                style={{
                  fontSize: 10,
                  color: C.ice60,
                  padding: '5px 10px',
                  borderRadius: 999,
                  border: `1px solid ${C.border}`,
                  background: 'rgba(255,255,255,0.03)',
                }}
              >
                {name}
              </span>
            ))}
          </div>
          <div style={{ fontSize: 11, color: C.ice30, lineHeight: 1.85 }}>
            {t('explore.defaultDataset.capabilityDesc')}
          </div>
        </GlowCard>
      </div>
    </div>
  );
}
