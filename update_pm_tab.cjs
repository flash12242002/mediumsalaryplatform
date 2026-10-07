const fs = require('fs');

let pm = fs.readFileSync('c:/Users/gordon.huang/Desktop/Test2/bonus-salary-platform/src/components/PermissionManagementTab.tsx', 'utf8');

// Add HrDashboard import if not present
if (!pm.includes('import HrDashboard')) {
  pm = pm.replace(
    /import \{[^\}]+\} from "lucide-react";/,
    '$&\nimport HrDashboard from "./HrDashboard";'
  );
}

// Update subTab types
pm = pm.replace(
  /const \[subTab, setSubTab\] = useState\<"role_permissions" \| "add_account" \| "change_password"\>\("role_permissions"\);/,
  'const [subTab, setSubTab] = useState<"role_permissions" | "add_account" | "change_password" | "onboarding_admin">("role_permissions");'
);

// Inject the new button into subTabsSelector
const newButton = `
      <button
        onClick={() => setSubTab("onboarding_admin")}
        className={\`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 \${
          subTab === "onboarding_admin" 
            ? "bg-white text-slate-900 shadow-xs border border-slate-200/50" 
            : "text-slate-600 hover:text-slate-900"
        }\`}
      >
        <Shield className="w-4 h-4" />
        Onboarding帳號管理
      </button>
`;

pm = pm.replace(
  /(\<button\s+onClick=\{\(\) => setSubTab\(\"change_password\"\)\}[\s\S]*?\<\/button\>)/,
  '$1\n' + newButton
);

// Inject the rendering block for onboarding_admin
const renderBlock = `
      {subTab === "onboarding_admin" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Onboarding帳號管理</h3>
              <p className="text-xs text-slate-500">管理可登入「新進同仁報到追蹤」後台的 HR 帳號。</p>
            </div>
            {subTabsSelector}
          </div>
          
          <div className="w-full bg-[#F8FAFC] rounded-xl shadow-sm border border-slate-200 overflow-hidden relative overflow-y-auto no-print" style={{height: '70vh'}}>
             <HrDashboard currentUser={user} initialEmployees={[]} onLogout={() => {}} activeMenu="admins" />
          </div>
        </div>
      )}
`;

pm = pm.replace(
  /(\{\s*subTab === "change_password" && \([\s\S]*?\n      \}\))/,
  '$1\n\n' + renderBlock
);

fs.writeFileSync('c:/Users/gordon.huang/Desktop/Test2/bonus-salary-platform/src/components/PermissionManagementTab.tsx', pm, 'utf8');
console.log('PermissionManagementTab updated for admins');
