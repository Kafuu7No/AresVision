const fs = require('fs');
const path = require('path');
const dir = 'd:/A-development-project/GitHubProject/OtherProject/AresVision/frontend/src';

function scan(d) {
  let results = [];
  const list = fs.readdirSync(d);
  list.forEach(file => {
    file = path.join(d, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(scan(file));
    } else {
      if (file.endsWith('.jsx') || file.endsWith('.js')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = scan(dir);
let count = 0;

files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  let orig = c;

  c = c.replace(/\{\s*'--text':\s*'#1e1e30',\s*'--text-60':\s*'rgba[^']+',\s*'--text-30':\s*'rgba[^']+'/g, 
    "{ '--text': '#000000', '--text-60': '#000000', '--text-30': '#000000'");
  c = c.replace(/\{\s*'--text':\s*'#e8edf3',\s*'--text-60':\s*'rgba[^']+',\s*'--text-30':\s*'rgba[^']+'/g, 
    "{ '--text': '#ffffff', '--text-60': '#ffffff', '--text-30': '#ffffff'");
    
  c = c.replace(/'--text-60':\s*'rgba\(0,0,0,0.7\)'/g, "'--text-60': '#000000'");
  c = c.replace(/'--text-30':\s*'rgba\(0,0,0,0.45\)'/g, "'--text-30': '#000000'");

  c = c.replace(/\?\s*'#1e1e30'\s*:\s*'#e8edf3'/g, "? '#000000' : '#ffffff'");
  
  c = c.replace(/(?:Clr|Color|textColor|dimClr|labelClr|subColor|nameClr|titleClr|metaClr|inputClr)\s*(?:=|:)\s*(?:isLight|L)\s*\?\s*'rgba\([^']+\)'\s*:\s*'rgba\([^']+\)'/g, 
    (match) => match.replace(/'rgba\([^']+\)'\s*:\s*'rgba\([^']+\)'/, "'#000000' : '#ffffff'"));
    
  c = c.replace(/(?:plotTextColor|plotText60|axisTextColor|axisTitleColor|cbLabelColor|cbTitleColor|tickColor|titleColor)\s*=\s*(?:isLight|L)\s*\?\s*'rgba\([^']+\)'\s*:\s*'rgba\([^']+\)'/g,
    (match) => match.replace(/'rgba\([^']+\)'\s*:\s*'rgba\([^']+\)'/, "'#000000' : '#ffffff'"));
    
  c = c.replace(/color:\s*(?:isLight|L)\s*\?\s*'rgba\([^']+\)'\s*:\s*'rgba\([^']+\)'/g, "color: (isLight || L) ? '#000000' : '#ffffff'");
  
  // Specific catch for ShapleyImportanceChart
  c = c.replace(/font:\s*\{\s*size:\s*10,\s*color:\s*'rgba\([^']+\)'\s*\}/g, "font: { size: 10, color: '#ffffff' }");

  if (orig !== c) {
    fs.writeFileSync(f, c, 'utf8');
    count++;
    console.log('Updated ' + path.basename(f));
  }
});
console.log('Total ' + count);
