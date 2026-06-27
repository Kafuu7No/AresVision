import { Handle, Position } from '@xyflow/react';
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
  getWorkflowStatusLabel,
} from './workflowText';

function getNodeMainText(data, t, text) {
  if (data.workflowType === WORKFLOW_NODE_TYPES.INPUT_CHANNEL) {
    const channel = CHANNEL_BY_VARIABLE[data.variableId];
    return channel ? t(channel.labelKey) : data.label;
  }
  if (data.workflowType === WORKFLOW_NODE_TYPES.DATA_SOURCE) {
    return data.dataSource === 'personal' ? text.source.personal : text.source.default;
  }
  if (data.workflowType === WORKFLOW_NODE_TYPES.MARS_CONTEXT) {
    return `MY ${data.marsYear ?? 27} · Ls ${data.lsStart ?? 90}`;
  }
  if (data.workflowType === WORKFLOW_NODE_TYPES.PREDRNN_MODEL) {
    return `${text.inspector.fields.predictionHorizon} +${data.horizon ?? 3}`;
  }
  if (data.workflowType === WORKFLOW_NODE_TYPES.TRAINING_CONFIG) {
    return `${text.inspector.fields.epochs} ${data.epochs ?? 10} · LR ${data.learning_rate ?? 0.001}`;
  }
  if (data.workflowType === WORKFLOW_NODE_TYPES.ANALYSIS_OUTPUT) {
    return getOutputLabel(data.outputId, text, { short: true }) || data.label;
  }
  return data.label;
}

function getStatusColor(status) {
  if (status === 'running') return C.mars;
  if (status === 'success') return C.green;
  if (status === 'failed') return '#d95c5c';
  return C.blue;
}

export default function WorkflowNode({ data, selected }) {
  const t = useT();
  const { settings } = useSettings();
  const text = createWorkflowText(settings.language);
  const isInputOnly = [
    WORKFLOW_NODE_TYPES.ANALYSIS_OUTPUT,
  ].includes(data.workflowType);
  const isOutputOnly = [
    WORKFLOW_NODE_TYPES.DATA_SOURCE,
    WORKFLOW_NODE_TYPES.MARS_CONTEXT,
    WORKFLOW_NODE_TYPES.INPUT_CHANNEL,
  ].includes(data.workflowType);
  const statusColor = getStatusColor(data.status);
  const hasError = Boolean(data.validationError);
  const accent = hasError ? '#d95c5c' : (data.color || statusColor);

  return (
    <div
      style={{
        width: 178,
        borderRadius: 10,
        border: `1px solid ${hasError ? 'rgba(217,92,92,0.62)' : selected ? 'rgba(91,235,238,0.76)' : 'rgba(91,235,238,0.34)'}`,
        background: selected ? 'rgba(19,39,44,0.96)' : 'rgba(12,28,31,0.94)',
        boxShadow: selected ? '0 0 0 1px rgba(91,235,238,0.18), 0 18px 36px rgba(0,0,0,0.30)' : '0 12px 28px rgba(0,0,0,0.22)',
        overflow: 'hidden',
        color: C.ice,
        fontFamily: 'var(--font-body)',
      }}
    >
      {!isInputOnly && (
        <Handle
          type="source"
          position={Position.Right}
          style={{ width: 9, height: 9, background: accent, border: '1px solid rgba(255,255,255,0.78)' }}
        />
      )}
      {!isOutputOnly && (
        <Handle
          type="target"
          position={Position.Left}
          style={{ width: 9, height: 9, background: accent, border: '1px solid rgba(255,255,255,0.78)' }}
        />
      )}

      <div
        style={{
          height: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '0 10px',
          background: hasError ? 'rgba(217,92,92,0.86)' : 'rgba(91,235,238,0.92)',
          color: '#061114',
          fontSize: 'calc(11px * var(--font-scale, 1))',
          fontWeight: 800,
          letterSpacing: 0.2,
        }}
      >
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {getWorkflowNodeLabel(data, text)}
        </span>
        <span style={{ fontSize: 'calc(9px * var(--font-scale, 1))', opacity: 0.78 }}>
          {text.nodeTypes[data.workflowType]}
        </span>
      </div>

      <div style={{ padding: 10, display: 'grid', gap: 8 }}>
        <div
          style={{
            minHeight: 34,
            borderRadius: 7,
            border: '1px solid rgba(91,235,238,0.22)',
            background: 'rgba(0,0,0,0.22)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 9px',
            fontSize: 'calc(11px * var(--font-scale, 1))',
            fontWeight: 700,
            color: C.ice,
            lineHeight: 1.35,
          }}
        >
          {getNodeMainText(data, t, text)}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: C.ice50, fontSize: 'calc(10px * var(--font-scale, 1))' }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: accent,
              boxShadow: `0 0 12px ${accent}`,
            }}
          />
          {getWorkflowStatusLabel(data.status === 'success' ? 'ready' : data.status, text)}
        </div>

        {data.validationError ? (
          <div style={{ color: '#ff9b9b', fontSize: 'calc(10px * var(--font-scale, 1))', lineHeight: 1.45 }}>
            {getWorkflowErrorMessage(data.validationError, text)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
