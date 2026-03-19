import { useState, useEffect, useRef, useCallback } from 'react';
import C from '../constants/colors';
import { useT } from '../i18n';
import { useSettings } from '../contexts/SettingsContext';
import SectionTitle from '../components/SectionTitle';
import GlowCard from '../components/GlowCard';
import {
  fetchGlobeData,
  fetchSeasonalHeatmap,
  fetchSeasonalBands,
  fetchCorrelation,
} from '../services/api';

// Sub-components
import { LoadingBox } from './ExplorePage/ExploreComponents';
import HeatmapCanvas from './ExplorePage/HeatmapCanvas';
import LineChart from './ExplorePage/LineChart';
import GlobePlot from './ExplorePage/GlobePlot';
import CorrelationChart from './ExplorePage/CorrelationChart';

export default function ExplorePage() {
  const t = useT();
  const { settings } = useSettings();
  const [lsValue, setLsValue] = useState(90);
  const [marsYear, setMarsYear] = useState(27);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef(null);
  const abortRef = useRef(null);

  const [globeData, setGlobeData] = useState(null);
  const [heatmapData, setHeatmapData] = useState(null);
  const [bandsData, setBandsData] = useState(null);
  const [corrData, setCorrData] = useState(null);
  const [loading, setLoading] = useState({});

  // 加载地球数据（带防抖 AbortController）
  const loadGlobe = useCallback(async (ls, year) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    setLoading(prev => ({ ...prev, globe: true }));
    try {
      const d = await fetchGlobeData(year, ls, signal);
      if (!signal.aborted) {
        setGlobeData(d);
        setLoading(prev => ({ ...prev, globe: false }));
      }
    } catch (e) {
      if (!signal.aborted) {
        console.error('Globe data error:', e);
        setLoading(prev => ({ ...prev, globe: false }));
      }
    }
  }, []);

  // 加载静态数据（热力图/折线图/相关矩阵）
  const loadStaticData = useCallback(async (year) => {
    setLoading(prev => ({ ...prev, heatmap: true, bands: true, corr: true }));
    try {
      const [hm, bd, cr] = await Promise.all([
        fetchSeasonalHeatmap(year),
        fetchSeasonalBands(year),
        fetchCorrelation(year),
      ]);
      setHeatmapData(hm);
      setBandsData(bd);
      setCorrData(cr);
    } catch (e) {
      console.error('Static data error:', e);
    }
    setLoading(prev => ({ ...prev, heatmap: false, bands: false, corr: false }));
  }, []);

  // marsYear 变化：重载静态数据
  useEffect(() => {
    setHeatmapData(null);
    setBandsData(null);
    setCorrData(null);
    loadStaticData(marsYear);
  }, [marsYear, loadStaticData]);

  // lsValue 或 marsYear 变化：重载地球图
  useEffect(() => {
    loadGlobe(lsValue, marsYear);
  }, [lsValue, marsYear, loadGlobe]);

  // 播放动画
  useEffect(() => {
    if (playing) {
      timerRef.current = setInterval(() => {
        setLsValue(v => {
          if (v >= 355) { setPlaying(false); return 0; }
          return v + 5;
        });
      }, 1200);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [playing]);

  const seasonName =
    lsValue < 90  ? t('common.season.spring') :
    lsValue < 180 ? t('common.season.summer') :
    lsValue < 270 ? t('common.season.autumn') : t('common.season.winter');

  return (
    <div className="page-enter" style={{ padding: '100px 40px 60px', maxWidth: 1400, margin: '0 auto' }}>
      <SectionTitle title={t('explore.title')} subtitle={t('explore.subtitle')} />

      {/* ─── 控制栏 ─── */}
      <GlowCard style={{
        padding: '16px 24px', marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontSize: 11, color: C.ice60,
            fontFamily: "'Orbitron', sans-serif", letterSpacing: 1,
          }}>MARS YEAR</span>
          <select
            value={marsYear}
            onChange={e => setMarsYear(Number(e.target.value))}
            style={{
              background: 'var(--border)', border: `1px solid ${C.border}`,
              borderRadius: 8, padding: '6px 12px', color: C.ice, fontSize: 13,
            }}
          >
            <option value={27}>MY 27</option>
            <option value={28}>MY 28</option>
          </select>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontSize: 11, color: C.ice60, fontFamily: "'Orbitron', sans-serif",
            letterSpacing: 1, whiteSpace: 'nowrap',
          }}>Ls</span>
          <input
            type="range" min={0} max={360} step={5} value={lsValue}
            onChange={e => setLsValue(Number(e.target.value))}
            style={{ flex: 1, accentColor: C.mars }}
          />
          <span style={{
            fontSize: 14, fontWeight: 700, color: C.mars,
            fontFamily: "'Orbitron', sans-serif", minWidth: 50, textAlign: 'right',
          }}>
            {lsValue}°
          </span>
        </div>

        <button
          onClick={() => setPlaying(!playing)}
          style={{
            background: playing ? 'rgba(199,91,57,0.2)' : 'rgba(74,158,255,0.15)',
            border: `1px solid ${playing ? C.mars : C.blue}`,
            borderRadius: 8, padding: '8px 20px',
            color: playing ? C.mars : C.blue,
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            fontFamily: "'Orbitron', sans-serif", letterSpacing: 1,
          }}
        >
          {playing ? `⏸ ${t('common.pause')}` : `▶ ${t('common.play')}`}
        </button>

        <div style={{ fontSize: 12, color: C.ice30 }}>{seasonName}</div>
      </GlowCard>

      {/* ─── 主图表区 ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* 全球臭氧图 */}
        <GlowCard breathe style={{ padding: 20 }}>
          <div style={{ minHeight: 56, marginBottom: 8, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span style={{
              fontSize: 11, fontWeight: 700, color: C.mars,
              fontFamily: "'Orbitron', sans-serif", letterSpacing: 2,
            }}>{t('explore.ozoneMap')}</span>
            <span style={{ fontSize: 10, color: C.ice30, marginTop: 4 }}>
              {globeData?.ls != null ? `Ls = ${Math.round(globeData.ls)}°` : '—'}
              {globeData?.points ? ` · ${globeData.points.length} pts` : ''}
            </span>
          </div>
          {loading.globe && !globeData
            ? <LoadingBox h={300} label={t('common.loadingGlobe')} />
            : <GlobePlot data={globeData} />}
        </GlowCard>

        {/* 热力图 */}
        <GlowCard breathe style={{ padding: 20 }}>
          <div style={{ minHeight: 56, marginBottom: 8, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span style={{
              fontSize: 11, fontWeight: 700, color: C.blue,
              fontFamily: "'Orbitron', sans-serif", letterSpacing: 2,
            }}>{t('explore.heatmapTitle')}</span>
            <span style={{ fontSize: 10, color: C.ice30, marginTop: 4 }}>
              {t('explore.heatmapSub', { year: marsYear })}
            </span>
          </div>
          {loading.heatmap && !heatmapData
            ? <LoadingBox h={300} />
            : <HeatmapCanvas data={heatmapData} year={marsYear} h={300} />}
        </GlowCard>

        {/* 折线图 */}
        <GlowCard breathe style={{ padding: 20, gridColumn: 'span 2' }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: C.blue,
            fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 12,
          }}>
            {t('explore.bandsTitle')}
          </div>
          {loading.bands && !bandsData
            ? <LoadingBox h={240} />
            : <LineChart data={bandsData} year={marsYear} h={220} />}
        </GlowCard>
      </div>

      {/* ─── 相关矩阵 ─── */}
      <div style={{ marginTop: 32 }}>
        <GlowCard breathe style={{ padding: 24 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: C.blue,
            fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 4,
          }}>
            {t('explore.corrTitle')}
          </div>
          <div style={{ fontSize: 10, color: C.ice30, marginBottom: 16 }}>
            {t('explore.corrSub', { year: marsYear })}
          </div>
          {loading.corr && !corrData
            ? <LoadingBox h={350} />
            : <CorrelationChart data={corrData} year={marsYear} h={350} />}
        </GlowCard>
      </div>
    </div>
  );
}
