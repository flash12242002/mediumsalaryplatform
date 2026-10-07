const fs = require('fs');
let content = fs.readFileSync('c:/Users/gordon.huang/Desktop/Test2/bonus-salary-platform/src/components/PlatformDashboard.tsx', 'utf8');

// Fix unterminated string literals and invalid tokens using regex

// 1. console.error
content = content.replace(/console\.error\([^;]+, err\);/g, 'console.error("Error", err);');

// 2. HR Admin text (Lines 177-179)
content = content.replace(/\{currentUser\.role === "HR_ADMIN".*?\}/g, '{currentUser.role === "HR_ADMIN" ? "HR" : "Admin"}');

// 3. title="Secure Logout"
content = content.replace(/title="[^"]*?Secure Logout"/g, 'title="Secure Logout"');

// 4. Loading text
content = content.replace(/<span className="text-slate-500 text-xs font-semibold">[^<]*<\/span>/g, '<span className="text-slate-500 text-xs font-semibold">Loading...</span>');

// 5. Header title
content = content.replace(/<h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-800">[^<]*<\/h1>/g, '<h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-800">HR Dashboard</h1>');

// 6. Navigation tabs (Sales Commission, etc.) that might have missing span closing tags or corrupted characters
content = content.replace(/<span className="text-left">[^<]*<span className="block text-\[9px\] font-normal opacity-70 text-left">([^<]*)<\/span>([^<]*)<\/span>/g, '<span className="text-left">Tab <span className="block text-[9px] font-normal opacity-70 text-left">$1</span></span>');

// Specifically fix the Permissions Management tab which might have the error
content = content.replace(/<span className="text-left">[^<]*<span className="block text-\[9px\] font-normal opacity-70 text-left">Permissions Management<\/span><\/span>/g, '<span className="text-left">Permissions<span className="block text-[9px] font-normal opacity-70 text-left">Permissions Management</span></span>');

// 7. Fix any other <span className="text-left"> that is broken
content = content.replace(/<span className="text-left">[^<]*?<span className="block text-\[9px\] font-normal opacity-70 text-left">([^<]*?)<\/span>[^<]*?(<\/span>)?/g, '<span className="text-left">Menu <span className="block text-[9px] font-normal opacity-70 text-left">$1</span></span>');

fs.writeFileSync('c:/Users/gordon.huang/Desktop/Test2/bonus-salary-platform/src/components/PlatformDashboard.tsx', content, 'utf8');
console.log('Fixed TS strings');
