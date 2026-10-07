const fs = require('fs');
let at = fs.readFileSync('c:/Users/gordon.huang/Desktop/Test2/bonus-salary-platform/src/components/AuditTrailTab.tsx', 'utf8');

// Add import
if (!at.includes('import HrDashboard')) {
  at = at.replace(
    /import \{[^\}]+\} from "lucide-react";/,
    '$&\nimport HrDashboard from "./HrDashboard";'
  );
}

// Add state
at = at.replace(
  /const \[loading, setLoading\] = useState\(true\);/,
  'const [loading, setLoading] = useState(true);\n  const [subTab, setSubTab] = useState<"system_logs" | "onboarding_logs">("system_logs");'
);

// We want to insert the toggle AFTER the header, which is just before "{/* Searching and Filtering */}"
const splitPoint = at.indexOf('{/* Searching and Filtering */}');
if (splitPoint === -1) throw new Error("Could not find Searching and Filtering");

const part1 = at.slice(0, splitPoint);
const part2 = at.slice(splitPoint);

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

const endSplitPoint = part2.lastIndexOf('</div>\n  );\n}');

const part2_inner = part2.slice(0, endSplitPoint);
const part2_end = part2.slice(endSplitPoint);

const onboardingLogsUI = `
        </div>
      )}

      {subTab === "onboarding_logs" && (
        <div className="w-full bg-[#F8FAFC] rounded-xl shadow-sm border border-slate-200 overflow-hidden relative overflow-y-auto no-print" style={{height: '70vh'}}>
           <HrDashboard currentUser={user} initialEmployees={[]} onLogout={() => {}} activeMenu="logs" />
        </div>
      )}

    `;

const finalCode = part1 + toggleUI + part2_inner + onboardingLogsUI + part2_end;

fs.writeFileSync('c:/Users/gordon.huang/Desktop/Test2/bonus-salary-platform/src/components/AuditTrailTab.tsx', finalCode, 'utf8');
console.log('AuditTrailTab updated safely!');
