import React, { useState, useEffect, useRef } from "react";
import { User, EmployeeStats } from "../types";
import LoginScreen from "./LoginScreen";
import SalesCommissionTab from "./SalesCommissionTab";
import ListingsReportTab from "./ListingsReportTab";
import CloudBackupsTab from "./CloudBackupsTab";

import AuditTrailTab from "./AuditTrailTab";
import PermissionManagementTab from "./PermissionManagementTab";
import { 
  Shield, LogOut, Briefcase, FileBarChart2, CloudLightning, 
  Bot, ShieldAlert, History, User as UserIcon, RefreshCw, Key, Lock, Settings, Clock
} from "lucide-react";
// @ts-ignore
import officialLogo from '../assets/ldc_logo.svg';

import HrDashboard from "./HrDashboard";
export default function PlatformDashboard({ currentUser, onLogout }: any) {
  
  const [activeTab, setActiveTab] = useState<string>("onboarding");
  const [onboardingSubMenu, setOnboardingSubMenu] = useState<'tracker' | 'add' | 'admins' | 'logs'>('tracker');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<EmployeeStats[]>([]);
  
  // 倒數計時狀態與時間紀錄
  const [timeLeft, setTimeLeft] = useState(1800);
  const lastActivityTime = useRef(Date.now());

  // Restores session from localStorage if present
  useEffect(() => {
    const savedUser = localStorage.getItem("hr_currentUser");
    if (savedUser) {
      try {
        // setUser removed
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
            
            localStorage.setItem("hr_currentUser", JSON.stringify(updatedUser));
          }
        }
      }
    } catch (err) {
      console.error("同步使用者權限失敗", err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchStats(currentUser);
      // Sync on mount/login
      syncUserPermissions(currentUser);
    }
  }, [currentUser?.role, currentUser?.username]);

  // 閒置超過 30 分鐘自動登出邏輯 (包含倒數計時顯示)
  useEffect(() => {
    lastActivityTime.current = Date.now();

    const updateActivity = () => {
      lastActivityTime.current = Date.now();
    };

    const intervalId = setInterval(() => {
      const remaining = 1800 - Math.floor((Date.now() - lastActivityTime.current) / 1000);
      
      if (remaining <= 0) {
        clearInterval(intervalId);
        window.alert('您已閒置超過 30 分鐘，系統已自動為您登出。');
        if (onLogout) onLogout();
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);

    const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
    // 使用 passive 選項提升效能
    events.forEach(event => window.addEventListener(event, updateActivity, { passive: true }));

    // Cleanup function
    return () => {
      clearInterval(intervalId);
      events.forEach(event => window.removeEventListener(event, updateActivity));
    };
  }, [onLogout]);

  const handleLoginSuccess = (loggedInUser: User) => {
    
    localStorage.setItem("hr_currentUser", JSON.stringify(loggedInUser));
  };

  

  // Helper to add log entries dynamically from children tabs
  const handleLogAction = async (action: string, details: string) => {
    if (!currentUser) return;
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



  const isSalesLeader = currentUser.role === "SALES_LEADER";

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-800">
      
      {/* Platform Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm no-print">
        <div className="max-w-7xl xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Title with Primary Traditional Chinese & Secondary English */}
            <div className="flex items-center gap-2.5">
              <div className="flex-shrink-0 flex items-center justify-center bg-white rounded">
                <img src={officialLogo} alt="LDC Logo" className="h-8 sm:h-10 w-auto object-contain" />
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-800">
                  雲朗觀光-HR平台
                </h1>
                <p className="text-[9px] text-slate-400 font-semibold tracking-wider font-mono">
                  HR Platform
                </p>
              </div>
            </div>

            {/* User Profile & Role Badges & Logout */}
            <div className="flex items-center gap-4 text-xs">
              
              {/* 自動登出倒數計時器 */}
              <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-mono font-bold transition-colors ${
                timeLeft < 60 
                  ? "bg-red-50 text-red-600 border-red-200 animate-pulse" 
                  : "bg-slate-50 text-slate-500 border-slate-200"
              }`}>
                <Clock className="w-3.5 h-3.5" />
                <span>
                  倒數計時 {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
                </span>
              </div>

              <div className="hidden sm:block text-right border-r border-slate-200 pr-4">
                <span className="font-bold text-slate-700 flex items-center gap-1.5 justify-end">
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                  {currentUser.username}
                </span>
                <span className="text-[10px] text-slate-400 block font-mono">{currentUser.email}</span>
              </div>

              {/* Role Badges */}
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                  currentUser.role === "HR_ADMIN" ? "bg-blue-50 text-blue-700 border-blue-200" :
                  currentUser.role === "EXECUTIVE" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                  "bg-amber-50 text-amber-700 border-amber-200"
                }`}>
                  {currentUser.role === "HR_ADMIN" ? "HR 行政管理員" :
                   currentUser.role === "EXECUTIVE" ? "高階決策主管" :
                   "業務團隊主管"}
                </span>

                <button
                  onClick={onLogout}
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
                if (!currentUser) return false;
                if (currentUser.permissions) {
                  return !!currentUser.permissions[permKey];
                }
                // Fallbacks only if permissions object is entirely missing
                if (currentUser.role === "HR_ADMIN") return true;
                if (currentUser.role === "EXECUTIVE") {
                  if (permKey === "view_salary" || permKey === "onboarding_portal" || permKey === "audit_trail") return true;
                  return false;
                }
                if (currentUser.role === "SALES_LEADER") {
                  if (permKey === "calculate_commission") return true;
                  return false;
                }
                return false;
              };

              return (
                <>
                  
                  {/* Tab 6: Onboarding */}
                  <button
                    onClick={() => setActiveTab("onboarding")}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold border transition-all text-left ${
                      activeTab === "onboarding" 
                        ? "bg-blue-50 text-blue-600 border-blue-100 shadow-xs" 
                        : "text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-3 text-left">
                      <UserIcon className="w-4 h-4 shrink-0" />
                      <span className="text-left">新進同仁報到追蹤 <span className="block text-[9px] font-normal opacity-70 text-left">Onboarding Portal</span></span>
                    </div>
                    {!getHasPermission("onboarding_portal") && <Lock className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                  </button>

                  {activeTab === "onboarding" && getHasPermission("onboarding_portal") && (
                    <div className="ml-6 mt-1 flex flex-col gap-1 border-l-2 border-blue-100 pl-3 py-1">
                      <button
                        onClick={() => setOnboardingSubMenu('tracker')}
                        className={`text-left text-xs px-2 py-1.5 rounded transition-all ${onboardingSubMenu === 'tracker' ? 'text-blue-700 font-bold bg-blue-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                      >
                        資料填寫追蹤
                      </button>
                      <button
                        onClick={() => setOnboardingSubMenu('add')}
                        className={`text-left text-xs px-2 py-1.5 rounded transition-all ${onboardingSubMenu === 'add' ? 'text-blue-700 font-bold bg-blue-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                      >
                        建立報到工作
                      </button>
                      <button
                        onClick={() => setOnboardingSubMenu('admins')}
                        className={`text-left text-xs px-2 py-1.5 rounded transition-all ${onboardingSubMenu === 'admins' ? 'text-blue-700 font-bold bg-blue-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                      >
                        系統帳號管理
                      </button>
                      <button
                        onClick={() => setOnboardingSubMenu('logs')}
                        className={`text-left text-xs px-2 py-1.5 rounded transition-all ${onboardingSubMenu === 'logs' ? 'text-blue-700 font-bold bg-blue-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                      >
                        異動紀錄追蹤
                      </button>
                    </div>
                  )}

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
              <p>當前帳號：{currentUser.username}</p>
              <p>當前角色：{currentUser.role === "HR_ADMIN" ? "HR 行政管理員" : currentUser.role === "EXECUTIVE" ? "高階決策主管" : "業務團隊主管"}</p>
            </div>

          </div>
        </aside>

        {/* Dynamic Display Area / Workspace Component stage */}
        <main className="flex-1 bg-white border border-slate-200 shadow-sm rounded-xl p-6 overflow-hidden print-card">
          
          {(() => {
            const getHasPermission = (permKey: string) => {
              if (!currentUser) return false;
              if (currentUser.permissions) {
                return !!currentUser.permissions[permKey];
              }
              if (currentUser.role === "HR_ADMIN") return true;
              if (currentUser.role === "EXECUTIVE") {
                if (permKey === "view_salary" || permKey === "onboarding_portal" || permKey === "audit_trail") return true;
                return false;
              }
              if (currentUser.role === "SALES_LEADER") {
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

            if (activeTab === "onboarding") {
              if (!getHasPermission("onboarding_portal")) {
                return renderLockedScreen("新進同仁報到追蹤 (Onboarding Portal)", "您未擁有此功能模組存取權。");
              }
              return (
                <div className="w-full h-[85vh] bg-[#F8FAFC] rounded-xl shadow-sm border border-slate-200 overflow-hidden relative overflow-y-auto no-print">
                  <HrDashboard currentUser={currentUser} initialEmployees={[]} onLogout={onLogout} activeMenu={onboardingSubMenu} setActiveMenu={setOnboardingSubMenu} />
                </div>
              );
            }

            if (activeTab === "sales_commission") {
              if (!getHasPermission("calculate_commission")) {
                return renderLockedScreen("業績獎金計算 (Sales Bonus Calculation)", "檢視及計算團隊業績佣金之功能目前已被關閉。");
              }
              return <SalesCommissionTab user={currentUser} onLogAction={handleLogAction} />;
            }

            if (activeTab === "listings_report") {
              if (!getHasPermission("view_salary")) {
                return renderLockedScreen("全時人員中位數申報 (Median Salaries Report)", "調閱、申報、下載員工敏感薪酬所得、中位數、董事排除統計明細之功能目前已被關閉。");
              }
              return <ListingsReportTab user={currentUser} onLogAction={handleLogAction} />;
            }

            if (activeTab === "cloud_backups") {
              if (!getHasPermission("manage_backups")) {
                return renderLockedScreen("雲端備份與稽核 (Cloud Backups & Auditing)", "對系統統計結果進行雲端快照備份、刪除或還原之功能目前已被關閉。");
              }
              return <CloudBackupsTab user={currentUser} onLogAction={handleLogAction} />;
            }

            if (activeTab === "audit_trail") {
              if (!getHasPermission("audit_trail")) {
                return renderLockedScreen("稽核操作日誌 (Audit Trail Log Viewer)", "查看系統內人員之核心登入與資料修改稽核足跡之功能目前已被關閉。");
              }
              return <AuditTrailTab user={currentUser} />;
            }

            if (activeTab === "permission_management") {
              if (!getHasPermission("permission_management")) {
                return renderLockedScreen("權限管理中心 (Role & Permission Control Center)", "新增同仁登入帳號、修改系統存取控制矩陣、管理同仁角色權限之功能目前已被關閉。");
              }
              return <PermissionManagementTab user={currentUser} onLogAction={handleLogAction} />;
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
