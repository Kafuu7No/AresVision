import C from '../../../constants/colors';
import { useT } from '../../../i18n';
import { useSettings } from '../../../contexts/SettingsContext';
import { CHANNEL_BY_VARIABLE, WORKFLOW_NODE_TYPES } from './workflowSchema';
import { PALETTE_NODE_TEMPLATES } from './workflowLayout';
import {
  createWorkflowText,
  getTemplateGroupLabel,
  getTemplateLabel,
} from './workflowText';

function getTemplateSubtitle(item, t, text) {
  if (item.workflowType === WORKFLOW_NODE_TYPES.INPUT_CHANNEL) {
    const channel = CHANNEL_BY_VARIABLE[item.data?.variableId];
    return channel ? t(channel.labelKey) : item.label;
  }
  return text.templateSubtitles[item.workflowType] || item.label;
}

export default function NodePalette() {
  const t = useT();
  const { settings } = useSettings();
  const text = createWorkflowText(settings.language);

  const handleDragStart = (event, item) => {
    event.dataTransfer.setData('application/aresvision-workflow-node', JSON.stringify(item));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside
      style={{
        minWidth: 230,
        width: 250,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
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
          {text.palette.title}
        </div>
        <div style={{ color: C.ice50, fontSize: 'calc(11px * var(--font-scale, 1))', lineHeight: 1.6 }}>
          {text.palette.subtitle}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 14, overflowY: 'auto', paddingRight: 2 }}>
        {PALETTE_NODE_TEMPLATES.map((group) => (
          <div key={group.group} style={{ display: 'grid', gap: 8 }}>
            <div
              style={{
                color: C.blue,
                fontSize: 'calc(10px * var(--font-scale, 1))',
                fontWeight: 800,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
              }}
            >
              {getTemplateGroupLabel(group.group, text)}
            </div>

            {group.items.map((item) => (
              <button
                key={`${group.group}-${item.label}-${item.data?.outputId || item.data?.variableId || ''}`}
                type="button"
                draggable
                onDragStart={(event) => handleDragStart(event, item)}
                style={{
                  minHeight: 58,
                  textAlign: 'left',
                  borderRadius: 12,
                  border: '1px solid rgba(91,235,238,0.22)',
                  background: 'rgba(14,31,35,0.82)',
                  color: C.ice,
                  padding: '10px 12px',
                  cursor: 'grab',
                  transition: 'border-color 0.18s ease, background 0.18s ease, transform 0.18s ease',
                  fontFamily: 'var(--font-body)',
                }}
                onMouseDown={(event) => {
                  event.currentTarget.style.cursor = 'grabbing';
                }}
                onMouseUp={(event) => {
                  event.currentTarget.style.cursor = 'grab';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span
                    style={{
                      fontSize: 'calc(12px * var(--font-scale, 1))',
                      fontWeight: 800,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {getTemplateLabel(item, text)}
                  </span>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: item.data?.color || C.blue,
                      boxShadow: `0 0 14px ${item.data?.color || C.blue}`,
                      flexShrink: 0,
                    }}
                  />
                </div>
                <div style={{ marginTop: 5, color: C.ice50, fontSize: 'calc(10px * var(--font-scale, 1))', lineHeight: 1.4 }}>
                  {getTemplateSubtitle(item, t, text)}
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}
