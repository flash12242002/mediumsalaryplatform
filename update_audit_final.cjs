const fs = require('fs');
let at = fs.readFileSync('c:/Users/gordon.huang/Desktop/Test2/bonus-salary-platform/src/components/AuditTrailTab.tsx', 'utf8');

const splitPoint = at.indexOf('{/* Searching and Filtering */}');
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
          Onboarding資料異動紀錄
        </button>
      </div>

      {subTab === "system_logs" && (
        <div className="space-y-6">
`;

// Find the very last </div> which closes the <div className="space-y-6 font-sans">
// Wait, the return block ends with:
//     </div>
//   );
// }
// We want to insert the closing </div> for the system_logs before the final </div>!
const lastDivRegex = /\s*\<\/div\>\s*\n\s*\)\;\s*\n\}\s*$/;
const endMatch = part2.match(lastDivRegex);
if (!endMatch) throw new Error("End not found");

const part2_inner = part2.slice(0, endMatch.index);
const part2_end = endMatch[0];

const onboardingUI = `
        </div>
      )}

      {subTab === "onboarding_logs" && (
        <div className="w-full bg-[#F8FAFC] rounded-xl shadow-sm border border-slate-200 overflow-hidden relative overflow-y-auto no-print" style={{height: '70vh'}}>
           <HrDashboard currentUser={user} initialEmployees={[]} onLogout={() => {}} activeMenu="logs" />
        </div>
      )}
`;

const finalCode = part1 + toggleUI + part2_inner + onboardingUI + part2_end;
fs.writeFileSync('c:/Users/gordon.huang/Desktop/Test2/bonus-salary-platform/src/components/AuditTrailTab.tsx', finalCode, 'utf8');
console.log('Fixed wrapper!');
