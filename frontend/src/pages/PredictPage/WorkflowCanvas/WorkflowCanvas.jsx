import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import C from '../../../constants/colors';
import { useSettings } from '../../../contexts/SettingsContext';
import { useToast } from '../../../contexts/ToastContext';
import {
  fetchErrorDistribution,
  fetchPermutationImportance,
  fetchPredictMetrics,
  runPrediction,
} from '../../../services/api';
import { setPredictCache } from '../../../stores/predictCache';
import PredictDisplay from '../PredictDisplay';
import PredictMetrics from '../PredictMetrics';
import ErrorDistributionChart from '../ErrorDistributionChart';
import PermutationImportanceChart from '../PermutationImportanceChart';
import ShapleyImportanceChart from '../ShapleyImportanceChart';
import { TRIPTYCH_PANEL_DEFS, VIEW_MODE_IDS } from '../PredictComponents';
import NodePalette from './NodePalette';
import WorkflowConfigPanel from './WorkflowConfigPanel';
import WorkflowInspector from './WorkflowInspector';
import WorkflowNode from './WorkflowNode';
import {
  getDefaultWorkflowConfig,
  migrateWorkflowConfigFromGraph,
  normalizeWorkflowConfig,
} from './workflowConfig';
import { deleteWorkflowSelection } from './workflowDelete';
import {
  compilePredictionWorkflow,
  compileTrainingDraft,
  validateWorkflowGraph,
} from './workflowCompiler';
import { autoArrangeWorkflow, createInitialWorkflow } from './workflowLayout';
import {
  WORKFLOW_NODE_TYPES,
  WORKFLOW_OUTPUTS,
  getWorkflowType,
  isValidWorkflowEdge,
} from './workflowSchema';
import {
  createWorkflowText,
  getTemplateLabel,
  getWorkflowErrorMessage,
} from './workflowText';
import {
  nextWorkflowSelection,
  selectionFromReactFlowSelection,
} from './workflowSelection';

const nodeTypes = { workflowNode: WorkflowNode };

function workflowEdgeStyle(active = false) {
  return {
    type: 'bezier',
    animated: active,
    style: {
      stroke: active ? 'rgba(91,235,238,0.88)' : 'rgba(194,215,222,0.56)',
      strokeWidth: active ? 2.4 : 1.6,
    },
  };
}

function resolveInitialState(initialGraph, initialConfig) {
  const graph = initialGraph || createInitialWorkflow();
  const config = normalizeWorkflowConfig(initialConfig || getDefaultWorkflowConfig());
  return migrateWorkflowConfigFromGraph(graph, config);
}

function WorkflowCanvasInner({ initialGraph, initialConfig }) {
  const { settings } = useSettings();
  const { showToast } = useToast();
  const reactFlowWrapper = useRef(null);
  const { screenToFlowPosition } = useReactFlow();
  const initialState = useMemo(
    () => resolveInitialState(initialGraph, initialConfig),
    [initialGraph, initialConfig],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(initialState.graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialState.graph.edges);
  const [workflowConfig, setWorkflowConfigState] = useState(initialState.config);
  const [selection, setSelectionState] = useState({ nodeId: null, edgeIds: [] });
  const [results, setResults] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [errorDistData, setErrorDistData] = useState(null);
  const [pfiData, setPfiData] = useState(null);
  const [activeHorizon, setActiveHorizon] = useState(0);
  const [viewMode, setViewMode] = useState('triptych');
  const [loading, setLoading] = useState(false);
  const [pfiLoading, setPfiLoading] = useState(false);
  const [runError, setRunError] = useState('');
  const [showShapley, setShowShapley] = useState(false);

  const precision = settings.precision;
  const ozoneUnit = settings.units.ozone;
  const text = useMemo(() => createWorkflowText(settings.language), [settings.language]);
  const isLight = settings.theme === 'light';
  const plotTextColor = isLight ? 'rgba(23,33,47,0.96)' : 'rgba(236,244,255,0.96)';
  const plotText60 = isLight ? 'rgba(23,33,47,0.76)' : 'rgba(214,228,244,0.78)';
  const plotGridColor = isLight ? 'rgba(23,33,47,0.12)' : 'rgba(160,196,240,0.16)';
  const selectedNodeId = selection.nodeId;
  const selectedEdgeIds = selection.edgeIds;

  const setWorkflowSelection = useCallback((nextSelection) => {
    setSelectionState((current) => nextWorkflowSelection(current, nextSelection));
  }, []);

  const updateWorkflowConfig = useCallback((patch) => {
    setWorkflowConfigState((current) => normalizeWorkflowConfig({
      ...current,
      ...patch,
      training: {
        ...(current?.training || {}),
        ...(patch.training || {}),
      },
    }));
  }, []);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) || null,
    [nodes, selectedNodeId],
  );
  const hasSelection = Boolean(selectedNodeId) || selectedEdgeIds.length > 0;

  const predictionValidation = useMemo(
    () => validateWorkflowGraph(nodes, edges, 'prediction'),
    [nodes, edges],
  );

  const predictionConfig = useMemo(() => {
    try {
      return compilePredictionWorkflow(nodes, edges, workflowConfig);
    } catch {
      return null;
    }
  }, [edges, nodes, workflowConfig]);

  const trainingDraft = useMemo(() => {
    try {
      return compileTrainingDraft(nodes, edges, workflowConfig);
    } catch {
      return null;
    }
  }, [edges, nodes, workflowConfig]);

  const enabledOutputs = new Set(predictionConfig?.enabledOutputs || []);

  useEffect(() => {
    setPredictCache({
      workflowGraph: {
        nodes,
        edges,
      },
      workflowConfig,
    });
  }, [edges, nodes, workflowConfig]);

  const markOutputs = useCallback((status, outputIds = []) => {
    setNodes((current) => current.map((node) => {
      if (getWorkflowType(node) !== WORKFLOW_NODE_TYPES.ANALYSIS_OUTPUT) return node;
      if (outputIds.length > 0 && !outputIds.includes(node.data?.outputId)) return node;
      return {
        ...node,
        data: {
          ...node.data,
          status,
          validationError: status === 'failed' ? 'runFailed' : '',
        },
      };
    }));
  }, [setNodes]);

  const onConnect = useCallback((connection) => {
    const source = nodes.find((node) => node.id === connection.source);
    const target = nodes.find((node) => node.id === connection.target);
    if (!isValidWorkflowEdge(getWorkflowType(source), getWorkflowType(target))) {
      showToast(text.toasts.invalidConnection, 'error');
      return;
    }
    setEdges((current) => addEdge({ ...connection, ...workflowEdgeStyle(false) }, current));
  }, [nodes, setEdges, showToast, text]);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData('application/aresvision-workflow-node');
    if (!raw) return;
    const template = JSON.parse(raw);
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const id = `${template.workflowType}-${Date.now()}`;
    const nextNode = {
      id,
      type: 'workflowNode',
      position,
      data: {
        workflowType: template.workflowType,
        label: getTemplateLabel(template, text),
        status: 'idle',
        ...(template.data || {}),
      },
    };
    setNodes((current) => [...current, nextNode]);
  }, [screenToFlowPosition, setNodes, text]);

  const handleUpdateNode = useCallback((nodeId, patch) => {
    setNodes((current) => current.map((node) => (
      node.id === nodeId
        ? { ...node, data: { ...node.data, ...patch, validationError: '' } }
        : node
    )));
  }, [setNodes]);

  const handleReset = useCallback(() => {
    const initial = createInitialWorkflow();
    const nextConfig = getDefaultWorkflowConfig();
    setNodes(initial.nodes);
    setEdges(initial.edges);
    setWorkflowConfigState(nextConfig);
    setWorkflowSelection({ nodeId: null, edgeIds: [] });
    setResults(null);
    setMetrics(null);
    setErrorDistData(null);
    setPfiData(null);
    setRunError('');
    setPredictCache({ workflowGraph: initial, workflowConfig: nextConfig });
  }, [setEdges, setNodes, setWorkflowSelection]);

  const handleAutoArrange = useCallback(() => {
    setNodes((current) => autoArrangeWorkflow(current));
  }, [setNodes]);

  const handleDeleteSelection = useCallback(() => {
    if (!selectedNodeId && selectedEdgeIds.length === 0) return;
    const next = deleteWorkflowSelection(nodes, edges, {
      nodeIds: selectedNodeId ? [selectedNodeId] : [],
      edgeIds: selectedEdgeIds,
    });
    setNodes(next.nodes);
    setEdges(next.edges);
    setWorkflowSelection({ nodeId: null, edgeIds: [] });
  }, [edges, nodes, selectedEdgeIds, selectedNodeId, setEdges, setNodes, setWorkflowSelection]);

  const handleNodeClick = useCallback((_, node) => {
    setWorkflowSelection({ nodeId: node.id, edgeIds: [] });
  }, [setWorkflowSelection]);

  const handleEdgeClick = useCallback((_, edge) => {
    setWorkflowSelection({ nodeId: null, edgeIds: [edge.id] });
  }, [setWorkflowSelection]);

  const handleSelectionChange = useCallback((reactFlowSelection) => {
    setWorkflowSelection(selectionFromReactFlowSelection(reactFlowSelection));
  }, [setWorkflowSelection]);

  const handlePaneClick = useCallback(() => {
    setWorkflowSelection({ nodeId: null, edgeIds: [] });
  }, [setWorkflowSelection]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      const target = event.target;
      const isEditable = target?.tagName === 'INPUT'
        || target?.tagName === 'TEXTAREA'
        || target?.tagName === 'SELECT'
        || target?.isContentEditable;
      if (isEditable) return;
      if (!selectedNodeId && selectedEdgeIds.length === 0) return;
      event.preventDefault();
      handleDeleteSelection();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDeleteSelection, selectedEdgeIds.length, selectedNodeId]);

  const handleRunPrediction = useCallback(async () => {
    let compiled;
    try {
      compiled = compilePredictionWorkflow(nodes, edges, workflowConfig);
    } catch (error) {
      const message = getWorkflowErrorMessage(error, text);
      setRunError(message);
      showToast(message, 'error');
      return;
    }

    setRunError('');
    setLoading(true);
    setPfiLoading(true);
    setResults(null);
    setMetrics(null);
    setErrorDistData(null);
    setPfiData(null);
    markOutputs('running', compiled.enabledOutputs);

    try {
      const needsMetrics = compiled.enabledOutputs.includes(WORKFLOW_OUTPUTS.METRICS);
      const [predResult, metricsResult] = await Promise.all([
        runPrediction(compiled.body, { dataSource: compiled.dataSource }),
        needsMetrics ? fetchPredictMetrics(compiled.body, { dataSource: compiled.dataSource }) : Promise.resolve(null),
      ]);

      let errorDistResult = null;
      let pfiResult = null;
      if (compiled.dataSource === 'default') {
        const auxJobs = [];
        if (compiled.enabledOutputs.includes(WORKFLOW_OUTPUTS.ERROR_DISTRIBUTION)) {
          auxJobs.push(fetchErrorDistribution(compiled.selectedVariables));
        } else {
          auxJobs.push(Promise.resolve(null));
        }
        if (compiled.enabledOutputs.includes(WORKFLOW_OUTPUTS.PFI)) {
          auxJobs.push(fetchPermutationImportance(compiled.selectedVariables));
        } else {
          auxJobs.push(Promise.resolve(null));
        }
        [errorDistResult, pfiResult] = await Promise.all(auxJobs);
      }

      setResults(predResult);
      setMetrics(metricsResult);
      setErrorDistData(errorDistResult);
      setPfiData(pfiResult);
      setActiveHorizon(0);
      markOutputs('success', compiled.enabledOutputs);
      showToast(text.toasts.completed, 'success');
    } catch (error) {
      const message = error.message || text.errors.predictionFailed;
      setRunError(message);
      markOutputs('failed', compiled.enabledOutputs);
      showToast(message, 'error');
    } finally {
      setLoading(false);
      setPfiLoading(false);
    }
  }, [edges, markOutputs, nodes, showToast, text, workflowConfig]);

  const handleSendToTraining = useCallback(() => {
    let draft;
    try {
      draft = compileTrainingDraft(nodes, edges, workflowConfig);
    } catch (error) {
      const message = getWorkflowErrorMessage(error, text);
      setRunError(message);
      showToast(message, 'error');
      return;
    }
    sessionStorage.setItem('aresvision_training_draft', JSON.stringify({
      ...draft,
      createdAt: new Date().toISOString(),
    }));
    window.history.pushState(null, '', '#/training?from=workflow');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, [edges, nodes, showToast, text, workflowConfig]);

  const step = results ? Math.min(activeHorizon, (results.horizon || 1) - 1) : 0;
  const truthField = results?.ground_truth?.[step] ?? null;
  const predField = results?.prediction?.[step] ?? null;
  const residField = results?.residual?.[step] ?? null;
  const stepLs = results?.ls_values?.[step];
  const stepLabel = (ls) => (ls != null ? ` · Ls=${ls.toFixed(3)}°` : '');
  const viewModes = VIEW_MODE_IDS.map((id) => ({ id, label: text.results.viewModes[id] || id }));
  const triptychPanels = TRIPTYCH_PANEL_DEFS.map((panel) => ({
    ...panel,
    title: text.results.panels[panel.key] || panel.title,
  }));

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <WorkflowConfigPanel config={workflowConfig} onUpdateConfig={updateWorkflowConfig} />

      <div style={{ display: 'grid', gridTemplateColumns: '250px minmax(0, 1fr) 300px', gap: 16, alignItems: 'stretch' }}>
        <NodePalette />

        <section
          style={{
            minHeight: 680,
            borderRadius: 20,
            border: `1px solid ${C.border}`,
            background: 'linear-gradient(180deg, rgba(10,21,25,0.96), rgba(8,14,18,0.98))',
            boxShadow: 'var(--card-shadow)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              height: 58,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '0 16px',
              borderBottom: `1px solid ${C.border}`,
              background: 'rgba(8,16,20,0.78)',
            }}
          >
            <div>
              <div style={{ color: C.ice, fontWeight: 800, fontFamily: 'var(--font-display)', fontSize: 'calc(15px * var(--font-scale, 1))' }}>
                {text.canvas.title}
              </div>
              <div style={{ color: C.ice50, fontSize: 'calc(10px * var(--font-scale, 1))', marginTop: 3 }}>
                {text.canvas.subtitle}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {[
                { label: loading ? text.actions.running : text.actions.run, onClick: handleRunPrediction, primary: true, disabled: loading },
                { label: text.actions.sendToTraining, onClick: handleSendToTraining },
                { label: text.actions.autoArrange, onClick: handleAutoArrange },
                { label: text.actions.deleteSelection, onClick: handleDeleteSelection, danger: true, disabled: !hasSelection },
                { label: text.actions.reset, onClick: handleReset },
              ].map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  style={{
                    minHeight: 38,
                    padding: '0 13px',
                    borderRadius: 11,
                    border: action.primary ? 'none' : `1px solid ${action.danger ? 'rgba(217,92,92,0.40)' : C.borderStrong}`,
                    background: action.primary ? C.mars : action.danger ? 'rgba(217,92,92,0.12)' : C.bgMuted,
                    color: action.primary ? '#fff' : C.ice,
                    fontSize: 'calc(11px * var(--font-scale, 1))',
                    fontWeight: 800,
                    cursor: action.disabled ? 'not-allowed' : 'pointer',
                    opacity: action.disabled ? 0.62 : 1,
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          <div ref={reactFlowWrapper} style={{ height: 622 }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
              onSelectionChange={handleSelectionChange}
              onPaneClick={handlePaneClick}
              fitView
              connectionLineStyle={{ stroke: 'rgba(91,235,238,0.68)', strokeWidth: 2 }}
              defaultEdgeOptions={workflowEdgeStyle(false)}
              style={{ background: 'transparent' }}
            >
              <Background color="rgba(91,235,238,0.22)" gap={18} size={1.2} />
              <Controls />
              <MiniMap
                pannable
                zoomable
                nodeColor={(node) => node.data?.color || 'rgba(91,235,238,0.78)'}
                maskColor="rgba(0,0,0,0.42)"
                style={{ background: 'rgba(6,12,16,0.88)', border: `1px solid ${C.border}` }}
              />
            </ReactFlow>
          </div>
        </section>

        <WorkflowInspector
          selectedNode={selectedNode}
          onUpdateNode={handleUpdateNode}
          predictionConfig={predictionConfig}
          trainingDraft={trainingDraft}
          validation={predictionValidation}
          runError={runError}
          onOpenShap={() => setShowShapley(true)}
        />
      </div>

      {(results || loading) ? (
        <div style={{ display: 'grid', gap: 18 }}>
          {enabledOutputs.has(WORKFLOW_OUTPUTS.TRIPTYCH) ? (
            <PredictDisplay
              viewMode={viewMode}
              setViewMode={setViewMode}
              VIEW_MODES={viewModes}
              results={results}
              activeHorizon={activeHorizon}
              setActiveHorizon={setActiveHorizon}
              loading={loading}
              truthField={truthField}
              predField={predField}
              residField={residField}
              stepLs={stepLs}
              stepLabel={stepLabel}
              setFullscreen3D={() => {}}
              TRIPTYCH_PANELS={triptychPanels}
            />
          ) : null}

          {enabledOutputs.has(WORKFLOW_OUTPUTS.METRICS) ? (
            <PredictMetrics loading={loading} metrics={metrics} precision={precision} ozoneUnit={ozoneUnit} />
          ) : null}

          {enabledOutputs.has(WORKFLOW_OUTPUTS.ERROR_DISTRIBUTION) ? (
            <ErrorDistributionChart
              data={errorDistData}
              loading={loading}
              isLight={isLight}
              plotTextColor={plotTextColor}
              plotText60={plotText60}
              plotGridColor={plotGridColor}
            />
          ) : null}

          {enabledOutputs.has(WORKFLOW_OUTPUTS.PFI) ? (
            <PermutationImportanceChart
              data={pfiData}
              loading={pfiLoading}
              plotTextColor={plotTextColor}
              plotText60={plotText60}
              plotGridColor={plotGridColor}
            />
          ) : null}
        </div>
      ) : null}

      {showShapley ? (
        <ShapleyImportanceChart
          isLight={isLight}
          plotTextColor={plotTextColor}
          plotGridColor={plotGridColor}
          onClose={() => setShowShapley(false)}
          mode="gradient"
        />
      ) : null}
    </div>
  );
}

export default function WorkflowCanvas({ initialGraph, initialConfig }) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner initialGraph={initialGraph} initialConfig={initialConfig} />
    </ReactFlowProvider>
  );
}
