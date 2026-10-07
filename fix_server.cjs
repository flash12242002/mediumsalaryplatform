const fs = require('fs');
let code = fs.readFileSync('c:/Users/gordon.huang/Desktop/Test2/bonus-salary-platform/server.ts', 'utf8');

const regex = /for\s*\(\s*const\s+row\s+of\s+permRows\s*\)\s*\{[\s\S]*?typeof\s+row\.permissions\s*===\s*'string'\s*\?\s*JSON\.parse\(row\.permissions\)\s*:\s*row\.permissions;[\s\S]*?\}/;

const replacement = `for (const row of permRows) {
      let perms = typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions;
      if (perms && perms.ai_compliance !== undefined && perms.onboarding_portal === undefined) {
        perms.onboarding_portal = perms.ai_compliance;
        delete perms.ai_compliance;
      }
      rolePermissions[row.role] = perms;
    }`;

if(regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync('c:/Users/gordon.huang/Desktop/Test2/bonus-salary-platform/server.ts', code, 'utf8');
  console.log('Replaced successfully');
} else {
  console.log('Target not found in server.ts via regex');
}
