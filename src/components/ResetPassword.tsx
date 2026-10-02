import React, { useState } from 'react';
import { KeyRound, CheckCircle, AlertCircle, Shield } from 'lucide-react';
import LdcLogo from './LdcLogo';

interface ResetPasswordProps {
  token: string;
  onBackToLogin: () => void;
}

export default function ResetPassword({ token, onBackToLogin }: ResetPasswordProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('新密碼與確認密碼不符合，請再次確認。');
      return;
    }

    if (newPassword.length < 3) {
      setError('密碼長度至少需要 3 個字元。');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/hr/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          newPassword: newPassword.trim()
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '密碼重置失敗，連結已過期，請重新申請。');
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || '連線逾時，請確認伺服端連線');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center">
          <div className="flex justify-center mb-6">
            <CheckCircle className="w-12 h-12 text-emerald-500 animate-bounce" />
          </div>
          <h2 className="text-stone-800 text-lg font-bold mb-3">密碼重置成功</h2>
          <p className="text-xs text-stone-500 leading-relaxed mb-6">
            您的 HR 管理者帳戶登入密碼已變更完成。請使用新密碼登入。
          </p>

          <button
            onClick={onBackToLogin}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-xl shadow-sm transition-all cursor-pointer"
          >
            返回登入畫面
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8 text-center select-none">
          <LdcLogo size="md" color="gold" className="mb-4" />
          <h1 className="text-sm font-semibold tracking-wide text-stone-600 mt-2">
            雲朗觀光 ─ HR 管理者密碼重置
          </h1>
          <p className="text-[10px] text-stone-400 mt-1">請在下方設定新密碼</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              新密碼 <span className="text-rose-500">*</span>
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="請輸入新密碼"
              className="w-full text-slate-950 px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all text-xs"
              disabled={loading}
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              再次輸入新密碼 <span className="text-rose-500">*</span>
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="請再次輸入密碼以進行核對"
              className="w-full text-slate-950 px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all text-xs"
              disabled={loading}
              required
            />
          </div>

          {error && (
            <p className="text-xs text-rose-600 bg-rose-50 border border-slate-200 px-4 py-2.5 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onBackToLogin}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-xl transition-all cursor-pointer text-center"
              disabled={loading}
            >
              取消並返回
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              disabled={loading}
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                '確認變更並重設'
              )}
            </button>
          </div>
        </form>

        <div className="mt-8 text-center border-t border-slate-100 pt-5 text-[10px] text-slate-400">
          雲朗觀光 ─ 做值得的事
        </div>
      </div>
    </div>
  );
}
