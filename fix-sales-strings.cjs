const fs = require('fs');
let content = fs.readFileSync('c:/Users/gordon.huang/Desktop/Test2/bonus-salary-platform/src/components/SalesCommissionTab.tsx', 'utf8');

content = content.replace(/rec\.status === ".*?" \? "bg-emerald-500"/g, 'rec.status === "已發放" ? "bg-emerald-500"');
content = content.replace(/rec\.status === ".*?" \? "bg-amber-500"/g, 'rec.status === "核准中" ? "bg-amber-500"');
content = content.replace(/rec\.status === ".*?" \? "bg-emerald-50/g, 'rec.status === "已發放" ? "bg-emerald-50');
content = content.replace(/rec\.status === ".*?" \? "bg-amber-50/g, 'rec.status === "核准中" ? "bg-amber-50');

content = content.replace(/tier\.max > 50000000 \? ".*?" : tier\.max\.toLocaleString\(\)/g, 'tier.max > 50000000 ? "以上" : tier.max.toLocaleString()');

fs.writeFileSync('c:/Users/gordon.huang/Desktop/Test2/bonus-salary-platform/src/components/SalesCommissionTab.tsx', content, 'utf8');
console.log('Fixed SalesCommissionTab.tsx');
