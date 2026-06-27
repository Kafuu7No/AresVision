import C from '../../../constants/colors';
import { useSettings } from '../../../contexts/SettingsContext';
import { createWorkflowText } from './workflowText';
import { TRAINING_MODEL_ARCHITECTURES } from './workflowSchema';
import {
  createDefaultArchitectureParamsByModel,
  getModelStructureConfig,
  getModelStructureParamLabel,
  isRecurrentArchitecture,
  sanitizeDropout,
  sanitizePositiveInteger,
  sanitizePositiveNumber,
} from '../../ModelTrainingPage/trainingParamSanitizers';

const OPEN_INTERVAL_FLOAT_FIELDS = new Set(['initial_history_weight', 'initial_translation_weight']);

function Field({ label, children, hint, span = 'auto' }) {
  return (
    <label style={{ display: 'grid', gap: 7, gridColumn: span }}>
      <span style={{ color: C.ice50, fontSize: 'calc(11px * var(--font-scale, 1))', fontWeight: 700 }}>
        {label}
      </span>
      {children}
      {hint ? (
        <span style={{ color: C.ice40, fontSize: 'calc(10px * var(--font-scale, 1))', lineHeight: 1.45 }}>
          {hint}
        </span>
      ) : null}
    </label>
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

function asHiddenDims(value = []) {
  if (Array.isArray(value)) return value.join(', ');
  return String(value || '');
}

function parseHiddenDims(value) {
  return String(value)
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
}

function ConfigCard({ title, subtitle, children }) {
  return (
    <section
      style={{
        display: 'grid',
        gap: 14,
        padding: 16,
        borderRadius: 16,
        border: `1px solid ${C.border}`,
        background: 'linear-gradient(180deg, rgba(16,28,32,0.96), rgba(10,18,22,0.98))',
        boxShadow: 'var(--card-shadow)',
      }}
    >
      <div style={{ display: 'grid', gap: 4 }}>
        <div
          style={{
            color: C.ice,
            fontWeight: 800,
            fontFamily: 'var(--font-display)',
            fontSize: 'calc(14px * var(--font-scale, 1))',
          }}
        >
          {title}
        </div>
        <div style={{ color: C.ice50, fontSize: 'calc(11px * var(--font-scale, 1))', lineHeight: 1.5 }}>
          {subtitle}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function WorkflowConfigPanel({ config, onUpdateConfig }) {
  const { settings } = useSettings();
  const text = createWorkflowText(settings.language);
  const panelTitle = settings.language === 'en' ? 'Shared Workflow Settings' : '共享流程设置';
  const panelSubtitle = settings.language === 'en'
    ? 'Keep data source, Mars context, and training parameters outside the canvas so the graph stays focused on model flow.'
    : '将数据源、火星环境和训练参数固定在画布外，让画布只表达模型流程。';
  const sourceSubtitle = settings.language === 'en'
    ? 'Used by prediction requests and training drafts.'
    : '同时用于预测请求和训练草稿。';
  const contextSubtitle = settings.language === 'en'
    ? 'Sets the planetary context for the current prediction request.'
    : '设置当前预测请求的火星环境。';
  const trainingSubtitle = settings.language === 'en'
    ? 'Applied when the current workflow is sent to training.'
    : '当前工作流发送到训练时使用。';
  const selectedArchitecture = config.training?.model_architecture ?? 'predrnnv2';
  const isRecurrentModel = isRecurrentArchitecture(selectedArchitecture);
  const structureConfig = getModelStructureConfig(selectedArchitecture);
  const architectureParamsByModel = {
    ...createDefaultArchitectureParamsByModel(),
    ...(config.training?.architecture_params_by_model || {}),
  };
  const activeArchitectureParams = architectureParamsByModel[selectedArchitecture] || {};

  const updateTraining = (patch) => {
    onUpdateConfig({
      training: {
        ...(config.training || {}),
        ...patch,
      },
    });
  };

  const updateStructureParam = (field, value) => {
    const boundedFloatMin = OPEN_INTERVAL_FLOAT_FIELDS.has(field.key) ? 0.000001 : 0;
    const sanitizedValue = value === ''
      ? ''
      : field.type === 'integerList'
        ? value
        : field.type === 'dropout'
          ? sanitizeDropout(value, field.defaultValue)
          : field.type === 'boundedFloat'
            ? sanitizePositiveNumber(value, field.defaultValue, boundedFloatMin, 0.9)
          : field.type === 'nonNegativeNumber'
            ? sanitizePositiveNumber(value, field.defaultValue, 0)
            : sanitizePositiveInteger(value, field.defaultValue);

    updateTraining({
      architecture_params_by_model: {
        ...architectureParamsByModel,
        [selectedArchitecture]: {
          ...activeArchitectureParams,
          [field.key]: sanitizedValue,
        },
      },
    });
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gap: 4, padding: '0 2px' }}>
        <div
          style={{
            color: C.ice,
            fontWeight: 800,
            fontFamily: 'var(--font-display)',
            fontSize: 'calc(15px * var(--font-scale, 1))',
          }}
        >
          {panelTitle}
        </div>
        <div style={{ color: C.ice50, fontSize: 'calc(11px * var(--font-scale, 1))', lineHeight: 1.5 }}>
          {panelSubtitle}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.45fr', gap: 12, alignItems: 'start' }}>
        <ConfigCard title={text.inspector.fields.dataSource} subtitle={sourceSubtitle}>
          <Field label={text.inspector.fields.dataSource}>
            <select
              value={config.dataSource || 'default'}
              onChange={(event) => onUpdateConfig({ dataSource: event.target.value })}
              style={inputStyle()}
            >
              <option value="default">{text.source.defaultOption}</option>
              <option value="personal">{text.source.personalOption}</option>
            </select>
          </Field>
        </ConfigCard>

        <ConfigCard title={text.nodeLabels.marsContext || text.inspector.summary.marsContext} subtitle={contextSubtitle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label={text.inspector.fields.marsYear}>
              <input
                type="number"
                value={config.marsYear ?? 27}
                onChange={(event) => onUpdateConfig({ marsYear: Number(event.target.value) || 27 })}
                style={inputStyle()}
              />
            </Field>
            <Field label={text.inspector.fields.lsStart}>
              <input
                type="number"
                min="0"
                max="360"
                value={config.lsStart ?? 90}
                onChange={(event) => onUpdateConfig({ lsStart: Number(event.target.value) || 0 })}
                style={inputStyle()}
              />
            </Field>
          </div>
        </ConfigCard>

        <ConfigCard title={text.nodeLabels.trainingConfig || (settings.language === 'en' ? 'Training Config' : '训练配置')} subtitle={trainingSubtitle}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
            <Field label={text.inspector.fields.modelArchitecture} span={'1 / 3'}>
              <select
                value={config.training?.model_architecture ?? 'predrnnv2'}
                onChange={(event) => updateTraining({ model_architecture: event.target.value })}
                style={inputStyle()}
              >
                {TRAINING_MODEL_ARCHITECTURES.map((architecture) => (
                  <option key={architecture.id} value={architecture.id}>{architecture.label}</option>
                ))}
              </select>
            </Field>
            <Field label={text.inspector.fields.sphere}>
              <label
                style={{
                  minHeight: 40,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  background: C.bgMuted,
                  color: C.ice,
                  padding: '0 11px',
                  boxSizing: 'border-box',
                  fontSize: 'calc(12px * var(--font-scale, 1))',
                  fontWeight: 700,
                }}
              >
                <input
                  type="checkbox"
                  checked={Boolean(config.training?.use_sphere)}
                  onChange={(event) => updateTraining({ use_sphere: event.target.checked })}
                />
                <span>{Boolean(config.training?.use_sphere) ? 'ON' : 'OFF'}</span>
              </label>
            </Field>
            <Field label={text.inspector.fields.epochs}>
              <input type="number" min="1" value={config.training?.epochs ?? 10} onChange={(event) => updateTraining({ epochs: Number(event.target.value) || 1 })} style={inputStyle()} />
            </Field>
            <Field label={text.inspector.fields.batchSize}>
              <input type="number" min="1" value={config.training?.batch_size ?? 32} onChange={(event) => updateTraining({ batch_size: Number(event.target.value) || 1 })} style={inputStyle()} />
            </Field>
            <Field label={text.inspector.fields.learningRate}>
              <input type="number" step="0.0001" min="0" value={config.training?.learning_rate ?? 0.001} onChange={(event) => updateTraining({ learning_rate: Number(event.target.value) || 0.001 })} style={inputStyle()} />
            </Field>
            <Field label={text.inspector.fields.window}>
              <input type="number" min="1" value={config.training?.window ?? 3} onChange={(event) => updateTraining({ window: Number(event.target.value) || 1 })} style={inputStyle()} />
            </Field>
            <Field label={text.inspector.fields.horizon}>
              <input type="number" min="1" value={config.training?.horizon ?? 3} onChange={(event) => updateTraining({ horizon: Number(event.target.value) || 1 })} style={inputStyle()} />
            </Field>
            <Field label={text.inspector.fields.earlyStopping}>
              <input type="number" min="0" value={config.training?.early_stopping_patience ?? 0} onChange={(event) => updateTraining({ early_stopping_patience: Math.max(0, Number(event.target.value) || 0) })} style={inputStyle()} />
            </Field>
            <Field label={text.inspector.fields.seed}>
              <input type="number" min="0" value={config.training?.seed ?? 11} onChange={(event) => updateTraining({ seed: Math.max(0, Number(event.target.value) || 0) })} style={inputStyle()} />
            </Field>
            {isRecurrentModel ? (
              <Field label={text.inspector.fields.hiddenDims} hint={text.inspector.hints.hiddenDims} span={'1 / -1'}>
                <input
                  value={asHiddenDims(config.training?.stlstm_hidden_dims)}
                  onChange={(event) => updateTraining({ stlstm_hidden_dims: parseHiddenDims(event.target.value) })}
                  style={inputStyle()}
                />
              </Field>
            ) : structureConfig.map((field) => (
              <Field key={field.key} label={getModelStructureParamLabel(field.key, settings.language)}>
                <input
                  type={field.type === 'integerList' ? 'text' : 'number'}
                  min={
                    field.type === 'boundedFloat' && OPEN_INTERVAL_FLOAT_FIELDS.has(field.key)
                      ? '0.000001'
                      : ['dropout', 'boundedFloat', 'nonNegativeNumber'].includes(field.type)
                        ? '0'
                        : '1'
                  }
                  max={['dropout', 'boundedFloat'].includes(field.type) ? '0.9' : undefined}
                  step={['dropout', 'boundedFloat', 'nonNegativeNumber'].includes(field.type) ? '0.05' : '1'}
                  value={
                    Array.isArray(activeArchitectureParams[field.key] ?? field.defaultValue)
                      ? (activeArchitectureParams[field.key] ?? field.defaultValue).join(',')
                      : activeArchitectureParams[field.key] ?? field.defaultValue
                  }
                  onChange={(event) => updateStructureParam(field, event.target.value)}
                  style={inputStyle()}
                />
              </Field>
            ))}
          </div>
        </ConfigCard>
      </div>
    </div>
  );
}
