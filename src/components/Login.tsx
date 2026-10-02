import React, { useState } from 'react';
import { Shield, User, Mail, AlertCircle, X, CheckCircle } from 'lucide-react';
import LdcLogo from './LdcLogo';

interface LoginProps {
  onLoginSuccess: (role: 'hr' | 'OnboardEmployee', user: any, adminEmails?: string[]) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [role, setRole] = useState<'OnboardEmployee' | 'hr'>('OnboardEmployee');
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
        throw new Error(data.error || 'ÂØÜÁ¢º?çÁΩÆ‰ø°‰ª∂?ºÈÄÅÂ§±?óÔ?Ë´ãÁ¢∫Ë™çÊ≠§ Email ?ØÂê¶?∫Ê?Ê¨äÁÆ°?ÜÂì°');
      }

      setForgotSuccess(true);
      if (data.simulatedEmail) {
        setSimulatedEmail(data.simulatedEmail);
      }
    } catch (err: any) {
      setForgotError(err.message || '????æÊ?ÔºåË?Á¢∫Ë?‰º∫Ê?Á´ØÈÄ??');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email) {
      setError('Ë´ãËº∏?•ÈõªÂ≠êÈÉµ‰ª?);
      return;
    }

    if (role === 'hr' && !authToken) {
      setError('Ë´ãËº∏?•Â?Á¢?);
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
        throw new Error(data.error || '?ªÂÖ•Â§±Ê?ÔºåË?Á¢∫Ë??®Á?Â∏≥Ë??ñÂ?Á¢?);
      }

      onLoginSuccess(data.role, data.user, data.adminEmails);
    } catch (err: any) {
      setError(err.message || '????æÊ?ÔºåË?Á¢∫Ë?‰º∫Ê?Á´ØÈÄ??');
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
          <LdcLogo size="md" color="gold" className="mb-4" />
          <h1 className="text-sm font-semibold tracking-wide text-stone-600 font-sans mt-2 select-none">
            ?≤Ê??ÜÂ? ?Ä ?∑Â∑•Á∑ö‰??•ËÅ∑?±Âà∞Á≥ªÁµ±
          </h1>
        </div>

        {/* Tab Selection */}
        <div className="flex border border-slate-150 mb-8 p-1 bg-slate-50 rounded-xl">
          <button
            type="button"
            className={`flex-1 py-2.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all duration-200 ${
              role === 'OnboardEmployee'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            onClick={() => {
              setRole('OnboardEmployee');
              setAuthToken('');
              setError('');
            }}
          >
            <User className="w-3.5 h-3.5" />
            ?∞ÈÄ≤Â?‰ªÅÂ†±??          </button>
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
            HRÁÆ°Á?ÂæåÂè∞
          </button>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              ?ªÂ?‰ø°ÁÆ±
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

          {role === 'OnboardEmployee' && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  ?àÊ?Á¢?                </label>
                <span className="text-[10px] text-slate-400">
                  ‰æ? LDC888
                </span>
              </div>
              <input
                type="text"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                placeholder="Ëº∏ÂÖ•6Á¢ºÊ?Ê¨äÁ¢º"
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
                  ?ªÂÖ•ÂØÜÁ¢º
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
                  ÂøòË?ÂØÜÁ¢ºÔº?                </button>
              </div>
              <input
                type="password"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                placeholder="Ë´ãËº∏?•Â?Á¢?
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
                ?? HR Ë∫´Â??∏Â?Ë™™Ê?
              </span>
              <p>ÂæåÂè∞?ÖÈ??àÊ?‰π?HR ?å‰?‰ΩøÁî®?ªÂÖ•??/p>
            </div>
          )}

          {error && (
            <p className="text-xs text-rose-600 bg-rose-50 border border-slate-200 px-4 py-2.5 rounded-lg flex items-center gap-2">
              ?†Ô? {error}
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
              'È©óË?Ë∫´Â?‰∏¶È?Âß?
            )}
          </button>
        </form>

        {/* Brand Footer */}
        <div className="mt-8 text-center border-t border-slate-100 pt-5 text-[10px] text-slate-400">
          ?öÂÄºÂ??Ñ‰?
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
                <h3 className="text-sm font-semibold text-slate-900 font-sans">HRÁÆ°Á??ÖÂ?Á¢ºÈ?ÁΩ?/h3>
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
                    Ë´ãËº∏?•ÊÇ®??Email?ÇÁ≥ªÁµ±Ê??∏Áôº‰∏ÄÂ∞?strong>Â∞àÁî®ÂØÜÁ¢º?çÁΩÆÈ©óË?‰ø?/strong>ÔºåÊ?È©óË?‰ø°ÂÖß‰ª?¢º/????≥ÂèØ?ªÂÖ•‰∏¶‰øÆ?πÊÇ®?ÑÁôª?•Â?Á¢º„Ä?                  </p>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 font-sans">
                      ‰∫∫Ë?‰∏ªÁÆ°?ªÂ?‰ø°ÁÆ± Address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="‰æãÂ?: admin@example.com"
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
                      ?ñÊ?
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {forgotLoading ? (
                        <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      ) : (
                        '?ºÈÄÅÂ?Á¢ºÈ?ÁΩÆ‰ø°‰ª?
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
                      <h4 className="text-xs font-bold text-emerald-800 font-sans">‰ø°‰ª∂Ê®°Êì¨?ºÈÄÅÂ??êÔ?</h4>
                      <p className="text-[11px] text-emerald-700 leading-relaxed mt-1 font-sans">
                        ?ëÂÄëÂ∑≤?êÂ??ºÈÄÅÂ?Á¢ºÈ?ÁΩÆ‰ø°‰ª∂„ÄÇÂ??¨Ê??®ÁõÆ?çÂú® AI Studio ?ãÁôºÊ≤ôÁ?ÔºåÁ≥ªÁµ±Ëá™?ïÁÇ∫?®È??ü„ÄåÊ®°?¨È??ºÈÉµ‰ª∂ÁÆ±?çÔ?
                      </p>
                    </div>
                  </div>

                  {/* Simulated Mail Client Box */}
                  {simulatedEmail && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 shadow-sm">
                      <div className="bg-slate-800 px-4 py-2 flex items-center justify-between text-white text-[10px] uppercase font-mono select-none">
                        <span className="flex items-center gap-1.5 text-indigo-300 font-sans font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
                          ?ì¨ LDC ?µ‰ª∂ÂÆâÂÖ®Á∂?(?ãÁôºÊ®°Êì¨)
                        </span>
                        <span className="text-slate-400">STATUS: DELIVERED</span>
                      </div>
                      
                      <div className="p-4 space-y-3 text-xs text-slate-700">
                        <div className="grid grid-cols-6 border-b border-slate-200/50 pb-2">
                          <span className="col-span-1 text-slate-400 font-sans">?∂‰ª∂‰∫?</span>
                          <span className="col-span-5 text-slate-800 font-bold font-mono">
                            {simulatedEmail.to}
                          </span>
                        </div>
                        <div className="grid grid-cols-6 border-b border-slate-200/50 pb-2">
                          <span className="col-span-1 text-slate-400 font-sans">‰∏ªÈ?:</span>
                          <span className="col-span-5 text-slate-800 font-semibold select-none">
                            {simulatedEmail.subject}
                          </span>
                        </div>
                        <div className="pt-2 leading-relaxed text-[11px] space-y-3 font-sans">
                          <p className="text-slate-600">‰∫∫Ë?‰∏ªÁÆ°?å‰?ÔºåÊÇ®Â•ΩÔ?</p>
                          <p className="text-slate-600">?ëÂÄëÊî∂?∞ÊÇ®Ë¶ÅÊ?ÂØÜÁ¢º?çÁΩÆ‰πãÈ?Ê±Ç„ÄÇÁÖ©Ë´ãÁõ¥?•È??∏‰??πÈ?ÁΩÆÊ??ïË®≠ÂÆöÊñ∞ÂØÜÁ¢ºÔº?/p>
                          
                          <div className="py-2 flex justify-center">
                            <a
                              href={simulatedEmail.link}
                              className="px-5 py-2.5 bg-[#343131] hover:bg-[#252222] text-[#D4AF37] font-bold text-xs rounded-xl shadow-md transition-all inline-flex items-center gap-1.5 select-none no-underline cursor-pointer"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              ÈªûÊ?Ê≠§Ë??çÊñ∞Ë®≠Â??ëÁ?ÂØÜÁ¢º
                            </a>
                          </div>
                          
                          <p className="text-[10px] text-slate-400 leading-normal text-center select-none pt-1">
                            ?êÁ§∫: Ê®°Êì¨?çÁΩÆ????™Ê? 30 ?ÜÈ??üÊ??ÇÈ?ÁΩÆÂ?ÔºåÂç≥?ØË??ûÁôª?•„Ä?                          </p>
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
                      ?úÈ?‰∏¶È??∞Áôª??                    </button>
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
