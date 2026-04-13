const fs = require('fs');
const path = require('path');

const dir = 'd:/A-development-project/GitHubProject/OtherProject/AresVision/frontend/src/pages/DataOverviewPage/OverviewCharts';

const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

for (const file of files) {
  const filepath = path.join(dir, file);
  let content = fs.readFileSync(filepath, 'utf8');

  let modified = false;

  const styleSetup = `
  const isLight = settings?.theme === 'light';
  const plotText = isLight ? '#444444' : 'rgba(255,255,255,0.85)';
  const plotGrid = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.15)';
`;

  if (!content.includes('plotText')) {
    if (content.includes('const { settings } = useSettings();')) {
      content = content.replace(/(const { settings } = useSettings\(\);)/, `$1\n${styleSetup}`);
    } else {
      content = content.replace(/(const t = useT\(\);)/, `$1\n  const settings = {}; // fallback \n${styleSetup}`);
    }
  }

  // carefully replace font colors inside plotly objects
  // using a regex that looks for (titlefont|tickfont|font|legend): { ... color: C.iceXX ... }
  // Since js regex is limited, we replace simply color: C.ice[36]0 when next to size or family! No, tickfont might be structured differently.
  // Actually, we can just replace 'color: C.ice60' with 'color: plotText' globally because plotText resolves to an exact valid hex/rgba,
  // which works for BOTH standard React divs AND Plotly charts!
  // It completely bypasses the CSS var bug in canvas and ensures the text is bright.
  
  const original = content;
  
  // Actually let's just do it globally for C.ice60 and C.ice30 inside style representations
  // But wait, C.ice is still var(--text). If Plotly uses C.ice it fails too! Does Plotly use C.ice?
  content = content.replace(/color:\s*C\.ice([36]0)?\b/g, (match, p1) => {
     // If it's a DOM element, maybe it's fine to become plotText.
     // But we only want to target if it's near tickfont/titlefont/font:
     return match; // skip for now we will use regex specifically
  });

  content = content.replace(/(tickfont|titlefont|font)\s*:\s*\{\s*([^}]*?)color\s*:\s*C\.ice([36]0)?(.*?)\}/g, "$1: { $2color: plotText$4 }");
  content = content.replace(/gridcolor\s*:\s*'rgba\(255,\s*255,\s*255,\s*0\.0[56]\)'/g, "gridcolor: plotGrid");
  
  if (content !== original) {
      fs.writeFileSync(filepath, content);
      console.log(`Updated ${file}`);
  }
}
