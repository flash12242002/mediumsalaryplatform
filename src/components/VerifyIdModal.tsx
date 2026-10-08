import React, { useState } from 'react';
import { X, Lock, ShieldCheck, KeyRound, AlertCircle, Sparkles } from 'lucide-react';
import { Employee } from '../types';

interface VerifyIdModalProps {
  employee: Employee | null;
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
}

export const VerifyIdModal: React.FC<VerifyIdModalProps> = ({
  employee,
  isOpen,
  onClose,
  onVerified,
}) => {
  if (!isOpen || !employee) return null;

  const [inputCode, setInputCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputCode.trim().toUpperCase();

    const isIdMatch = trimmed === employee.nationalId.trim().toUpperCase();
    const isMisTestMatch = trimmed === 'MIS';

    if (isIdMatch || isMisTestMatch) {
      setErrorMsg('');
      setInputCode('');
      onVerified();
    } else {
      setErrorMsg('驗證失敗：身分證字號不符。測試體驗請輸入 mis 即可快速解鎖！');
    }
  };

  const handleQuickMisFill = () => {
    setInputCode('mis');
    setErrorMsg('');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header matching image platform style */}
        <div className="bg-white border-b border-slate-150 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">身分驗證 • 免費客房查詢</h3>
              <p className="text-xs text-slate-400">雲朗觀光 員工個人權益隱私保護</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* Target employee profile pill */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center gap-3">
            <img
              src={employee.avatar}
              alt={employee.nameZh}
              className="w-12 h-12 rounded-xl object-cover object-top border border-slate-200 shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">{employee.nameZh}</span>
                <span className="text-slate-500 font-medium">{employee.nameEn}</span>
              </div>
              <p className="text-slate-500 text-[11px] truncate mt-0.5">
                {employee.company} • {employee.department} • {employee.title}
              </p>
            </div>
          </div>

          <div className="text-slate-600 leading-relaxed text-xs">
            為維護同仁個人福利隱私，<strong>全體通訊錄不公開剩餘免費房數與住宿歷程</strong>。欲查詢本人之免費客房配額與使用紀錄，請輸入身分證字號進行安全驗證。
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                請輸入身分證字號 (或測試密碼)
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="請輸入身分證字號或 mis..."
                  value={inputCode}
                  onChange={(e) => {
                    setInputCode(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-hidden focus:border-blue-500 focus:bg-white transition"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-1.5 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Test Password Helper as requested by user */}
            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200/60 flex items-start justify-between gap-2">
              <div className="flex items-start gap-1.5 text-[11px] text-blue-900">
                <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">測試端 MIS 快速驗證：</span>
                  測試期間可直接輸入密碼 <code className="bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-bold font-mono">mis</code> 快速通關！
                  <span className="block text-slate-400 text-[10px] mt-0.5">
                    (或輸入身分證字號：{employee.nationalId})
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleQuickMisFill}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded text-[11px] shrink-0 transition shadow-2xs"
              >
                帶入 mis
              </button>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition"
              >
                <ShieldCheck className="w-4 h-4" />
                驗證並查看
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
