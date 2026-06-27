import React from 'react';
import C from '../../constants/colors';

function formatRange(field, labels) {
  const hasMin = Number.isFinite(field?.min);
  const hasMax = Number.isFinite(field?.max);
  if (hasMin && hasMax) return labels.rangeHint(field.min, field.max);
  if (hasMin) return labels.minHint(field.min);
  if (hasMax) return labels.maxHint(field.max);
  return '';
}

function getStep(field) {
  if (field?.type === 'int') return '1';
  if (Number.isFinite(field?.step)) return String(field.step);
  return '0.01';
}

export default function DynamicModelParamsForm({
  schema = {},
  values = {},
  errors = {},
  onChange,
  labels,
  sectionTitleStyle,
  fieldLabelStyle,
  fieldHintStyle,
  inputStyle,
}) {
  const fields = Object.entries(schema || {});

  if (fields.length === 0) {
    return (
      <div>
        <div style={{ ...sectionTitleStyle, marginBottom: 10 }}>{labels.title}</div>
        <div
          style={{
            ...fieldHintStyle,
            marginTop: 0,
            padding: '10px 12px',
            borderRadius: 12,
            border: `1px dashed ${C.border}`,
            background: C.bgMuted,
          }}
        >
          {labels.empty}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ ...sectionTitleStyle, marginBottom: 10 }}>{labels.title}</div>
      <div className="model-training-field-grid">
        {fields.map(([key, field]) => {
          const value = values[key] ?? field.default ?? '';
          const label = field.label || key;
          const hintParts = [field.description, formatRange(field, labels)].filter(Boolean);
          const error = errors[key];

          if (field.type === 'bool') {
            const checked = Boolean(value);
            return (
              <label
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: `1px solid ${error ? '#d95c5c' : C.border}`,
                  background: C.bgMuted,
                  cursor: 'pointer',
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ ...fieldLabelStyle, display: 'block', marginBottom: 2 }}>{label}</span>
                  {hintParts.length > 0 ? (
                    <span style={{ ...fieldHintStyle, display: 'block', marginTop: 0 }}>
                      {hintParts.join(' / ')}
                    </span>
                  ) : null}
                  {error ? (
                    <span style={{ ...fieldHintStyle, display: 'block', marginTop: 4, color: '#d95c5c' }}>
                      {error}
                    </span>
                  ) : null}
                </span>
                <span
                  style={{
                    flex: '0 0 auto',
                    width: 42,
                    height: 24,
                    borderRadius: 999,
                    padding: 3,
                    background: checked ? 'rgba(74,158,255,0.26)' : 'rgba(255,255,255,0.08)',
                    border: `1px solid ${checked ? 'rgba(74,158,255,0.40)' : C.border}`,
                    transition: 'all 0.18s ease',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      width: 16,
                      height: 16,
                      borderRadius: 999,
                      background: checked ? C.blue : C.ice60,
                      transform: checked ? 'translateX(18px)' : 'translateX(0)',
                      transition: 'transform 0.18s ease',
                    }}
                  />
                </span>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => onChange(key, event.target.checked)}
                  style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                />
              </label>
            );
          }

          return (
            <div key={key}>
              <div style={fieldLabelStyle}>{label}</div>
              {field.type === 'select' ? (
                <select
                  style={{
                    ...inputStyle,
                    borderColor: error ? '#d95c5c' : inputStyle.borderColor || C.border,
                  }}
                  value={value}
                  onChange={(event) => onChange(key, event.target.value)}
                >
                  {(field.options || []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type === 'int' || field.type === 'float' ? 'number' : 'text'}
                  style={{
                    ...inputStyle,
                    borderColor: error ? '#d95c5c' : inputStyle.borderColor || C.border,
                  }}
                  value={value}
                  min={Number.isFinite(field.min) ? field.min : undefined}
                  max={Number.isFinite(field.max) ? field.max : undefined}
                  step={getStep(field)}
                  onChange={(event) => onChange(key, event.target.value)}
                />
              )}
              {hintParts.length > 0 ? (
                <div style={{ ...fieldHintStyle, marginTop: 5 }}>{hintParts.join(' / ')}</div>
              ) : null}
              {error ? <div style={{ ...fieldHintStyle, color: '#d95c5c' }}>{error}</div> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
