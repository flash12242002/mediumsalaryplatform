const fs = require('fs');
const path = require('path');

let filePath = path.join(__dirname, 'src', 'components', 'PrintModals.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// For PrintModals, each exported function returns a modal.
// They start with: return ( <div className="fixed inset-0 ... print-modal-overlay">
// and end with </div> );
content = content.replace(
  /return \(\s*(<div className="fixed inset-0[^>]+print-modal-overlay">)/g,
  "return typeof document !== 'undefined' ? createPortal(\n    $1"
);

// Replace the ending </div>\n  ); with </div>,\n    document.body\n  ) : null;
content = content.replace(
  /<\/div>\s*\);\s*\}/g,
  "</div>,\n    document.body\n  ) : null;\n}"
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Successfully added portals to PrintModals');
