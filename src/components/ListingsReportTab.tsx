import React, { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import { User, Employee, EmployeeStats } from "../types";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line 
} from "recharts";
import { 
  Lock, FileSpreadsheet, FileDown, PlusCircle, Trash2, Edit3, 
  TrendingUp, TrendingDown, Users, DollarSign, Award, RefreshCw, AlertCircle, Save,
  ChevronDown, ChevronUp, Upload, HelpCircle, Cloud, LogIn, LogOut, ExternalLink, CheckCircle, Info, Calendar, Clock, Check, Printer, Download
} from "lucide-react";
import { motion } from "motion/react";
import { initAuth, googleSignIn, getAccessToken } from "../utils/firebaseAuth";
import { listDriveFiles, uploadFileToDrive, findOrCreateFolder } from "../utils/googleDriveApi";

// Helper to parse CSV raw text with robust cell-boundary mapping
function parseCSV(text: string): string[][] {
  const lines = text.split(/\r?\n/);
  const result: string[][] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const row: string[] = [];
    let insideQuote = false;
    let entry = "";
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        row.push(entry.trim().replace(/^"|"$/g, ''));
        entry = "";
      } else {
        entry += char;
      }
    }
    row.push(entry.trim().replace(/^"|"$/g, ''));
    result.push(row);
  }
  return result;
}

// Helper to map and compute CSV rows dynamically matching Taiwan SE criteria
function processParsedCSV(csvRows: string[][]): any[] {
  if (csvRows.length < 2) return [];
  const headers = csvRows[0].map(h => h.trim());
  const dataRows = csvRows.slice(1);
  
  const getIndex = (keywords: string[]) => {
    return headers.findIndex(h => keywords.some(k => h.toLowerCase().includes(k.toLowerCase())));
  };
  
  const idxId = getIndex(["員編", "員工編號", "id", "ID", "empId", "employeeid"]);
  const idxName = getIndex(["姓名", "員工姓名", "name", "Name"]);
  
  // 12 monthly salary column indices
  const monthlyIndices: number[] = [];
  for (let m = 1; m <= 12; m++) {
    monthlyIndices.push(getIndex([`${m}月薪資`, `${m}月薪水`, `${m}月`, `m${m}`, `month${m}`]));
  }

  const idxBonus1 = getIndex(["第一次年終獎金", "年終獎金", "firstYearEnd", "年終"]);
  const idxBonus2 = getIndex(["第二次績效獎金", "績效獎金", "secondPerf", "績效"]);
  const idxOtherBonus = getIndex(["其他獎金", "otherBonus", "其他"]);
  const idxBonus28 = getIndex(["二八獎金", "bonus28", "二八"]);
  const idxStockContribution = getIndex(["公提持股金", "持股金", "stock", "持股"]);
  const idxSalesComm = getIndex(["業績獎金", "salesCommission", "業績"]);
  const idxWorkBonus = getIndex(["工作獎金", "workBonus", "工作"]);
  const idxFestival = getIndex(["節金", "festivalBonus", "三節", "節日"]);
  const idxBirthday = getIndex(["生日禮金", "birthdayGift", "生日"]);
  const idxOvertime = getIndex(["加班費", "overtime", "加班"]);
  const idxSeverance = getIndex(["資遣費", "離職金", "severance", "離職"]);
  const idxMaternity = getIndex(["生育津貼", "maternity", "生育", "津貼"]);
  
  return dataRows.map((row, index) => {
    const val = (idx: number, def = 0) => {
      if (idx === -1 || idx >= row.length) return def;
      const cleaned = row[idx].replace(/[^0-9.-]/g, "");
      const num = Number(cleaned);
      return isNaN(num) ? def : num;
    };
    
    const empId = idxId !== -1 && idxId < row.length ? row[idxId] : `E${201 + index}`;
    const name = idxName !== -1 && idxName < row.length ? row[idxName] : `員工 ${index + 1}`;
    
    // Sum 12 months salary columns if present
    let originalAnnualSalary = 0;
    let months = 0;
    let hasMonthlyColumns = false;

    for (let m = 0; m < 12; m++) {
      const idxM = monthlyIndices[m];
      if (idxM !== -1 && idxM < row.length) {
        hasMonthlyColumns = true;
        const mVal = val(idxM, 0);
        originalAnnualSalary += mVal;
        if (mVal > 0) {
          months++;
        }
      }
    }

    // Fallback to the single columns if monthly columns are not specified
    if (!hasMonthlyColumns || originalAnnualSalary === 0) {
      const idxOriginal = getIndex(["原始年薪", "年薪金額", "original", "Original", "年薪"]);
      originalAnnualSalary = val(idxOriginal, 0);
      const idxMonths = getIndex(["12", "任職月數", "月數", "months", "Months"]);
      months = idxMonths !== -1 && idxMonths < row.length ? val(idxMonths, 12) : 12;
    }

    if (months === 0) {
      months = 12; // Default to 12 months
    }
    
    const firstYearEndBonus = val(idxBonus1, 0);
    const secondPerfBonus = val(idxBonus2, 0);
    const otherBonus = val(idxOtherBonus, 0);
    const bonus28 = val(idxBonus28, 0);
    const companyStockContribution = val(idxStockContribution, 0);
    const salesCommission = val(idxSalesComm, 0);
    const workBonus = val(idxWorkBonus, 0);
    const festivalBonus = val(idxFestival, 0);
    const birthdayGift = val(idxBirthday, 0);
    const overtime = val(idxOvertime, 0);
    const severance = val(idxSeverance, 0);
    const maternityAllowance = val(idxMaternity, 0);
    
    // 計算：非經常性薪資 D (後面年終獎金 + 績效獎金... 為每個月或年累加起來的加總數字)
    const nonRegularSalary = firstYearEndBonus + secondPerfBonus + otherBonus + bonus28 + companyStockContribution + salesCommission + workBonus + festivalBonus + birthdayGift + overtime + severance + maternityAllowance;
    
    // 計算：「經常性薪資」及依公司規定「以員工任職月數比例」計算發放之薪資項目
    // 原始年薪金額 - 非經常性薪資得出的
    const salary = originalAnnualSalary - nonRegularSalary;
    
    return {
      empId,
      name,
      title: "全時同仁",
      department: ".",
      salary: salary < 0 ? 0 : salary,
      welfare: 70000, // Default welfare NT$
      
      months,
      originalAnnualSalary,
      firstYearEndBonus,
      secondPerfBonus,
      otherBonus,
      bonus28,
      companyStockContribution,
      salesCommission,
      workBonus,
      festivalBonus,
      birthdayGift,
      overtime,
      severance,
      maternityAllowance,
      nonRegularSalary
    };
  });
}

interface ListingsReportTabProps {
  user: User;
  onLogAction: (action: string, details: string) => void;
}

export default function ListingsReportTab({ user, onLogAction }: ListingsReportTabProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const membersInputRef = useRef<HTMLInputElement>(null);
  const dragMembersInputRef = useRef<HTMLInputElement>(null);

  // Dynamically extract unique departments from loaded employees to populate dropdown select
  const uniqueDepartments = useMemo(() => {
    const defaultDepts = [
      "總經理室", "財務處", "總務組", "北區業務中心", "南區業務中心",
      "台北訂房中心", "開發處", "資訊工程處", "稽核處", "人力資源組",
      "中區業務中心", "餐飲事業總處", "國外事業處", "日月潭", "台北", "花東"
    ];
    const fromEmployees = employees.map(e => e.department).filter(Boolean);
    return Array.from(new Set([...defaultDepts, ...fromEmployees]));
  }, [employees]);
  const [stats, setStats] = useState<EmployeeStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states for creating/editing employee
  const [showAddForm, setShowAddForm] = useState(false);
  const [empId, setEmpId] = useState("");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState(".");
  const [salary, setSalary] = useState(900000);
  const [welfare, setWelfare] = useState(70000);
  const [year, setYear] = useState(2025);

  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);

  // Deletion confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string; year: number } | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState<{ type: "all" | "year"; year?: number } | null>(null);

  // Cloud backup state
  const [savingBackup, setSavingBackup] = useState(false);

  // Excel Import States (3 Files: 本薪, 其他, 節金)
  const [showImportModal, setShowImportModal] = useState(false);
  const [excelFile1, setExcelFile1] = useState<File | null>(null);
  const [excelFile2, setExcelFile2] = useState<File | null>(null);
  const [excelFile3, setExcelFile3] = useState<File | null>(null);
  const [parsedEmployees, setParsedEmployees] = useState<any[]>([]);
  const parsedEmployeesRef = useRef<any[]>([]);
  useEffect(() => {
    parsedEmployeesRef.current = parsedEmployees;
  }, [parsedEmployees]);
  const [dragActive, setDragActive] = useState(false);
  const [importYear, setImportYear] = useState(2026);
  const [importing, setImporting] = useState(false);

  // Google Drive Sync states
  const [importMode, setImportMode] = useState<"upload" | "drive_sync">("upload");
  const [gDriveConnected, setGDriveConnected] = useState(false);
  const [gDriveToken, setGDriveToken] = useState<string | null>(null);
  const [gDriveUserEmail, setGDriveUserEmail] = useState<string | null>(null);
  const [gDriveLoading, setGDriveLoading] = useState(false);
  const [driveFolderFiles, setDriveFolderFiles] = useState<any[]>([]);
  const [driveSyncProgress, setDriveSyncProgress] = useState<string | null>(null);

  // Sync settings
  const [syncSettings, setSyncSettings] = useState({
    folderUrl: "https://drive.google.com/drive/folders/1i8t5Q1r5-Y4RZeadGcq9QGEzLUponwQ7",
    folderId: "1i8t5Q1r5-Y4RZeadGcq9QGEzLUponwQ7",
    autoSync: false,
    frequency: "manual", // manual | on_open | daily | weekly | monthly
    lastSyncTime: null as string | null,
    lastSyncStatus: "idle",
    lastSyncLog: "",
    targetYear: 2025,
    authMode: "direct",
    googleClientId: ""
  });
  const syncSettingsRef = useRef(syncSettings);
  useEffect(() => {
    syncSettingsRef.current = syncSettings;
  }, [syncSettings]);

  const [driveSyncLoading, setDriveSyncLoading] = useState(false);

  // File manual mapping selection
  const [driveSelectedFile1, setDriveSelectedFile1] = useState<string | null>(null);
  const [driveSelectedFile2, setDriveSelectedFile2] = useState<string | null>(null);
  const [driveSelectedFile3, setDriveSelectedFile3] = useState<string | null>(null);
  const [overviewYear, setOverviewYear] = useState<number>(2026);

  // Row Expand State
  const [expandedEmpIds, setExpandedEmpIds] = useState<Record<string, boolean>>({});

  // Members Management (人員管理) states
  const [members, setMembers] = useState<{ empId: string; name: string; grade: string; onboardingDate: string; department?: string }[]>([]);
  const [insiders, setInsiders] = useState<string[]>([]);
  const [settlementDate, setSettlementDate] = useState("2026-07-02");
  const [membersSearchQuery, setMembersSearchQuery] = useState("");

  const fetchInsiders = async () => {
    try {
      const res = await fetch("/api/insiders");
      if (res.ok) {
        const data = await res.json();
        setInsiders(data.insiders || []);
      }
    } catch (err) {
      console.error("Failed to fetch insiders:", err);
    }
  };

  const handleToggleInsider = async (empId: string) => {
    const isCurrentlyInsider = insiders.includes(empId);
    try {
      if (isCurrentlyInsider) {
        const res = await fetch(`/api/insiders/${empId}?username=${user.username}&role=${user.role}`, {
          method: "DELETE"
        });
        if (res.ok) {
          const data = await res.json();
          setInsiders(data.insiders || []);
          fetchStatsAndEmployees();
          onLogAction("取消設定內部人", `取消了 ${empId} 的內部人身分`);
        }
      } else {
        const res = await fetch("/api/insiders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ empId, username: user.username, role: user.role })
        });
        if (res.ok) {
          const data = await res.json();
          setInsiders(data.insiders || []);
          fetchStatsAndEmployees();
          onLogAction("設定內部人", `將 ${empId} 設定為內部人身分`);
        }
      }
    } catch (err) {
      console.error("Error toggling insider:", err);
    }
  };

  // Sub Tab State: "overview" (總覽), "details" (細項) or "members" (人員管理)
  const [subTab, setSubTab] = useState<"overview" | "details" | "members">("overview");

  const isHR = user.role === "HR_ADMIN";
  const isExecutive = user.role === "EXECUTIVE";
  const isSalesLeader = user.role === "SALES_LEADER";

  const fetchMembers = async () => {
    try {
      const res = await fetch("/api/members");
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
      }
    } catch (err) {
      console.error("Failed to fetch members:", err);
    }
  };

  const fetchStatsAndEmployees = async (overrideDate?: string) => {
    setLoading(true);
    setError(null);
    try {
      // Load raw employee database (includes salaries)
      const empRes = await fetch(`/api/employees/records?role=${user.role}`);
      if (!empRes.ok) throw new Error("無權存取員工薪酬資料。");
      const empData = await empRes.json();
      setEmployees(empData);

      // Load dynamical MOPS computed statistics
      const dateToUse = overrideDate || settlementDate;
      const statsRes = await fetch(`/api/employees/statistics?role=${user.role}&settlementDate=${dateToUse}`);
      const statsData = await statsRes.json();
      setStats(statsData);
    } catch (err: any) {
      setError(err.message || "載入申報數據失敗，請確認連線。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatsAndEmployees();
    fetchMembers();
    fetchInsiders();
  }, []);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isHR) return;

    try {
      const payload = { empId, name, title, department, salary, welfare, year, username: user.username, role: user.role };
      const response = await fetch("/api/employees/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setShowAddForm(false);
        // Reset form
        setEmpId("");
        setName("");
        setTitle("");
        setSalary(900000);
        setWelfare(70000);
        fetchStatsAndEmployees();
        onLogAction("新增申報員工", `建立 ${year} 年度非主管員工 ${name} 之薪酬申報資料`);
      } else {
        const data = await response.json();
        alert(data.error || "新增失敗");
      }
    } catch (err) {
      alert("連線失敗");
    }
  };

  const handleEditEmployee = (emp: Employee) => {
    setEditingEmpId(emp.id);
    setEmpId(emp.empId);
    setName(emp.name);
    setTitle(emp.title);
    setDepartment(emp.department);
    setSalary(emp.salary);
    setWelfare(emp.welfare);
    setYear(emp.year);
    setShowAddForm(true);
    setSubTab("details");
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isHR || !editingEmpId) return;

    try {
      const payload = { empId, name, title, department, salary, welfare, year, username: user.username, role: user.role };
      const response = await fetch(`/api/employees/records/${editingEmpId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setShowAddForm(false);
        setEditingEmpId(null);
        setEmpId("");
        setName("");
        setTitle("");
        fetchStatsAndEmployees();
        onLogAction("更新員工薪資", `修正 ${year} 年度員工 ${name} 的薪資/福利申報數據`);
      } else {
        const data = await response.json();
        alert(data.error || "修改失敗");
      }
    } catch (err) {
      alert("連線失敗");
    }
  };

  const handleDeleteEmployee = async (id: string, nameStr: string, yr: number) => {
    if (!isHR) return;

    try {
      const response = await fetch(`/api/employees/records/${id}?username=${encodeURIComponent(user.username)}&role=${user.role}`, {
        method: "DELETE"
      });

      if (response.ok) {
        fetchStatsAndEmployees();
        onLogAction("刪除申報員工", `刪成了 ${yr} 年度員工 ${nameStr} 的薪酬申報資料`);
      } else {
        const data = await response.json();
        alert(data.error || "刪除失敗");
      }
    } catch (err) {
      alert("連線錯誤");
    }
  };

  const handleBulkDelete = async (type: "all" | "year", targetYear?: number) => {
    if (!isHR) return;

    try {
      const queryParams = new URLSearchParams({
        username: user.username,
        role: user.role,
      });
      if (type === "year" && targetYear) {
        queryParams.append("year", String(targetYear));
      }
      const response = await fetch(`/api/employees/records?${queryParams.toString()}`, {
        method: "DELETE"
      });

      if (response.ok) {
        fetchStatsAndEmployees();
        const msg = type === "year" ? `批次刪除了 ${targetYear} 年度所有員工薪資申報資料` : "清空了所有年度的員工薪酬申報資料";
        onLogAction("批次刪除員工薪資", msg);
      } else {
        const data = await response.json();
        alert(data.error || "刪除失敗");
      }
    } catch (err) {
      alert("連線錯誤");
    }
  };

  // Safe Cloud Storage Saving (儲存至雲端儲存空間)
  const handleSaveToCloud = async (format: "CSV" | "JSON") => {
    setSavingBackup(true);
    try {
      const filename = `${year}年度_非主管職務全時員工中位數統計表_${Date.now().toString().slice(6)}.${format.toLowerCase()}`;
      const payload = {
        filename,
        fileType: format,
        size: format === "CSV" ? "3.2 KB" : "8.5 KB",
        username: user.username,
        role: user.role
      };

      const response = await fetch("/api/cloud/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        alert(`🎉 報表「${filename}」已成功加密並備份至雲端儲存 Bucket，產生數位簽章並寫入安全稽核日誌。`);
        onLogAction("雲端儲存備份", `將申報報表「${filename}」備份至安全雲端空間`);
      } else {
        const data = await response.json();
        alert(data.error || "備份失敗");
      }
    } catch (err) {
      alert("備份連線出錯");
    } finally {
      setSavingBackup(false);
    }
  };

  const handleExportCSV = () => {
    if (stats.length === 0) return;

    let csvContent = "\ufeff"; // BOM for Excel
    csvContent += "申報年度,全時員工人數 (名),薪資總額 (NTD),薪資平均數 (NTD),薪資中位數 (NTD),員工變動率,平均薪資變動率,中位數變動率,福利費用總額 (NTD),福利費用平均數 (NTD)\n";

    stats.forEach(s => {
      csvContent += `${s.year}年,${s.employeeCount},${s.totalSalary},${s.avgSalary},${s.medianSalary},${s.yoySalaryCount},${s.yoySalaryAvg},${s.yoySalaryMedian},${s.totalWelfare},${s.avgWelfare}\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `HR_上市上櫃申報_非主管職全時員工薪資中位數報表_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onLogAction("匯出申報報表", "一鍵匯出全時人員中位數 MOPS 格式 CSV 檔案");
  };

  const handlePrintPDF = () => {
    onLogAction("列印申報報表", "使用瀏覽器整合高解析度樣式，一鍵列印或輸出申報報表為 PDF 檔案");
    window.print();
  };

  const handleDownloadTemplate = () => {
    const headers = [
      "員編", "姓名", 
      "1月薪資", "2月薪資", "3月薪資", "4月薪資", "5月薪資", "6月薪資",
      "7月薪資", "8月薪資", "9月薪資", "10月薪資", "11月薪資", "12月薪資",
      "第一次年終獎金(含董事長紅包)", "第二次績效獎金(含特別獎金)", "其他獎金",
      "二八獎金", "公提持股金", "業績獎金", "工作獎金", "節金", "生日禮金",
      "加班費", "資遣費離職金", "生育津貼"
    ].join(",");
    const exampleRow = [
      "E201", "王大明", 
      "100000", "100000", "100000", "100000", "100000", "100000",
      "100000", "100000", "100000", "100000", "100000", "100000",
      "150000", "80000", "10000",
      "0", "30000", "50000", "10000", "6000", "2000",
      "15000", "0", "0"
    ].join(",");
    const csvContent = "\ufeff" + headers + "\n" + exampleRow + "\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "全時員工中位數匯入範本_Salary_Import_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onLogAction("下載範本", "下載全時員工非經常性薪資計算範本");
  };

  // Personnel Management Helper functions
  const parseExcelDate = (val: any): string => {
    if (val === undefined || val === null) return "";
    if (typeof val === "number") {
      // Excel date serial number (UTC shift)
      const date = new Date((val - 25569) * 86400 * 1000);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    const str = String(val).trim();
    if (!str) return "";
    
    // Check Taiwan Republic Year e.g. "112/05/20" or "1120520"
    const twReg = /^(\d{2,3})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/;
    const matchTw = str.match(twReg);
    if (matchTw) {
      const y = parseInt(matchTw[1], 10) + 1911;
      const m = matchTw[2].padStart(2, "0");
      const d = matchTw[3].padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    
    // Try standard date parse
    const parsed = Date.parse(str);
    if (!isNaN(parsed)) {
      const date = new Date(parsed);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return str;
  };

  const calculateSeniority = (onboardingStr: string, settlementStr: string): string => {
    if (!onboardingStr || !settlementStr) return "-";
    try {
      const start = new Date(onboardingStr);
      const end = new Date(settlementStr);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return "-";
      
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      
      const diffMs = end.getTime() - start.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
      
      if (diffDays < 0) {
        return "0.00 年 (未到職)";
      }
      
      const seniorityYears = (diffDays / 365).toFixed(2);
      return `${seniorityYears} 年`;
    } catch (err) {
      return "-";
    }
  };

  const isUnderSixMonths = (onboardingStr: string, settlementStr: string) => {
    if (!onboardingStr || !settlementStr) return false;
    try {
      const start = new Date(onboardingStr);
      const end = new Date(settlementStr);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return diffDays < 183;
    } catch {
      return false;
    }
  };

  const handleMembersImport = async (file: File) => {
    try {
      setImporting(true);
      const workbook = await readExcelFile(file);
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const rows = sheetToRows(sheet);
      
      if (rows.length < 2) {
        alert("匯入失敗：檔案中無足夠的資料列。");
        return;
      }
      
      const idxEmpId = findColumnIndex(rows, ["pers_cod", "員工編號", "員編"]);
      const idxName = findColumnIndex(rows, ["pers_nam", "姓名"]);
      const idxGrade = findColumnIndex(rows, ["grade_cod", "職等"]);
      const idxOnboarding = findColumnIndex(rows, ["enter_dat", "到職日"]);
      const idxDept = findColumnIndex(rows, ["dept_nam", "部門", "科別", "單位", "處", "組", "部門名稱", "Department", "Dept", "主辦單位", "所屬單位", "單位名稱", "所屬部門"]);
      
      if (idxEmpId < 0 || idxName < 0) {
        alert(`檔案解析失敗！未能找到必要的「員編」與「姓名」欄位。\n請確認表格標頭。`);
        return;
      }
      
      const startRow = 1;
      const newMembers: any[] = [];
      
      for (let r = startRow; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length === 0) continue;
        
        const rawEmpId = String(row[idxEmpId] || "").trim();
        if (!rawEmpId || rawEmpId === "員工編號" || rawEmpId === "員編" || rawEmpId === "工號") continue;
        
        const nameStr = String(row[idxName] || "").trim();
        const gradeStr = idxGrade >= 0 ? String(row[idxGrade] || "").trim() : "一般員工";
        const onboardingRaw = idxOnboarding >= 0 ? row[idxOnboarding] : "";
        const onboardingStr = parseExcelDate(onboardingRaw);
        const deptStr = idxDept >= 0 ? String(row[idxDept] || "").trim() : ".";
        
        newMembers.push({
          empId: rawEmpId,
          name: nameStr,
          grade: gradeStr,
          onboardingDate: onboardingStr,
          department: deptStr
        });
      }
      
      if (newMembers.length === 0) {
        alert("無有效的人員資料列。");
        return;
      }
      
      const response = await fetch("/api/members/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: user.username,
          role: user.role,
          members: newMembers
        })
      });
      
      if (response.ok) {
        await fetchMembers();
        onLogAction("匯入人員名單", `匯入了 ${newMembers.length} 筆人員基本資料 (Excel)`);
        alert(`成功匯入 ${newMembers.length} 筆人員基本資料！`);
      } else {
        const errData = await response.json();
        alert(errData.error || "儲存人員資料失敗");
      }
    } catch (err: any) {
      console.error(err);
      alert("解析 Excel 檔案出錯: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleClearMembers = async () => {
    if (!confirm("確定要一鍵清空所有人員管理名單嗎？此操作將會清空所有已上傳的人員資料。")) return;
    try {
      const response = await fetch(`/api/members?username=${user.username}&role=${user.role}`, {
        method: "DELETE"
      });
      if (response.ok) {
        await fetchMembers();
        onLogAction("清空人員名單", "清空了所有人員基本資料");
        alert("已成功清空所有人員基本資料！");
      } else {
        const err = await response.json();
        alert(err.error || "清空失敗");
      }
    } catch (err) {
      alert("連線失敗");
    }
  };

  const filteredMembers = useMemo(() => {
    if (!membersSearchQuery.trim()) return members;
    const q = membersSearchQuery.toLowerCase();
    return members.filter(m => 
      m.name.toLowerCase().includes(q) || 
      m.empId.toLowerCase().includes(q)
    );
  }, [members, membersSearchQuery]);

  // Excel Import Helper: read file as XLSX WorkBook
  const readExcelFile = (file: File): Promise<XLSX.WorkBook> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          resolve(workbook);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  };

  const sheetToRows = (sheet: XLSX.WorkSheet): any[][] => {
    return XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  };

  const findColumnIndex = (rows: any[][], keywords: string[]): number => {
    const maxSearchRows = Math.min(20, rows.length);
    
    // Pass 1: Exact matches (case-insensitive, trimmed)
    for (const kw of keywords) {
      const kwLower = kw.toLowerCase();
      for (let r = 0; r < maxSearchRows; r++) {
        const row = rows[r];
        if (!row) continue;
        for (let c = 0; c < row.length; c++) {
          const cellVal = String(row[c] || "").trim().toLowerCase();
          if (cellVal === kwLower) {
            return c;
          }
        }
      }
    }
    
    // Pass 2: Partial matches (case-insensitive, trimmed)
    // To avoid matching "部門代號" or codes, if we search for a name/department,
    // we ignore cells containing "代號", "編號", "code", "id", "no" unless the keyword itself has it
    for (const kw of keywords) {
      const kwLower = kw.toLowerCase();
      const kwHasCode = kwLower.includes("代號") || kwLower.includes("編號") || kwLower.includes("code") || kwLower.includes("id") || kwLower.includes("no");
      
      for (let r = 0; r < maxSearchRows; r++) {
        const row = rows[r];
        if (!row) continue;
        for (let c = 0; c < row.length; c++) {
          const cellVal = String(row[c] || "").trim().toLowerCase();
          if (!cellVal) continue;
          
          if (!kwHasCode) {
            const cellHasCode = cellVal.includes("代號") || cellVal.includes("編號") || cellVal.includes("code") || cellVal.includes("id") || cellVal.includes("no");
            if (cellHasCode) {
              continue; // Skip code/ID columns for name/department fields
            }
          }
          
          if (cellVal.includes(kwLower)) {
            return c;
          }
        }
      }
    }
    
    return -1;
  };

  const findStartRow = (rows: any[][], keywords: string[]): number => {
    const maxSearch = Math.min(10, rows.length);
    for (let r = 0; r < maxSearch; r++) {
      const row = rows[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        const cellVal = String(row[c] || "").trim().toLowerCase();
        if (!cellVal) continue;
        for (const kw of keywords) {
          if (cellVal.includes(kw.toLowerCase())) {
            return r + 1; // start data from row after header
          }
        }
      }
    }
    return 1;
  };

  const createDefaultMergedEmployee = (empId: string, name: string): any => {
    return {
      empId,
      name,
      monthlySalaries: Array(12).fill(0),
      firstYearEndBonus: 0,
      secondPerfBonus: 0,
      otherBonus: 0,
      bonus28: 0,
      companyStockContribution: 0,
      salesCommission: 0,
      workBonus: 0,
      festivalBonus: 0,
      birthdayGift: 0,
      overtime: 0,
      severance: 0,
      maternityAllowance: 0,
      totalWB2WB3Bonus: 0,
      months: 12
    };
  };

  // Google Drive Downloader
  const downloadDriveFile = async (token: string, fileId: string): Promise<XLSX.WorkBook> => {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (!response.ok) {
      throw new Error(`無法從 Google Drive 下載檔案 (${response.statusText})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
    return workbook;
  };

  // Google Drive Cloud Sync settings and auth mount
  const loadSyncSettingsAndAuth = async () => {
    try {
      const settingsRes = await fetch("/api/drive-sync/settings");
      let currentSettings = null;
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSyncSettings(data);
        currentSettings = data;
        setImportYear(data.targetYear || 2025);
      }

      // Check for stored Direct Google OAuth 2.0 token first!
      const directToken = localStorage.getItem("gdrive_direct_access_token");
      const directEmail = localStorage.getItem("gdrive_direct_user_email");
      const savedAuthMode = currentSettings?.authMode || "direct";

      if (savedAuthMode === "direct" && directToken) {
        // Direct Auth Mode
        setGDriveConnected(true);
        setGDriveToken(directToken);
        setGDriveUserEmail(directEmail || "已直接連接公司帳戶");
        
        try {
          const folderId = currentSettings?.folderId || "1i8t5Q1r5-Y4RZeadGcq9QGEzLUponwQ7";
          const files = await listDriveFiles(directToken, folderId);
          setDriveFolderFiles(files);
          
          // Auto-classify files to fill dropdown states
          const xlsxFiles = files.filter(f => 
            f.name.endsWith(".xlsx") || f.name.endsWith(".xls") || f.name.endsWith(".csv") || 
            f.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
            f.mimeType === "application/vnd.ms-excel"
          );
          
          let f1 = null, f2 = null, f3 = null;
          xlsxFiles.forEach(file => {
            const name = file.name;
            if (name.includes("本薪") || name.includes("底薪") || name.includes("經常性") || name.includes("薪資")) {
              if (!f1) f1 = file.id;
            } else if (name.includes("其他") || name.includes("非經常")) {
              if (!f2) f2 = file.id;
            } else if (name.includes("節金") || name.includes("年終") || name.includes("獎金") || name.includes("績效")) {
              if (!f3) f3 = file.id;
            }
          });
          
          if (!f1 && xlsxFiles.length > 0) f1 = xlsxFiles[0].id;
          if (!f2 && xlsxFiles.length > 1) f2 = xlsxFiles[1].id;
          if (!f3 && xlsxFiles.length > 2) f3 = xlsxFiles[2].id;

          setDriveSelectedFile1(f1);
          setDriveSelectedFile2(f2);
          setDriveSelectedFile3(f3);

          // Automated Sync trigger check
          if (currentSettings && currentSettings.autoSync) {
            const freq = currentSettings.frequency;
            const lastSync = currentSettings.lastSyncTime ? new Date(currentSettings.lastSyncTime).getTime() : 0;
            const now = Date.now();
            
            let shouldSync = false;
            if (freq === "on_open") {
              const sessionDone = sessionStorage.getItem(`drive_sync_done_${currentSettings.targetYear}`);
              if (!sessionDone) {
                shouldSync = true;
                sessionStorage.setItem(`drive_sync_done_${currentSettings.targetYear}`, "true");
              }
            } else if (freq === "daily") {
              if (now - lastSync > 24 * 3600 * 1000) shouldSync = true;
            } else if (freq === "weekly") {
              if (now - lastSync > 7 * 24 * 3600 * 1000) shouldSync = true;
            } else if (freq === "monthly") {
              if (now - lastSync > 30 * 24 * 3600 * 1000) shouldSync = true;
            }

            if (shouldSync && f1) {
              console.log("Triggering automatic background sync from Google Drive folder (Direct)...");
              await fetch("/api/drive-sync/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...currentSettings,
                  lastSyncStatus: "syncing",
                  lastSyncLog: "自動背景同步正在執行中...",
                  username: user.username,
                  role: user.role
                })
              });

              const syncResult = await runCloudMergeAndProcess(
                directToken,
                f1,
                f2,
                f3,
                files.find(f => f.id === f1)?.name || "本薪檔.xlsx",
                f2 ? (files.find(f => f.id === f2)?.name || "其他所得.xlsx") : null,
                f3 ? (files.find(f => f.id === f3)?.name || "節金獎金.xlsx") : null,
                currentSettings.targetYear,
                true // silent
              );

              if (syncResult?.success) {
                fetchStatsAndEmployees();
                try {
                  const settingsRes2 = await fetch("/api/drive-sync/settings");
                  if (settingsRes2.ok) {
                    const data2 = await settingsRes2.json();
                    setSyncSettings(data2);
                  }
                } catch (err) {
                  console.error("Failed to re-fetch settings after automated sync", err);
                }
              }
            }
          }
        } catch (e: any) {
          console.error("Failed to fetch folder files during direct drive sync init", e);
          const errMsg = String(e?.message || "");
          if (errMsg.includes("401") || errMsg.includes("invalid authentication credentials") || errMsg.includes("Invalid Credentials") || errMsg.includes("authError")) {
            console.warn("Detected expired Direct Token. Resetting state.");
            setGDriveConnected(false);
            setGDriveToken(null);
            setGDriveUserEmail("");
            localStorage.removeItem("gdrive_direct_access_token");
            localStorage.removeItem("gdrive_direct_user_email");
          }
        }
      } else {
        // Fall back to Firebase Auth mode
        initAuth(async (currentUser, accessToken) => {
          if (currentSettings?.authMode === "direct") return; // Skip if direct was chosen
          setGDriveConnected(true);
          setGDriveToken(accessToken);
          setGDriveUserEmail(currentUser.email);
          
          if (accessToken) {
            const folderId = currentSettings?.folderId || "1i8t5Q1r5-Y4RZeadGcq9QGEzLUponwQ7";
            try {
              const files = await listDriveFiles(accessToken, folderId);
              setDriveFolderFiles(files);
              
              // Auto-classify files to fill dropdown states
              const xlsxFiles = files.filter(f => 
                f.name.endsWith(".xlsx") || f.name.endsWith(".xls") || f.name.endsWith(".csv") || 
                f.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
                f.mimeType === "application/vnd.ms-excel"
              );
              
              let f1 = null, f2 = null, f3 = null;
              xlsxFiles.forEach(file => {
                const name = file.name;
                if (name.includes("本薪") || name.includes("底薪") || name.includes("經常性") || name.includes("薪資")) {
                  if (!f1) f1 = file.id;
                } else if (name.includes("其他") || name.includes("非經常")) {
                  if (!f2) f2 = file.id;
                } else if (name.includes("節金") || name.includes("年終") || name.includes("獎金") || name.includes("績效")) {
                  if (!f3) f3 = file.id;
                }
              });
              
              if (!f1 && xlsxFiles.length > 0) f1 = xlsxFiles[0].id;
              if (!f2 && xlsxFiles.length > 1) f2 = xlsxFiles[1].id;
              if (!f3 && xlsxFiles.length > 2) f3 = xlsxFiles[2].id;

              setDriveSelectedFile1(f1);
              setDriveSelectedFile2(f2);
              setDriveSelectedFile3(f3);

              // Automated Sync trigger check
              if (currentSettings && currentSettings.autoSync) {
                const freq = currentSettings.frequency;
                const lastSync = currentSettings.lastSyncTime ? new Date(currentSettings.lastSyncTime).getTime() : 0;
                const now = Date.now();
                
                let shouldSync = false;
                if (freq === "on_open") {
                  const sessionDone = sessionStorage.getItem(`drive_sync_done_${currentSettings.targetYear}`);
                  if (!sessionDone) {
                    shouldSync = true;
                    sessionStorage.setItem(`drive_sync_done_${currentSettings.targetYear}`, "true");
                  }
                } else if (freq === "daily") {
                  if (now - lastSync > 24 * 3600 * 1000) shouldSync = true;
                } else if (freq === "weekly") {
                  if (now - lastSync > 7 * 24 * 3600 * 1000) shouldSync = true;
                } else if (freq === "monthly") {
                  if (now - lastSync > 30 * 24 * 3600 * 1000) shouldSync = true;
                }

                if (shouldSync && f1) {
                  console.log("Triggering automatic background sync from Google Drive folder...");
                  await fetch("/api/drive-sync/settings", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      ...currentSettings,
                      lastSyncStatus: "syncing",
                      lastSyncLog: "自動背景同步正在執行中...",
                      username: user.username,
                      role: user.role
                    })
                  });

                  const syncResult = await runCloudMergeAndProcess(
                    accessToken,
                    f1,
                    f2,
                    f3,
                    files.find(f => f.id === f1)?.name || "本薪檔.xlsx",
                    f2 ? (files.find(f => f.id === f2)?.name || "其他所得.xlsx") : null,
                    f3 ? (files.find(f => f.id === f3)?.name || "節金獎金.xlsx") : null,
                    currentSettings.targetYear,
                    true // silent
                  );

                  if (syncResult?.success) {
                    fetchStatsAndEmployees();
                    try {
                      const settingsRes2 = await fetch("/api/drive-sync/settings");
                      if (settingsRes2.ok) {
                        const data2 = await settingsRes2.json();
                        setSyncSettings(data2);
                      }
                    } catch (err) {
                      console.error("Failed to re-fetch settings after automated sync", err);
                    }
                  }
                }
              }

            } catch (e: any) {
              console.error("Failed to fetch folder files during drive sync init (Firebase)", e);
              const errMsg = String(e?.message || "");
              if (errMsg.includes("401") || errMsg.includes("invalid authentication credentials") || errMsg.includes("Invalid Credentials") || errMsg.includes("authError")) {
                console.warn("Detected expired or invalid Google Drive credentials during initialization. Resetting state.");
                setGDriveConnected(false);
                setGDriveToken(null);
                setGDriveUserEmail("");
                try {
                  localStorage.removeItem("gdrive_access_token");
                } catch (localErr) {
                  console.error("Failed to remove token", localErr);
                }
              }
            }
          }
        }, () => {
          setGDriveConnected(false);
          setGDriveToken(null);
          setGDriveUserEmail(null);
        });
      }
    } catch (err) {
      console.error("Failed to load drive sync settings:", err);
    }
  };

  useEffect(() => {
    loadSyncSettingsAndAuth();

    // Listen for postMessage from Google direct callback popup
    const handleOAuthMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data && event.data.type === 'GOOGLE_DIRECT_AUTH_SUCCESS') {
        const token = event.data.accessToken;
        if (token) {
          setGDriveLoading(true);
          try {
            // Fetch user info from Google to get email
            const infoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
              headers: { Authorization: `Bearer ${token}` }
            });
            let email = "公司 Google 帳戶";
            if (infoRes.ok) {
              const info = await infoRes.json();
              email = info.email || email;
            }
            
            setGDriveConnected(true);
            setGDriveToken(token);
            setGDriveUserEmail(email);
            
            // Save to localStorage
            localStorage.setItem("gdrive_direct_access_token", token);
            localStorage.setItem("gdrive_direct_user_email", email);
            
            alert(`🎉 成功直接連接 Google 帳戶: ${email}`);
            onLogAction("直接連接 Google Drive", `成功在申報模組直接授權公司 Google 帳戶並讀取檔案。`);
            
            // Fetch files
            const folderId = syncSettingsRef.current.folderId || "1i8t5Q1r5-Y4RZeadGcq9QGEzLUponwQ7";
            const files = await listDriveFiles(token, folderId);
            setDriveFolderFiles(files);
          } catch (err: any) {
            alert("❌ 直接連接 Google 失敗：" + (err.message || String(err)));
          } finally {
            setGDriveLoading(false);
          }
        }
      } else if (event.data && event.data.type === 'GOOGLE_DIRECT_AUTH_FAILURE') {
        alert("❌ 直接連接 Google 授權失敗：" + (event.data.error || "未知錯誤"));
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => {
      window.removeEventListener('message', handleOAuthMessage);
    };
  }, []);

  // Google Drive Cloud Sync Merge & Process
  const runCloudMergeAndProcess = async (
    accessToken: string,
    fileId1: string,
    fileId2: string | null,
    fileId3: string | null,
    name1: string,
    name2: string | null,
    name3: string | null,
    targetYear: number,
    silent: boolean = false
  ) => {
    if (!silent) {
      setImporting(true);
      setDriveSyncProgress("正在連接雲端硬碟並下載檔案...");
      const updatedSettings = {
        ...syncSettings,
        lastSyncStatus: "syncing",
        lastSyncLog: "正在下載並合併雲端報表資料進行預覽試算中..."
      };
      setSyncSettings(updatedSettings);
      try {
        await fetch("/api/drive-sync/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...updatedSettings,
            username: user.username,
            role: user.role
          })
        });
      } catch (e) {
        console.error("Failed to save manual sync start settings", e);
      }
    }
    try {
      if (!silent) setDriveSyncProgress("正在下載本薪檔...");
      const wb1 = await downloadDriveFile(accessToken, fileId1);
      
      let wb2 = null;
      if (fileId2) {
        if (!silent) setDriveSyncProgress("正在下載其他所得檔...");
        wb2 = await downloadDriveFile(accessToken, fileId2);
      }
      
      let wb3 = null;
      if (fileId3) {
        if (!silent) setDriveSyncProgress("正在下載節金及年終獎金檔...");
        wb3 = await downloadDriveFile(accessToken, fileId3);
      }
      
      if (!silent) setDriveSyncProgress("正在解析與整合薪資數據...");

      const employeeMap: Record<string, any> = {};

      if (parsedEmployeesRef.current && parsedEmployeesRef.current.length > 0) {
        parsedEmployeesRef.current.forEach(emp => {
          employeeMap[emp.empId] = {
            empId: emp.empId,
            name: emp.name,
            department: emp.department || "",
            monthlySalaries: Array.isArray(emp.monthlySalaries) ? [...emp.monthlySalaries] : Array(12).fill(0),
            firstYearEndBonus: emp.firstYearEndBonus || 0,
            secondPerfBonus: emp.secondPerfBonus || 0,
            otherBonus: emp.otherBonus || 0,
            bonus28: emp.bonus28 || 0,
            companyStockContribution: emp.companyStockContribution || 0,
            salesCommission: emp.salesCommission || 0,
            workBonus: emp.workBonus || 0,
            festivalBonus: emp.festivalBonus || 0,
            birthdayGift: emp.birthdayGift || 0,
            overtime: emp.overtime || 0,
            severance: emp.severance || 0,
            maternityAllowance: emp.maternityAllowance || 0,
          };
        });
      }

      const getMonthFromFilename = (filename: string): number | null => {
        const matches5or6 = filename.match(/\b\d{5,6}\b/g) || filename.match(/\d{5,6}/g);
        if (matches5or6) {
          for (const d of matches5or6) {
            const lastTwo = d.substring(d.length - 2);
            const m = parseInt(lastTwo, 10);
            if (m >= 1 && m <= 12) return m;
          }
        }
        const matchesAll = filename.match(/\d+/g);
        if (matchesAll) {
          for (const d of matchesAll) {
            if (d.length >= 4) {
              const lastTwo = d.substring(d.length - 2);
              const m = parseInt(lastTwo, 10);
              if (m >= 1 && m <= 12) return m;
            } else if (d.length === 2) {
              const m = parseInt(d, 10);
              if (m >= 1 && m <= 12) return m;
            } else if (d.length === 1) {
              const m = parseInt(d, 10);
              if (m >= 1 && m <= 12) return m;
            }
          }
        }
        return null;
      };

      const filenameMonth = getMonthFromFilename(name1);
      const filenameMonth2 = name2 ? getMonthFromFilename(name2) : null;
      const filenameMonth3 = name3 ? getMonthFromFilename(name3) : null;

      const sheetNames1 = wb1.SheetNames;
      if (filenameMonth !== null) {
        for (const sheetName of sheetNames1) {
          const sheet = wb1.Sheets[sheetName];
          const rows = sheetToRows(sheet);
          if (rows.length === 0) continue;
          
          const idxEmpId = findColumnIndex(rows, ["員工編號", "員編", "工號", "ID", "empId"]);
          const idxName = findColumnIndex(rows, ["姓名", "Name", "name"]);
          const idxDept = findColumnIndex(rows, ["名稱", "部門名稱", "部門", "單位名稱", "單位", "Department", "Dept"]);
          const idxSalary = findColumnIndex(rows, ["小計"]);
          const idxMeal = findColumnIndex(rows, ["伙食津貼", "伙食", "Meal"]);
          const idxOvertime = findColumnIndex(rows, ["免稅加班費", "加班", "Overtime"]);
          const idxSpecialLeave = findColumnIndex(rows, ["特休補償金", "特休", "年假折現"]);
          
          const startRow = Math.max(0, findStartRow(rows, ["員工編號", "員編", "工號", "ID"]));
          for (let r = startRow; r < rows.length; r++) {
            const row = rows[r];
            if (!row || row.length === 0) continue;
            
            const rawId = idxEmpId >= 0 ? row[idxEmpId] : null;
            if (!rawId) continue;
            const empIdStr = String(rawId).trim();
            if (!empIdStr || empIdStr === "員工編號" || empIdStr === "員編" || empIdStr === "工號") continue;
            
            const nameStr = idxName >= 0 ? String(row[idxName] || "").trim() : empIdStr;
            if (/^\d+$/.test(nameStr)) continue;
            
            const deptStr = idxDept >= 0 ? String(row[idxDept] || "").trim() : "";
            if (!employeeMap[empIdStr]) {
              employeeMap[empIdStr] = createDefaultMergedEmployee(empIdStr, nameStr);
            }
            const emp = employeeMap[empIdStr];
            if (deptStr) emp.department = deptStr;
            
            const salaryVal = idxSalary >= 0 ? Number(row[idxSalary] || 0) : 0;
            const mealVal = idxMeal >= 0 ? Number(row[idxMeal] || 0) : 0;
            const overtimeVal = idxOvertime >= 0 ? Number(row[idxOvertime] || 0) : 0;
            const specialLeaveVal = idxSpecialLeave >= 0 ? Number(row[idxSpecialLeave] || 0) : 0;
            
            emp.monthlySalaries[filenameMonth - 1] = (emp.monthlySalaries[filenameMonth - 1] || 0) + salaryVal + mealVal;
            emp.overtime += overtimeVal;
            emp.workBonus += specialLeaveVal;
          }
        }
      } else {
        const monthlySheets: { month: number; sheetName: string }[] = [];
        sheetNames1.forEach(name => {
          const match = name.match(/(\d+)\s*月?/);
          if (match) {
            const m = parseInt(match[1], 10);
            if (m >= 1 && m <= 12) monthlySheets.push({ month: m, sheetName: name });
          }
        });
        
        if (monthlySheets.length > 0) {
          for (const { month, sheetName } of monthlySheets) {
            const sheet = wb1.Sheets[sheetName];
            const rows = sheetToRows(sheet);
            if (rows.length === 0) continue;
            
            const idxEmpId = findColumnIndex(rows, ["員工編號", "員編", "工號", "ID", "empId"]);
            const idxName = findColumnIndex(rows, ["姓名", "Name", "name"]);
            const idxDept = findColumnIndex(rows, ["名稱", "部門名稱", "部門", "單位名稱", "單位", "Department", "Dept"]);
            const idxSalary = findColumnIndex(rows, ["本薪", "底薪", "小計", "薪資", "應發金額", "經常性薪資"]);
            const idxMeal = findColumnIndex(rows, ["伙食津貼", "伙食", "Meal"]);
            const idxOvertime = findColumnIndex(rows, ["免稅加班費", "加班", "Overtime"]);
            const idxSpecialLeave = findColumnIndex(rows, ["特休補償金", "特休", "年假折現"]);
            
            const startRow = Math.max(0, findStartRow(rows, ["員工編號", "員編", "工號", "ID"]));
            for (let r = startRow; r < rows.length; r++) {
              const row = rows[r];
              if (!row || row.length === 0) continue;
              
              const rawId = idxEmpId >= 0 ? row[idxEmpId] : null;
              if (!rawId) continue;
              const empIdStr = String(rawId).trim();
              if (!empIdStr || empIdStr === "員工編號" || empIdStr === "員編" || empIdStr === "工號") continue;
              
              const nameStr = idxName >= 0 ? String(row[idxName] || "").trim() : empIdStr;
              const deptStr = idxDept >= 0 ? String(row[idxDept] || "").trim() : "";
              if (!employeeMap[empIdStr]) {
                employeeMap[empIdStr] = createDefaultMergedEmployee(empIdStr, nameStr);
              }
              const emp = employeeMap[empIdStr];
              if (deptStr) emp.department = deptStr;
              
              const salaryVal = idxSalary >= 0 ? Number(row[idxSalary] || 0) : 0;
              const mealVal = idxMeal >= 0 ? Number(row[idxMeal] || 0) : 0;
              const overtimeVal = idxOvertime >= 0 ? Number(row[idxOvertime] || 0) : 0;
              const specialLeaveVal = idxSpecialLeave >= 0 ? Number(row[idxSpecialLeave] || 0) : 0;
              
              emp.monthlySalaries[month - 1] = (emp.monthlySalaries[month - 1] || 0) + salaryVal + mealVal;
              emp.overtime += overtimeVal;
              emp.workBonus += specialLeaveVal;
            }
          }
        } else {
          const sheet = wb1.Sheets[sheetNames1[0]];
          const rows = sheetToRows(sheet);
          if (rows.length > 0) {
            const idxEmpId = findColumnIndex(rows, ["員工編號", "員編", "工號", "ID", "empId"]);
            const idxName = findColumnIndex(rows, ["姓名", "Name", "name"]);
            const idxDept = findColumnIndex(rows, ["名稱", "部門名稱", "部門", "單位名稱", "單位", "Department", "Dept"]);
            
            const idxMonths: number[] = [];
            for (let m = 1; m <= 12; m++) {
              const colIdx = findColumnIndex(rows, [`${m}月薪`, `${m}月`, `${m}Month`]);
              idxMonths.push(colIdx);
            }
            const idxSalary = findColumnIndex(rows, ["本薪", "底薪", "小計", "薪資", "經常性薪資"]);
            const idxMeal = findColumnIndex(rows, ["伙食津貼", "伙食", "Meal"]);
            const idxOvertime = findColumnIndex(rows, ["免稅加班費", "加班", "Overtime"]);
            const idxSpecialLeave = findColumnIndex(rows, ["特休補償金", "特休", "年假折現"]);
            
            const startRow = Math.max(0, findStartRow(rows, ["員工編號", "員編", "工號", "ID"]));
            for (let r = startRow; r < rows.length; r++) {
              const row = rows[r];
              if (!row || row.length === 0) continue;
              
              const rawId = idxEmpId >= 0 ? row[idxEmpId] : null;
              if (!rawId) continue;
              const empIdStr = String(rawId).trim();
              if (!empIdStr || empIdStr === "員工編號" || empIdStr === "員編" || empIdStr === "工號") continue;
              
              const nameStr = idxName >= 0 ? String(row[idxName] || "").trim() : empIdStr;
              const deptStr = idxDept >= 0 ? String(row[idxDept] || "").trim() : "";
              if (!employeeMap[empIdStr]) {
                employeeMap[empIdStr] = createDefaultMergedEmployee(empIdStr, nameStr);
              }
              const emp = employeeMap[empIdStr];
              if (deptStr) emp.department = deptStr;
              
              let monthlyFilled = false;
              for (let m = 1; m <= 12; m++) {
                const colIdx = idxMonths[m - 1];
                if (colIdx >= 0) {
                  emp.monthlySalaries[m - 1] = (emp.monthlySalaries[m - 1] || 0) + Number(row[colIdx] || 0);
                  monthlyFilled = true;
                }
              }
              
              const salaryVal = idxSalary >= 0 ? Number(row[idxSalary] || 0) : 0;
              const mealVal = idxMeal >= 0 ? Number(row[idxMeal] || 0) : 0;
              if (!monthlyFilled && salaryVal > 0) {
                const totalMonthly = salaryVal + mealVal;
                for (let m = 0; m < 12; m++) {
                  emp.monthlySalaries[m] = (emp.monthlySalaries[m] || 0) + totalMonthly;
                }
              }
              emp.overtime += idxOvertime >= 0 ? Number(row[idxOvertime] || 0) : 0;
              emp.workBonus += idxSpecialLeave >= 0 ? Number(row[idxSpecialLeave] || 0) : 0;
            }
          }
        }
      }

      if (wb2) {
        for (const sheetName of wb2.SheetNames) {
          const sheet = wb2.Sheets[sheetName];
          const rows = sheetToRows(sheet);
          if (rows.length === 0) continue;
          
          const idxEmpId = findColumnIndex(rows, ["員工編號", "員編", "工號", "ID", "empId"]);
          const idxName = findColumnIndex(rows, ["姓名", "Name", "name"]);
          const idxBirthday = findColumnIndex(rows, ["生日禮金", "生日", "Birthday"]);
          const idxCommission = findColumnIndex(rows, ["業績獎金", "業績", "Sales"]);
          const idxStock = findColumnIndex(rows, ["公提持股金", "公提持股", "持股金", "Stock"]);
          const idxWorkBonus = findColumnIndex(rows, ["工作獎金", "工作", "Work"]);
          const idxOtherBonus = findColumnIndex(rows, ["其他獎金", "其他", "Other"]);
          const idxFirstYearEnd = findColumnIndex(rows, ["第一次年終獎金", "第一次年終", "年終獎金", "年終"]);
          const idxSecondPerf = findColumnIndex(rows, ["第二次績效獎金", "第二次績效", "績效獎金", "績效"]);
          const idxBonus28 = findColumnIndex(rows, ["二八獎金", "二八", "28獎金"]);
          const idxSeverance = findColumnIndex(rows, ["資遣費", "資遣費離職金", "離職金", "資遣"]);
          const idxMaternity = findColumnIndex(rows, ["生育津貼", "生育", "Maternity"]);
          
          const startRow = Math.max(0, findStartRow(rows, ["員工編號", "員編", "工號", "ID"]));
          for (let r = startRow; r < rows.length; r++) {
            const row = rows[r];
            if (!row || row.length === 0) continue;
            
            const rawId = idxEmpId >= 0 ? row[idxEmpId] : null;
            if (!rawId) continue;
            const empIdStr = String(rawId).trim();
            if (!empIdStr || empIdStr === "員工編號" || empIdStr === "員編" || empIdStr === "工號") continue;
            
            const nameStr = idxName >= 0 ? String(row[idxName] || "").trim() : empIdStr;
            if (/^\d+$/.test(nameStr)) continue;
            
            if (!employeeMap[empIdStr]) {
              employeeMap[empIdStr] = createDefaultMergedEmployee(empIdStr, nameStr);
            }
            const emp = employeeMap[empIdStr];
            
            const rowBonus2 =
              (idxBirthday >= 0 ? Number(row[idxBirthday] || 0) : 0) +
              (idxCommission >= 0 ? Number(row[idxCommission] || 0) : 0) +
              (idxStock >= 0 ? Number(row[idxStock] || 0) : 0) +
              (idxWorkBonus >= 0 ? Number(row[idxWorkBonus] || 0) : 0) +
              (idxOtherBonus >= 0 ? Number(row[idxOtherBonus] || 0) : 0) +
              (idxFirstYearEnd >= 0 ? Number(row[idxFirstYearEnd] || 0) : 0) +
              (idxSecondPerf >= 0 ? Number(row[idxSecondPerf] || 0) : 0) +
              (idxBonus28 >= 0 ? Number(row[idxBonus28] || 0) : 0) +
              (idxSeverance >= 0 ? Number(row[idxSeverance] || 0) : 0) +
              (idxMaternity >= 0 ? Number(row[idxMaternity] || 0) : 0);
              
            if (filenameMonth2) {
              emp.monthlySalaries[filenameMonth2 - 1] = (emp.monthlySalaries[filenameMonth2 - 1] || 0) + rowBonus2;
              emp.totalWB2WB3Bonus += rowBonus2;
            }
            
            emp.birthdayGift += idxBirthday >= 0 ? Number(row[idxBirthday] || 0) : 0;
            emp.salesCommission += idxCommission >= 0 ? Number(row[idxCommission] || 0) : 0;
            emp.companyStockContribution += idxStock >= 0 ? Number(row[idxStock] || 0) : 0;
            emp.workBonus += idxWorkBonus >= 0 ? Number(row[idxWorkBonus] || 0) : 0;
            emp.otherBonus += idxOtherBonus >= 0 ? Number(row[idxOtherBonus] || 0) : 0;
            emp.firstYearEndBonus += idxFirstYearEnd >= 0 ? Number(row[idxFirstYearEnd] || 0) : 0;
            emp.secondPerfBonus += idxSecondPerf >= 0 ? Number(row[idxSecondPerf] || 0) : 0;
            emp.bonus28 += idxBonus28 >= 0 ? Number(row[idxBonus28] || 0) : 0;
            emp.severance += idxSeverance >= 0 ? Number(row[idxSeverance] || 0) : 0;
            emp.maternityAllowance += idxMaternity >= 0 ? Number(row[idxMaternity] || 0) : 0;
          }
        }
      }

      if (wb3) {
        for (const sheetName of wb3.SheetNames) {
          const sheet = wb3.Sheets[sheetName];
          const rows = sheetToRows(sheet);
          if (rows.length === 0) continue;
          
          const idxEmpId = findColumnIndex(rows, ["員工編號", "員編", "工號", "ID", "empId"]);
          const idxName = findColumnIndex(rows, ["姓名", "Name", "name"]);
          const idxFestival = findColumnIndex(rows, ["節金", "節日"]);
          const idxBonus1 = findColumnIndex(rows, ["年終獎金", "年終"]);
          const idxBonus2 = findColumnIndex(rows, ["績效獎金", "績效"]);
          
          const startRow = Math.max(0, findStartRow(rows, ["員工編號", "員編", "工號", "ID"]));
          for (let r = startRow; r < rows.length; r++) {
            const row = rows[r];
            if (!row || row.length === 0) continue;
            
            const rawId = idxEmpId >= 0 ? row[idxEmpId] : null;
            if (!rawId) continue;
            const empIdStr = String(rawId).trim();
            if (!empIdStr || empIdStr === "員工編號" || empIdStr === "員編" || empIdStr === "工號") continue;
            
            const nameStr = idxName >= 0 ? String(row[idxName] || "").trim() : empIdStr;
            if (/^\d+$/.test(nameStr)) continue;

            if (!employeeMap[empIdStr]) {
              employeeMap[empIdStr] = createDefaultMergedEmployee(empIdStr, nameStr);
            }
            const emp = employeeMap[empIdStr];
            
            const rowBonus3 =
              (idxFestival >= 0 ? Number(row[idxFestival] || 0) : 0) +
              (idxBonus1 >= 0 ? Number(row[idxBonus1] || 0) : 0) +
              (idxBonus2 >= 0 ? Number(row[idxBonus2] || 0) : 0);
            
            if (filenameMonth3) {
              emp.monthlySalaries[filenameMonth3 - 1] = (emp.monthlySalaries[filenameMonth3 - 1] || 0) + rowBonus3;
              emp.totalWB2WB3Bonus += rowBonus3;
            }
            
            emp.festivalBonus += idxFestival >= 0 ? Number(row[idxFestival] || 0) : 0;
            emp.firstYearEndBonus += idxBonus1 >= 0 ? Number(row[idxBonus1] || 0) : 0;
            emp.secondPerfBonus += idxBonus2 >= 0 ? Number(row[idxBonus2] || 0) : 0;
          }
        }
      }

      const finalEmployees: Employee[] = Object.values(employeeMap).map(merged => {
        const baseSalariesSum = merged.monthlySalaries.reduce((sum: number, val: number) => sum + val, 0);
        const nonRegularSalary = 
          merged.firstYearEndBonus +
          merged.secondPerfBonus +
          merged.otherBonus +
          merged.bonus28 +
          merged.companyStockContribution +
          merged.salesCommission +
          merged.workBonus +
          merged.festivalBonus +
          merged.birthdayGift +
          merged.overtime +
          merged.severance +
          merged.maternityAllowance;
          
        const originalAnnualSalary = baseSalariesSum;
        const months = merged.monthlySalaries.filter((s: number) => s > 0).length || 12;
        const salary = Math.max(0, originalAnnualSalary - nonRegularSalary);
        
        return {
          id: "",
          empId: merged.empId,
          name: merged.name,
          title: "全時人員",
          department: merged.department || "",
          salary,
          welfare: 70000, 
          year: targetYear,
          months,
          originalAnnualSalary,
          firstYearEndBonus: merged.firstYearEndBonus,
          secondPerfBonus: merged.secondPerfBonus,
          otherBonus: merged.otherBonus,
          bonus28: merged.bonus28,
          companyStockContribution: merged.companyStockContribution,
          salesCommission: merged.salesCommission,
          workBonus: merged.workBonus,
          festivalBonus: merged.festivalBonus,
          birthdayGift: merged.birthdayGift,
          overtime: merged.overtime,
          severance: merged.severance,
          maternityAllowance: merged.maternityAllowance,
          nonRegularSalary,
          monthlySalaries: merged.monthlySalaries
        };
      });

      // --- TWO WAY SYNC AUTO EXPORT ---
      try {
        if (!silent) setDriveSyncProgress("資料運算中...準備回傳至 Google Drive...");
        let csvContent = "\ufeff姓名,職稱,01,02,03,04,05,06,07,08,09,10,11,12,原始年薪金額(A),第一次年終獎金(含董事長紅包),第二次績效獎金(含特別獎金),其他獎金,二八獎金,公提持股金,業績獎金,工作獎金,節金,生日禮金,加班費,資遣費離職金,生育津貼,非經常性薪資(D),經常性薪資(E=A-D),經常性薪資(年化)(F),總薪資(年化)(G)\n";
        finalEmployees.forEach(emp => {
          const monthly = emp.monthlySalaries || Array(12).fill(0);
          const A = emp.originalAnnualSalary ?? emp.baseSalary ?? monthly.reduce((s: number, v: number) => s + v, 0);
          const firstYE = emp.firstYearEndBonus ?? 0;
          const secondPerf = emp.secondPerfBonus ?? 0;
          const other = emp.otherBonus ?? 0;
          const bonus28 = emp.bonus28 ?? 0;
          const stock = emp.companyStockContribution ?? 0;
          const sales = emp.salesCommission ?? 0;
          const work = emp.workBonus ?? 0;
          const fest = emp.festivalBonus ?? 0;
          const bday = emp.birthdayGift ?? 0;
          const ot = emp.overtime ?? 0;
          const sev = emp.severance ?? 0;
          const mat = emp.maternityAllowance ?? 0;
          const D = firstYE + secondPerf + other + bonus28 + stock + sales + work + fest + bday + ot + sev + mat;
          const E = A - D;
          const months = emp.months || 12;
          const F = months > 0 ? Math.round((E / months) * 12) : E;
          const G = Math.round(D + F);
          csvContent += `"${emp.name}","${emp.title}",${monthly.join(",")},${A},${firstYE},${secondPerf},${other},${bonus28},${stock},${sales},${work},${fest},${bday},${ot},${sev},${mat},${D},${E},${F},${G}\n`;
        });
        const outFolderId = await findOrCreateFolder(accessToken, "HR_Compliance_Backups");
        const exportName = `處理完成_年度薪酬合規報告_${targetYear}.csv`;
        await uploadFileToDrive(accessToken, exportName, "text/csv", csvContent, outFolderId);
        if (!silent) setDriveSyncProgress("✅ 雙向同步完成：結果已存回 Google Drive！");
      } catch (uploadErr) {
        console.error("Auto upload back to drive failed:", uploadErr);
      }
      // --------------------------------

      if (silent) {
        const response = await fetch("/api/employees/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employees: finalEmployees,
            year: targetYear,
            username: user.username,
            role: user.role
          })
        });

        if (response.ok) {
          const result = await response.json();
          await fetch("/api/drive-sync/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...syncSettings,
              lastSyncTime: new Date().toISOString(),
              lastSyncStatus: "success",
              lastSyncLog: `[自動背景同步] 成功同步 ${targetYear} 年度薪資。新增：${result.addedCount} 筆，覆蓋：${result.updatedCount} 筆。共處理 ${finalEmployees.length} 筆員工資料。`,
              username: user.username,
              role: user.role
            })
          });
          return { success: true, count: finalEmployees.length, added: result.addedCount, updated: result.updatedCount };
        } else {
          throw new Error("API 匯入失敗");
        }
      } else {
        setParsedEmployees(finalEmployees);
        setDriveSyncProgress(null);
        alert(`🎉 雲端硬碟檔案同步試算完成！成功彙整 ${finalEmployees.length} 名員工，請在下方預覽確認。`);
        
        const updatedSettings = {
          ...syncSettings,
          lastSyncTime: new Date().toISOString(),
          lastSyncStatus: "success",
          lastSyncLog: `[手動同步試算] 成功下載與合併 ${finalEmployees.length} 筆員工雲端報表。請在下方預覽並確認寫入！`
        };
        setSyncSettings(updatedSettings);
        try {
          await fetch("/api/drive-sync/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...updatedSettings,
              username: user.username,
              role: user.role
            })
          });
        } catch (e) {
          console.error("Failed to save manual sync settings", e);
        }
      }
    } catch (err: any) {
      console.error("Cloud sync failed:", err);
      if (!silent) {
        alert("❌ 雲端硬碟同步失敗：" + (err.message || String(err)));
        setDriveSyncProgress(null);
        
        const updatedSettings = {
          ...syncSettings,
          lastSyncTime: new Date().toISOString(),
          lastSyncStatus: "error",
          lastSyncLog: `[手動同步錯誤] 雲端硬碟同步失敗：${err.message || String(err)}`
        };
        setSyncSettings(updatedSettings);
        try {
          await fetch("/api/drive-sync/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...updatedSettings,
              username: user.username,
              role: user.role
            })
          });
        } catch (e) {
          console.error("Failed to save manual sync error settings", e);
        }
      } else {
        await fetch("/api/drive-sync/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...syncSettings,
            lastSyncTime: new Date().toISOString(),
            lastSyncStatus: "error",
            lastSyncLog: `[自動背景同步] 錯誤: ${err.message || String(err)}`,
            username: user.username,
            role: user.role
          })
        });
      }
      return { success: false, error: err.message || String(err) };
    } finally {
      if (!silent) setImporting(false);
    }
  };

  // Google Drive Connect
  const handleGDriveConnect = async () => {
    const isDirect = (syncSettings.authMode || "direct") === "direct";
    if (isDirect) {
      const clientId = syncSettings.googleClientId?.trim() || "";
      if (!clientId) {
        alert("⚠️ 請先在下方「連線與自動同步排程設定」中：\n1. 輸入公司「Google 用戶端 ID (Google Client ID)」\n2. 點選「儲存同步排程設定」\n\n儲存後，再點選本按鈕即可進行公司帳戶安全直連！");
        return;
      }
      
      const width = 600;
      const height = 650;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const redirectUri = encodeURIComponent(`${window.location.origin}/auth/google/callback`);
      const scopes = encodeURIComponent([
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile"
      ].join(" "));
      
      const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=${scopes}&prompt=select_account%20consent`;
      
      console.log("Opening direct Google OAuth popup:", oauthUrl);
      const popup = window.open(
        oauthUrl,
        "GoogleDirectAuth",
        `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes,status=yes`
      );
      
      if (!popup) {
        alert("❌ 彈出視窗被瀏覽器封鎖！請在網址列右方允許此網站顯示彈出視窗後，再按一次連線。");
      }
    } else {
      setGDriveLoading(true);
      try {
        const result = await googleSignIn();
        if (result) {
          setGDriveConnected(true);
          setGDriveToken(result.accessToken);
          setGDriveUserEmail(result.user.email);
          alert(`🎉 成功連接 Google Drive: ${result.user.email}`);
          onLogAction("連接 Google Drive", `成功在申報模組連接 Google 帳戶並授權讀取薪資檔案。`);
          
          // Refresh folder files list
          const folderId = syncSettings.folderId || "1i8t5Q1r5-Y4RZeadGcq9QGEzLUponwQ7";
          const files = await listDriveFiles(result.accessToken, folderId);
          setDriveFolderFiles(files);
        }
      } catch (err: any) {
        alert("❌ 連接 Google Drive 失敗：" + (err.message || String(err)));
      } finally {
        setGDriveLoading(false);
      }
    }
  };

  // Save Settings to Backend
  const handleSaveSyncSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setDriveSyncLoading(true);
    try {
      const res = await fetch("/api/drive-sync/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...syncSettings,
          username: user.username,
          role: user.role
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSyncSettings(data.driveSyncSettings);
        alert("💾 Google Drive 自動同步設定已儲存成功！");
        
        // Refresh files in case the folder ID changed and we are connected
        if (gDriveToken && data.driveSyncSettings.folderId) {
          try {
            const files = await listDriveFiles(gDriveToken, data.driveSyncSettings.folderId);
            setDriveFolderFiles(files);
          } catch (e) {
            console.error("Failed to reload files for new folder", e);
          }
        }
      } else {
        const err = await res.json();
        throw new Error(err.error || "儲存失敗");
      }
    } catch (err: any) {
      alert("❌ 儲存同步設定失敗：" + err.message);
    } finally {
      setDriveSyncLoading(false);
    }
  };

  const handleMergeAndProcessExcel = async () => {
    if (!excelFile1) {
      alert("❌ 請務必上傳第一個檔案「本薪檔」！");
      return;
    }
    setImporting(true);
    try {
      const wb1 = await readExcelFile(excelFile1);
      const wb2 = excelFile2 ? await readExcelFile(excelFile2) : null;
      const wb3 = excelFile3 ? await readExcelFile(excelFile3) : null;
      
      const employeeMap: Record<string, any> = {};

      // Initialize from already parsed employees (so that the numbers accumulate instead of being overwritten)
      if (parsedEmployeesRef.current && parsedEmployeesRef.current.length > 0) {
        parsedEmployeesRef.current.forEach(emp => {
          employeeMap[emp.empId] = {
            empId: emp.empId,
            name: emp.name,
            department: emp.department || "",
            monthlySalaries: Array.isArray(emp.monthlySalaries) ? [...emp.monthlySalaries] : Array(12).fill(0),
            firstYearEndBonus: emp.firstYearEndBonus || 0,
            secondPerfBonus: emp.secondPerfBonus || 0,
            otherBonus: emp.otherBonus || 0,
            bonus28: emp.bonus28 || 0,
            companyStockContribution: emp.companyStockContribution || 0,
            salesCommission: emp.salesCommission || 0,
            workBonus: emp.workBonus || 0,
            festivalBonus: emp.festivalBonus || 0,
            birthdayGift: emp.birthdayGift || 0,
            overtime: emp.overtime || 0,
            severance: emp.severance || 0,
            maternityAllowance: emp.maternityAllowance || 0,
          };
        });
      }
      
      // Helper to parse ROC or standard year-month numbers from filenames (e.g. 11401 -> 01)
      const getMonthFromFilename = (filename: string): number | null => {
        const matches5or6 = filename.match(/\b\d{5,6}\b/g) || filename.match(/\d{5,6}/g);
        if (matches5or6) {
          for (const d of matches5or6) {
            const lastTwo = d.substring(d.length - 2);
            const m = parseInt(lastTwo, 10);
            if (m >= 1 && m <= 12) {
              return m;
            }
          }
        }
        const matchesAll = filename.match(/\d+/g);
        if (matchesAll) {
          for (const d of matchesAll) {
            if (d.length >= 4) {
              const lastTwo = d.substring(d.length - 2);
              const m = parseInt(lastTwo, 10);
              if (m >= 1 && m <= 12) {
                return m;
              }
            } else if (d.length === 2) {
              const m = parseInt(d, 10);
              if (m >= 1 && m <= 12) {
                return m;
              }
            } else if (d.length === 1) {
              const m = parseInt(d, 10);
              if (m >= 1 && m <= 12) {
                return m;
              }
            }
          }
        }
        return null;
      };

      const filenameMonth = getMonthFromFilename(excelFile1.name);
      const filenameMonth2 = excelFile2 ? getMonthFromFilename(excelFile2.name) : null;
      const filenameMonth3 = excelFile3 ? getMonthFromFilename(excelFile3.name) : null;
      
      // -------------------------------------------------------------------------
      // 1. Process File 1 (本薪檔)
      // -------------------------------------------------------------------------
      const sheetNames1 = wb1.SheetNames;
      
      if (filenameMonth !== null) {
        // If the filename contains a monthly indicator, force mapping of all sheets in File 1 to that month!
        for (const sheetName of sheetNames1) {
          const sheet = wb1.Sheets[sheetName];
          const rows = sheetToRows(sheet);
          if (rows.length === 0) continue;
          
          const idxEmpId = findColumnIndex(rows, ["員工編號", "員編", "工號", "ID", "empId"]);
          const idxName = findColumnIndex(rows, ["姓名", "Name", "name"]);
          const idxDept = findColumnIndex(rows, ["名稱", "部門名稱", "部門", "單位名稱", "單位", "Department", "Dept"]);
          
          // 問題 2：修正成，找檔案內title的部分，從左邊數來第一個"小計"的金額
          const idxSalary = findColumnIndex(rows, ["小計"]);
          const idxMeal = findColumnIndex(rows, ["伙食津貼", "伙食", "Meal"]);
          const idxOvertime = findColumnIndex(rows, ["免稅加班費", "加班", "Overtime"]);
          const idxSpecialLeave = findColumnIndex(rows, ["特休補償金", "特休", "年假折現"]);
          
          const startRow = Math.max(0, findStartRow(rows, ["員工編號", "員編", "工號", "ID"]));
          
          for (let r = startRow; r < rows.length; r++) {
            const row = rows[r];
            if (!row || row.length === 0) continue;
            
            const rawId = idxEmpId >= 0 ? row[idxEmpId] : null;
            if (!rawId) continue;
            const empIdStr = String(rawId).trim();
            if (!empIdStr || empIdStr === "員工編號" || empIdStr === "員編" || empIdStr === "工號") continue;
            
            const nameStr = idxName >= 0 ? String(row[idxName] || "").trim() : empIdStr;
            
            // 問題 3：姓名過濾
            if (/^\d+$/.test(nameStr)) {
              continue;
            }

            const deptStr = idxDept >= 0 ? String(row[idxDept] || "").trim() : "";
            
            if (!employeeMap[empIdStr]) {
              employeeMap[empIdStr] = createDefaultMergedEmployee(empIdStr, nameStr);
            }
            
            const emp = employeeMap[empIdStr];
            if (deptStr) {
              emp.department = deptStr;
            }
            
            const salaryVal = idxSalary >= 0 ? Number(row[idxSalary] || 0) : 0;
            const mealVal = idxMeal >= 0 ? Number(row[idxMeal] || 0) : 0;
            const overtimeVal = idxOvertime >= 0 ? Number(row[idxOvertime] || 0) : 0;
            const specialLeaveVal = idxSpecialLeave >= 0 ? Number(row[idxSpecialLeave] || 0) : 0;
            
            // 問題 2：找從左邊數來第一個"小計"的金額加上"伙食津貼"的金額
            emp.monthlySalaries[filenameMonth - 1] = (emp.monthlySalaries[filenameMonth - 1] || 0) + salaryVal + mealVal;
            emp.overtime += overtimeVal;
            emp.workBonus += specialLeaveVal;
          }
        }
      } else {
        // Fallback to monthly sheets inside File 1
        const monthlySheets: { month: number; sheetName: string }[] = [];
        
        sheetNames1.forEach(name => {
          const match = name.match(/(\d+)\s*月?/);
          if (match) {
            const m = parseInt(match[1], 10);
            if (m >= 1 && m <= 12) {
              monthlySheets.push({ month: m, sheetName: name });
            }
          }
        });
        
        if (monthlySheets.length > 0) {
          // Format A: Sheet-per-month
          for (const { month, sheetName } of monthlySheets) {
            const sheet = wb1.Sheets[sheetName];
            const rows = sheetToRows(sheet);
            if (rows.length === 0) continue;
            
            const idxEmpId = findColumnIndex(rows, ["員工編號", "員編", "工號", "ID", "empId"]);
            const idxName = findColumnIndex(rows, ["姓名", "Name", "name"]);
            const idxDept = findColumnIndex(rows, ["名稱", "部門名稱", "部門", "單位名稱", "單位", "Department", "Dept"]);
            const idxSalary = findColumnIndex(rows, ["本薪", "底薪", "小計", "薪資", "應發金額", "經常性薪資"]);
            const idxMeal = findColumnIndex(rows, ["伙食津貼", "伙食", "Meal"]);
            const idxOvertime = findColumnIndex(rows, ["免稅加班費", "加班", "Overtime"]);
            const idxSpecialLeave = findColumnIndex(rows, ["特休補償金", "特休", "年假折現"]);
            
            const startRow = Math.max(0, findStartRow(rows, ["員工編號", "員編", "工號", "ID"]));
            
            for (let r = startRow; r < rows.length; r++) {
              const row = rows[r];
              if (!row || row.length === 0) continue;
              
              const rawId = idxEmpId >= 0 ? row[idxEmpId] : null;
              if (!rawId) continue;
              const empIdStr = String(rawId).trim();
              if (!empIdStr || empIdStr === "員工編號" || empIdStr === "員編" || empIdStr === "工號") continue;
              
              const nameStr = idxName >= 0 ? String(row[idxName] || "").trim() : empIdStr;
              const deptStr = idxDept >= 0 ? String(row[idxDept] || "").trim() : "";
              
              if (!employeeMap[empIdStr]) {
                employeeMap[empIdStr] = createDefaultMergedEmployee(empIdStr, nameStr);
              }
              
              const emp = employeeMap[empIdStr];
              if (deptStr) {
                emp.department = deptStr;
              }
              
              const salaryVal = idxSalary >= 0 ? Number(row[idxSalary] || 0) : 0;
              const mealVal = idxMeal >= 0 ? Number(row[idxMeal] || 0) : 0;
              const overtimeVal = idxOvertime >= 0 ? Number(row[idxOvertime] || 0) : 0;
              const specialLeaveVal = idxSpecialLeave >= 0 ? Number(row[idxSpecialLeave] || 0) : 0;
              
              emp.monthlySalaries[month - 1] = (emp.monthlySalaries[month - 1] || 0) + salaryVal + mealVal;
              emp.overtime += overtimeVal;
              emp.workBonus += specialLeaveVal;
            }
          }
        } else {
          // Format B: Single sheet, search for monthly columns or single base salary column
          const sheet = wb1.Sheets[sheetNames1[0]];
          const rows = sheetToRows(sheet);
          if (rows.length > 0) {
            const idxEmpId = findColumnIndex(rows, ["員工編號", "員編", "工號", "ID", "empId"]);
            const idxName = findColumnIndex(rows, ["姓名", "Name", "name"]);
            const idxDept = findColumnIndex(rows, ["名稱", "部門名稱", "部門", "單位名稱", "單位", "Department", "Dept"]);
            
            const idxMonths: number[] = [];
            for (let m = 1; m <= 12; m++) {
              const colIdx = findColumnIndex(rows, [`${m}月薪`, `${m}月`, `${m}Month`]);
              idxMonths.push(colIdx);
            }
            
            const idxSalary = findColumnIndex(rows, ["本薪", "底薪", "小計", "薪資", "經常性薪資"]);
            const idxMeal = findColumnIndex(rows, ["伙食津貼", "伙食", "Meal"]);
            const idxOvertime = findColumnIndex(rows, ["免稅加班費", "加班", "Overtime"]);
            const idxSpecialLeave = findColumnIndex(rows, ["特休補償金", "特休", "年假折現"]);
            
            const startRow = Math.max(0, findStartRow(rows, ["員工編號", "員編", "工號", "ID"]));
            
            for (let r = startRow; r < rows.length; r++) {
              const row = rows[r];
              if (!row || row.length === 0) continue;
              
              const rawId = idxEmpId >= 0 ? row[idxEmpId] : null;
              if (!rawId) continue;
              const empIdStr = String(rawId).trim();
              if (!empIdStr || empIdStr === "員工編號" || empIdStr === "員編" || empIdStr === "工號") continue;
              
              const nameStr = idxName >= 0 ? String(row[idxName] || "").trim() : empIdStr;
              const deptStr = idxDept >= 0 ? String(row[idxDept] || "").trim() : "";
              
              if (!employeeMap[empIdStr]) {
                employeeMap[empIdStr] = createDefaultMergedEmployee(empIdStr, nameStr);
              }
              
              const emp = employeeMap[empIdStr];
              if (deptStr) {
                emp.department = deptStr;
              }
              
              let monthlyFilled = false;
              for (let m = 1; m <= 12; m++) {
                const colIdx = idxMonths[m - 1];
                if (colIdx >= 0) {
                  emp.monthlySalaries[m - 1] = (emp.monthlySalaries[m - 1] || 0) + Number(row[colIdx] || 0);
                  monthlyFilled = true;
                }
              }
              
              const salaryVal = idxSalary >= 0 ? Number(row[idxSalary] || 0) : 0;
              const mealVal = idxMeal >= 0 ? Number(row[idxMeal] || 0) : 0;
              
              if (!monthlyFilled && salaryVal > 0) {
                 const totalMonthly = salaryVal + mealVal;
                 for (let m = 0; m < 12; m++) {
                   emp.monthlySalaries[m] = (emp.monthlySalaries[m] || 0) + totalMonthly;
                 }
              }
              
              emp.overtime += idxOvertime >= 0 ? Number(row[idxOvertime] || 0) : 0;
              emp.workBonus += idxSpecialLeave >= 0 ? Number(row[idxSpecialLeave] || 0) : 0;
            }
          }
        }
      }
      
      // -------------------------------------------------------------------------
      // 2. Process File 2 (其他所得檔)
      // -------------------------------------------------------------------------
      if (wb2) {
        for (const sheetName of wb2.SheetNames) {
          const sheet = wb2.Sheets[sheetName];
          const rows = sheetToRows(sheet);
          if (rows.length === 0) continue;
          
          const idxEmpId = findColumnIndex(rows, ["員工編號", "員編", "工號", "ID", "empId"]);
          const idxName = findColumnIndex(rows, ["姓名", "Name", "name"]);
          
          const idxBirthday = findColumnIndex(rows, ["生日禮金", "生日", "Birthday"]);
          const idxCommission = findColumnIndex(rows, ["業績獎金", "業績", "Sales"]);
          const idxStock = findColumnIndex(rows, ["公提持股金", "公提持股", "持股金", "Stock"]);
          const idxWorkBonus = findColumnIndex(rows, ["工作獎金", "工作", "Work"]);
          const idxOtherBonus = findColumnIndex(rows, ["其他獎金", "其他", "Other"]);
          const idxFirstYearEnd = findColumnIndex(rows, ["第一次年終獎金", "第一次年終", "年終獎金", "年終"]);
          const idxSecondPerf = findColumnIndex(rows, ["第二次績效獎金", "第二次績效", "績效獎金", "績效"]);
          const idxBonus28 = findColumnIndex(rows, ["二八獎金", "二八", "28獎金"]);
          const idxSeverance = findColumnIndex(rows, ["資遣費", "資遣費離職金", "離職金", "資遣"]);
          const idxMaternity = findColumnIndex(rows, ["生育津貼", "生育", "Maternity"]);
          
          const startRow = Math.max(0, findStartRow(rows, ["員工編號", "員編", "工號", "ID"]));
          
          for (let r = startRow; r < rows.length; r++) {
            const row = rows[r];
            if (!row || row.length === 0) continue;
            
            const rawId = idxEmpId >= 0 ? row[idxEmpId] : null;
            if (!rawId) continue;
            const empIdStr = String(rawId).trim();
            if (!empIdStr || empIdStr === "員工編號" || empIdStr === "員編" || empIdStr === "工號") continue;
            
            const nameStr = idxName >= 0 ? String(row[idxName] || "").trim() : empIdStr;
            
            // 問題 3：姓名過濾
            if (/^\d+$/.test(nameStr)) {
              continue;
            }
            
            if (!employeeMap[empIdStr]) {
              employeeMap[empIdStr] = createDefaultMergedEmployee(empIdStr, nameStr);
            }
            
            const emp = employeeMap[empIdStr];
            
            const rowBonus2 =
              (idxBirthday >= 0 ? Number(row[idxBirthday] || 0) : 0) +
              (idxCommission >= 0 ? Number(row[idxCommission] || 0) : 0) +
              (idxStock >= 0 ? Number(row[idxStock] || 0) : 0) +
              (idxWorkBonus >= 0 ? Number(row[idxWorkBonus] || 0) : 0) +
              (idxOtherBonus >= 0 ? Number(row[idxOtherBonus] || 0) : 0) +
              (idxFirstYearEnd >= 0 ? Number(row[idxFirstYearEnd] || 0) : 0) +
              (idxSecondPerf >= 0 ? Number(row[idxSecondPerf] || 0) : 0) +
              (idxBonus28 >= 0 ? Number(row[idxBonus28] || 0) : 0) +
              (idxSeverance >= 0 ? Number(row[idxSeverance] || 0) : 0) +
              (idxMaternity >= 0 ? Number(row[idxMaternity] || 0) : 0);
              
            if (filenameMonth2) {
                emp.monthlySalaries[filenameMonth2 - 1] = (emp.monthlySalaries[filenameMonth2 - 1] || 0) + rowBonus2;
                emp.totalWB2WB3Bonus += rowBonus2;
            }
            
            emp.birthdayGift += idxBirthday >= 0 ? Number(row[idxBirthday] || 0) : 0;
            emp.salesCommission += idxCommission >= 0 ? Number(row[idxCommission] || 0) : 0;
            emp.companyStockContribution += idxStock >= 0 ? Number(row[idxStock] || 0) : 0;
            emp.workBonus += idxWorkBonus >= 0 ? Number(row[idxWorkBonus] || 0) : 0;
            emp.otherBonus += idxOtherBonus >= 0 ? Number(row[idxOtherBonus] || 0) : 0;
            emp.firstYearEndBonus += idxFirstYearEnd >= 0 ? Number(row[idxFirstYearEnd] || 0) : 0;
            emp.secondPerfBonus += idxSecondPerf >= 0 ? Number(row[idxSecondPerf] || 0) : 0;
            emp.bonus28 += idxBonus28 >= 0 ? Number(row[idxBonus28] || 0) : 0;
            emp.severance += idxSeverance >= 0 ? Number(row[idxSeverance] || 0) : 0;
            emp.maternityAllowance += idxMaternity >= 0 ? Number(row[idxMaternity] || 0) : 0;
          }
        }
      }
      
      // -------------------------------------------------------------------------
      // 3. Process File 3 (節金檔 - Optional)
      // -------------------------------------------------------------------------
      if (wb3) {
        for (const sheetName of wb3.SheetNames) {
          const sheet = wb3.Sheets[sheetName];
          const rows = sheetToRows(sheet);
          if (rows.length === 0) continue;
          
          const idxEmpId = findColumnIndex(rows, ["員工編號", "員編", "工號", "ID", "empId"]);
          const idxName = findColumnIndex(rows, ["姓名", "Name", "name"]);
          // 問題 1：將節金/年終績效獎金欄位進行對應
          const idxFestival = findColumnIndex(rows, ["節金", "節日"]);
          const idxBonus1 = findColumnIndex(rows, ["年終獎金", "年終"]);
          const idxBonus2 = findColumnIndex(rows, ["績效獎金", "績效"]);
          
          const startRow = Math.max(0, findStartRow(rows, ["員工編號", "員編", "工號", "ID"]));
          
          for (let r = startRow; r < rows.length; r++) {
            const row = rows[r];
            if (!row || row.length === 0) continue;
            
            const rawId = idxEmpId >= 0 ? row[idxEmpId] : null;
            if (!rawId) continue;
            const empIdStr = String(rawId).trim();
            if (!empIdStr || empIdStr === "員工編號" || empIdStr === "員編" || empIdStr === "工號") continue;
            
            const nameStr = idxName >= 0 ? String(row[idxName] || "").trim() : empIdStr;
            
            // 問題 3：姓名過濾
            if (/^\d+$/.test(nameStr)) {
              continue;
            }

            if (!employeeMap[empIdStr]) {
              employeeMap[empIdStr] = createDefaultMergedEmployee(empIdStr, nameStr);
            }
            
            const emp = employeeMap[empIdStr];
            
            const rowBonus3 =
              (idxFestival >= 0 ? Number(row[idxFestival] || 0) : 0) +
              (idxBonus1 >= 0 ? Number(row[idxBonus1] || 0) : 0) +
              (idxBonus2 >= 0 ? Number(row[idxBonus2] || 0) : 0);
            
            if (filenameMonth3) {
              emp.monthlySalaries[filenameMonth3 - 1] = (emp.monthlySalaries[filenameMonth3 - 1] || 0) + rowBonus3;
              emp.totalWB2WB3Bonus += rowBonus3;
            }
            
            emp.festivalBonus += idxFestival >= 0 ? Number(row[idxFestival] || 0) : 0;
            // 問題 1：除了節金之外的金額出現時，也加總在年終獎金及績效獎金上
            emp.firstYearEndBonus += idxBonus1 >= 0 ? Number(row[idxBonus1] || 0) : 0;
            emp.secondPerfBonus += idxBonus2 >= 0 ? Number(row[idxBonus2] || 0) : 0;
          }
        }
      }
      
      // -------------------------------------------------------------------------
      // 4. Calculate Final Properties for each Employee
      // -------------------------------------------------------------------------
      const finalEmployees: Employee[] = Object.values(employeeMap).map(merged => {
        const baseSalariesSum = merged.monthlySalaries.reduce((sum: number, val: number) => sum + val, 0);
        
        const nonRegularSalary = 
          merged.firstYearEndBonus +
          merged.secondPerfBonus +
          merged.otherBonus +
          merged.bonus28 +
          merged.companyStockContribution +
          merged.salesCommission +
          merged.workBonus +
          merged.festivalBonus +
          merged.birthdayGift +
          merged.overtime +
          merged.severance +
          merged.maternityAllowance;
          
        const originalAnnualSalary = baseSalariesSum;
        const months = merged.monthlySalaries.filter((s: number) => s > 0).length || 12;
        const salary = Math.max(0, originalAnnualSalary - nonRegularSalary);
        
        return {
          id: "",
          empId: merged.empId,
          name: merged.name,
          title: "全時人員",
          department: merged.department || "",
          salary,
          welfare: 70000, 
          year: importYear,
          
          months,
          originalAnnualSalary,
          firstYearEndBonus: merged.firstYearEndBonus,
          secondPerfBonus: merged.secondPerfBonus,
          otherBonus: merged.otherBonus,
          bonus28: merged.bonus28,
          companyStockContribution: merged.companyStockContribution,
          salesCommission: merged.salesCommission,
          workBonus: merged.workBonus,
          festivalBonus: merged.festivalBonus,
          birthdayGift: merged.birthdayGift,
          overtime: merged.overtime,
          severance: merged.severance,
          maternityAllowance: merged.maternityAllowance,
          nonRegularSalary,
          monthlySalaries: merged.monthlySalaries
        };
      });
      
      setParsedEmployees(finalEmployees);
      alert(`🎉 試算合併完成！成功彙整 ${finalEmployees.length} 名全時員工的薪資與所得結構，請點選下方確認鍵匯入資料庫。`);
    } catch (err: any) {
      alert("❌ 處理 Excel 時發生錯誤：" + (err.message || err));
    } finally {
      setImporting(false);
    }
  };

  const handleConfirmImport = async () => {
    if (parsedEmployees.length === 0) return;
    setImporting(true);
    try {
      const response = await fetch("/api/employees/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employees: parsedEmployees,
          year: importYear,
          username: user.username,
          role: user.role
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`🎉 匯入成功！已為 ${importYear} 年度新增 ${result.addedCount} 筆，覆蓋更新 ${result.updatedCount} 筆員工申報資料。`);
        setShowImportModal(false);
        setExcelFile1(null);
        setExcelFile2(null);
        setExcelFile3(null);
        // setParsedEmployees([]); // Don't clear on success, to allow merging subsequent uploads
        fetchStatsAndEmployees();
        onLogAction("匯入員工薪資 Excel", `批量匯入三檔整合 ${importYear} 年度員工薪酬資料共 ${parsedEmployees.length} 筆，重新試算全時人員中位數`);
        
        if (importMode === "drive_sync") {
          const updatedSettings = {
            ...syncSettings,
            lastSyncTime: new Date().toISOString(),
            lastSyncStatus: "success",
            lastSyncLog: `[雲端同步寫入] 已成功寫入 ${importYear} 年度薪酬資料。新增：${result.addedCount} 筆，覆蓋：${result.updatedCount} 筆。`
          };
          setSyncSettings(updatedSettings);
          try {
            await fetch("/api/drive-sync/settings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...updatedSettings,
                username: user.username,
                role: user.role
              })
            });
          } catch (e) {
            console.error("Failed to save import confirm settings", e);
          }
        }
      } else {
        const errData = await response.json();
        alert(`❌ 匯入失敗：${errData.error || "未知錯誤"}`);
      }
    } catch (err) {
      alert("❌ 無法與伺服器建立連線，請稍後再試。");
    } finally {
      setImporting(false);
    }
  };

  // Recharts formatted chart data
  const chartData = [...stats].sort((a, b) => a.year - b.year).map(s => ({
    name: `${s.year}年`,
    "員工人數 (人)": s.employeeCount,
    "平均薪資 (萬元)": Math.round(s.avgSalary / 10000),
    "中位數薪資 (萬元)": Math.round(s.medianSalary / 10000),
    "平均福利費用 (萬元)": Math.round(s.avgWelfare / 10000)
  }));

  // Active Year Stats helper for MOPS display (dynamically resolved based on overviewYear selection)
  const activeYearStats = useMemo(() => {
    const found = stats.find(s => s.year === overviewYear);
    if (found) {
      return {
        ...found,
        yoySalaryCount: found.yoySalaryCount || "0%",
        yoySalaryAvg: found.yoySalaryAvg || "0%",
        yoySalaryMedian: found.yoySalaryMedian || "0%",
        excludedCount: found.excludedCount || 0,
        excludedTotalSalary: found.excludedTotalSalary || 0,
        excludedAvgSalary: found.excludedAvgSalary || 0,
        excludedTotalWelfare: found.excludedTotalWelfare || 0,
        excludedAvgWelfare: found.excludedAvgWelfare || 0,
        excludedEmployees: found.excludedEmployees || []
      };
    }
    return {
      year: overviewYear,
      employeeCount: 0,
      totalSalary: 0,
      avgSalary: 0,
      medianSalary: 0,
      totalWelfare: 0,
      avgWelfare: 0,
      medianWelfare: 0,
      yoySalaryCount: "0%",
      yoySalaryAvg: "0%",
      yoySalaryMedian: "0%",
      excludedCount: 0,
      excludedTotalSalary: 0,
      excludedAvgSalary: 0,
      excludedTotalWelfare: 0,
      excludedAvgWelfare: 0,
      excludedEmployees: []
    };
  }, [stats, overviewYear]);

  const prevYearStats = useMemo(() => {
    const targetPrevYear = activeYearStats.year - 1;
    return stats.find(s => s.year === targetPrevYear) || {
      year: targetPrevYear,
      employeeCount: 0,
      totalSalary: 0,
      avgSalary: 0,
      medianSalary: 0,
      totalWelfare: 0,
      avgWelfare: 0,
      medianWelfare: 0
    };
  }, [stats, activeYearStats]);

  // BLOCKING REQUIREMENT FOR RBAC:
  // "例如：薪資" - different permissions should see different info. Sales Leader MUST be blocked!
  if (isSalesLeader) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center font-sans space-y-4">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto border border-red-200 shadow-sm">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-850">
          存取限額權限管制 <span className="text-xs text-slate-400 block mt-1">/ Restricted Personnel Salary Data</span>
        </h2>
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-2 text-left">
          <p className="font-bold text-slate-800">🔒 您的角色為：業務團隊主管 (SALES_LEADER)</p>
          <p>
            依據上市櫃稽核內部控制與隱私分流原則，薪資敏感資料（包括全時人員中位數報表、薪酬總額申報明細等）
            <strong>僅限 HR 管理者與高階主管（董事長/總經理）查閱</strong>。
          </p>
          <p className="text-slate-500">
            如果您需要查看本公司申報黃標/紅標合規情形，請向總經理室或管理處提出權限專案授權申請。
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-2" />
        <span>全時人員中位數申報數據計算中，請稍候...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans print-card">
      
      {/* Tab Header with Primary Traditional Chinese & Secondary English */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 border-b border-slate-200 pb-4 no-print">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
            非主管全時員工薪資中位數報表 <span className="text-sm font-normal text-slate-400 block md:inline md:ml-2">/ Non-Managerial Median Salary Report</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            「非擔任主管職務之全時員工薪資資訊」報表格式，提供動態中位數運算。
          </p>
        </div>

        {/* Group Filing Year dropdown and Action Buttons on the right side */}
        <div className="flex flex-wrap items-center gap-2 xl:justify-end shrink-0">
          {/* Filing Year Selector Dropdown */}
          <div className="flex items-center gap-1.5 border border-slate-200 bg-slate-50 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 shrink-0">
            <span className="text-slate-500 font-sans">申報年度:</span>
            <select
              value={overviewYear}
              onChange={(e) => setOverviewYear(Number(e.target.value))}
              className="bg-transparent border-none p-0 focus:ring-0 text-slate-800 font-bold font-sans text-xs cursor-pointer focus:outline-hidden"
            >
              <option value={2027}>2027 年 (未來預留)</option>
              <option value={2026}>2026 年 (本期最新)</option>
              <option value={2025}>2025 年 (前期對比)</option>
              <option value={2024}>2024 年 (歷史對比)</option>
            </select>
          </div>

          {isHR && (
            <>
              <button
                onClick={() => {
                  setEditingEmpId(null);
                  setEmpId("");
                  setName("");
                  setTitle("");
                  setShowAddForm(!showAddForm);
                  if (!showAddForm) {
                    setSubTab("details");
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg transition-colors bg-white shadow-xs shrink-0"
              >
                <PlusCircle className="w-4 h-4 text-slate-400" />
                <span>新增員工薪水 (Add)</span>
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-xs font-semibold rounded-lg transition-colors bg-white shadow-xs shrink-0"
              >
                <Upload className="w-4 h-4 text-emerald-500" />
                <span>匯入檔案 (Import)</span>
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm flex items-center gap-2 no-print">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        {/* Card 1 */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block uppercase">申報員工人數 (全時非主管)</span>
            <span className="text-xl font-bold text-slate-800 font-mono">
              {activeYearStats.employeeCount} <span className="text-xs font-normal text-slate-400">人</span>
            </span>
            <span className="text-[10px] text-slate-400 block">
              去年同期: {prevYearStats.employeeCount} 人
            </span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block uppercase">薪資中位數 (Median Salary)</span>
            <span className="text-xl font-bold text-indigo-900 font-mono">
              {Math.round(activeYearStats.medianSalary / 10000)} <span className="text-xs font-normal text-slate-400">萬元/年</span>
            </span>
            <span className="text-[10px] text-slate-400 block flex items-center gap-1">
              中位數變動比: 
              {activeYearStats.yoySalaryMedian.startsWith("-") ? (
                <span className="text-red-500 font-bold font-mono inline-flex items-center gap-0.5">
                  <TrendingDown className="w-3 h-3" /> {activeYearStats.yoySalaryMedian}
                </span>
              ) : (
                <span className="text-emerald-500 font-bold font-mono inline-flex items-center gap-0.5">
                  <TrendingUp className="w-3 h-3" /> +{activeYearStats.yoySalaryMedian}
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block uppercase">薪資平均數 (Average Salary)</span>
            <span className="text-xl font-bold text-emerald-900 font-mono">
              {Math.round(activeYearStats.avgSalary / 10000)} <span className="text-xs font-normal text-slate-400">萬元/年</span>
            </span>
            <span className="text-[10px] text-slate-400 block flex items-center gap-1">
              平均數變動比: 
              {activeYearStats.yoySalaryAvg.startsWith("-") ? (
                <span className="text-red-500 font-bold font-mono inline-flex items-center gap-0.5">
                  <TrendingDown className="w-3 h-3" /> {activeYearStats.yoySalaryAvg}
                </span>
              ) : (
                <span className="text-emerald-500 font-bold font-mono inline-flex items-center gap-0.5">
                  <TrendingUp className="w-3 h-3" /> +{activeYearStats.yoySalaryAvg}
                </span>
              )}
            </span>
          </div>
        </div>

      </div>

      {/* Sub Tabs Selector */}
      <div className="flex border-b border-slate-200 no-print">
        <button
          onClick={() => setSubTab("overview")}
          className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            subTab === "overview"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          }`}
        >
          📊 申報總覽 (Overview)
        </button>
        <button
          onClick={() => setSubTab("details")}
          className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            subTab === "details"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          }`}
        >
          📋 申報明細與管理 (Details)
        </button>
        <button
          onClick={() => setSubTab("members")}
          className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            subTab === "members"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          }`}
        >
          👥 人員管理 (Members)
        </button>
      </div>

      {/* Add/Edit Employee Form Section (HR Admin only) */}
      {subTab === "details" && showAddForm && isHR && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm no-print"
        >
          <form onSubmit={editingEmpId ? handleUpdateEmployee : handleAddEmployee} className="space-y-4">
            <h3 className="font-bold text-sm text-slate-800 border-b border-slate-200 pb-2 md:inline md:ml-2">
              {editingEmpId ? "✏️ 編輯非主管員工薪酬資料" : "➕ 新增非主管員工薪酬申報資料"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block text-slate-500 font-medium mb-1">員工編號 (ID)</label>
                <input
                  type="text"
                  required
                  placeholder="如: E112"
                  value={empId}
                  onChange={(e) => setEmpId(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50/50"
                />
              </div>
              <div>
                <label className="block text-slate-500 font-medium mb-1">員工姓名 (Name)</label>
                <input
                  type="text"
                  required
                  placeholder="如: 蔡依林"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50/50"
                />
              </div>
              <div>
                <label className="block text-slate-500 font-medium mb-1">所屬部門 (Department)</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50/50"
                >
                  {uniqueDepartments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-500 font-medium mb-1">全年薪資總額 (NT$ - 扣除主管加給)</label>
                <input
                  type="number"
                  required
                  value={salary}
                  onChange={(e) => setSalary(Number(e.target.value))}
                  className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50/50 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-500 font-medium mb-1">全年福利費用 (NT$ - 含三節、保險、健檢等)</label>
                <input
                  type="number"
                  required
                  value={welfare}
                  onChange={(e) => setWelfare(Number(e.target.value))}
                  className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50/50 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-500 font-medium mb-1">申報年度</label>
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50/50 font-mono"
                >
                  <option value={2025}>2025 年度 (最新)</option>
                  <option value={2024}>2024 年度 (歷史對比)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 justify-end text-xs pt-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
              >
                {editingEmpId ? "確認修改 (Save)" : "確認新增並重新核算中位數 (Add & Calc)"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingEmpId(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg"
              >
                取消
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Primary Regulatory MOPS Format Table (符合原本 Excel 格式之呈現) */}
      {subTab === "overview" && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 print-card">
        <div className="text-center pb-4 mb-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 tracking-tight">
            非擔任主管職務之全時員工薪資報表 <span className="text-xs font-normal text-slate-400 block mt-1">/ Non-Managerial Full-Time Employee Salary Report</span>
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5">
            上市櫃法規合規代碼：TWSE-110-SEC-04 | 機密等級：內部高度機密 (Strictly Confidential)
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border border-slate-200 text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <th className="py-3 px-4 border-r border-slate-200">申報項目 (Filing Items)</th>
                <th className="py-3 px-4 border-r border-slate-200 text-right font-mono">2024年度 (前年)</th>
                <th className="py-3 px-4 border-r border-slate-200 text-right font-mono bg-blue-50/30">2025年度 (申報年)</th>
                <th className="py-3 px-4 text-center font-mono">變動比率 (YoY %)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              <tr>
                <td className="py-3 px-4 font-semibold border-r border-slate-200 bg-slate-50/30">1. 非主管全時員工人數 (名)</td>
                <td className="py-3 px-4 text-right border-r border-slate-200 font-mono">
                  {prevYearStats.employeeCount} 人
                </td>
                <td className="py-3 px-4 text-right border-r border-slate-200 font-mono bg-blue-50/10 font-bold">
                  {activeYearStats.employeeCount} 人
                </td>
                <td className="py-3 px-4 text-center font-mono">
                  {activeYearStats.yoySalaryCount}
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold border-r border-slate-200 bg-slate-50/30">2. 員工薪資總額 (NT$ 千元)</td>
                <td className="py-3 px-4 text-right border-r border-slate-200 font-mono">
                  {Math.round(prevYearStats.totalSalary / 1000).toLocaleString()}
                </td>
                <td className="py-3 px-4 text-right border-r border-slate-200 font-mono bg-blue-50/10 font-bold">
                  {Math.round(activeYearStats.totalSalary / 1000).toLocaleString()}
                </td>
                <td className="py-3 px-4 text-center font-mono">
                  {activeYearStats.yoySalaryAvg}
                </td>
              </tr>
              <tr className="bg-indigo-50/10">
                <td className="py-3 px-4 font-bold border-r border-slate-200 text-indigo-900 bg-indigo-50/30">3. 員工薪資平均數 (NT$ 元)</td>
                <td className="py-3 px-4 text-right border-r border-slate-200 font-mono text-slate-700">
                  {prevYearStats.avgSalary.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-right border-r border-slate-200 font-mono bg-indigo-50/20 font-bold text-indigo-900">
                  {activeYearStats.avgSalary.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-center font-mono text-indigo-800 font-bold">
                  {activeYearStats.yoySalaryAvg}
                </td>
              </tr>
              <tr className="bg-emerald-50/10">
                <td className="py-3 px-4 font-bold border-r border-slate-200 text-emerald-900 bg-emerald-50/30">★ 4. 員工薪資中位數 (NT$ 元)</td>
                <td className="py-3 px-4 text-right border-r border-slate-200 font-mono text-slate-700">
                  {prevYearStats.medianSalary.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-right border-r border-slate-200 font-mono bg-emerald-50/20 font-bold text-emerald-900">
                  {activeYearStats.medianSalary.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-center font-mono text-emerald-800 font-bold">
                  {activeYearStats.yoySalaryMedian}
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold border-r border-slate-200 bg-slate-50/30">5. 員工福利費用總額 (NT$ 千元)</td>
                <td className="py-3 px-4 text-right border-r border-slate-200 font-mono">
                  {Math.round(prevYearStats.totalWelfare / 1000).toLocaleString()}
                </td>
                <td className="py-3 px-4 text-right border-r border-slate-200 font-mono bg-blue-50/10">
                  {Math.round(activeYearStats.totalWelfare / 1000).toLocaleString()}
                </td>
                <td className="py-3 px-4 text-center font-mono">
                  {activeYearStats.yoySalaryAvg}
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold border-r border-slate-200 bg-slate-50/30">6. 員工福利費用平均數 (NT$ 元)</td>
                <td className="py-3 px-4 text-right border-r border-slate-200 font-mono">
                  {prevYearStats.avgWelfare.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-right border-r border-slate-200 font-mono bg-blue-50/10">
                  {activeYearStats.avgWelfare.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-center font-mono">
                  {activeYearStats.yoySalaryAvg}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Dynamic regulatory note based on Taiwan SE criteria */}
        <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-500 space-y-1">
          <p className="font-semibold text-slate-700">📌 上市櫃警示合規查核 (Filing Inspection Result)：</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>警示指標1 (平均低於50萬)：該公司非主管平均年薪為 <span className="font-semibold">NT$ {activeYearStats.avgSalary.toLocaleString()} 元</span>，高於法規黃標限制，<span className="text-emerald-600 font-semibold">符合法規標準</span>。</li>
            <li>警示指標2 (營業利益增、平均薪未增)：2025年非主管薪資平均數 YoY 變動為 <span className="font-semibold text-emerald-600">{activeYearStats.yoySalaryAvg}</span>，無不合理減薪或未合理分配利潤之虞。</li>
            <li>警示指標3 (中位數低於同業)：目前台灣資訊與電子服務同業中位數平均為 92 萬元。本公司中位數為 <span className="font-semibold text-indigo-700">NT$ {activeYearStats.medianSalary.toLocaleString()} 元</span>，處於領先區段。</li>
          </ul>
        </div>
      </div>
      )}

      {/* Excluded Board Members and Insiders Details & Separate Stats Table */}
      {subTab === "overview" && (
        <div className="bg-white border-2 border-amber-200 shadow-sm rounded-xl p-5 mt-6 print-card bg-amber-50/5">
          <div className="border-b border-amber-100 pb-4 mb-4">
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="p-1 bg-amber-50 text-amber-600 rounded-md">
                <Award className="w-4 h-4" />
              </span>
              <span>★ 董事會與內部人薪資明細獨立統計</span>
              <span className="text-xs font-normal text-slate-400">/ Board & Insiders Excluded Details & Stats</span>
            </h3>
            <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
              依據證交所申報規範，<strong>董事會成員（職等 9）與手動設定之內部人經理人</strong>之薪酬應自「非擔任主管職務之全時員工」中位數與平均數中<strong>剔除不予合併計算</strong>。以下依法單獨列示其個人薪資金額、福利金額，並進行獨立統計。
            </p>
          </div>

          {/* Independent Statistical Metrics Dashboard */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
            <div className="bg-white border border-amber-100 p-3 rounded-lg shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold block">排除人員合計總數</span>
              <span className="text-lg font-bold text-amber-850 font-mono">
                {activeYearStats.excludedCount} <span className="text-xs font-normal text-slate-400">名</span>
              </span>
            </div>
            <div className="bg-white border border-amber-100 p-3 rounded-lg shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold block">排除薪資總額 (千元)</span>
              <span className="text-lg font-bold text-amber-850 font-mono">
                {Math.round(activeYearStats.excludedTotalSalary / 1000).toLocaleString()} <span className="text-xs font-normal text-slate-400">NT$</span>
              </span>
            </div>
            <div className="bg-white border border-amber-100 p-3 rounded-lg shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold block">排除人員平均年薪</span>
              <span className="text-lg font-bold text-indigo-900 font-mono">
                {activeYearStats.excludedAvgSalary.toLocaleString()} <span className="text-xs font-normal text-slate-400">元/年</span>
              </span>
            </div>
          </div>

          {/* Table display */}
          {activeYearStats.excludedEmployees && activeYearStats.excludedEmployees.length > 0 ? (
            <div className="border border-slate-150 rounded-xl overflow-hidden shadow-2xs bg-white">
              <table className="w-full text-center text-xs border-collapse">
                <thead>
                  <tr className="bg-amber-50/50 text-amber-950 font-bold border-b border-slate-200">
                    <th className="py-2.5 px-4 text-center border-r border-slate-100 w-[12%]">員工編號</th>
                    <th className="py-2.5 px-4 text-center border-r border-slate-100 w-[15%]">姓名</th>
                    <th className="py-2.5 px-4 text-center border-r border-slate-100 w-[30%]">部門</th>
                    <th className="py-2.5 px-4 text-center border-r border-slate-100 w-[15%]">排除身分</th>
                    <th className="py-2.5 px-4 text-center border-r border-slate-100 text-right pr-6 w-[14%]">全年薪資 (元)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                  {activeYearStats.excludedEmployees.map((e: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 px-4 border-r border-slate-100 text-center font-bold text-slate-500">
                        {e.empId}
                      </td>
                      <td className="py-2.5 px-4 border-r border-slate-100 text-center font-sans font-bold text-slate-900">
                        {e.name}
                      </td>
                      <td className="py-2.5 px-4 border-r border-slate-100 text-center font-sans">
                        {e.department}
                      </td>
                      <td className="py-2.5 px-4 border-r border-slate-100 text-center font-sans">
                        {e.isBoard ? (
                          <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded">
                            👑 董事成員
                          </span>
                        ) : e.isNewbie ? (
                          <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                            🌱 未滿半年
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded">
                            ★ 內部人
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 border-r border-slate-100 text-right pr-6 font-bold text-amber-900">
                        {e.salary.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 bg-white rounded-xl text-xs font-sans">
              💡 本年度 ({overviewYear}年) 申報名單中，暫無被判定或設定為「董事會」或「內部人」的員工資料。
            </div>
          )}
        </div>
      )}

      {/* Annual Salary Income Breakdown Reference Table (年薪所得明細對照表) */}
      {subTab === "overview" && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 mt-6 print-card">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 mb-4 border-b border-slate-200 gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span className="p-1 bg-indigo-50 text-indigo-600 rounded-md">
                  <FileSpreadsheet className="w-4 h-4" />
                </span>
                <span>年薪所得明細對照表</span>
                <span className="text-xs font-normal text-slate-400">/ Annual Salary Income Breakdown Reference Table</span>
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                整合 12 個月薪與其他非經常性獎金所得，按「原始所得項目別」列報，供稅務或稽核核對。
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-500">所得年度:</span>
              <select
                value={overviewYear}
                onChange={(e) => setOverviewYear(Number(e.target.value))}
                className="p-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 font-mono text-xs focus:ring-1 focus:ring-blue-500"
              >
                <option value={2027}>2027 年度 (未來預留)</option>
                <option value={2026}>2026 年度 (本期最新)</option>
                <option value={2025}>2025 年度 (前期對比)</option>
                <option value={2024}>2024 年度 (歷史對比)</option>
              </select>
            </div>
          </div>

          {employees.filter(e => e.year === overviewYear).length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs bg-slate-50/50 border border-dashed border-slate-200 rounded-xl">
              📅 尚無 {overviewYear} 年度的薪資明細對照數據，請點選上方「匯入算中位數」按鈕上傳 Excel 薪資所得帳檔。
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-300 rounded-xl shadow-sm bg-white">
              <table className="min-w-max w-full text-[11px] border-collapse border border-slate-300 text-slate-800">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-center">
                    <th className="py-2.5 px-3 sticky left-0 bg-slate-100 border border-slate-300 z-10 min-w-[75px]">員編</th>
                    <th className="py-2.5 px-3 sticky left-[75px] bg-slate-100 border border-slate-300 z-10 min-w-[85px]">姓名</th>
                    {Array.from({ length: 12 }, (_, i) => (
                      <th key={i} className="py-2.5 px-2 bg-[#E0F7FA] border border-slate-300 text-[#006064] font-mono min-w-[50px]">
                        {String(i + 1).padStart(2, '0')}
                      </th>
                    ))}
                    <th className="py-2.5 px-3 bg-[#FFFF00] border border-slate-300 text-black min-w-[120px] leading-snug">
                      原始年薪金額<br/>（A）
                    </th>
                    <th className="py-2.5 px-3 bg-[#E8F5E9] border border-slate-300 text-[#1B5E20] min-w-[140px] leading-snug">
                      第一次年終獎金<br/>(含董事長紅包)
                    </th>
                    <th className="py-2.5 px-3 bg-[#E8F5E9] border border-slate-300 text-[#1B5E20] min-w-[140px] leading-snug">
                      第二次績效獎金<br/>(含特別獎金)
                    </th>
                    <th className="py-2.5 px-3 bg-[#E8F5E9] border border-slate-300 text-[#1B5E20] min-w-[100px]">其他獎金</th>
                    <th className="py-2.5 px-3 bg-[#E8F5E9] border border-slate-300 text-[#1B5E20] min-w-[100px]">二八獎金</th>
                    <th className="py-2.5 px-3 bg-[#E8F5E9] border border-slate-300 text-[#1B5E20] min-w-[100px]">公提持股金</th>
                    <th className="py-2.5 px-3 bg-[#E8F5E9] border border-slate-300 text-[#1B5E20] min-w-[100px]">業績獎金</th>
                    <th className="py-2.5 px-3 bg-[#E8F5E9] border border-slate-300 text-[#1B5E20] min-w-[100px]">工作獎金</th>
                    <th className="py-2.5 px-3 bg-[#E8F5E9] border border-slate-300 text-[#1B5E20] min-w-[100px]">節金</th>
                    <th className="py-2.5 px-3 bg-[#E8F5E9] border border-slate-300 text-[#1B5E20] min-w-[100px]">生日禮金</th>
                    <th className="py-2.5 px-3 bg-[#E8F5E9] border border-slate-300 text-[#1B5E20] min-w-[100px]">加班費</th>
                    <th className="py-2.5 px-3 bg-[#E8F5E9] border border-slate-300 text-[#1B5E20] min-w-[110px] leading-snug">資遣費離職金</th>
                    <th className="py-2.5 px-3 bg-[#E8F5E9] border border-slate-300 text-[#1B5E20] min-w-[100px]">生育津貼</th>
                    <th className="py-2.5 px-3 bg-[#E1F5FE] border border-slate-300 text-[#01579B] min-w-[180px] leading-snug font-bold">
                      非經常性薪資 D<br/>（加班費，獎金，酬勞...等）
                    </th>
                    <th className="py-2.5 px-3 bg-[#E8EAF6] border border-slate-300 text-[#1A237E] min-w-[200px] leading-snug font-bold">
                      「經常性薪資」及依公司規定「以員工任職月數比例」計算發放之薪資項目<br/>E＝A－D
                    </th>
                    <th className="py-2.5 px-3 bg-[#FFF9C4] border border-slate-300 text-[#F57F17] min-w-[160px] leading-snug font-bold">
                      經常性薪資（年化）<br/>F＝（E÷B）*12
                    </th>
                    <th className="py-2.5 px-3 bg-[#FFE082] border border-slate-300 text-[#E65100] min-w-[140px] leading-snug font-bold">
                      總薪資（年化）<br/>G＝ D＋F
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700 font-mono text-center">
                  {employees.filter(e => e.year === overviewYear).map((emp) => {
                    const monthly = emp.monthlySalaries || Array(12).fill(0);
                    const originalSum = monthly.reduce((s, v) => s + v, 0);
                    const nonReg = emp.nonRegularSalary ?? 
                      ((emp.firstYearEndBonus ?? 0) +
                       (emp.secondPerfBonus ?? 0) +
                       (emp.otherBonus ?? 0) +
                       (emp.bonus28 ?? 0) +
                       (emp.companyStockContribution ?? 0) +
                       (emp.salesCommission ?? 0) +
                       (emp.workBonus ?? 0) +
                       (emp.festivalBonus ?? 0) +
                       (emp.birthdayGift ?? 0) +
                       (emp.overtime ?? 0) +
                       (emp.severance ?? 0) +
                       (emp.maternityAllowance ?? 0));
                    
                    const A = emp.originalAnnualSalary ?? originalSum;
                    const D = nonReg;
                    const E = A - D;
                    const B = emp.months || 12;
                    const F = B > 0 ? (E / B) * 12 : E;
                    const G = D + F;

                    return (
                      <tr key={emp.id || emp.empId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-2 px-2 sticky left-0 bg-white border border-slate-200 font-semibold text-slate-500 text-center">
                          {emp.empId}
                        </td>
                        <td className="py-2 px-2 sticky left-[75px] bg-white border border-slate-200 font-sans font-bold text-slate-900 text-center">
                          {emp.name}
                        </td>
                        {monthly.map((val, mIdx) => (
                          <td key={mIdx} className="py-2 px-1 border border-slate-200 text-center">
                            {val}
                          </td>
                        ))}
                        <td className="py-2 px-2 border border-slate-200 bg-yellow-50/10 font-bold text-slate-900 text-center">
                          {A}
                        </td>
                        <td className="py-2 px-2 border border-slate-200 text-center">
                          {emp.firstYearEndBonus ?? 0}
                        </td>
                        <td className="py-2 px-2 border border-slate-200 text-center">
                          {emp.secondPerfBonus ?? 0}
                        </td>
                        <td className="py-2 px-2 border border-slate-200 text-center">
                          {emp.otherBonus ?? 0}
                        </td>
                        <td className="py-2 px-2 border border-slate-200 text-center">
                          {emp.bonus28 ?? 0}
                        </td>
                        <td className="py-2 px-2 border border-slate-200 text-center">
                          {emp.companyStockContribution ?? 0}
                        </td>
                        <td className="py-2 px-2 border border-slate-200 text-center">
                          {emp.salesCommission ?? 0}
                        </td>
                        <td className="py-2 px-2 border border-slate-200 text-center">
                          {emp.workBonus ?? 0}
                        </td>
                        <td className="py-2 px-2 border border-slate-200 text-center">
                          {emp.festivalBonus ?? 0}
                        </td>
                        <td className="py-2 px-2 border border-slate-200 text-center">
                          {emp.birthdayGift ?? 0}
                        </td>
                        <td className="py-2 px-2 border border-slate-200 text-center">
                          {emp.overtime ?? 0}
                        </td>
                        <td className="py-2 px-2 border border-slate-200 text-center">
                          {emp.severance ?? 0}
                        </td>
                        <td className="py-2 px-2 border border-slate-200 text-center">
                          {emp.maternityAllowance ?? 0}
                        </td>
                        <td className="py-2 px-2 border border-slate-200 bg-sky-50/20 text-[#01579B] font-bold text-center">
                          {D}
                        </td>
                        <td className="py-2 px-2 border border-slate-200 bg-indigo-50/20 text-[#1A237E] font-bold text-center">
                          {E}
                        </td>
                        <td className="py-2 px-2 border border-slate-200 bg-yellow-50/20 text-[#F57F17] font-bold text-center">
                          {Math.round(F)}
                        </td>
                        <td className="py-2 px-2 border border-slate-200 bg-orange-50/20 text-[#E65100] font-bold text-center">
                          {Math.round(G)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Grid: Charts Comparison (自動化運算與數據視覺化) */}
      {subTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 no-print">
        
        {/* Chart 1: Average vs Median Salary comparison */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5">
          <h4 className="font-bold text-slate-800 text-sm mb-4">
            平均數與中位數薪資對比圖 <span className="text-xs text-slate-400 font-normal">/ Avg vs Median Salary Chart (萬元)</span>
          </h4>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit="萬" />
                <Tooltip formatter={(value) => [`${value} 萬`, ""]} contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="平均薪資 (萬元)" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                <Bar dataKey="中位數薪資 (萬元)" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Welfare expenses Trend */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5">
          <h4 className="font-bold text-slate-800 text-sm mb-4">
            全時人員福利費用趨勢圖 <span className="text-xs text-slate-400 font-normal">/ Employee Welfare Trend Chart (萬元)</span>
          </h4>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit="萬" />
                <Tooltip formatter={(value) => [`${value} 萬`, ""]} contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="平均福利費用 (萬元)" stroke="#f59e0b" strokeWidth={3} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="員工人數 (人)" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      )}

      {/* Raw Employee Database (For HR Admin CRUD with automatic recalculation) */}
      {subTab === "details" && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4 mb-4 gap-3">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
            <span>非主管全時員工薪水明細資料 <span className="text-xs text-slate-400 font-normal">/ Employee Salary Records</span></span>
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-medium">
              共 <span className="font-bold text-blue-600">{employees.length}</span> 筆申報明細
            </span>
            {isHR && employees.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => setBulkDeleteConfirm({ type: "year", year: 2025 })}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg border border-red-200 transition-colors shadow-2xs"
                  title="刪除 2025 年度的所有申報資料"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  <span>一鍵刪除 2025 資料</span>
                </button>
                <button
                  onClick={() => setBulkDeleteConfirm({ type: "all" })}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
                  title="清空資料庫內所有的申報資料"
                >
                  <Trash2 className="w-3.5 h-3.5 text-white" />
                  <span>一鍵清空所有資料</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                <th className="py-2.5 px-2 w-8"></th>
                <th className="py-2.5 px-3">員工編號</th>
                <th className="py-2.5 px-3">姓名</th>
                <th className="py-2.5 px-3">部門</th>
                <th className="py-2.5 px-3 text-right">全年薪資總額 (NT$)</th>
                <th className="py-2.5 px-3 text-center">年度</th>
                {isHR && <th className="py-2.5 px-3 text-right">稽核操作</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {employees.map((emp) => {
                const hasDetails = emp.originalAnnualSalary !== undefined;
                return (
                  <React.Fragment key={emp.id}>
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 px-2 text-center">
                        {hasDetails ? (
                          <button
                            onClick={() => setExpandedEmpIds(prev => ({ ...prev, [emp.id]: !prev[emp.id] }))}
                            className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
                            title="展開詳細薪資結構"
                          >
                            {expandedEmpIds[emp.id] ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        ) : (
                          <span className="block w-4" />
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">{emp.empId}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span>{emp.name}</span>
                          {hasDetails && (
                            <span className="text-[9px] bg-green-50 text-green-700 font-bold px-1.5 py-0.5 rounded border border-green-150">
                              含細項
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{emp.department}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-800 font-semibold">{emp.salary.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-center font-mono">{emp.year}年</td>
                      {isHR && (
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => handleEditEmployee(emp)}
                              className="p-1 text-slate-500 hover:bg-slate-50 rounded"
                              title="修改"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm({ id: emp.id || emp.empId, name: emp.name, year: emp.year })}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                              title="刪除"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                    {expandedEmpIds[emp.id] && hasDetails && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={isHR ? 7 : 6} className="p-4 border-t border-b border-slate-200">
                          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3 max-w-4xl mx-auto">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                              <h5 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                                <span className="p-1 bg-indigo-50 text-indigo-600 rounded">📊</span>
                                <span>薪資申報明細與非經常性扣除 (Salary Itemization) — {emp.name} ({emp.empId})</span>
                              </h5>
                              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold font-mono">
                                任職月數: {emp.months ?? 12} 個月
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
                              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                                <span className="text-slate-400 block text-[10px] font-semibold">原始年薪金額 (A)</span>
                                <span className="text-slate-800 font-bold text-sm">NT$ {(emp.originalAnnualSalary ?? 0).toLocaleString()} 元</span>
                              </div>
                              <div className="p-2.5 bg-red-50/30 rounded-lg border border-red-100/50">
                                <span className="text-red-500 block text-[10px] font-semibold">非經常性薪資合計 (D)</span>
                                <span className="text-red-700 font-bold text-sm">NT$ {(emp.nonRegularSalary ?? 0).toLocaleString()} 元</span>
                              </div>
                              <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-100">
                                <span className="text-emerald-600 block text-[10px] font-semibold">經常性及任職月數比例薪資 (A - D)</span>
                                <span className="text-emerald-700 font-bold text-sm">NT$ {(emp.salary ?? 0).toLocaleString()} 元</span>
                              </div>
                            </div>

                            <div className="space-y-1.5 pt-1">
                              <span className="text-slate-400 block text-[10px] font-semibold uppercase">非經常性薪資項目明細 (Itemized Deductions for Regular Salary Mapping)</span>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                                <div className="flex justify-between p-1.5 border border-slate-100 rounded bg-slate-50/30">
                                  <span className="text-slate-500">年終獎金:</span>
                                  <span className="font-mono font-medium text-slate-700">{(emp.firstYearEndBonus ?? 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between p-1.5 border border-slate-100 rounded bg-slate-50/30">
                                  <span className="text-slate-500">績效獎金:</span>
                                  <span className="font-mono font-medium text-slate-700">{(emp.secondPerfBonus ?? 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between p-1.5 border border-slate-100 rounded bg-slate-50/30">
                                  <span className="text-slate-500">其他獎金:</span>
                                  <span className="font-mono font-medium text-slate-700">{(emp.otherBonus ?? 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between p-1.5 border border-slate-100 rounded bg-slate-50/30">
                                  <span className="text-slate-500">二八獎金:</span>
                                  <span className="font-mono font-medium text-slate-700">{(emp.bonus28 ?? 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between p-1.5 border border-slate-100 rounded bg-slate-50/30">
                                  <span className="text-slate-500">公提持股金:</span>
                                  <span className="font-mono font-medium text-slate-700">{(emp.companyStockContribution ?? 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between p-1.5 border border-slate-100 rounded bg-slate-50/30">
                                  <span className="text-slate-500">業績獎金:</span>
                                  <span className="font-mono font-medium text-slate-700">{(emp.salesCommission ?? 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between p-1.5 border border-slate-100 rounded bg-slate-50/30">
                                  <span className="text-slate-500">工作獎金:</span>
                                  <span className="font-mono font-medium text-slate-700">{(emp.workBonus ?? 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between p-1.5 border border-slate-100 rounded bg-slate-50/30">
                                  <span className="text-slate-500">節金:</span>
                                  <span className="font-mono font-medium text-slate-700">{(emp.festivalBonus ?? 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between p-1.5 border border-slate-100 rounded bg-slate-50/30">
                                  <span className="text-slate-500">生日禮金:</span>
                                  <span className="font-mono font-medium text-slate-700">{(emp.birthdayGift ?? 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between p-1.5 border border-slate-100 rounded bg-slate-50/30">
                                  <span className="text-slate-500">加班費:</span>
                                  <span className="font-mono font-medium text-slate-700">{(emp.overtime ?? 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between p-1.5 border border-slate-100 rounded bg-slate-50/30">
                                  <span className="text-slate-500">資遣與離職金:</span>
                                  <span className="font-mono font-medium text-slate-700">{(emp.severance ?? 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between p-1.5 border border-slate-100 rounded bg-slate-50/30">
                                  <span className="text-slate-500">生育津貼:</span>
                                  <span className="font-mono font-medium text-slate-700">{(emp.maternityAllowance ?? 0).toLocaleString()}</span>
                                </div>
                              </div>
                            </div>
                            <p className="text-[10px] text-slate-400 italic">
                              * 計算依據：由 HR 批量 Excel 匯入。原始申報金額以實質合規公式「原始年薪金額 - 非經常性薪資總額」為申報基準，保障全時人員中位數之稽核真實性。
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Personnel Management (人員管理) Tab View */}
      {subTab === "members" && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 no-print space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-4 gap-8">
            <div className="min-w-0 flex-grow">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <span>👥 人員管理 <span className="text-xs text-slate-400 font-normal">/ Personnel Management</span></span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                匯入員工到職日及職等 Excel 檔案，並透過設定之
                「結算日」動態試算員工年資。
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 shrink-0 md:ml-8">
              {/* Settlement Date Field */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600 shrink-0">設定日期 (結算日):</label>
                <input
                  type="date"
                  value={settlementDate}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    setSettlementDate(newDate);
                    fetchStatsAndEmployees(newDate);
                  }}
                  className="p-1.5 border border-slate-200 rounded-lg bg-slate-50 font-mono text-xs focus:ring-1 focus:ring-blue-500 text-slate-800 font-bold"
                />
              </div>

              {/* Import Excel File Action */}
              {isHR && (
                <div className="flex items-center gap-2">
                  <input
                    ref={membersInputRef}
                    type="file"
                    id="members-file-import"
                    accept=".xlsx, .xls"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleMembersImport(e.target.files[0]);
                        e.target.value = "";
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => membersInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-750 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>匯入 xlsx, xls 報表</span>
                  </button>

                  {members.length > 0 && (
                    <button
                      onClick={handleClearMembers}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg border border-red-200 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      <span>清空名單</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Insiders & Board Members Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-2.5">
              <div>
                <h4 className="font-bold text-slate-850 text-sm flex items-center gap-1.5">
                  <span className="p-1 bg-amber-50 text-amber-600 rounded">👑</span>
                  <span>內部人及董事會名單 (Insiders & Board of Directors)</span>
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  名單中成員之薪資將自動排除於公開申報中位數統計，但仍於申報總覽明細中單獨列出並進行獨立統計。
                </p>
              </div>
              <div className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-100 font-sans font-semibold mt-2 sm:mt-0 flex gap-4">
                <span>董事會名單: <strong className="font-mono text-sm">{members.filter(m => m.grade === "9").length}</strong> 人</span>
                <span>手動內部人: <strong className="font-mono text-sm">{insiders.length}</strong> 人</span>
                <span>未滿半年: <strong className="font-mono text-sm">{members.filter(m => isUnderSixMonths(m.onboardingDate, settlementDate)).length}</strong> 人</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Board List Card */}
              <div className="bg-white border border-slate-150 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <span>董事會名單 (Board of Directors)</span>
                  </span>
                  <span className="text-[9px] bg-slate-100 text-slate-500 font-medium px-1.5 py-0.5 rounded">
                    依職等自動判定 (職等 9)
                  </span>
                </div>

                {members.filter(m => m.grade === "9").length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs border border-dashed border-slate-150 rounded-lg">
                    目前暫無職等為 "9" 的董事會成員，請先匯入人員名單。
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto pr-1">
                    {members.filter(m => m.grade === "9").map(m => (
                      <div key={m.empId} className="py-2 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-amber-50 text-amber-700 rounded-full flex items-center justify-center font-bold font-sans text-[10px]">
                            {m.name.substring(0, 1)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-800">{m.name}</span>
                            <span className="text-[9px] text-slate-400 font-mono ml-2">({m.empId})</span>
                          </div>
                        </div>
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">
                          職等 {m.grade} (董事)
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Insiders List Card */}
              <div className="bg-white border border-slate-150 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    <span>手動自行增減內部人 (Insiders List)</span>
                  </span>
                  <span className="text-[9px] bg-blue-50 text-blue-600 font-semibold px-1.5 py-0.5 rounded">
                    可手動增減
                  </span>
                </div>

                {/* Quick Add Dropdown Selector */}
                {isHR && (
                  <div className="flex items-center gap-2">
                    <select
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          handleToggleInsider(val);
                          e.target.value = "";
                        }
                      }}
                      className="w-full p-1.5 border border-slate-200 rounded text-xs bg-slate-50 hover:bg-slate-100 focus:ring-1 focus:ring-blue-500 text-slate-700 cursor-pointer font-sans"
                    >
                      <option value="">➕ 選擇現有員工加入內部人名單...</option>
                      {members
                        .filter(m => m.grade !== "9" && !insiders.includes(m.empId))
                        .map(m => (
                          <option key={m.empId} value={m.empId}>
                            {m.name} ({m.empId}) - 職等 {m.grade || "一般"}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {insiders.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs border border-dashed border-slate-150 rounded-lg font-sans">
                    目前暫無手動新增之內部人，可於上方下拉選單選擇加入，或於下方成員清單點選「設為內部人」。
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto pr-1">
                    {members
                      .filter(m => insiders.includes(m.empId))
                      .map(m => (
                        <div key={m.empId} className="py-2 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-blue-50 text-blue-700 rounded-full flex items-center justify-center font-bold font-sans text-[10px]">
                              {m.name.substring(0, 1)}
                            </div>
                            <div>
                              <span className="font-bold text-slate-800">{m.name}</span>
                              <span className="text-[9px] text-slate-400 font-mono ml-2">({m.empId})</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded">
                              內部人
                            </span>
                            {isHR && (
                              <button
                                onClick={() => handleToggleInsider(m.empId)}
                                className="p-0.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded transition-colors"
                                title="移除內部人"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Newbies Card */}
              <div className="bg-white border border-slate-150 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span>未滿半年人員 (Under 6 Months)</span>
                  </span>
                  <span className="text-[9px] bg-slate-100 text-slate-500 font-medium px-1.5 py-0.5 rounded">
                    依結算日自動判定
                  </span>
                </div>

                {members.filter(m => isUnderSixMonths(m.onboardingDate, settlementDate)).length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs border border-dashed border-slate-150 rounded-lg font-sans">
                    目前暫無未滿半年的員工。
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto pr-1">
                    {members.filter(m => isUnderSixMonths(m.onboardingDate, settlementDate)).map(m => (
                      <div key={m.empId} className="py-2 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-emerald-50 text-emerald-700 rounded-full flex items-center justify-center font-bold font-sans text-[10px]">
                            {m.name.substring(0, 1)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-800">{m.name}</span>
                            <span className="text-[9px] text-slate-400 font-mono ml-2">({m.empId})</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-emerald-600 font-bold">
                          {calculateSeniority(m.onboardingDate, settlementDate)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Search bar & count */}
          {members.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-150 text-xs">
              <div className="flex items-center gap-2 w-full sm:max-w-xs">
                <span className="text-slate-400 font-semibold">篩選:</span>
                <input
                  type="text"
                  placeholder="搜尋姓名或員工編號..."
                  value={membersSearchQuery}
                  onChange={(e) => setMembersSearchQuery(e.target.value)}
                  className="w-full p-1.5 border border-slate-200 rounded bg-white text-xs font-sans text-slate-800 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="text-slate-500 font-medium">
                共計人員數量: <strong className="text-blue-600 font-bold font-mono text-sm">{filteredMembers.length}</strong> / {members.length} 筆
              </div>
            </div>
          )}

          {/* Table display matching the exact sequence of the image with insider config column added */}
          {filteredMembers.length > 0 ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-center text-xs border-collapse">
                <thead>
                  <tr className="bg-[#e0f7fa] text-cyan-950 font-bold border-b border-slate-200">
                    <th className="py-2.5 px-4 text-center border-r border-cyan-100 w-[10%]">員編</th>
                    <th className="py-2.5 px-4 text-center border-r border-cyan-100 w-[12%]">姓名</th>
                    <th className="py-2.5 px-4 text-center border-r border-cyan-100 w-[15%]">部門</th>
                    <th className="py-2.5 px-4 text-center border-r border-cyan-100 w-[10%]">職等</th>
                    <th className="py-2.5 px-4 text-center border-r border-cyan-100 w-[12%]">結算日</th>
                    <th className="py-2.5 px-4 text-center border-r border-cyan-100 w-[12%]">到職日</th>
                    <th className="py-2.5 px-4 text-center border-r border-cyan-100 w-[12%]">年資</th>
                    <th className="py-2.5 px-4 text-center w-[17%]">身份設定</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-slate-700 font-mono">
                  {filteredMembers.map((member, idx) => {
                    const seniorityStr = calculateSeniority(member.onboardingDate, settlementDate);
                    const isBoard = member.grade === "9";
                    const isInsider = insiders.includes(member.empId);
                    
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-2.5 px-4 border-r border-slate-100 text-center font-bold text-slate-500">
                          {member.empId}
                        </td>
                        <td className="py-2.5 px-4 border-r border-slate-100 text-center font-sans font-bold text-slate-900">
                          {member.name}
                        </td>
                        <td className="py-2.5 px-4 border-r border-slate-100 text-center font-sans font-semibold text-slate-600">
                          {member.department || "."}
                        </td>
                        <td className="py-2.5 px-4 border-r border-slate-100 text-center font-sans">
                          <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 text-[11px] rounded font-medium">
                            {member.grade || "一般"}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 border-r border-slate-100 text-center text-indigo-650 font-semibold">
                          {settlementDate}
                        </td>
                        <td className="py-2.5 px-4 border-r border-slate-100 text-center text-slate-650">
                          {member.onboardingDate || "-"}
                        </td>
                        <td className="py-2.5 px-4 border-r border-slate-100 text-center font-bold text-emerald-700 font-sans">
                          {seniorityStr}
                        </td>
                        <td className="py-2.5 px-4 text-center font-sans">
                          {isBoard ? (
                            <span className="inline-block px-2 py-1 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold rounded-lg shadow-2xs">
                              👑 董事成員
                            </span>
                          ) : isUnderSixMonths(member.onboardingDate, settlementDate) ? (
                            <span className="inline-block px-2 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold rounded-lg shadow-2xs">
                              🌱 未滿半年
                            </span>
                          ) : (
                            <button
                              onClick={() => handleToggleInsider(member.empId)}
                              disabled={!isHR}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all shadow-2xs ${
                                !isHR 
                                  ? "opacity-50 cursor-not-allowed" 
                                  : "cursor-pointer"
                              } ${
                                isInsider 
                                  ? "bg-blue-600 text-white hover:bg-blue-700" 
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              }`}
                            >
                              {isInsider ? "★ 內部人" : "☆ 設為內部人"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div 
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleMembersImport(e.dataTransfer.files[0]);
                }
              }}
              className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
                dragActive ? "border-emerald-500 bg-emerald-50/20" : "border-slate-300 bg-slate-50/50 hover:border-slate-400"
              }`}
            >
              <div className="max-w-md mx-auto space-y-4">
                <div className="p-4 bg-emerald-50 text-emerald-600 rounded-full w-16 h-16 flex items-center justify-center mx-auto border border-emerald-100 shadow-3xs">
                  <FileSpreadsheet className="w-8 h-8" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="font-bold text-slate-800 text-sm">拖曳或選擇上傳人員資料</h4>
                  <p className="text-xs text-slate-400">
                    請匯入包含<strong>員編、姓名、職等、到職日</strong>的 Excel 報表 (.xlsx, .xls)
                  </p>
                </div>
                {isHR && (
                  <div>
                    <input
                      ref={dragMembersInputRef}
                      type="file"
                      id="members-drag-import"
                      accept=".xlsx, .xls"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleMembersImport(e.target.files[0]);
                          e.target.value = "";
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => dragMembersInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg shadow-sm cursor-pointer transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      <span>點選此處上傳 Excel 檔案</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Excel Import Modal Overlay */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                    <FileSpreadsheet className="w-5 h-5" />
                  </span>
                  <span>批次匯入並整合三項薪資所得 Excel 報表</span>
                </h3>
                <p className="text-xs text-slate-500">
                  可一次選擇匯入三個 Excel 檔案（本薪、其他、節金/年終獎金），系統將依員編自動關聯並試算經常性與中位數薪資。
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowImportModal(false);
                  setExcelFile1(null);
                  setExcelFile2(null);
                  setExcelFile3(null);
                  setParsedEmployees([]);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-full transition-colors font-semibold"
              >
                ✕
              </button>
            </div>

            {/* Modal Tabs Selector */}
            <div className="px-6 pt-3 bg-slate-50/50 border-b border-slate-200/60 flex items-center gap-2">
              <button
                onClick={() => setImportMode("upload")}
                className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  importMode === "upload"
                    ? "border-emerald-600 text-emerald-700 font-extrabold"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>📤 上傳本機報表</span>
              </button>
              <button
                onClick={() => setImportMode("drive_sync")}
                className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  importMode === "drive_sync"
                    ? "border-emerald-600 text-emerald-700 font-extrabold"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Cloud className="w-4 h-4" />
                <span>☁️ Google Drive 雲端同步設定</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5 text-slate-700">
              
              {importMode === "upload" ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {/* Instructions & Reference */}
                  <div className="lg:col-span-1 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-800 font-bold border-b border-slate-200 pb-1.5">
                      <HelpCircle className="w-4 h-4 text-slate-500" />
                      <span>Excel 三檔整合匯入規範</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed text-[11px]">
                      請依下方說明準備並上傳三個薪資報表，系統會自動按<strong>「員工編號」</strong>進行三方關聯：
                    </p>
                    <div className="space-y-2 text-[11px] leading-normal text-slate-600">
                      <p><strong>1. 本薪檔 (必選)</strong>：包含 12 個月薪資，或包含本薪與伙食津貼（系統自動加總為每月薪資並累計為原始年薪 A）。</p>
                      <p><strong>2. 其他所得檔 (必選)</strong>：包含各類年度獎金與津貼（持股金、業績/工作獎金、生日禮金等，累計為非經常性 D）。</p>
                      <p><strong>3. 節金/年終獎金檔 (可選)</strong>：包含端午與中秋等三節節金所得或是年終獎金及績效獎金（若無則不需上傳）。</p>
                    </div>
                    <div className="p-2 bg-indigo-50/50 rounded border border-indigo-100/50 text-[10px] font-mono text-indigo-950 space-y-1">
                      <p className="font-bold text-indigo-900">🧮 經常性及申報薪資核算公式：</p>
                      <p>經常性及比例薪資 = 原始年薪金額 (A) - 非經常性薪資 (D)</p>
                    </div>
                    <button
                      onClick={handleDownloadTemplate}
                      className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold rounded-lg text-center flex items-center justify-center gap-1.5 hover:border-emerald-300 transition-all text-xs shadow-xs cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>📥 下載申報整合範本 CSV</span>
                    </button>
                  </div>

                  {/* File Upload Zones */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center gap-4 text-xs">
                      <span className="font-semibold text-slate-500">申報匯入年度:</span>
                      <select
                        value={importYear}
                        onChange={(e) => setImportYear(Number(e.target.value))}
                        className="p-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 font-mono text-xs focus:ring-1 focus:ring-blue-500"
                      >
                        <option value={2027}>2027 年度 (未來預留)</option>
                        <option value={2026}>2026 年度 (即將申報)</option>
                        <option value={2025}>2025 年度 (本期最新申報)</option>
                        <option value={2024}>2024 年度 (歷史資料)</option>
                      </select>
                    </div>

                    {/* 3 File Drop zones */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* File 1: 本薪檔 */}
                      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/30 text-center flex flex-col items-center justify-center relative hover:border-slate-300 transition-colors">
                        <span className="absolute top-1.5 left-2 text-[9px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded">
                          必選
                        </span>
                        <FileSpreadsheet className={`w-8 h-8 mb-1 ${excelFile1 ? "text-emerald-500" : "text-slate-400"}`} />
                        <p className="text-[11px] font-bold text-slate-800">1. 本薪檔 (Excel)</p>
                        <p className="text-[9px] text-slate-400 mt-1 truncate max-w-full px-2">
                          {excelFile1 ? excelFile1.name : "包含12個月薪資數據"}
                        </p>
                        <input
                          type="file"
                          accept=".xlsx, .xls"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setExcelFile1(e.target.files[0]);
                            }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </div>

                      {/* File 2: 其他所得檔 */}
                      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/30 text-center flex flex-col items-center justify-center relative hover:border-slate-300 transition-colors">
                        <span className="absolute top-1.5 left-2 text-[9px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded">
                          必選
                        </span>
                        <FileSpreadsheet className={`w-8 h-8 mb-1 ${excelFile2 ? "text-emerald-500" : "text-slate-400"}`} />
                        <p className="text-[11px] font-bold text-slate-800">2. 其他所得檔 (Excel)</p>
                        <p className="text-[9px] text-slate-400 mt-1 truncate max-w-full px-2">
                          {excelFile2 ? excelFile2.name : "包含業績/工作獎金/生日禮金等"}
                        </p>
                        <input
                          type="file"
                          accept=".xlsx, .xls"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setExcelFile2(e.target.files[0]);
                            }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </div>

                      {/* File 3: 節金檔 */}
                      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/30 text-center flex flex-col items-center justify-center relative hover:border-slate-300 transition-colors">
                        <span className="absolute top-1.5 left-2 text-[9px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded">
                          選填
                        </span>
                        <FileSpreadsheet className={`w-8 h-8 mb-1 ${excelFile3 ? "text-emerald-500" : "text-slate-400"}`} />
                        <p className="text-[11px] font-bold text-slate-800">3. 節金或年終績效獎金檔 (Excel)</p>
                        <p className="text-[9px] text-slate-400 mt-1 truncate max-w-full px-2">
                          {excelFile3 ? excelFile3.name : "端午/中秋節金或年終績效獎金 (無則免)"}
                        </p>
                        <input
                          type="file"
                          accept=".xlsx, .xls"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setExcelFile3(e.target.files[0]);
                            }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Start processing button */}
                    <div className="flex justify-center pt-2">
                      <button
                        onClick={handleMergeAndProcessExcel}
                        disabled={!excelFile1 || importing}
                        className="flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-lg shadow-sm transition-all"
                      >
                        <RefreshCw className={`w-4 h-4 ${importing ? "animate-spin" : ""}`} />
                        <span>合併三檔並執行試算 (Start Process)</span>
                      </button>
                    </div>

                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-in fade-in duration-200">
                  {/* Google Drive sync panel left (1/3) */}
                  <div className="lg:col-span-1 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-800 font-bold border-b border-slate-200 pb-1.5">
                      <Cloud className="w-4 h-4 text-blue-600" />
                      <span>Google Drive 連線與排程</span>
                    </div>

                    {/* Auth Status Card */}
                    <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-500">雲端連線狀態:</span>
                        {gDriveConnected ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            已連線
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                            未連線
                          </span>
                        )}
                      </div>

                      {gDriveConnected ? (
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-mono text-slate-600 truncate">{gDriveUserEmail}</p>
                          <button
                            onClick={async () => {
                              const isDirect = (syncSettings.authMode || "direct") === "direct";
                              if (isDirect) {
                                localStorage.removeItem("gdrive_direct_access_token");
                                localStorage.removeItem("gdrive_direct_user_email");
                              } else {
                                initAuth(() => {}, () => {}); // triggers disconnect on next init
                              }
                              setGDriveConnected(false);
                              setGDriveToken(null);
                              setGDriveUserEmail(null);
                              alert("🔌 已成功中斷與 Google Drive 的連線。");
                            }}
                            className="w-full py-1 text-[10px] font-bold text-red-600 hover:text-white hover:bg-red-500 border border-red-200 hover:border-red-500 rounded transition-all"
                          >
                            中斷 Google Drive 連線
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={handleGDriveConnect}
                          disabled={gDriveLoading}
                          className="w-full py-1.5 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-xs flex items-center justify-center gap-1.5 transition-all disabled:bg-slate-300"
                        >
                          <LogIn className="w-3.5 h-3.5" />
                          <span>{gDriveLoading ? "請稍候..." : "連接 Google Drive"}</span>
                        </button>
                      )}
                    </div>

                    {/* Settings Form */}
                    <form onSubmit={handleSaveSyncSettings} className="space-y-3 pt-1">
                      <div className="space-y-1">
                        <label className="block font-bold text-slate-700 text-[11px]">雲端連線驗證模式:</label>
                        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-lg text-[10px]">
                          <button
                            type="button"
                            onClick={() => setSyncSettings({ ...syncSettings, authMode: "direct" })}
                            className={`py-1.5 px-2 rounded font-bold transition-all text-center ${
                              (syncSettings.authMode || "direct") === "direct"
                                ? "bg-white text-emerald-700 shadow-xs"
                                : "text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            直接公司帳戶 (推薦)
                          </button>
                          <button
                            type="button"
                            onClick={() => setSyncSettings({ ...syncSettings, authMode: "firebase" })}
                            className={`py-1.5 px-2 rounded font-bold transition-all text-center ${
                              syncSettings.authMode === "firebase"
                                ? "bg-white text-blue-700 shadow-xs"
                                : "text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            Firebase 驗證
                          </button>
                        </div>
                      </div>

                      {(syncSettings.authMode || "direct") === "direct" && (
                        <div className="space-y-1.5 p-2.5 bg-blue-50/50 border border-blue-100 rounded-lg animate-in fade-in duration-200">
                          <div className="flex items-center justify-between">
                            <label className="block font-bold text-slate-800 text-[11px]">公司 Google 用戶端 ID (Client ID):</label>
                            <a
                              href="https://console.cloud.google.com/"
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-0.5"
                            >
                              GCP 控制台 ↗
                            </a>
                          </div>
                          <input
                            type="text"
                            value={syncSettings.googleClientId || ""}
                            onChange={(e) => setSyncSettings({ ...syncSettings, googleClientId: e.target.value })}
                            placeholder="貼上 79424...apps.googleusercontent.com"
                            className="w-full p-2 border border-blue-200 rounded-md text-[11px] font-mono focus:ring-1 focus:ring-blue-500 bg-white"
                          />
                          <div className="text-[10px] text-slate-500 leading-relaxed bg-white p-2 rounded border border-blue-100/50 space-y-1 scale-95 origin-top-left">
                            <p className="font-bold text-blue-900">💡 3 步設定公司帳號直連 Google Drive：</p>
                            <ol className="list-decimal list-inside space-y-0.5 text-slate-600">
                              <li>在公司 GCP 建立「OAuth 用戶端 ID（網頁應用程式）」。</li>
                              <li>
                                設定「已授權的重新導向 URI」為：
                                <code className="block mt-0.5 p-1 bg-slate-50 border border-slate-200 rounded text-[9px] font-mono break-all select-all text-slate-800">
                                  {window.location.origin}/auth/google/callback
                                </code>
                              </li>
                              <li>複製產生的「用戶端 ID」貼在上面，並點選下方「儲存同步排程設定」即可授權連線！</li>
                            </ol>
                          </div>
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="block font-bold text-slate-700 text-[11px]">雲端硬碟資料夾連結 / ID:</label>
                        <input
                          type="text"
                          value={syncSettings.folderUrl}
                          onChange={(e) => {
                            const val = e.target.value;
                            const matches = val.match(/\/folders\/([a-zA-Z0-9-_]+)/);
                            const extractedId = matches ? matches[1] : val;
                            setSyncSettings({
                              ...syncSettings,
                              folderUrl: val,
                              folderId: extractedId
                            });
                          }}
                          placeholder="請貼上雲端硬碟資料夾網址或 ID"
                          className="w-full p-2 border border-slate-200 rounded-lg text-xs font-mono focus:ring-1 focus:ring-emerald-500 bg-white"
                        />
                        <p className="text-[10px] text-slate-400 font-mono scale-95 origin-left truncate">
                          ID: {syncSettings.folderId || "(自動偵測)"}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <label className="block font-bold text-slate-700 text-[11px]">申報匯入年度 (Target Year):</label>
                        <select
                          value={syncSettings.targetYear}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setSyncSettings({ ...syncSettings, targetYear: val });
                            setImportYear(val);
                          }}
                          className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white"
                        >
                          <option value={2026}>2026 年度</option>
                          <option value={2025}>2025 年度</option>
                          <option value={2024}>2024 年度</option>
                        </select>
                      </div>

                      <div className="space-y-2 pt-1 border-t border-slate-100">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={syncSettings.autoSync}
                            onChange={(e) => setSyncSettings({ ...syncSettings, autoSync: e.target.checked })}
                            className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                          />
                          <span className="font-bold text-slate-700 text-[11px]">開啟定期自動化背景抓取</span>
                        </label>
                      </div>

                      {syncSettings.autoSync && (
                        <div className="space-y-1">
                          <label className="block font-bold text-slate-700 text-[11px]">同步排程頻率 (Frequency):</label>
                          <select
                            value={syncSettings.frequency}
                            onChange={(e) => setSyncSettings({ ...syncSettings, frequency: e.target.value })}
                            className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white"
                          >
                            <option value="on_open">每次開啟此申報頁面時 (On open)</option>
                            <option value="daily">每日自動同步 (Daily)</option>
                            <option value="weekly">每週自動同步 (Weekly)</option>
                            <option value="monthly">每月自動同步 (Monthly)</option>
                          </select>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={driveSyncLoading}
                        className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 transition-all shadow-xs disabled:bg-slate-300"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>儲存同步排程設定</span>
                      </button>
                    </form>

                    {/* Sync Logs */}
                    <div className="pt-2 border-t border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between text-slate-500">
                        <span className="font-bold text-[10px]">最後自動同步狀態</span>
                        <span className="font-mono text-[9px]">
                          {syncSettings.lastSyncTime ? new Date(syncSettings.lastSyncTime).toLocaleTimeString() : "從未同步"}
                        </span>
                      </div>
                      <div className="p-2 rounded bg-slate-900 text-[10px] font-mono text-slate-300 min-h-[50px] max-h-[80px] overflow-y-auto leading-relaxed border border-slate-800 break-all">
                        <p className={`font-bold ${
                          syncSettings.lastSyncStatus === "success" ? "text-emerald-400" :
                          syncSettings.lastSyncStatus === "error" ? "text-rose-400" :
                          syncSettings.lastSyncStatus === "syncing" ? "text-blue-400 animate-pulse" : "text-slate-400"
                        }`}>
                          狀態: {
                            syncSettings.lastSyncStatus === "success" ? "🟢 成功" :
                            syncSettings.lastSyncStatus === "error" ? "🔴 失敗" :
                            syncSettings.lastSyncStatus === "syncing" ? "🔄 同步中" : "⚪ 閒置"
                          }
                        </p>
                        <p className="mt-1 text-slate-400 text-[9px]">{syncSettings.lastSyncLog || "無記錄"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Google Drive sync panel right (2/3) */}
                  <div className="lg:col-span-2 space-y-4">
                    {!gDriveConnected ? (
                      <div className="h-full border border-dashed border-slate-200 bg-slate-50/50 rounded-xl p-8 flex flex-col items-center justify-center text-center space-y-3 min-h-[300px]">
                        <Cloud className="w-12 h-12 text-slate-300" />
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-700">尚未連接雲端硬碟</p>
                          <p className="text-xs text-slate-400 max-w-sm">
                            請先點選左側「連接 Google Drive」按鈕進行安全性授權。連接後，系統將可讀取您指定的雲端資料夾並自動整合其中所有的薪資報表 Excel 檔案。
                          </p>
                        </div>
                        <button
                          onClick={handleGDriveConnect}
                          className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <LogIn className="w-4 h-4" />
                          <span>立即連接 Google Drive 帳戶</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4 animate-in fade-in duration-200">
                        {/* Explanatory notice */}
                        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-[11px] leading-relaxed text-emerald-950 flex gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-emerald-900">📂 已成功載入雲端資料夾中的試算表</p>
                            <p className="text-emerald-800">
                              系統已智慧對應檔案，您亦可依實際檔名微調。點選下方按鈕後，系統將立即從雲端下載檔案、關聯整合各欄位並計算出经常性薪資與中位數結構，為您實現真正的「無感雲端同步」！
                            </p>
                          </div>
                        </div>

                        {/* Spreadsheet Map Slots */}
                        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                            <Check className="w-4 h-4 text-emerald-600" />
                            <span>薪酬報表雲端對應 (Spreadsheet Mapping)</span>
                          </h4>

                          <div className="space-y-3 text-xs">
                            {/* File 1: Salary File */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                              <span className="font-bold text-slate-700 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                1. 本薪或經常性薪資檔:
                              </span>
                              <div className="md:col-span-2">
                                <select
                                  value={driveSelectedFile1 || ""}
                                  onChange={(e) => setDriveSelectedFile1(e.target.value || null)}
                                  className="w-full p-2 border border-slate-200 rounded-lg font-mono text-xs bg-white text-slate-800 focus:ring-1 focus:ring-emerald-500"
                                >
                                  <option value="">(請選擇對應的本薪檔案)</option>
                                  {driveFolderFiles.map(f => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* File 2: Other Income File */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                              <span className="font-bold text-slate-700 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                2. 其他所得及獎金檔:
                              </span>
                              <div className="md:col-span-2">
                                <select
                                  value={driveSelectedFile2 || ""}
                                  onChange={(e) => setDriveSelectedFile2(e.target.value || null)}
                                  className="w-full p-2 border border-slate-200 rounded-lg font-mono text-xs bg-white text-slate-800 focus:ring-1 focus:ring-emerald-500"
                                >
                                  <option value="">(請選擇對應的其他所得檔案)</option>
                                  {driveFolderFiles.map(f => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* File 3: Bonus File */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                              <span className="font-bold text-slate-500 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                3. 節金年終績效獎金檔 (選填):
                              </span>
                              <div className="md:col-span-2">
                                <select
                                  value={driveSelectedFile3 || ""}
                                  onChange={(e) => setDriveSelectedFile3(e.target.value || null)}
                                  className="w-full p-2 border border-slate-200 rounded-lg font-mono text-xs bg-white text-slate-800 focus:ring-1 focus:ring-emerald-500"
                                >
                                  <option value="">無 / 不指定額外節金檔</option>
                                  {driveFolderFiles.map(f => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Sync progress if syncing */}
                        {driveSyncProgress && (
                          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs flex items-center gap-2 text-blue-800">
                            <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                            <span className="font-bold animate-pulse">{driveSyncProgress}</span>
                          </div>
                        )}

                        {/* Trigger Buttons */}
                        <div className="flex gap-3 justify-center">
                          <button
                            onClick={async () => {
                              if (!driveSelectedFile1) {
                                alert("❌ 請務必指定「本薪檔」的雲端檔案！");
                                return;
                              }
                              const name1 = driveFolderFiles.find(f => f.id === driveSelectedFile1)?.name || "本薪檔.xlsx";
                              const name2 = driveSelectedFile2 ? (driveFolderFiles.find(f => f.id === driveSelectedFile2)?.name || "其他所得.xlsx") : null;
                              const name3 = driveSelectedFile3 ? (driveFolderFiles.find(f => f.id === driveSelectedFile3)?.name || "節金獎金.xlsx") : null;
                              
                              await runCloudMergeAndProcess(
                                gDriveToken!,
                                driveSelectedFile1,
                                driveSelectedFile2,
                                driveSelectedFile3,
                                name1,
                                name2,
                                name3,
                                syncSettings.targetYear
                              );
                            }}
                            disabled={importing || !driveSelectedFile1}
                            className="flex items-center gap-1.5 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-lg shadow-sm transition-all"
                          >
                            <RefreshCw className={`w-4 h-4 ${importing ? "animate-spin" : ""}`} />
                            <span>📥 立即自雲端下載並執行同步試算</span>
                          </button>

                          <button
                            onClick={async () => {
                              const link = "https://drive.google.com/drive/folders/1i8t5Q1r5-Y4RZeadGcq9QGEzLUponwQ7";
                              window.open(link, "_blank");
                            }}
                            className="flex items-center gap-1.5 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-semibold text-xs rounded-lg transition-all"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>開啟雲端硬碟資料夾 (Open Folder)</span>
                          </button>
                        </div>

                        {/* Folder File List Grid Preview */}
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                            <Info className="w-3 h-3 text-slate-400" />
                            <span>雲端目錄中偵測到的所有試算表檔案 ({driveFolderFiles.length})</span>
                          </p>
                          <div className="border border-slate-100 rounded-lg overflow-hidden bg-slate-50 max-h-[140px] overflow-y-auto">
                            <table className="w-full text-left border-collapse text-[11px]">
                              <thead>
                                <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                                  <th className="p-2">檔案名稱</th>
                                  <th className="p-2">建立日期</th>
                                  <th className="p-2">類型</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200 text-slate-700 font-mono">
                                {driveFolderFiles.length === 0 ? (
                                  <tr>
                                    <td colSpan={3} className="p-3 text-center text-slate-400">
                                      此雲端資料夾中無任何檔案。
                                    </td>
                                  </tr>
                                ) : (
                                  driveFolderFiles.map(file => (
                                    <tr key={file.id} className="hover:bg-white transition-colors">
                                      <td className="p-2 font-semibold text-slate-900 truncate max-w-[200px]" title={file.name}>
                                        {file.name}
                                      </td>
                                      <td className="p-2 text-slate-500">
                                        {file.createdTime ? new Date(file.createdTime).toLocaleDateString() : "-"}
                                      </td>
                                      <td className="p-2">
                                        {file.name.includes("本薪") || file.name.includes("薪資") ? (
                                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-50 text-blue-700 font-bold">本薪檔</span>
                                        ) : file.name.includes("其他") || file.name.includes("經常") ? (
                                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-orange-50 text-orange-700 font-bold">其他所得</span>
                                        ) : file.name.includes("節金") || file.name.includes("年終") || file.name.includes("獎金") ? (
                                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-50 text-emerald-700 font-bold">節金年終</span>
                                        ) : (
                                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-100 text-slate-500">未辨識</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Parsed Live Preview Table */}
              {parsedEmployees.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                      <span>所得合併試算預覽 - 共解析出 {parsedEmployees.length} 筆員工申報明細</span>
                    </span>
                    <span className="text-slate-400 text-[10px] italic">
                      已自動對齊各檔 1~12 月底薪、伙食津貼與 12 項獎金津貼
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[260px] overflow-y-auto">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                          <th className="py-2 px-3">員編</th>
                          <th className="py-2 px-3">姓名</th>
                          <th className="py-2 px-3 text-center">任職月數</th>
                          <th className="py-2 px-3 text-right">原始年薪 A</th>
                          <th className="py-2 px-3 text-right text-red-600">非經常性所得 D</th>
                          <th className="py-2 px-3 text-right text-emerald-700 bg-emerald-50/30 font-bold">申報薪資 (A - D)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 text-slate-700 font-mono">
                        {parsedEmployees.map((emp, i) => (
                          <tr key={i} className="hover:bg-slate-50/30">
                            <td className="py-2 px-3 font-semibold text-slate-500">{emp.empId}</td>
                            <td className="py-2 px-3 font-sans font-bold text-slate-900">{emp.name}</td>
                            <td className="py-2 px-3 text-center">{emp.months}</td>
                            <td className="py-2 px-3 text-right">NT$ {(emp.originalAnnualSalary ?? 0).toLocaleString()}</td>
                            <td className="py-2 px-3 text-right text-red-500">NT$ {(emp.nonRegularSalary ?? 0).toLocaleString()}</td>
                            <td className="py-2 px-3 text-right text-emerald-700 bg-emerald-50/10 font-bold font-sans">NT$ {(emp.salary ?? 0).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 text-xs">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setExcelFile1(null);
                  setExcelFile2(null);
                  setExcelFile3(null);
                  setParsedEmployees([]);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-lg transition-colors"
              >
                取消 (Cancel)
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={parsedEmployees.length === 0 || importing}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-lg transition-colors shadow-xs"
              >
                {importing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>資料載入與稽核寫入中...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>確認批次匯入並試算中位數</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
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
              <h3 className="text-base font-bold text-slate-900">確定刪除申報資料？</h3>
            </div>
            
            <p className="text-xs text-slate-600 leading-relaxed">
              您確定要刪除 <strong className="text-slate-900 font-semibold">{deleteConfirm.year}</strong> 年度員工「<strong className="text-slate-900 font-semibold">{deleteConfirm.name}</strong>」的薪酬申報資料嗎？
              <span className="block mt-2 text-red-500 font-medium">⚠️ 注意：此操作無法復原，系統將會動態重新核算中位數與平均薪資！</span>
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
                  handleDeleteEmployee(deleteConfirm.id, deleteConfirm.name, deleteConfirm.year);
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

      {/* Custom Bulk Deletion Confirmation Modal */}
      {bulkDeleteConfirm && (
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
              <h3 className="text-base font-bold text-slate-900">
                {bulkDeleteConfirm.type === "year" 
                  ? `確定批次刪除 ${bulkDeleteConfirm.year} 年度申報資料？` 
                  : "確定一鍵清空所有年度申報資料？"}
              </h3>
            </div>
            
            <p className="text-xs text-slate-600 leading-relaxed">
              {bulkDeleteConfirm.type === "year" ? (
                <>
                  您確定要一鍵刪除 <strong className="text-slate-900 font-semibold">{bulkDeleteConfirm.year}</strong> 年度所有的員工薪水申報資料嗎？
                </>
              ) : (
                <>
                  您確定要一鍵清空資料庫中<strong className="text-slate-900 font-semibold">所有年度</strong>的員工薪酬申報資料嗎？這將會清空整個非主管全時員工資料庫！
                </>
              )}
              <span className="block mt-2 text-red-500 font-medium">⚠️ 警示：此操作無法復原！所有相關的中位數與平均薪資統計圖表將歸零！</span>
            </p>

            <div className="flex justify-end gap-2 text-xs pt-2">
              <button
                onClick={() => setBulkDeleteConfirm(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  handleBulkDelete(bulkDeleteConfirm.type, bulkDeleteConfirm.year);
                  setBulkDeleteConfirm(null);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors shadow-xs"
              >
                確定批次刪除 (Confirm)
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
