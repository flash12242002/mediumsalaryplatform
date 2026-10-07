const fs = require('fs');
let code = fs.readFileSync('c:/Users/gordon.huang/Desktop/Test2/bonus-salary-platform/server.ts', 'utf8');

const regex = /\/\/ Employee Login Path \([\s\S]*?if\s*\(loginRole\s*===\s*'employee'\)\s*\{[\s\S]*?if\s*\(loginSecret\s*===\s*'LDC888'\s*\|\|\s*loginSecret\s*===\s*'ldc888'\)\s*\{[\s\S]*?return\s*res\.status\(401\)\.json\([\s\S]*?\}\s*\}/;

const replacement = `// Employee Login Path (checking onboard_db employees)
  if (loginRole === 'employee') {
    const normalizedEmail = loginIdentifier.trim().toLowerCase();
    
    // Check real employees DB
    const employee = employees.find(
      (emp) => emp.email.toLowerCase() === normalizedEmail && emp.authToken.trim() === loginSecret.trim()
    );

    if (employee) {
      await addAuditLog(employee.name, 'employee', "員工報到登入", "新進員工透過專屬授權碼登入系統");
      return res.json({ success: true, user: employee, role: 'employee' });
    } else {
      return res.status(401).json({ success: false, message: "登入失敗，電子郵件或授權碼不正確 (Invalid token)" });
    }
  }`;

if (regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync('c:/Users/gordon.huang/Desktop/Test2/bonus-salary-platform/server.ts', code, 'utf8');
  console.log('Successfully replaced Employee Login Path');
} else {
  console.log('Regex failed to match');
}
