import React from 'react';
import C from '../../constants/colors';

export default function ModelSourceSelector({
  value,
  onChange,
  labels,
  isLight,
  disabled = false,
  sectionTitleStyle,
  fieldHintStyle,
}) {
  const options = [
    { value: 'official', label: labels.official, hint: labels.officialHint },
    { value: 'uploaded', label: labels.uploaded, hint: labels.uploadedHint },
  ];

  const activeOption = options.find((option) => option.value === value) || options[0];

  return (
    <div>
      <div style={{ ...sectionTitleStyle, marginBottom: 12 }}>{labels.title}</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          padding: 5,
          borderRadius: 16,
          background: isLight ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${C.border}`,
          marginBottom: 10,
        }}
      >
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              disabled={disabled}
              style={{
                padding: '10px 12px',
                borderRadius: 12,
                border: 'none',
                background: active ? 'rgba(74,158,255,0.14)' : 'transparent',
                color: active ? C.blue : C.ice60,
                fontSize: 'calc(12px * var(--font-scale, 1))',
                fontWeight: active ? 700 : 600,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.55 : 1,
                transition: 'all 0.24s ease',
                fontFamily: 'var(--font-body)',
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <div style={{ ...fieldHintStyle, marginTop: 0 }}>{activeOption.hint}</div>
    </div>
  );
}
