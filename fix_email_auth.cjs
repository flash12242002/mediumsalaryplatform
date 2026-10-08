const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'HrDashboard.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Replace handleSendOnboardingEmail
const handleSendOld = content.substring(content.indexOf('  const handleSendOnboardingEmail = async (emp: any) => {'), content.indexOf('const handleDeleteEmployee = async (id: string, name: string) => {'));
const handleSendNew = `  const handleSendOnboardingEmail = async (emp: any) => {
    setSendingEmailId(emp.id);
    try {
      const res = await fetch(\`/api/hr/employees/\${emp.id}/send-onboarding-email\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-operator-email': encodeURIComponent(currentUser?.email || ''),
          'x-operator-name': encodeURIComponent(currentUser?.name || currentUser?.email || '')
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '發送失敗');
      
      setInfoMsg(\`📧 \${data.message || '報到通知信已成功發送'}\`);
      fetchEmployees();
      fetchActivityLogs();
    } catch (err: any) {
      setErrorMsg(err.message || '連線異常，發送失敗');
    } finally {
      setSendingEmailId(null);
      setEmailPreviewEmp(null);
    }
  };

  `;
content = content.replace(handleSendOld, handleSendNew);

// 2. Replace handleCreateAndSendEmail
const createSendOld = content.substring(content.indexOf('  const handleCreateAndSendEmail = async () => {'), content.indexOf('  const handleDeleteEmployee = async (id: string, name: string) => {') > -1 ? content.indexOf('  const handleDeleteEmployee = async (id: string, name: string) => {') : content.indexOf('fetchEmployees();\n      fetchActivityLogs();\n\n      // Clear newEmp form') - 100); 
// Need to be careful with the end boundary of handleCreateAndSendEmail.
