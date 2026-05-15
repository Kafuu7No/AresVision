/**
 * ContributeModal — 贡献向导模态框（三步骤）
 * Step 1: 选择数据集
 * Step 2: 确认信息 + 备注
 * Step 3: 提交进度与结果
 */

import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import C from '../constants/colors';
import { useT } from '../i18n';
import { useSettings } from '../contexts/SettingsContext';
import { useScrollLock } from '../hooks/useScrollLock';
import { contributeUpload } from '../services/api';

// ─── Icons ────────────────────────────────────────────────────────────────────

function CheckIcon({ size = 13, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none">
      <path d="M2 6.5L5 9.5L11 3" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FileIcon({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </svg>
  );
}

function CloseIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current, t, isLight }) {
  const steps = [
    t('explore.contribute.step1'),
    t('explore.contribute.step2'),
    t('explore.contribute.step3'),
  ];
  const dimClr  = isLight ? '#000000' : '#ffffff';
  const lineClr = isLight ? '#000000' : '#ffffff';

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 28 }}>
      {steps.map((label, i) => {
        const n = i + 1;
        const active  = n === current;
        const done    = n < current;
        const dotBg   = active ? C.blue : done ? '#22c55e' : (isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)');
        const dotClr  = active || done ? '#fff' : dimClr;
        const textClr = active ? C.blue : done ? '#22c55e' : dimClr;

        return (
          <div key={n} style={{ display: 'flex', alignItems: 'center' }}>
            {i > 0 && (
              <div style={{ width: 36, height: 1, background: done ? '#22c55e' : lineClr, margin: '0 4px' }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                background: dotBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.25s',
              }}>
                {done
                  ? <CheckIcon size={12} color="#fff" />
                  : <span style={{ fontSize: 'calc(11px * var(--font-scale, 1))', fontWeight: 700, color: dotClr }}>{n}</span>
                }
              </div>
              <span style={{ fontSize: 'calc(10px * var(--font-scale, 1))', fontWeight: 600, color: textClr, whiteSpace: 'nowrap' }}>
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: 选择数据集 ───────────────────────────────────────────────────────

function Step1({ validUploads, selected, onToggle, t, isLight }) {
  const rowBg     = isLight ? 'rgba(0,0,0,0.025)'       : 'rgba(255,255,255,0.04)';
  const rowBorder = isLight ? 'rgba(0,0,0,0.07)'        : 'rgba(255,255,255,0.07)';
  const selBg     = isLight ? 'rgba(74,158,255,0.08)'   : 'rgba(74,158,255,0.10)';
  const selBorder = C.blue;
  const nameClr   = isLight ? '#000000' : '#ffffff';
  const metaClr   = isLight ? '#000000' : '#ffffff';

  if (validUploads.length === 0) {
    return (
      <div style={{
        padding: '32px 0', textAlign: 'center',
        color: isLight ? '#000000' : '#ffffff',
        fontSize: 'calc(13px * var(--font-scale, 1))',
      }}>
        {t('explore.contribute.step1Empty')}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {validUploads.map(u => {
        const sel = selected.has(u.id);
        const meta = [
          u.data_type,
          u.mars_year != null ? `MY ${u.mars_year}` : null,
          (u.ls_start != null && u.ls_end != null)
            ? `Ls ${Number(u.ls_start).toFixed(0)}°–${Number(u.ls_end).toFixed(0)}°`
            : null,
        ].filter(Boolean).join(' · ');

        return (
          <div
            key={u.id}
            onClick={() => onToggle(u.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
              background: sel ? selBg : rowBg,
              border: `1px solid ${sel ? selBorder : rowBorder}`,
              transition: 'all 0.15s',
            }}
          >
            {/* Checkbox */}
            <div style={{
              width: 18, height: 18, borderRadius: 5, flexShrink: 0,
              background: sel ? C.blue : 'transparent',
              border: `2px solid ${sel ? C.blue : (isLight ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.25)')}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}>
              {sel && <CheckIcon size={10} color="#fff" />}
            </div>

            {/* File info */}
            <span style={{ color: isLight ? '#000000' : '#ffffff', flexShrink: 0 }}>
              <FileIcon size={14} color="currentColor" />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 'calc(13px * var(--font-scale, 1))', fontWeight: 600, color: nameClr,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }} title={u.filename}>
                {u.filename}
              </div>
              {meta && (
                <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: metaClr, marginTop: 2 }}>{meta}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 2: 确认信息 ─────────────────────────────────────────────────────────

function Step2({ validUploads, selected, note, onNoteChange, t, isLight }) {
  const selectedList = validUploads.filter(u => selected.has(u.id));
  const nameClr   = isLight ? '#000000' : '#ffffff';
  const metaClr   = isLight ? '#000000' : '#ffffff';
  const inputBg   = isLight ? 'rgba(0,0,0,0.04)'     : 'rgba(255,255,255,0.05)';
  const inputBdr  = isLight ? 'rgba(0,0,0,0.12)'     : 'rgba(255,255,255,0.12)';
  const noticeBg  = isLight ? 'rgba(74,158,255,0.07)': 'rgba(74,158,255,0.08)';
  const noticeBdr = isLight ? 'rgba(74,158,255,0.25)': 'rgba(74,158,255,0.20)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Selected count */}
      <div style={{ fontSize: 'calc(12px * var(--font-scale, 1))', color: C.blue, fontWeight: 600 }}>
        {t('explore.contribute.step2Selected', { n: selectedList.length })}
      </div>

      {/* Summary list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
        {selectedList.map(u => (
          <div key={u.id} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 12px', borderRadius: 8,
            background: isLight ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.07)'}`,
          }}>
            <span style={{ color: metaClr, flexShrink: 0 }}><FileIcon size={13} color="currentColor" /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'calc(12px * var(--font-scale, 1))', fontWeight: 600, color: nameClr, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {u.filename}
              </div>
              {u.data_type && (
                <div style={{ fontSize: 'calc(10px * var(--font-scale, 1))', color: metaClr }}>{u.data_type}{u.mars_year != null ? ` · MY ${u.mars_year}` : ''}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Note input */}
      <div>
        <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: metaClr, marginBottom: 6 }}>
          {t('explore.contribute.noteLabel')}
        </div>
        <textarea
          value={note}
          onChange={e => onNoteChange(e.target.value)}
          placeholder={t('explore.contribute.notePlaceholder')}
          rows={3}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: inputBg, border: `1px solid ${inputBdr}`,
            borderRadius: 8, padding: '8px 12px',
            color: nameClr, fontSize: 'calc(13px * var(--font-scale, 1))', resize: 'vertical',
            outline: 'none', fontFamily: 'inherit', lineHeight: 1.55,
          }}
        />
      </div>

      {/* Notice */}
      <div style={{
        padding: '10px 14px', borderRadius: 9,
        background: noticeBg, border: `1px solid ${noticeBdr}`,
        fontSize: 'calc(12px * var(--font-scale, 1))', color: metaClr, lineHeight: 1.6,
      }}>
        {t('explore.contribute.step2Notice')}
      </div>
    </div>
  );
}

// ─── Step 3: 提交结果 ─────────────────────────────────────────────────────────

function Step3({ validUploads, selected, results, submitting, t, isLight }) {
  const total    = selected.size;
  const done     = results.length;
  const okCount  = results.filter(r => r.ok).length;
  const failCount = results.filter(r => !r.ok).length;
  const allDone  = !submitting && done === total;

  const nameClr = isLight ? '#000000' : '#ffffff';
  const dimClr  = isLight ? '#000000' : '#ffffff';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Progress text */}
      <div style={{ fontSize: 'calc(13px * var(--font-scale, 1))', color: dimClr, textAlign: 'center' }}>
        {submitting
          ? t('explore.contribute.step3Progress', { done, total })
          : (failCount === 0
              ? t('explore.contribute.step3Success', { n: okCount })
              : t('explore.contribute.step3Partial', { ok: okCount, fail: failCount })
            )
        }
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: total > 0 ? `${(done / total) * 100}%` : '0%',
          background: failCount > 0 ? C.mars : '#22c55e',
          borderRadius: 2,
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Per-item results */}
      {results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
          {results.map(r => {
            const u = validUploads.find(x => x.id === r.id);
            return (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 12px', borderRadius: 8,
                background: r.ok
                  ? (isLight ? 'rgba(34,197,94,0.06)' : 'rgba(34,197,94,0.08)')
                  : (isLight ? 'rgba(199,91,57,0.06)' : 'rgba(199,91,57,0.08)'),
                border: `1px solid ${r.ok ? 'rgba(34,197,94,0.25)' : 'rgba(199,91,57,0.25)'}`,
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: r.ok ? '#22c55e' : C.mars,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'calc(12px * var(--font-scale, 1))', fontWeight: 600, color: nameClr, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u?.filename ?? `#${r.id}`}
                  </div>
                  {!r.ok && r.error && (
                    <div style={{ fontSize: 'calc(10px * var(--font-scale, 1))', color: C.mars, marginTop: 1 }}>{r.error}</div>
                  )}
                </div>
                <span style={{ fontSize: 'calc(10px * var(--font-scale, 1))', fontWeight: 700, color: r.ok ? '#22c55e' : C.mars, flexShrink: 0 }}>
                  {r.ok ? '✓' : '✗'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Loading spinner (pending items) */}
      {submitting && done < total && (
        <div style={{ fontSize: 'calc(12px * var(--font-scale, 1))', color: dimClr, textAlign: 'center' }}>
          {t('explore.contribute.step3Progress', { done, total })}
        </div>
      )}
    </div>
  );
}

// ─── Modal Inner ──────────────────────────────────────────────────────────────

function ContributeModalInner({ open, onClose, validUploads, onDone }) {
  const t = useT();
  const { settings } = useSettings();
  const isLight = settings.theme === 'light';
  useScrollLock(open);

  const [step, setStep]         = useState(1);
  const [selected, setSelected] = useState(new Set());
  const [note, setNote]         = useState('');
  const [results, setResults]   = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setStep(1);
      setSelected(new Set());
      setNote('');
      setResults([]);
      setSubmitting(false);
    }
  }, [open]);

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    setStep(3);
    setSubmitting(true);
    const ids = [...selected];
    const collected = [];
    for (const id of ids) {
      try {
        await contributeUpload(id, note);
        collected.push({ id, ok: true });
      } catch (e) {
        collected.push({ id, ok: false, error: e.message });
      }
      setResults([...collected]);
    }
    setSubmitting(false);
  };

  const handleDone = () => {
    onDone?.();
    onClose();
  };

  // Theme palette
  const overlayBg  = isLight ? 'rgba(200,205,225,0.72)' : 'rgba(0,0,8,0.78)';
  const cardBg     = isLight ? 'rgba(255,255,255,0.98)'  : 'rgba(10,10,22,0.97)';
  const cardBorder = isLight ? 'rgba(0,0,0,0.08)'        : 'rgba(255,255,255,0.10)';
  const titleClr   = isLight ? '#000000' : '#ffffff';
  const dimClr     = isLight ? '#000000' : '#ffffff';
  const btnDisBg   = isLight ? 'rgba(0,0,0,0.05)'         : 'rgba(255,255,255,0.06)';
  const btnDisClr  = isLight ? '#000000' : '#ffffff';
  const cancelBg   = isLight ? 'rgba(0,0,0,0.06)'         : 'rgba(255,255,255,0.07)';
  const cancelClr  = isLight ? '#000000' : '#ffffff';

  const canNext  = selected.size > 0;
  const allDone  = !submitting && results.length === selected.size && step === 3;

  const stepTitle = [
    t('explore.contribute.step1Title'),
    t('explore.contribute.step2Title'),
    t('explore.contribute.step3Title'),
  ][step - 1];

  return ReactDOM.createPortal(
    <>
      {/* Overlay */}
      <div
        onClick={step === 3 && submitting ? undefined : handleDone}
        style={{
          position: 'fixed', inset: 0, background: overlayBg,
          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          zIndex: 4000,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.2s',
        }}
      />

      {/* Card */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '50%', left: '50%',
          transform: open ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -52%) scale(0.97)',
          transition: 'transform 0.22s cubic-bezier(0.22,1,0.36,1), opacity 0.22s',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          width: 520, maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 80px)',
          background: cardBg,
          border: `1px solid ${cardBorder}`,
          borderRadius: 16,
          boxShadow: isLight
            ? '0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.07)'
            : '0 20px 60px rgba(0,0,0,0.70), 0 4px 16px rgba(0,0,0,0.40)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          zIndex: 4001,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 0',
          flexShrink: 0,
        }}>
          <div style={{
            fontSize: 'calc(14px * var(--font-scale, 1))', fontWeight: 700, color: titleClr,
            fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.02em',
          }}>
            {stepTitle}
          </div>
          <button
            onClick={handleDone}
            disabled={step === 3 && submitting}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: dimClr, padding: 4, display: 'flex',
              opacity: (step === 3 && submitting) ? 0.4 : 1,
            }}
          >
            <CloseIcon size={16} color="currentColor" />
          </button>
        </div>

        {/* Step indicator */}
        <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
          <StepIndicator current={step} t={t} isLight={isLight} />
        </div>

        {/* Body (scrollable) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
          {step === 1 && (
            <Step1
              validUploads={validUploads}
              selected={selected}
              onToggle={toggleSelect}
              t={t} isLight={isLight}
            />
          )}
          {step === 2 && (
            <Step2
              validUploads={validUploads}
              selected={selected}
              note={note}
              onNoteChange={setNote}
              t={t} isLight={isLight}
            />
          )}
          {step === 3 && (
            <Step3
              validUploads={validUploads}
              selected={selected}
              results={results}
              submitting={submitting}
              t={t} isLight={isLight}
            />
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', gap: 10, justifyContent: 'flex-end',
          padding: '20px 24px',
          borderTop: `1px solid ${isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.07)'}`,
          flexShrink: 0,
        }}>
          {step === 1 && (
            <>
              <button onClick={handleDone} style={{
                padding: '9px 20px', borderRadius: 9,
                background: cancelBg, border: 'none',
                color: cancelClr, fontSize: 'calc(13px * var(--font-scale, 1))', fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {t('explore.myData.cancelBtn')}
              </button>
              <button
                onClick={() => canNext && setStep(2)}
                disabled={!canNext}
                style={{
                  padding: '9px 20px', borderRadius: 9, border: 'none',
                  background: canNext ? C.blue : btnDisBg,
                  color: canNext ? '#fff' : btnDisClr,
                  fontSize: 'calc(13px * var(--font-scale, 1))', fontWeight: 600,
                  cursor: canNext ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit', transition: 'all 0.15s',
                }}
              >
                {t('explore.contribute.nextBtn')}
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button onClick={() => setStep(1)} style={{
                padding: '9px 20px', borderRadius: 9,
                background: cancelBg, border: 'none',
                color: cancelClr, fontSize: 'calc(13px * var(--font-scale, 1))', fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {t('explore.contribute.prevBtn')}
              </button>
              <button onClick={handleSubmit} style={{
                padding: '9px 20px', borderRadius: 9, border: 'none',
                background: C.mars, color: '#fff',
                fontSize: 'calc(13px * var(--font-scale, 1))', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {t('explore.contribute.submitBtn')}
              </button>
            </>
          )}

          {step === 3 && (
            <button
              onClick={handleDone}
              disabled={submitting}
              style={{
                padding: '9px 20px', borderRadius: 9, border: 'none',
                background: allDone ? C.blue : btnDisBg,
                color: allDone ? '#fff' : btnDisClr,
                fontSize: 'calc(13px * var(--font-scale, 1))', fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', transition: 'all 0.15s',
              }}
            >
              {t('explore.contribute.doneBtn')}
            </button>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

export default function ContributeModal({ open, onClose, validUploads, onDone }) {
  if (!open) return null;
  return <ContributeModalInner open={open} onClose={onClose} validUploads={validUploads ?? []} onDone={onDone} />;
}
