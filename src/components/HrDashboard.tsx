import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Users, 
  UserPlus, 
  Settings, 
  FileCheck, 
  Building2, 
  Mail, 
  Calendar, 
  CheckCircle, 
  Search, 
  Trash2, 
  Plus, 
  Eye, 
  Send, 
  LogOut, 
  ArrowRight,
  ShieldAlert,
  KeyRound,
  Download,
  AlertCircle,
  Printer,
  RotateCcw,
  History,
  ArrowRightLeft,
  UserCog
} from 'lucide-react';
import { Employee } from '../types';
import LdcLogo from './LdcLogo';
import { getCompanyDetails } from './EmployeeDashboard';
import { TaxDeclarationPrintModal, ContractPrintModal, ConsentPrintModal, GuarantorPrintModal, ServicePrintModal } from './PrintModals';
import * as XLSX from 'xlsx';
import { 
  initGoogleAuth, 
  googleSignIn, 
  logoutGoogle, 
  sendGmailEmail 
} from '../lib/googleAuth';


interface HrDashboardProps {

  currentUser: { email: string; name: string 
  activeMenu?: 'tracker' | 'add' | 'admins' | 'logs';
  setActiveMenu?: (menu: 'tracker' | 'add' | 'admins' | 'logs') => void;
};
  initialEmployees: Employee[];
  onLogout: () => void;
  activeMenu?: 'tracker' | 'add' | 'admins' | 'logs';
  setActiveMenu?: (menu: 'tracker' | 'add' | 'admins' | 'logs') => void;
  hideNavigation?: boolean;
}

const BRANCHES = [
  { name: '總公司', address: '台北市中山區中山北路二段96號8樓' },
];

const PERMISSION_OPTIONS = [
  {
    id: 'admin',
    label: '管理權限',
    desc: 'HR 帳號管理、管理權限新增與註銷、HR 全功能安全設定'
  },
  {
    id: 'tracker',
    label: '同仁追蹤',
    desc: '檢閱、列印、匯出新進同仁所有個資、學經歷及同意合約 PDF'
  },
  {
    id: 'publish',
    label: '人員發佈',
    desc: '建立與發佈新進人員、核定新入職館別地點及合約薪資參數'
  },

  {
    id: 'audit',
    label: '資安稽核',
    desc: '完整檢閱與匯出系統操作軌跡歷程 / 稽核日誌 (Audit Log)'
  }
];

export default function HrDashboard({ currentUser, initialEmployees, onLogout, activeMenu: controlledActiveMenu, setActiveMenu: setControlledActiveMenu, hideNavigation }: HrDashboardProps) {
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [adminEmails, setAdminEmails] = useState<any[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(['tracker', 'publish']);
  const [submitting, setSubmitting] = useState(false);
  const [internalActiveMenu, setInternalActiveMenu] = useState<'tracker' | 'add' | 'admins' | 'logs'>('tracker');
  const activeMenu = controlledActiveMenu || internalActiveMenu;
  const setActiveMenu = setControlledActiveMenu || setInternalActiveMenu;
  const [adminsSubMenu, setAdminsSubMenu] = useState<'members' | 'add' | 'password' | 'transfer'>('members');
  const [addSubMenu, setAddSubMenu] = useState<'basic' | 'contract' | 'send_email'>('basic');
  const [expandedAdminEmails, setExpandedAdminEmails] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Google Gmail OAuth states
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isGoogleConnecting, setIsGoogleConnecting] = useState(false);
  
  // Track selected branch index for the dropdown
  const [selectedBranchIdx, setSelectedBranchIdx] = useState(0);

  // New employee form
  const [newEmp, setNewEmp] = useState({
    name: '',
    empId: '',
    email: '',
    authToken: '',
    department: '雲朗觀光股份有限公司',
    title: '',
    onboardDate: new Date().toISOString().split('T')[0],
    contractWorkLocation: '總公司 (台北市中山區中山北路二段96號8樓)',
    contractLeaveOption: 'biweekly',
    contractLeavedays: '8',
    contractSalaryType: 'monthly',
    contractSalaryAmount: '36,000',
    contractProbationMonths: '三'
  });
  
  // New Admin email
  const [newAdminEmail, setNewAdminEmail] = useState('');

  // Password change states
  const [oldPassword, setOldPassword] = useState('');
  const [newPasswordValue, setNewPasswordValue] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [pwSubmitting, setPwSubmitting] = useState(false);

  // Transfer primary admin states
  const [transferTargetEmail, setTransferTargetEmail] = useState('');
  const [transferConfirmCheckbox, setTransferConfirmCheckbox] = useState(false);
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  
  // Selected employee detail panel
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);

  // States for deleting administrator safely (Custom confirmation dialog)
  const [adminToDelete, setAdminToDelete] = useState<string | null>(null);
  const [isDeletingAdmin, setIsDeletingAdmin] = useState(false);

  // States for deleting employee safely (Custom confirmation dialog)
  const [employeeToDelete, setEmployeeToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // States for returning/rejecting employee onboarding to fill/draft state safely
  const [employeeToReject, setEmployeeToReject] = useState<Employee | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);

  // State for email preview modal
  const [emailPreviewEmp, setEmailPreviewEmp] = useState<Employee | null>(null);

  // States for printing custom employee cards (Compiled personnel record card)
  const [printingEmp, setPrintingEmp] = useState<Employee | null>(null);
  const [printFields, setPrintFields] = useState<any>(null);
  const [printTaxEmp, setPrintTaxEmp] = useState<Employee | null>(null);
  const [printContractEmp, setPrintContractEmp] = useState<Employee | null>(null);
  const [printConsentEmp, setPrintConsentEmp] = useState<Employee | null>(null);
  const [printGuarantorEmp, setPrintGuarantorEmp] = useState<Employee | null>(null);
  const [printServiceEmp, setPrintServiceEmp] = useState<Employee | null>(null);

  // Status logs
  const [infoMsg, setInfoMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Find dynamic primary admin email
  const primaryAdminObj = adminEmails.find(a => a.isPrimary);
  const primaryAdminEmail = (primaryAdminObj?.email || 'gordon.huang@ldchotels.com').toLowerCase().trim();

  // Find current user's permissions
  const currentAdminObj = adminEmails.find(
    admin => {
      const email = typeof admin === 'string' ? admin : (admin.email || '');
      return email.toLowerCase().trim() === currentUser.email.toLowerCase().trim();
    }
  );
  const currentUserPermissions = currentAdminObj?.permissions || (
    currentUser.email.toLowerCase().trim() === primaryAdminEmail
      ? ['admin', 'tracker', 'publish', 'ai', 'audit'] 
      : ['tracker', 'publish', 'ai']
  );
  const hasAdminPermission = currentUserPermissions.includes('admin');

  // Activity logs states
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);



  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [editingEmailValue, setEditingEmailValue] = useState('');

  const handleSendOnboardingEmail = async (emp: any) => {
    setSendingEmailId(emp.id);
    try {
      const res = await fetch(`/api/hr/employees/${emp.id}/send-onboarding-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-operator-email': encodeURIComponent(currentUser?.email || ''),
          'x-operator-name': encodeURIComponent(currentUser?.name || currentUser?.email || '')
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '發送報到通知信失敗');
      
      setInfoMsg(`📧 ${data.message || `成功發送報到通知信至 ${emp.name} 的信箱 (${emp.email})`}`);
      
      fetch('/api/hr/activity-logs')
        .then(r => r.json())
        .then(logs => setActivityLogs(logs))
        .catch(() => {});
    } catch (err: any) {
      setErrorMsg(err.message || '連線異常，發送失敗');
    } finally {
      setSendingEmailId(null);
      setEmailPreviewEmp(null);
    }
  };

  const fetchActivityLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await fetch('/api/hr/activity-logs');
      const data = await res.json();
      if (res.ok) setActivityLogs(data);
    } catch (e) {
      console.error('Error fetching activity logs', e);
    } finally {
      setLogsLoading(false);
    }
  };

  const downloadLogsExcel = () => {
    if (activityLogs.length === 0) {
      alert('目前尚無異動紀錄可供下載！');
      return;
    }

    // 轉換格式使 Excel 的欄位更容易閱讀
    const dataToExport = activityLogs.map(log => {
      const displayDate = new Date(log.timestamp).toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });

      let actionText = log.actionType;
      if (log.actionType === 'CREATE_EMPLOYEE') {
        actionText = '建立報到工作';
      } else if (log.actionType === 'DELETE_EMPLOYEE') {
        actionText = '刪除同仁資料';
      } else if (log.actionType === 'REJECT_ONBOARDING') {
        actionText = '退回報到修改';
      } else if (log.actionType === 'UPDATE_EMP_ID') {
        actionText = '變更員工編號';
      } else if (log.actionType === 'ADD_ADMIN') {
        actionText = '新增管理人員';
      }

      return {
        '日期與時間': displayDate,
        '操作管理者 (HR) 電子郵件': log.operatorEmail || '',
        '操作管理者 (HR) 姓名': log.operatorName || '系統管理員',
        '人員': log.employeeName || '總體項目',
        '異動項目': actionText,
        '詳細異動紀錄': log.details || ''
      };
    });

    // 建立工作表
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);

    // 設定欄寬
    const colWidths = [
      { wch: 22 }, // 日期與時間
      { wch: 28 }, // HR Email
      { wch: 20 }, // HR 姓名
      { wch: 15 }, // 關係同仁
      { wch: 18 }, // 異動項目
      { wch: 55 }  // 詳細異動紀錄
    ];
    worksheet['!cols'] = colWidths;

    // 建立活頁簿
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '異動紀錄追蹤');

    // 下載檔案
    const filename = `LDC_HR_Activity_Logs_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  // Initialize Google Auth on mount
  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      }
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleGoogleSignIn = async () => {
    setIsGoogleConnecting(true);
    setErrorMsg('');
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setGoogleToken(result.accessToken);
        setInfoMsg('🟢 成功連結 Google 帳號！您現在可以發送 Gmail 報到通知信。');
      }
    } catch (err: any) {
      console.warn('Google sign-in cancelled or failed:', err);
      if (err?.code === 'auth/popup-closed-by-user' || err?.message?.includes('popup-closed-by-user')) {
        setErrorMsg('⚠️ 您關閉了 Google 登入視窗，已取消連結。若欲發送 Gmail 通知信，請重新點擊並完成授權。');
      } else if (err?.code === 'auth/cancelled-popup-request' || err?.message?.includes('cancelled-popup-request')) {
        setErrorMsg('⚠️ 登入視窗已取消，請重新點擊並進行 Google 帳號連結。');
      } else {
        setErrorMsg(`連結 Google 帳號失敗：${err.message || '未知錯誤'}`);
      }
    } finally {
      setIsGoogleConnecting(false);
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await logoutGoogle();
      setGoogleUser(null);
      setGoogleToken(null);
      setInfoMsg('已登出 Google 帳號。');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`登出 Google 帳號失敗：${err.message || '未知錯誤'}`);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchAdmins();
    fetchActivityLogs();
  }, []);

  useEffect(() => {
    setIsEditingEmail(false);
    setEditingEmailValue(selectedEmp?.email || '');
  }, [selectedEmp?.id]);

  // Map employee details to print structures when printing selected employee
  useEffect(() => {
    if (printingEmp) {
      const p = printingEmp.personalData || {};
      const c = printingEmp.careerData || {};
      
      const experiencesArray = c.experiences || [];
      const educationsArray = c.educations || [];
      const licensesArray = c.licenses || [];
      
      const langLevels = {
        english: 'none', // Default mid
        japanese: 'none',
        korean: 'none',
        otherName: '',
        otherLevel: 'none'
      };

      if (c.languages && c.languages.length > 0) {
        c.languages.forEach((lang: any) => {
          const lMapped = lang.level === '精通' ? 'expert' 
                         : lang.level === '優良' ? 'good' 
                         : lang.level === '中等' ? 'medium' 
                         : lang.level === '略懂' ? 'fluent' 
                         : 'none';
          
          if (lang.language === '英文') {
            langLevels.english = lMapped;
          } else if (lang.language === '日文') {
            langLevels.japanese = lMapped;
          } else if (lang.language === '韓文') {
            langLevels.korean = lMapped;
          } else if (lang.language === '其他') {
            langLevels.otherLevel = lMapped;
            langLevels.otherName = lang.customName || '';
          }
        });
      }

      const allDeps = [
        ...(p.dependents || []),
        ...(printingEmp.taxDeclaration?.dependents || [])
      ];
      
      const father = allDeps.find(d => d.relationship === '父' || d.relationship === '父親') || { name: '', birthday: '' };
      const mother = allDeps.find(d => d.relationship === '母' || d.relationship === '母親') || { name: '', birthday: '' };
      
      const spouseName = printingEmp.taxDeclaration?.spouseName || '';
      const spouseBirthday = printingEmp.taxDeclaration?.spouseBirthday || '';
      const spouse = (spouseName || spouseBirthday) 
        ? { name: spouseName, birthday: spouseBirthday } 
        : allDeps.find(d => d.relationship === '配偶' || d.relationship === '妻' || d.relationship === '夫') || { name: '', birthday: '' };

      setPrintFields({
        empId: printingEmp.empId || '',
        branchName: printingEmp.contractWorkLocation ? printingEmp.contractWorkLocation.split(' (')[0] : (printingEmp.department ? printingEmp.department : ''),
        onboardDate: printingEmp.onboardDate || '',
        name: p.name || printingEmp.name || '',
        gender: p.gender || '',
        birthday: p.birthday || '',
        phone: p.phone || '',
        bloodType: p.bloodType || '',
        idNumber: p.idNumber || '',
        legalAddress: p.legalAddress || '',
        contactAddress: p.contactAddress || '',
        guarantorName: p.emergencyName || '',
        guarantorAddress: p.legalAddress || '',
        guarantorPhone: p.emergencyPhone || '',
        
        experiences: [
          { period: experiencesArray[0] ? `${experiencesArray[0].startDate} ~ ${experiencesArray[0].endDate}` : '', company: experiencesArray[0]?.companyName || '', title: experiencesArray[0]?.jobTitle || '' },
          { period: experiencesArray[1] ? `${experiencesArray[1].startDate} ~ ${experiencesArray[1].endDate}` : '', company: experiencesArray[1]?.companyName || '', title: experiencesArray[1]?.jobTitle || '' },
          { period: experiencesArray[2] ? `${experiencesArray[2].startDate} ~ ${experiencesArray[2].endDate}` : '', company: experiencesArray[2]?.companyName || '', title: experiencesArray[2]?.jobTitle || '' },
        ],
        
        licenses: [
          { time: licensesArray[0]?.issueDate || '', cate: licensesArray[0]?.licenseName || '', level: licensesArray[0]?.badgeLevel || '' },
          { time: licensesArray[1]?.issueDate || '', cate: licensesArray[1]?.licenseName || '', level: licensesArray[1]?.badgeLevel || '' },
          { time: licensesArray[2]?.issueDate || '', cate: licensesArray[2]?.licenseName || '', level: licensesArray[2]?.badgeLevel || '' },
        ],

        educations: [
          { school: educationsArray[0]?.schoolName || '', major: educationsArray[0]?.major || '', period: educationsArray[0]?.period || '', status: educationsArray[0]?.status || '' },
          { school: educationsArray[1]?.schoolName || '', major: educationsArray[1]?.major || '', period: educationsArray[1]?.period || '', status: educationsArray[1]?.status || '' },
          { school: educationsArray[2]?.schoolName || '', major: educationsArray[2]?.major || '', period: educationsArray[2]?.period || '', status: educationsArray[2]?.status || '' },
        ],
        
        langLevels,
        
        family: [
          { relation: '父', name: father.name || '', birthday: father.birthday || '', edu: '', company: '', coLive: '', note: '' },
          { relation: '母', name: mother.name || '', birthday: mother.birthday || '', edu: '', company: '', coLive: '', note: '' },
          { relation: '配偶', name: spouse.name || '', birthday: spouse.birthday || '', edu: '', company: '', coLive: '', note: '' }
        ]
      });
    } else {
      setPrintFields(null);
    }
  }, [printingEmp]);

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/hr/employees');
      const data = await res.json();
      if (res.ok) setEmployees(data);
    } catch {
      console.log('Error catching latest list');
    }
  };

  const handleUpdateEmpId = async (id: string, empId: string) => {
    try {
      const res = await fetch(`/api/hr/employees/${id}/empid`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-operator-email': encodeURIComponent(currentUser?.email || ''),
          'x-operator-name': encodeURIComponent(currentUser?.name || '')
        },
        body: JSON.stringify({ empId })
      });
      const data = await res.json();
      if (res.ok) {
        setEmployees(data.employees);
        if (selectedEmp && selectedEmp.id === id) {
          setSelectedEmp(data.employee);
        }
        fetchActivityLogs();
      }
    } catch (e) {
      console.error('Failed to update employee ID', e);
    }
  };

  const handleUpdateEmail = async (id: string, emailValue: string) => {
    try {
      setErrorMsg('');
      setInfoMsg('');
      const res = await fetch(`/api/hr/employees/${id}/email`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-operator-email': encodeURIComponent(currentUser?.email || ''),
          'x-operator-name': encodeURIComponent(currentUser?.name || '')
        },
        body: JSON.stringify({ email: emailValue })
      });
      const data = await res.json();
      if (res.ok) {
        setEmployees(data.employees);
        if (selectedEmp && selectedEmp.id === id) {
          setSelectedEmp(data.employee);
        }
        fetchActivityLogs();
        setInfoMsg(`📧 成功修改同仁電子郵件地址為: ${emailValue}`);
      } else {
        setErrorMsg(data.error || '更新電子郵件失敗');
      }
    } catch (e) {
      console.error('Failed to update employee email', e);
      setErrorMsg('連線伺服器失敗，請稍後再試');
    }
  };

  const handleUpdateProbation = async (id: string, probationValue: string) => {
    try {
      const res = await fetch(`/api/hr/employees/${id}/probation`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-operator-email': encodeURIComponent(currentUser?.email || ''),
          'x-operator-name': encodeURIComponent(currentUser?.name || '')
        },
        body: JSON.stringify({ contractProbationMonths: probationValue })
      });
      const data = await res.json();
      if (res.ok) {
        setEmployees(data.employees);
        if (selectedEmp && selectedEmp.id === id) {
          setSelectedEmp(data.employee);
        }
        fetchActivityLogs();
      }
    } catch (e) {
      console.error('Failed to update contract probation months', e);
    }
  };

  const handleUpdateOnboardingProgress = async (id: string, payload: any) => {
    try {
      setErrorMsg('');
      setInfoMsg('');
      const res = await fetch(`/api/hr/employees/${id}/onboarding-progress`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-operator-email': encodeURIComponent(currentUser?.email || ''),
          'x-operator-name': encodeURIComponent(currentUser?.name || '')
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setEmployees(data.employees);
        if (selectedEmp && selectedEmp.id === id) {
          setSelectedEmp(data.employee);
        }
        fetchActivityLogs();
        setInfoMsg(`已成功手動更新「${data.employee.name}」的報到關卡進度與狀態！`);
      } else {
        setErrorMsg(data.error || '更新失敗');
      }
    } catch (e: any) {
      console.error('Failed to update onboarding progress', e);
      setErrorMsg('連線伺服器失敗，請稍後再試');
    }
  };

  const fetchAdmins = async () => {
    try {
      const res = await fetch('/api/hr/admins');
      const data = await res.json();
      if (res.ok) setAdminEmails(data);
    } catch {
      console.log('Error fetching admins');
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    
    if (!newEmp.name || !newEmp.email || !newEmp.authToken || !newEmp.title) {
      setErrorMsg('⚠️ 請確保填滿所有必填星號欄位');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/hr/employees', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-operator-email': encodeURIComponent(currentUser?.email || ''),
          'x-operator-name': encodeURIComponent(currentUser?.name || '')
        },
        body: JSON.stringify(newEmp)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '新增失敗');

      setEmployees(data.employees);
      fetchActivityLogs();
      setInfoMsg(`🎉 成功新增新進同仁「${newEmp.name}」。已產生報到卡檔案，授權碼：${newEmp.authToken}`);
      
      // Clear
      setNewEmp({
        name: '',
        empId: '',
        email: '',
        authToken: '',
        department: '雲朗觀光股份有限公司',
        title: '',
        onboardDate: new Date().toISOString().split('T')[0],
        contractWorkLocation: '總公司 (台北市中山區中山北路二段96號8樓)',
        contractLeaveOption: 'biweekly',
        contractLeavedays: '8',
        contractSalaryType: 'monthly',
        contractSalaryAmount: '36,000',
        contractProbationMonths: '三'
      });
      setSelectedBranchIdx(0);
      setAddSubMenu('basic');
      setActiveMenu('tracker');
    } catch (err: any) {
      setErrorMsg(err.message || '新增失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAndSendEmail = async () => {
    setErrorMsg('');
    setInfoMsg('');

    if (!newEmp.name || !newEmp.email || !newEmp.authToken || !newEmp.title) {
      setErrorMsg('⚠️ 欄位未填寫完整，請核對步驟一與步驟二');
      return;
    }

    setSubmitting(true);
    try {
      // Step 1: Create employee
      const res = await fetch('/api/hr/employees', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-operator-email': encodeURIComponent(currentUser?.email || ''),
          'x-operator-name': encodeURIComponent(currentUser?.name || '')
        },
        body: JSON.stringify(newEmp)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '建立報到卡失敗');
      
      const createdId = data.employee.id;

      // Step 2: Send onboarding email via backend API
      const mailRes = await fetch(`/api/hr/employees/${createdId}/send-onboarding-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-operator-email': encodeURIComponent(currentUser?.email || ''),
          'x-operator-name': encodeURIComponent(currentUser?.name || currentUser?.email || '')
        }
      });
      
      const mailData = await mailRes.json();
      if (!mailRes.ok) throw new Error(mailData.error || '報到通知信發送失敗');

      setInfoMsg(`📧 ${mailData.message || `已成功建立報到卡並發送通知信至 ${newEmp.email}`}`);
      
      fetchEmployees();
      fetchActivityLogs();

      // Clear newEmp form
      setNewEmp({
        name: '',
        empId: '',
        email: '',
        authToken: '',
        department: '雲朗觀光股份有限公司',
        title: '',
        onboardDate: new Date().toISOString().split('T')[0],
        contractWorkLocation: '總公司 (台北市中山區中山北路二段96號8樓)',
        contractLeaveOption: 'biweekly',
        contractLeavedays: '8',
        contractSalaryType: 'monthly',
        contractSalaryAmount: '36,000',
        contractProbationMonths: '三'
      });
      setSelectedBranchIdx(0);
      setAddSubMenu('basic');
      setActiveMenu('tracker');
    } catch (err: any) {
      setErrorMsg(err.message || '連線異常，無法完成建立與發送');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (id: string, name: string) => {
    setEmployeeToDelete({ id, name });
  };

  const handleExportToExcel = (emp: Employee) => {
    if (!emp) return;

    const fileName = `${emp.name}_新進同仁人事暨報到資料.xls`;
    
    // Extract and format data
    const p = (emp.personalData || {}) as any;
    const career = (emp.careerData || {}) as any;
    const experiences = career.experiences || [];
    const educations = career.educations || [];
    const licenses = career.licenses || [];
    const tax = (emp.taxDeclaration || {}) as any;
    
    // Parse family information identical to printed card logic
    const allDeps = [
      ...(p.dependents || []),
      ...(tax.dependents || [])
    ];
    const father = allDeps.find(d => d.relationship === '父' || d.relationship === '父親') || { name: '', birthday: '' };
    const mother = allDeps.find(d => d.relationship === '母' || d.relationship === '母親') || { name: '', birthday: '' };
    const spouseName = tax.spouseName || '';
    const spouseBirthday = tax.spouseBirthday || '';
    const spouse = (spouseName || spouseBirthday) 
      ? { name: spouseName, birthday: spouseBirthday } 
      : allDeps.find(d => d.relationship === '配偶' || d.relationship === '妻' || d.relationship === '夫') || { name: '', birthday: '' };

    const familyList = [
      { relation: '父', name: father.name || '', birthday: father.birthday || '' },
      { relation: '母', name: mother.name || '', birthday: mother.birthday || '' },
      { relation: '配偶', name: spouse.name || '', birthday: spouse.birthday || '' }
    ];
    
    // Build Excel structured HTML Table String (Office HTML Spreadsheet format)
    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
        <style>
          table { border-collapse: collapse; width: 100%; font-family: "Microsoft JhengHei", "PMingLiU", "Segoe UI", Arial, sans-serif; }
          td, th { border: 1px solid #b3b3b3; padding: 8px; font-size: 12px; }
          .main-title { font-size: 16px; font-weight: bold; text-align: center; background-color: #8D1B1B; color: #D4AF37; padding: 12px; border: 1px solid #8D1B1B; }
          .section-title { font-size: 13px; font-weight: bold; background-color: #FAF6F0; color: #8D1B1B; border-bottom: 2px solid #8D1B1B; padding: 8px 12px; }
          .label { background-color: #FAF9F6; font-weight: bold; width: 130px; color: #1c1917; }
          .value { color: #2e2a24; }
          .sub-header { font-weight: bold; background-color: #FAF6F0; color: #1c1917; text-align: center; }
          .text-center { text-align: center; }
          .badge-completed { background-color: #d1fae5; color: #065f46; font-weight: bold; }
          .badge-pending { background-color: #fef3c7; color: #92400e; font-weight: bold; }
        </style>
      </head>
      <body>
        <table>
          <tr>
            <td colspan="4" class="main-title">${getCompanyDetails(emp).name} ─ 新進員工報到人事資料卡</td>
          </tr>
          <tr>
            <td colspan="4" class="section-title">一、員工報到進度與狀態</td>
          </tr>
          <tr>
            <td class="label">中文姓名：</td>
            <td class="value">${emp.name}</td>
            <td class="label">填答狀態：</td>
            <td class="value text-center ${emp.status === 'completed' ? 'badge-completed' : 'badge-pending'}">${emp.status === 'completed' ? '已完成 100%' : '填寫中 (' + emp.progress + '%)'}</td>
          </tr>
          <tr>
            <td class="label">所屬部門：</td>
            <td class="value">${emp.department || '無'}</td>
            <td class="label">職務職稱：</td>
            <td class="value">${emp.title || '無'}</td>
          </tr>
          <tr>
            <td class="label">預定入職日：</td>
            <td class="value">${emp.onboardDate || '無'}</td>
            <td class="label">最後更新日：</td>
            <td class="value">${emp.updatedAt ? new Date(emp.updatedAt).toLocaleString('zh-TW') : '無'}</td>
          </tr>
          
          <tr>
            <td colspan="4" class="section-title">二、個人基本資料 (填報項目)</td>
          </tr>
          <tr>
            <td class="label">身分證字號：</td>
            <td class="value font-mono" style="mso-number-format:'\\@';">${p.idNumber || '無'}</td>
            <td class="label">英文姓名：</td>
            <td class="value">${p.englishName || '無'}</td>
          </tr>
          <tr>
            <td class="label">性別：</td>
            <td class="value">${p.gender || '無'}</td>
            <td class="label">出生日期：</td>
            <td class="value font-mono">${p.birthday || '無'}</td>
          </tr>
          <tr>
            <td class="label">聯絡電話：</td>
            <td class="value font-mono" style="mso-number-format:'\\@';">${p.phone || '無'}</td>
            <td class="label">電子郵件：</td>
            <td class="value">${p.email || emp.email || '無'}</td>
          </tr>
          <tr>
            <td class="label">戶籍地址：</td>
            <td colspan="3" class="value">${p.legalAddress || '無'}</td>
          </tr>
          <tr>
            <td class="label">通訊地址：</td>
            <td colspan="3" class="value">${p.contactAddress || '無'}</td>
          </tr>
          
          <tr>
            <td colspan="4" class="section-title">三、薪資發放撥轉帳戶</td>
          </tr>
          <tr>
            <td class="label">入帳銀行：</td>
            <td class="value">${p.bankName || '無'}</td>
            <td class="label">撥轉帳號：</td>
            <td class="value font-mono" style="mso-number-format:'\\@';">${p.bankAccount || '無'}</td>
          </tr>
          <tr>
            <td class="label">扶養親屬人數：</td>
            <td colspan="3" class="value">${p.dependentsCount || '0 人'}</td>
          </tr>
          
          <tr>
            <td colspan="4" class="section-title">四、緊急聯絡人資訊</td>
          </tr>
          <tr>
            <td class="label">聯絡人姓名：</td>
            <td class="value">${p.emergencyName || '無'}</td>
            <td class="label">與同仁關係：</td>
            <td class="value">${p.emergencyRelationship || '無'}</td>
          </tr>
          <tr>
            <td class="label">聯絡人電話：</td>
            <td colspan="3" class="value font-mono" style="mso-number-format:'\\@';">${p.emergencyPhone || '無'}</td>
          </tr>
    `;

    // Add Educations Section
    html += `
          <tr>
            <td colspan="4" class="section-title">五、教育程度 (最高與過往學歷)</td>
          </tr>
    `;
    if (educations.length === 0) {
      html += `<tr><td colspan="4" class="text-center value">（未填寫學歷資料）</td></tr>`;
    } else {
      html += `
        <tr>
          <td colspan="4">
            <table style="width:100%; border-collapse: collapse;">
              <tr class="sub-header">
                <td>學校名稱</td>
                <td>科系名稱</td>
                <td>修業起訖期間</td>
                <td>修業狀態</td>
              </tr>
      `;
      educations.forEach((edu: any) => {
        html += `
              <tr>
                <td class="value">${edu.schoolName || ''}</td>
                <td class="value">${edu.major || '無'}</td>
                <td class="value text-center font-mono">${edu.period || ''}</td>
                <td class="value text-center">${edu.status || ''}</td>
              </tr>
        `;
      });
      html += `
            </table>
          </td>
        </tr>
      `;
    }

    // Add Experiences Section
    html += `
          <tr>
            <td colspan="4" class="section-title">六、過往服務經歷</td>
          </tr>
    `;
    if (experiences.length === 0) {
      html += `<tr><td colspan="4" class="text-center value">（無過往職工經歷資料）</td></tr>`;
    } else {
      html += `
        <tr>
          <td colspan="4">
            <table style="width:100%; border-collapse: collapse;">
              <tr class="sub-header">
                <td>職涯期間</td>
                <td>服務單位(公司名稱)</td>
                <td>曾任職稱與職務</td>
              </tr>
      `;
      experiences.forEach((exp: any) => {
        html += `
              <tr>
                <td class="value text-center font-mono">${exp.startDate || ''} ~ ${exp.endDate || '至今'}</td>
                <td class="value">${exp.companyName || ''}</td>
                <td class="value">${exp.jobTitle || ''}</td>
              </tr>
        `;
      });
      html += `
            </table>
          </td>
        </tr>
      `;
    }

    // Add Licenses Section
    html += `
          <tr>
            <td colspan="4" class="section-title">七、職業證照與技能訓練</td>
          </tr>
    `;
    if (licenses.length === 0) {
      html += `<tr><td colspan="4" class="text-center value">（無持有之專業證照或訓練資格）</td></tr>`;
    } else {
      html += `
        <tr>
          <td colspan="4">
            <table style="width:100%; border-collapse: collapse;">
              <tr class="sub-header">
                <td>獲證發照時間</td>
                <td>專業證照或技能名稱</td>
                <td>證照等級 / 級別</td>
              </tr>
      `;
      licenses.forEach((lic: any) => {
        html += `
              <tr>
                <td class="value text-center font-mono">${lic.issueDate || ''}</td>
                <td class="value">${lic.licenseName || ''}</td>
                <td class="value text-center">${lic.badgeLevel || '無'}</td>
              </tr>
        `;
      });
      html += `
            </table>
          </td>
        </tr>
      `;
    }

    // Add Family Section
    html += `
          <tr>
            <td colspan="4" class="section-title">八、家庭親屬狀況 (主要家屬資訊)</td>
          </tr>
          <tr>
            <td colspan="4">
              <table style="width:100%; border-collapse: collapse;">
                <tr class="sub-header">
                  <td style="width:20%;">親等稱謂</td>
                  <td style="width:40%;">家屬姓名</td>
                  <td style="width:40%;">出生年月日</td>
                </tr>
    `;
    familyList.forEach((fam: any) => {
      html += `
                <tr>
                  <td class="value text-center">${fam.relation}</td>
                  <td class="value">${fam.name || '（無填）'}</td>
                  <td class="value text-center font-mono">${fam.birthday || '（無填）'}</td>
                </tr>
      `;
    });
    html += `
              </table>
            </td>
          </tr>
    `;

    // Onboarding status checks
    html += `
          <tr>
            <td colspan="4" class="section-title">九、規程遵守、個資聲明與聘僱契約確認狀態</td>
          </tr>
          <tr>
            <td class="label">遵守公司工作規程：</td>
            <td class="value">${emp.rulesAgreed ? '✅ 已確實瞭解並承諾遵守' : '❌ 未勾選同意'}</td>
            <td class="label">同意個資蒐集利用：</td>
            <td class="value">${emp.privacyAgreed ? '✅ 已確實瞭解並簽署同意書' : '❌ 未勾選同意'}</td>
          </tr>
          <tr>
            <td class="label">扶養申報表聲明：</td>
            <td class="value">${tax.signed ? '✅ 已親自簽章申報完畢 (' + (tax.date || '') + ')' : '❌ 未完成稅額扣除申報'}</td>
            <td class="label">勞動聘僱合約書：</td>
            <td class="value">${emp.contractSigned ? '✅ 已確認簽認合約 (' + (emp.contractDate || '') + ')' : '❌ 合約書待確認中'}</td>
          </tr>
          <tr>
            <td class="label">合約配薪條件：</td>
            <td class="value">新台幣 ${emp.contractSalaryAmount || '36,000'} 元 / ${emp.contractSalaryType === 'daily' ? '日薪' : emp.contractSalaryType === 'hourly' ? '時薪' : '月薪'}</td>
            <td class="label">排班休假制度：</td>
            <td class="value">${emp.contractLeaveOption === 'monthly' ? `月排休 ${emp.contractLeavedays || '8-10'} 天` : '週休二日制'}</td>
          </tr>
          <tr>
            <td class="label">人事建檔時間：</td>
            <td colspan="3" class="value font-mono">${new Date().toLocaleString('zh-TW')}</td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // Trigger download of XLS file
    const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    const emailStr = newAdminEmail.trim().toLowerCase();
    if (!emailStr) return;

    try {
      const res = await fetch('/api/hr/admins', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-operator-email': encodeURIComponent(currentUser?.email || ''),
          'x-operator-name': encodeURIComponent(currentUser?.name || '')
        },
        body: JSON.stringify({ email: emailStr, permissions: selectedPermissions })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '新增失敗');

      setAdminEmails(data.hrAdmins);
      setInfoMsg(`🤝 成功授權「${emailStr}」管理員登入人資後台！`);
      setNewAdminEmail('');
      setSelectedPermissions(['tracker', 'publish']);
      fetchActivityLogs();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleDeleteAdmin = async (targetEmail: string) => {
    setErrorMsg('');
    setInfoMsg('');
    setIsDeletingAdmin(true);

    try {
      const res = await fetch('/api/hr/admins', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-operator-email': encodeURIComponent(currentUser?.email || ''),
          'x-operator-name': encodeURIComponent(currentUser?.name || '')
        },
        body: JSON.stringify({ email: targetEmail })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '註銷失敗');

      setAdminEmails(data.hrAdmins);
      setInfoMsg(`🗑️ 已成功註銷「${targetEmail}」的管理者帳號。`);
      fetchActivityLogs();
    } catch (err: any) {
      setErrorMsg(err.message || '註銷失敗');
    } finally {
      setIsDeletingAdmin(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    if (newPasswordValue !== confirmNewPassword) {
      setErrorMsg('⚠️ 新密碼與確認密碼不一致！');
      return;
    }

    if (newPasswordValue.length < 3) {
      setErrorMsg('⚠️ 新密碼長度至少需 3 個字元！');
      return;
    }

    setPwSubmitting(true);
    try {
      const res = await fetch('/api/hr/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-operator-email': encodeURIComponent(currentUser?.email || ''),
          'x-operator-name': encodeURIComponent(currentUser?.name || '')
        },
        body: JSON.stringify({
          email: currentUser?.email,
          oldPassword,
          newPassword: newPasswordValue
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '密碼變更失敗');
      }

      setInfoMsg('🔑 您的登入密碼變更成功！請牢記您設定的新密碼。');
      setOldPassword('');
      setNewPasswordValue('');
      setConfirmNewPassword('');
      fetchActivityLogs();
    } catch (err: any) {
      setErrorMsg(err.message || '變更失敗');
    } finally {
      setPwSubmitting(false);
    }
  };

  const handleTransferPrimary = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    if (!transferTargetEmail) {
      setErrorMsg('⚠️ 請選擇欲移轉的主要管理者承接者！');
      return;
    }

    if (!transferConfirmCheckbox) {
      setErrorMsg('⚠️ 請先勾選下方的安全移轉確認核取方塊！');
      return;
    }

    setTransferSubmitting(true);
    try {
      const res = await fetch('/api/hr/transfer-primary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-operator-email': encodeURIComponent(currentUser?.email || ''),
          'x-operator-name': encodeURIComponent(currentUser?.name || '')
        },
        body: JSON.stringify({
          targetEmail: transferTargetEmail
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '移轉主要管理者失敗');
      }

      setInfoMsg(data.message || '主要管理者權限已成功移轉！');
      
      // Update local admin list
      if (data.hrAdmins) {
        setAdminEmails(data.hrAdmins);
      }
      
      // Reset input state
      setTransferTargetEmail('');
      setTransferConfirmCheckbox(false);
      
      fetchActivityLogs();
    } catch (err: any) {
      setErrorMsg(err.message || '移轉失敗');
    } finally {
      setTransferSubmitting(false);
    }
  };



  const generateRandomToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let token = 'LDC';
    for (let i = 0; i < 4; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewEmp(prev => ({ ...prev, authToken: token }));
  };

  const filteredEmployees = employees.filter(emp => {
    const query = searchQuery.toLowerCase();
    return (
      emp.name.toLowerCase().includes(query) ||
      emp.email.toLowerCase().includes(query) ||
      emp.department.toLowerCase().includes(query) ||
      emp.title.toLowerCase().includes(query)
    );
  });

  const totalEmps = employees.length;
  const completedEmps = employees.filter(e => e.status === 'completed').length;
  const pendingEmps = totalEmps - completedEmps;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-stone-800">
      
      {/* 1. HR Header (Elegant burgundy bar) */}
      {!hideNavigation && (
      <nav className="hidden bg-[#343131] text-[#D4AF37] px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-20 shadow-md border-b border-[#D4AF37]/20 select-none">
        
        <div className="flex items-center gap-4">
          <LdcLogo size="header" color="nav-gold" className="bg-white/5 p-1 px-2 rounded-lg border border-[#D4AF37]/15 shadow-inner" />
          <div>
            <h1 className="text-base font-semibold text-white tracking-wide flex items-center gap-2">
              新進同仁入職報到後台
              <span className="text-[10px] bg-[#D4AF37]/20 border border-[#D4AF37]/40 px-2 py-0.5 rounded text-[#FAF6F0] font-normal uppercase tracking-widest leading-none">
                HR Admin Panel
              </span>
            </h1>
            <p className="text-xs text-stone-300">
              當前登入者：<span className="font-semibold text-[#D4AF37] underline">{currentUser.email}</span>
            </p>
          </div>
        </div>

        {/* Navigation options */}
        <div className="flex items-center flex-wrap gap-1 md:self-center">
          <button
            onClick={() => setActiveMenu('tracker')}
            className={`px-4 py-2 text-xs font-medium tracking-wide rounded-lg flex items-center gap-1.5 transition-all text-stone-100 ${
              activeMenu === 'tracker'
                ? 'bg-white/10 text-[#D4AF37] border-b-2 border-[#D4AF37] font-semibold'
                : 'hover:bg-white/5'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            新進同仁資料填寫追蹤 ({totalEmps})
          </button>
          <button
            onClick={() => setActiveMenu('add')}
            className={`px-4 py-2 text-xs font-medium tracking-wide rounded-lg flex items-center gap-1.5 transition-all text-stone-100 ${
              activeMenu === 'add'
                ? 'bg-white/10 text-[#D4AF37] border-b-2 border-[#D4AF37] font-semibold'
                : 'hover:bg-white/5'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            建立報到工作
          </button>
          <button
            onClick={() => setActiveMenu('admins')}
            className={`px-4 py-2 text-xs font-medium tracking-wide rounded-lg flex items-center gap-1.5 transition-all text-stone-100 ${
              activeMenu === 'admins'
                ? 'bg-white/10 text-[#D4AF37] border-b-2 border-[#D4AF37] font-semibold'
                : 'hover:bg-white/5'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            帳號管理
          </button>

          <button
            onClick={() => {
              setActiveMenu('logs');
              fetchActivityLogs();
            }}
            className={`px-4 py-2 text-xs font-medium tracking-wide rounded-lg flex items-center gap-1.5 transition-all text-stone-100 ${
              activeMenu === 'logs'
                ? 'bg-white/10 text-[#D4AF37] border-b-2 border-[#D4AF37] font-semibold'
                : 'hover:bg-white/5'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            異動紀錄追蹤
          </button>

          <div className="h-4 w-px bg-white/20 mx-1.5"></div>

          <button
            onClick={onLogout}
            className="px-3.5 py-1.5 hover:bg-stone-50/10 text-stone-100 hover:text-[#D4AF37] text-xs font-medium flex items-center gap-1.5 rounded-lg border border-transparent hover:border-[#D4AF37]/30 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            登出
          </button>
        </div>
      </nav>
      )}

      {/* 2. Bento Stats cards (Only shown for tracker dashboard inside office) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 space-y-6">
        
        {infoMsg && (
          <div className="bg-emerald-50 border border-emerald-100 text-[#075041] px-5 py-4 rounded-xl text-xs flex justify-between items-center shadow-sm">
            <span>✨ {infoMsg}</span>
            <button onClick={() => setInfoMsg('')} className="text-stone-400 hover:text-stone-600 font-semibold px-2">✕</button>
          </div>
        )}

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-150 text-rose-800 px-5 py-4 rounded-xl text-xs flex justify-between items-center shadow-sm">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg('')} className="text-stone-400 hover:text-stone-600 font-semibold px-2">✕</button>
          </div>
        )}

        {/* Metric Aggregates */}
        {activeMenu === 'tracker' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 select-none">
            <div className="bg-white border border-[#E9E1D6] p-5 rounded-2xl flex items-center justify-between hover:shadow-md transition-all">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block">報到人數總覽</span>
                <strong className="text-2xl text-[#8D1B1B]">{totalEmps}</strong>
              </div>
              <Users className="w-8 h-8 text-stone-300" />
            </div>
            <div className="bg-white border border-[#E9E1D6] p-5 rounded-2xl flex items-center justify-between hover:shadow-md transition-all">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block">已完成</span>
                <strong className="text-2xl text-emerald-800">{completedEmps}</strong>
              </div>
              <CheckCircle className="w-8 h-8 text-emerald-100" />
            </div>
            <div className="bg-white border border-[#E9E1D6] p-5 rounded-2xl flex items-center justify-between hover:shadow-md transition-all">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block">未完成</span>
                <strong className="text-2xl text-amber-700">{pendingEmps}</strong>
              </div>
              <FileCheck className="w-8 h-8 text-amber-100" />
            </div>
            <div className="bg-white border border-[#E9E1D6] p-5 rounded-2xl flex items-center justify-between hover:shadow-md transition-all">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block">授權管理員</span>
                <strong className="text-2xl text-[#8D1B1B] font-mono">{adminEmails.length} 人</strong>
              </div>
              <Mail className="w-8 h-8 text-stone-300" />
            </div>
          </div>
        )}

        {/* Tracker View */}
        {activeMenu === 'tracker' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Table side (Takes 2 columns in large screens) */}
            <div className="lg:col-span-2 bg-white border border-[#E9E1D6] rounded-2xl overflow-hidden shadow-sm">
              <div className="p-5 border-b border-stone-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-stone-900">新進同仁資料追蹤</h3>
                  <p className="text-[11px] text-stone-400">核對新進同仁的身分資料、經歷與上載文件</p>
                </div>
                
                {/* Search Bar */}
                <div className="relative w-full md:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-stone-400" />
                  <input
                    type="text"
                    placeholder="搜尋姓名、Email、部門..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full text-stone-900 pl-8 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:border-[#8D1B1B]"
                  />
                </div>
              </div>

              {filteredEmployees.length === 0 ? (
                <div className="p-12 text-center text-stone-400 italic text-xs">
                  🧐 找不到相符的新進同仁資料
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-sans text-xs">
                    <thead>
                      <tr className="bg-stone-50/50 border-b border-stone-150 text-[10px] font-semibold text-stone-400 tracking-wider">
                        <th className="p-4">中文姓名</th>
                        <th className="p-4">任職館別與職位</th>
                        <th className="p-4">連絡 Email</th>
                        <th className="p-4">授權驗證碼</th>
                        <th className="p-4">填答進度</th>
                        <th className="p-4 text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {filteredEmployees.map((emp) => (
                        <tr key={emp.id} className="hover:bg-[#FAF9F6] transition-colors">
                          <td className="p-4">
                            <span className="font-semibold text-stone-900 block">{emp.name}</span>
                            <div className="mt-1.5 flex items-center gap-1.5 no-print">
                              <span className="text-[10px] text-stone-500 font-medium shrink-0">員編:</span>
                              <span className="px-1.5 py-0.5 text-[10px] text-stone-800 bg-stone-50 border border-stone-250 font-mono font-semibold rounded select-all cursor-default">
                                {emp.empId || '未設定'}
                              </span>
                            </div>
                            <span className="text-[9px] text-stone-400 font-mono block mt-0.5">系統案號: {emp.id.substring(0, 8)}</span>
                          </td>
                          <td className="p-4">
                            <span className="font-medium text-[#8D1B1B] block">{emp.department}</span>
                            <span className="text-[10px] text-stone-400">{emp.title}</span>
                          </td>
                          <td className="p-4 font-mono text-stone-500">{emp.email}</td>
                          <td className="p-4 font-mono font-semibold text-stone-600">{emp.authToken}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className={`font-semibold ${emp.progress === 100 ? 'text-emerald-700' : 'text-amber-700'}`}>
                                {emp.progress}%
                              </span>
                              <div className="w-16 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${emp.progress === 100 ? 'bg-emerald-600' : 'bg-amber-600'}`}
                                  style={{ width: `${emp.progress}%` }}
                                ></div>
                              </div>
                            </div>
                            <span className="text-[10px] text-stone-400 block mt-0.5">
                              {emp.status === 'completed' ? '已完成' : '填寫中'}
                            </span>
                          </td>
                          <td className="p-4 text-center space-x-1.5">
                            <button
                              onClick={() => setSelectedEmp(emp)}
                              className="p-1.5 bg-[#8D1B1B]/10 hover:bg-[#8D1B1B]/20 text-[#8D1B1B] rounded transition-all cursor-pointer"
                              title="展開資料"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEmailPreviewEmp(emp)}
                              className="p-1.5 bg-amber-50 hover:bg-amber-100 text-[#8D1B1B] rounded transition-all cursor-pointer"
                              title="發送報到通知信"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded transition-all cursor-pointer"
                              title="剔除此筆名單"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Selected detail inspection (Expanded right card) */}
            <div className="lg:col-span-1">
              {selectedEmp ? (
                <div className="bg-white border border-[#E9E1D6] rounded-2xl p-6 space-y-6 shadow-md">
                  <div className="flex justify-between items-start pb-4 border-b border-stone-100">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {selectedEmp.personalData?.avatarUrl && (
                        <img 
                          src={selectedEmp.personalData.avatarUrl} 
                          alt="大頭照" 
                          className="w-10 h-10 rounded-lg object-cover border border-stone-200 shadow-sm flex-shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-[#8D1B1B] flex items-center gap-1.5 flex-wrap">
                          <span>檢閱詳細資料：{selectedEmp.name}</span>
                          {selectedEmp.personalData?.englishName && (
                            <span className="text-stone-400 font-normal text-xs">({selectedEmp.personalData.englishName})</span>
                          )}
                        </h4>
                        <p className="text-[10px] text-stone-400 truncate">目前填寫狀態：{selectedEmp.status === 'completed' ? '已完成' : '填寫中'}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedEmp(null)}
                      className="text-stone-400 hover:text-stone-600 text-[10px] px-2 py-0.5 border border-stone-200 rounded flex-shrink-0"
                    >
                      關閉資料
                    </button>
                  </div>

                  {/* Contract config of the employee */}
                  <div className="bg-[#FAF6F0] p-4 rounded-xl border border-[#8D1B1B]/15 space-y-2.5 text-xs">
                    <span className="block text-[10px] font-bold text-[#8D1B1B] uppercase tracking-wider">
                      📋 勞動合約資訊
                    </span>
                    <div className="space-y-1.5 text-stone-700">
                      <div>💼 <strong className="text-stone-600">任職館別與職位：</strong>{selectedEmp.department} ── {selectedEmp.title}</div>
                      <div>📍 <strong className="text-stone-600">工作地點：</strong><span className="text-stone-900 font-medium">{selectedEmp.contractWorkLocation || '君品酒店 (台北) (台北市承德路一段3號)'}</span></div>
                      <div>💰 <strong className="text-stone-600">薪資：</strong>{selectedEmp.contractSalaryType === 'daily' ? '日薪' : selectedEmp.contractSalaryType === 'hourly' ? '時薪' : '月薪'} 新台幣 <strong className="font-mono text-[#8D1B1B] font-bold">{selectedEmp.contractSalaryAmount || '36,000'}</strong> 元</div>
                      <div>📅 <strong className="text-stone-600">休假：</strong>{selectedEmp.contractLeaveOption === 'monthly' ? `月排休 ${selectedEmp.contractLeavedays || '8-10'} 天` : '週休二日制'}</div>
                      <div>⏱️ <strong className="text-stone-600">試用期：</strong>
                        <span className="inline-block px-2 py-0.5 text-xs font-bold text-[#8D1B1B] bg-white border border-stone-300 rounded shadow-sm leading-none align-middle select-all">
                          {selectedEmp.contractProbationMonths || '三'}
                        </span> 個月
                      </div>
                      <div>🆔 <strong className="text-stone-600">員工編號：</strong>
                        <span className="inline-block px-2 py-0.5 text-xs font-mono font-bold text-[#8D1B1B] bg-white border border-stone-300 rounded shadow-sm leading-none align-middle select-all">
                          {selectedEmp.empId || '未設定'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        ✉️ <strong className="text-stone-600">報到 Email：</strong>
                        {isEditingEmail ? (
                          <div className="flex items-center gap-1.5 mt-0.5 w-full sm:w-auto">
                            <input
                              type="email"
                              value={editingEmailValue}
                              onChange={(e) => setEditingEmailValue(e.target.value)}
                              className="px-2 py-0.5 text-xs bg-white border border-stone-300 rounded font-mono text-stone-850 focus:outline-none focus:border-[#8D1B1B] w-full max-w-[200px]"
                            />
                            <button
                              onClick={() => {
                                handleUpdateEmail(selectedEmp.id, editingEmailValue);
                                setIsEditingEmail(false);
                              }}
                              className="px-1.5 py-0.5 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold cursor-pointer"
                            >
                              儲存
                            </button>
                            <button
                              onClick={() => {
                                setIsEditingEmail(false);
                                setEditingEmailValue(selectedEmp.email);
                              }}
                              className="px-1.5 py-0.5 text-[10px] bg-stone-200 hover:bg-stone-300 text-stone-700 rounded font-semibold cursor-pointer"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-stone-900 bg-stone-100 px-1.5 py-0.5 rounded text-[11px] font-medium select-all">
                              {selectedEmp.email}
                            </span>
                            <button
                              onClick={() => {
                                setEditingEmailValue(selectedEmp.email);
                                setIsEditingEmail(true);
                              }}
                              className="text-blue-600 hover:text-blue-800 text-[10px] flex items-center gap-0.5 cursor-pointer font-semibold underline"
                              title="修改電子郵件"
                            >
                              ✍️ 修改
                            </button>
                          </div>
                        )}
                      </div>
                      <div>🔑 <strong className="text-stone-600">驗證碼：</strong><code className="font-mono bg-stone-200/50 px-1 py-0.5 rounded font-bold text-[#8D1B1B] text-[10px]">{selectedEmp.authToken}</code></div>
                    </div>
                  </div>



                  {/* Onboarding progress tracking & manual review panel */}
                  <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-3.5 text-xs no-print">
                    <div className="flex justify-between items-center pb-2 border-b border-stone-200">
                      <span className="text-[10px] font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1">
                        ⚙️ 報到關卡進度與手動覆核
                      </span>
                      <span className="text-[10px] bg-[#8D1B1B]/10 text-[#8D1B1B] px-1.5 py-0.5 rounded font-bold">
                        進度: {selectedEmp.progress}%
                      </span>
                    </div>

                    {/* Master Actions */}
                    <div className="flex gap-2 pb-1.5 border-b border-stone-150">
                      <button
                        onClick={() => handleUpdateOnboardingProgress(selectedEmp.id, {
                          personalDataCompleted: true,
                          careerDataCompleted: true,
                          filesCompleted: true,
                          rulesAgreedCompleted: true,
                          taxCompleted: true,
                          contractCompleted: true,
                          guarantorCompleted: true,
                          serviceCompleted: true,
                          manualStatus: 'completed',
                          manualProgress: 100
                        })}
                        className="flex-1 py-1 px-2 bg-[#343131] text-white hover:bg-stone-900 text-white-500 border border-[#D4AF37] rounded text-[10px] font-semibold transition-colors cursor-pointer text-center"
                      >
                       ⚡ 一鍵完成
                      </button>
                      <button
                        onClick={() => handleUpdateOnboardingProgress(selectedEmp.id, {
                          personalDataCompleted: false,
                          careerDataCompleted: false,
                          filesCompleted: false,
                          rulesAgreedCompleted: false,
                          taxCompleted: false,
                          contractCompleted: false,
                          guarantorCompleted: false,
                          serviceCompleted: false,
                          manualStatus: 'pending',
                          manualProgress: 0
                        })}
                        className="flex-1 py-1 px-2 bg-[#8D1B1B] text-[#D4AF37] hover:bg-[#721515] border border-[#721515] rounded text-[10px] font-semibold transition-colors cursor-pointer text-center"
                      >
                        🔄 重設為 0%
                      </button>
                    </div>

                    {/* Individual sections */}
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {[
                        {
                          id: 'personalDataCompleted',
                          label: '基本資料表 (15%)',
                          completed: !!(selectedEmp.personalData && selectedEmp.personalData.name && selectedEmp.personalData.phone),
                          toggleValue: !(selectedEmp.personalData && selectedEmp.personalData.name && selectedEmp.personalData.phone)
                        },
                        {
                          id: 'careerDataCompleted',
                          label: '履歷與學經歷 (15%)',
                          completed: !!(selectedEmp.careerData && (selectedEmp.careerData.experiences?.length > 0 || selectedEmp.careerData.educations?.length > 0 || selectedEmp.careerData.licenses?.length > 0)),
                          toggleValue: !(selectedEmp.careerData && (selectedEmp.careerData.experiences?.length > 0 || selectedEmp.careerData.educations?.length > 0 || selectedEmp.careerData.licenses?.length > 0))
                        },
                        {
                          id: 'filesCompleted',
                          label: '相關文件上傳 (15%)',
                          completed: !!(selectedEmp.uploadedFiles && selectedEmp.uploadedFiles.length > 0),
                          toggleValue: !(selectedEmp.uploadedFiles && selectedEmp.uploadedFiles.length > 0)
                        },
                        {
                          id: 'rulesAgreedCompleted',
                          label: '工作規程與個資同意 (10%)',
                          completed: !!(selectedEmp.rulesAgreed && selectedEmp.privacyAgreed),
                          toggleValue: !(selectedEmp.rulesAgreed && selectedEmp.privacyAgreed)
                        },
                        {
                          id: 'taxCompleted',
                          label: '所得稅免稅申報 (15%)',
                          completed: !!(selectedEmp.taxDeclaration && selectedEmp.taxDeclaration.signed),
                          toggleValue: !(selectedEmp.taxDeclaration && selectedEmp.taxDeclaration.signed)
                        },
                        {
                          id: 'contractCompleted',
                          label: '聘僱合約書簽署 (10%)',
                          completed: !!selectedEmp.contractSigned,
                          toggleValue: !selectedEmp.contractSigned
                        },
                        {
                          id: 'guarantorCompleted',
                          label: '職員保證書簽署 (10%)',
                          completed: !!selectedEmp.guarantorSigned,
                          toggleValue: !selectedEmp.guarantorSigned
                        },
                        {
                          id: 'serviceCompleted',
                          label: '職工服務守則約定 (10%)',
                          completed: !!selectedEmp.serviceSigned,
                          toggleValue: !selectedEmp.serviceSigned
                        }
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-1.5 bg-white rounded border border-stone-150 hover:bg-stone-50/50 transition-colors">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.completed ? 'bg-emerald-500 shadow-xs' : 'bg-amber-400'}`}></span>
                            <span className={`font-medium truncate ${item.completed ? 'text-stone-850 font-semibold' : 'text-stone-500'}`}>
                              {item.label}
                            </span>
                          </div>
                          <button
                            onClick={() => handleUpdateOnboardingProgress(selectedEmp.id, { [item.id]: item.toggleValue })}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors border select-none shrink-0 ${
                              item.completed
                                ? 'text-rose-600 bg-rose-50/55 hover:bg-rose-50 border-rose-200'
                                : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                            }`}
                          >
                            {item.completed ? '撤銷' : '覆核完成'}
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Manual Overall Status & Manual Progress Overrides */}
                    <div className="pt-2 border-t border-stone-200 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-stone-500 font-semibold">手動修改報到狀態：</span>
                        <div className="flex bg-stone-100 p-0.5 rounded border border-stone-200">
                          <button
                            onClick={() => handleUpdateOnboardingProgress(selectedEmp.id, { manualStatus: 'pending' })}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${selectedEmp.status === 'pending' ? 'bg-[#8D1B1B] text-white shadow-xs' : 'text-stone-600 hover:bg-stone-200'}`}
                          >
                            待確認
                          </button>
                          <button
                            onClick={() => handleUpdateOnboardingProgress(selectedEmp.id, { manualStatus: 'completed' })}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${selectedEmp.status === 'completed' ? 'bg-emerald-600 text-white shadow-xs' : 'text-stone-600 hover:bg-stone-200'}`}
                          >
                            已完成
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-stone-500 font-semibold">手動覆寫進度百分比：</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            placeholder={String(selectedEmp.progress)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = parseInt((e.target as HTMLInputElement).value);
                                if (!isNaN(val) && val >= 0 && val <= 100) {
                                  handleUpdateOnboardingProgress(selectedEmp.id, { manualProgress: val });
                                }
                              }
                            }}
                            className="w-12 text-center py-0.5 px-1 bg-white border border-stone-300 rounded text-xs font-mono font-bold text-[#8D1B1B]"
                          />
                          <span className="text-stone-500 text-[10px] font-mono">%</span>
                          <span className="text-[9px] text-stone-400 font-sans italic">(按 Enter 儲存)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Export buttons block */}
                  <div className="flex flex-col gap-2">
                    {/* Export personnel data card as PDF */}
                    <button
                      onClick={() => setPrintingEmp(selectedEmp)}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#8D1B1B] text-[#D4AF37] hover:bg-[#781717] hover:text-white transition-all text-[11px] font-bold rounded-xl shadow border border-[#D4AF37]/25 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      列印與匯出人事資料卡
                    </button>

                    {/* Export Tax declaration printable sheet as PDF */}
                    {selectedEmp.taxDeclaration?.signed ? (
                      <button
                        onClick={() => setPrintTaxEmp(selectedEmp)}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 text-white hover:bg-indigo-700 transition-all text-[11px] font-bold rounded-xl shadow border border-indigo-750/20 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        列印與匯出免稅申報表
                      </button>
                    ) : (
                      <div className="text-[10px] text-center text-stone-500 bg-stone-100 py-1.5 rounded-lg border border-stone-200">
                        ⚠️ 尚未完成簽署免稅申報表
                      </div>
                    )}

                    {/* Export Employment Contract printable sheet as PDF */}
                    {selectedEmp.contractSigned ? (
                      <button
                        onClick={() => setPrintContractEmp(selectedEmp)}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 text-white hover:bg-blue-700 transition-all text-[11px] font-bold rounded-xl shadow border border-blue-750/20 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        列印與匯出聘僱合約書
                      </button>
                    ) : (
                      <div className="text-[10px] text-center text-stone-500 bg-stone-100 py-1.5 rounded-lg border border-stone-200">
                        ⚠️ 尚未完成簽署聘僱合約書
                      </div>
                    )}

                    {/* Export Personal Data Consent Form as PDF */}
                    {selectedEmp.privacyAgreed ? (
                      <button
                        onClick={() => setPrintConsentEmp(selectedEmp)}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-teal-600 text-white hover:bg-teal-700 transition-all text-[11px] font-bold rounded-xl shadow border border-teal-750/20 cursor-pointer animate-pulse"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        列印與匯出個資同意書
                      </button>
                    ) : (
                      <div className="text-[10px] text-center text-stone-500 bg-stone-100 py-1.5 rounded-lg border border-stone-200">
                        ⚠️ 尚未完成簽署個資處理利用蒐集同意書
                      </div>
                    )}

                    {/* Export Guarantor Agreement as PDF */}
                    {selectedEmp.guarantorSigned ? (
                      <button
                        onClick={() => setPrintGuarantorEmp(selectedEmp)}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-purple-600 text-white hover:bg-purple-700 transition-all text-[11px] font-bold rounded-xl shadow border border-purple-750/20 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        列印與匯出職員保證書
                      </button>
                    ) : (
                      <div className="text-[10px] text-center text-stone-500 bg-stone-100 py-1.5 rounded-lg border border-stone-200">
                        ⚠️ 尚未完成簽署職員保證書
                      </div>
                    )}

                    {/* Export Service Agreement as PDF */}
                    {selectedEmp.serviceSigned ? (
                      <button
                        onClick={() => setPrintServiceEmp(selectedEmp)}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-amber-755 text-black hover:bg-amber-855 transition-all text-[11px] font-bold rounded-xl shadow border border-amber-800/20 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        列印與匯出職工服務約定
                      </button>
                    ) : (
                      <div className="text-[10px] text-center text-stone-500 bg-stone-100 py-1.5 rounded-lg border border-stone-200">
                        ⚠️ 尚未完成簽署職工服務約定
                      </div>
                    )}

                    {/* Export to Excel */}
                    <button
                      onClick={() => handleExportToExcel(selectedEmp)}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-800 text-[#FAF6F0] hover:bg-emerald-900 transition-all text-[11px] font-bold rounded-xl shadow border border-emerald-700/25 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      一鍵匯出 Excel 人事資料表
                    </button>
                  </div>

                  {/* 1. Personal details check */}
                  {selectedEmp.personalData ? (
                    <div className="space-y-4 text-xs">
                      <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                        一、基本資料表
                      </span>
                      <div className="grid grid-cols-2 gap-2 text-stone-600">
                        <div><strong className="text-stone-400 font-normal">身分證號：</strong> {selectedEmp.personalData.idNumber}</div>
                        <div><strong className="text-stone-400 font-normal">性別：</strong> {selectedEmp.personalData.gender || '無填'}</div>
                        <div><strong className="text-stone-400 font-normal">聯絡電話：</strong> {selectedEmp.personalData.phone}</div>
                        <div><strong className="text-stone-400 font-normal">出生年月：</strong> {selectedEmp.personalData.birthday || '無填'}</div>
                      </div>
                      <div className="text-[11px] space-y-1 text-stone-600">
                        <p><strong className="text-stone-400 font-normal">戶籍地址：</strong> {selectedEmp.personalData.legalAddress}</p>
                        <p><strong className="text-stone-400 font-normal">通訊住址：</strong> {selectedEmp.personalData.contactAddress}</p>
                      </div>

                      <div className="bg-stone-50 p-3 rounded-lg space-y-1 border border-stone-150">
                        <p className="font-semibold text-stone-800 text-[11px]">🏦 薪資撥轉帳戶</p>
                        <p>{selectedEmp.personalData.bankName} - {selectedEmp.personalData.bankAccount}</p>
                      </div>

                      <div className="bg-stone-50 p-3 rounded-lg space-y-1 border border-stone-150">
                        <p className="font-semibold text-stone-800 text-[11px]">🚨 緊急聯絡人</p>
                        <p>{selectedEmp.personalData.emergencyName} - {selectedEmp.personalData.emergencyRelationship} ({selectedEmp.personalData.emergencyPhone})</p>
                      </div>

                      <div className="bg-stone-50 p-3 rounded-lg space-y-1.5 border border-stone-150">
                        <p className="font-semibold text-stone-800 text-[11px] flex justify-between items-center">
                          <span>👨‍👩‍👧‍👦 申報與健保扶養親屬</span>
                          <span className="text-[10px] text-stone-400 font-normal">所得扣繳扶養: {selectedEmp.personalData.dependentsCount || '0 人'}</span>
                        </p>
                        <p className="text-stone-700">健保眷屬投保人數: <strong>{selectedEmp.personalData.healthDependentsCount || '0 人'}</strong></p>
                        {selectedEmp.personalData.healthDependents && selectedEmp.personalData.healthDependents.length > 0 && (
                          <div className="mt-2 border-t border-stone-200/60 pt-2 space-y-1.5 bg-white p-2 rounded border border-stone-100">
                            {selectedEmp.personalData.healthDependents.map((dep: any, idx: number) => (
                              <div key={idx} className="text-[11px] text-stone-600 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 border-b border-stone-50 last:border-0 pb-1.5 last:pb-0">
                                <span className="font-semibold text-stone-700">{idx + 1}. {dep.name} ({dep.relationship})</span>
                                <span className="font-mono text-[10px] text-stone-500">{dep.idNumber} / {dep.birthday}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-stone-400 italic">
                      ⚠️ 本人尚未完成填寫資料。
                    </div>
                  )}

                  {/* 2. Experience inspection */}
                  {selectedEmp.careerData && (
                    <div className="space-y-3 pt-4 border-t border-stone-100 text-xs">
                      <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                        二、學經歷及證書
                      </span>
                      {selectedEmp.careerData.experiences?.length > 0 && (
                        <div className="space-y-1 px-1">
                          <p className="font-semibold text-stone-700 text-[11px] mb-1">💼 過往工作職涯歷程：</p>
                          {selectedEmp.careerData.experiences.map((exp: any, i: number) => (
                            <p key={i} className="text-stone-600 leading-relaxed pl-2 border-l-2 border-stone-200">
                              • <strong>{exp.companyName}</strong> ── {exp.jobTitle} ({exp.startDate} ~ {exp.endDate || '至今'})
                            </p>
                          ))}
                        </div>
                      )}
                      {selectedEmp.careerData.educations && selectedEmp.careerData.educations.length > 0 && (
                        <div className="space-y-1 px-1 mt-2">
                          <p className="font-semibold text-stone-700 text-[11px] mb-1">🎓 學歷背景證明：</p>
                          {selectedEmp.careerData.educations.map((edu: any, i: number) => (
                            <p key={i} className="text-stone-600 leading-relaxed pl-2 border-l-2 border-indigo-200">
                              • <strong>{edu.schoolName}</strong> ── {edu.major ? `${edu.major} ` : ''}({edu.degree || '學位無填'}) ── {edu.period || '期間無填'} 【{edu.status || '未選擇'}】
                            </p>
                          ))}
                        </div>
                      )}
                      {selectedEmp.careerData.licenses?.length > 0 && (
                        <div className="space-y-1 bg-[#8D1B1B]/5 p-2.5 rounded-lg border border-[#8D1B1B]/10">
                          <p className="font-medium text-[#8D1B1B]">🎖️ 專業證書</p>
                          {selectedEmp.careerData.licenses.map((lic: any, i: number) => (
                            <p key={i} className="text-[11px] text-stone-600">
                              - {lic.licenseName} {(lic.badgeLevel ? `(${lic.badgeLevel})` : '')}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. Files Uploaded checking */}
                  <div className="space-y-3 pt-4 border-t border-stone-100 text-xs">
                    <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                      三、申報核驗文件 (限定 PDF)
                    </span>
                    
                    <div className="space-y-2">
                      {[
                        { id: 'idCard', label: '1. 身分證正反面影本', required: true },
                        { id: 'degree', label: '2. 最高學歷證明影本', required: true },
                        { id: 'military', label: '3. 退伍令', required: false, femaleExempt: true },
                        { id: 'healthReport', label: '4. 體檢報告', required: true },
                        { id: 'healthIns', label: '5. 原投保單位健保轉出單', required: false },
                        { id: 'bankCover', label: '6. 中國信託銀行帳戶封面影本', required: true }
                      ].map((slot) => {
                        const file = selectedEmp.uploadedFiles?.find(f => f.docType === slot.id);
                        return (
                          <div key={slot.id} className="bg-stone-50 p-2.5 border border-stone-100 rounded flex flex-col gap-1 text-[11px]">
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-stone-700 flex items-center gap-1.5 flex-wrap">
                                <span>{slot.label}</span>
                                {slot.required ? (
                                  <span className="text-[9px] text-red-600 bg-red-50 px-1 py-0.2 rounded border border-red-100">必附</span>
                                ) : (
                                  <span className="text-[9px] text-stone-500 bg-stone-100 px-1 py-0.2 rounded border border-stone-150">選附</span>
                                )}
                              </span>
                              
                              {file ? (
                                <span className="text-[9px] text-[#0D9488] font-bold">已繳</span>
                              ) : (
                                <span className="text-[9px] text-stone-400">未繳</span>
                              )}
                            </div>
                            
                            {file ? (
                              <div className="flex justify-between items-center bg-white border border-stone-100 p-1.5 rounded mt-1">
                                <span className="truncate text-stone-500 font-mono text-[10px] max-w-[155px]" title={file.name}>{file.name}</span>
                                {file.base64Data ? (
                                  <a
                                    href={file.base64Data}
                                    download={file.name}
                                    className="text-[#8D1B1B] font-semibold flex items-center gap-0.5 hover:underline text-[10px]"
                                  >
                                    <Download className="w-3 h-3" />
                                    下載
                                  </a>
                                ) : (
                                  <span className="text-stone-400 text-[9px]">無預覽</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-stone-400 italic text-[10px] mt-0.5">尚未檢附檔案</span>
                            )}
                          </div>
                        );
                      })}

                      {/* 處理未歸類之其他舊格式文件 */}
                      {selectedEmp.uploadedFiles?.filter(f => !f.docType).map((file, i) => (
                        <div key={i} className="bg-stone-50 p-2.5 border border-stone-100 rounded flex justify-between items-center text-[11px]">
                          <span className="truncate max-w-[170px] font-medium text-stone-700">{file.name} (未分類)</span>
                          {file.base64Data ? (
                            <a
                              href={file.base64Data}
                              download={file.name}
                              className="text-[#8D1B1B] font-semibold flex items-center gap-1 hover:underline text-[10px]"
                            >
                              <Download className="w-3.5 h-3.5" />
                              下載
                            </a>
                          ) : (
                            <span className="text-stone-400">無法預覽</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 4. Signed Status */}
                  <div className="space-y-2 pt-4 border-t border-stone-100 text-xs select-none">
                    <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                      四、工作規則與合約確認
                    </span>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 text-stone-600">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${selectedEmp.rulesAgreed ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-400'}`}>✓</div>
                        <span>已簽署工作規則同意書</span>
                      </div>
                      <div className="flex items-center gap-2 text-stone-600">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${selectedEmp.privacyAgreed ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-400'}`}>✓</div>
                        <span>已簽署個資利用處理蒐集同意書</span>
                      </div>
                      <div className="flex items-center gap-2 text-stone-600">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${selectedEmp.contractSigned ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-400'}`}>✓</div>
                        <span>
                          {selectedEmp.contractSigned ? (
                            <span>已簽署聘僱合約書</span>
                          ) : (
                            <span className="text-stone-400 italic">聘僱合約簽署中</span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-stone-600">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${selectedEmp.guarantorSigned ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-400'}`}>✓</div>
                        <span>
                          {selectedEmp.guarantorSigned ? (
                            <span>已簽署職員保證書</span>
                          ) : (
                            <span className="text-stone-400 italic">職員保證書簽署中</span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-stone-600">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${selectedEmp.serviceSigned ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-400'}`}>✓</div>
                        <span>
                          {selectedEmp.serviceSigned ? (
                            <span>已簽署職工服務約定</span>
                          ) : (
                            <span className="text-stone-400 italic">職工服務約定簽署中</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="bg-white border border-[#E9E1D6] rounded-2xl p-8 hover:shadow text-center space-y-3 text-stone-400 select-none">
                  <AlertCircle className="w-8 h-8 text-stone-300 mx-auto" />
                  <p className="text-xs">請在左側名單中點擊 “查看詳情” 的小按鈕，此處可一鍵查看同仁所有登入的基本資料！</p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* Create Employee Form Module */}
        {activeMenu === 'add' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start max-w-7xl mx-auto">
            {/* Left Sidebar Menu Component */}
            <div className="lg:col-span-3 bg-white border border-[#E9E1D6] rounded-2xl p-5 space-y-4 shadow-sm select-none">
              <div className="pb-3.5 border-b border-stone-150">
                <span className="block text-xs font-bold text-[#8D1B1B] uppercase tracking-widest leading-none">
                  建立報到工作
                </span>
                <p className="text-[10px] text-stone-400 mt-1.5 leading-relaxed">
                  在發佈同仁報到前，請確實核對並填妥下方基本與合約條件欄位。
                </p>
              </div>
              
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => setAddSubMenu('basic')}
                  type="button"
                  className={`w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-left text-xs font-medium cursor-pointer transition-all ${
                    addSubMenu === 'basic'
                      ? 'bg-[#8D1B1B] text-[#D4AF37] shadow-sm font-semibold'
                      : 'text-stone-600 hover:bg-[#FAF9F6] hover:text-[#8D1B1B]'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>1. 基本資料</span>
                </button>
                
                <button
                  onClick={() => setAddSubMenu('contract')}
                  type="button"
                  className={`w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-left text-xs font-medium cursor-pointer transition-all ${
                    addSubMenu === 'contract'
                      ? 'bg-[#8D1B1B] text-[#D4AF37] shadow-sm font-semibold'
                      : 'text-stone-600 hover:bg-[#FAF9F6] hover:text-[#8D1B1B]'
                  }`}
                >
                  <FileCheck className="w-4 h-4" />
                  <span>2. 合約資料</span>
                </button>

                <button
                  onClick={() => {
                    if (!newEmp.name || !newEmp.email || !newEmp.authToken || !newEmp.title) {
                      setErrorMsg('⚠️ 請先填寫步驟一的基本資料中所有的必填欄位 (姓名、報到 Email、職稱與授權碼)');
                      setAddSubMenu('basic');
                      return;
                    }
                    setErrorMsg('');
                    setAddSubMenu('send_email');
                  }}
                  type="button"
                  className={`w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-left text-xs font-medium cursor-pointer transition-all ${
                    addSubMenu === 'send_email'
                      ? 'bg-[#8D1B1B] text-[#D4AF37] shadow-sm font-semibold'
                      : 'text-stone-600 hover:bg-[#FAF9F6] hover:text-[#8D1B1B]'
                  }`}
                >
                  <Mail className="w-4 h-4" />
                  <span>3. 發送報到通知信件</span>
                </button>
              </div>
            </div>

            {/* Right Form Content Area */}
            <div className="lg:col-span-9">
              <form onSubmit={handleCreateEmployee} className="space-y-6">
                <div className="bg-white border border-[#E9E1D6] rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
                  {addSubMenu === 'basic' && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 pb-4 border-b border-stone-100 select-none">
                        <div className="w-9 h-9 rounded-xl bg-[#8D1B1B]/10 flex items-center justify-center text-[#8D1B1B]">
                          <Users className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-stone-900">1. 新進同仁基本資料填寫</h3>
                          <p className="text-xs text-stone-500">輸入同仁姓名、編號與聯絡資訊，此階段資訊將自動儲存為系統初始發佈參數</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1.5 font-sans">
                            新進同仁姓名 <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="例如：王小明"
                            value={newEmp.name}
                            onChange={e => setNewEmp({...newEmp, name: e.target.value})}
                            className="w-full text-stone-900 px-3.5 py-2.5 text-xs border border-stone-200 rounded-lg focus:outline-none focus:border-[#8D1B1B] bg-stone-50/30 focus:bg-white transition-all shadow-inner font-semibold"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1.5 font-sans">
                            員工編號 (新進同仁員編)
                          </label>
                          <input
                            type="text"
                            placeholder="例如：LDC9999"
                            value={newEmp.empId}
                            onChange={e => setNewEmp({...newEmp, empId: e.target.value})}
                            className="w-full text-stone-900 px-3.5 py-2.5 text-xs border border-stone-200 rounded-lg focus:outline-none focus:border-[#8D1B1B] bg-stone-50/30 focus:bg-white transition-all shadow-inner font-mono font-bold"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1.5 font-sans">
                            報到電子郵件 <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="email"
                            placeholder="例如：employee@ldchotels.com"
                            value={newEmp.email}
                            onChange={e => setNewEmp({...newEmp, email: e.target.value})}
                            className="w-full text-[#8D1B1B] font-mono px-3.5 py-2.5 text-xs border border-stone-200 rounded-lg focus:outline-none focus:border-[#8D1B1B] bg-stone-50/30 focus:bg-white transition-all shadow-inner font-semibold"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1.5 font-sans">
                            任職公司 <span className="text-rose-500">*</span>
                          </label>
                          <select
                            value={newEmp.department}
                            onChange={e => setNewEmp({...newEmp, department: e.target.value})}
                            className="w-full text-stone-900 px-3.5 py-2.5 text-xs border border-stone-200 rounded-lg focus:outline-none focus:border-[#8D1B1B] bg-white font-semibold cursor-pointer shadow-inner"
                          >
                            <option>雲朗觀光股份有限公司</option>
                            <option>雲品國際酒店股份有限公司</option>
                            <option>致和國際管理顧問股份有限公司</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1.5 font-sans">
                            部門名稱 <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="例如：行銷公關處"
                            value={(newEmp.title || '').split(' - ')[0] || ''}
                            onChange={e => {
                              const parts = (newEmp.title || '').split(' - ');
                              const jobTitle = parts.slice(1).join(' - ') || parts[1] || '';
                              const safeDept = e.target.value.replace(' - ', ' ');
                              setNewEmp({...newEmp, title: safeDept + (jobTitle ? ` - ${jobTitle}` : '')});
                            }}
                            className="w-full text-stone-900 px-3.5 py-2.5 text-xs border border-stone-200 rounded-lg focus:outline-none focus:border-[#8D1B1B] bg-stone-50/30 focus:bg-white transition-all shadow-inner font-semibold"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1.5 font-sans">
                            職稱 <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="例如：服務專員"
                            value={(newEmp.title || '').split(' - ')[1] || ((newEmp.title || '').includes(' - ') ? '' : (newEmp.title || ''))}
                            onChange={e => {
                              const parts = (newEmp.title || '').split(' - ');
                              const dept = parts[0] || '';
                              const safeTitle = e.target.value.replace(' - ', ' ');
                              setNewEmp({...newEmp, title: (dept ? `${dept} - ` : '') + safeTitle});
                            }}
                            className="w-full text-stone-900 px-3.5 py-2.5 text-xs border border-stone-200 rounded-lg focus:outline-none focus:border-[#8D1B1B] bg-stone-50/30 focus:bg-white transition-all shadow-inner font-semibold"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1.5 font-sans">
                            預計到職日 <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="date"
                            value={newEmp.onboardDate}
                            onChange={e => setNewEmp({...newEmp, onboardDate: e.target.value})}
                            className="w-full text-stone-900 px-3.5 py-2.5 text-xs border border-stone-200 rounded-lg focus:outline-none focus:border-[#8D1B1B] bg-stone-50/30 focus:bg-white transition-all shadow-inner"
                            required
                          />
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1.5">
                            <label className="block text-xs font-semibold text-stone-700 font-sans">
                              授權驗證碼 <span className="text-rose-500">*</span>
                            </label>
                            <button
                              type="button"
                              onClick={generateRandomToken}
                              className="text-[10px] text-[#8D1B1B] font-bold hover:underline"
                            >
                              🎲 隨機產生 4 碼
                            </button>
                          </div>
                          <input
                            type="text"
                            placeholder="例: LDC888"
                            value={newEmp.authToken}
                            onChange={e => setNewEmp({...newEmp, authToken: e.target.value})}
                            className="w-full text-stone-900 font-mono font-bold tracking-widest px-3.5 py-2.5 text-xs border border-stone-200 rounded-lg focus:outline-none focus:border-[#8D1B1B] bg-stone-50/30 focus:bg-white transition-all shadow-inner"
                            required
                          />
                        </div>
                      </div>

                      <div className="border-t border-stone-100 pt-6 flex justify-end gap-3 select-none">
                        <button
                          type="button"
                          onClick={() => setActiveMenu('tracker')}
                          className="px-4 py-2.5 text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer"
                        >
                          取消返回
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddSubMenu('contract')}
                          className="px-5 py-2.5 bg-[#8D1B1B] text-[#D4AF37] hover:bg-[#721515] font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          下一步：填寫合約資料
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {addSubMenu === 'contract' && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 pb-4 border-b border-stone-100 select-none">
                        <div className="w-9 h-9 rounded-xl bg-[#8D1B1B]/10 flex items-center justify-center text-[#8D1B1B]">
                          <FileCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-stone-900">2. 新進同仁聘雇合約基本資訊</h3>
                          <p className="text-xs text-stone-500">填妥入職館別、工作地點、薪薪方式等合約參數，同仁簽署合約時將直接唯讀套用</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-stone-50/50 p-4.5 rounded-xl border border-stone-150">
                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1.5 font-sans">
                            入職館別（點選將自動套用該館地點跟地址） <span className="text-rose-500">*</span>
                          </label>
                          <select
                            value={selectedBranchIdx}
                            onChange={e => {
                              const idx = parseInt(e.target.value, 10);
                              setSelectedBranchIdx(idx);
                              const b = BRANCHES[idx];
                              setNewEmp({
                                ...newEmp,
                                contractWorkLocation: `${b.name} (${b.address})`
                              });
                            }}
                            className="w-full text-stone-900 px-3.5 py-2.5 text-xs border border-stone-200 rounded-lg focus:outline-none focus:border-[#8D1B1B] bg-white font-semibold cursor-pointer shadow-inner"
                          >
                            {BRANCHES.map((b, idx) => (
                              <option key={idx} value={idx}>
                                {b.name} ─ {b.address}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1.5 font-sans">
                            約定工作地點與地址（合約第四條自動帶入）
                          </label>
                          <div className="w-full text-stone-900 px-3.5 py-2.5 text-xs border border-stone-200 rounded-lg bg-stone-50/70 font-mono font-semibold shadow-inner min-h-[38px] flex items-center select-all">
                            {newEmp.contractWorkLocation || '請點選左側入職館別自動帶入'}
                          </div>
                        </div>

                        <div className="border-t border-stone-200/60 pt-4 md:col-span-2"></div>

                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1.5 font-sans">
                            新進同仁休假方式（合約第七條） <span className="text-rose-500">*</span>
                          </label>
                          <div className="flex gap-6 p-2.5 bg-white border border-stone-200 rounded-lg shadow-inner">
                            <label className="flex items-center gap-1.5 text-xs text-stone-800 cursor-pointer font-medium select-none">
                              <input
                                type="radio"
                                name="contractLeaveOption"
                                checked={newEmp.contractLeaveOption === 'monthly'}
                                onChange={() => setNewEmp({...newEmp, contractLeaveOption: 'monthly', contractLeavedays: '8-10'})}
                                className="rounded text-[#8D1B1B] focus:ring-[#8D1B1B] cursor-pointer"
                              />
                              月排休制
                            </label>
                            <label className="flex items-center gap-1.5 text-xs text-stone-800 cursor-pointer font-medium select-none">
                              <input
                                type="radio"
                                name="contractLeaveOption"
                                checked={newEmp.contractLeaveOption === 'biweekly'}
                                onChange={() => setNewEmp({...newEmp, contractLeaveOption: 'biweekly', contractLeavedays: '符合法定時數，採週休二日'})}
                                className="rounded text-[#8D1B1B] focus:ring-[#8D1B1B] cursor-pointer"
                              />
                              週休二日制
                            </label>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1.5 font-sans">
                            休假天數設定（選月排休制時可自行輸入天數）
                          </label>
                          {newEmp.contractLeaveOption === 'monthly' ? (
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-stone-400">月排休</span>
                              <input
                                type="text"
                                value={newEmp.contractLeavedays || ''}
                                onChange={e => setNewEmp({...newEmp, contractLeavedays: e.target.value})}
                                placeholder="8-10"
                                className="w-full text-stone-900 font-mono font-bold pl-14 pr-24 py-2 text-xs border border-stone-200 rounded-lg focus:outline-none focus:border-[#8D1B1B] bg-white transition-all shadow-inner"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">天 (依公司排班規定)</span>
                            </div>
                          ) : (
                            <div className="w-full text-stone-400 px-3.5 py-2 text-xs border border-stone-200 rounded-lg bg-stone-50/70 font-sans font-medium shadow-inner min-h-[38px] flex items-center select-none">
                              符合法定工作時數，採週休二日制
                            </div>
                          )}
                        </div>

                        <div className="border-t border-stone-200/60 pt-4 md:col-span-2"></div>

                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1.5 font-sans">
                            新進同仁薪資敘薪方式（合約第八條） <span className="text-rose-500">*</span>
                          </label>
                          <div className="flex gap-6 p-2.5 bg-white border border-stone-200 rounded-lg shadow-inner">
                            <label className="flex items-center gap-1.5 text-xs text-stone-800 cursor-pointer font-medium select-none">
                              <input
                                type="radio"
                                name="contractSalaryType"
                                checked={newEmp.contractSalaryType === 'monthly'}
                                onChange={() => setNewEmp({...newEmp, contractSalaryType: 'monthly', contractSalaryAmount: '36,000'})}
                                className="rounded text-[#8D1B1B] focus:ring-[#8D1B1B] cursor-pointer"
                              />
                              月薪
                            </label>
                            <label className="flex items-center gap-1.5 text-xs text-stone-800 cursor-pointer font-medium select-none">
                              <input
                                type="radio"
                                name="contractSalaryType"
                                checked={newEmp.contractSalaryType === 'daily'}
                                onChange={() => setNewEmp({...newEmp, contractSalaryType: 'daily', contractSalaryAmount: '1,800'})}
                                className="rounded text-[#8D1B1B] focus:ring-[#8D1B1B] cursor-pointer"
                              />
                              日薪
                            </label>
                            <label className="flex items-center gap-1.5 text-xs text-stone-800 cursor-pointer font-medium select-none">
                              <input
                                type="radio"
                                name="contractSalaryType"
                                checked={newEmp.contractSalaryType === 'hourly'}
                                onChange={() => setNewEmp({...newEmp, contractSalaryType: 'hourly', contractSalaryAmount: '190'})}
                                className="rounded text-[#8D1B1B] focus:ring-[#8D1B1B] cursor-pointer"
                              />
                              時薪
                            </label>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1.5 font-sans">
                            薪資金額（合約第八條，可自行輸入調整） <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">NT$</span>
                            <input
                              type="text"
                              value={newEmp.contractSalaryAmount || ''}
                              onChange={e => setNewEmp({...newEmp, contractSalaryAmount: e.target.value})}
                              placeholder="請輸入薪資金額，例如 36,000"
                              className="w-full text-[#8D1B1B] font-mono font-bold pl-11 pr-10 py-2.5 text-xs border border-stone-200 rounded-lg focus:outline-none focus:border-[#8D1B1B] bg-white transition-all shadow-inner"
                              required
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">元</span>
                          </div>
                        </div>

                        <div className="border-t border-stone-200/60 pt-4 md:col-span-2"></div>

                        <div className="md:col-span-2">
                          <label className="block text-xs font-semibold text-stone-700 mb-1.5 font-sans">
                            合約試用期間（合約第一條）
                          </label>
                          <select
                            value={newEmp.contractProbationMonths}
                            onChange={e => setNewEmp({...newEmp, contractProbationMonths: e.target.value})}
                            className="w-full max-w-xs text-stone-900 px-3.5 py-2.5 text-xs border border-stone-200 rounded-lg focus:outline-none focus:border-[#8D1B1B] bg-white font-semibold cursor-pointer shadow-inner font-sans"
                          >
                            <option value="三">三</option>
                            <option value="無">無 </option>
                          </select>
                          <p className="text-[10px] text-stone-400 mt-1.5 font-sans select-none">
                            同仁線上填寫與簽署合約時，此試用期將自動帶入。
                          </p>
                        </div>
                      </div>

                      <div className="border-t border-stone-100 pt-6 flex justify-end gap-3 select-none">
                        <button
                          type="button"
                          onClick={() => setAddSubMenu('basic')}
                          className="px-4 py-2.5 text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer"
                        >
                          上一步：基本資料
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!newEmp.name || !newEmp.email || !newEmp.authToken || !newEmp.title) {
                              setErrorMsg('⚠️ 請先填寫步驟一的基本資料中所有的必填欄位 (姓名、報到 Email、職稱與授權碼)');
                              setAddSubMenu('basic');
                              return;
                            }
                            setErrorMsg('');
                            setAddSubMenu('send_email');
                          }}
                          className="px-5 py-2.5 bg-[#8D1B1B] text-[#D4AF37] hover:bg-[#721515] font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          下一步：預覽並發送通知信
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {addSubMenu === 'send_email' && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 pb-4 border-b border-stone-100 select-none">
                        <div className="w-9 h-9 rounded-xl bg-[#8D1B1B]/10 flex items-center justify-center text-[#8D1B1B]">
                          <Mail className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-stone-900">3. 預覽與發送報到通知信件</h3>
                          <p className="text-xs text-stone-500">核對下方信件範本與內容，確認無誤後點選下方按鈕發送，系統將發出報到邀請信</p>
                        </div>
                      </div>

                                            {/* Env Gmail Status Box */}
                      <div className="bg-stone-50 border border-stone-200/60 rounded-2xl p-5 space-y-4 shadow-sm mb-4">
                        <div className="flex items-center justify-between select-none">
                          <div className="flex items-center gap-2.5">
                            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                            <div>
                              <h4 className="text-xs font-bold text-stone-850">
                                🟢 系統已整合 Gmail 自動發送功能
                              </h4>
                              <p className="text-[11px] text-stone-500">
                                本系統已自動取得管理員信箱設定，將透過後端直接發送信件。
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Onboarding Notification Email Box */}
                      <div className="bg-[#FAF9F6] p-5 rounded-2xl border border-stone-200/80 space-y-4 shadow-sm">
                        <div className="flex items-center gap-2 pb-2 border-b border-stone-200 select-none">
                          <Mail className="w-4 h-4 text-[#8D1B1B]" />
                          <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                            寄送通知信件預覽
                          </span>
                        </div>
                        
                        <div className="bg-white border border-stone-150 rounded-xl p-4.5 space-y-3 text-xs text-stone-600 font-sans leading-relaxed shadow-inner">
                          <div className="grid grid-cols-1 gap-2 border-b border-stone-100 pb-3">
                            <div>
                              <strong className="text-stone-600 font-medium">寄件者：</strong>
                              <span className="font-mono text-stone-850 bg-stone-100 px-2 py-0.5 rounded font-semibold text-[11px] border border-stone-200/60 shadow-xs">
                                {googleUser ? `${googleUser.displayName || '管理者'} <${googleUser.email}>` : `${currentUser?.name || '管理員'} <${currentUser?.email}> (模擬發送)`}
                              </span>
                            </div>
                            <div>
                              <strong className="text-stone-600 font-medium">收件者：</strong>
                              <span className="font-mono text-stone-850 bg-stone-100 px-2 py-0.5 rounded font-semibold text-[11px] border border-stone-200/60 shadow-xs">
                                {newEmp.name || '(姓名)'} &lt;{newEmp.email || '(電子郵件)'}&gt;
                              </span>
                            </div>
                            <div>
                              <strong className="text-stone-600 font-medium">信件主旨：</strong>
                              <span className="font-semibold text-stone-900 text-[12px]">
                                【{getCompanyDetails(newEmp).name}】歡迎您的加入！新進人員入職報到系統登入引導
                              </span>
                            </div>
                          </div>
                          
                          <p className="text-stone-800">親愛的 <span className="font-semibold text-stone-900 underline">{newEmp.name || '同仁'}</span> 您好：</p>
                          <p className="text-xs text-stone-600 leading-relaxed">
                            恭喜您錄取本公司！為了能順利為您辦理入職與投保手續，請您點擊下方平台連結，並使用您的電子郵件與專屬授權碼登入，填妥報到所需的個人與合約基本資料：
                          </p>
                          
                          <div className="bg-[#FAF6F0] p-4 rounded-xl border border-[#D4AF37]/10 space-y-2 font-sans text-xs text-stone-700">
                            <div>💼 <strong className="text-stone-600">報到職稱：</strong><span className="text-stone-900 font-semibold">{newEmp.title || '(未設定)'}</span></div>
                            <div>📅 <strong className="text-stone-600">報到日期：</strong><span className="text-[#8D1B1B] font-bold font-mono">{newEmp.onboardDate || '(未設定)'}</span></div>
                            <div>📍 <strong className="text-stone-600">報到地點：</strong><span className="text-stone-900 font-medium">{newEmp.contractWorkLocation || '君品酒店 (台北市承德路一段3號)'}</span></div>
                            <div>💰 <strong className="text-stone-600">敘薪薪資：</strong>{newEmp.contractSalaryType === 'daily' ? '日薪' : newEmp.contractSalaryType === 'hourly' ? '時薪' : '月薪'} <strong className="font-mono text-[#8D1B1B] font-bold">NT$ {newEmp.contractSalaryAmount || '36,000'}</strong> 元</div>
                            <div>🔑 <strong className="text-stone-600">專屬授權碼：</strong><span className="text-white font-bold bg-[#8D1B1B] px-2.5 py-1 rounded-md font-mono text-xs shadow-xs tracking-wider select-all">{newEmp.authToken || '(未設定)'}</span></div>
                            <div className="pt-2 border-t border-stone-200/60 flex items-start gap-1">
                              <span>🔗</span>
                              <div>
                                <strong className="text-stone-600 block">平台連結：</strong>
                                <a href="https://ldc-onboarding-portal-554356081371.asia-east1.run.app" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all font-mono font-medium text-[11px]">https://ldc-onboarding-portal-554356081371.asia-east1.run.app</a>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-stone-100 pt-6 flex justify-between items-center gap-3 select-none">
                        <button
                          type="button"
                          onClick={() => setAddSubMenu('contract')}
                          className="px-4 py-2.5 text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer"
                        >
                          上一步：合約資料
                        </button>
                        <div className="flex gap-2.5">
                          <button
                            type="button"
                            onClick={handleCreateEmployee}
                            disabled={submitting}
                            className="px-5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                          >
                            僅建立報到卡 (不寄通知信)
                          </button>
                          <button
                            type="button"
                            onClick={handleCreateAndSendEmail}
                            disabled={submitting}
                            className="px-6 py-2.5 bg-[#8D1B1B] text-[#D4AF37] hover:bg-[#721515] font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Send className="w-3.5 h-3.5" />
                            {submitting ? '建立並寄送中...' : '確認建立報到卡並發送通知信'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 3. HR Admin management (No limits) - Sidebar Interior Layout */}
        {activeMenu === 'admins' && (() => {
          const gordonEmail = primaryAdminEmail;
          
          const normalizedAdmins = adminEmails.map((admin: any) => {
            if (typeof admin === 'string') {
              const email = admin.toLowerCase().trim();
              return { 
                email, 
                permissions: email === gordonEmail 
                  ? ['admin', 'tracker', 'publish', 'ai', 'audit'] 
                  : ['tracker', 'publish', 'ai'] 
              };
            }
            const email = (admin.email || '').toLowerCase().trim();
            return {
              email,
              permissions: admin.permissions || (email === gordonEmail 
                ? ['admin', 'tracker', 'publish', 'ai', 'audit'] 
                : ['tracker', 'publish', 'ai'])
            };
          });

          return (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start max-w-7xl mx-auto">
              
              {/* Left Sidebar Menu Component */}
              <div className="lg:col-span-3 bg-white border border-[#E9E1D6] rounded-2xl p-5 space-y-4 shadow-sm select-none">
                <div className="pb-3.5 border-b border-stone-150">
                  <span className="block text-xs font-bold text-[#8D1B1B] uppercase tracking-widest leading-none">
                    帳號管理
                  </span>
                  <p className="text-[10px] text-stone-400 mt-1 leading-relaxed">
                    維護HR管理者帳密安全與後台行使權限層級。
                  </p>
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => setAdminsSubMenu('members')}
                    type="button"
                    className={`w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-left text-xs font-medium cursor-pointer transition-all ${
                      adminsSubMenu === 'members'
                        ? 'bg-[#8D1B1B] text-[#D4AF37] shadow-sm font-semibold'
                        : 'text-stone-600 hover:bg-stone-50 hover:text-stone-800'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>管理成員</span>
                    <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      adminsSubMenu === 'members' ? 'bg-black/20 text-[#FAF6F0]' : 'bg-stone-100 text-stone-500'
                    }`}>
                      {normalizedAdmins.length}
                    </span>
                  </button>
                  
                  <button
                    onClick={() => setAdminsSubMenu('add')}
                    type="button"
                    className={`w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-left text-xs font-medium cursor-pointer transition-all ${
                      adminsSubMenu === 'add'
                        ? 'bg-[#8D1B1B] text-[#D4AF37] shadow-sm font-semibold'
                        : 'text-stone-600 hover:bg-stone-50 hover:text-stone-800'
                    }`}
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>新增管理員帳號</span>
                  </button>
                  
                  <button
                    onClick={() => setAdminsSubMenu('password')}
                    type="button"
                    className={`w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-left text-xs font-medium cursor-pointer transition-all ${
                      adminsSubMenu === 'password'
                        ? 'bg-[#8D1B1B] text-[#D4AF37] shadow-sm font-semibold'
                        : 'text-stone-600 hover:bg-stone-50 hover:text-stone-800'
                    }`}
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>變更密碼</span>
                  </button>

                  <button
                    onClick={() => setAdminsSubMenu('transfer')}
                    type="button"
                    className={`w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-left text-xs font-medium cursor-pointer transition-all ${
                      adminsSubMenu === 'transfer'
                        ? 'bg-[#8D1B1B] text-[#D4AF37] shadow-sm font-semibold'
                        : 'text-stone-600 hover:bg-stone-50 hover:text-stone-800'
                    }`}
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    <span>移轉主要管理者</span>
                  </button>
                </div>
              </div>

              {/* Right Content Column */}
              <div className="lg:col-span-9">
                
                {/* SUBMENU 1: MANAGE MEMBERS */}
                {adminsSubMenu === 'members' && (
                  <div className="space-y-6">
                    <div className="bg-white border border-[#E9E1D6] rounded-2xl p-6 md:p-8 space-y-5 shadow-sm">
                      {!hasAdminPermission && (
                        <div className="bg-amber-50 border border-amber-200/70 p-4 rounded-xl flex items-start gap-3 select-none">
                          <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                          <div className="text-xs text-amber-800 space-y-1">
                            <h4 className="font-bold">🔒 您目前的管理帳號權限受限</h4>
                            <p className="leading-relaxed text-stone-600">
                              您當前登入的帳號並未包含<strong>「管理權限」(admin)</strong>。您僅能瀏覽當前 HR 成員及進行個人密碼變更，無法新增或註銷成員帳號、或調整他人權限。
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="space-y-1 select-none">
                        <span className="block text-xs font-bold text-stone-500 uppercase tracking-widest leading-none">
                          目前授權之HR成員清單
                        </span>
                        <p className="text-xs text-stone-400">點選右側的「 ＋ 」按鈕能展開該成員權限資訊與系統異動紀錄。</p>
                      </div>

                      <div className="border-t border-stone-200/60 my-2"></div>

                      <div className="space-y-4">
                        {normalizedAdmins.map((admin, idx) => {
                          const isGordon = admin.email.toLowerCase() === gordonEmail;
                          const isExpanded = expandedAdminEmails.includes(admin.email);
                          
                          // Look up real system action logs associated with this administrator
                          const userLogs = activityLogs.filter(
                            log => (log.operatorEmail || '').toLowerCase().trim() === admin.email
                          );
                          
                          return (
                            <div 
                              key={idx} 
                              className="bg-white border border-[#E9E1D6] rounded-xl overflow-hidden shadow-sm hover:shadow transition-all duration-250"
                            >
                              {/* Summary Strip Row */}
                              <div className="p-4 md:p-5 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  {/* Color circular initials badge */}
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold font-mono text-white select-none shadow-sm ${
                                    isGordon ? 'bg-gradient-to-tr from-[#8D1B1B] to-[#b08e4c]' : 'bg-stone-500'
                                  }`}>
                                    {admin.email.substring(0, 2).toUpperCase()}
                                  </div>
                                  
                                  <div>
                                    <div className="flex items-center flex-wrap gap-2">
                                      <span className="text-xs font-bold text-stone-850 font-mono tracking-tight">{admin.email}</span>
                                      {isGordon ? (
                                        <span className="text-[10px] text-[#FAF6F0] bg-[#8D1B1B] border border-[#8D1B1B]/40 px-2 py-0.5 rounded-md flex items-center font-semibold tracking-wide leading-none select-none">
                                          👑 主要管理者
                                        </span>
                                      ) : (
                                        <span className="text-[10px] text-stone-600 bg-stone-100 border border-stone-200 px-2 py-0.5 rounded-md flex items-center font-medium tracking-wide leading-none select-none">
                                          🤝 共同管理者
                                        </span>
                                      )}
                                      <span className="text-[10px] text-[#075041] bg-emerald-50 border border-emerald-150/60 px-2 py-0.5 rounded-md font-semibold tracking-wide leading-none select-none">
                                        🟢 正常啟動
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-stone-400 mt-1">
                                      {isGordon ? '主要系統稽核員 • 具有帳戶管理及全功能權限' : '協作管理者 • 依主管指定功能授權範圍執行任務'}
                                    </p>
                                  </div>
                                </div>
                                
                                {/* Right side controls */}
                                <div className="flex items-center gap-4">
                                  <div className="text-right hidden sm:block select-none">
                                    <span className="block text-[9px] text-stone-400 tracking-wider font-semibold uppercase">擁有最高權限</span>
                                    <span className="text-xs font-bold text-[#8D1B1B] font-mono">{admin.permissions?.length} 項</span>
                                  </div>

                                  {/* Delete Administrator button */}
                                  {hasAdminPermission && !isGordon && admin.email.toLowerCase() !== currentUser.email.toLowerCase() && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setAdminToDelete(admin.email);
                                      }}
                                      type="button"
                                      className="px-2.5 py-1.5 text-[11px] font-bold text-[#D4AF37] bg-[#8D1B1B] hover:bg-[#721515] hover:text-[#D4AF37] rounded-lg border border-rose-200 transition-all cursor-pointer flex items-center gap-1 active:scale-95 select-none shrink-0"
                                      title="註銷此管理者帳號與權限"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                      <span>註銷帳號</span>
                                    </button>
                                  )}
                                  
                                  {/* Expansion indicator button */}
                                  <button
                                    onClick={() => {
                                      const email = admin.email;
                                      setExpandedAdminEmails(prev => 
                                        prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
                                      );
                                    }}
                                    type="button"
                                    className="w-8 h-8 rounded-full border border-stone-200 hover:border-[#8D1B1B] hover:bg-stone-50 hover:text-[#8D1B1B] text-stone-500 font-bold text-base flex items-center justify-center transition-all active:scale-95 cursor-pointer select-none"
                                    title={isExpanded ? "收合詳細資訊 (-)" : "展開詳細資訊 (+)"}
                                  >
                                    {isExpanded ? '−' : '＋'}
                                  </button>
                                </div>
                              </div>
                              
                              {/* Collapsible Details Drawer Panel */}
                              {isExpanded && (
                                <div className="border-t border-stone-100 bg-stone-50/50 p-5 md:p-6 space-y-6">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    
                                    {/* Left Sub-Card: Authorization Detail */}
                                    <div className="bg-white border border-[#E9E1D6]/70 rounded-xl p-4.5 space-y-3 shadow-inner">
                                      <div className="flex items-center gap-1.5 pb-2 border-b border-stone-100">
                                        <span className="text-xs">🔐</span>
                                        <h4 className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                                          人資後台功能與授權清單
                                        </h4>
                                      </div>
                                      
                                      <div className="space-y-2 text-[11px] text-stone-600">
                                        {PERMISSION_OPTIONS.map(opt => {
                                          const hasPerm = admin.permissions?.includes(opt.id);
                                          return (
                                            <div key={opt.id} className="flex items-start gap-2.5 py-1.5 border-b border-dashed border-stone-100 last:border-0">
                                              {hasPerm ? (
                                                <span className="text-emerald-600 font-bold text-xs select-none">✓</span>
                                              ) : (
                                                <span className="text-stone-300 font-bold text-xs select-none">✗</span>
                                              )}
                                              <div className="flex-1">
                                                <span className={`font-semibold block ${hasPerm ? 'text-stone-800 font-bold' : 'text-stone-400 line-through'}`}>
                                                  {opt.label}
                                                </span>
                                                <span className="text-[10px] text-stone-400 font-sans block leading-relaxed mt-0.5">{opt.desc}</span>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                    
                                    {/* Right Sub-Card: Logs Auditing Timeline */}
                                    <div className="bg-white border border-[#E9E1D6]/70 rounded-xl p-4.5 space-y-4 shadow-inner">
                                      <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-xs">📋</span>
                                          <h4 className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                                            操作與異動紀錄
                                          </h4>
                                        </div>
                                        <span className="text-[9px] text-[#8D1B1B] font-bold bg-[#8D1B1B]/10 px-2 py-0.5 rounded-full uppercase tracking-wide select-none">
                                          總操作 {userLogs.length} 次
                                        </span>
                                      </div>
                                      
                                      {userLogs.length === 0 ? (
                                        <div className="text-stone-400 italic text-[11px] py-10 text-center flex flex-col items-center justify-center gap-1.5">
                                          <span>💡 該管理者目前尚無任何異動紀錄。</span>
                                          <span className="text-[10px] text-stone-300 not-italic">在後台新增、修改、發佈或刪除同仁皆會留存異動紀錄。</span>
                                        </div>
                                      ) : (
                                        <div className="space-y-4">
                                          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                                            最近 3 次的異動紀錄：
                                          </span>
                                          <div className="space-y-3.5 relative pl-3.5 border-l border-stone-200">
                                            {userLogs.slice(0, 3).map((log, index) => {
                                              const displayLogDate = new Date(log.timestamp).toLocaleString('zh-TW', {
                                                month: '2-digit',
                                                day: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                second: '2-digit'
                                              });
                                              
                                              return (
                                                <div key={log.id || index} className="relative text-[11px] leading-normal font-sans">
                                                  <div className="-left-[19.5px] top-1 absolute w-2 h-2 rounded-full bg-[#8D1B1B] border border-white"></div>
                                                  <div className="text-stone-400 text-[9px] font-mono flex items-center justify-between gap-2.5">
                                                    <span className="font-semibold text-stone-500">{displayLogDate}</span>
                                                    <span className="text-[8px] bg-stone-100 px-1 py-0.2 rounded border border-stone-150 text-stone-500 uppercase tracking-tight select-none">
                                                      {log.actionType}
                                                    </span>
                                                  </div>
                                                  <div className="text-stone-700 font-semibold mt-0.5">
                                                    關係對象：<span className="text-[#8D1B1B] font-bold">{log.targetEmployee || '全系統 / HR'}</span>
                                                  </div>
                                                  <p className="text-stone-500 mt-0.5 leading-tight font-sans text-[10.5px]">
                                                    {log.details}
                                                  </p>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                      
                                      <div className="pt-2 border-t border-stone-100 text-[10px] text-stone-400 flex justify-between select-none">
                                        <span>連線通道：安全加密 SSL</span>
                                        <span>安全特權：正常授權</span>
                                      </div>
                                    </div>
                                    
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* SUBMENU 2: ADD NEW ADMIN ACCOUNT */}
                {adminsSubMenu === 'add' && (
                  <div className="bg-white border border-[#E9E1D6] rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
                    {!hasAdminPermission && (
                      <div className="bg-amber-50 border border-amber-200/70 p-4 rounded-xl flex items-start gap-3 select-none">
                        <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                        <div className="text-xs text-amber-800 space-y-1">
                          <h4 className="font-bold">🔒 權限受限：無法新增管理者帳號</h4>
                          <p className="leading-relaxed text-stone-600">
                            您當前登入的帳號並未包含<strong>「管理權限」(admin)</strong>。為了保障系統資安與帳戶管理完整性，僅有獲授權管理權限之高階 HR 帳戶方能新增、編輯或刪除管理者。
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-2.5 select-none">
                      <div className="w-9 h-9 rounded-xl bg-[#8D1B1B]/10 flex items-center justify-center text-[#8D1B1B]">
                        <ShieldAlert className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-stone-900">新增協作管理人員帳號 </h3>
                        <p className="text-xs text-stone-400">當新增其他HR管理者信箱後，新HR管理者便可利用其信箱與初始設定密碼登入此後台進行報到作業。</p>
                      </div>
                    </div>

                    <div className="border-t border-stone-200/60 my-1"></div>

                    <form onSubmit={handleAddAdmin} className={`space-y-5 ${!hasAdminPermission ? 'opacity-65' : ''}`}>
                      <div>
                        <label className="block text-xs font-bold text-stone-700 mb-1.5">
                          新增 HR 管理者信箱 (Email) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="email"
                          placeholder="例如：hr_assistant@ldchotels.com"
                          value={newAdminEmail}
                          onChange={e => setNewAdminEmail(e.target.value)}
                          disabled={!hasAdminPermission}
                          className="w-full text-[#8D1B1B] font-mono px-3.5 py-2 text-xs border border-stone-200 rounded-lg focus:outline-none focus:border-[#8D1B1B] bg-stone-50/50 focus:bg-white transition-all shadow-inner"
                          required
                        />
                        <div className="text-[10px] text-stone-400 mt-1.5 select-none">
                          💡 備註：成功新增後，新HR管理者初始預設登入密碼皆為：<span className="font-mono font-bold text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded border border-stone-250/20">mis</span>。登入後可於「帳號管理 ➔ 變更密碼」中更新。
                        </div>
                      </div>

                      {/* Admin Role Category Selector */}
                      <div className="space-y-2.5">
                        <label className="block text-xs font-bold text-stone-700 select-none">
                          管理者角色與級別 <span className="text-rose-500">*</span>
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Primary Admin */}
                          <label
                            className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all duration-200 select-none ${
                              !hasAdminPermission ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                            } ${
                              selectedPermissions.includes('admin')
                                ? 'bg-white border-[#8D1B1B] text-stone-900 shadow-sm ring-1 ring-[#8D1B1B]'
                                : 'bg-stone-50/50 border-stone-200 text-stone-500 hover:bg-stone-100 hover:text-stone-700'
                            }`}
                          >
                            <input
                              type="radio"
                              name="adminRole"
                              checked={selectedPermissions.includes('admin')}
                              disabled={!hasAdminPermission}
                              onChange={() => {
                                if (!hasAdminPermission) return;
                                if (!selectedPermissions.includes('admin')) {
                                  setSelectedPermissions([...selectedPermissions, 'admin']);
                                }
                              }}
                              className="mt-1 h-4 w-4 text-[#8D1B1B] focus:ring-[#8D1B1B] cursor-pointer"
                            />
                            <div className="text-xs leading-normal flex-1">
                              <span className={`font-bold block ${selectedPermissions.includes('admin') ? 'text-[#8D1B1B]' : 'text-stone-700'}`}>
                                👑 總控管理者 (Primary Admin)
                              </span>
                              <span className="text-stone-400 font-sans block text-[10px] mt-1 leading-normal">
                                擁最高系統權限，可建立、註銷其他管理帳號與調整他人授權。
                              </span>
                            </div>
                          </label>

                          {/* Collaborative Admin */}
                          <label
                            className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all duration-200 select-none ${
                              !hasAdminPermission ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                            } ${
                              !selectedPermissions.includes('admin')
                                ? 'bg-white border-[#8D1B1B] text-stone-900 shadow-sm ring-1 ring-[#8D1B1B]'
                                : 'bg-stone-50/50 border-stone-200 text-stone-500 hover:bg-stone-100 hover:text-stone-700'
                            }`}
                          >
                            <input
                              type="radio"
                              name="adminRole"
                              checked={!selectedPermissions.includes('admin')}
                              disabled={!hasAdminPermission}
                              onChange={() => {
                                if (!hasAdminPermission) return;
                                if (selectedPermissions.includes('admin')) {
                                  const filtered = selectedPermissions.filter(p => p !== 'admin');
                                  setSelectedPermissions(filtered.length > 0 ? filtered : ['tracker']);
                                }
                              }}
                              className="mt-1 h-4 w-4 text-[#8D1B1B] focus:ring-[#8D1B1B] cursor-pointer"
                            />
                            <div className="text-xs leading-normal flex-1">
                              <span className={`font-bold block ${!selectedPermissions.includes('admin') ? 'text-[#8D1B1B]' : 'text-stone-700'}`}>
                                🤝 協作管理者 (Collaborative Admin)
                              </span>
                              <span className="text-stone-400 font-sans block text-[10px] mt-1 leading-normal">
                                日常協作/執行權限，不具備新增或註銷其他管理者帳號之能力。
                              </span>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Permissions select checklist */}
                      <div className="space-y-2.5">
                        <label className="block text-xs font-bold text-stone-700 select-none">
                          指定主管與夥伴可處理與檢閱之項目權限： <span className="text-stone-400 font-normal font-sans">(最少必須指定一項)</span>
                        </label>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-stone-50 p-4 rounded-xl border border-stone-200 shadow-inner">
                          {PERMISSION_OPTIONS.filter(opt => opt.id !== 'admin').map(opt => {
                            const checked = selectedPermissions.includes(opt.id);
                            return (
                              <label 
                                key={opt.id} 
                                className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition select-none ${
                                  !hasAdminPermission ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                                } ${
                                  checked 
                                    ? 'bg-white border-[#8D1B1B]/20 text-stone-800 font-medium shadow-sm' 
                                    : 'bg-stone-50/50 border-transparent text-stone-500 hover:bg-stone-100 hover:text-stone-700'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={!hasAdminPermission}
                                  onChange={() => {
                                    if (!hasAdminPermission) return;
                                    if (checked) {
                                      const nonAdminSelected = selectedPermissions.filter(p => p !== 'admin');
                                      if (nonAdminSelected.length > 1) {
                                        setSelectedPermissions(selectedPermissions.filter(p => p !== opt.id));
                                      }
                                    } else {
                                      setSelectedPermissions([...selectedPermissions, opt.id]);
                                    }
                                  }}
                                  className="mt-1 h-4 w-4 rounded border-stone-305 text-[#8D1B1B] focus:ring-[#8D1B1B] cursor-pointer"
                                />
                                <div className="text-[11px] leading-normal flex-1">
                                  <span className={`font-bold block ${checked ? 'text-[#8D1B1B]' : 'text-stone-700'}`}>
                                    {opt.label}
                                  </span>
                                  <span className="text-stone-400 font-sans block text-[10px] mt-0.5 leading-tight">
                                    {opt.desc}
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {hasAdminPermission ? (
                        <button
                          type="submit"
                          className="w-full py-3 bg-[#343131] hover:bg-stone-900 text-[#D4AF37] font-bold text-xs rounded-xl shadow border border-[#D4AF37]/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.99]"
                        >
                          <Plus className="w-4 h-4" />
                          確認新增
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="w-full py-3 bg-stone-100 text-stone-400 border border-stone-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-not-allowed select-none"
                          disabled
                        >
                          🔒 管理權限已鎖定：僅管理員帳號可新增
                        </button>
                      )}
                    </form>
                  </div>
                )}

                {/* SUBMENU 3: CHANGE PASSWORD */}
                {adminsSubMenu === 'password' && (
                  <div className="bg-white border border-[#E9E1D6] rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
                    <div className="flex items-start gap-2.5 select-none">
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-150 flex items-center justify-center text-indigo-600">
                        <KeyRound className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-stone-900">管理者密碼安全管理</h3>
                        <p className="text-xs text-stone-400">變更您的 LDC 人資後台登入密碼，以維持同仁個資安全。</p>
                      </div>
                    </div>

                    <div className="border-t border-stone-200/60 my-1"></div>

                    <form onSubmit={handleChangePassword} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-stone-600 mb-1">
                          目前登入之管理者帳號 (Your Email)
                        </label>
                        <input
                          type="text"
                          value={currentUser?.email || ''}
                          disabled
                          className="w-full text-stone-500 font-mono px-3.5 py-2.5 text-xs border border-stone-200 rounded-lg bg-stone-100 cursor-not-allowed select-none font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          請輸入原先使用之密碼 <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="password"
                          placeholder="請輸入您原先使用的舊密碼"
                          value={oldPassword}
                          onChange={e => setOldPassword(e.target.value)}
                          className="w-full text-stone-900 px-3.5 py-2.5 text-xs border border-stone-200 bg-stone-50/50 focus:bg-white rounded-lg focus:outline-none focus:border-[#8D1B1B] shadow-inner font-mono"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1">
                            建立新的管理者密碼 <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="password"
                            placeholder="長度請至少包含 3 個字元"
                            value={newPasswordValue}
                            onChange={e => setNewPasswordValue(e.target.value)}
                            className="w-full text-stone-900 px-3.5 py-2.5 text-xs border border-stone-200 bg-stone-50/50 focus:bg-white rounded-lg focus:outline-none focus:border-[#8D1B1B] shadow-inner font-mono"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1">
                            請再次確認輸入新密碼 <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="password"
                            placeholder="請重新輸入以完成校對"
                            value={confirmNewPassword}
                            onChange={e => setConfirmNewPassword(e.target.value)}
                            className="w-full text-stone-900 px-3.5 py-2.5 text-xs border border-stone-200 bg-stone-50/50 focus:bg-white rounded-lg focus:outline-none focus:border-[#8D1B1B] shadow-inner font-mono"
                            required
                          />
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={pwSubmitting}
                          className="w-full py-3 bg-[#343131] text-[#D4AF37] font-semibold text-xs rounded-xl shadow hover:bg-stone-900 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border border-[#D4AF37]/15 active:scale-[0.99]"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          {pwSubmitting ? '正在進行變更安全中存檔...' : '儲存與套用新密碼'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* SUBMENU 4: TRANSFER PRIMARY ADMIN */}
                {adminsSubMenu === 'transfer' && (
                  <div className="bg-white border border-[#E9E1D6] rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
                    <div className="flex items-start gap-2.5 select-none">
                      <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-150 flex items-center justify-center text-amber-600">
                        <ArrowRightLeft className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-stone-900">移轉主要管理者</h3>
                        <p className="text-xs text-stone-400">將系統的「主要管理者 (Primary Admin)」權限移轉予其他已授權的 HR 帳號。完成後您的權限將調整為協作管理者。</p>
                      </div>
                    </div>

                    <div className="border-t border-stone-200/60 my-1"></div>

                    {currentUser.email.toLowerCase().trim() !== primaryAdminEmail ? (
                      <div className="bg-amber-50 border border-amber-200/70 p-5 rounded-xl flex items-start gap-3 select-none">
                        <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                        <div className="text-xs text-amber-800 space-y-1">
                          <h4 className="font-bold">🔒 您目前無權執行主要管理者移轉</h4>
                          <p className="leading-relaxed text-stone-600">
                            「移轉主要管理者」為最高安全層級之操作，僅有當前的主要管理者 <strong>{primaryAdminEmail}</strong> 能夠行使此項功能。
                          </p>
                        </div>
                      </div>
                    ) : (() => {
                      const otherAdmins = normalizedAdmins.filter(
                        (admin: any) => admin.email.toLowerCase().trim() !== primaryAdminEmail
                      );

                      if (otherAdmins.length === 0) {
                        return (
                          <div className="bg-amber-50 border border-amber-200/70 p-5 rounded-xl flex items-start gap-3 select-none">
                            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                            <div className="text-xs text-amber-800 space-y-1">
                              <h4 className="font-bold">⚠️ 無可供移轉之其他管理者帳號</h4>
                              <p className="leading-relaxed text-stone-600">
                                系統內目前除了您以外，尚無其他協作管理者。請先至<strong>「新增管理員帳號」</strong>中，為您的接任/承接者建立 HR 管理帳號，再回到此頁面執行移轉。
                              </p>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <form onSubmit={handleTransferPrimary} className="space-y-5">
                          <div className="bg-stone-50 border border-stone-150 rounded-xl p-4 text-xs text-stone-600 leading-relaxed space-y-1.5 select-none">
                            <p className="font-semibold text-stone-700">📌 權限安全移轉說明：</p>
                            <ul className="list-disc list-inside space-y-0.5 text-stone-500">
                              <li>主要管理者在系統中僅能保留一位，主要用於重要資料之稽核與管理者管理。</li>
                              <li>完成移轉後，新指定之同仁將取得<strong>主要管理者</strong>權限，您自身將調整為<strong>協作管理者</strong>。</li>
                              <li>此項移轉將同步更新本機資料庫與雲端安全認證，一經送出後便無法自行取消或復原。</li>
                            </ul>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                              指定新任主要管理者 (請由目前成員名單中選擇) <span className="text-rose-500">*</span>
                            </label>
                            <select
                              value={transferTargetEmail}
                              onChange={e => setTransferTargetEmail(e.target.value)}
                              className="w-full text-stone-900 px-3 py-2.5 text-xs border border-stone-200 bg-stone-50/50 focus:bg-white rounded-lg focus:outline-none focus:border-[#8D1B1B] font-mono cursor-pointer"
                              required
                            >
                              <option value="">-- 請選擇接任 HR 管理者電子信箱 --</option>
                              {otherAdmins.map((admin: any) => (
                                <option key={admin.email} value={admin.email}>
                                  {admin.email} {admin.permissions?.includes('admin') ? '(包含管理權限)' : '(協作管理)'}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex items-start gap-2.5 select-none">
                            <input
                              type="checkbox"
                              id="transferConfirm"
                              checked={transferConfirmCheckbox}
                              onChange={e => setTransferConfirmCheckbox(e.target.checked)}
                              className="mt-0.5 w-4 h-4 text-[#8D1B1B] border-stone-300 rounded focus:ring-[#8D1B1B] cursor-pointer"
                            />
                            <label htmlFor="transferConfirm" className="text-xs text-stone-600 leading-relaxed cursor-pointer font-medium select-none">
                              我已充分瞭解上述說明，並確認要將「主要管理者」最高管理角色，正式移轉授予給指定的承接同仁。
                            </label>
                          </div>

                          <div className="pt-2">
                            <button
                              type="submit"
                              disabled={transferSubmitting || !transferTargetEmail || !transferConfirmCheckbox}
                              className="w-full py-3 bg-[#8D1B1B] text-[#D4AF37] hover:bg-[#701515] font-semibold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border border-[#D4AF37]/15 active:scale-[0.99]"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                              {transferSubmitting ? '正在安全地移轉角色權限中...' : '確認並移轉主要管理者權限'}
                            </button>
                          </div>
                        </form>
                      );
                    })()}
                  </div>
                )}

              </div>
            </div>
          );
        })()}



        {/* 5. Activity logs panel */}
        {activeMenu === 'logs' && (
          <div className="bg-white border border-[#EAE4DC] rounded-2xl shadow-sm overflow-hidden p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-100 pb-5">
              <div>
                <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-[#8D1B1B]" />
                  後台安全與異動紀錄追蹤
                </h3>
                <p className="text-xs text-stone-500 mt-1">
                  即時追蹤 HR 管理人員在後台操作之異動紀錄（新增人員、修改員工編號、刪除同仁或退回資料等）。
                </p>
              </div>
              <div className="flex items-center gap-2 self-start md:self-center">
                <button
                  onClick={downloadLogsExcel}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  匯出 Excel
                </button>
                <button
                  onClick={fetchActivityLogs}
                  className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  disabled={logsLoading}
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${logsLoading ? 'animate-spin' : ''}`} />
                  重新整理
                </button>
              </div>
            </div>

            {logsLoading && activityLogs.length === 0 ? (
              <div className="py-20 text-center text-stone-400 text-xs">
                載入異動紀錄中...
              </div>
            ) : activityLogs.length === 0 ? (
              <div className="py-20 text-center text-stone-400 text-xs">
                🌿 目前尚無任何異動操作紀錄。
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-50/75 border-b border-stone-200 text-stone-600 font-bold">
                      <th className="p-3 w-[160px]">日期與時間</th>
                      <th className="p-3 w-[180px]">操作管理者</th>
                      <th className="p-3 w-[120px]">人員</th>
                      <th className="p-3 w-[140px]">異動項目</th>
                      <th className="p-3">異動紀錄細項</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {activityLogs.map((log) => {
                      const displayDate = new Date(log.timestamp).toLocaleString('zh-TW', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false
                      });
                      
                      let badgeColor = 'bg-stone-105 text-stone-700 border border-stone-200';
                      let actionText = log.actionType;
                      if (log.actionType === 'CREATE_EMPLOYEE') {
                        badgeColor = 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-semibold';
                        actionText = '➕ 建立報到工作';
                      } else if (log.actionType === 'DELETE_EMPLOYEE') {
                        badgeColor = 'bg-rose-50 text-rose-700 border border-rose-200/60 font-semibold';
                        actionText = '🗑️ 刪除同仁資料';
                      } else if (log.actionType === 'REJECT_ONBOARDING') {
                        badgeColor = 'bg-amber-50 text-amber-700 border border-amber-200/60 font-semibold';
                        actionText = '🔄 退回報到修改';
                      } else if (log.actionType === 'UPDATE_EMP_ID') {
                        badgeColor = 'bg-blue-50 text-blue-700 border border-blue-200/60 font-semibold';
                        actionText = '🆔 變更員工編號';
                      } else if (log.actionType === 'ADD_ADMIN') {
                        badgeColor = 'bg-purple-50 text-purple-700 border border-purple-200/60 font-semibold';
                        actionText = '🤝 新增管理人員';
                      }

                      return (
                        <tr key={log.id} className="hover:bg-stone-50/40 transition-colors">
                          <td className="p-3 text-stone-500 font-mono tracking-tight">{displayDate}</td>
                          <td className="p-3">
                            <div className="font-semibold text-stone-800">{log.operatorName || '系統管理員'}</div>
                            <div className="text-[10px] text-stone-400 font-mono">{log.operatorEmail}</div>
                          </td>
                          <td className="p-3 font-semibold text-stone-700">{log.employeeName}</td>
                          <td className="p-3">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] ${badgeColor}`}>
                              {actionText}
                            </span>
                          </td>
                          <td className="p-3 text-stone-600 font-medium leading-relaxed">{log.details}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </main>

      {/* Custom print overlay modal */}
      {printingEmp && printFields && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[999999] overflow-y-auto bg-stone-900/60 p-4 md:p-8 flex items-start justify-center print-modal-overlay">
          <div className="bg-stone-100 max-w-4xl w-full rounded-2xl shadow-2xl border border-stone-200 overflow-hidden my-4 text-left print-modal-card">
            {/* Modal headers - strictly non-printing */}
            <div className="bg-stone-900 text-[#D4AF37] px-6 py-4 flex items-center justify-between sticky top-0 z-10 border-b border-[#D4AF37]/30 no-print-el">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-stone-850 flex items-center justify-center border border-[#D4AF37]/20">
                  <Printer className="w-5 h-5 text-[#D4AF37]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">🖨️ 職工人事資料卡 列印預覽</h3>
                  <p className="text-[10px] text-stone-400">表格欄位皆可直接編輯微調，確認無誤後點選列印列格式輸出，並於印校對話框選擇「另存為 PDF」。</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    window.focus();
                    window.print();
                  }}
                  className="px-4 py-2 bg-[#343131] hover:bg-[#721515] text-[#FAF6F0] text-xs font-bold rounded-lg flex items-center gap-1.5 shadow border border-[#D4AF37]/25 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  確認列印 / 另存 PDF
                </button>
                <button
                  onClick={() => setPrintingEmp(null)}
                  className="px-3.5 py-2 bg-stone-850 hover:bg-stone-800 text-stone-300 text-xs font-semibold rounded-lg border border-stone-700 cursor-pointer"
                >
                  離開預覽
                </button>
              </div>
            </div>

            {/* Hint alert for iframe printing restrictions */}
            <div className="bg-amber-50 border-b border-amber-200 px-6 py-3.5 text-xs text-amber-800 flex items-start gap-2.5 leading-relaxed no-print-el">
              <span className="text-sm mt-0.5">⚠️</span>
              <div>
                <strong className="font-semibold">預覽環境列印提示：</strong>
                因為瀏覽器出於安全考量會限制內嵌架構 (iFrame) 呼叫列印。若您在開發預覽中點擊上方的「確認列印」按鈕無反應，請點選此預覽視窗右下角或外側的 <span className="font-bold underline text-amber-950">「在新分頁中開啟 / Open in new tab」</span> 按鈕，於獨立分頁重新開啟本系統，即可完美執行列印並直接「另存為 PDF」！
              </div>
            </div>

            {/* Paper Container - styled to look like an A4 page */}
            <div className="p-8 bg-neutral-200/40 flex justify-center overflow-auto print-paper-container">
              <div className="bg-white print-page-a4 p-10 md:p-14 w-[210mm] min-h-[297mm] shadow-xl border border-stone-250 text-stone-900 mx-auto font-sans relative antialiased">
                
                

                {/* Printable Area mount points */}
                <div className="w-full">
                  {/* Document Header */}
                  <div className="text-center space-y-1 mb-6 text-black">
                    <h2 className="text-xl font-bold tracking-[6px] text-stone-950 font-serif">{getCompanyDetails(printingEmp).name}</h2>
                    <h3 className="text-sm font-bold tracking-[8px] text-stone-900 font-serif">職工人事資料卡</h3>
                  </div>

                  {/* General Employee Identifiers row */}
                  <div className="flex justify-between items-center text-xs text-stone-850 mb-3 px-1">
                    <div>
                      <span className="font-semibold text-stone-700">員工編號：</span>
                      <input 
                        type="text" 
                        value={printFields.empId} 
                        onChange={e => setPrintFields({...printFields, empId: e.target.value})}
                        className="w-24 bg-transparent border-b border-stone-300 font-mono text-center font-bold focus:outline-none" 
                      />
                    </div>
                    <div>
                      <span className="font-semibold text-stone-700">館別：</span>
                      <input 
                        type="text" 
                        value={printFields.branchName} 
                        onChange={e => setPrintFields({...printFields, branchName: e.target.value})}
                        className="w-32 bg-transparent border-b border-stone-300 text-center font-bold focus:outline-none" 
                      />
                    </div>
                    <div>
                      <span className="font-semibold text-stone-700">到職日期：</span>
                      <input 
                        type="text" 
                        value={printFields.onboardDate} 
                        onChange={e => setPrintFields({...printFields, onboardDate: e.target.value})}
                        className="w-28 bg-transparent border-b border-stone-300 font-mono text-center font-bold focus:outline-none" 
                      />
                    </div>
                  </div>

                  {/* Main table grid */}
                  <table className="w-full border-collapse border border-stone-800 text-stone-900 text-xs text-left">
                    <tbody>
                      {/* Row 1: Profile and Portrait */}
                      <tr className="h-10">
                        <td rowSpan={4} className="border border-stone-800 w-[110px] text-center p-1 relative">
                          {printingEmp.personalData?.avatarUrl ? (
                            <div className="flex flex-col items-center justify-center p-0.5">
                              <img src={printingEmp.personalData.avatarUrl} alt="個人照" className="max-h-[125px] max-w-[95px] object-cover border border-stone-200" referrerPolicy="no-referrer" />
                              <span className="text-[8px] text-stone-400 mt-1 block no-print">自動載入申報大頭照</span>
                            </div>
                          ) : (
                            <div className="text-[10px] text-stone-400 py-10 leading-relaxed font-semibold text-center w-full">
                              黏貼二吋<br />照片處
                            </div>
                          )}
                        </td>
                        <td className="border border-stone-800 bg-stone-100/50 text-[11px] font-bold text-center w-[70px] py-1">姓&nbsp;&nbsp;&nbsp;&nbsp;名</td>
                        <td className="border border-stone-800 px-2 py-1 w-[110px]">
                          <input 
                            type="text" 
                            value={printFields.name} 
                            onChange={e => setPrintFields({...printFields, name: e.target.value})}
                            className="w-full bg-transparent border-none text-xs font-bold text-stone-950 focus:outline-none focus:bg-amber-50/50" 
                          />
                        </td>
                        <td className="border border-stone-800 bg-stone-100/50 text-[11px] font-bold text-center w-[70px]">性&nbsp;&nbsp;&nbsp;&nbsp;別</td>
                        <td className="border border-stone-800 px-2 py-1 w-[90px]">
                          <input 
                            type="text" 
                            value={printFields.gender} 
                            onChange={e => setPrintFields({...printFields, gender: e.target.value})}
                            className="w-full bg-transparent border-none text-xs text-center focus:outline-none focus:bg-amber-50/50" 
                          />
                        </td>
                        <td className="border border-stone-800 bg-stone-100/50 text-[11px] font-bold text-center w-[70px]">出生日期</td>
                        <td colSpan={2} className="border border-stone-800 px-2 py-1">
                          <input 
                            type="text" 
                            value={printFields.birthday} 
                            onChange={e => setPrintFields({...printFields, birthday: e.target.value})}
                            className="w-full bg-transparent border-none text-xs text-stone-950 focus:outline-none focus:bg-amber-50/50 font-mono" 
                          />
                        </td>
                      </tr>

                      {/* Row 2 */}
                      <tr className="h-10">
                        <td className="border border-stone-800 bg-stone-100/50 text-[11px] font-bold text-center py-1">電&nbsp;&nbsp;&nbsp;&nbsp;話</td>
                        <td className="border border-stone-800 px-2 py-1">
                          <input 
                            type="text" 
                            value={printFields.phone} 
                            onChange={e => setPrintFields({...printFields, phone: e.target.value})}
                            className="w-full bg-transparent border-none text-xs focus:outline-none focus:bg-amber-50/50 font-mono" 
                          />
                        </td>
                        <td className="border border-stone-800 bg-stone-100/50 text-[11px] font-bold text-center">血&nbsp;&nbsp;&nbsp;&nbsp;型</td>
                        <td className="border border-stone-800 px-2 py-1">
                          <input 
                            type="text" 
                            value={printFields.bloodType} 
                            onChange={e => setPrintFields({...printFields, bloodType: e.target.value})}
                            className="w-full bg-transparent border-none text-xs text-center font-bold focus:outline-none focus:bg-amber-50/50" 
                          />
                        </td>
                        <td className="border border-stone-800 bg-stone-100/50 text-[10px] font-bold text-center">身分證字號</td>
                        <td colSpan={2} className="border border-stone-800 px-2 py-1">
                          <input 
                            type="text" 
                            value={printFields.idNumber} 
                            onChange={e => setPrintFields({...printFields, idNumber: e.target.value})}
                            className="w-full bg-transparent border-none text-xs font-mono uppercase tracking-wider text-stone-950 focus:outline-none focus:bg-amber-50/50" 
                          />
                        </td>
                      </tr>

                      {/* Row 3 */}
                      <tr className="h-10">
                        <td className="border border-stone-800 bg-stone-100/50 text-[11px] font-bold text-center py-1">戶籍地址</td>
                        <td colSpan={6} className="border border-stone-800 px-2 py-1">
                          <input 
                            type="text" 
                            value={printFields.legalAddress} 
                            onChange={e => setPrintFields({...printFields, legalAddress: e.target.value})}
                            className="w-full bg-transparent border-none text-[11px] text-stone-900 focus:outline-none focus:bg-amber-50/50" 
                          />
                        </td>
                      </tr>

                      {/* Row 4 */}
                      <tr className="h-10">
                        <td className="border border-stone-800 bg-stone-100/50 text-[11px] font-bold text-center py-1">通訊地址</td>
                        <td colSpan={6} className="border border-stone-800 px-2 py-1">
                          <input 
                            type="text" 
                            value={printFields.contactAddress} 
                            onChange={e => setPrintFields({...printFields, contactAddress: e.target.value})}
                            className="w-full bg-transparent border-none text-[11px] text-stone-900 focus:outline-none focus:bg-amber-50/50" 
                          />
                        </td>
                      </tr>

                      {/* Row 5: 保證人 */}
                      <tr className="h-10">
                        <td className="border border-stone-800 bg-stone-100/50 text-[11px] font-bold text-center py-1 font-serif">保&nbsp;證&nbsp;人</td>
                        <td className="border border-stone-800 px-2 py-1">
                          <input 
                            type="text" 
                            value={printFields.guarantorName} 
                            onChange={e => setPrintFields({...printFields, guarantorName: e.target.value})}
                            className="w-full bg-transparent border-none text-[11px] focus:outline-none focus:bg-amber-50/50" 
                          />
                        </td>
                        <td className="border border-stone-800 bg-stone-100/50 text-[11px] font-bold text-center">通訊地址</td>
                        <td colSpan={2} className="border border-stone-800 px-2 py-1">
                          <input 
                            type="text" 
                            value={printFields.guarantorAddress} 
                            onChange={e => setPrintFields({...printFields, guarantorAddress: e.target.value})}
                            className="w-full bg-transparent border-none text-[11px] focus:outline-none focus:bg-amber-50/50" 
                          />
                        </td>
                        <td className="border border-stone-800 bg-stone-100/50 text-[11px] font-bold text-center">電&nbsp;&nbsp;&nbsp;&nbsp;話</td>
                        <td colSpan={2} className="border border-stone-800 px-2 py-1">
                          <input 
                            type="text" 
                            value={printFields.guarantorPhone} 
                            onChange={e => setPrintFields({...printFields, guarantorPhone: e.target.value})}
                            className="w-full bg-transparent border-none text-xs font-mono focus:outline-none focus:bg-amber-50/50" 
                          />
                        </td>
                      </tr>

                      {/* Row 6: Heading row for Experiences / Exams */}
                      <tr className="h-8">
                        <td colSpan={5} className="border border-stone-800 bg-[#FAF9F6] text-[11px] font-bold text-stone-900 text-center tracking-[4px] py-1.5 font-serif">
                          經&nbsp;&nbsp;&nbsp;&nbsp;歷
                        </td>
                        <td colSpan={3} className="border border-stone-800 bg-[#FAF9F6] text-[11px] font-bold text-stone-900 text-center tracking-[2px] py-1.5 font-serif">
                          訓練或專業證照
                        </td>
                      </tr>

                      {/* Row 7: Sub Headers */}
                      <tr className="h-7 text-stone-700 bg-stone-50/50">
                        <td colSpan={2} className="border border-stone-800 text-[10px] font-medium text-center py-1">起訖年月</td>
                        <td colSpan={2} className="border border-stone-800 text-[10px] font-medium text-center">服務單位</td>
                        <td className="border border-stone-800 text-[10px] font-medium text-center font-serif text-center">職&nbsp;&nbsp;稱</td>
                        <td className="border border-stone-800 text-[10px] font-medium text-center">時&nbsp;&nbsp;間</td>
                        <td className="border border-stone-800 text-[10px] font-medium text-center">證照名稱</td>
                        <td className="border border-stone-800 text-[10px] font-medium text-center">證照級別</td>
                      </tr>

                      {/* Rows 8, 9, 10: Experiences and Licenses details */}
                      {[0, 1, 2].map((idx) => (
                        <tr key={`print-career-row-${idx}`} className="h-9">
                          <td colSpan={2} className="border border-stone-800 px-1 py-0.5">
                            <input 
                              type="text" 
                              value={printFields.experiences[idx]?.period || ''} 
                              onChange={e => {
                                const updated = [...printFields.experiences];
                                updated[idx].period = e.target.value;
                                setPrintFields({...printFields, experiences: updated});
                              }}
                              className="w-full bg-transparent border-none text-[11px] focus:outline-none focus:bg-amber-50/50 text-center font-mono" 
                            />
                          </td>
                          <td colSpan={2} className="border border-stone-800 px-1.5 py-0.5">
                            <input 
                              type="text" 
                              value={printFields.experiences[idx]?.company || ''} 
                              onChange={e => {
                                const updated = [...printFields.experiences];
                                updated[idx].company = e.target.value;
                                setPrintFields({...printFields, experiences: updated});
                              }}
                              className="w-full bg-transparent border-none text-[11px] focus:outline-none focus:bg-amber-50/50" 
                            />
                          </td>
                          <td className="border border-stone-800 px-1.5 py-0.5">
                            <input 
                              type="text" 
                              value={printFields.experiences[idx]?.title || ''} 
                              onChange={e => {
                                const updated = [...printFields.experiences];
                                updated[idx].title = e.target.value;
                                setPrintFields({...printFields, experiences: updated});
                              }}
                              className="w-full bg-transparent border-none text-[11px] focus:outline-none focus:bg-amber-50/50" 
                            />
                          </td>
                          
                          {/* Licenses */}
                          <td className="border border-stone-800 px-1 py-0.5">
                            <input 
                              type="text" 
                              value={printFields.licenses[idx]?.time || ''} 
                              onChange={e => {
                                const updated = [...printFields.licenses];
                                updated[idx].time = e.target.value;
                                setPrintFields({...printFields, licenses: updated});
                              }}
                              className="w-full bg-transparent border-none text-[11px] focus:outline-none focus:bg-amber-50/50 text-center font-mono" 
                            />
                          </td>
                          <td className="border border-stone-800 px-1.5 py-0.5">
                            <input 
                              type="text" 
                              value={printFields.licenses[idx]?.cate || ''} 
                              onChange={e => {
                                const updated = [...printFields.licenses];
                                updated[idx].cate = e.target.value;
                                setPrintFields({...printFields, licenses: updated});
                              }}
                              className="w-full bg-transparent border-none text-[11px] focus:outline-none focus:bg-amber-50/50" 
                            />
                          </td>
                          <td className="border border-stone-800 px-1.5 py-0.5">
                            <input 
                              type="text" 
                              value={printFields.licenses[idx]?.level || ''} 
                              onChange={e => {
                                const updated = [...printFields.licenses];
                                updated[idx].level = e.target.value;
                                setPrintFields({...printFields, licenses: updated});
                              }}
                              className="w-full bg-transparent border-none text-[11px] focus:outline-none focus:bg-amber-50/50" 
                            />
                          </td>
                        </tr>
                      ))}

                      {/* Row 11: Section Heading: 學歷 and 語言 */}
                      <tr className="h-8">
                        <td colSpan={4} className="border border-stone-800 bg-[#FAF9F6] text-[11px] font-bold text-stone-900 text-center tracking-[4px] py-1.5 font-serif">
                          學&nbsp;&nbsp;&nbsp;&nbsp;歷
                        </td>
                        <td colSpan={4} className="border border-stone-800 bg-[#FAF9F6] text-[11px] font-bold text-stone-900 text-center tracking-[4px] py-1.5 font-serif">
                          語&nbsp;&nbsp;言&nbsp;&nbsp;能&nbsp;&nbsp;力
                        </td>
                      </tr>

                      {/* Sub Headers for Edu / Lang */}
                      <tr className="h-7 text-stone-700 bg-stone-50/50">
                        <td className="border border-stone-800 text-[10px] font-medium text-center py-1">學校名稱</td>
                        <td className="border border-stone-800 text-[10px] font-medium text-center">科系</td>
                        <td className="border border-stone-800 text-[10px] font-medium text-center">起訖年月</td>
                        <td className="border border-stone-800 text-[10px] font-medium text-center">畢 (肄)</td>
                        <td className="border border-stone-800 text-[10px] font-medium text-center font-serif text-center">種&nbsp;&nbsp;類</td>
                        <td colSpan={3} className="border border-stone-800 text-[10px] font-medium text-center">程&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;度</td>
                      </tr>

                      {/* 4 Rows for side by side Edu and Language */}
                      {['english', 'japanese', 'korean', 'other'].map((langKey, idx) => {
                        const isEnglish = langKey === 'english';
                        const isJapanese = langKey === 'japanese';
                        const isKorean = langKey === 'korean';
                        const isOther = langKey === 'other';

                        const langName = isEnglish ? '英 文' : isJapanese ? '日 文' : isKorean ? '韓 文' : '其 他';
                        const currentLevel = printFields.langLevels[langKey === 'other' ? 'otherLevel' : langKey];

                        return (
                          <tr key={`print-edu-lang-row-${langKey}`} className="h-9">
                            {idx < 3 ? (
                              <>
                                <td className="border border-stone-800 px-1 py-0.5">
                                  <input 
                                    type="text" 
                                    value={printFields.educations[idx]?.school || ''} 
                                    onChange={e => {
                                      const updated = [...printFields.educations];
                                      updated[idx].school = e.target.value;
                                      setPrintFields({...printFields, educations: updated});
                                    }}
                                    className="w-full bg-transparent border-none text-[11px] focus:outline-none focus:bg-amber-50/50" 
                                  />
                                </td>
                                <td className="border border-stone-800 px-1 py-0.5">
                                  <input 
                                    type="text" 
                                    value={printFields.educations[idx]?.major || ''} 
                                    onChange={e => {
                                      const updated = [...printFields.educations];
                                      updated[idx].major = e.target.value;
                                      setPrintFields({...printFields, educations: updated});
                                    }}
                                    className="w-full bg-transparent border-none text-[11px] focus:outline-none focus:bg-amber-50/50" 
                                  />
                                </td>
                                <td className="border border-stone-800 px-1 py-0.5 text-center">
                                  <input 
                                    type="text" 
                                    value={printFields.educations[idx]?.period || ''} 
                                    onChange={e => {
                                      const updated = [...printFields.educations];
                                      updated[idx].period = e.target.value;
                                      setPrintFields({...printFields, educations: updated});
                                    }}
                                    className="w-full bg-transparent border-none text-[11px] focus:outline-none focus:bg-amber-50/50 text-center font-mono" 
                                  />
                                </td>
                                <td className="border border-stone-800 px-1 py-0.5 text-center">
                                  <input 
                                    type="text" 
                                    value={printFields.educations[idx]?.status || ''} 
                                    onChange={e => {
                                      const updated = [...printFields.educations];
                                      updated[idx].status = e.target.value;
                                      setPrintFields({...printFields, educations: updated});
                                    }}
                                    className="w-full bg-transparent border-none text-[11px] text-center focus:outline-none focus:bg-amber-50/50" 
                                  />
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="border border-stone-800 bg-stone-50/40"></td>
                                <td className="border border-stone-800 bg-stone-50/40"></td>
                                <td className="border border-stone-800 bg-stone-50/40"></td>
                                <td className="border border-stone-800 bg-stone-50/40"></td>
                              </>
                        )}

                            {/* Languages columns */}
                            <td className="border border-stone-800 bg-stone-100/50 text-[11px] font-bold text-center py-1 select-none">
                              {isOther ? (
                                <div className="flex items-center gap-1 justify-center">
                                  <span>其他:</span>
                                  <input 
                                    type="text" 
                                    value={printFields.langLevels.otherName || ''} 
                                    onChange={e => {
                                      setPrintFields({
                                        ...printFields,
                                        langLevels: {
                                          ...printFields.langLevels,
                                          otherName: e.target.value
                                        }
                                      });
                                    }}
                                    className="w-10 bg-transparent border-b border-stone-300 font-bold focus:outline-none text-[10px] text-center" 
                                  />
                                </div>
                          ) : (
                            langName
                          )}
                            </td>
                            <td colSpan={3} className="border border-stone-800 px-1 py-0.5">
                              <div className="flex items-center justify-around h-full gap-0.5 text-[9px] text-stone-850">
                                {['expert', 'good', 'medium', 'fluent'].map((lvl) => {
                                  const label = lvl === 'expert' ? '精通' : lvl === 'good' ? '優良' : lvl === 'medium' ? '中等' : '略懂';
                                  const langField = isOther ? 'otherLevel' : langKey;
                                  const isChecked = printFields.langLevels[langField] === lvl;

                                  return (
                                    <label key={lvl} className="flex items-center gap-0.5 cursor-pointer hover:bg-stone-50 px-1 py-0.5 rounded leading-none">
                                      <input 
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          setPrintFields({
                                            ...printFields,
                                            langLevels: {
                                              ...printFields.langLevels,
                                              [langField]: isChecked ? 'none' : lvl
                                            }
                                          });
                                        }}
                                        className="w-3.5 h-3.5 border-stone-400 text-[#8D1B1B] rounded focus:ring-[#8D1B1B] cursor-pointer"
                                      />
                                      <span>{label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                    );
                  })}

                      {/* Row 12: Family information section heading */}
                      <tr className="h-8">
                        <td colSpan={8} className="border border-stone-800 bg-[#FAF9F6] text-[11px] font-bold text-stone-900 text-center tracking-[4px] py-1.5 font-serif">
                          家&nbsp;&nbsp;庭&nbsp;&nbsp;狀&nbsp;&nbsp;況
                        </td>
                      </tr>

                      {/* Family Column Sub Headers */}
                      <tr className="h-7 text-stone-700 bg-stone-50/50">
                        <td className="border border-stone-800 text-[10px] font-medium text-center py-1">稱 謂</td>
                        <td className="border border-stone-800 text-[10px] font-medium text-center">姓 名</td>
                        <td className="border border-stone-800 text-[10px] font-medium text-center">出生日期</td>
                        <td className="border border-stone-800 text-[10px] font-medium text-center">教育程度</td>
                        <td colSpan={2} className="border border-stone-800 text-[10px] font-medium text-center font-serif text-center">服&nbsp;&nbsp;務&nbsp;&nbsp;單&nbsp;&nbsp;位</td>
                        <td className="border border-stone-800 text-[10px] font-medium text-center">是否同居</td>
                        <td className="border border-stone-800 text-[10px] font-medium text-center font-serif text-center">備&nbsp;&nbsp;註</td>
                      </tr>

                      {/* 3 Family rows */}
                      {[0, 1, 2].map((idx) => {
                        const relationLabel = idx === 0 ? '父' : idx === 1 ? '母' : '配偶';
                        return (
                          <tr key={`print-family-row-${idx}`} className="h-9">
                            <td className="border border-stone-800 text-center text-[10px] font-bold bg-stone-50 md:bg-stone-50/30 py-1">{relationLabel}</td>
                            <td className="border border-stone-800 px-1 py-0.5">
                              <input 
                                type="text" 
                                value={printFields.family[idx]?.name || ''} 
                                onChange={e => {
                                  const updated = [...printFields.family];
                                  updated[idx].name = e.target.value;
                                  setPrintFields({...printFields, family: updated});
                                }}
                                className="w-full bg-transparent border-none text-[11px] focus:outline-none focus:bg-amber-50/50 text-center" 
                              />
                            </td>
                            <td className="border border-stone-800 px-1 py-0.5 text-center">
                              <input 
                                type="text" 
                                value={printFields.family[idx]?.birthday || ''} 
                                onChange={e => {
                                  const updated = [...printFields.family];
                                  updated[idx].birthday = e.target.value;
                                  setPrintFields({...printFields, family: updated});
                                }}
                                className="w-full bg-transparent border-none text-[11px] focus:outline-none focus:bg-amber-50/50 text-center font-mono" 
                              />
                            </td>
                            <td className="border border-stone-800 px-1 py-0.5 text-center">
                              <input 
                                type="text" 
                                value={printFields.family[idx]?.edu || ''} 
                                onChange={e => {
                                  const updated = [...printFields.family];
                                  updated[idx].edu = e.target.value;
                                  setPrintFields({...printFields, family: updated});
                                }}
                                className="w-full bg-transparent border-none text-[11px] focus:outline-none focus:bg-amber-50/50 text-center" 
                              />
                            </td>
                            <td colSpan={2} className="border border-stone-800 px-1.5 py-0.5">
                              <input 
                                type="text" 
                                value={printFields.family[idx]?.company || ''} 
                                onChange={e => {
                                  const updated = [...printFields.family];
                                  updated[idx].company = e.target.value;
                                  setPrintFields({...printFields, family: updated});
                                }}
                                className="w-full bg-transparent border-none text-[11px] focus:outline-none focus:bg-amber-50/50" 
                              />
                            </td>
                            <td className="border border-stone-800 px-1 py-0.5 text-center">
                              <input 
                                type="text" 
                                value={printFields.family[idx]?.coLive || ''} 
                                onChange={e => {
                                  const updated = [...printFields.family];
                                  updated[idx].coLive = e.target.value;
                                  setPrintFields({...printFields, family: updated});
                                }}
                                className="w-full bg-transparent border-none text-[10px] text-center focus:outline-none focus:bg-amber-50/50" 
                              />
                            </td>
                            <td className="border border-stone-800 px-1 py-0.5">
                              <input 
                                type="text" 
                                value={printFields.family[idx]?.note || ''} 
                                onChange={e => {
                                  const updated = [...printFields.family];
                                  updated[idx].note = e.target.value;
                                  setPrintFields({...printFields, family: updated});
                                }}
                                className="w-full bg-transparent border-none text-[11px] focus:outline-none focus:bg-amber-50/50" 
                              />
                            </td>
                          </tr>
                    );
                  })}

                    </tbody>
                  </table>
                </div>

              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Custom confirmation dialog for deleting an employee (Safe modal) */}
      {employeeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-xs p-4 no-print">
          <div className="bg-white border border-[#E9E1D6] rounded-2xl max-w-sm w-full p-6 shadow-xl animate-in fade-in zoom-in duration-150 text-left">
            <div className="flex items-center gap-3 text-rose-700 mb-3">
              <div className="w-10 h-10 bg-rose-50 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 flex-shrink-0" />
              </div>
              <h3 className="text-sm font-bold text-stone-900">完全刪除入職名單？</h3>
            </div>
            <p className="text-xs text-stone-605 text-left mb-6 leading-relaxed">
              您確定要完全刪除新同仁 <strong className="text-[#8D1B1B]">「{employeeToDelete.name}」</strong> 的入職申報全案與已上傳檔案嗎？此操作將永久移除，無法復原。
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setEmployeeToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-stone-500 bg-stone-50 hover:bg-stone-100 rounded-lg border border-stone-200 cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    const res = await fetch(`/api/hr/employees/${employeeToDelete.id}`, { 
                      method: 'DELETE',
                      headers: {
                        'x-operator-email': encodeURIComponent(currentUser?.email || ''),
                        'x-operator-name': encodeURIComponent(currentUser?.name || '')
                      }
                    });
                    const data = await res.json();
                    if (res.ok) {
                      setEmployees(data.employees);
                      setInfoMsg(`🗑️ 已由系統完全剔除同仁 ${employeeToDelete.name} 報到進度`);
                      if (selectedEmp?.id === employeeToDelete.id) setSelectedEmp(null);
                      fetchActivityLogs();
                    } else {
                      setErrorMsg(data.error || '刪除失敗');
                    }
                  } catch {
                    setErrorMsg('伺服器連線或刪除失敗');
                  } finally {
                    setIsDeleting(false);
                    setEmployeeToDelete(null);
                  }
                }}
                disabled={isDeleting}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 rounded-lg cursor-pointer flex items-center gap-1 shadow-sm"
              >
                {isDeleting ? '刪除中...' : '確認刪除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom confirmation dialog for deleting an administrator (Safe modal) */}
      {adminToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-xs p-4 no-print" id="admin-delete-modal">
          <div className="bg-white border border-[#E9E1D6] rounded-2xl max-w-sm w-full p-6 shadow-xl animate-in fade-in zoom-in duration-150 text-left">
            <div className="flex items-center gap-3 text-[#8D1B1B] mb-3">
              <div className="w-10 h-10 bg-rose-50 rounded-full flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              </div>
              <h3 className="text-sm font-bold text-stone-900">註銷管理者權限？</h3>
            </div>
            <p className="text-xs text-stone-600 text-left mb-6 leading-relaxed">
              您確定要註銷 <strong className="text-[#8D1B1B]">「{adminToDelete}」</strong> 的管理者權限嗎？該帳密將被登出且無法再登入此後台！此動作無法復原。
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setAdminToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-stone-500 bg-stone-50 hover:bg-stone-100 rounded-lg border border-stone-200 cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  try {
                    await handleDeleteAdmin(adminToDelete);
                  } finally {
                    setAdminToDelete(null);
                  }
                }}
                disabled={isDeletingAdmin}
                className="px-4 py-1.5 text-xs font-bold text-white bg-[#8D1B1B] hover:bg-[#721515] disabled:bg-stone-300 rounded-lg cursor-pointer flex items-center gap-1 shadow-sm"
              >
                {isDeletingAdmin ? '處理中...' : '確認註銷'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom confirmation dialog for returning/rejecting an employee to pending */}
      {employeeToReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-xs p-4 no-print">
          <div className="bg-white border border-[#E9E1D6] rounded-2xl max-w-sm w-full p-6 shadow-xl animate-in fade-in zoom-in duration-150 text-left">
            <div className="flex items-center gap-3 text-amber-700 mb-3">
              <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center">
                <RotateCcw className="w-5 h-5 flex-shrink-0" />
              </div>
              <h3 className="text-sm font-bold text-stone-900 font-sans">退回報到資料修改？</h3>
            </div>
            <p className="text-xs text-stone-600 font-sans mb-6 leading-relaxed">
              您確定要把新同仁 <strong className="text-[#8D1B1B]">「{employeeToReject.name}」</strong> 的報到進度退回「填寫中」嗎？
              <br /><br />
              此操作將會<span className="font-semibold text-red-600">重設計任合約與工作條約同意書的簽署狀態</span>，但依舊會<span className="font-semibold text-emerald-700">保留同仁先前填好保留的基本個資、學經歷與技能證照</span>，省去重複填寫的時間，讓同仁直接登入進行勘誤。
            </p>
            <div className="flex justify-end gap-2.5 font-sans">
              <button
                onClick={() => setEmployeeToReject(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-stone-500 bg-stone-50 hover:bg-stone-100 rounded-lg border border-stone-200 cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  setIsRejecting(true);
                  try {
                    const res = await fetch(`/api/hr/employees/${employeeToReject.id}/reject`, { 
                      method: 'POST',
                      headers: {
                        'x-operator-email': encodeURIComponent(currentUser?.email || ''),
                        'x-operator-name': encodeURIComponent(currentUser?.name || '')
                      }
                    });
                    const data = await res.json();
                    if (res.ok) {
                      setEmployees(data.employees);
                      setInfoMsg(`🔄 已成功將同仁 「${employeeToReject.name}」 報到進度退回「填寫中」狀態，已重設條款同意書。`);
                      // If the details card of this employee is currently open, refresh its data inside selectedEmp
                      if (selectedEmp?.id === employeeToReject.id) {
                        setSelectedEmp(data.employee);
                      }
                      fetchActivityLogs();
                    } else {
                      setErrorMsg(data.error || '退回失敗');
                    }
                  } catch {
                    setErrorMsg('伺服器連線或退回操作失敗');
                  } finally {
                    setIsRejecting(false);
                    setEmployeeToReject(null);
                  }
                }}
                disabled={isRejecting}
                className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 rounded-lg cursor-pointer flex items-center gap-1 shadow-sm"
              >
                {isRejecting ? '退回中...' : '確認退回'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 寄送入職報到信預覽與 Google Auth Modal */}
      {emailPreviewEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4 no-print overflow-y-auto" id="email-preview-modal">
          <div className="bg-white border border-[#E9E1D6] rounded-2xl max-w-2xl w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-150 flex flex-col gap-5 text-left max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2 text-[#8D1B1B]">
                <Mail className="w-5 h-5" />
                <h3 className="text-base font-bold text-stone-900">發送入職報到信</h3>
              </div>
              <button 
                onClick={() => setEmailPreviewEmp(null)}
                className="text-stone-400 hover:text-stone-600 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

                        {/* Env Gmail Status Box inside the modal */}
            <div className="bg-stone-50 border border-stone-200/60 rounded-xl p-4 space-y-3.5 shadow-sm mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <div>
                    <h4 className="text-xs font-bold text-stone-850">
                      🟢 系統已整合 Gmail 自動發送功能
                    </h4>
                    <p className="text-[11px] text-stone-500">
                      本系統已自動取得管理員信箱設定，將透過後端直接發送信件。
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Email Metadata Details */}
            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-12 gap-1.5 border-b border-stone-100 pb-1.5">
                <span className="col-span-2 text-stone-400 font-medium">收件者:</span>
                <span className="col-span-10 font-medium text-stone-850">
                  {emailPreviewEmp.name} &lt;{emailPreviewEmp.email}&gt;
                </span>
              </div>
              <div className="grid grid-cols-12 gap-1.5 border-b border-stone-100 pb-1.5">
                <span className="col-span-2 text-stone-400 font-medium">主旨:</span>
                <span className="col-span-10 font-semibold text-stone-900">
                  【{getCompanyDetails(emailPreviewEmp).name}】歡迎您的加入！新進人員入職報到系統登入引導
                </span>
              </div>
            </div>

            {/* Email Body Preview Frame */}
            <div className="flex-1 overflow-y-auto max-h-[350px] border border-stone-200 rounded-xl bg-[#FAF9F6] p-4 font-sans text-xs text-stone-700 space-y-4">
              <div className="border-b border-[#8D1B1B] pb-2 text-center">
                <h4 style={{ color: '#8D1B1B', margin: 0, fontSize: '16px', fontWeight: 'bold', letterSpacing: '1px' }}>
                  {getCompanyDetails(emailPreviewEmp).name}
                </h4>
                <p className="text-[10px] text-stone-500">LDC Hotels & Resorts</p>
              </div>
              <p>親愛的 <strong className="text-stone-900 underline">{emailPreviewEmp.name}</strong> 同仁 您好：</p>
              <p>恭喜您錄取本公司！為了能順利為您辦理入職與投保手續，請您點擊下方平台連結，並使用您的電子郵件與專屬授權碼登入，填妥報到所需的個人與合約基本資料：</p>
              
              <div className="bg-white border border-[#8D1B1B]/20 border-l-4 border-l-[#8D1B1B] rounded-lg p-3.5 space-y-2 text-[11px] leading-relaxed">
                <div>💼 <strong className="text-stone-500">報到職稱：</strong><span className="text-stone-900 font-bold">{emailPreviewEmp.title}</span></div>
                <div>📅 <strong className="text-stone-500">報到日期：</strong><span className="text-[#8D1B1B] font-bold">{emailPreviewEmp.onboardDate}</span></div>
                <div>📍 <strong className="text-stone-500">報到地點：</strong><span className="text-stone-900">{emailPreviewEmp.contractWorkLocation || '雲朗觀光 (台北市中山區中山北路二段96號8樓)'}</span></div>
                <div>💰 <strong className="text-stone-500">敘薪薪資：</strong>{emailPreviewEmp.contractSalaryType === 'daily' ? '日薪' : emailPreviewEmp.contractSalaryType === 'hourly' ? '時薪' : '月薪'} <strong className="text-[#8D1B1B] font-bold">NT$ {emailPreviewEmp.contractSalaryAmount || '36,000'}</strong> 元</div>
                <div className="pt-1.5 border-t border-dashed border-stone-200">
                  🔑 <strong className="text-stone-500">專屬授權碼：</strong>
                  <span className="bg-[#8D1B1B] text-white px-2 py-0.5 rounded font-mono font-bold text-xs">
                    {emailPreviewEmp.authToken}
                  </span>
                </div>
                <div className="pt-1.5">
                  <strong className="text-stone-500 block">🔗 平台連結：</strong>
                  <a href="https://ldc-onboarding-portal-554356081371.asia-east1.run.app" target="_blank" rel="noreferrer" className="text-blue-600 underline font-mono break-all font-semibold">https://ldc-onboarding-portal-554356081371.asia-east1.run.app</a>
                </div>
              </div>

              <p className="text-[10px] text-stone-400 border-t border-stone-200 pt-2 leading-relaxed">
                ※ 本信件將透過 Google Auth 的 Gmail API 發送。若您有任何疑問，請直接與人力資源部聯繫，謝謝。<br />
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end items-center gap-3 pt-2 border-t border-stone-100 select-none">
              <button
                onClick={() => setEmailPreviewEmp(null)}
                className="px-4 py-2 text-xs font-semibold text-stone-500 bg-stone-50 hover:bg-stone-100 rounded-lg border border-stone-200 cursor-pointer"
              >
                關閉
              </button>
              
              <button
                onClick={() => handleSendOnboardingEmail(emailPreviewEmp)}
                disabled={sendingEmailId === emailPreviewEmp.id}
                className="px-5 py-2 bg-[#8D1B1B] text-[#D4AF37] hover:bg-[#721515] font-bold text-xs rounded-lg shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                {sendingEmailId === emailPreviewEmp.id ? '寄送中...' : '確認並發送信件'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 薪資扣繳免稅額申報表 A4 Print Modal */}
      {printTaxEmp && (
        <TaxDeclarationPrintModal
          employee={printTaxEmp}
          onClose={() => setPrintTaxEmp(null)}
        />
      )}

      {/* 聘僱合約書 A4 Print Modal */}
      {printContractEmp && (
        <ContractPrintModal
          employee={printContractEmp}
          onClose={() => setPrintContractEmp(null)}
        />
      )}

      {/* 個資同意書 A4 Print Modal */}
      {printConsentEmp && (
        <ConsentPrintModal
          employee={printConsentEmp}
          onClose={() => setPrintConsentEmp(null)}
        />
      )}

      {/* 職員保證書 A4 Print Modal */}
      {printGuarantorEmp && (
        <GuarantorPrintModal
          employee={printGuarantorEmp}
          onClose={() => setPrintGuarantorEmp(null)}
        />
      )}

      {/* 職工服務約定 A4 Print Modal */}
      {printServiceEmp && (
        <ServicePrintModal
          employee={printServiceEmp}
          onClose={() => setPrintServiceEmp(null)}
        />
      )}

    </div>
  );
}
