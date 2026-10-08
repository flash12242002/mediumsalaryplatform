import React, { useState, useEffect } from "react";
import { User, UserRole } from "../types";
import { 
  Shield, Key, UserPlus, Lock, Check, Mail, UserCheck, AlertCircle, RefreshCw, 
  Settings, Save, Eye, EyeOff, ShieldAlert, BadgeHelp 
} from "lucide-react";

interface PermissionManagementTabProps {
  user: User;
  onLogAction: (action: string, details: string) => void;
}

export default function PermissionManagementTab({ user, onLogAction }: PermissionManagementTabProps) {
  const [subTab, setSubTab] = useState<"role_permissions" | "add_account" | "change_password">("role_permissions");
  
  // States for Permissions & Users
  const [users, setUsers] = useState<any[]>([]);
  const [rolePermissions, setRolePermissions] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // States for Adding New User
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserUsername, setNewUserUsername] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("SALES_LEADER");
  const [newUserError, setNewUserError] = useState<string | null>(null);
  const [newUserSuccess, setNewUserSuccess] = useState<string | null>(null);

  // States for Password Change
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);

  const fetchPermissionsData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/permissions");
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
        setRolePermissions(data.rolePermissions);
      } else {
        setError("載入權限資料失敗 (Failed to fetch permissions)");
      }
    } catch (err) {
      setError("後端伺服器連線失敗 (Connection error)");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissionsData();
  }, []);

  const handleTogglePermission = (roleKey: string, permKey: string) => {
    setRolePermissions((prev: any) => {
      const updatedRole = {
        ...prev[roleKey],
        [permKey]: !prev[roleKey][permKey]
      };
      return {
        ...prev,
        [roleKey]: updatedRole
      };
    });
  };

  const handleSaveRolePermissions = async () => {
    setSaving(true);
    setSuccessMsg(null);
    setError(null);
    try {
      const response = await fetch("/api/permissions/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rolePermissions,
          username: user.username,
          role: user.role
        })
      });

      if (response.ok) {
        setSuccessMsg("角色權限已成功更新！系統將立即套用變更。");
        onLogAction("更新權限", "更新了角色權限矩陣設定");
        
        // Update user session permissions in localStorage if the logged in user's role is updated
        const currentStored = localStorage.getItem("hr_user");
        if (currentStored) {
          const parsed = JSON.parse(currentStored);
          if (rolePermissions[parsed.role]) {
            parsed.permissions = rolePermissions[parsed.role];
            localStorage.setItem("hr_user", JSON.stringify(parsed));
          }
        }
      } else {
        setError("儲存角色權限失敗！");
      }
    } catch (err) {
      setError("無法與伺服器通訊，更新失敗。");
    } finally {
      setSaving(false);
    }
  };

  const handleAddNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewUserError(null);
    setNewUserSuccess(null);

    if (!newUserEmail || !newUserUsername || !newUserName || !newUserPassword) {
      setNewUserError("所有欄位均為必填！");
      return;
    }

    try {
      const response = await fetch("/api/permissions/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newUserEmail,
          username: newUserUsername,
          name: newUserName,
          password: newUserPassword,
          role: newUserRole,
          creatorUsername: user.username,
          creatorRole: user.role
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setNewUserSuccess(`同仁 ${newUserName} 帳號新增成功！現在可以使用 ${newUserEmail} 或 ${newUserUsername} 進行登入。`);
        setNewUserEmail("");
        setNewUserUsername("");
        setNewUserName("");
        setNewUserPassword("");
        setUsers(data.users);
        onLogAction("新增同仁帳號", `新增同仁: ${newUserName} (${newUserEmail})`);
      } else {
        setNewUserError(data.error || "新增同仁帳號失敗！");
      }
    } catch (err) {
      setNewUserError("通訊失敗，無法新增同仁帳號。");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(null);

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPassError("所有欄位均為必填！");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassError("新密碼與確認密碼不符合！");
      return;
    }

    if (newPassword.length < 2) {
      setPassError("密碼長度過短，至少需要兩個字元以上。");
      return;
    }

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          oldPassword,
          newPassword,
          username: user.username,
          role: user.role
        })
      });

      const data = await response.json();
      if (response.ok) {
        setPassSuccess("您的密碼已成功變更！請牢記您的新密碼。");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
        onLogAction("變更密碼", `同仁變更了自訂登入密碼`);
      } else {
        setPassError(data.error || "舊密碼錯誤，請確認。");
      }
    } catch (err) {
      setPassError("無法與伺服器通訊，變更密碼失敗。");
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "HR_ADMIN":
        return <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-full font-bold">HR管理者</span>;
      case "EXECUTIVE":
        return <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full font-bold">高階主管</span>;
      case "SALES_LEADER":
        default:
        return <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-full font-bold">業務主管</span>;
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 font-sans">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-2" />
        <span>載入權限管理資料中，請稍候...</span>
      </div>
    );
  }

  // Check if current user actually has permission to view Permission Management Tab
  // (In case permissions configured block them, or standard fallback)
  const hasPermManagement = user.permissions?.permission_management !== false;

  if (!hasPermManagement) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center font-sans space-y-4">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto border border-red-200 shadow-sm">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-850">
          存取限制：權限管理中心管制 <span className="text-xs text-slate-400 block mt-1">/ Permission Access Control</span>
        </h2>
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-2 text-left">
          <p className="font-bold text-slate-800">🔒 您的角色為：{user.role === "SALES_LEADER" ? "業務主管" : "高階主管"}</p>
          <p>
            依據本系統的安全性配置，<strong>「權限管理中心」僅限擁有變更權限權利之管理員帳號</strong> 進入操作。
          </p>
          <p className="text-slate-500">
            如果您需要調整您的角色功能權限，請向具有高階行政權限的 HR 人事同仁提出申請。
          </p>
        </div>
      </div>
    );
  }

  const subTabsSelector = (
    <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0">
      <button
        type="button"
        onClick={() => setSubTab("role_permissions")}
        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
          subTab === "role_permissions" 
            ? "bg-white text-slate-900 shadow-xs border border-slate-200/50" 
            : "text-slate-600 hover:text-slate-900"
        }`}
      >
        <Shield className="w-3.5 h-3.5" />
        <span>角色權限</span>
      </button>
      <button
        type="button"
        onClick={() => setSubTab("add_account")}
        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
          subTab === "add_account" 
            ? "bg-white text-slate-900 shadow-xs border border-slate-200/50" 
            : "text-slate-600 hover:text-slate-900"
        }`}
      >
        <UserPlus className="w-3.5 h-3.5" />
        <span>新增帳號</span>
      </button>
      <button
        type="button"
        onClick={() => setSubTab("change_password")}
        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
          subTab === "change_password" 
            ? "bg-white text-slate-900 shadow-xs border border-slate-200/50" 
            : "text-slate-600 hover:text-slate-900"
        }`}
      >
        <Key className="w-3.5 h-3.5" />
        <span>更改密碼</span>
      </button>
    </div>
  );

  return (
    <div className="space-y-6 font-sans">
      
      {/* Tab Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span className="p-1 bg-indigo-50 text-indigo-600 rounded-md">
              <Shield className="w-4 h-4" />
            </span>
            <span>權限管理中心</span>
            <span className="text-xs font-normal text-slate-400 font-mono">/ Role & Permission Settings</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            配置不同系統角色對薪資敏感性資料、獎金試算表、雲端備份之存取權限，並管理同仁登入帳號。
          </p>
        </div>
      </div>

      {subTab === "role_permissions" && (
        <div className="space-y-6">
            
            {/* Visual simulation design box as pictured */}
            <div className="bg-[#FAFBFD] border border-blue-100 rounded-xl p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row md:w-auto justify-between items-center gap-4 border-b border-blue-100/50 pb-4 mb-4">
                <h3 className="text-xs font-bold text-slate-500 tracking-wider text-center sm:text-left uppercase">
                  角色說明與權限級別 <span className="block text-[10px] text-slate-400 font-normal font-mono">DEMO SIMULATION ACCOUNTS (RBAC)</span>
                </h3>
                {subTabsSelector}
              </div>
              
              <div className="space-y-3">
                {/* Simulated HR ADMIN */}
                <div className="flex items-center justify-between p-3.5 bg-blue-50/50 border border-blue-100 rounded-xl">
                  <div className="text-left">
                    <span className="text-xs font-bold text-blue-900 block">HR管理者 (HR Admin)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 bg-white px-2.5 py-1 rounded-full border border-blue-100 shadow-2xs">
                    <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                    <span>👑 最高權限</span>
                  </div>
                </div>

                {/* Simulated EXECUTIVE */}
                <div className="flex items-center justify-between p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                  <div className="text-left">
                    <span className="text-xs font-bold text-emerald-900 block">高階主管 (Manager/Executive Manager)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-white px-2.5 py-1 rounded-full border border-emerald-100 shadow-2xs">
                    <Shield className="w-3.5 h-3.5 text-emerald-500" />
                    <span>🛡️ 唯讀申報報表</span>
                  </div>
                </div>

                {/* Simulated SALES LEADER */}
                <div className="flex items-center justify-between p-3.5 bg-amber-50/50 border border-amber-100 rounded-xl">
                  <div className="text-left">
                    <span className="text-xs font-bold text-amber-900 block">業務主管 (Sales Leader)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 bg-white px-2.5 py-1 rounded-full border border-amber-100 shadow-2xs">
                    <Key className="w-3.5 h-3.5 text-amber-600" />
                    <span>🔑 僅獎金計算</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Dynamic Permission Configuration Table */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-800">核心功能角色存取矩陣</h4>
                  <p className="text-[11px] text-slate-400">變更勾選後，請點選儲存來立即套用權限變更。</p>
                </div>
                <button
                  onClick={handleSaveRolePermissions}
                  disabled={saving}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs disabled:bg-indigo-400"
                >
                  {saving ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>儲存權限設定</span>
                </button>
              </div>

              {successMsg && (
                <div className="mb-4 p-2.5 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg text-xs font-medium flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {error && (
                <div className="mb-4 p-2.5 bg-red-50 border border-red-100 text-red-800 rounded-lg text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="overflow-x-auto border border-slate-150 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="py-2.5 px-4 font-bold text-slate-700">核心功能模組</th>
                      <th className="py-2.5 px-3 font-bold text-slate-700 text-center">HR管理者</th>
                      <th className="py-2.5 px-3 font-bold text-slate-700 text-center">高階主管</th>
                      <th className="py-2.5 px-3 font-bold text-slate-700 text-center">業務團隊主管</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    
                    {/* Permission Row 1 */}
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-800 block">檢視薪資資訊 (view_salary)</span>
                        <span className="text-[10px] text-slate-400">包括全時員工中位數、董事與內部人排除薪資明細</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={rolePermissions["HR_ADMIN"]?.view_salary || false}
                          onChange={() => handleTogglePermission("HR_ADMIN", "view_salary")}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={rolePermissions["EXECUTIVE"]?.view_salary || false}
                          onChange={() => handleTogglePermission("EXECUTIVE", "view_salary")}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={rolePermissions["SALES_LEADER"]?.view_salary || false}
                          onChange={() => handleTogglePermission("SALES_LEADER", "view_salary")}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                    </tr>

                    {/* Permission Row 2 */}
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-800 block">業績獎金計算 (calculate_commission)</span>
                        <span className="text-[10px] text-slate-400">計算每季發放佣金與級距配置</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={rolePermissions["HR_ADMIN"]?.calculate_commission || false}
                          onChange={() => handleTogglePermission("HR_ADMIN", "calculate_commission")}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={rolePermissions["EXECUTIVE"]?.calculate_commission || false}
                          onChange={() => handleTogglePermission("EXECUTIVE", "calculate_commission")}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={rolePermissions["SALES_LEADER"]?.calculate_commission || false}
                          onChange={() => handleTogglePermission("SALES_LEADER", "calculate_commission")}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                    </tr>

                    {/* Permission Row 3 */}
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-800 block">備份與稽核管理 (manage_backups)</span>
                        <span className="text-[10px] text-slate-400">將統計表備份至雲端、下載 CSV/PDF、還原記錄</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={rolePermissions["HR_ADMIN"]?.manage_backups || false}
                          onChange={() => handleTogglePermission("HR_ADMIN", "manage_backups")}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={rolePermissions["EXECUTIVE"]?.manage_backups || false}
                          onChange={() => handleTogglePermission("EXECUTIVE", "manage_backups")}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={rolePermissions["SALES_LEADER"]?.manage_backups || false}
                          onChange={() => handleTogglePermission("SALES_LEADER", "manage_backups")}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                    </tr>

                    {/* Permission Row 4 */}
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-800 block">新人報到資訊 (onboarding_portal)</span>
                        <span className="text-[10px] text-slate-400">管理與檢視新人報到流程與審核</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={rolePermissions["HR_ADMIN"]?.onboarding_portal || false}
                          onChange={() => handleTogglePermission("HR_ADMIN", "onboarding_portal")}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={rolePermissions["EXECUTIVE"]?.onboarding_portal || false}
                          onChange={() => handleTogglePermission("EXECUTIVE", "onboarding_portal")}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={rolePermissions["SALES_LEADER"]?.onboarding_portal || false}
                          onChange={() => handleTogglePermission("SALES_LEADER", "onboarding_portal")}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                    </tr>
                    
                    {/* Free Room Management Permission */}
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-800 block">免費房間設定 (freeroom_management)</span>
                        <span className="text-[10px] text-slate-400">管理員工免費房配額與使用紀錄</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={rolePermissions["HR_ADMIN"]?.freeroom_management || false}
                          onChange={() => handleTogglePermission("HR_ADMIN", "freeroom_management")}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={rolePermissions["EXECUTIVE"]?.freeroom_management || false}
                          onChange={() => handleTogglePermission("EXECUTIVE", "freeroom_management")}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={rolePermissions["SALES_LEADER"]?.freeroom_management || false}
                          onChange={() => handleTogglePermission("SALES_LEADER", "freeroom_management")}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                    </tr>

                    {/* Permission Row 5 */}
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-800 block">稽核操作日誌 (audit_trail)</span>
                        <span className="text-[10px] text-slate-400">查閱全體人員在系統內的核心操作足跡</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={rolePermissions["HR_ADMIN"]?.audit_trail || false}
                          onChange={() => handleTogglePermission("HR_ADMIN", "audit_trail")}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={rolePermissions["EXECUTIVE"]?.audit_trail || false}
                          onChange={() => handleTogglePermission("EXECUTIVE", "audit_trail")}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={rolePermissions["SALES_LEADER"]?.audit_trail || false}
                          onChange={() => handleTogglePermission("SALES_LEADER", "audit_trail")}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                    </tr>

                    {/* Permission Row 6 */}
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-800 block">系統權限與同仁管理 (permission_management)</span>
                        <span className="text-[10px] text-slate-400">新增或修改同仁帳號，更改角色系統功能存取權</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={rolePermissions["HR_ADMIN"]?.permission_management || false}
                          onChange={() => handleTogglePermission("HR_ADMIN", "permission_management")}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={rolePermissions["EXECUTIVE"]?.permission_management || false}
                          onChange={() => handleTogglePermission("EXECUTIVE", "permission_management")}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={rolePermissions["SALES_LEADER"]?.permission_management || false}
                          onChange={() => handleTogglePermission("SALES_LEADER", "permission_management")}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                    </tr>

                  </tbody>
                </table>
              </div>
            </div>

        </div>
      )}

      {subTab === "add_account" && (
        <div className="space-y-6">
          
          {/* Register/Add New User Panel */}
          <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-xl shadow-xs p-5 w-full md:w-auto">
              <div className="border-b border-slate-150 pb-3 mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-indigo-600" />
                    <span>新增同仁登入帳號</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    在此新增同仁的 E-mail 與專案角色，新增後同仁便可使用該帳號密碼於本系統登入。
                  </p>
                </div>
                {subTabsSelector}
              </div>

              {newUserError && (
                <div className="mb-4 p-2.5 bg-red-50 border border-red-100 text-red-800 rounded-lg text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4.5 h-4.5 text-red-500 shrink-0" />
                  <span>{newUserError}</span>
                </div>
              )}

              {newUserSuccess && (
                <div className="mb-4 p-2.5 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg text-xs font-medium flex items-center gap-2">
                  <Check className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
                  <span>{newUserSuccess}</span>
                </div>
              )}

              <form onSubmit={handleAddNewUser} className="space-y-4 text-xs font-medium">
                <div>
                  <label className="block text-slate-600 mb-1">中文姓名 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="例如: 五月天"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1">同仁 E-mail 信箱 <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400">
                      <Mail className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="email"
                      required
                      value={newUserEmail}
                      onChange={(e) => {
                        const email = e.target.value;
                        setNewUserEmail(email);
                        // Auto-populate username from email prefix if username is empty or matches previous prefix
                        const prefix = email.split("@")[0];
                        const oldPrefix = newUserEmail.split("@")[0];
                        if (email && (!newUserUsername || newUserUsername === oldPrefix)) {
                          setNewUserUsername(prefix);
                        }
                      }}
                      placeholder="mayday@ldchotels.com"
                      className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs"
                    />
                  </div>
                </div>


                <div>
                  <label className="block text-slate-600 mb-1">預設登入密碼 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="例如: ldc2026"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1">分配核心系統角色 <span className="text-red-500">*</span></label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs bg-white"
                  >
                    <option value="HR_ADMIN">HR管理者 (最高權限)</option>
                    <option value="EXECUTIVE">高階主管 (唯讀調閱)</option>
                    <option value="SALES_LEADER">業務主管 (僅獎金試算)</option>
                  </select>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="submit"
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>確認新增同仁帳號</span>
                  </button>
                </div>
              </form>
          </div>

        {/* Current Enrolled Users List */}
        <div className="w-full bg-white border border-slate-200 rounded-xl shadow-xs p-5">
          <h4 className="text-sm font-bold text-slate-850 mb-3 flex items-center gap-1.5">
            <span>👥 已開通登入同仁帳號</span>
            <span className="text-xs text-slate-400 font-normal">({users.length} 名)</span>
          </h4>
          <div className="overflow-hidden border border-slate-150 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                  <th className="py-2.5 px-4 font-bold">同仁姓名 / 帳號名稱</th>
                  <th className="py-2.5 px-4 font-bold">登入 E-mail</th>
                  <th className="py-2.5 px-4 font-bold">系統角色</th>
                  <th className="py-2.5 px-4 font-bold">預設密碼</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans text-slate-600">
                {users.map((u, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 px-4 font-bold text-slate-800">
                      {u.name} <span className="text-[10px] text-slate-400 font-mono">({u.username})</span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-600">
                      {u.email}
                    </td>
                    <td className="py-2.5 px-4">
                      {getRoleBadge(u.role)}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-400">
                      {u.password}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    )}

      {subTab === "change_password" && (
        <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-xl shadow-xs p-6 my-4">
          <div className="border-b border-slate-150 pb-3.5 mb-5 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Key className="w-4 h-4 text-blue-600" />
                <span>變更目前登入帳號密碼</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">
                為了保護薪酬申報敏感性機密資料安全，建議您定期更新高強度密碼。
              </p>
            </div>
            {subTabsSelector}
          </div>

          {passError && (
            <div className="mb-4 p-2.5 bg-red-50 border border-red-100 text-red-800 rounded-lg text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{passError}</span>
            </div>
          )}

          {passSuccess && (
            <div className="mb-4 p-2.5 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg text-xs font-medium flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{passSuccess}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4 text-xs font-medium">
            <div>
              <label className="block text-slate-500 mb-1">您的電子信箱帳號</label>
              <input
                type="text"
                disabled
                value={user.email}
                className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-slate-400 font-mono text-xs cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-slate-600 mb-1">目前使用的舊密碼 <span className="text-red-500">*</span></label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="請輸入目前密碼"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <label className="block text-slate-600 mb-1">設定新登入密碼 <span className="text-red-500">*</span></label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="輸入全新強強度密碼"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-600 mb-1">再次輸入新密碼以供確認 <span className="text-red-500">*</span></label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次輸入新密碼"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-xs"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs text-xs"
              >
                <Key className="w-3.5 h-3.5" />
                <span>儲存並變更新密碼</span>
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
