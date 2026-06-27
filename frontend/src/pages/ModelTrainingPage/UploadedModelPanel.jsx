import React, { useRef } from 'react';
import C from '../../constants/colors';

function getStatusColor(status) {
  if (status === 'valid') return C.green;
  if (status === 'pending') return '#c89448';
  return '#d95c5c';
}

function getStatusLabel(status, labels) {
  if (status === 'valid') return labels.valid;
  if (status === 'pending') return labels.pending;
  return labels.invalid;
}

function ValidationMessages({ report, labels, fieldHintStyle }) {
  const errors = Array.isArray(report?.errors) ? report.errors : [];
  const warnings = Array.isArray(report?.warnings) ? report.warnings : [];

  if (errors.length === 0 && warnings.length === 0) {
    return <div style={{ ...fieldHintStyle, marginTop: 0, color: C.green }}>{labels.ready}</div>;
  }

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {errors.map((message) => (
        <div key={`error-${message}`} style={{ ...fieldHintStyle, marginTop: 0, color: '#d95c5c' }}>
          {message}
        </div>
      ))}
      {warnings.map((message) => (
        <div key={`warning-${message}`} style={{ ...fieldHintStyle, marginTop: 0, color: '#c89448' }}>
          {message}
        </div>
      ))}
    </div>
  );
}

export default function UploadedModelPanel({
  models = [],
  selectedId,
  onSelect,
  onUpload,
  onRevalidate,
  onDelete,
  uploading = false,
  busy = false,
  guideDownloadUrl,
  templateDownloadUrl,
  labels,
  sectionTitleStyle,
  fieldHintStyle,
}) {
  const fileRef = useRef(null);
  const selected = models.find((item) => item.id === selectedId) || null;
  const downloadLinkStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '9px 12px',
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    background: 'transparent',
    color: C.ice70,
    textDecoration: 'none',
    fontWeight: 700,
    fontSize: 'calc(12px * var(--font-scale, 1))',
    fontFamily: 'var(--font-body)',
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ ...sectionTitleStyle, marginBottom: 4 }}>{labels.title}</div>
          <div style={{ ...fieldHintStyle, marginTop: 0 }}>{labels.hint}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {guideDownloadUrl ? (
            <a href={guideDownloadUrl} download style={downloadLinkStyle}>
              {labels.downloadGuide}
            </a>
          ) : null}
          {templateDownloadUrl ? (
            <a href={templateDownloadUrl} download style={downloadLinkStyle}>
              {labels.downloadTemplate}
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || busy}
            style={{
              padding: '9px 12px',
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: C.bgMuted,
              color: C.ice,
              cursor: uploading || busy ? 'not-allowed' : 'pointer',
              opacity: uploading || busy ? 0.6 : 1,
              fontWeight: 700,
              fontSize: 'calc(12px * var(--font-scale, 1))',
              fontFamily: 'var(--font-body)',
            }}
          >
            {uploading ? labels.uploading : labels.upload}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".py"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUpload(file);
            event.target.value = '';
          }}
        />
      </div>

      {models.length === 0 ? (
        <div
          style={{
            ...fieldHintStyle,
            marginTop: 0,
            padding: '11px 12px',
            border: `1px dashed ${C.border}`,
            borderRadius: 12,
            background: C.bgMuted,
          }}
        >
          {labels.empty}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {models.map((model) => {
            const active = selectedId === model.id;
            const statusColor = getStatusColor(model.validation_status);
            return (
              <button
                key={model.id}
                type="button"
                onClick={() => onSelect(model.id)}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: `1px solid ${active ? 'rgba(74,158,255,0.28)' : C.border}`,
                  background: active ? 'rgba(74,158,255,0.10)' : C.bgMuted,
                  color: C.ice,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 10,
                    alignItems: 'center',
                  }}
                >
                  <strong
                    style={{
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: 'calc(12px * var(--font-scale, 1))',
                    }}
                  >
                    {model.display_name || model.original_filename || labels.unnamed}
                  </strong>
                  <span
                    style={{
                      flex: '0 0 auto',
                      color: statusColor,
                      fontSize: 'calc(11px * var(--font-scale, 1))',
                      fontWeight: 800,
                    }}
                  >
                    {getStatusLabel(model.validation_status, labels)}
                  </span>
                </div>
                <div
                  style={{
                    ...fieldHintStyle,
                    marginTop: 4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  v{model.version ?? '--'} / {model.original_filename || labels.noFilename}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected ? (
        <div
          style={{
            padding: '11px 12px',
            borderRadius: 12,
            background: C.bgMuted,
            border: `1px solid ${C.border}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <div
              style={{
                color: getStatusColor(selected.validation_status),
                fontSize: 'calc(12px * var(--font-scale, 1))',
                fontWeight: 800,
              }}
            >
              {getStatusLabel(selected.validation_status, labels)}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => onRevalidate(selected.id)}
                disabled={busy}
                style={{
                  padding: '7px 10px',
                  borderRadius: 9,
                  border: `1px solid ${C.border}`,
                  background: 'transparent',
                  color: C.ice70,
                  cursor: busy ? 'not-allowed' : 'pointer',
                  opacity: busy ? 0.6 : 1,
                  fontSize: 'calc(11px * var(--font-scale, 1))',
                  fontWeight: 700,
                }}
              >
                {labels.revalidate}
              </button>
              <button
                type="button"
                onClick={() => onDelete(selected.id)}
                disabled={busy}
                style={{
                  padding: '7px 10px',
                  borderRadius: 9,
                  border: '1px solid rgba(217,92,92,0.18)',
                  background: 'rgba(217,92,92,0.08)',
                  color: '#d95c5c',
                  cursor: busy ? 'not-allowed' : 'pointer',
                  opacity: busy ? 0.6 : 1,
                  fontSize: 'calc(11px * var(--font-scale, 1))',
                  fontWeight: 700,
                }}
              >
                {labels.delete}
              </button>
            </div>
          </div>
          <ValidationMessages report={selected.validation_report} labels={labels} fieldHintStyle={fieldHintStyle} />
        </div>
      ) : null}
    </div>
  );
}
