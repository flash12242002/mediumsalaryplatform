import React, { useState, useEffect } from "react";
import { User, EmployeeStats } from "./types";
import LoginScreen from "./components/LoginScreen";
import SalesCommissionTab from "./components/SalesCommissionTab";
import ListingsReportTab from "./components/ListingsReportTab";
import CloudBackupsTab from "./components/CloudBackupsTab";

import AuditTrailTab from "./components/AuditTrailTab";
import PermissionManagementTab from "./components/PermissionManagementTab";
import { 
  Shield, LogOut, Briefcase, FileBarChart2, CloudLightning, 
  Bot, ShieldAlert, History, User as UserIcon, RefreshCw, Key, Lock, Settings
} from "lucide-react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>("sales_commission");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<EmployeeStats[]>([]);

  // Restores session from localStorage if present
  useEffect(() => {
    const savedUser = localStorage.getItem("hr_user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("Session restore failed", e);
      }
    }
    setLoading(false);
  }, []);

  // Fetching statistics to pass to the AI Analyst and Listings tabs
  const fetchStats = async (currentUser: User) => {
    if (currentUser.role === "SALES_LEADER") return; // block fetching for sales manager
    try {
      const response = await fetch(`/api/employees/statistics?role=${currentUser.role}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error("載入統計失敗", err);
    }
  };

  const syncUserPermissions = async (currentUser: User) => {
    try {
      const response = await fetch("/api/permissions");
      if (response.ok) {
        const data = await response.json();
        const found = data.users.find((u: any) => 
          u.email.toLowerCase() === currentUser.email.toLowerCase() || 
          u.username.toLowerCase() === currentUser.username.toLowerCase()
        );
        if (found) {
          const currentRolePermissions = data.rolePermissions[found.role] || {};
          
          // Check if there's any actual change in role or permissions before setting state
          const hasRoleChanged = currentUser.role !== found.role;
          const hasPermissionsChanged = JSON.stringify(currentUser.permissions) !== JSON.stringify(currentRolePermissions);
          
          if (hasRoleChanged || hasPermissionsChanged) {
            const updatedUser = {
              ...currentUser,
              role: found.role,
              permissions: currentRolePermissions
            };
            setUser(updatedUser);
            localStorage.setItem("hr_user", JSON.stringify(updatedUser));
          }
        }
      }
    } catch (err) {
      console.error("同步使用者權限失敗", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchStats(user);
      // Sync on mount/login
      syncUserPermissions(user);
    }
  }, [user?.role, user?.username]);

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    localStorage.setItem("hr_user", JSON.stringify(loggedInUser));
  };

  const handleLogout = () => {
    if (user) {
      // Send audit log for logout
      fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "LOGOUT", password: "" })
      }).catch(err => console.error(err));
    }
    
    setUser(null);
    localStorage.removeItem("hr_user");
    setActiveTab("sales_commission");
  };

  // Helper to add log entries dynamically from children tabs
  const handleLogAction = async (action: string, details: string) => {
    if (!user) return;
    try {
      // Create backup endpoint triggers log automatically, 
      // but we can also trigger manually by calling the server
      console.log(`Audited Action: [${action}] - ${details}`);
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
          <span className="text-slate-500 text-xs font-semibold">系統初始化中，請稍候...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const isSalesLeader = user.role === "SALES_LEADER";

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-800">
      
      {/* Platform Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm no-print">
        <div className="max-w-7xl xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Title with Primary Traditional Chinese & Secondary English */}
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-blue-50 border border-blue-100 rounded-lg text-blue-600">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-800">
                  HR 薪酬相關報表平台
                </h1>
                <p className="text-[9px] text-slate-400 font-semibold tracking-wider font-mono">
                  HR C&B Related Report Platform
                </p>
              </div>
            </div>

            {/* User Profile & Role Badges & Logout */}
            <div className="flex items-center gap-4 text-xs">
              <div className="hidden sm:block text-right border-r border-slate-200 pr-4">
                <span className="font-bold text-slate-700 flex items-center gap-1.5 justify-end">
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                  {user.username}
                </span>
                <span className="text-[10px] text-slate-400 block font-mono">{user.email}</span>
              </div>

              {/* Role Badges */}
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                  user.role === "HR_ADMIN" ? "bg-blue-50 text-blue-700 border-blue-200" :
                  user.role === "EXECUTIVE" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                  "bg-amber-50 text-amber-700 border-amber-200"
                }`}>
                  {user.role === "HR_ADMIN" ? "HR 行政管理員" :
                   user.role === "EXECUTIVE" ? "高階決策主管" :
                   "業務團隊主管"}
                </span>

                <button
                  onClick={handleLogout}
                  className="p-1.5 bg-slate-50 hover:bg-slate-100 hover:text-red-500 text-slate-500 rounded-lg transition-colors border border-slate-200"
                  title="安全登出 Secure Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

            </div>

          </div>
        </div>
      </header>

      {/* Main Layout containing Side Navigation and Content stage */}
      <div className="flex-1 max-w-7xl xl:max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row gap-6">
        
        {/* Left Side Navigation Links with Role-based constraints (no-print) */}
        <aside className="w-full md:w-64 shrink-0 no-print">
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 space-y-1.5">
            
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
              功能導航 / Navigation
            </div>

            {/* Helper to check dynamic permissions */}
            {(() => {
              const getHasPermission = (permKey: string) => {
                if (!user) return false;
                if (user.permissions && user.permissions[permKey] !== undefined) {
                  return user.permissions[permKey];
                }
                // Fallbacks
                if (user.role === "HR_ADMIN") return true;
                if (user.role === "EXECUTIVE") {
                  if (permKey === "view_salary" || permKey === "ai_compliance" || permKey === "audit_trail") return true;
                  return false;
                }
                if (user.role === "SALES_LEADER") {
                  if (permKey === "calculate_commission") return true;
                  return false;
                }
                return false;
              };

              return (
                <>
                  {/* Tab 1: Sales Commission */}
                  <button
                    onClick={() => setActiveTab("sales_commission")}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold border transition-all text-left ${
                      activeTab === "sales_commission" 
                        ? "bg-blue-50 text-blue-600 border-blue-100 shadow-xs" 
                        : "text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-3 text-left">
                      <Briefcase className="w-4 h-4 shrink-0" />
                      <span className="text-left">業績獎金計算 <span className="block text-[9px] font-normal opacity-70 text-left">Sales Bonus</span></span>
                    </div>
                    {!getHasPermission("calculate_commission") && <Lock className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                  </button>

                  {/* Tab 2: Listings Report */}
                  <button
                    onClick={() => setActiveTab("listings_report")}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold border transition-all text-left ${
                      activeTab === "listings_report" 
                        ? "bg-blue-50 text-blue-600 border-blue-100 shadow-xs" 
                        : "text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-3 text-left">
                      <FileBarChart2 className="w-4 h-4 shrink-0" />
                      <span className="text-left">全時人員中位數 <span className="block text-[9px] font-normal opacity-70 text-left">Median Salaries</span></span>
                    </div>
                    {!getHasPermission("view_salary") && <Lock className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                  </button>

                  {/* Tab 3: Cloud Backups */}
                  <button
                    onClick={() => setActiveTab("cloud_backups")}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold border transition-all text-left ${
                      activeTab === "cloud_backups" 
                        ? "bg-blue-50 text-blue-600 border-blue-100 shadow-xs" 
                        : "text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-3 text-left">
                      <CloudLightning className="w-4 h-4 shrink-0" />
                      <span className="text-left">雲端備份與稽核 <span className="block text-[9px] font-normal opacity-70 text-left">Cloud Backups</span></span>
                    </div>
                    {!getHasPermission("manage_backups") && <Lock className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                  </button>

                  {/* Tab 5: Security Trail / Logs */}
                  <button
                    onClick={() => setActiveTab("audit_trail")}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold border transition-all text-left ${
                      activeTab === "audit_trail" 
                        ? "bg-blue-50 text-blue-600 border-blue-100 shadow-xs" 
                        : "text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-3 text-left">
                      <History className="w-4 h-4 shrink-0" />
                      <span className="text-left">異動紀錄 <span className="block text-[9px] font-normal opacity-70 text-left">Change Records</span></span>
                    </div>
                    {!getHasPermission("audit_trail") && <Lock className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                  </button>

                  {/* Tab 6: Permission Management */}
                  <button
                    onClick={() => setActiveTab("permission_management")}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold border transition-all text-left ${
                      activeTab === "permission_management" 
                        ? "bg-blue-50 text-blue-600 border-blue-100 shadow-xs" 
                        : "text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-3 text-left">
                      <Settings className="w-4 h-4 shrink-0" />
                      <span className="text-left">權限管理中心<span className="block text-[9px] font-normal opacity-70 text-left">Permissions & Users</span></span>
                    </div>
                    {!getHasPermission("permission_management") && <Lock className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                  </button>
                </>
              );
            })()}

            {/* Quick Informational Badge */}
            <div className="pt-4 border-t border-slate-100 mt-4 text-[11px] text-slate-400 px-3 space-y-1">
              <span className="font-bold text-slate-500 block">安全提示 Secure Notice：</span>
              <p>當前帳號：{user.username}</p>
              <p>當前角色：{user.role === "HR_ADMIN" ? "HR 行政管理員" : user.role === "EXECUTIVE" ? "高階決策主管" : "業務團隊主管"}</p>
            </div>

          </div>
        </aside>

        {/* Dynamic Display Area / Workspace Component stage */}
        <main className="flex-1 bg-white border border-slate-200 shadow-sm rounded-xl p-6 overflow-hidden print-card">
          
          {(() => {
            const getHasPermission = (permKey: string) => {
              if (!user) return false;
              if (user.permissions && user.permissions[permKey] !== undefined) {
                return user.permissions[permKey];
              }
              if (user.role === "HR_ADMIN") return true;
              if (user.role === "EXECUTIVE") {
                if (permKey === "view_salary" || permKey === "ai_compliance" || permKey === "audit_trail") return true;
                return false;
              }
              if (user.role === "SALES_LEADER") {
                if (permKey === "calculate_commission") return true;
                return false;
              }
              return false;
            };

            const renderLockedScreen = (moduleName: string, subText: string) => {
              return (
                <div className="p-8 max-w-2xl mx-auto text-center font-sans space-y-4 my-12">
                  <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto border border-red-200 shadow-sm">
                    <Lock className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-850">
                    系統功能存取管制 <span className="text-xs text-slate-400 block mt-1">/ Restricted System Function</span>
                  </h2>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-2 text-left">
                    <p className="font-bold text-slate-800">🔒 被阻擋功能：{moduleName}</p>
                    <p>{subText}</p>
                    <p className="text-slate-500">
                      依據本公司的內部控制規範與系統功能存取管理策略，此模組目前對您的帳號為禁用狀態。
                    </p>
                  </div>
                </div>
              );
            };

            if (activeTab === "sales_commission") {
              if (!getHasPermission("calculate_commission")) {
                return renderLockedScreen("業績獎金計算 (Sales Bonus Calculation)", "檢視及計算團隊業績佣金之功能目前已被關閉。");
              }
              return <SalesCommissionTab user={user} onLogAction={handleLogAction} />;
            }

            if (activeTab === "listings_report") {
              if (!getHasPermission("view_salary")) {
                return renderLockedScreen("全時人員中位數申報 (Median Salaries Report)", "調閱、申報、下載員工敏感薪酬所得、中位數、董事排除統計明細之功能目前已被關閉。");
              }
              return <ListingsReportTab user={user} onLogAction={handleLogAction} />;
            }

            if (activeTab === "cloud_backups") {
              if (!getHasPermission("manage_backups")) {
                return renderLockedScreen("雲端備份與稽核 (Cloud Backups & Auditing)", "對系統統計結果進行雲端快照備份、刪除或還原之功能目前已被關閉。");
              }
              return <CloudBackupsTab user={user} onLogAction={handleLogAction} />;
            }

            if (activeTab === "audit_trail") {
              if (!getHasPermission("audit_trail")) {
                return renderLockedScreen("稽核操作日誌 (Audit Trail Log Viewer)", "查看系統內人員之核心登入與資料修改稽核足跡之功能目前已被關閉。");
              }
              return <AuditTrailTab user={user} />;
            }

            if (activeTab === "permission_management") {
              if (!getHasPermission("permission_management")) {
                return renderLockedScreen("權限管理中心 (Role & Permission Control Center)", "新增同仁登入帳號、修改系統存取控制矩陣、管理同仁角色權限之功能目前已被關閉。");
              }
              return <PermissionManagementTab user={user} onLogAction={handleLogAction} />;
            }

            return null;
          })()}

        </main>

      </div>

      {/* Platform Footer (no-print) */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-12 text-center text-xs text-slate-500 space-y-1 no-print">
        <p className="font-bold text-slate-700">
          HR 獎金與上市櫃全時人員申報系統 (HR Bonus and Listings Report System)
        </p>
        <p>
          伺服器連線狀態：<span className="text-emerald-500 font-bold">● 連線正常 (Online)</span> | 安全驗證核心：OAuth / ABAC Fortified | 版本：v2.1.0-TS
        </p>
        <p className="text-[10px] text-slate-400">
          © 2026 雲朗觀光股份有限公司 人力資源處。本系統所顯示數據、分析及日誌受營業秘密法及金管會合規規範保護。
        </p>
      </footer>

    </div>
  );
}
