const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'HrDashboard.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

const modalStartMarker = '{/* Google / Gmail Auth Connector Box inside the modal */}';
const modalEndMarker = '{/* Email Metadata Details */}';

if (content.includes(modalStartMarker) && content.includes(modalEndMarker)) {
  const parts = content.split(modalStartMarker);
  const endParts = parts[1].split(modalEndMarker);
  
  const newModalBox = `            {/* Env Gmail Status Box inside the modal */}
            <div className="bg-stone-50 border border-stone-200/60 rounded-xl p-4 space-y-3.5 shadow-sm mb-4">
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

            `;
  content = parts[0] + newModalBox + modalEndMarker + endParts.slice(1).join(modalEndMarker);
}

const formStartMarker = '{/* Google / Gmail Auth Connector Box */}';
const formEndMarker = '{/* Onboarding Notification Email Box */}';

if (content.includes(formStartMarker) && content.includes(formEndMarker)) {
  const parts = content.split(formStartMarker);
  const endParts = parts[1].split(formEndMarker);
  
  const newFormBox = `                      {/* Env Gmail Status Box */}
                      <div className="bg-stone-50 border border-stone-200/60 rounded-2xl p-5 space-y-4 shadow-sm mb-4">
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

                      `;
  content = parts[0] + newFormBox + formEndMarker + endParts.slice(1).join(formEndMarker);
}

// Fix buttons
content = content.replace(
  /\{sendingEmailId === emailPreviewEmp\.id\s*\?\s*'寄送中\.\.\.'\s*:\s*googleToken\s*\?\s*'透過 Gmail 發送'\s*:\s*'發送測試'\}/g,
  "{sendingEmailId === emailPreviewEmp.id ? '寄送中...' : '確認並發送信件'}"
);

// Fix other send button (Create Task)
content = content.replace(
  /\{submitting \? '建立並寄送中\.\.\.' : '確認建立報到卡並發送通知信'\}/g,
  "{submitting ? '建立並寄送中...' : '確認建立報到卡並發送通知信'}"
); // No change needed for this one

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Successfully updated HrDashboard.tsx UI boxes');
