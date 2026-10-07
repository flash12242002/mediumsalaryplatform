const fs = require('fs');

let at = fs.readFileSync('c:/Users/gordon.huang/Desktop/Test2/bonus-salary-platform/src/components/AuditTrailTab.tsx', 'utf8');

// Add HrDashboard import
if (!at.includes('import HrDashboard')) {
  at = at.replace(
    /import \{[^\}]+\} from "lucide-react";/,
    '$&\nimport HrDashboard from "./HrDashboard";'
  );
}

// Add state for subTab
at = at.replace(
  /const \[loading, setLoading\] = useState\(true\);/,
  'const [loading, setLoading] = useState(true);\n  const [subTab, setSubTab] = useState<"system_logs" | "onboarding_logs">("system_logs");'
);

// Add toggle UI and conditionally render the main logs or HrDashboard logs
const headerRegex = /(\<div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-4"\>[\s\S]*?\<\/div\>)/;

const toggleUI = `
      {/* Sub Tab Selector */}
      <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 w-fit mb-4">
        <button
          onClick={() => setSubTab("system_logs")}
          className={\`px-4 py-2 text-sm font-bold rounded-md transition-all \${
            subTab === "system_logs" 
              ? "bg-white text-slate-900 shadow-xs border border-slate-200/50" 
              : "text-slate-600 hover:text-slate-900"
          }\`}
        >
          系統異動紀錄
        </button>
        <button
          onClick={() => setSubTab("onboarding_logs")}
          className={\`px-4 py-2 text-sm font-bold rounded-md transition-all \${
            subTab === "onboarding_logs" 
              ? "bg-white text-slate-900 shadow-xs border border-slate-200/50" 
              : "text-slate-600 hover:text-slate-900"
          }\`}
        >
          Onboarding異動紀錄
        </button>
      </div>

      {subTab === "system_logs" && (
        <div className="space-y-6">
`;

at = at.replace(headerRegex, '$1\n\n' + toggleUI);

// Close the system_logs div and add the onboarding_logs div
at = at.replace(
  /\<\/div\>\s*\n\s*\<\/div\>\s*\n\s*\)\;\s*\n\}\s*$/,
  `        </div>\n      )}

      {subTab === "onboarding_logs" && (
        <div className="w-full bg-[#F8FAFC] rounded-xl shadow-sm border border-slate-200 overflow-hidden relative overflow-y-auto no-print" style={{height: '70vh'}}>
           <HrDashboard currentUser={user} initialEmployees={[]} onLogout={() => {}} activeMenu="logs" />
        </div>
      )}
    </div>
  );
}
`
);

fs.writeFileSync('c:/Users/gordon.huang/Desktop/Test2/bonus-salary-platform/src/components/AuditTrailTab.tsx', at, 'utf8');
console.log('AuditTrailTab updated for logs');
