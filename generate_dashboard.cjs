const fs = require('fs');
let appOld = fs.readFileSync('c:/Users/gordon.huang/Desktop/Test2/bonus-salary-platform/src/App_old2.tsx', 'utf8');

appOld = appOld.replace('export default function App() {', 'import HrDashboard from "./HrDashboard";\nexport default function PlatformDashboard({ currentUser, onLogout }: any) {');

appOld = appOld.replace('const [user, setUser] = useState<User | null>(null);', '');
appOld = appOld.replace(/user\b/g, 'currentUser');
appOld = appOld.replace(/currentUser\?/g, 'currentUser?');
appOld = appOld.replace('const [activeTab, setActiveTab] = useState<string>("sales_commission");', 'const [activeTab, setActiveTab] = useState<string>("onboarding");');

const onboardingTab = `
                  {/* Tab 6: Onboarding */}
                  <button
                    onClick={() => setActiveTab("onboarding")}
                    className={\`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold border transition-all text-left \${
                      activeTab === "onboarding" 
                        ? "bg-blue-50 text-blue-600 border-blue-100 shadow-xs" 
                        : "text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-900"
                    }\`}
                  >
                    <div className="flex items-center gap-3 text-left">
                      <UserIcon className="w-4 h-4 shrink-0" />
                      <span className="text-left">新進同仁報到追蹤 <span className="block text-[9px] font-normal opacity-70 text-left">Onboarding Portal</span></span>
                    </div>
                  </button>
`;

appOld = appOld.replace('{/* Tab 1: Sales Commission */}', onboardingTab + '\n                  {/* Tab 1: Sales Commission */}');

const hrDashboardRender = `
          {activeTab === "onboarding" && (
            <div className="w-full h-[85vh] bg-[#F8FAFC] rounded-xl shadow-sm border border-slate-200 overflow-hidden relative overflow-y-auto no-print">
              <HrDashboard currentUser={currentUser} initialEmployees={[]} onLogout={onLogout} />
            </div>
          )}
`;

appOld = appOld.replace('{activeTab === "sales_commission" && <SalesCommissionTab', hrDashboardRender + '\n          {activeTab === "sales_commission" && <SalesCommissionTab');

// Also remove the login redirect from App_old because App.tsx handles it now
appOld = appOld.replace(`  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }`, '');

// Also remove handleLogout since it's passed as prop
appOld = appOld.replace(/const handleLogout = \(\) => {[\s\S]*?setActiveTab\("sales_commission"\);\n  };/, '');

fs.writeFileSync('c:/Users/gordon.huang/Desktop/Test2/bonus-salary-platform/src/components/PlatformDashboard.tsx', appOld, 'utf8');
console.log('Created PlatformDashboard.tsx');
