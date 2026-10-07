const fs = require('fs');
let hrDash = fs.readFileSync('c:/Users/gordon.huang/Desktop/Test2/bonus-salary-platform/src/components/HrDashboard.tsx', 'utf8');

const brokenInterfaceRegex = /interface HrDashboardProps \{[\s\S]*?onLogout: \(\) => void;\n\}/;
const fixedInterface = `interface HrDashboardProps {
  currentUser: { email: string; name: string };
  initialEmployees: Employee[];
  onLogout: () => void;
  activeMenu?: 'tracker' | 'add' | 'admins' | 'logs';
  setActiveMenu?: (menu: 'tracker' | 'add' | 'admins' | 'logs') => void;
}`;

// Actually let's just find "interface HrDashboardProps {" and replace up to the NEXT "}" that has a newline after it?
// Or just match it manually.
hrDash = hrDash.replace(/interface HrDashboardProps \{[\s\S]*?onLogout: \(\) => void;/s, `interface HrDashboardProps {
  currentUser: { email: string; name: string };
  initialEmployees: Employee[];
  onLogout: () => void;`);

// Clean up any weird leftovers
hrDash = hrDash.replace(/interface HrDashboardProps \{[\s\S]*?initialEmployees: Employee\[\];/s, `interface HrDashboardProps {
  currentUser: { email: string; name: string };
  initialEmployees: Employee[];
  onLogout: () => void;
  activeMenu?: 'tracker' | 'add' | 'admins' | 'logs';
  setActiveMenu?: (menu: 'tracker' | 'add' | 'admins' | 'logs') => void;
}`);

// Wait, let's just replace the whole file content that matches the general area
const areaRegex = /interface HrDashboardProps \{[\s\S]*?const BRANCHES = \[/;
const newArea = `interface HrDashboardProps {
  currentUser: { email: string; name: string };
  initialEmployees: Employee[];
  onLogout: () => void;
  activeMenu?: 'tracker' | 'add' | 'admins' | 'logs';
  setActiveMenu?: (menu: 'tracker' | 'add' | 'admins' | 'logs') => void;
}

const BRANCHES = [`;

hrDash = hrDash.replace(areaRegex, newArea);

fs.writeFileSync('c:/Users/gordon.huang/Desktop/Test2/bonus-salary-platform/src/components/HrDashboard.tsx', hrDash, 'utf8');
console.log('Fixed HrDashboardProps');
