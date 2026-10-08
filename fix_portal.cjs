const fs = require('fs');
const path = require('path');

function wrapWithPortal(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');

  // Add import if missing
  if (!content.includes('import { createPortal }')) {
    content = content.replace(
      "import React",
      "import React from 'react';\nimport { createPortal } from 'react-dom';\n//"
    );
  }
  
  if (filePath.includes('HrDashboard')) {
    content = content.replace(
      /\{\/\* Custom print overlay modal \*\/\}\s*\{printingEmp && printFields && \(\s*<div className="fixed inset-0[^>]+print-modal-overlay">/,
      `{/* Custom print overlay modal */}
      {printingEmp && printFields && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[999999] overflow-y-auto bg-stone-900/60 p-4 md:p-8 flex items-start justify-center print-modal-overlay">`
    );
    // Find the end of the modal. It ends with:
    //           </div>
    //         </div>
    //       )}
    const endMatch = /<\/div>\s*<\/div>\s*\)\}/g;
    let match;
    let lastMatch;
    while ((match = endMatch.exec(content)) !== null) {
      lastMatch = match;
    }
    if (lastMatch) {
      content = content.substring(0, lastMatch.index) + 
                '</div>\n        </div>,\n        document.body\n      )}' + 
                content.substring(lastMatch.index + lastMatch[0].length);
    }
  } else if (filePath.includes('PrintModals')) {
    // For PrintModals, each exported function returns a modal.
    // They start with: return ( <div className="fixed inset-0 ... print-modal-overlay">
    // and end with </div> );
    // We will just do a regex replace for the return statements.
    content = content.replace(
      /return \(\s*(<div className="fixed inset-0[^>]+print-modal-overlay">)/g,
      "return typeof document !== 'undefined' ? createPortal(\n    $1"
    );
    
    // Replace the ending </div>\n  ); with </div>,\n    document.body\n  ) : null;
    content = content.replace(
      /<\/div>\s*\);\s*\}/g,
      "</div>,\n    document.body\n  ) : null;\n}"
    );
  }

  fs.writeFileSync(filePath, content, 'utf-8');
}

wrapWithPortal(path.join(__dirname, 'src', 'components', 'HrDashboard.tsx'));
wrapWithPortal(path.join(__dirname, 'src', 'components', 'PrintModals.tsx'));
console.log('Successfully added portals to modals');
