import React, { useState } from 'react';
import { Shield, User, Mail, AlertCircle, X, CheckCircle } from 'lucide-react';
import LdcLogo from './LdcLogo';
// @ts-ignore
import officialLogo from '../assets/ldc_logo.svg';interface LoginProps {
  onLoginSuccess: (role: string, user: any, adminEmails?: string[]) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [role, setRole] = useState<'employee' | 'hr'>('employee');
  const [email, setEmail] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot Password modal states
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [simulatedEmail, setSimulatedEmail] = useState<any>(null);

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotLoading(true);

    try {
      const response = await fetch('/api/hr/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '密碼重置信件發送失敗，請確認此 Email 是否為授權管理員');
      }

      setForgotSuccess(true);
      if (data.simulatedEmail) {
        setSimulatedEmail(data.simulatedEmail);
      }
    } catch (err: any) {
      setForgotError(err.message || '連線逾時，請確認伺服端連線');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email) {
      setError('請輸入電子郵件');
      return;
    }

    if (role === 'hr' && !authToken) {
      setError('請輸入密碼');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          authToken: authToken.trim(),
          role: role,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '登入失敗，請確認您的帳號或密碼');
      }

      onLoginSuccess(data.role, data.user, data.adminEmails);
    } catch (err: any) {
      setError(err.message || '連線逾時，請確認伺服端連線');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 selection:bg-indigo-50 selection:text-indigo-700">
      {/* Container Card */}
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-sm transition-all duration-300">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8 text-center select-none">
          <div className="flex-shrink-0 flex items-center justify-center bg-white rounded">
            <img src={officialLogo} alt="LDC Logo" className="h-12 w-auto object-contain" />
          </div>
          <h1 className="text-sm font-semibold tracking-wide text-stone-600 font-sans mt-2 select-none">
            雲朗觀光-HR平台
          </h1>
        </div>

        {/* Tab Selection */}
        <div className="flex border border-slate-150 mb-8 p-1 bg-slate-50 rounded-xl">
          <button
            type="button"
            className={`flex-1 py-2.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all duration-200 ${
              role === 'employee'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            onClick={() => {
              setRole('employee');
              setAuthToken('');
              setError('');
            }}
          >
            <User className="w-3.5 h-3.5" />
            新進同仁報到
          </button>
          <button
            type="button"
            className={`flex-1 py-2.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all duration-200 ${
              role === 'hr'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            onClick={() => {
              setRole('hr');
              setAuthToken('');
              setError('');
            }}
          >
            <Shield className="w-3.5 h-3.5" />
            HR管理後台
          </button>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              電子信箱
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@example.com"
              className="w-full text-slate-950 px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all text-xs"
              disabled={loading}
              required
            />
          </div>

          {role === 'employee' && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  授權碼
                </label>
                <span className="text-[10px] text-slate-400">
                  例: LDC888
                </span>
              </div>
              <input
                type="text"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                placeholder="輸入6碼授權碼"
                className="w-full text-slate-950 px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all text-xs tracking-wide font-mono"
                disabled={loading}
                required
              />
            </div>
          )}

          {role === 'hr' && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  登入密碼
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail('');
                    setForgotError('');
                    setForgotSuccess(false);
                    setSimulatedEmail(null);
                    setShowForgotModal(true);
                  }}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold transition-colors cursor-pointer focus:outline-none"
                >
                  忘記密碼？
                </button>
              </div>
              <input
                type="password"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                placeholder="請輸入密碼"
                className="w-full text-slate-950 px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all text-xs"
                disabled={loading}
                required
              />
            </div>
          )}

          {/* Validation Info (HR specific info, instructions) */}
          {role === 'hr' && (
            <div className="text-[11px] text-slate-500 bg-slate-50 p-4 border border-slate-150 rounded-xl leading-relaxed space-y-1">
              <span className="font-semibold text-slate-800 block text-xs mb-1">
                🔒 HR 身分核對說明
              </span>
              <p>後台僅限授權之 HR 同仁使用登入。</p>
            </div>
          )}

          {error && (
            <p className="text-xs text-rose-600 bg-rose-50 border border-slate-200 px-4 py-2.5 rounded-lg flex items-center gap-2">
              ⚠️ {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-xl shadow-sm transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            disabled={loading}
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              '驗證身分並開始'
            )}
          </button>
        </form>

        {/* Brand Footer */}
        <div className="mt-8 text-center border-t border-slate-100 pt-5 text-[10px] text-slate-400">
          做值得的事
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-lg rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2 text-indigo-600">
                <Shield className="w-5 h-5 animate-pulse" />
                <h3 className="text-sm font-semibold text-slate-900 font-sans">HR管理者密碼重置</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors focus:outline-none cursor-pointer p-1 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5">
              {!forgotSuccess ? (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <p className="text-xs text-slate-500 leading-relaxed font-sans">
                    請輸入您的 Email。系統會核發一封<strong>專用密碼重置驗證信</strong>，憑驗證信內代碼/連結即可登入並修改您的登入密碼。
                  </p>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 font-sans">
                      人資主管電子信箱 Address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="例如: admin@example.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full text-slate-950 px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all text-xs text-slate-950"
                    />
                  </div>

                  {forgotError && (
                    <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl flex items-start gap-2 text-rose-700 text-xs font-sans">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
                      <span>{forgotError}</span>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all cursor-pointer text-center font-sans"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {forgotLoading ? (
                        <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      ) : (
                        '發送密碼重置信件'
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-5 animate-in fade-in duration-300">
                  {/* Success prompt info */}
                  <div className="p-4 bg-emerald-50 border border-emerald-150 rounded-xl flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-emerald-800 font-sans">信件模擬發送完成！</h4>
                      <p className="text-[11px] text-emerald-700 leading-relaxed mt-1 font-sans">
                        我們已成功發送密碼重置信件。因本應用目前在 AI Studio 開發沙盒，系統自動為您開啟「模擬開發郵件箱」：
                      </p>
                    </div>
                  </div>

                  {/* Simulated Mail Client Box */}
                  {simulatedEmail && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 shadow-sm">
                      <div className="bg-slate-800 px-4 py-2 flex items-center justify-between text-white text-[10px] uppercase font-mono select-none">
                        <span className="flex items-center gap-1.5 text-indigo-300 font-sans font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
                          📬 LDC 郵件安全網 (開發模擬)
                        </span>
                        <span className="text-slate-400">STATUS: DELIVERED</span>
                      </div>
                      
                      <div className="p-4 space-y-3 text-xs text-slate-700">
                        <div className="grid grid-cols-6 border-b border-slate-200/50 pb-2">
                          <span className="col-span-1 text-slate-400 font-sans">收件人:</span>
                          <span className="col-span-5 text-slate-800 font-bold font-mono">
                            {simulatedEmail.to}
                          </span>
                        </div>
                        <div className="grid grid-cols-6 border-b border-slate-200/50 pb-2">
                          <span className="col-span-1 text-slate-400 font-sans">主題:</span>
                          <span className="col-span-5 text-slate-800 font-semibold select-none">
                            {simulatedEmail.subject}
                          </span>
                        </div>
                        <div className="pt-2 leading-relaxed text-[11px] space-y-3 font-sans">
                          <p className="text-slate-600">人資主管同仁，您好：</p>
                          <p className="text-slate-600">我們收到您要求密碼重置之需求。煩請直接點選下方重置按鈕設定新密碼：</p>
                          
                          <div className="py-2 flex justify-center">
                            <a
                              href={simulatedEmail.link}
                              className="px-5 py-2.5 bg-[#343131] hover:bg-[#252222] text-[#D4AF37] font-bold text-xs rounded-xl shadow-md transition-all inline-flex items-center gap-1.5 select-none no-underline cursor-pointer"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              點擊此處重新設定我的密碼
                            </a>
                          </div>
                          
                          <p className="text-[10px] text-slate-400 leading-normal text-center select-none pt-1">
                            提示: 模擬重置連結只有 30 分鐘期效。重置後，即可返回登入。
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors cursor-pointer font-sans"
                    >
                      關閉並重新登入
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
