const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'HrDashboard.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Fix handleSendOnboardingEmail
const sendFunctionRegex = /const handleSendOnboardingEmail = async \([^)]+\) => \{[\s\S]*?finally \{\s*setSendingEmailId\(null\);\s*setEmailPreviewEmp\(null\);\s*\}\s*\};/m;

const newSendFunction = `const handleSendOnboardingEmail = async (emp: any) => {
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
      if (!res.ok) throw new Error(data.error || '發送報到通知信失敗');
      
      setInfoMsg(\`📧 \${data.message || \`成功發送報到通知信至 \${emp.name} 的信箱 (\${emp.email})\`}\`);
      
      fetch('/api/hr/activity-logs')
        .then(r => r.json())
        .then(logs => setActivityLogs(logs))
        .catch(() => {});
    } catch (err: any) {
      setErrorMsg(err.message || '連線異常，發送失敗');
    } finally {
      setSendingEmailId(null);
      setEmailPreviewEmp(null);
    }
  };`;

content = content.replace(sendFunctionRegex, newSendFunction);

// 2. Fix handleCreateAndSendEmail
const createSendRegex = /const handleCreateAndSendEmail = async \(\) => \{[\s\S]*?catch \(err: any\) \{\s*setErrorMsg\(err\.message \|\| '連線異常，無法完成建立與發送'\);\s*\}\s*finally \{\s*setSubmitting\(false\);\s*\}\s*\};/m;

const newCreateSend = `const handleCreateAndSendEmail = async () => {
    setErrorMsg('');
    setInfoMsg('');

    if (!newEmp.name || !newEmp.email || !newEmp.authToken || !newEmp.title) {
      setErrorMsg('⚠️ 欄位未填寫完整，請核對步驟一與步驟二');
      return;
    }

    setSubmitting(true);
    try {
      // Step 1: Create employee
      const res = await fetch('/api/hr/employees', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-operator-email': encodeURIComponent(currentUser?.email || ''),
          'x-operator-name': encodeURIComponent(currentUser?.name || '')
        },
        body: JSON.stringify(newEmp)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '建立報到卡失敗');
      
      const createdId = data.employee.id;

      // Step 2: Send onboarding email via backend API
      const mailRes = await fetch(\`/api/hr/employees/\${createdId}/send-onboarding-email\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-operator-email': encodeURIComponent(currentUser?.email || ''),
          'x-operator-name': encodeURIComponent(currentUser?.name || currentUser?.email || '')
        }
      });
      
      const mailData = await mailRes.json();
      if (!mailRes.ok) throw new Error(mailData.error || '報到通知信發送失敗');

      setInfoMsg(\`📧 \${mailData.message || \`已成功建立報到卡並發送通知信至 \${newEmp.email}\`}\`);
      
      fetchEmployees();
      fetchActivityLogs();

      // Clear newEmp form
      setNewEmp({
        name: '',
        empId: '',
        email: '',
        authToken: '',
        department: '雲朗觀光股份有限公司',
        title: '',
        onboardDate: new Date().toISOString().split('T')[0],
        contractWorkLocation: '總公司 (台北市中山區中山北路二段96號8樓)',
        contractLeaveOption: 'biweekly',
        contractLeavedays: '8',
        contractSalaryType: 'monthly',
        contractSalaryAmount: '36,000',
        contractProbationMonths: '三'
      });
      setSelectedBranchIdx(0);
      setAddSubMenu('basic');
      setActiveMenu('tracker');
    } catch (err: any) {
      setErrorMsg(err.message || '連線異常，無法完成建立與發送');
    } finally {
      setSubmitting(false);
    }
  };`;

content = content.replace(createSendRegex, newCreateSend);

// 3. Replace the Google Auth blocks in UI
// Modal connector box (line 4376 to 4429 approx)
const modalConnectorBoxRegex = /\{\/\* Google \/ Gmail Auth Connector Box inside the modal \*\/\}(.|\n)*?\{\/\* Email Metadata Details \*\/\}/m;
const newModalConnectorBox = `{/* Env Gmail Status Box inside the modal */}
            <div className="bg-stone-50 border border-stone-200/60 rounded-xl p-4 space-y-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <div>
                    <h4 className="text-xs font-bold text-stone-850">
                      🟢 系統已整合 Gmail 自動發送功能
                    </h4>
                    <p className="text-[11px] text-stone-500">
                      本系統已自動取得管理員信箱設定，將透過後端直接發送信件。
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Email Metadata Details */}`;
content = content.replace(modalConnectorBoxRegex, newModalConnectorBox);

// Send buttons in Modal (line 4480 approx)
const modalSendButtonRegex = /\{sendingEmailId === emailPreviewEmp\.id(.|\n)*?發送測試'\}/m;
const newModalSendButton = `{sendingEmailId === emailPreviewEmp.id 
                  ? '寄送中...' 
                  : '確認並發送信件'}`;
content = content.replace(modalSendButtonRegex, newModalSendButton);

// Form connector box (line 2614 to 2668 approx)
const formConnectorBoxRegex = /\{\/\* Google \/ Gmail Auth Connector Box \*\/\}(.|\n)*?\{\/\* Onboarding Notification Email Box \*\/\}/m;
const newFormConnectorBox = `{/* Env Gmail Status Box */}
                      <div className="bg-stone-50 border border-stone-200/60 rounded-2xl p-5 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between select-none">
                          <div className="flex items-center gap-2.5">
                            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                            <div>
                              <h4 className="text-xs font-bold text-stone-850">
                                🟢 系統已整合 Gmail 自動發送功能
                              </h4>
                              <p className="text-[11px] text-stone-500">
                                本系統已自動取得管理員信箱設定，將透過後端直接發送信件。
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Onboarding Notification Email Box */}`;
content = content.replace(formConnectorBoxRegex, newFormConnectorBox);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Successfully updated HrDashboard.tsx');
