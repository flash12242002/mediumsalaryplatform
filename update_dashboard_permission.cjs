const fs = require('fs');
let pd = fs.readFileSync('c:/Users/gordon.huang/Desktop/Test2/bonus-salary-platform/src/components/PlatformDashboard.tsx', 'utf8');

// Update ai_compliance to onboarding_portal
pd = pd.replace(/ai_compliance/g, 'onboarding_portal');

// Hide the onboarding tab button if no permission
const onboardingBtnRegex = /(\{\/\* Tab 6: Onboarding \*\/\}\s*\<button[\s\S]*?\<\/button\>\s*\{\s*activeTab === "onboarding" && \([\s\S]*?\n\s*\)\s*\})/;
const match = pd.match(onboardingBtnRegex);
if(match) {
  pd = pd.replace(match[1], `{getHasPermission('onboarding_portal') && (
                    <>
                      ${match[1]}
                    </>
                  )}`);
}

// Ensure the actual tab content is also blocked
const onboardingTabContentRegex = /(if \(activeTab === "onboarding"\) \{\s*return \(\s*\<div)/;
const match2 = pd.match(onboardingTabContentRegex);
if(match2) {
  pd = pd.replace(match2[1], `if (activeTab === "onboarding") {
              if (!getHasPermission("onboarding_portal")) {
                return renderLockedScreen("新進同仁報到追蹤 (Onboarding Portal)", "您未擁有此功能模組存取權。");
              }
              return (
                <div`);
}

fs.writeFileSync('c:/Users/gordon.huang/Desktop/Test2/bonus-salary-platform/src/components/PlatformDashboard.tsx', pd, 'utf8');
console.log('PlatformDashboard updated');
