const fs = require('fs');
const buf = fs.readFileSync('src/components/EmployeeDashboard.tsx');
const str = buf.toString('utf8');
const idx = str.indexOf('getCompanyDetails');
const nameIdx = str.indexOf("name: '", idx);
const raw = buf.slice(nameIdx, nameIdx+80);
console.log('Hex:', Buffer.from(raw).toString('hex').match(/.{1,2}/g).join(' '));
console.log('Str:', raw.toString('utf8'));

// Also show what chars look like
const chars = [...raw.toString('utf8')].slice(0, 30);
for (const ch of chars) {
  const cp = ch.codePointAt(0);
  console.log(`'${ch}' = U+${cp.toString(16).toUpperCase().padStart(4,'0')} (${cp})`);
}
