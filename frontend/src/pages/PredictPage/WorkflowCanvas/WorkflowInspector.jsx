import C from '../../../constants/colors';
import { useT } from '../../../i18n';
import { useSettings } from '../../../contexts/SettingsContext';
import {
  CHANNEL_BY_VARIABLE,
  WORKFLOW_NODE_TYPES,
  WORKFLOW_OUTPUTS,
} from './workflowSchema';
import {
  createWorkflowText,
  getOutputLabel,
  getWorkflowErrorMessage,
  getWorkflowNodeLabel,
} from './workflowText';

function SummaryRow({ label, value, accent = C.ice }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
      <span style={{ color: C.ice50, fontSize: 'calc(11px * var(--font-scale, 1))' }}>{label}</span>
      <span
        style={{
          color: accent,
          fontSize: 'calc(12px * var(--font-scale, 1))',
          fontWeight: 800,
          textAlign: 'right',
          lineHeight: 1.45,
          wordBreak: 'break-word',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function inputStyle() {
  return {
    width: '100%',
    minHeight: 40,
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    background: C.bgMuted,
    color: C.ice,
    padding: '0 11px',
    fontSize: 'calc(12px * var(--font-scale, 1))',
    fontFamily: 'var(--font-body)',
    outline: 'none',
    boxSizing: 'border-box',
  };
}

export default function WorkflowInspector({
  selectedNode,
  onUpdateNode,
  predictionConfig,
  trainingDraft,
  validation,
  runError,
  onOpenShap,
}) {
  const t = useT();
  const { settings } = useSettings();
  const text = createWorkflowText(settings.language);

  const updateData = (patch) => {
    if (!selectedNode) return;
    onUpdateNode(selectedNode.id, patch);
  };

  const renderEditor = () => {
    if (!selectedNode) return null;
    const data = selectedNode.data || {};
    const type = data.workflowType;

    if (type === WORKFLOW_NODE_TYPES.PREDRNN_MODEL) {
      return (
        <label style={{ display: 'grid', gap: 7 }}>
          <span style={{ color: C.ice50, fontSize: 'calc(11px * var(--font-scale, 1))', fontWeight: 700 }}>
            {text.inspector.fields.predictionHorizon}
          </span>
          <input
            type="number"
            min="1"
            max="3"
            value={data.horizon ?? 3}
            onChange={(event) => updateData({ horizon: Math.max(1, Math.min(3, Number(event.target.value) || 1)) })}
            style={inputStyle()}
          />
          <span style={{ color: C.ice40, fontSize: 'calc(10px * var(--font-scale, 1))', lineHeight: 1.45 }}>
            {text.inspector.hints.predictionHorizon}
          </span>
        </label>
      );
    }

    if (type === WORKFLOW_NODE_TYPES.ANALYSIS_OUTPUT) {
      return (
        <div style={{ display: 'grid', gap: 10 }}>
          <SummaryRow label={text.inspector.fields.output} value={getOutputLabel(data.outputId, text)} accent={C.blue} />
          {data.outputId === WORKFLOW_OUTPUTS.SHAP ? (
            <button
              type="button"
              onClick={onOpenShap}
              style={{
                minHeight: 40,
                border: `1px solid ${C.borderStrong}`,
                borderRadius: 10,
                background: C.bgMuted,
                color: C.ice,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {text.actions.openShap}
            </button>
          ) : null}
        </div>
      );
    }

    if (type === WORKFLOW_NODE_TYPES.INPUT_CHANNEL) {
      const channel = CHANNEL_BY_VARIABLE[data.variableId];
      return (
        <SummaryRow
          label={text.inspector.fields.variable}
          value={channel ? t(channel.labelKey) : data.variableId}
          accent={data.color || C.blue}
        />
      );
    }

    return null;
  };

  return (
    <aside
      style={{
        minWidth: 270,
        width: 300,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: 16,
        borderRadius: 18,
        border: `1px solid ${C.border}`,
        background: C.bgCard,
        boxShadow: 'var(--card-shadow)',
        alignSelf: 'stretch',
      }}
    >
      <div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            color: C.ice,
            fontSize: 'calc(15px * var(--font-scale, 1))',
            fontWeight: 800,
            marginBottom: 5,
          }}
        >
          {selectedNode ? getWorkflowNodeLabel(selectedNode.data, text) : text.inspector.summaryTitle}
        </div>
        <div style={{ color: C.ice50, fontSize: 'calc(11px * var(--font-scale, 1))', lineHeight: 1.6 }}>
          {selectedNode ? text.inspector.selectedSubtitle : text.inspector.summarySubtitle}
        </div>
      </div>

      {selectedNode ? (
        <div style={{ display: 'grid', gap: 13 }}>
          {renderEditor()}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 13 }}>
          <SummaryRow label={text.inspector.summary.dataSource} value={predictionConfig?.dataSource === 'personal' ? text.source.personal : predictionConfig?.dataSource === 'default' ? text.source.default : text.inspector.noValue} accent={C.blue} />
          <SummaryRow label={text.inspector.summary.marsContext} value={predictionConfig ? `MY ${predictionConfig.marsYear} · Ls ${predictionConfig.lsStart}` : text.inspector.noValue} />
          <SummaryRow label={text.inspector.summary.variables} value={predictionConfig?.selectedVariables?.length ? predictionConfig.selectedVariables.join(', ') : text.inspector.baseline} />
          <SummaryRow label={text.inspector.summary.predictionHorizon} value={predictionConfig ? `+${predictionConfig.horizon}` : text.inspector.noValue} accent={C.mars} />
          <SummaryRow label={text.inspector.summary.outputs} value={predictionConfig?.enabledOutputs?.length ? predictionConfig.enabledOutputs.map((outputId) => getOutputLabel(outputId, text)).join(', ') : text.inspector.noValue} />
          <div style={{ height: 1, background: C.border, margin: '2px 0' }} />
          <SummaryRow label={text.inspector.summary.trainingScript} value={trainingDraft?.selectedScript || text.inspector.noValue} accent={C.green} />
          <SummaryRow label={text.inspector.summary.trainingChannels} value={trainingDraft?.selectedChannels?.length ? trainingDraft.selectedChannels.join('') : text.inspector.baseline} />
        </div>
      )}

      {(validation?.errors?.length || runError) ? (
        <div
          style={{
            borderRadius: 12,
            border: '1px solid rgba(217,92,92,0.24)',
            background: 'rgba(217,92,92,0.10)',
            padding: 12,
            color: '#ff9b9b',
            fontSize: 'calc(11px * var(--font-scale, 1))',
            lineHeight: 1.55,
          }}
        >
          {runError ? getWorkflowErrorMessage(runError, text) : getWorkflowErrorMessage(validation.errors[0], text)}
        </div>
      ) : null}
    </aside>
  );
}
