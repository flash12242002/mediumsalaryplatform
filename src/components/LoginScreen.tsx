import React, { useState } from "react";
import { User, UserRole } from "../types";
import { Shield, Key, UserCheck, AlertCircle } from "lucide-react";
import { motion } from "motion/react";

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent, customUser?: string, customPass?: string) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const targetUser = customUser || username;
    const targetPass = customPass || password;

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: targetUser, password: targetPass })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        onLoginSuccess(data.user);
      } else {
        setError(data.message || "登入失敗，請檢查帳號密碼。");
      }
    } catch (err) {
      setError("連線後端伺服器失敗，請確認伺服器是否正常運行。");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
    handleLogin({ preventDefault: () => {} } as React.FormEvent, user, pass);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans text-slate-850">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Decorative Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium rounded-full mb-4">
          <Shield className="w-3.5 h-3.5" />
          <span>協助HR同仁整理薪酬相關報表平台 | HR C&B Related Report Platform</span>
        </div>
        
        <h2 className="text-3xl font-bold text-slate-800 tracking-tight">
          HR 薪酬相關報表平台
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          HR C&B Related Report Platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white py-8 px-4 shadow-sm border border-slate-200 rounded-xl sm:px-10"
        >
          <form className="space-y-6" onSubmit={(e) => handleLogin(e)}>
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-700">
                使用者帳號 <span className="text-xs text-slate-400 font-normal">/ Account Username</span>
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="例如: hr_admin"
                  className="block w-full px-4 py-2.5 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                登入密碼 <span className="text-xs text-slate-400 font-normal">/ Password</span>
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full px-4 py-2.5 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2 text-red-700 text-xs">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 transition-colors"
              >
                {loading ? "登入驗證中..." : "安全登入 Secure Login"}
              </button>
            </div>
          </form>
        </motion.div>
        
        <p className="mt-4 text-center text-xs text-slate-400">
          安全防護：所有敏感薪資資料傳輸均經 Role-Based Access Control 加密，且稽核日誌自動追蹤。
        </p>
      </div>
    </div>
  );
}
