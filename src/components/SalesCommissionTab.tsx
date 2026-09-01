import React, { useState, useEffect } from "react";
import { User, SalesConfig, SalesRecord, CommissionTier } from "../types";
import { 
  Calculator, Settings, UserPlus, Trash2, Edit3, CheckCircle, 
  Send, AlertCircle, RefreshCw, FileText, ChevronRight, TrendingUp 
} from "lucide-react";
import { motion } from "motion/react";

interface SalesCommissionTabProps {
  user: User;
  onLogAction: (action: string, details: string) => void;
}

export default function SalesCommissionTab({ user, onLogAction }: SalesCommissionTabProps) {
  const [config, setConfig] = useState<SalesConfig | null>(null);
  const [records, setRecords] = useState<SalesRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states for creating a new record
  const [newEmpId, setNewEmpId] = useState("");
  const [newName, setNewName] = useState("");
  const [newBaseSalary, setNewBaseSalary] = useState(38000);
  const [newSalesAmount, setNewSalesAmount] = useState(150000);
  const [newPeriod, setNewPeriod] = useState("2026-Q1");
  const [showAddForm, setShowAddForm] = useState(false);

  // Commission sandbox calculator states
  const [sandboxSales, setSandboxSales] = useState<number>(250000);

  // Config edit states (HR Admin only)
  const [editConfig, setEditConfig] = useState<SalesConfig | null>(null);
  const [showConfigEdit, setShowConfigEdit] = useState(false);

  // Edit record states
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [editSalesAmount, setEditSalesAmount] = useState<number>(0);
  const [editBaseSalary, setEditBaseSalary] = useState<number>(0);

  const isHR = user.role === "HR_ADMIN";
  const isLeader = user.role === "SALES_LEADER";
  const canModify = isHR || isLeader;

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const configRes = await fetch("/api/sales/config");
      const configData = await configRes.json();
      setConfig(configData);
      setEditConfig(configData);

      const recordsRes = await fetch("/api/sales/records");
      const recordsData = await recordsRes.json();
      setRecords(recordsData);
    } catch (err) {
      setError("連線伺服器載入數據失敗。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editConfig || !isHR) return;

    try {
      const response = await fetch("/api/sales/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editConfig,
          username: user.username,
          role: user.role
        })
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(data.salesConfig);
        setShowConfigEdit(false);
        onLogAction("更新獎金參數", "變更業績級距參數且成功重新計算現有記錄");
        fetchData(); // reload records because backend recalculated commissions
      } else {
        const errData = await response.json();
        alert(errData.error || "儲存失敗");
      }
    } catch (err) {
      alert("伺服器連線錯誤");
    }
  };

  const handleTierChange = (index: number, key: keyof CommissionTier, value: any) => {
    if (!editConfig) return;
    const newTiers = [...editConfig.tiers];
    newTiers[index] = { ...newTiers[index], [key]: value };
    setEditConfig({ ...editConfig, tiers: newTiers });
  };

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isHR) return;

    try {
      const response = await fetch("/api/sales/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empId: newEmpId,
          name: newName,
          baseSalary: newBaseSalary,
          salesAmount: newSalesAmount,
          period: newPeriod,
          username: user.username,
          role: user.role
        })
      });

      if (response.ok) {
        setShowAddForm(false);
        // Reset form
        setNewEmpId("");
        setNewName("");
        setNewBaseSalary(38000);
        setNewSalesAmount(150000);
        fetchData();
        onLogAction("新增業績獎金記錄", `為員工 ${newName} 建立了業績額度：NT$${newSalesAmount}`);
      } else {
        const errData = await response.json();
        alert(errData.error || "新增記錄失敗");
      }
    } catch (err) {
      alert("新增記錄出錯");
    }
  };

  const handleUpdateRecordStatus = async (id: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/sales/records/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          username: user.username,
          role: user.role
        })
      });

      if (response.ok) {
        fetchData();
        onLogAction("變更獎金狀態", `更新業績記錄 #${id} 狀態為「${newStatus}」`);
      } else {
        const errData = await response.json();
        alert(errData.error || "狀態變更失敗");
      }
    } catch (err) {
      alert("連線出錯");
    }
  };

  const handleSaveRecordEdit = async (id: string) => {
    try {
      const response = await fetch(`/api/sales/records/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salesAmount: editSalesAmount,
          baseSalary: editBaseSalary,
          username: user.username,
          role: user.role
        })
      });

      if (response.ok) {
        setEditingRecordId(null);
        fetchData();
        onLogAction("變更業績與薪資", `修改員工獎金記錄 #${id} 之底薪或業績`);
      } else {
        const errData = await response.json();
        alert(errData.error || "修改失敗");
      }
    } catch (err) {
      alert("連線出錯");
    }
  };

  const handleDeleteRecord = async (id: string) => {
    try {
       const response = await fetch(`/api/sales/records/${id}?username=${encodeURIComponent(user.username)}&role=${user.role}`, {
         method: "DELETE"
       });
 
       if (response.ok) {
         fetchData();
         onLogAction("刪除業績記錄", `刪除業績計算明細 #${id}`);
       } else {
         const errData = await response.json();
         alert(errData.error || "刪除失敗");
       }
     } catch (err) {
       alert("連線出錯");
     }
  };

  const handleExportCSV = () => {
    if (records.length === 0) return;

    let csvContent = "\ufeff"; // BOM for Excel encoding
    csvContent += "員工編號,姓名,所屬年度季度,底薪 (Base Salary),業績達標金額 (Sales Amount),業績獎金 (Commission),超額達標獎勵 (Bonus),應發薪資總額 (Total Pay),狀態\n";

    records.forEach(rec => {
      csvContent += `${rec.empId},${rec.name},${rec.period},${rec.baseSalary},${rec.salesAmount},${rec.commission},${rec.bonus},${rec.totalPay},${rec.status}\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `HR_業績獎金發放明細表_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onLogAction("匯出獎金報表", "一鍵匯出業績獎金發放明細 CSV 檔案");
  };

  // Sandbox calculations based on active config (mock calculation visual)
  const runSandboxCalculation = (sales: number) => {
    if (!config) return { breakDown: [], total: 0, bonus: 0 };
    
    let commission = 0;
    const breakDown: Array<{ tierName: string; rate: number; amountInTier: number; earned: number }> = [];
    const sortedTiers = [...config.tiers].sort((a, b) => a.min - b.min);

    for (const tier of sortedTiers) {
      if (sales > tier.min) {
        const rangeMax = Math.min(sales, tier.max);
        const rangeApplicable = rangeMax - tier.min;
        if (rangeApplicable > 0) {
          const earned = Math.round(rangeApplicable * (tier.rate / 100));
          commission += earned;
          breakDown.push({
            tierName: tier.label,
            rate: tier.rate,
            amountInTier: rangeApplicable,
            earned
          });
        }
      }
    }

    const bonus = sales >= config.targetAmount ? config.targetBonus : 0;

    return {
      breakDown,
      commission,
      bonus,
      total: commission + bonus
    };
  };

  const sandboxResult = runSandboxCalculation(sandboxSales);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-2" />
        <span>數據載入中，請稍候...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Tab Header with Primary Traditional Chinese and Secondary English */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
            業績獎金自動化計算 <span className="text-sm font-normal text-slate-400 block md:inline md:ml-2">/ Sales Bonus Calculation </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            依據銷售級距及超額達標目標，動態計算業務同仁之季度/月度應發獎金，並支援各權限層級安全審核流程。
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-2">
          {isHR && (
            <button
              onClick={() => setShowConfigEdit(!showConfigEdit)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4 text-slate-400" />
              <span>變更獎金級距 (Settings)</span>
            </button>
          )}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span>匯出計算明細 (Export CSV)</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid Layout: Config Editor + Interactive Sandbox Calculator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sales Tier Configuration Section */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-slate-400" />
                <span>現行獎金級距 <span className="text-xs text-slate-400 font-normal">/ Bonus Tiers</span></span>
              </h3>
              <span className="text-[10px] font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">
                自動運算套用中
              </span>
            </div>

            {config && (
              <div className="space-y-4">
                {config.tiers.map((tier) => (
                  <div key={tier.id} className="p-3 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center text-xs transition-colors">
                    <div>
                      <span className="font-semibold text-slate-700 block">{tier.label}</span>
                      <span className="text-slate-500 font-mono">
                        {tier.min.toLocaleString()} ~ {tier.max > 50000000 ? "無限" : tier.max.toLocaleString()} 元
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-blue-600 font-bold font-mono text-sm">{tier.rate}%</span>
                      <span className="text-[10px] text-slate-400 block">獎金比率</span>
                    </div>
                  </div>
                ))}

                {/* Overachievement Target */}
                <div className="border-t border-dashed border-slate-200 pt-4 mt-2">
                  <div className="p-3 bg-amber-50/40 border border-amber-100 rounded-lg text-xs space-y-2">
                    <div className="flex items-center justify-between text-amber-900 font-medium">
                      <span>卓越達標額外加給目標</span>
                      <span className="font-mono text-amber-700">{config.targetAmount.toLocaleString()} 元</span>
                    </div>
                    <div className="flex items-center justify-between text-amber-950 font-medium">
                      <span>額外發放獎金</span>
                      <span className="font-mono text-amber-700">+{config.targetBonus.toLocaleString()} 元</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* HR-Admin Commission Range Config Editor Modal/Section */}
          {showConfigEdit && editConfig && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white border-2 border-blue-200 shadow-md rounded-xl p-5"
            >
              <form onSubmit={handleSaveConfig} className="space-y-4">
                <h3 className="font-bold text-slate-900 text-sm text-blue-800 flex items-center gap-1">
                  <span>編輯級距參數 (Config Editor)</span>
                </h3>
                
                {editConfig.tiers.map((tier, idx) => (
                  <div key={tier.id} className="p-3 bg-slate-50 rounded-lg space-y-2 text-xs">
                    <div className="font-bold text-slate-600 mb-1">{tier.label}</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block">起算額</label>
                        <input
                          type="number"
                          value={tier.min}
                          onChange={(e) => handleTierChange(idx, "min", Number(e.target.value))}
                          className="w-full p-1 border border-slate-200 rounded text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block">上限額</label>
                        <input
                          type="number"
                          value={tier.max}
                          onChange={(e) => handleTierChange(idx, "max", Number(e.target.value))}
                          className="w-full p-1 border border-slate-200 rounded text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block">比率 (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={tier.rate}
                          onChange={(e) => handleTierChange(idx, "rate", Number(e.target.value))}
                          className="w-full p-1 border border-slate-200 rounded text-xs font-bold text-blue-600"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <div className="grid grid-cols-2 gap-2 text-xs pt-2">
                  <div>
                    <label className="text-[10px] text-slate-500 font-medium block">卓越達標門檻 (NT$)</label>
                    <input
                      type="number"
                      value={editConfig.targetAmount}
                      onChange={(e) => setEditConfig({ ...editConfig, targetAmount: Number(e.target.value) })}
                      className="w-full p-1.5 border border-slate-200 rounded text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-medium block">額外加發獎金 (NT$)</label>
                    <input
                      type="number"
                      value={editConfig.targetBonus}
                      onChange={(e) => setEditConfig({ ...editConfig, targetBonus: Number(e.target.value) })}
                      className="w-full p-1.5 border border-slate-200 rounded text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold"
                  >
                    更新並重新計算
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConfigEdit(false)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-xs"
                  >
                    取消
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* Dynamic Sandbox Simulator */}
          <div className="bg-slate-900 border border-slate-850 shadow-sm rounded-xl p-5 text-white">
            <h3 className="font-bold text-sm flex items-center gap-1.5 mb-2 text-blue-400">
              <Calculator className="w-4 h-4 text-blue-400" />
              <span>業績獎金試算測試 <span className="text-xs text-slate-400 font-normal">/ Sales Bonus Template</span></span>
            </h3>
            <p className="text-[11px] text-slate-400 mb-4">
              拖動業績拉桿，即時預覽獎金如何通過各級距累積，並查看是否能領取超額獎金。
            </p>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center text-xs mb-1 font-mono">
                  <span className="text-slate-400">輸入測試業績金額：</span>
                  <span className="text-amber-400 font-bold text-sm">NT$ {sandboxSales.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min="10000"
                  max="600000"
                  step="5000"
                  value={sandboxSales}
                  onChange={(e) => setSandboxSales(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                  <span>$10,000</span>
                  <span>$300,000</span>
                  <span>$600,000</span>
                </div>
              </div>

              {/* Dynamic calculations breakdown */}
              <div className="p-3 bg-slate-800 rounded-lg text-xs space-y-2 font-mono border border-slate-750">
                <div className="text-slate-400 text-[10px] border-b border-slate-700 pb-1.5 uppercase">
                  計算細目 (Accumulation breakdown)
                </div>
                {sandboxResult.breakDown.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-[11px] text-slate-300">
                    <span>{item.tierName} ({item.rate}%):</span>
                    <span>
                      ${item.amountInTier.toLocaleString()} × {item.rate}% = 
                      <span className="text-white font-medium ml-1">${item.earned.toLocaleString()}</span>
                    </span>
                  </div>
                ))}

                {sandboxResult.bonus > 0 && (
                  <div className="flex justify-between text-[11px] text-emerald-400 font-semibold border-t border-dashed border-slate-700 pt-1.5">
                    <span>超額達標加給獎金:</span>
                    <span>+${sandboxResult.bonus.toLocaleString()}</span>
                  </div>
                )}

                <div className="flex justify-between text-xs font-bold text-amber-400 border-t border-slate-700 pt-2 mt-1">
                  <span>預估總發放獎金:</span>
                  <span className="text-sm">NT$ {sandboxResult.total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Sales Commission Calculation Table & Approval Flow */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                <span>2026年度業務同仁業績獎金計算表 <span className="text-xs text-slate-400 font-normal">/ Bonus Calculation Sheet</span></span>
              </h3>
              
              {isHR && (
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg border border-blue-200 transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>新增業績資料</span>
                </button>
              )}
            </div>

            {/* Form to add record (HR Admin only) */}
            {showAddForm && isHR && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-blue-50/40 border border-blue-100 rounded-xl p-4 mb-6"
              >
                <form onSubmit={handleAddRecord} className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">員工編號 (ID)</label>
                    <input
                      type="text"
                      required
                      placeholder="如: HQ00001"
                      value={newEmpId}
                      onChange={(e) => setNewEmpId(e.target.value)}
                      className="w-full p-2 border border-slate-200 bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">姓名 (Name)</label>
                    <input
                      type="text"
                      required
                      placeholder="如: 五月天"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full p-2 border border-slate-200 bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">基本底薪 (NT$)</label>
                    <input
                      type="number"
                      required
                      value={newBaseSalary}
                      onChange={(e) => setNewBaseSalary(Number(e.target.value))}
                      className="w-full p-2 border border-slate-200 bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">業績總額 (NT$)</label>
                    <input
                      type="number"
                      required
                      value={newSalesAmount}
                      onChange={(e) => setNewSalesAmount(Number(e.target.value))}
                      className="w-full p-2 border border-slate-200 bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors shadow-sm"
                    >
                      新增並計算
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-lg"
                    >
                      取消
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* Records List Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                    <th className="py-2.5 px-3">員工 / 編號</th>
                    <th className="py-2.5 px-3 text-right">底薪 (NT$)</th>
                    <th className="py-2.5 px-3 text-right">業績 (NT$)</th>
                    <th className="py-2.5 px-3 text-right text-blue-700">計算獎金 (NT$)</th>
                    <th className="py-2.5 px-3 text-right text-indigo-700 font-bold">預估總發放 (NT$)</th>
                    <th className="py-2.5 px-3 text-center">季度</th>
                    <th className="py-2.5 px-3 text-center">發放狀態</th>
                    <th className="py-2.5 px-3 text-right">權限操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {records.map((rec) => {
                    const isEditing = editingRecordId === rec.id;

                    return (
                      <tr key={rec.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-3">
                          <span className="font-bold text-slate-900 block">{rec.name}</span>
                          <span className="text-[10px] text-slate-400 block font-mono">{rec.empId}</span>
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editBaseSalary}
                              onChange={(e) => setEditBaseSalary(Number(e.target.value))}
                              className="w-16 p-1 border border-slate-200 text-right text-xs"
                            />
                          ) : (
                            rec.baseSalary.toLocaleString()
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono text-slate-600">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editSalesAmount}
                              onChange={(e) => setEditSalesAmount(Number(e.target.value))}
                              className="w-20 p-1 border border-slate-200 text-right text-xs text-blue-600 font-bold"
                            />
                          ) : (
                            rec.salesAmount.toLocaleString()
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono text-blue-600 font-semibold">
                          {isEditing ? (
                            <span className="text-slate-400">重新計算中</span>
                          ) : (
                            <span>
                              {(rec.commission + rec.bonus).toLocaleString()}
                              <span className="text-[10px] text-slate-400 block font-normal">
                                (獎:{rec.commission.toLocaleString()} + 超:{rec.bonus.toLocaleString()})
                              </span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono font-bold text-indigo-700 bg-indigo-50/20">
                          {isEditing ? (
                            <span className="text-slate-400">重新計算中</span>
                          ) : (
                            rec.totalPay.toLocaleString()
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-center text-slate-500 font-mono">
                          {rec.period}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            rec.status === "已發放" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            rec.status === "核准中" ? "bg-amber-50 text-amber-700 border-amber-200" :
                            "bg-blue-50 text-blue-700 border-blue-200"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              rec.status === "已發放" ? "bg-emerald-500" :
                              rec.status === "核准中" ? "bg-amber-500" :
                              "bg-blue-500"
                            }`} />
                            {rec.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => handleSaveRecordEdit(rec.id)}
                                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                  title="確認儲存"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setEditingRecordId(null)}
                                  className="p-1 text-slate-400 hover:bg-slate-50 rounded"
                                  title="取消編輯"
                                >
                                  <ChevronRight className="w-4 h-4 rotate-185" />
                                </button>
                              </>
                            ) : (
                              <>
                                {/* Sales Manager actions: Submit for review */}
                                {isLeader && rec.status === "已計算" && (
                                  <button
                                    onClick={() => handleUpdateRecordStatus(rec.id, "核准中")}
                                    className="p-1 text-amber-600 hover:bg-amber-50 rounded flex items-center gap-0.5"
                                    title="送出核准"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    <span className="text-[10px]">送審</span>
                                  </button>
                                )}

                                {/* HR Admin actions: Approve, Release payment, Edit, Delete */}
                                {isHR && rec.status === "已計算" && (
                                  <button
                                    onClick={() => handleUpdateRecordStatus(rec.id, "核准中")}
                                    className="p-1 text-amber-600 hover:bg-amber-50 rounded flex items-center gap-0.5"
                                    title="送至核准階段"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    <span className="text-[10px]">送審</span>
                                  </button>
                                )}
                                {isHR && rec.status === "核准中" && (
                                  <button
                                    onClick={() => handleUpdateRecordStatus(rec.id, "已發放")}
                                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded flex items-center gap-0.5"
                                    title="核准並發放"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    <span className="text-[10px] font-bold">發放</span>
                                  </button>
                                )}

                                {/* General Edit (Can modify) */}
                                {canModify && rec.status !== "已發放" && (
                                  <button
                                    onClick={() => {
                                      setEditingRecordId(rec.id);
                                      setEditSalesAmount(rec.salesAmount);
                                      setEditBaseSalary(rec.baseSalary);
                                    }}
                                    className="p-1 text-slate-500 hover:bg-slate-50 rounded"
                                    title="編輯數據"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {/* Delete Record (HR Admin only) */}
                                {isHR && (
                                  <button
                                    onClick={() => setDeleteConfirm({ id: rec.id, name: rec.name })}
                                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                                    title="刪除"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {records.length === 0 && (
              <div className="py-12 text-center text-slate-400 text-xs">
                目前尚無業務人員業績資料。請透過右上角「新增業績資料」來建立。
              </div>
            )}
          </div>
        </div>

      </div>
      {/* Custom Deletion Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4"
          >
            <div className="flex items-center gap-3 text-red-650">
              <div className="p-2 bg-red-50 rounded-lg text-red-600">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">確定刪除獎金明細？</h3>
            </div>
            
            <p className="text-xs text-slate-600 leading-relaxed">
              您確定要刪除員工「<strong className="text-slate-900 font-semibold">{deleteConfirm.name}</strong>」的業績獎金計算明細與發放記錄嗎？
              <span className="block mt-2 text-red-500 font-medium">⚠️ 注意：此操作無法復原，對應的歷史紀錄將從資料庫中移除！</span>
            </p>

            <div className="flex justify-end gap-2 text-xs pt-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  handleDeleteRecord(deleteConfirm.id);
                  setDeleteConfirm(null);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors shadow-xs"
              >
                確定刪除 (Confirm)
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
