import { useCallback, useEffect, useMemo, useState } from 'react';
import C from '../../constants/colors';
import { useT } from '../../i18n';
import { useAuth } from '../../contexts/AuthContext';
import GlowCard from '../../components/GlowCard';
import { LoadingBox } from './ExploreComponents';
import {
  getDataGovernanceLineage,
  getDataGovernanceOverview,
  getDataGovernanceQuality,
} from '../../services/api';

const STATUS_COLORS = {
  valid: '#22c55e',
  invalid: '#ef4444',
  pending_review: '#f59e0b',
  approved: '#10b981',
  rejected: '#fb7185',
};

function fmtNum(v, digits = 1) {
  if (v == null || Number.isNaN(Number(v))) return '--';
  return Number(v).toFixed(digits);
}

function fmtPct(v) {
  if (v == null || Number.isNaN(Number(v))) return '--';
  return `${(Number(v) * 100).toFixed(1)}%`;
}

function fmtLsRange(range) {
  if (!Array.isArray(range) || range.length < 2 || range[0] == null || range[1] == null) return '--';
  return `${fmtNum(range[0], 1)} - ${fmtNum(range[1], 1)}°`;
}

function fmtLsCoverage(v) {
  if (v == null || Number.isNaN(Number(v))) return '--';
  return `${(Number(v) * 100).toFixed(1)}%`;
}

function fmtVars(vars) {
  if (!Array.isArray(vars) || vars.length === 0) return '--';
  if (vars.length <= 4) return vars.join(', ');
  return `${vars.slice(0, 4).join(', ')} ... (+${vars.length - 4})`;
}

function gradeColor(grade) {
  if (grade === 'A') return '#22c55e';
  if (grade === 'B') return C.blue;
  if (grade === 'C') return '#4ade80';
  if (grade === 'D') return '#f59e0b';
  return C.mars;
}

function SourceModeBadge({ label, color = C.ice60 }) {
  return (
    <span
      style={{
        fontSize: 10,
        color,
        border: `1px solid ${C.border}`,
        borderRadius: 999,
        padding: '4px 10px',
        background: 'rgba(255,255,255,0.03)',
      }}
    >
      {label}
    </span>
  );
}

function StatusDistributionChart({ distribution }) {
  const entries = Object.entries(distribution || {});
  const total = entries.reduce((sum, [, n]) => sum + Number(n || 0), 0);
  if (!entries.length || total <= 0) return null;

  return (
    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {entries.map(([status, count]) => {
        const safeCount = Number(count || 0);
        const pct = total > 0 ? (safeCount / total) * 100 : 0;
        return (
          <div key={`status-bar-${status}`} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 72px', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: STATUS_COLORS[status] || C.ice60 }}>{status}</span>
            <div style={{ height: 8, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.08)' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.max(0, Math.min(100, pct))}%`,
                  background: STATUS_COLORS[status] || C.ice60,
                }}
              />
            </div>
            <span style={{ fontSize: 11, color: C.ice30, textAlign: 'right' }}>{`${safeCount} (${pct.toFixed(1)}%)`}</span>
          </div>
        );
      })}
    </div>
  );
}

function MetricBar({ label, value }) {
  const safe = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.ice60 }}>
        <span>{label}</span>
        <span>{fmtNum(safe, 1)}</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.08)' }}>
        <div
          style={{
            height: '100%',
            width: `${safe}%`,
            background: safe >= 90 ? '#22c55e' : safe >= 75 ? '#4ade80' : safe >= 60 ? '#f59e0b' : '#ef4444',
            transition: 'width 0.2s',
          }}
        />
      </div>
    </div>
  );
}

function StatCard({ eyebrow, label, value, desc, accent = C.blue }) {
  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: '16px 18px',
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <div style={{ fontSize: 10, color: accent, fontWeight: 700, letterSpacing: 1.5, fontFamily: "'Orbitron', sans-serif" }}>
        {eyebrow}
      </div>
      <div style={{ marginTop: 10, fontSize: 28, fontWeight: 700, color: C.ice, fontFamily: "'Orbitron', sans-serif" }}>
        {value}
      </div>
      <div style={{ marginTop: 4, fontSize: 12, color: C.ice60, fontWeight: 600 }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 11, color: C.ice30, lineHeight: 1.75 }}>{desc}</div>
    </div>
  );
}

function AssetOverviewCard({ asset, active, onClick, t }) {
  const statusColor = STATUS_COLORS[asset.dominantStatus] || C.ice60;
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        border: `1px solid ${active ? C.blue : C.border}`,
        borderRadius: 14,
        padding: '16px 18px',
        background: active ? 'rgba(74,158,255,0.08)' : 'rgba(255,255,255,0.02)',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ fontSize: 13, color: C.ice, fontWeight: 700 }}>
            {asset.yearLabel} · {asset.dataType}
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: C.ice30 }}>
            {`${asset.datasetCount} ${t('explore.governance.datasetUnit')} · ${asset.grids.length ? asset.grids.join(' / ') : '--'}`}
          </div>
        </div>
        <div style={{ fontSize: 18, color: asset.avgQuality != null ? gradeColor(asset.grade) : C.ice30, fontWeight: 700, fontFamily: "'Orbitron', sans-serif" }}>
          {asset.avgQuality != null ? fmtNum(asset.avgQuality, 1) : '--'}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        <SourceModeBadge label={`${t('explore.governance.assetCoverage')}: ${fmtLsCoverage(asset.lsCoverage)}`} />
        <SourceModeBadge label={`${t('explore.governance.assetRange')}: ${fmtLsRange(asset.lsRange)}`} />
        <SourceModeBadge label={`${t('explore.governance.assetStatus')}: ${asset.dominantStatus}`} color={statusColor} />
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: C.ice60, lineHeight: 1.7 }}>
        {fmtVars(asset.variables)}
      </div>
    </button>
  );
}

export default function GovernanceTab() {
  const t = useT();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [scope, setScope] = useState(isAdmin ? 'all' : 'mine');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [quality, setQuality] = useState(null);
  const [lineage, setLineage] = useState(null);

  useEffect(() => {
    setScope(isAdmin ? 'all' : 'mine');
  }, [isAdmin]);

  const assets = overview?.assets || [];
  const summary = overview?.summary || null;

  const groupedAssets = useMemo(() => {
    const map = new Map();
    assets.forEach((asset) => {
      const yearKey = asset.mars_year == null ? 'unknown' : `MY${asset.mars_year}`;
      const typeKey = asset.data_type || 'unknown';
      const key = `${yearKey}__${typeKey}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          yearLabel: yearKey,
          dataType: typeKey,
          datasetCount: 0,
          variableSet: new Set(),
          gridSet: new Set(),
          lsMin: null,
          lsMax: null,
          lsCoverageValues: [],
          statusDistribution: {},
          qualityValues: [],
          effectiveCount: 0,
          storageZones: new Set(),
          latestUploadId: asset.upload_id,
          latestCreatedAt: asset.created_at || '',
        });
      }

      const group = map.get(key);
      group.datasetCount += 1;
      (asset.variables || []).forEach((v) => group.variableSet.add(v));
      if (asset.grid?.lat_points && asset.grid?.lon_points) {
        group.gridSet.add(`${asset.grid.lat_points}x${asset.grid.lon_points}`);
      }
      if (Array.isArray(asset.ls_range) && asset.ls_range.length >= 2) {
        const [start, end] = asset.ls_range;
        if (start != null && (group.lsMin == null || start < group.lsMin)) group.lsMin = start;
        if (end != null && (group.lsMax == null || end > group.lsMax)) group.lsMax = end;
      }
      if (asset.ls_coverage != null && !Number.isNaN(Number(asset.ls_coverage))) {
        group.lsCoverageValues.push(Number(asset.ls_coverage));
      }
      const statusKey = asset.status || 'unknown';
      group.statusDistribution[statusKey] = (group.statusDistribution[statusKey] || 0) + 1;
      if (asset.quality_score != null && !Number.isNaN(Number(asset.quality_score))) {
        group.qualityValues.push(Number(asset.quality_score));
      }
      if (asset.effective) group.effectiveCount += 1;
      if (asset.storage_zone) group.storageZones.add(asset.storage_zone);

      const createdAt = asset.created_at || '';
      if (createdAt > group.latestCreatedAt) {
        group.latestCreatedAt = createdAt;
        group.latestUploadId = asset.upload_id;
      }
    });

    return Array.from(map.values())
      .map((group) => {
        const lsRange = group.lsMin != null && group.lsMax != null ? [group.lsMin, group.lsMax] : null;
        const lsCoverage = group.lsCoverageValues.length > 0 ? group.lsCoverageValues.reduce((sum, v) => sum + v, 0) / group.lsCoverageValues.length : null;
        const avgQuality = group.qualityValues.length > 0 ? group.qualityValues.reduce((sum, v) => sum + v, 0) / group.qualityValues.length : null;
        const dominantStatus = Object.entries(group.statusDistribution).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
        const grade = avgQuality == null ? '--' : avgQuality >= 90 ? 'A' : avgQuality >= 80 ? 'B' : avgQuality >= 70 ? 'C' : avgQuality >= 60 ? 'D' : 'E';

        return {
          key: group.key,
          yearLabel: group.yearLabel,
          dataType: group.dataType,
          datasetCount: group.datasetCount,
          variables: Array.from(group.variableSet).sort(),
          grids: Array.from(group.gridSet).sort(),
          lsRange,
          lsCoverage,
          statusDistribution: group.statusDistribution,
          avgQuality,
          grade,
          effectiveCount: group.effectiveCount,
          storageZones: Array.from(group.storageZones).sort(),
          dominantStatus,
          latestUploadId: group.latestUploadId,
        };
      })
      .sort((a, b) => {
        if (a.yearLabel === b.yearLabel) return a.dataType.localeCompare(b.dataType);
        return a.yearLabel < b.yearLabel ? 1 : -1;
      });
  }, [assets]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getDataGovernanceOverview(scope);
      setOverview(data);
    } catch (e) {
      setError(e?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [scope, t]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (!groupedAssets.length) {
      setSelectedId(null);
      return;
    }
    const validIds = new Set(groupedAssets.map((x) => x.latestUploadId));
    if (!selectedId || !validIds.has(selectedId)) {
      setSelectedId(groupedAssets[0].latestUploadId);
    }
  }, [groupedAssets, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setQuality(null);
      setLineage(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      try {
        const [q, l] = await Promise.all([getDataGovernanceQuality(selectedId), getDataGovernanceLineage(selectedId)]);
        if (cancelled) return;
        setQuality(q);
        setLineage(l);
      } catch {
        if (cancelled) return;
        setQuality(null);
        setLineage(null);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const selectedGroup = useMemo(() => groupedAssets.find((item) => item.latestUploadId === selectedId) || null, [groupedAssets, selectedId]);

  const statItems = useMemo(() => {
    if (!summary) return [];
    const dist = summary.status_distribution || {};
    return [
      {
        key: 'total',
        eyebrow: 'ASSETS',
        label: t('explore.governance.totalDatasets'),
        value: summary.total_datasets ?? 0,
        desc: t('explore.governance.totalDatasetsDesc'),
        accent: C.blue,
      },
      {
        key: 'effective',
        eyebrow: 'ACTIVE',
        label: t('explore.governance.effectiveDatasets'),
        value: summary.effective_datasets ?? 0,
        desc: t('explore.governance.effectiveDatasetsDesc'),
        accent: C.green,
      },
      {
        key: 'approved',
        eyebrow: 'APPROVED',
        label: t('explore.governance.approvedCount'),
        value: dist.approved ?? 0,
        desc: t('explore.governance.approvedCountDesc'),
        accent: C.blue,
      },
      {
        key: 'pending',
        eyebrow: 'PENDING',
        label: t('explore.governance.pendingCount'),
        value: dist.pending_review ?? 0,
        desc: t('explore.governance.pendingCountDesc'),
        accent: '#f59e0b',
      },
      {
        key: 'quality',
        eyebrow: 'QUALITY',
        label: t('explore.governance.avgQuality'),
        value: summary.average_quality_score != null ? fmtNum(summary.average_quality_score, 1) : '--',
        desc: t('explore.governance.avgQualityDesc'),
        accent: C.mars,
      },
    ];
  }, [summary, t]);

  if (!user) {
    return (
      <GlowCard style={{ padding: 22 }}>
        <div style={{ fontSize: 13, color: C.ice60 }}>{t('explore.upload.loginPrompt')}</div>
      </GlowCard>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <GlowCard style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, letterSpacing: 2, fontFamily: "'Orbitron', sans-serif" }}>
              {t('explore.governance.title')}
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: C.ice60 }}>{t('explore.governance.subtitle')}</div>
          </div>

          {isAdmin && (
            <div style={{ display: 'flex', gap: 8 }}>
              {['all', 'mine'].map((s) => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: `1px solid ${scope === s ? C.blue : C.border}`,
                    background: scope === s ? 'rgba(74,158,255,0.12)' : 'rgba(255,255,255,0.03)',
                    color: scope === s ? C.blue : C.ice60,
                    fontSize: 11,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {s === 'all' ? t('explore.governance.scopeAll') : t('explore.governance.scopeMine')}
                </button>
              ))}
            </div>
          )}
        </div>
      </GlowCard>

      {loading && <LoadingBox h={180} label={t('common.loading')} />}

      {!loading && error && (
        <GlowCard style={{ padding: '20px 22px' }}>
          <div style={{ color: C.mars, fontSize: 12 }}>{error}</div>
        </GlowCard>
      )}

      {!loading && !error && (
        <>
          <GlowCard style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: 11, color: C.blue, letterSpacing: 2, fontWeight: 700, fontFamily: "'Orbitron', sans-serif", marginBottom: 14 }}>
              {t('explore.governance.sectionAssets')}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
              {statItems.map((item) => (
                <StatCard key={item.key} eyebrow={item.eyebrow} label={item.label} value={item.value} desc={item.desc} accent={item.accent} />
              ))}
            </div>

            <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {Object.entries(summary?.data_source_distribution || {}).map(([k, n]) => (
                <SourceModeBadge key={`src-${k}`} label={`${k}: ${n}`} />
              ))}
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {Object.entries(summary?.mars_year_distribution || {}).map(([k, n]) => (
                <SourceModeBadge key={`year-${k}`} label={`${k}: ${n}`} />
              ))}
            </div>
            <StatusDistributionChart distribution={summary?.status_distribution} />
          </GlowCard>

          <GlowCard style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 11, color: C.blue, letterSpacing: 2, fontWeight: 700, fontFamily: "'Orbitron', sans-serif", marginBottom: 12 }}>
              {t('explore.governance.assetList')}
            </div>
            {!groupedAssets.length && <div style={{ fontSize: 12, color: C.ice30, padding: '8px 0' }}>{t('common.noData')}</div>}
            {groupedAssets.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
                {groupedAssets.map((asset) => (
                  <AssetOverviewCard key={asset.key} asset={asset} active={selectedId === asset.latestUploadId} onClick={() => setSelectedId(asset.latestUploadId)} t={t} />
                ))}
              </div>
            )}
          </GlowCard>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>
            <GlowCard style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: 11, color: C.blue, letterSpacing: 2, fontWeight: 700, fontFamily: "'Orbitron', sans-serif", marginBottom: 10 }}>
                {t('explore.governance.qualityTitle')}
              </div>
              {detailLoading && <LoadingBox h={160} label={t('common.loading')} />}
              {!detailLoading && !quality && <div style={{ fontSize: 12, color: C.ice30 }}>{t('common.noData')}</div>}
              {!detailLoading && quality && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {selectedGroup && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <SourceModeBadge label={`${selectedGroup.yearLabel} · ${selectedGroup.dataType}`} />
                      <SourceModeBadge label={`${t('explore.governance.assetStatus')}: ${selectedGroup.dominantStatus}`} color={STATUS_COLORS[selectedGroup.dominantStatus] || C.ice60} />
                      <SourceModeBadge label={`${t('explore.governance.assetCoverage')}: ${fmtLsCoverage(selectedGroup.lsCoverage)}`} />
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: C.ice60 }}>{t('explore.governance.overallScore')}</span>
                    <span style={{ fontSize: 18, color: gradeColor(quality?.scores?.grade), fontWeight: 700 }}>
                      {fmtNum(quality?.scores?.overall, 1)} / 100 ({quality?.scores?.grade || '--'})
                    </span>
                  </div>

                  <MetricBar label={t('explore.governance.missingRateScore')} value={quality?.scores?.missing_rate_score} />
                  <MetricBar label={t('explore.governance.validRatioScore')} value={quality?.scores?.valid_ratio_score} />
                  <MetricBar label={t('explore.governance.variableScore')} value={quality?.scores?.variable_score} />
                  <MetricBar label={t('explore.governance.timeScore')} value={quality?.scores?.time_score} />
                  <MetricBar label={t('explore.governance.gridScore')} value={quality?.scores?.grid_score} />

                  <div style={{ marginTop: 4, fontSize: 11, color: C.ice30 }}>{`${t('explore.governance.missingRate')}: ${fmtPct(quality?.metrics?.missing_rate)}`}</div>
                  <div style={{ fontSize: 11, color: C.ice30 }}>{`${t('explore.governance.validRatio')}: ${fmtPct(quality?.metrics?.valid_value_ratio)}`}</div>

                  {(quality?.issues || []).length > 0 && (
                    <div
                      style={{
                        marginTop: 6,
                        border: `1px solid ${C.border}`,
                        borderRadius: 10,
                        padding: '10px 12px',
                        background: 'rgba(255,255,255,0.02)',
                      }}
                    >
                      <div style={{ fontSize: 11, color: C.ice30, marginBottom: 8 }}>{t('explore.governance.qualityIssues')}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {quality.issues.slice(0, 5).map((issue, idx) => (
                          <div key={`${issue}-${idx}`} style={{ fontSize: 11, color: C.ice60 }}>
                            {issue}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </GlowCard>

            <GlowCard style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: 11, color: C.blue, letterSpacing: 2, fontWeight: 700, fontFamily: "'Orbitron', sans-serif", marginBottom: 10 }}>
                {t('explore.governance.lineageTitle')}
              </div>
              {detailLoading && <LoadingBox h={160} label={t('common.loading')} />}
              {!detailLoading && !lineage && <div style={{ fontSize: 12, color: C.ice30 }}>{t('common.noData')}</div>}
              {!detailLoading && lineage && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                    <SourceModeBadge label={`${t('explore.governance.hash')}: ${lineage.file_hash || '--'}`} />
                    <SourceModeBadge label={`${t('explore.governance.sourceZone')}: ${lineage?.current_effective_data_source?.storage_zone || '--'}`} />
                    <SourceModeBadge label={`effective_status: ${lineage?.current_effective_data_source?.effective_status || '--'}`} />
                  </div>

                  <div style={{ fontSize: 12, color: C.ice60 }}>{`${t('explore.governance.uploader')}: ${lineage?.uploader?.username || lineage?.uploader?.email || '--'}`}</div>
                  <div style={{ fontSize: 12, color: C.ice60 }}>{`${t('explore.governance.reviewer')}: ${lineage?.reviewer?.username || lineage?.reviewer?.email || '--'}`}</div>
                  <div style={{ fontSize: 12, color: C.ice60 }}>{`${t('explore.governance.createdAt')}: ${lineage?.timestamps?.uploaded_at || '--'}`}</div>
                  <div style={{ fontSize: 12, color: C.ice60 }}>{`${t('explore.governance.reviewedAt')}: ${lineage?.timestamps?.reviewed_at || '--'}`}</div>
                  <div style={{ fontSize: 12, color: C.ice60, wordBreak: 'break-all' }}>{`effective_path: ${lineage?.current_effective_data_source?.effective_path || '--'}`}</div>

                  <div style={{ marginTop: 6, fontSize: 11, color: C.ice30 }}>{t('explore.governance.eventTimeline')}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(lineage.events || []).map((evt, idx) => (
                      <div
                        key={`${evt.type}-${idx}`}
                        style={{
                          border: `1px solid ${C.border}`,
                          borderRadius: 8,
                          padding: '8px 10px',
                          background: 'rgba(255,255,255,0.02)',
                        }}
                      >
                        <div style={{ fontSize: 11, color: STATUS_COLORS[evt.type] || C.ice60 }}>{`${evt.type}${evt.at ? ` | ${evt.at}` : ''}`}</div>
                        <div style={{ marginTop: 3, fontSize: 11, color: C.ice30 }}>
                          {(() => {
                            const actor = [evt.actor || '', evt.actor_role ? `[${evt.actor_role}]` : '', evt.actor_email ? `<${evt.actor_email}>` : '']
                              .filter(Boolean)
                              .join(' ');
                            const detail = evt.detail || '--';
                            return actor ? `${actor} | ${detail}` : detail;
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </GlowCard>
          </div>
        </>
      )}
    </div>
  );
}
