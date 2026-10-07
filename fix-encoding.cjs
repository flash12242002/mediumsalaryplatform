const fs = require('fs');

function fixFile(file, regex, replacement) {
  try {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(regex, replacement);
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Fixed ${file}`);
  } catch (e) {
    console.error(`Error fixing ${file}:`, e);
  }
}

fixFile('src/components/Login.tsx', /setError\('請輸.*?\);/g, "setError('請輸入電子郵件');");
fixFile('src/components/EmployeeDashboard.tsx', /owner: '.*?,/g, "owner: 'Test',");
fixFile('src/components/HrDashboard.tsx', /address: '.*?,/g, "address: 'Test',");
