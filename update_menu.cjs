const fs = require('fs');

// 1. Update HrDashboard.tsx
let hrDash = fs.readFileSync('c:/Users/gordon.huang/Desktop/Test2/bonus-salary-platform/src/components/HrDashboard.tsx', 'utf8');

// Update Props interface
hrDash = hrDash.replace(
  /interface HrDashboardProps \{([^}]*)\}/s, 
  `interface HrDashboardProps {
$1
  activeMenu?: 'tracker' | 'add' | 'admins' | 'logs';
  setActiveMenu?: (menu: 'tracker' | 'add' | 'admins' | 'logs') => void;
}`
);

// Update component signature
hrDash = hrDash.replace(
  /export default function HrDashboard\(\{ currentUser, initialEmployees, onLogout \}: HrDashboardProps\) \{/,
  'export default function HrDashboard({ currentUser, initialEmployees, onLogout, activeMenu: controlledActiveMenu, setActiveMenu: setControlledActiveMenu }: HrDashboardProps) {'
);

// Update internal state
hrDash = hrDash.replace(
  /const \[activeMenu, setActiveMenu\] = useState\<'tracker' \| 'add' \| 'admins' \| 'logs'\>\('tracker'\);/,
  `const [internalActiveMenu, setInternalActiveMenu] = useState<'tracker' | 'add' | 'admins' | 'logs'>('tracker');
  const activeMenu = controlledActiveMenu || internalActiveMenu;
  const setActiveMenu = setControlledActiveMenu || setInternalActiveMenu;`
);

// Hide the redundant internal nav completely (since we will render it in PlatformDashboard)
hrDash = hrDash.replace(
  /<nav className="bg-\[#343131\] text-\[#D4AF37\] px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-20 shadow-md border-b border-\[#D4AF37\]\/20 select-none">/,
  '<nav className="hidden bg-[#343131] text-[#D4AF37] px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-20 shadow-md border-b border-[#D4AF37]/20 select-none">'
);

fs.writeFileSync('c:/Users/gordon.huang/Desktop/Test2/bonus-salary-platform/src/components/HrDashboard.tsx', hrDash, 'utf8');
console.log('Updated HrDashboard');

// 2. Update PlatformDashboard.tsx
let pd = fs.readFileSync('c:/Users/gordon.huang/Desktop/Test2/bonus-salary-platform/src/components/PlatformDashboard.tsx', 'utf8');

// Add state for onboarding sub-menu
pd = pd.replace(
  /const \[activeTab, setActiveTab\] = useState\<string\>\("onboarding"\);/,
  `const [activeTab, setActiveTab] = useState<string>("onboarding");
  const [onboardingSubMenu, setOnboardingSubMenu] = useState<'tracker' | 'add' | 'admins' | 'logs'>('tracker');`
);

// Find the Onboarding tab button and inject the sub-menu below it
const onboardingSubMenuHtml = `
                  {activeTab === "onboarding" && (
                    <div className="ml-6 mt-1 flex flex-col gap-1 border-l-2 border-blue-100 pl-3 py-1">
                      <button
                        onClick={() => setOnboardingSubMenu('tracker')}
                        className={\`text-left text-xs px-2 py-1.5 rounded transition-all \${onboardingSubMenu === 'tracker' ? 'text-blue-700 font-bold bg-blue-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}\`}
                      >
                        資料填寫追蹤
                      </button>
                      <button
                        onClick={() => setOnboardingSubMenu('add')}
                        className={\`text-left text-xs px-2 py-1.5 rounded transition-all \${onboardingSubMenu === 'add' ? 'text-blue-700 font-bold bg-blue-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}\`}
                      >
                        建立報到工作
                      </button>
                      <button
                        onClick={() => setOnboardingSubMenu('admins')}
                        className={\`text-left text-xs px-2 py-1.5 rounded transition-all \${onboardingSubMenu === 'admins' ? 'text-blue-700 font-bold bg-blue-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}\`}
                      >
                        系統帳號管理
                      </button>
                      <button
                        onClick={() => setOnboardingSubMenu('logs')}
                        className={\`text-left text-xs px-2 py-1.5 rounded transition-all \${onboardingSubMenu === 'logs' ? 'text-blue-700 font-bold bg-blue-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}\`}
                      >
                        異動紀錄追蹤
                      </button>
                    </div>
                  )}
`;

pd = pd.replace(
  /\{\/\* Tab 1: Sales Commission \*\/\}/,
  onboardingSubMenuHtml + '\n                  {/* Tab 1: Sales Commission */}'
);

// Pass the props to HrDashboard
pd = pd.replace(
  /<HrDashboard currentUser=\{currentUser\} initialEmployees=\{\[\]\} onLogout=\{onLogout\} \/>/,
  '<HrDashboard currentUser={currentUser} initialEmployees={[]} onLogout={onLogout} activeMenu={onboardingSubMenu} setActiveMenu={setOnboardingSubMenu} />'
);

fs.writeFileSync('c:/Users/gordon.huang/Desktop/Test2/bonus-salary-platform/src/components/PlatformDashboard.tsx', pd, 'utf8');
console.log('Updated PlatformDashboard');
