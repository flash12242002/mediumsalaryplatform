const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'HrDashboard.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// Replace main wrapper
content = content.replace(
  /className="fixed inset-0 z-50 overflow-y-auto bg-stone-900\/60 backdrop-blur-sm p-4 md:p-8 no-print flex items-start justify-center"/g,
  'className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm p-4 md:p-8 flex items-start justify-center print-modal-overlay"'
);

// Replace card wrapper
content = content.replace(
  /className="bg-stone-100 max-w-4xl w-full rounded-2xl shadow-2xl border border-stone-200 overflow-hidden my-4 text-left"/g,
  'className="bg-stone-100 max-w-4xl w-full rounded-2xl shadow-2xl border border-stone-200 overflow-hidden my-4 text-left print-modal-card"'
);

// Replace header wrapper
content = content.replace(
  /className="bg-stone-900 text-\[\#D4AF37\] px-6 py-4 flex items-center justify-between sticky top-0 z-10 no-print border-b border-\[\#D4AF37\]\/30"/g,
  'className="bg-stone-900 text-[#D4AF37] px-6 py-4 flex items-center justify-between sticky top-0 z-10 border-b border-[#D4AF37]/30 no-print-el"'
);

// Replace alert
content = content.replace(
  /className="bg-amber-50 border-b border-amber-200 px-6 py-3\.5 text-xs text-amber-800 flex items-start gap-2\.5 no-print leading-relaxed"/g,
  'className="bg-amber-50 border-b border-amber-200 px-6 py-3.5 text-xs text-amber-800 flex items-start gap-2.5 leading-relaxed no-print-el"'
);

// Replace paper container
content = content.replace(
  /className="p-8 bg-neutral-200\/40 flex justify-center overflow-auto no-print"/g,
  'className="p-8 bg-neutral-200/40 flex justify-center overflow-auto print-paper-container"'
);

// Replace A4 page
content = content.replace(
  /className="bg-white p-10 md:p-14 w-\[210mm\] min-h-\[297mm\] shadow-xl border border-stone-250 text-stone-900 mx-auto font-sans relative antialiased print-a4-preview"/g,
  'className="bg-white print-page-a4 p-10 md:p-14 w-[210mm] min-h-[297mm] shadow-xl border border-stone-250 text-stone-900 mx-auto font-sans relative antialiased"'
);

// Remove the embedded style block entirely
const styleStart = content.indexOf('{/* Embedded styles for print accuracy */}');
if (styleStart !== -1) {
  const styleEnd = content.indexOf('</style>', styleStart);
  if (styleEnd !== -1) {
    content = content.substring(0, styleStart) + content.substring(styleEnd + 8);
  }
}

// Remove the .print-container-mount wrapper
content = content.replace(
  /<div className="print-container-mount w-full">/g,
  '<div className="w-full">'
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Successfully updated HrDashboard.tsx print styles');
