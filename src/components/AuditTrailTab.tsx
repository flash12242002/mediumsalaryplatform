import React, { useState, useEffect } from "react";
import { User, AuditLog } from "../types";
import { 
  History, Search, Filter, ShieldAlert, Download, RefreshCw, 
  Clock, UserCheck, Key, FileText, CheckCircle2 
} from "lucide-react";

import HrDashboard from "./HrDashboard";

interface AuditTrailTabProps {
  user: User;
}

export default function AuditTrailTab({ user }: AuditTrailTabProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<"system_logs" | "onboarding_logs">("system_logs");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/audit/logs");
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (err) {
      console.error("載入日誌失敗", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleDownloadLogsCSV = () => {
    if (logs.length === 0) return;

    let csvContent = "\ufeff"; // BOM for Excel encoding
    csvContent += "日誌編號,時間戳記,操作人員,角色權限,操作事件,詳細異動記錄\n";

    logs.forEach(log => {
      csvContent += `${log.id},${log.createdAt},${log.username},${log.role},${log.action},${log.details}\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `HR_異動紀錄_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === "ALL" || log.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 font-sans">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-2" />
        <span>載入系統操作稽核紀錄...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
            系統操作異動紀錄 <span className="text-sm font-normal text-slate-400 block md:inline md:ml-2">/ System Change Records</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            不可竄改之底層日誌，全面追蹤各權限層級之登入、薪水調整、級距修正、報表匯出及雲端備份儲存操作。
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-2">
          <button
            onClick={fetchLogs}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors bg-white hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
            <span>重新整理 (Refresh)</span>
          </button>
          <button
            onClick={handleDownloadLogsCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>匯出異動紀錄 (Export CSV)</span>
          </button>
        </div>
      </div>

      
      {/* Sub Tab Selector */}
      <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 w-fit mb-4">
        <button
          onClick={() => setSubTab("system_logs")}
          className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${
            subTab === "system_logs" 
              ? "bg-white text-slate-900 shadow-xs border border-slate-200/50" 
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          系統異動紀錄
        </button>
        <button
          onClick={() => setSubTab("onboarding_logs")}
          className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${
            subTab === "onboarding_logs" 
              ? "bg-white text-slate-900 shadow-xs border border-slate-200/50" 
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Onboarding異動紀錄
        </button>
      </div>

      {subTab === "system_logs" && (
        <div className="space-y-6">
{/* Searching and Filtering */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜尋操作事件、人員、詳細異動紀錄..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs text-slate-500">篩選角色：</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="p-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none bg-white font-medium text-slate-700 w-full md:w-auto"
          >
            <option value="ALL">全部權限角色 (All Roles)</option>
            <option value="HR_ADMIN">HR管理者 (HR Admin)</option>
            <option value="EXECUTIVE">高階主管 (Executive)</option>
            <option value="SALES_LEADER">業務主管 (Sales Leader)</option>
          </select>
        </div>
      </div>

      {/* Logs Visual Timeline */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5">
        <div className="flex items-center gap-1.5 border-b border-slate-200 pb-3 mb-4">
          <History className="w-4 h-4 text-slate-400" />
          <h3 className="font-bold text-slate-850 text-sm">
            異動紀錄細節明細框 <span className="text-xs text-slate-400 font-normal">/ Detailed Change Log</span>
          </h3>
        </div>

        <div className="flow-root">
          <ul className="-mb-8">
            {filteredLogs.map((log, logIdx) => (
              <li key={log.id}>
                <div className="relative pb-8">
                  {logIdx !== filteredLogs.length - 1 ? (
                    <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-100" aria-hidden="true" />
                  ) : null}
                  <div className="relative flex space-x-3 items-start">
                    <div>
                      <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                        log.role === "HR_ADMIN" ? "bg-blue-50 text-blue-600" :
                        log.role === "EXECUTIVE" ? "bg-emerald-50 text-emerald-600" :
                        "bg-amber-50 text-amber-600"
                      }`}>
                        {log.role === "HR_ADMIN" ? <UserCheck className="w-4 h-4" /> :
                         log.role === "EXECUTIVE" ? <Clock className="w-4 h-4" /> :
                         <Key className="w-4 h-4" />}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 pt-1.5">
                      <div className="flex justify-between items-start gap-4">
                        <div className="text-xs font-bold text-slate-800">
                          {log.username}
                          <span className={`ml-2 inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                            log.role === "HR_ADMIN" ? "bg-blue-50 text-blue-700 border-blue-100" :
                            log.role === "EXECUTIVE" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                            "bg-amber-50 text-amber-700 border-amber-100"
                          }`}>
                            {log.role}
                          </span>
                        </div>
                        <div className="text-right text-[10px] text-slate-400 font-mono">
                          {log.createdAt}
                        </div>
                      </div>
                      <div className="text-xs text-slate-600 font-medium mt-1">
                        動作事件：<span className="text-slate-900 font-semibold">{log.action}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 font-mono bg-slate-50 p-2 border border-slate-200 rounded">
                        {log.details}
                      </p>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {filteredLogs.length === 0 && (
            <div className="py-12 text-center text-slate-400 text-xs">
              無符合篩選條件的稽核日誌。
            </div>
          )}
        </div>
      </div>
        </div>
      )}

      {subTab === "onboarding_logs" && (
        <div className="w-full bg-[#F8FAFC] rounded-xl shadow-sm border border-slate-200 overflow-hidden relative overflow-y-auto no-print" style={{height: '70vh'}}>
           <HrDashboard currentUser={{ email: user.email, name: user.username }} initialEmployees={[]} onLogout={() => {}} activeMenu="logs" hideNavigation={true} />
        </div>
      )}


    </div>
  );
}
