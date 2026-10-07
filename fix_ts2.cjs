const fs = require('fs');
let content = fs.readFileSync('c:/Users/gordon.huang/Desktop/Test2/bonus-salary-platform/src/components/PlatformDashboard.tsx', 'utf8');

// Fix imports
content = content.replace(/from "\.\/components\//g, 'from "./');
content = content.replace(/from "\.\/types"/g, 'from "../types"');

// Fix handleLogout
content = content.replace(/onClick=\{handleLogout\}/g, 'onClick={onLogout}');

// Remove setUser and localStorage logic since it's handled by App.tsx now
content = content.replace(/setUser\([^)]*\);/g, '');
content = content.replace(/localStorage\.setItem\("hr_user"[^)]*\);/g, '');

fs.writeFileSync('c:/Users/gordon.huang/Desktop/Test2/bonus-salary-platform/src/components/PlatformDashboard.tsx', content, 'utf8');
console.log('Fixed PlatformDashboard imports and missing vars');
