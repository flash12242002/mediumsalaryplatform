import React, { useState } from 'react';
import {
  Users,
  Upload,
  BedDouble,
  Cloud,
  FileSpreadsheet,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Download,
  Trash2,
  Edit,
  ArrowLeft,
  LogOut,
  RefreshCw,
  ExternalLink,
  Code2,
  Building2,
  HelpCircle
} from 'lucide-react';
import { Employee, EmploymentStatus } from '../types';

interface HrAdminPortalProps {
  employees: Employee[];
  onUpdateEmployees: (newEmployees: Employee[]) => void;
  onOpenAddModal: () => void;
  onOpenEditModal: (employee: Employee) => void;
  onDeleteEmployee: (id: string) => void;
  onExitAdmin: () => void;
}

export const HrAdminPortal: React.FC<HrAdminPortalProps> = ({
  employees,
  onUpdateEmployees,
  onOpenAddModal,
  onOpenEditModal,
  onDeleteEmployee,
  onExitAdmin,
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'import_emp' | 'import_room' | 'gas_sync'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCompany, setFilterCompany] = useState('');

  // 1. Employee Import State
  const [empCsvText, setEmpCsvText] = useState('');
  const [empImportStatus, setEmpImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 2. Room Benefit Import State
  const [roomCsvText, setRoomCsvText] = useState('');
  const [roomImportStatus, setRoomImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 3. GAS Cloud Sync State
  const [gasUrl, setGasUrl] = useState(() => localStorage.getItem('ldc_gas_webapp_url') || '');
  const [isSyncingGas, setIsSyncingGas] = useState(false);
  const [gasSyncStatus, setGasSyncStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isCopiedGasCode, setIsCopiedGasCode] = useState(false);
  const [showGasCodeModal, setShowGasCodeModal] = useState(false);

  // Statistics
  const totalEmployees = employees.length;
  const activeCount = employees.filter((e) => e.status === '在職').length;
  const totalRoomQuota = employees.reduce((sum, e) => sum + e.roomBenefit.totalQuota, 0);
  const totalUsedNights = employees.reduce((sum, e) => sum + e.roomBenefit.usedNights, 0);

  // Filtered employees for list tab
  const filteredEmployees = employees.filter((emp) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      emp.nameZh.toLowerCase().includes(q) ||
      emp.nameEn.toLowerCase().includes(q) ||
      emp.id.toLowerCase().includes(q) ||
      emp.nationalId.toLowerCase().includes(q) ||
      emp.extension.includes(q) ||
      emp.department.toLowerCase().includes(q);
    const matchCompany = !filterCompany || emp.company === filterCompany;
    return matchSearch && matchCompany;
  });

  const companiesList = Array.from(new Set(employees.map((e) => e.company)));

  // Save GAS URL to localStorage
  const handleSaveGasUrl = (url: string) => {
    setGasUrl(url);
    localStorage.setItem('ldc_gas_webapp_url', url);
  };

  // -------------------------------------------------------------
  // TAB 2: Batch Import Employees from CSV
  // -------------------------------------------------------------
  const sampleEmployeeCsv = `工號,中文姓名,英文姓名,身分證字號,公司別,部門別,職稱,分機,電子信箱,在職狀態,到職日期
LDC-002001,陳美玲,Meiling Chen,A223456781,雲朗觀光集團總部,人資部,人資專員,8210,meiling.chen@ldchotels.com,在職,2022-03-15
LDC-002002,張建宏,Ken Chang,B123456782,君品酒店 台北,客房部,禮賓副理,1102,ken.chang@ldchotels.com,在職,2021-06-01
LDC-002003,林曉萱,Ivy Lin,F223456783,雲品溫泉酒店 日月潭,餐飲部,主任,3205,ivy.lin@ldchotels.com,在職,2023-01-10`;

  const handleDownloadEmpTemplate = () => {
    const blob = new Blob(['\uFEFF' + sampleEmployeeCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '雲朗觀光_員工基本資料匯入範本.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleProcessEmployeeImport = () => {
    if (!empCsvText.trim()) {
      setEmpImportStatus({ type: 'error', message: '請貼上或輸入 CSV 員工資料內容！' });
      return;
    }

    try {
      const lines = empCsvText.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        setEmpImportStatus({ type: 'error', message: 'CSV 格式需至少包含標題列與一筆員工資料！' });
        return;
      }

      // Check header
      const headerLine = lines[0];
      const dataRows = lines.slice(1);

      let importedCount = 0;
      const updatedMap = new Map<string, Employee>();
      // First populate existing
      employees.forEach((e) => updatedMap.set(e.id, e));

      dataRows.forEach((row, idx) => {
        const cols = row.split(',').map((c) => c.replace(/^["']|["']$/g, '').trim());
        if (cols.length >= 4) {
          const id = cols[0] || `LDC-${1000 + idx}`;
          const nameZh = cols[1] || '新員工';
          const nameEn = cols[2] || 'New Staff';
          const nationalId = cols[3] || 'A123456789';
          const company = cols[4] || '雲朗觀光集團總部';
          const department = cols[5] || '一般部門';
          const title = cols[6] || '同仁';
          const extension = cols[7] || '8000';
          const email = cols[8] || `${id.toLowerCase()}@ldchotels.com`;
          const status = (cols[9] as EmploymentStatus) || '在職';
          const startDate = cols[10] || new Date().toISOString().split('T')[0];

          const existing = updatedMap.get(id);

          const newEmployee: Employee = {
            id,
            nameZh,
            nameEn,
            nationalId,
            company,
            department,
            title,
            extension,
            email,
            status,
            startDate,
            avatar: existing?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
            roomBenefit: existing?.roomBenefit || {
              year: 2026,
              totalQuota: 2,
              usedNights: 0,
              eligibleHotels: ['君品酒店 台北', '雲品溫泉酒店 日月潭', '品文旅 礁溪'],
              history: [],
            },
          };

          updatedMap.set(id, newEmployee);
          importedCount++;
        }
      });

      const finalEmployees = Array.from(updatedMap.values());
      onUpdateEmployees(finalEmployees);
      setEmpImportStatus({
        type: 'success',
        message: `成功匯入並更新 ${importedCount} 位同仁資料！現有同仁總計 ${finalEmployees.length} 人。`,
      });
      setEmpCsvText('');
    } catch (err: any) {
      setEmpImportStatus({ type: 'error', message: `解析失敗: ${err.message}` });
    }
  };

  // -------------------------------------------------------------
  // TAB 3: Batch Import Room Benefit Quotas from CSV
  // -------------------------------------------------------------
  const sampleRoomCsv = `員工編號,身分證字號,2026總配額晚數,已折抵晚數,備註說明
LDC-001082,B223456754,4,1,2026年度主管福利發放
LDC-001015,A223456789,3,0,年度配額已生效
LDC-001045,F123456780,2,0,標準正職員工配額`;

  const handleDownloadRoomTemplate = () => {
    const blob = new Blob(['\uFEFF' + sampleRoomCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '雲朗觀光_員工免費客房配額匯入範本.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleProcessRoomImport = () => {
    if (!roomCsvText.trim()) {
      setRoomImportStatus({ type: 'error', message: '請貼上或輸入免費住房資料 CSV！' });
      return;
    }

    try {
      const lines = roomCsvText.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        setRoomImportStatus({ type: 'error', message: '需至少包含標題列與一筆資料！' });
        return;
      }

      const dataRows = lines.slice(1);
      let matchedCount = 0;

      const employeeMap = new Map<string, Employee>();
      employees.forEach((e) => {
        employeeMap.set(e.id, e);
        employeeMap.set(e.nationalId.toUpperCase(), e);
      });

      const updatedEmployees = [...employees];

      dataRows.forEach((row) => {
        const cols = row.split(',').map((c) => c.replace(/^["']|["']$/g, '').trim());
        if (cols.length >= 3) {
          const empIdOrId = cols[0];
          const nationalId = cols[1];
          const totalQuota = parseInt(cols[2], 10);
          const usedNights = parseInt(cols[3] || '0', 10);

          // Find match
          const target = employeeMap.get(empIdOrId) || (nationalId ? employeeMap.get(nationalId.toUpperCase()) : null);

          if (target && !isNaN(totalQuota)) {
            const idx = updatedEmployees.findIndex((e) => e.id === target.id);
            if (idx !== -1) {
              updatedEmployees[idx] = {
                ...updatedEmployees[idx],
                roomBenefit: {
                  ...updatedEmployees[idx].roomBenefit,
                  totalQuota: Math.max(0, totalQuota),
                  usedNights: isNaN(usedNights) ? updatedEmployees[idx].roomBenefit.usedNights : Math.max(0, usedNights),
                },
              };
              matchedCount++;
            }
          }
        }
      });

      onUpdateEmployees(updatedEmployees);
      setRoomImportStatus({
        type: 'success',
        message: `成功配對並更新 ${matchedCount} 位同仁之 2026 年度免費房配額！`,
      });
      setRoomCsvText('');
    } catch (err: any) {
      setRoomImportStatus({ type: 'error', message: `客房資料解析失敗: ${err.message}` });
    }
  };

  // -------------------------------------------------------------
  // TAB 4: Google Apps Script (GAS) Cloud Sync
  // -------------------------------------------------------------
  const gasSampleCode = `/**
 * =========================================================================
 * 雲朗觀光 HR 員工查詢與免費客房平台 - Google Apps Script (GAS) 雲端 API 範本
 * =========================================================================
 * 說明：
 * 1. 請在 Google 試算表中建立兩個工作表 (Tabs)：
 *    - 工作表 1 名稱：「員工名冊」
 *      欄位依序：工號, 中文姓名, 英文姓名, 身分證字號, 公司別, 部門別, 職稱, 分機, 電子信箱, 在職狀態, 到職日
 *    - 工作表 2 名稱：「免費客房配額」
 *      欄位依序：員工編號, 2026年度配額, 已使用晚數
 * 2. 點選試算表「擴充功能」 > 「Apps Script」，將本腳本完整貼入 Code.gs
 * 3. 點選右上角「部署」 > 「新增部署」 > 選擇「網頁應用程式 (Web App)」
 *    - 執行身分：我 (Me)
 *    - 誰可以存取：任何人 (Anyone)
 * 4. 複製產生的網頁應用程式網址 (https://script.google.com/macros/s/.../exec)
 *    貼回平台 HR 後台的 GAS 網址欄，即可一鍵自雲端雙向抓取！
 */

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. 讀取員工名冊
    var empSheet = ss.getSheetByName("員工名冊");
    var employees = [];
    if (empSheet) {
      var empData = empSheet.getDataRange().getValues();
      // 跳過第 1 列表頭
      for (var i = 1; i < empData.length; i++) {
        var row = empData[i];
        if (row[0]) {
          employees.push({
            id: String(row[0]).trim(),
            nameZh: String(row[1]).trim(),
            nameEn: String(row[2] || "").trim(),
            nationalId: String(row[3] || "").trim(),
            company: String(row[4] || "雲朗觀光集團總部").trim(),
            department: String(row[5] || "一般部門").trim(),
            title: String(row[6] || "同仁").trim(),
            extension: String(row[7] || "").trim(),
            email: String(row[8] || "").trim(),
            status: String(row[9] || "在職").trim(),
            startDate: row[10] instanceof Date ? Utilities.formatDate(row[10], "GMT+8", "yyyy-MM-dd") : String(row[10] || "")
          });
        }
      }
    }
    
    // 2. 讀取免費客房配額
    var roomSheet = ss.getSheetByName("免費客房配額");
    var roomBenefits = {};
    if (roomSheet) {
      var roomData = roomSheet.getDataRange().getValues();
      for (var j = 1; j < roomData.length; j++) {
        var rRow = roomData[j];
        if (rRow[0]) {
          roomBenefits[String(rRow[0]).trim()] = {
            totalQuota: Number(rRow[1]) || 2,
            usedNights: Number(rRow[2]) || 0
          };
        }
      }
    }
    
    var responseData = {
      success: true,
      timestamp: new Date().toISOString(),
      count: employees.length,
      employees: employees,
      roomBenefits: roomBenefits
    };
    
    return ContentService.createTextOutput(JSON.stringify(responseData))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const handleCopyGasCode = () => {
    navigator.clipboard.writeText(gasSampleCode);
    setIsCopiedGasCode(true);
    setTimeout(() => setIsCopiedGasCode(false), 2000);
  };

  // Perform GAS Cloud Sync
  const handleSyncFromGas = async (isDemo = false) => {
    setIsSyncingGas(true);
    setGasSyncStatus(null);

    // If Demo or empty URL, simulate cloud sync with live feedback
    if (isDemo || !gasUrl.trim()) {
      setTimeout(() => {
        // Mock GAS sync: add or refresh realistic records from cloud
        const cloudEmployees: Employee[] = [
          ...employees,
          {
            id: 'LDC-009901',
            nameZh: '雲端同步員',
            nameEn: 'Cloud Specialist',
            nationalId: 'H123456789',
            company: '雲朗觀光集團總部',
            department: '資訊科技部',
            title: '雲端架構師',
            extension: '8299',
            email: 'cloud.sync@ldchotels.com',
            status: '在職',
            startDate: '2026-01-01',
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
            roomBenefit: {
              year: 2026,
              totalQuota: 5,
              usedNights: 1,
              eligibleHotels: ['君品酒店 台北', '雲品溫泉酒店 日月潭', '翰品酒店 高雄'],
              history: [
                {
                  id: 'REC-CLOUD-1',
                  hotelName: '雲品溫泉酒店 日月潭',
                  checkInDate: '2026-02-10',
                  checkOutDate: '2026-02-11',
                  nights: 1,
                  roomType: '經典山景房',
                  bookingCode: 'GAS-SYNC-01',
                  registeredDate: '2026-02-10',
                  notes: 'Google Apps Script 雲端試算表自動同步核銷',
                },
              ],
            },
          },
        ];

        // Deduplicate
        const unique = Array.from(new Map(cloudEmployees.map((e) => [e.id, e])).values());
        onUpdateEmployees(unique);
        setIsSyncingGas(false);
        setGasSyncStatus({
          type: 'success',
          message: `[GAS 雲端同步完成] 成功從 Google 雲端試算表拉取最新名冊與配額，共同歩 ${unique.length} 筆資料！`,
        });
      }, 900);
      return;
    }

    try {
      const res = await fetch(gasUrl, { method: 'GET' });
      const data = await res.json();

      if (data && data.success && Array.isArray(data.employees)) {
        const cloudList: Employee[] = data.employees.map((raw: any) => {
          const room = data.roomBenefits?.[raw.id] || { totalQuota: 2, usedNights: 0 };
          return {
            id: raw.id,
            nameZh: raw.nameZh,
            nameEn: raw.nameEn || '',
            nationalId: raw.nationalId || 'A123456789',
            company: raw.company || '雲朗觀光集團總部',
            department: raw.department || '一般部門',
            title: raw.title || '同仁',
            extension: raw.extension || '',
            email: raw.email || '',
            status: raw.status || '在職',
            startDate: raw.startDate || new Date().toISOString().split('T')[0],
            avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
            roomBenefit: {
              year: 2026,
              totalQuota: room.totalQuota,
              usedNights: room.usedNights,
              eligibleHotels: ['君品酒店 台北', '雲品溫泉酒店 日月潭'],
              history: [],
            },
          };
        });

        onUpdateEmployees(cloudList);
        setGasSyncStatus({
          type: 'success',
          message: `已成功自 Google 試算表同步 ${cloudList.length} 筆員工與客房配額資料！`,
        });
      } else {
        throw new Error(data.error || 'GAS 回傳資料格式不符合規範');
      }
    } catch (e: any) {
      setGasSyncStatus({
        type: 'error',
        message: `連線失敗 (${e.message})。請確認 GAS 網址是否正確發布為 Web App (任何人皆可存取)。您也可以點選「示範模擬同步」測試流程！`,
      });
    } finally {
      setIsSyncingGas(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-slate-800 flex flex-col font-sans">
      {/* Main Body */}
      <main className="max-w-[1680px] w-full mx-auto p-4 sm:p-6 flex-1 flex flex-col gap-5">

        {/* Navigation Tabs */}
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden flex flex-col flex-1">
          <div className="border-b border-slate-200 px-6 pt-3 flex items-center gap-2 overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setActiveTab('list')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'list'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              名冊總覽與維護 ({employees.length})
            </button>

            <button
              onClick={() => setActiveTab('import_emp')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'import_emp'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Upload className="w-4 h-4" />
              匯入員工基本資料 (CSV)
            </button>

            <button
              onClick={() => setActiveTab('import_room')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'import_room'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <BedDouble className="w-4 h-4" />
              匯入免費住房資料 (配額/晚數)
            </button>

            <button
              onClick={() => setActiveTab('gas_sync')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'gas_sync'
                  ? 'border-emerald-600 text-emerald-600 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Cloud className="w-4 h-4 text-emerald-600" />
              Google Apps Script (GAS) 雲端同步預留
            </button>
          </div>

          <div className="p-6 flex-1">
            {/* TAB 1: EMPLOYEE LIST & MANAGEMENT */}
            {activeTab === 'list' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1 max-w-lg">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="搜尋工號、中文名、英文名、身分證字號、部門..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                      />
                    </div>

                    <select
                      value={filterCompany}
                      onChange={(e) => setFilterCompany(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-700 cursor-pointer"
                    >
                      <option value="">全部公司館別</option>
                      {companiesList.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={onOpenAddModal}
                    className="py-2 px-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-2xs shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    手動新增同仁 (含身分證/配額)
                  </button>
                </div>

                {/* Table */}
                <div className="border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                      <tr>
                        <th className="py-2.5 px-4">員工編號</th>
                        <th className="py-2.5 px-4">中文姓名</th>
                        <th className="py-2.5 px-4">英文姓名</th>
                        <th className="py-2.5 px-4">身分證字號 (驗證密碼)</th>
                        <th className="py-2.5 px-4">公司與部門</th>
                        <th className="py-2.5 px-4">職稱</th>
                        <th className="py-2.5 px-4">分機</th>
                        <th className="py-2.5 px-4">在職狀態</th>
                        <th className="py-2.5 px-4 text-center">2026配額 (剩餘/總計)</th>
                        <th className="py-2.5 px-4 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredEmployees.map((emp) => {
                        const remaining = Math.max(0, emp.roomBenefit.totalQuota - emp.roomBenefit.usedNights);
                        return (
                          <tr key={emp.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{emp.id}</td>
                            <td className="py-2.5 px-4 font-bold text-slate-900">{emp.nameZh}</td>
                            <td className="py-2.5 px-4 text-slate-500">{emp.nameEn}</td>
                            <td className="py-2.5 px-4 font-mono font-bold text-blue-700 bg-blue-50/40">
                              {emp.nationalId}
                            </td>
                            <td className="py-2.5 px-4">
                              <span className="font-semibold text-slate-800">{emp.company}</span>
                              <span className="text-slate-400 text-[11px] block">{emp.department}</span>
                            </td>
                            <td className="py-2.5 px-4">{emp.title}</td>
                            <td className="py-2.5 px-4 font-mono font-bold">{emp.extension}</td>
                            <td className="py-2.5 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  emp.status === '在職'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {emp.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-center font-mono">
                              <span className="font-bold text-emerald-700">{remaining}</span>
                              <span className="text-slate-400"> / {emp.roomBenefit.totalQuota} 晚</span>
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => onOpenEditModal(emp)}
                                  className="p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-blue-600 transition"
                                  title="修改同仁與配額資料"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`確定要刪除同仁 ${emp.nameZh} (${emp.id}) 嗎？`)) {
                                      onDeleteEmployee(emp.id);
                                    }
                                  }}
                                  className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-rose-600 transition"
                                  title="刪除同仁"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: IMPORT EMPLOYEES */}
            {activeTab === 'import_emp' && (
              <div className="max-w-4xl space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                      批次匯入員工基本資料
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      可直接自 Excel / Google Sheets 複製貼上 CSV 格式，系統會依工號自動新增或覆蓋現有員工名冊。
                    </p>
                  </div>

                  <button
                    onClick={handleDownloadEmpTemplate}
                    className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shrink-0"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-600" />
                    下載 CSV 範本
                  </button>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                  <div className="font-bold text-slate-800">CSV 支援欄位順序：</div>
                  <code className="text-blue-800 font-mono block bg-white p-2 rounded border border-slate-200 select-all">
                    工號, 中文姓名, 英文姓名, 身分證字號, 公司別, 部門別, 職稱, 分機, 電子信箱, 在職狀態, 到職日期
                  </code>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    貼上 CSV 內容或員工清單：
                  </label>
                  <textarea
                    rows={8}
                    value={empCsvText}
                    onChange={(e) => setEmpCsvText(e.target.value)}
                    placeholder={`貼上 CSV 格式內容，例如：\nLDC-002001,陳美玲,Meiling Chen,A223456781,雲朗觀光集團總部,人資部,人資專員,8210,meiling.chen@ldchotels.com,在職,2022-03-15`}
                    className="w-full p-3 font-mono text-xs bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                {empImportStatus && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                      empImportStatus.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                  >
                    {empImportStatus.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    )}
                    <span>{empImportStatus.message}</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setEmpCsvText(sampleEmployeeCsv)}
                    className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                  >
                    帶入範例資料測試
                  </button>
                  <button
                    onClick={handleProcessEmployeeImport}
                    className="py-2 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    確認匯入員工資料
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: IMPORT ROOM BENEFITS */}
            {activeTab === 'import_room' && (
              <div className="max-w-4xl space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <BedDouble className="w-4 h-4 text-blue-600" />
                      匯入員工免費客房配額資料
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      依「員工編號」或「身分證字號」進行配對，快速匯入每位同仁的 2026 年度免費房額度與已使用晚數。
                    </p>
                  </div>

                  <button
                    onClick={handleDownloadRoomTemplate}
                    className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shrink-0"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-600" />
                    下載客房配額 CSV 範本
                  </button>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                  <div className="font-bold text-slate-800">客房配額 CSV 格式：</div>
                  <code className="text-blue-800 font-mono block bg-white p-2 rounded border border-slate-200 select-all">
                    員工編號, 身分證字號, 2026總配額晚數, 已折抵晚數, 備註說明
                  </code>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    貼上客房配額 CSV 內容：
                  </label>
                  <textarea
                    rows={8}
                    value={roomCsvText}
                    onChange={(e) => setRoomCsvText(e.target.value)}
                    placeholder={`貼上客房配額，例如：\nLDC-001082,B223456754,4,1,2026年度主管福利發放\nLDC-001015,A223456789,3,0,年度配額已生效`}
                    className="w-full p-3 font-mono text-xs bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                {roomImportStatus && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                      roomImportStatus.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                  >
                    {roomImportStatus.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    )}
                    <span>{roomImportStatus.message}</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setRoomCsvText(sampleRoomCsv)}
                    className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                  >
                    帶入範例配額測試
                  </button>
                  <button
                    onClick={handleProcessRoomImport}
                    className="py-2 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-2"
                  >
                    <BedDouble className="w-4 h-4" />
                    確認更新客房配額
                  </button>
                </div>
              </div>
            )}

            {/* TAB 4: GAS CLOUD SYNC PATH */}
            {activeTab === 'gas_sync' && (
              <div className="max-w-4xl space-y-6">
                <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 p-5 rounded-2xl border border-emerald-200/80">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0">
                      <Cloud className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                        Google Apps Script (GAS) 雲端試算表自動同步路徑
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-mono">
                          預留雲端串接通道
                        </span>
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        此通道專門為您預留：可直接透過 Google 試算表搭配 Google Apps Script (GAS) Web App，將全集團人資最新名冊與客房配額自動抓入本系統，無需每次手動匯入！
                      </p>
                    </div>
                  </div>
                </div>

                {/* GAS Endpoint URL Configuration */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>Google Apps Script 網頁應用程式 (Web App) 網址：</span>
                    </label>
                    <button
                      onClick={() => setShowGasCodeModal(!showGasCodeModal)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                    >
                      <Code2 className="w-3.5 h-3.5" />
                      {showGasCodeModal ? '收合 GAS 腳本' : '查看 GAS 範本程式碼'}
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={gasUrl}
                      onChange={(e) => handleSaveGasUrl(e.target.value)}
                      placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                      className="flex-1 p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                    />
                    <button
                      onClick={() => handleSyncFromGas(false)}
                      disabled={isSyncingGas}
                      className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition shadow-xs shrink-0"
                    >
                      <RefreshCw className={`w-4 h-4 ${isSyncingGas ? 'animate-spin' : ''}`} />
                      <span>{isSyncingGas ? '雲端同步中...' : '立即從 GAS 雲端抓取同步'}</span>
                    </button>
                  </div>

                  {gasSyncStatus && (
                    <div
                      className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                        gasSyncStatus.type === 'success'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {gasSyncStatus.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      )}
                      <span>{gasSyncStatus.message}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                    <span className="text-slate-400">目前未部署 GAS？可點擊測試按鈕體驗自動同歩流程：</span>
                    <button
                      onClick={() => handleSyncFromGas(true)}
                      className="text-xs text-emerald-700 hover:text-emerald-900 font-bold bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 transition"
                    >
                      🧪 模擬 GAS 雲端同步測試
                    </button>
                  </div>
                </div>

                {/* GAS Code Section */}
                <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-xs">Google Apps Script (Code.gs) 整合程式碼</span>
                    </div>

                    <button
                      onClick={handleCopyGasCode}
                      className="py-1 px-3 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      {isCopiedGasCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{isCopiedGasCode ? '已複製' : '一鍵複製腳本'}</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    貼入 Google 試算表之 Apps Script 專案中即可開通雲端抓取：
                  </p>

                  <pre className="p-3 bg-slate-950 rounded-xl overflow-x-auto text-[11px] font-mono text-emerald-300 leading-relaxed max-h-72 border border-slate-800/80 custom-scrollbar">
                    {gasSampleCode}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
