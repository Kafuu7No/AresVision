import { useState, useCallback } from 'react';
import C from '../constants/colors';
import { useT } from '../i18n';
import { useSettings } from '../contexts/SettingsContext';
import SectionTitle from '../components/SectionTitle';

import { runPrediction, fetchPredictMetrics, fetchPerformanceCurve, fetchPerformanceComparison } from '../services/api';

// Sub-components
import { VARIABLE_DEFS, VIEW_MODE_IDS, TRIPTYCH_PANEL_DEFS } from './PredictPage/PredictComponents';
import PredictSidebar from './PredictPage/PredictSidebar';
import PredictDisplay from './PredictPage/PredictDisplay';
import PredictMetrics from './PredictPage/PredictMetrics';
import PredictPerformance from './PredictPage/PredictPerformance';
import PredictFullscreenHUD from './PredictPage/PredictFullscreenHUD';

export default function PredictPage() {
  const t = useT();
  const { settings } = useSettings();
  const precision = settings.precision;
  const ozoneUnit = settings.units.ozone;
  const isLight = settings.theme === 'light';

  // Constants mapping
  const VARIABLES = VARIABLE_DEFS.map(v => ({ ...v, label: t(`predict.variables.${v.id}`) }));
  const VIEW_MODES = VIEW_MODE_IDS.map(id => ({ id, label: t(`predict.viewModes.${id}`) }));
  const TRIPTYCH_PANELS = TRIPTYCH_PANEL_DEFS.map(p => ({ ...p, title: t(`predict.panels.${p.key}`) }));

  // Style Tokens (for plots)
  const plotTextColor  = isLight ? 'rgba(26,26,46,0.5)'  : 'rgba(232,237,243,0.3)';
  const plotText60     = isLight ? 'rgba(26,26,46,0.65)' : 'rgba(232,237,243,0.6)';
  const plotGridColor  = isLight ? 'rgba(26,26,46,0.08)' : 'rgba(255,255,255,0.05)';

  // --- State ---
  const [selectedVars, setSelectedVars] = useState(VARIABLE_DEFS.map((v) => v.id));
  const [predStep, setPredStep] = useState(3);
  const [lsStart, setLsStart] = useState(90);
  const [marsYear, setMarsYear] = useState(27);
  const [activeHorizon, setActiveHorizon] = useState(0);
  const [viewMode, setViewMode] = useState('triptych');

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);

  const [fullscreen3D, setFullscreen3D] = useState(null); // { fieldData, colorMode }

  const [performanceData, setPerformanceData] = useState(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [activePerfMetric, setActivePerfMetric] = useState('r2');
  
  const [compareConfigs, setCompareConfigs] = useState([]);
  const [selectedCompareIds, setSelectedCompareIds] = useState([]);
  const [activeCompareId, setActiveCompareId] = useState(null);

  // --- Handlers ---
  const toggleVar = (id) => {
    setSelectedVars((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handlePredict = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResults(null);
    setMetrics(null);

    const body = {
      selected_variables: selectedVars,
      horizon: predStep,
      ls_start: lsStart,
      mars_year: marsYear,
    };

    try {
      const [predResult, metricsResult] = await Promise.all([
        runPrediction(body),
        fetchPredictMetrics(body),
      ]);
      setResults(predResult);
      setMetrics(metricsResult);
      setActiveHorizon(0);
    } catch (e) {
      setError(e.message || t('predict.errorPrefix'));
    } finally {
      setLoading(false);
    }
  }, [selectedVars, predStep, lsStart, marsYear, t]);

  const handleFetchPerformance = useCallback(async () => {
    setPerfLoading(true);
    try {
      if (selectedCompareIds.length > 1) {
        const configs = compareConfigs
          .filter(c => selectedCompareIds.includes(c.id))
          .map(c => c.vars);
        const res = await fetchPerformanceComparison(configs);
        setPerformanceData(res);
      } else {
        const body = {
          selected_variables: selectedVars,
          horizon: predStep,
          ls_start: lsStart,
          mars_year: marsYear,
        };
        const res = await fetchPerformanceCurve(body);
        const key = selectedVars.length === 0 ? 'baseline' : 'current';
        setPerformanceData({ results: { [key]: res } });
      }
    } catch (e) {
      console.error('Fetch performance error:', e);
    } finally {
      setPerfLoading(false);
    }
  }, [selectedVars, predStep, lsStart, marsYear, selectedCompareIds, compareConfigs]);

  // --- Derived ---
  const step = results ? Math.min(activeHorizon, (results.horizon || 1) - 1) : 0;
  const truthField = results?.ground_truth?.[step] ?? null;
  const predField = results?.prediction?.[step] ?? null;
  const residField = results?.residual?.[step] ?? null;
  const stepLs = results?.ls_values?.[step];

  const stepLabel = (ls) => ls != null ? ` · Ls=${ls.toFixed(3)}°` : '';

  return (
    <div className="page-enter" style={{ padding: '100px 40px 60px', maxWidth: 1400, margin: '0 auto' }}>
      <SectionTitle title={t('predict.title')} subtitle={t('predict.subtitle')} />

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24 }}>
        <PredictSidebar
          loading={loading}
          error={error}
          marsYear={marsYear}
          setMarsYear={setMarsYear}
          lsStart={lsStart}
          setLsStart={setLsStart}
          predStep={predStep}
          setPredStep={setPredStep}
          selectedVars={selectedVars}
          toggleVar={toggleVar}
          VARIABLES={VARIABLES}
          handlePredict={handlePredict}
          compareConfigs={compareConfigs}
          selectedCompareIds={selectedCompareIds}
          setSelectedCompareIds={setSelectedCompareIds}
          setCompareConfigs={setCompareConfigs}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <PredictDisplay
            viewMode={viewMode}
            setViewMode={setViewMode}
            VIEW_MODES={VIEW_MODES}
            results={results}
            activeHorizon={activeHorizon}
            setActiveHorizon={setActiveHorizon}
            loading={loading}
            truthField={truthField}
            predField={predField}
            residField={residField}
            stepLs={stepLs}
            stepLabel={stepLabel}
            setFullscreen3D={setFullscreen3D}
            TRIPTYCH_PANELS={TRIPTYCH_PANELS}
          />

          <PredictMetrics
            loading={loading}
            metrics={metrics}
            results={results}
            precision={precision}
            ozoneUnit={ozoneUnit}
            activeHorizon={activeHorizon}
            setActiveHorizon={setActiveHorizon}
            lsStart={lsStart}
            marsYear={marsYear}
          />

          <PredictPerformance
            performanceData={performanceData}
            perfLoading={perfLoading}
            activePerfMetric={activePerfMetric}
            setActivePerfMetric={setActivePerfMetric}
            handleFetchPerformance={handleFetchPerformance}
            compareConfigs={compareConfigs}
            activeCompareId={activeCompareId}
            setActiveCompareId={setActiveCompareId}
            plotTextColor={plotTextColor}
            plotText60={plotText60}
            plotGridColor={plotGridColor}
            precision={precision}
          />
        </div>
      </div>

      <PredictFullscreenHUD
        fullscreen3D={fullscreen3D}
        setFullscreen3D={setFullscreen3D}
        truthField={truthField}
        stepLs={stepLs}
        step={activeHorizon}
        precision={precision}
        ozoneUnit={ozoneUnit}
      />
    </div>
  );
}
