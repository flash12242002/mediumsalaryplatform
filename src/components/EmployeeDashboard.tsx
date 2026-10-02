import React, { useState, useRef, useEffect } from 'react';
import { 
  ClipboardList, 
  BookOpen, 
  Sparkles, 
  LogOut, 
  User, 
  MapPin, 
  Building,
  CreditCard,
  FileText,
  Briefcase,
  Layers,
  Upload,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronRight,
  Send,
  Download,
  Trash2,
  Users
} from 'lucide-react';
import { OnboardEmployee, PersonalData, CareerExperience, Education, ProfessionalLicense, LanguageSkill, TaxDependent, TaxDeclaration, GuarantorData } from '../types';
import LdcLogo from './LdcLogo';
import { TaxDeclarationPrintModal, ContractPrintModal, GuarantorPrintModal, ServicePrintModal } from './PrintModals';
import { Printer } from 'lucide-react';

const eHrdLoginDemo = "/src/assets/images/ehrd_login_demo_1781503393310.jpg";

// Helper to get company details based on OnboardEmployee branch / department
export const getCompanyDetails = (emp: { department?: string; contractWorkLocation?: string }) => {
  const dept = (emp.department || '').toLowerCase();
  const loc = (emp.contractWorkLocation || '').toLowerCase();

  if (dept.includes('?²å?') || loc.includes('?²å?')) {
    return {
      name: '?²å??‹é??’å??¡ä»½?‰é??¬å¸',
      owner: '?›æ²»ä»?,
      taxId: '54023418',
      address: '?°å?å¸‚ä¸­å±±å?ä¸­å±±?—è·¯äºŒæ®µ96??æ¨?
    };
  } else if (dept.includes('?´å?') || loc.includes('?´å?')) {
    return {
      name: '?´å?ç®¡ç?é¡§å??¡ä»½?‰é??¬å¸',
      owner: 'è¾œæ‡·å¦?,
      taxId: '12955445',
      address: '?°å?å¸‚ä¸­å±±å?ä¸­å±±?—è·¯äºŒæ®µ96??æ¨?
    };
  } else {
    return {
      name: '?²æ?è§€?‰è‚¡ä»½æ??å…¬??,
      owner: 'è³ˆå???,
      taxId: '62021700',
      address: '?°å?å¸‚ä¸­å±±å?ä¸­å±±?—è·¯äºŒæ®µ96??æ¨?
    };
  }
};


interface EmployeeDashboardProps {
  initialEmployee: OnboardEmployee;
  onLogout: () => void;
}

export default function EmployeeDashboard({ initialEmployee, onLogout }: EmployeeDashboardProps) {
  const [OnboardEmployee, setEmployee] = useState<OnboardEmployee>(initialEmployee);
  const [activeTab, setActiveTab] = useState<'tasks' | 'training' | 'ai'>('tasks');
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [printTaxOpen, setPrintTaxOpen] = useState(false);
  const [printContractOpen, setPrintContractOpen] = useState(false);
  const [printGuarantorOpen, setPrintGuarantorOpen] = useState(false);
  const [printServiceOpen, setPrintServiceOpen] = useState(false);

  // Guarantor state
  const [guarantorForm, setGuarantorForm] = useState<GuarantorData>({
    guarantorName: OnboardEmployee.guarantorData?.guarantorName || '',
    birthday: OnboardEmployee.guarantorData?.birthday || '',
    idNumber: OnboardEmployee.guarantorData?.idNumber || '',
    address: OnboardEmployee.guarantorData?.address || '',
    phone: OnboardEmployee.guarantorData?.phone || '',
    companyName: OnboardEmployee.guarantorData?.companyName || '',
    companyTitle: OnboardEmployee.guarantorData?.companyTitle || '',
    companyAddress: OnboardEmployee.guarantorData?.companyAddress || '',
    companyPhone: OnboardEmployee.guarantorData?.companyPhone || '',
    relationship: OnboardEmployee.guarantorData?.relationship || '',
    validUntil: OnboardEmployee.guarantorData?.validUntil || ''
  });

  // Personal state
  const [personalForm, setPersonalForm] = useState<PersonalData>({
    name: OnboardEmployee.personalData?.name || OnboardEmployee.name || '',
    englishName: OnboardEmployee.personalData?.englishName || '',
    avatarUrl: OnboardEmployee.personalData?.avatarUrl || '',
    idNumber: OnboardEmployee.personalData?.idNumber || '',
    birthday: OnboardEmployee.personalData?.birthday || '',
    gender: OnboardEmployee.personalData?.gender || '',
    bloodType: OnboardEmployee.personalData?.bloodType || '',
    phone: OnboardEmployee.personalData?.phone || '',
    email: OnboardEmployee.personalData?.email || OnboardEmployee.email || '',
    legalAddress: OnboardEmployee.personalData?.legalAddress || '',
    contactAddress: OnboardEmployee.personalData?.contactAddress || '',
    bankName: 'ä¸­å?ä¿¡è??€è¡?(822)',
    bankAccount: OnboardEmployee.personalData?.bankAccount || '',
    dependentsCount: OnboardEmployee.personalData?.dependentsCount || '0 äº?,
    healthDependentsCount: OnboardEmployee.personalData?.healthDependentsCount || '0 äº?,
    healthDependents: OnboardEmployee.personalData?.healthDependents || [],
    emergencyName: OnboardEmployee.personalData?.emergencyName || '',
    emergencyRelationship: OnboardEmployee.personalData?.emergencyRelationship || '',
    emergencyPhone: OnboardEmployee.personalData?.emergencyPhone || ''
  });

  // Expand state for task panels
  const [openSection, setOpenSection] = useState<string | null>('personal');

  // Career state
  const [experiences, setExperiences] = useState<CareerExperience[]>(
    OnboardEmployee.careerData?.experiences || []
  );
  const [educations, setEducations] = useState<Education[]>(
    OnboardEmployee.careerData?.educations || []
  );
  const [licenses, setLicenses] = useState<ProfessionalLicense[]>(
    OnboardEmployee.careerData?.licenses || [
      { licenseName: '', badgeLevel: '', issueDate: '', expiryDate: '' }
    ]
  );
  const [additionalNotes, setAdditionalNotes] = useState(
    OnboardEmployee.careerData?.additionalNotes || ''
  );
  
  const [languages, setLanguages] = useState<LanguageSkill[]>(() => {
    if (OnboardEmployee.careerData?.languages && OnboardEmployee.careerData.languages.length > 0) {
      return OnboardEmployee.careerData.languages;
    }
    return [
      { language: '?±æ?', level: '' },
      { language: '?¥æ?', level: '' },
      { language: '?“æ?', level: '' },
      { language: '?¶ä?', level: '', customName: '' }
    ];
  });
  
  // New temporary subform states
  const [expShowForm, setExpShowForm] = useState(false);
  const [tempExp, setTempExp] = useState<CareerExperience>({
    companyName: '', jobTitle: '', startDate: '', endDate: '', leaveReason: ''
  });

  const [eduShowForm, setEduShowForm] = useState(false);
  const [tempEdu, setTempEdu] = useState<Education>({
    schoolName: '', major: '', degree: '', period: '', status: ''
  });

  // Agreement states
  const [rulesRead, setRulesRead] = useState(OnboardEmployee.rulesAgreed || false);
  const [privacyRead, setPrivacyRead] = useState(OnboardEmployee.privacyAgreed || false);
  const [sameAddress, setSameAddress] = useState(false);

  // Tax declaration states
  const [spouseName, setSpouseName] = useState(OnboardEmployee.taxDeclaration?.spouseName || '');
  const [spouseBirthday, setSpouseBirthday] = useState(OnboardEmployee.taxDeclaration?.spouseBirthday || '');
  const [spouseIdNumber, setSpouseIdNumber] = useState(OnboardEmployee.taxDeclaration?.spouseIdNumber || '');
  const [taxDependents, setTaxDependents] = useState<TaxDependent[]>(OnboardEmployee.taxDeclaration?.dependents || []);
  const [taxSigned, setTaxSigned] = useState(OnboardEmployee.taxDeclaration?.signed || false);
  const [taxSignName, setTaxSignName] = useState(OnboardEmployee.taxDeclaration?.signName || '');
  
  // Temporary dependent additions
  const [tempDepName, setTempDepName] = useState('');
  const [tempDepRel, setTempDepRel] = useState('');
  const [tempDepBirth, setTempDepBirth] = useState('');
  const [tempDepId, setTempDepId] = useState('');
  const [tempDepCond, setTempDepCond] = useState('');
  const [tempDepType, setTempDepType] = useState('?´ç³»å°Šè¦ªå±?);
  const [showDepForm, setShowDepForm] = useState(false);


  // Contract specific states (to match physical image)
  const [contractWorkLocation, setContractWorkLocation] = useState('?›å??’å? (?°å?å¸‚ä¸­å±±å?)');
  const [contractLeaveOption, setContractLeaveOption] = useState<string>('biweekly'); // 'monthly' or 'biweekly'
  const [contractLeavedays, setContractLeavedays] = useState('8-10');
  const [contractSalaryType, setContractSalaryType] = useState<string>('monthly'); // 'monthly', 'daily', 'hourly'
  const [contractMonthlySalary, setContractMonthlySalary] = useState('36,000');
  const [contractDailySalary, setContractDailySalary] = useState('1,800');
  const [contractHourlySalary, setContractHourlySalary] = useState('190');

  // File Upload states
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState('');

  // AI Assistant states
  const [messages, setMessages] = useState<any[]>([
    {
      role: 'assistant',
      content: `?¨å¥½ï¼?*${OnboardEmployee.name}**ï¼æ??¯æ‚¨?„å ±?°æ?ç¨?AIç§˜æ›¸ ?Œ¸?‚æ­?œæ‚¨? å…¥?²æ?è§€?‰ï??™è£¡å°‡æ??ç??¨ç??‘å?ä¸¦èƒ½?”åŠ©?¨è??Ÿå¡«å¯«æ?ç¨‹ã€?
?‘èƒ½?ºæ‚¨è§??ï¼?- ?†å??¡å·¥?‰å“ªäº›å?å±¬ä??‡ï?å¦‚ç??¥å?ï¼‰è??¹æ?ä½å®¿ï¼?- ?å?å¥‘ç??–å·¥ä½œè??‡ä¸­?‰å“ªäº›é?è¦ç??ï?
- ?®å????‹å…¥?·å ±?°ä»»?™è??éº¼å®Œæ??‡æ ¸é©—ï?

æ­¡è??¨æ??¨æ­¤è©¢å??‘ä»»ä½•å?é¡Œï?`,
      timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Dynamic status update
  const syncWithServer = async (updatedFields: Partial<OnboardEmployee>) => {
    setLoading(true);
    setSaveStatus('æ­?œ¨å¿«å??²ç«¯æª”æ?...');
    try {
      const response = await fetch('/api/OnboardEmployee/save', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: OnboardEmployee.id,
          ...updatedFields
        })
      });
      const data = await response.json();
      if (response.ok) {
        setEmployee(data.OnboardEmployee);
        setSaveStatus('?²åº¦?²å??å?');
        setTimeout(() => setSaveStatus(''), 2000);
      } else {
        setSaveStatus('å¿«å?å¤±æ?ï¼Œè??æ–°?—è©¦');
      }
    } catch {
      setSaveStatus('ç¶²é?ç¶²çµ¡???ä¸­ä¸­?·ï??ªå??Ÿç”¨?¬æ?å¿«å?');
    } finally {
      setLoading(false);
    }
  };

  const handleHealthDependentsCountChange = (countStr: string) => {
    const count = parseInt(countStr) || 0;
    const currentDeps = personalForm.healthDependents || [];
    let updatedDeps = [...currentDeps];

    if (updatedDeps.length < count) {
      const diff = count - updatedDeps.length;
      for (let i = 0; i < diff; i++) {
        updatedDeps.push({ name: '', relationship: '', idNumber: '', birthday: '' });
      }
    } else if (updatedDeps.length > count) {
      updatedDeps = updatedDeps.slice(0, count);
    }

    setPersonalForm({
      ...personalForm,
      healthDependentsCount: countStr,
      healthDependents: updatedDeps
    });
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      alert('? ï? å¤§é ­?§æ ¼å¼å??¯æ´ JPG?JPEG ??PNG ?¼å???);
      return;
    }
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setPersonalForm(prev => ({
        ...prev,
        avatarUrl: base64
      }));
    };
    reader.readAsDataURL(file);
  };

  const handlePersonalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !personalForm.avatarUrl ||
      !personalForm.name || 
      !personalForm.phone || 
      !personalForm.idNumber ||
      !personalForm.birthday ||
      !personalForm.gender ||
      !personalForm.legalAddress ||
      !personalForm.bankAccount ||
      !personalForm.dependentsCount
    ) {
      alert('è«‹å??´ä??³å€‹äººå¤§é ­?§ã€å¡«å¯«å??ã€èº«?†è?å­—è??å‡º?Ÿæ—¥?Ÿã€æ€§åˆ¥?è¯çµ¡é›»è©±ã€æˆ¶ç±åœ°?€?åŒ¯æ¬¾é?è¡Œå¸³?Ÿè??€å¾—æ‰£ç¹³è¦ªå±¬æ ¼ï¼?);
      return;
    }
    syncWithServer({ personalData: personalForm });
    setOpenSection('career');
  };

  const addExperience = () => {
    if (!tempExp.companyName || !tempExp.jobTitle) {
      alert('è«‹è¼¸?¥å…¬?¸å?ç¨±è??·ä?');
      return;
    }
    const newList = [...experiences, tempExp];
    setExperiences(newList);
    setTempExp({ companyName: '', jobTitle: '', startDate: '', endDate: '', leaveReason: '' });
    setExpShowForm(false);
    syncWithServer({ careerData: { experiences: newList, educations, licenses, languages, additionalNotes } });
  };

  const removeExperience = (index: number) => {
    const newList = experiences.filter((_, i) => i !== index);
    setExperiences(newList);
    syncWithServer({ careerData: { experiences: newList, educations, licenses, languages, additionalNotes } });
  };

  const addEducation = () => {
    if (!tempEdu.schoolName) {
      alert('è«‹è¼¸?¥å­¸?¡å?ç¨?);
      return;
    }
    const newList = [...educations, tempEdu];
    setEducations(newList);
    setTempEdu({ schoolName: '', major: '', degree: '', period: '', status: '' });
    setEduShowForm(false);
    syncWithServer({ careerData: { experiences, educations: newList, licenses, languages, additionalNotes } });
  };

  const removeEducation = (index: number) => {
    const newList = educations.filter((_, i) => i !== index);
    setEducations(newList);
    syncWithServer({ careerData: { experiences, educations: newList, licenses, languages, additionalNotes } });
  };

  const addLicenseRow = () => {
    const newList = [...licenses, { licenseName: '', badgeLevel: '', issueDate: '', expiryDate: '' }];
    setLicenses(newList);
  };

  const updateLicense = (index: number, field: keyof ProfessionalLicense, val: string) => {
    const newList = [...licenses];
    newList[index][field] = val;
    setLicenses(newList);
  };

  const saveCareer = () => {
    const validLicenses = licenses.filter(l => l.licenseName.trim());
    syncWithServer({
      careerData: {
        experiences,
        educations,
        licenses: validLicenses,
        languages,
        additionalNotes
      }
    });
    setOpenSection('upload');
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Convert files checking ONLY .pdf files
  const processFiles = async (files: FileList) => {
    setFileError('');
    const file = files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setFileError('? ï? è«‹æ³¨?ï?è­‰ä»¶?Šå?æ¥­è??§å??¥å?é«˜è§£?åº¦ PDF æª”æ?ä»¥ä??¥é???);
      return;
    }

    setLoading(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const res = await fetch('/api/OnboardEmployee/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: OnboardEmployee.id,
            fileName: file.name,
            fileSize: file.size,
            base64Data: base64
          })
        });
        const data = await res.json();
        if (res.ok) {
          setEmployee(data.OnboardEmployee);
          setSaveStatus('è­‰ä»¶ PDF ä¸Šå‚³å®Œç•¢ä¸¦å·²å°±ä?');
          setTimeout(() => setSaveStatus(''), 2000);
        } else {
          setFileError(data.error || 'ä¸Šå‚³å¤±æ?');
        }
      };
    } catch {
      setFileError('æª”æ??•ç?å¤±æ?');
    } finally {
      setLoading(false);
    }
  };

  const deleteUploadedFile = async (name: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/OnboardEmployee/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: OnboardEmployee.id,
          fileName: name
        })
      });
      const data = await res.json();
      if (res.ok) {
        setEmployee(data.OnboardEmployee);
        setSaveStatus('æª”æ?å·²ç§»??);
        setTimeout(() => setSaveStatus(''), 2000);
      }
    } catch {
      alert('?ªé™¤å¤±æ?');
    } finally {
      setLoading(false);
    }
  };

  const handleSlotUploadChange = async (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('? ï? è«‹æ³¨?ï??‡å??¸é??‡ä»¶?¼å??…æ¥??PDF æª”æ???);
      return;
    }

    setLoading(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const res = await fetch('/api/OnboardEmployee/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: OnboardEmployee.id,
            fileName: file.name,
            fileSize: file.size,
            base64Data: base64,
            docType: docType
          })
        });
        const data = await res.json();
        if (res.ok) {
          setEmployee(data.OnboardEmployee);
          setSaveStatus('?‡ä»¶ä¸Šå‚³?å?');
          setTimeout(() => setSaveStatus(''), 2000);
        } else {
          alert(data.error || 'ä¸Šå‚³å¤±æ?');
        }
      };
    } catch {
      alert('æª”æ??•ç?å¤±æ?');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleRulesSubmit = () => {
    if (!rulesRead || !privacyRead) {
      alert('è«‹å??±è?å®Œå…©?…å??‡ä¸¦?¾é¸?Œæ?');
      return;
    }
    syncWithServer({ rulesAgreed: rulesRead, privacyAgreed: privacyRead });
    setOpenSection('tax');
  };

  const handleContractSign = () => {
    syncWithServer({
      contractSigned: true,
      contractDate: new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
    });
    setOpenSection('guarantor');
  };

  const handleGuarantorSign = (andSubmit: boolean) => {
    if (andSubmit && !guarantorForm.guarantorName.trim()) {
      alert('è«‹å¡«å¯«ä?è­‰äººå§“å?ä»¥é€²è??¸ä???¸¶ä¿è?èªè?ï¼Œè?è¬ã€?);
      return;
    }
    syncWithServer({
      guarantorSigned: andSubmit,
      guarantorDate: andSubmit ? new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '',
      guarantorData: guarantorForm
    });
    if (andSubmit) {
      setOpenSection('service');
    }
  };

  const handleServiceSign = () => {
    syncWithServer({
      serviceSigned: true,
      serviceDate: new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
    });
    setOpenSection(null);
  };

  // AI chat call
  const sendAIMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputMessage;
    if (!textToSend.trim() || aiLoading) return;

    const userMsg = {
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
    };

    const currentHistory = [...messages, userMsg];
    setMessages(currentHistory);
    setInputMessage('');
    setAiLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textToSend,
          history: messages.map(m => ({ role: m.role, content: m.content })),
          roleContext: 'OnboardEmployee'
        })
      });

      const data = await res.json();
      if (res.ok) {
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: data.response,
            timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      } else {
        throw new Error();
      }
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: '?±æ?ï¼Œç??¸ç›®?é€??ç¨å¾®?å?ï¼Œè?ç¨å??å?ï¼Œæ‚¨?„è??™ç?å·²å??¨é€é???,
          timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, aiLoading]);

  useEffect(() => {
    if (OnboardEmployee.taxDeclaration) {
      setSpouseName(OnboardEmployee.taxDeclaration.spouseName || '');
      setSpouseBirthday(OnboardEmployee.taxDeclaration.spouseBirthday || '');
      setSpouseIdNumber(OnboardEmployee.taxDeclaration.spouseIdNumber || '');
      setTaxDependents(OnboardEmployee.taxDeclaration.dependents || []);
      setTaxSigned(OnboardEmployee.taxDeclaration.signed || false);
      setTaxSignName(OnboardEmployee.taxDeclaration.signName || '');
    }
  }, [OnboardEmployee]);

  const addTaxDependent = () => {
    if (!tempDepName.trim()) {
      alert('è«‹è¼¸?¥å??¶é?è¦ªå±¬å§“å?');
      return;
    }
    const newDep: TaxDependent = {
      name: tempDepName,
      relationship: tempDepRel,
      birthday: tempDepBirth,
      idNumber: tempDepId,
      condition: tempDepCond,
      type: tempDepType
    };
    const newList = [...taxDependents, newDep];
    setTaxDependents(newList);
    setTempDepName('');
    setTempDepRel('');
    setTempDepBirth('');
    setTempDepId('');
    setTempDepCond('');
    setShowDepForm(false);
    
    const dec = {
      spouseName,
      spouseBirthday,
      spouseIdNumber,
      dependents: newList,
      signed: taxSigned,
      signName: taxSignName,
      signedAt: OnboardEmployee.taxDeclaration?.signedAt
    };
    syncWithServer({ taxDeclaration: dec });
  };

  const removeTaxDependent = (index: number) => {
    const newList = taxDependents.filter((_, i) => i !== index);
    setTaxDependents(newList);
    
    const dec = {
      spouseName,
      spouseBirthday,
      spouseIdNumber,
      dependents: newList,
      signed: taxSigned,
      signName: taxSignName,
      signedAt: OnboardEmployee.taxDeclaration?.signedAt
    };
    syncWithServer({ taxDeclaration: dec });
  };

  const handleTaxSave = (andSubmit: boolean) => {
    if (andSubmit && !taxSignName.trim()) {
      alert('è«‹å¡«å¯??ªè??—é?äººï?ç°½ç?ï¼‰ä»¥?²è??¸ä??¸å?ç¢ºè?ï¼Œè?è¬ã€?);
      return;
    }
    const dec = {
      spouseName,
      spouseBirthday,
      spouseIdNumber,
      dependents: taxDependents,
      signed: andSubmit ? true : taxSigned,
      signName: taxSignName,
      signedAt: andSubmit ? new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }) : OnboardEmployee.taxDeclaration?.signedAt
    };
    syncWithServer({ taxDeclaration: dec });
    if (andSubmit) {
      setOpenSection('contract');
    }
  };

  // Checklist computation helper
  const taskChecklist = [
    { key: 'personal', title: 'å¡«å¯«?‹äººè³‡æ?', done: !!(OnboardEmployee.personalData && OnboardEmployee.personalData.phone) },
    { key: 'career', title: '?»é?å­¸ç?æ­·è?è­‰ç…§', done: !!(OnboardEmployee.careerData && (OnboardEmployee.careerData.experiences?.length > 0 || (OnboardEmployee.careerData.educations && OnboardEmployee.careerData.educations.length > 0) || OnboardEmployee.careerData.licenses?.length > 0)) },
    { 
      key: 'upload', 
      title: 'ä¸Šå‚³?‡å??‡ä»¶å½±æœ¬é©—æŸ¥ (?…æ¥??PDF)', 
      done: !!(
        OnboardEmployee.uploadedFiles?.some(f => f.docType === 'idCard') &&
        OnboardEmployee.uploadedFiles?.some(f => f.docType === 'degree') &&
        OnboardEmployee.uploadedFiles?.some(f => f.docType === 'healthReport') &&
        OnboardEmployee.uploadedFiles?.some(f => f.docType === 'bankCover')
      ) || (OnboardEmployee.uploadedFiles?.length > 0 && !OnboardEmployee.uploadedFiles?.some(f => f.docType))
    },
    { key: 'rules', title: '?±è?å·¥ä?è¦ç??‡å€‹è??é??©ç”¨?ŠçŸ¥', done: OnboardEmployee.rulesAgreed && OnboardEmployee.privacyAgreed },
    { key: 'tax', title: '?ªè??—é?äººå?ç¨…é??³å ±è¡?, done: !!(OnboardEmployee.taxDeclaration && OnboardEmployee.taxDeclaration.signed) },
    { key: 'contract', title: 'ç¢ºè?ä¸¦ç?ä¸Šç°½ç½²ã€Œè??±å?ç´„æ›¸??, done: OnboardEmployee.contractSigned },
    { key: 'guarantor', title: 'ç¢ºè?ä¸¦ç?ä¸Šç°½ç½²ã€Œè·?¡ä?è­‰æ›¸??, done: !!OnboardEmployee.guarantorSigned },
    { key: 'service', title: 'ç¢ºè?ä¸¦ç?ä¸Šç°½ç½²ã€Œè·å·¥æ??™ç?å®šã€?, done: !!OnboardEmployee.serviceSigned }
  ];

  const totalFinished = taskChecklist.filter(t => t.done).length;
  const overallProgress = OnboardEmployee.progress;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-stone-800">
      
      {/* Upper Brand bar */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <LdcLogo size="header" color="gold" className="bg-stone-50 p-1 px-2 rounded-lg border border-stone-200" />
          <div>
            <h2 className="text-base font-semibold text-slate-900 tracking-wide">
              ?°é€²å?ä»å…¥?·å ±?°å¹³??            </h2>
            <p className="text-xs text-slate-500">
              {OnboardEmployee.department}  ?? {OnboardEmployee.title}  ?? ?°è·?¥ï?{OnboardEmployee.onboardDate}
            </p>
          </div>
        </div>

        {/* View Switches */}
        <div className="flex items-center gap-1.5 md:self-center">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-4 py-2 text-xs font-medium tracking-wide rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'tasks'
                ? 'bg-indigo-50 text-indigo-700 font-semibold'
                : 'text-stone-600 hover:bg-stone-50'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            ?‘ç??±åˆ°ä»»å? ({totalFinished}/{taskChecklist.length})
          </button>
          <button
            onClick={() => setActiveTab('training')}
            className={`px-4 py-2 text-xs font-medium tracking-wide rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'training'
                ? 'bg-indigo-50 text-indigo-700 font-semibold'
                : 'text-stone-600 hover:bg-stone-50'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            ?™è‚²è¨“ç·´å°è?
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`px-4 py-2 text-xs font-medium tracking-wide rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'ai'
                ? 'bg-indigo-50 text-indigo-700 font-semibold'
                : 'text-stone-600 hover:bg-stone-50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            ?å? AI ç§˜æ›¸
          </button>

          <div className="h-4 w-px bg-stone-200 mx-1"></div>

          <button
            onClick={onLogout}
            className="px-3 py-2 text-stone-500 hover:text-rose-600 text-xs font-medium flex items-center gap-1 rounded-lg hover:bg-rose-50 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            ?»å‡º
          </button>
        </div>
      </nav>

      {/* Main Content Pane */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8 flex flex-col gap-6">

        {/* Overall Progress Banner */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex-1 space-y-1 text-center md:text-left">
            <h3 className="text-lg font-medium text-slate-900">
              èª æ‘¯?°æ­¡è¿æ‚¨ï¼Œ{OnboardEmployee.name}ï¼?            </h3>
            <p className="text-xs text-stone-500 leading-relaxed max-w-xl">
              ?™æ˜¯?ºæ‚¨?èº«æº–å??„å ±?°æ??®ï?å®Œæ? {taskChecklist.length} å¤§ä»»?™ä¸¦?³é€²åº¦??100% å¾Œå??ªå??¼é€è‡³HR?¨é??‚å??‡å?é¡Œå¯é»æ??³ä??¹ã€Œå???AI ç§˜æ›¸?ç²å¾—å??©ã€?            </p>
          </div>
          
          <div className="w-full md:w-80 space-y-2.5">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-stone-600">å¡«å¯«?²åº¦çµ±è?</span>
              <span className="font-semibold text-indigo-600">{overallProgress}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              ></div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>å®Œæ??¨éƒ¨æ¬„ä??³å¯?€??/span>
              <span>
                {OnboardEmployee.status === 'completed' ? (
                  <span className="text-emerald-700 font-semibold">?? å·²å???100% ?¨æ??¯é???/span>
                ) : (
                  <span>?®å?å¾…è?è¾?/span>
                )}
              </span>
            </div>
          </div>
        </div>

        {saveStatus && (
          <div className="bg-[#1E293B] text-white px-4 py-2 rounded-lg text-center text-xs animate-bounce w-fit mx-auto shadow-sm">
            ??{saveStatus}
          </div>
        )}

        {/* Dynamic Display based on Tabs */}
        {activeTab === 'tasks' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Checklist Overview Side */}
            <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <h4 className="text-xs font-semibold text-stone-500 tracking-wider uppercase mb-2">
                ?¥è·å·¥ä??‡å?æ­¥é?
              </h4>
              <div className="space-y-2">
                {taskChecklist.map((task, i) => (
                  <div
                    key={task.key}
                    onClick={() => setOpenSection(task.key)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 text-xs ${
                      task.done 
                        ? 'bg-slate-50 border-slate-200 text-stone-400' 
                        : openSection === task.key 
                          ? 'border-indigo-200 bg-indigo-50/50 text-indigo-700 font-semibold' 
                          : 'border-stone-100 hover:border-stone-200 text-stone-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                        task.done ? 'bg-[#0D9488]/10 text-[#0D9488]' : 'bg-stone-100 text-stone-600'
                      }`}>
                        {task.done ? '?? : i + 1}
                      </div>
                      <span className="truncate">{task.title}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                  </div>
                ))}
              </div>

              {OnboardEmployee.status === 'completed' && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center space-y-2">
                  <span className="text-emerald-800 font-bold text-sm block">?? å¤ªæ?äº†ï??±åˆ°?‹ç?å·²å…¨?¨å??ï?</span>
                  <p className="text-[11px] text-emerald-600 leading-relaxed">
                    ?¨ç??ºæœ¬è³‡æ??å·¥ä½œç?æ­·ã€æ ¸é©—æ?ä»¶ã€è??¢å®£?Šå??åƒ±?ˆç??‡å·²?±ç³»çµ±å¦¥?„ä?è­·ã€‚æ‚¨?¾åœ¨?¯å?å¿ƒä½¿?¨ï?ä¸é??æ??•å??‹ã€?                  </p>
                </div>
              )}
            </div>

            {/* Editing Section Area */}
            <div className="lg:col-span-2 space-y-4">
              
              {/* 1. Personal Form Section */}
              {openSection === 'personal' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 space-y-6">
                  <div className="flex items-center gap-2 pb-4 border-b border-stone-100">
                    <User className="w-5 h-5 text-indigo-600" />
                    <div>
                      <h4 className="text-base font-semibold text-stone-900">1. å¡«å¯«?‹äºº?ºæœ¬è³‡æ?è¡?/h4>
                      <p className="text-xs text-stone-500">?ºç¶­è­·æ‚¨?„æ??Šï??©è??¨å¡«å¯«æ­£ç¢ºè??™ï?? HRå°‡ä??¨å¡«å¯«ç?è³‡æ??²è??¸é??‹ç?ä¸¦å»ºç«‹äººäº‹è??™æ???/p>
                    </div>
                  </div>

                  <form onSubmit={handlePersonalSubmit} className="space-y-6">
                    {/* å¤§é ­?§ä??³å?å¡?*/}
                    <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                      <div className="relative w-24 h-24 rounded-xl border border-stone-200 bg-white overflow-hidden flex items-center justify-center flex-shrink-0 group shadow-sm">
                        {personalForm.avatarUrl ? (
                          <img 
                            src={personalForm.avatarUrl} 
                            alt="å¤§é ­?? 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="text-center p-2 text-stone-400">
                            <span className="text-[10px] block leading-snug">?ªä???br />å¤§é ­??/span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2 flex-grow text-center sm:text-left">
                        <span className="block text-xs font-bold text-stone-800">ä¸Šå‚³?‹äººå¤§é ­??<span className="text-rose-500">*</span></span>
                        <p className="text-[10px] text-stone-500 leading-relaxed">
                          ?¼å??å???JPG?JPEG ??PNG å½±å?æª”æ???br />
                          æ­¤ç…§?‡å??¨æ–¼?°é€²å“¡å·¥è??¥è??Šé?ç¦å‡º?¥è?äººè?ç³»çµ±å»ºæ???                        </p>
                        <div className="flex items-center gap-2 justify-center sm:justify-start">
                          <label className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[11px] font-semibold hover:bg-indigo-700 cursor-pointer transition-colors shadow-sm">
                            ?¸æ??§ç?
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/png, image/jpeg, image/jpg" 
                              onChange={handleAvatarChange}
                            />
                          </label>
                          {personalForm.avatarUrl && (
                            <button
                              type="button"
                              onClick={() => setPersonalForm(prev => ({ ...prev, avatarUrl: '' }))}
                              className="px-3 py-1.5 bg-white border border-stone-200 text-stone-500 rounded-lg text-[11px] font-semibold hover:bg-stone-50 hover:text-stone-700 transition"
                            >
                              æ¸…é™¤?§ç?
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                          ä¸­æ?å§“å? <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={personalForm.name}
                          onChange={e => setPersonalForm({...personalForm, name: e.target.value})}
                          className="w-full text-stone-950 px-3 py-2 text-xs border border-stone-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                          ?±æ??¥å?
                        </label>
                        <input
                          type="text"
                          placeholder="ä¾? David Lin"
                          value={personalForm.englishName || ''}
                          onChange={e => setPersonalForm({...personalForm, englishName: e.target.value})}
                          className="w-full text-stone-950 px-3 py-2 text-xs border border-stone-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                          èº«å?è­‰å???<span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="A123456789"
                          value={personalForm.idNumber}
                          onChange={e => setPersonalForm({...personalForm, idNumber: e.target.value.toUpperCase()})}
                          maxLength={10}
                          className="w-full text-stone-950 px-3 py-2 text-xs border border-stone-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1.5">?ºç??¥æ? <span className="text-rose-500">*</span></label>
                        <input
                          type="date"
                          value={personalForm.birthday}
                          onChange={e => setPersonalForm({...personalForm, birthday: e.target.value})}
                          className="w-full text-stone-950 px-3 py-2 text-xs border border-stone-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1.5">?§åˆ¥ <span className="text-rose-500">*</span></label>
                        <select
                          value={personalForm.gender}
                          onChange={e => setPersonalForm({...personalForm, gender: e.target.value})}
                          className="w-full text-stone-950 px-3 py-3 text-xs border border-stone-200 rounded-lg focus:border-indigo-500 focus:outline-none bg-white"
                          required
                        >
                          <option value="">è«‹é¸??/option>
                          <option value="??>??/option>
                          <option value="å¥?>å¥?/option>
                          <option value="?¶ä?">?¶ä?</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1.5">è¡€??/label>
                        <select
                          value={personalForm.bloodType || ''}
                          onChange={e => setPersonalForm({...personalForm, bloodType: e.target.value})}
                          className="w-full text-stone-950 px-3 py-3 text-xs border border-stone-200 rounded-lg focus:border-indigo-500 focus:outline-none bg-white"
                        >
                          <option value="">è«‹é¸??/option>
                          <option value="A??>A??/option>
                          <option value="B??>B??/option>
                          <option value="O??>O??/option>
                          <option value="AB??>AB??/option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1.5">?¯çµ¡?»è©± <span className="text-rose-500">*</span></label>
                        <input
                          type="tel"
                          placeholder="0911-222-333"
                          value={personalForm.phone}
                          onChange={e => setPersonalForm({...personalForm, phone: e.target.value})}
                          className="w-full text-stone-950 px-3 py-2 text-xs border border-stone-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1.5">?»éƒµä¿¡ç®± (?è¨­)</label>
                        <input
                          type="email"
                          value={personalForm.email}
                          readOnly
                          className="w-full px-3 py-2 text-xs border border-stone-100 rounded-lg bg-stone-50 text-stone-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1.5">?¶ç??°å? <span className="text-rose-500">*</span></label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
                          <input
                            type="text"
                            placeholder="è«‹å¡«?¥èº«?†è??Œé¢ä¹‹æ?å®šæˆ¶ç±åœ°?€"
                            value={personalForm.legalAddress}
                            onChange={e => setPersonalForm({...personalForm, legalAddress: e.target.value})}
                            className="w-full text-stone-950 pl-9 pr-3 py-2 text-xs border border-stone-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                            required
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="sameAddress"
                          checked={sameAddress}
                          onChange={() => {
                            const val = !sameAddress;
                            setSameAddress(val);
                            if (val) {
                              setPersonalForm({
                                ...personalForm,
                                contactAddress: personalForm.legalAddress
                              });
                            }
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="sameAddress" className="text-xs text-stone-500 select-none cursor-pointer">
                          ?Œä?ï¼ˆé€šè??°å??‡æˆ¶ç±åœ°?€?¸å?ï¼?                        </label>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1.5">?šè?ä½å?</label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
                          <input
                            type="text"
                            placeholder="?®å?å±…ä??°å?"
                            value={personalForm.contactAddress}
                            onChange={e => setPersonalForm({...personalForm, contactAddress: e.target.value})}
                            disabled={sameAddress}
                            className={`w-full text-stone-950 pl-9 pr-3 py-2 text-xs border border-stone-200 rounded-lg focus:outline-none ${
                              sameAddress ? 'bg-stone-50 text-stone-400' : 'focus:border-indigo-500'
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-stone-100 pt-6 space-y-4">
                      <h5 className="text-xs font-semibold text-stone-900 flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-indigo-600" />
                        ?¬å¸?¥è–ª?æ‰¶é¤Šè¦ªå±¬è??¥ä??·å±¬è¨­å?
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-1">
                          <label className="block text-xs font-semibold text-indigo-900 mb-1.5 flex items-center gap-1">
                            <span>?¥æ¬¾?€è¡?<span className="text-rose-500">*</span></span>
                            <span className="text-[10px] text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded font-normal">?‡å??¥è–ªè¡?/span>
                          </label>
                          <input
                            type="text"
                            readOnly
                            value="ä¸­å?ä¿¡è??€è¡?(822)"
                            className="w-full text-stone-600 bg-stone-50 border border-stone-150 px-3 py-2 text-xs rounded-lg focus:outline-none font-semibold"
                            required
                          />
                        </div>
                        <div className="md:col-span-1">
                          <label className="block text-xs font-semibold text-stone-700 mb-1.5">?¯æ¬¾?€è¡Œå¸³??<span className="text-rose-500">*</span></label>
                          <input
                            type="text"
                            placeholder="è«‹å¡«?¥å€‹äººå®Œæ•´å­˜æ‘ºå¸³è?"
                            value={personalForm.bankAccount}
                            onChange={e => setPersonalForm({...personalForm, bankAccount: e.target.value})}
                            className="w-full text-stone-950 px-3 py-2 text-xs border border-stone-200 rounded-lg focus:border-indigo-500 focus:outline-none font-mono"
                            required
                          />
                        </div>
                        <div className="md:col-span-1">
                          <label className="block text-xs font-semibold text-stone-700 mb-1.5">?€å¾—æ‰£ç¹³æ‰¶é¤Šè¦ªå±?<span className="text-rose-500">*</span></label>
                          <select
                            value={personalForm.dependentsCount}
                            onChange={e => setPersonalForm({...personalForm, dependentsCount: e.target.value})}
                            className="w-full text-stone-950 px-3 py-3 text-xs border border-stone-200 rounded-lg focus:border-indigo-500 focus:outline-none bg-white"
                            required
                          >
                            <option>0 äº?/option>
                            <option>1 äº?/option>
                            <option>2 äº?/option>
                            <option>3 äººä»¥ä¸?/option>
                          </select>
                        </div>
                        <div className="md:col-span-1">
                          <label className="block text-xs font-semibold text-indigo-900 mb-1.5">?¥ä??·å±¬?•ä?</label>
                          <select
                            value={personalForm.healthDependentsCount || '0 äº?}
                            onChange={e => handleHealthDependentsCountChange(e.target.value)}
                            className="w-full text-indigo-950 px-3 py-3 text-xs border border-indigo-200 rounded-lg focus:border-indigo-500 focus:outline-none bg-indigo-50/30 font-semibold"
                          >
                            <option>0 äº?/option>
                            <option>1 äº?/option>
                            <option>2 äº?/option>
                            <option>3 äº?/option>
                          </select>
                        </div>
                      </div>

                      {/* ?¥ä??·å±¬?•ä?è¡¨æ ¼ */}
                      {parseInt(personalForm.healthDependentsCount || '0') > 0 && (
                        <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                          <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                            <h6 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                              <Users className="w-4 h-4 text-indigo-600" />
                              ?¥ä??·å±¬?•ä?è©³ç´°è³‡æ?å¡«å¯«
                            </h6>
                            <span className="text-[10px] text-stone-500 font-medium">?¥ä??•ä??ç›´ç³»è?è¦ªæ??å¶</span>
                          </div>
                          <div className="space-y-4">
                            {(personalForm.healthDependents || []).map((dep, idx) => (
                              <div key={idx} className="bg-white p-4 rounded-xl border border-stone-100 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div>
                                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                                    ?·å±¬ {idx + 1} å§“å? <span className="text-rose-500">*</span>
                                  </label>
                                  <input
                                    type="text"
                                    required
                                    placeholder="è«‹å¡«å¯«å???
                                    value={dep.name || ''}
                                    onChange={(e) => {
                                      const newDeps = [...(personalForm.healthDependents || [])];
                                      newDeps[idx] = { ...newDeps[idx], name: e.target.value };
                                      setPersonalForm({ ...personalForm, healthDependents: newDeps });
                                    }}
                                    className="w-full text-stone-950 bg-white border border-stone-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                                    ?œä? <span className="text-rose-500">*</span>
                                  </label>
                                  <select
                                    required
                                    value={dep.relationship || ''}
                                    onChange={(e) => {
                                      const newDeps = [...(personalForm.healthDependents || [])];
                                      newDeps[idx] = { ...newDeps[idx], relationship: e.target.value };
                                      setPersonalForm({ ...personalForm, healthDependents: newDeps });
                                    }}
                                    className="w-full text-stone-950 bg-white border border-stone-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 transition-colors bg-white select-none"
                                  >
                                    <option value="">è«‹é¸??/option>
                                    <option value="?å¶">?å¶</option>
                                    <option value="å­å¥³">å­å¥³</option>
                                    <option value="?¶æ?">?¶æ?</option>
                                    <option value="ç¥–çˆ¶æ¯å?å¤–ç??¶æ?">ç¥–çˆ¶æ¯å?å¤–ç??¶æ?</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                                    ?·å±¬èº«å?è­‰å???<span className="text-rose-500">*</span>
                                  </label>
                                  <input
                                    type="text"
                                    required
                                    maxLength={10}
                                    placeholder="ä¾? A123456789"
                                    value={dep.idNumber || ''}
                                    onChange={(e) => {
                                      const newDeps = [...(personalForm.healthDependents || [])];
                                      newDeps[idx] = { ...newDeps[idx], idNumber: e.target.value.toUpperCase() };
                                      setPersonalForm({ ...personalForm, healthDependents: newDeps });
                                    }}
                                    className="w-full text-stone-950 bg-white border border-stone-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 font-mono transition-colors"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                                    ?·å±¬?Ÿæ—¥ <span className="text-rose-500">*</span>
                                  </label>
                                  <input
                                    type="date"
                                    required
                                    value={dep.birthday || ''}
                                    onChange={(e) => {
                                      const newDeps = [...(personalForm.healthDependents || [])];
                                      newDeps[idx] = { ...newDeps[idx], birthday: e.target.value };
                                      setPersonalForm({ ...personalForm, healthDependents: newDeps });
                                    }}
                                    className="w-full text-stone-950 bg-white border border-stone-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-stone-100 pt-6 space-y-4">
                      <h5 className="text-xs font-semibold text-stone-900">
                        ?š¨ ç·Šæ€¥æ?è®Šè??¯çµ¡äººè«®è©?                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1.5">?¯çµ¡äººç?å¯¦å???<span className="text-rose-500">*</span></label>
                          <input
                            type="text"
                            placeholder="?‡æ‚¨?œä?å¯†å??…ä?å§“å?"
                            value={personalForm.emergencyName}
                            onChange={e => setPersonalForm({...personalForm, emergencyName: e.target.value})}
                            className="w-full text-stone-950 px-3 py-2 text-xs border border-stone-200 rounded-lg focus:border-[#8D1B1B] focus:outline-none"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1.5">?œä?èªªæ?</label>
                          <input
                            type="text"
                            placeholder="ä¾‹ï??å¶?çˆ¶æ¯ã€æ?è¶?
                            value={personalForm.emergencyRelationship}
                            onChange={e => setPersonalForm({...personalForm, emergencyRelationship: e.target.value})}
                            className="w-full text-stone-950 px-3 py-2 text-xs border border-stone-200 rounded-lg focus:border-[#8D1B1B] focus:outline-none font-sans"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1.5">?¯çµ¡?»è©± <span className="text-rose-500">*</span></label>
                          <input
                            type="tel"
                            placeholder="è¡Œå??»è©±?–å®¤?§é›»è©?
                            value={personalForm.emergencyPhone}
                            onChange={e => setPersonalForm({...personalForm, emergencyPhone: e.target.value})}
                            className="w-full text-stone-950 px-3 py-2 text-xs border border-stone-200 rounded-lg focus:border-[#8D1B1B] focus:outline-none"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-stone-100 pt-6 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => syncWithServer({ personalData: personalForm })}
                        className="px-4 py-2 text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer"
                      >
                        ?«å??ºæœ¬è³‡æ?
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer"
                      >
                        ?²å?ä¸¦å?å¾€ä¸‹ä?æ­?                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* 2. Career Experience Form Section */}
              {openSection === 'career' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 space-y-6">
                  <div className="flex items-center gap-2 pb-4 border-b border-stone-100">
                    <Briefcase className="w-5 h-5 text-indigo-600" />
                    <div>
                      <h4 className="text-base font-semibold text-stone-900">2. ?»é?ç¶“æ­·?¨å?æ¥­è??§æ?æ¡?/h4>
                      <p className="text-xs text-stone-500">?”åŠ©?¬å¸?´å??´ç­è§?‚¨?„ç?æ­·è?å°ˆæ¥­?€??/p>
                    </div>
                  </div>

                  {/* Experience List */}
                  <div className="space-y-3">
                    <span className="block text-xs font-semibold text-stone-500 uppercase tracking-widest">
                      ä¸€?å·¥ä½œç?æ­?                    </span>
                    {experiences.length === 0 ? (
                      <p className="text-xs text-stone-400 italic bg-stone-50/50 p-4 rounded-lg text-center">
                        ?¥ç„¡å·¥ä?ç´€?„ï??¨å¯ä»¥å¡«?¥é?å¾€?„å·¥è®€?–ç¤¾?˜ç?æ­·ã€?                      </p>
                    ) : (
                      <div className="space-y-2">
                        {experiences.map((exp, val) => (
                          <div key={val} className="flex justify-between items-start bg-stone-50 border border-stone-100 p-4 rounded-xl">
                            <div>
                              <strong className="text-xs text-indigo-600 block">{exp.companyName}</strong>
                              <span className="text-[11px] text-stone-600 font-semibold block">{exp.jobTitle}</span>
                              <span className="text-[10px] text-stone-400">{exp.startDate} ~ {exp.endDate || '?³ä?'}</span>
                              {exp.leaveReason && <p className="text-[10px] text-stone-500 mt-1">?¢è·äº‹ç”±ï¼š{exp.leaveReason}</p>}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeExperience(val)}
                              className="p-1.5 text-stone-400 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Experience subform toggle */}
                    {expShowForm ? (
                      <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          <div>
                            <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                              ?å??¬å¸?ç¨± <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={tempExp.companyName}
                              onChange={e => setTempExp({...tempExp, companyName: e.target.value})}
                              placeholder="ä¾‹ï??›å??’å? / OOé¤é£²"
                              className="w-full text-stone-950 px-2.5 py-1.5 text-xs border border-stone-200 rounded focus:border-indigo-500 focus:outline-none bg-white font-sans"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                              ?”ç•¶?·ä??ç¨± <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={tempExp.jobTitle}
                              onChange={e => setTempExp({...tempExp, jobTitle: e.target.value})}
                              placeholder="ä¾‹ï??¥å?å°ˆå“¡ / ä¸»å?"
                              className="w-full text-stone-950 px-2.5 py-1.5 text-xs border border-stone-200 rounded focus:border-indigo-500 focus:outline-none bg-white font-sans"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-stone-600 mb-1">ä»»è·èµ·æ?</label>
                            <input
                              type="month"
                              value={tempExp.startDate}
                              onChange={e => setTempExp({...tempExp, startDate: e.target.value})}
                              className="w-full text-stone-950 px-2.5 py-1.5 text-xs border border-stone-200 rounded focus:border-indigo-500 focus:outline-none bg-white font-sans"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-stone-600 mb-1">?¢ä»»å¹´æ?ï¼ˆç©º?½ä»£è¡¨ç¾?·ä¸­ï¼?/label>
                            <input
                              type="month"
                              value={tempExp.endDate}
                              onChange={e => setTempExp({...tempExp, endDate: e.target.value})}
                              className="w-full text-stone-950 px-2.5 py-1.5 text-xs border border-stone-200 rounded focus:border-indigo-500 focus:outline-none bg-white font-sans"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-stone-600 mb-1">?¢è·?Ÿå?ï¼ˆé¸å¡«ï?</label>
                          <input
                            type="text"
                            placeholder="èªªæ??¢è·ä¹‹ä???(ä¾‹å?: ?ˆç??Ÿæ»¿ / ?‹äºº?Ÿæ¶¯è¦å?)"
                            value={tempExp.leaveReason}
                            onChange={e => setTempExp({...tempExp, leaveReason: e.target.value})}
                            className="w-full text-stone-950 px-2.5 py-1.5 text-xs border border-stone-200 rounded focus:border-indigo-500 focus:outline-none bg-white font-sans"
                          />
                        </div>
                        <div className="flex justify-end gap-2.5">
                          <button
                            type="button"
                            onClick={() => setExpShowForm(false)}
                            className="px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-slate-100 border border-stone-200 rounded cursor-pointer"
                          >
                            ?–æ?
                          </button>
                          <button
                            type="button"
                            onClick={addExperience}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded cursor-pointer"
                          >
                            ç¢ºè?
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setExpShowForm(true)}
                        className="w-full border border-dashed border-stone-200 text-stone-500 p-3 rounded-lg text-xs hover:border-indigo-600 hover:text-indigo-600 transition-colors leading-relaxed block text-center cursor-pointer"
                      >
                        + é»æ??°å??¨ç?å·¥ä?ç¶“æ­·
                      </button>
                    )}
                  </div>

                  {/* Education List */}
                  <div className="border-t border-stone-100 pt-6 space-y-3">
                    <span className="block text-xs font-semibold text-stone-500 uppercase tracking-widest">
                      äºŒã€æ??²è??¯è?å­¸æ­·è­‰æ?
                    </span>
                    {educations.length === 0 ? (
                      <p className="text-xs text-stone-400 italic bg-stone-50/50 p-4 rounded-lg text-center">
                        å°šç„¡å­¸æ­·ç´€?„ï??¨å¯ä»¥å¡«?¥é?å¾€?„é?ä¸­ã€å¤§å­¸ã€ç?ç©¶æ?ä»¥ä?å­¸æ­·??                      </p>
                    ) : (
                      <div className="space-y-2">
                        {educations.map((edu, idx) => (
                          <div key={idx} className="flex justify-between items-start bg-stone-50 border border-stone-100 p-4 rounded-xl">
                            <div>
                              <strong className="text-xs text-indigo-600 block">{edu.schoolName}</strong>
                              <span className="text-[11px] text-stone-600 font-semibold block">{edu.major ? `${edu.major} ` : ''}({edu.degree || 'å­¸ä??¡å¡«å¯?})</span>
                              <span className="text-[10px] text-stone-400">å°±è??Ÿé?ï¼š{edu.period || '?¡å¡«'} ï½??€?‹ï?{edu.status || '?ªé¸??}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeEducation(idx)}
                              className="p-1.5 text-stone-400 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Education subform toggle */}
                    {eduShowForm ? (
                      <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          <div>
                            <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                              å­¸æ ¡?ç¨± <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={tempEdu.schoolName}
                              onChange={e => setTempEdu({...tempEdu, schoolName: e.target.value})}
                              placeholder="ä¾‹ï??°ç£å¤§å­¸ / ?°å??†å¤§"
                              className="w-full text-stone-950 px-2.5 py-1.5 text-xs border border-stone-200 rounded focus:border-indigo-500 focus:outline-none bg-white font-sans"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                              ç§‘ç³»
                            </label>
                            <input
                              type="text"
                              value={tempEdu.major}
                              onChange={e => setTempEdu({...tempEdu, major: e.target.value})}
                              placeholder="ä¾‹ï?ä¼æ¥­ç®¡ç?å­¸ç³» / è§€?‰ä?æ¥­ç?"
                              className="w-full text-stone-950 px-2.5 py-1.5 text-xs border border-stone-200 rounded focus:border-indigo-500 focus:outline-none bg-white font-sans"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-stone-600 mb-1">å­¸ä?</label>
                            <input
                              type="text"
                              value={tempEdu.degree}
                              onChange={e => setTempEdu({...tempEdu, degree: e.target.value})}
                              placeholder="ä¾‹ï?å­¸å£« / ç¢©å£« / ?¯å­¸å£?/ é«˜ä¸­??
                              className="w-full text-stone-950 px-2.5 py-1.5 text-xs border border-stone-200 rounded focus:border-indigo-500 focus:outline-none bg-white font-sans"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-stone-600 mb-1">å°±è??Ÿé?</label>
                            <input
                              type="text"
                              value={tempEdu.period}
                              onChange={e => setTempEdu({...tempEdu, period: e.target.value})}
                              placeholder="ä¾‹ï?2018å¹???~ 2022å¹???
                              className="w-full text-stone-950 px-2.5 py-1.5 text-xs border border-stone-200 rounded focus:border-indigo-500 focus:outline-none bg-white font-sans"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                              ?¯å¦?¢æ¥­ <span className="text-rose-500">*</span>
                            </label>
                            <select
                              value={tempEdu.status}
                              onChange={e => setTempEdu({...tempEdu, status: e.target.value as any})}
                              className="w-full text-stone-950 px-2.5 py-1.5 text-xs border border-stone-200 rounded focus:border-indigo-500 focus:outline-none bg-white font-sans"
                            >
                              <option value="">-- è«‹é¸??--</option>
                              <option value="?¢æ¥­">?¢æ¥­</option>
                              <option value="?„æ¥­">?„æ¥­</option>
                              <option value="å°±è?ä¸?>å°±è?ä¸?/option>
                            </select>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2.5">
                          <button
                            type="button"
                            onClick={() => setEduShowForm(false)}
                            className="px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-slate-100 border border-stone-200 rounded cursor-pointer"
                          >
                            ?–æ?
                          </button>
                          <button
                            type="button"
                            onClick={addEducation}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded cursor-pointer"
                          >
                            ç¢ºè?
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEduShowForm(true)}
                        className="w-full border border-dashed border-stone-200 text-stone-500 p-3 rounded-lg text-xs hover:border-indigo-600 hover:text-indigo-600 transition-colors leading-relaxed block text-center cursor-pointer"
                      >
                        + é»æ??°å??¨ç??™è‚²/å­¸æ­·?Œæ™¯
                      </button>
                    )}
                  </div>

                  {/* Licenses Rows */}
                  <div className="border-t border-stone-100 pt-6 space-y-4">
                    <span className="block text-xs font-semibold text-stone-500 uppercase tracking-widest">
                      ä¸‰ã€æ??‰å?æ¥­è??§è??‹å®¶è³‡æ ¼?³å ±
                    </span>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-stone-100 text-[10px] text-stone-400 font-semibold uppercase tracking-wider">
                            <th className="pb-2">è­‰ç…§/è­‰æ›¸?ç¨±</th>
                            <th className="pb-2">ç­‰ç?/?†æ•¸èªªæ?</th>
                            <th className="pb-2">?–å?/?Ÿæ???/th>
                            <th className="pb-2">?‰æ??ªæ­¢?ï??¥ç„¡?¯ä?å¡«ï?</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-50 text-xs">
                          {licenses.map((lic, val) => (
                            <tr key={val}>
                              <td className="py-2 pr-2">
                                <input
                                  type="text"
                                  placeholder="ä¾‹ï?å¤šç? (TOEIC) / ä¹™ç?ä¸­é??¹èª¿"
                                  value={lic.licenseName}
                                  onChange={e => updateLicense(val, 'licenseName', e.target.value)}
                                  className="w-full text-stone-950 px-2 py-1.5 text-xs border border-stone-200 rounded focus:border-indigo-5050 focus:outline-none bg-white font-sans"
                                />
                              </td>
                              <td className="py-2 pr-2">
                                <input
                                  type="text"
                                  placeholder="ä¾‹ï??‘ç? / 850 ??
                                  value={lic.badgeLevel}
                                  onChange={e => updateLicense(val, 'badgeLevel', e.target.value)}
                                  className="w-full text-stone-950 px-2 py-1.5 text-xs border border-stone-200 rounded focus:border-indigo-550 focus:outline-none bg-white font-sans"
                                />
                              </td>
                              <td className="py-2 pr-2">
                                <input
                                  type="month"
                                  value={lic.issueDate}
                                  onChange={e => updateLicense(val, 'issueDate', e.target.value)}
                                  className="w-full text-stone-950 px-2 py-1.5 text-xs border border-stone-200 rounded focus:border-indigo-550 focus:outline-none bg-white font-sans"
                                />
                              </td>
                              <td className="py-2">
                                <input
                                  type="month"
                                  value={lic.expiryDate}
                                  onChange={e => updateLicense(val, 'expiryDate', e.target.value)}
                                  className="w-full text-stone-950 px-2 py-1.5 text-xs border border-stone-200 rounded focus:border-indigo-550 focus:outline-none bg-white font-sans"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button
                      type="button"
                      onClick={addLicenseRow}
                      className="text-xs text-indigo-600 font-semibold hover:underline block"
                    >
                      + ?°å?ä¸€?—è??¸æ?ä½?                    </button>
                  </div>

                  {/* Languages Section */}
                  <div className="border-t border-stone-100 pt-6 space-y-4">
                    <span className="block text-xs font-semibold text-stone-500 uppercase tracking-widest font-sans">
                      ?›ã€è?è¨€?½å?
                    </span>
                    <p className="text-[11px] text-stone-400 font-sans">
                      è«‹é¸?–æ‚¨?·å??„è?è¨€?½å?ï¼Œè‹¥?ºã€Œå…¶ä»–ã€è?è¼¸å…¥èªè??ç¨±ï¼Œç?åº¦å??†ç‚ºï¼šã€Œç²¾?šã€ã€ã€Œå„ª?¯ã€ã€ã€Œä¸­ç­‰ã€ã€ã€Œç•¥?‚ã€ï??æ¬¡é»é¸?¯å?æ¶ˆé¸?–ï???                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {languages.map((lang, idx) => {
                        const isOther = lang.language === '?¶ä?';
                        return (
                          <div key={idx} className="bg-stone-50 border border-stone-100 p-4 rounded-xl space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-stone-800">
                                {isOther ? '?¶ä?èªè?' : `${lang.language}`}
                              </span>
                              {isOther && (
                                <input
                                  type="text"
                                  placeholder="è«‹å¡«å¯«è?è¨€?ç¨±"
                                  value={lang.customName || ''}
                                  onChange={e => {
                                    const newList = [...languages];
                                    newList[idx].customName = e.target.value;
                                    setLanguages(newList);
                                    syncWithServer({ careerData: { experiences, educations, licenses, languages: newList, additionalNotes } });
                                  }}
                                  className="text-xs px-2.5 py-1 border border-stone-200 rounded focus:border-indigo-500 focus:outline-none bg-white font-sans w-40 text-stone-900"
                                />
                              )}
                            </div>
                            <div className="grid grid-cols-4 gap-1.5">
                              {(['ç²¾é€?, '?ªè‰¯', 'ä¸­ç?', '?¥æ?'] as const).map(lev => {
                                const active = lang.level === lev;
                                return (
                                  <button
                                    key={lev}
                                    type="button"
                                    onClick={() => {
                                      const newList = [...languages];
                                      newList[idx].level = active ? '' : lev;
                                      setLanguages(newList);
                                      syncWithServer({ careerData: { experiences, educations, licenses, languages: newList, additionalNotes } });
                                    }}
                                    className={`py-1.5 text-[11px] font-medium rounded-lg border transition-all text-center cursor-pointer ${
                                      active
                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                                        : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                                    }`}
                                  >
                                    {lev}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Additional notes */}
                  <div className="border-t border-stone-100 pt-6">
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                      ?¶é?å°ˆé•·?é?æª¢ç?æ³?or ?™è¨»äº‹é?è£œå?èªªæ?
                    </label>
                    <textarea
                      placeholder="å¦‚æ??¶é??¹æ??èƒ½?å?èªè??¸ã€æ??¯é??¼æª¢?¥ä??¹åˆ¥?™è?èªªæ?ï¼Œè??¨æ­¤ä¸æ??¼å??ªç”±è£œå?è¼¸å…¥..."
                      value={additionalNotes}
                      onChange={e => setAdditionalNotes(e.target.value)}
                      className="w-full text-stone-950 px-3 py-2 text-xs border border-stone-200 rounded-lg focus:border-indigo-500 focus:outline-none min-h-[90px]"
                    />
                  </div>

                  <div className="border-t border-stone-100 pt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => syncWithServer({ careerData: { experiences, educations, licenses, languages, additionalNotes } })}
                      className="px-4 py-2 text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer"
                    >
                      ?«å?å­¸ç?æ­?                    </button>
                    <button
                      type="button"
                      onClick={saveCareer}
                      className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer"
                    >
                      ?²å?ä¸¦å?å¾€ä¸‹ä?æ­?                    </button>
                  </div>
                </div>
              )}

              {/* 3. File upload Section */}
              {openSection === 'upload' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 space-y-6">
                  <div className="flex items-center gap-2 pb-4 border-b border-stone-100">
                    <Upload className="w-5 h-5 text-indigo-600" />
                    <div>
                      <h4 className="text-base font-semibold text-stone-900">3. é©—æŸ¥ä¸¦ä??³å ±?°æ?ä»?(?å? PDF)</h4>
                      <p className="text-xs text-stone-500">
                        ä¾æ??å?? ä??‡æ ¸é©—ï?è«‹å??¥é??Šä??³ä??—æ?ä»?(??PDF ?¼å?ï¼Œæ?å¤?10MB)
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {[
                      { id: 'idCard', label: '1. èº«å?è­‰æ­£?é¢å½±æœ¬', required: true, desc: 'è«‹æ?ä¾›æ??°ã€ç„¡?å?ä¹‹èº«?†è?æ­???¢å?ä½µå½±?¬å½±??PDF?? },
                      { id: 'degree', label: '2. ?€é«˜å­¸æ­·è??å½±??, required: true, desc: 'è«‹æ?ä¾›æ?é«˜å­¸æ­·ä??¢æ¥­è­‰æ›¸?–å?ç­‰å­¸?›è???PDF?? },
                      { id: 'military', label: '3. ?€ä¼ä»¤', required: false, desc: '?·æ€§å?ä»é?æª¢é?ï¼Œå¥³?§å?ä»å??„ã€‚è‹¥?ºå?å½¹è??„å?å½¹è???PDF??, femaleExempt: true },
                      { id: 'healthReport', label: '4. é«”æª¢?±å?', required: true, desc: 'ä¾å??ºæ?è¦å?æª¢é?ä¹‹ç‰¹ç´„é†«?‚æ?æ§‹å…¥?·é?æª¢å??¼å ±??PDF?? },
                      { id: 'healthIns', label: '5. ?Ÿæ?ä¿å–®ä½å¥ä¿è??ºå–®', required: false, desc: '?¥è??¨å…¬?¸å?ä¿å¥ä¿ï?è«‹æ?ä¾›å?ä¸€?•ä??®ä?ä¹‹å¥ä¿è??ºè??å–® PDF?? },
                      { id: 'bankCover', label: '6. ä¸­å?ä¿¡è??€è¡Œå¸³?¶å??¢å½±??, required: true, desc: '?¬å¸?‡å??¥è–ªå­˜æ‘ºå°é¢ PDF (?¶å??‡å¸³?Ÿå??ˆæ??°å¯è¾??? }
                    ].map((slot) => {
                      const loadedFile = OnboardEmployee.uploadedFiles?.find(f => f.docType === slot.id);
                      return (
                        <div key={slot.id} className="border border-stone-150 rounded-xl p-4 bg-stone-50/40 hover:bg-stone-50/70 transition-colors space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-stone-900">{slot.label}</span>
                              {slot.required ? (
                                <span className="bg-red-50 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded border border-red-100">
                                  å¿…å¡«
                                </span>
                              ) : (
                                <span className="bg-stone-200 text-stone-600 text-[10px] font-medium px-2 py-0.5 rounded border border-stone-300">
                                  {slot.femaleExempt ? '?¸å¡« / å¥³æ€§å??? : '?¸å¡«'}
                                </span>
                              )}
                            </div>
                            {loadedFile && (
                              <span className="text-[11px] text-[#0D9488] font-semibold bg-[#0D9488]/10 px-2.5 py-0.5 rounded-full flex items-center gap-1 self-start sm:self-auto">
                                <span>??å·²ä???/span>
                              </span>
                            )}
                          </div>
                          
                          <p className="text-[11px] text-stone-500 leading-relaxed">{slot.desc}</p>
                          
                          {loadedFile ? (
                            <div className="bg-white border border-[#0D9488]/20 rounded-lg p-3 flex items-center justify-between gap-3 text-xs shadow-sm">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="w-4 h-4 text-[#0D9488]" />
                                <span className="font-semibold text-stone-700 truncate">{loadedFile.name}</span>
                                <span className="text-[10px] text-stone-400">({(loadedFile.size / 1024).toFixed(1)} KB)</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => deleteUploadedFile(loadedFile.name)}
                                  className="text-stone-400 hover:text-rose-600 transition-colors p-1"
                                  title="ç§»é™¤æª”æ?"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100/50 rounded-lg cursor-pointer transition-colors">
                                <Upload className="w-3.5 h-3.5" />
                                ?¸æ? PDF æª”æ?ä¸Šå‚³
                                <input
                                  type="file"
                                  accept="application/pdf"
                                  className="hidden"
                                  onChange={(e) => handleSlotUploadChange(e, slot.id)}
                                />
                              </label>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {fileError && (
                    <div className="bg-rose-50 border border-rose-100 text-rose-700 p-3.5 rounded-lg text-xs">
                      {fileError}
                    </div>
                  )}

                  <div className="border-t border-stone-100 pt-6 flex justify-between items-center">
                    <p className="text-[10px] text-stone-400">
                      * ?é?ï¼šå¡«å¦?4 ?…å?å¡«æ?ä»¶å?ï¼Œè©²æ­¥é??³åˆ»æ¨™è??ºå??ã€?                    </p>
                    <button
                      type="button"
                      onClick={() => setOpenSection('rules')}
                      className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer"
                    >
                      ?å?ä¸‹ä?æ­¥ï??±è?è¦ç?
                    </button>
                  </div>
                </div>
              )}

              {/* 4. Rules & Disclosures Section */}
              {openSection === 'rules' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 space-y-6">
                  <div className="flex items-center gap-2 pb-4 border-b border-stone-100">
                    <FileText className="w-5 h-5 text-indigo-600" />
                    <div>
                      <h4 className="text-base font-semibold text-stone-900">4. ?±è?å·¥ä?è¦å??Šå€‹è??Œæ???/h4>
                      <p className="text-xs text-stone-500">?ºè?æ±‚å¥?¨å…±?Œå?ä½œã€æ?å®šå?è³‡ç¾©?™æ??Šï?è«‹å?å¿…è©³ç´°ç€è¦½</p>
                    </div>
                  </div>

                  {/* Centered Google Drive Rules Link */}
                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-indigo-50/40 via-white to-slate-50/50 border border-indigo-100 rounded-2xl p-6 text-center space-y-4 max-w-xl mx-auto my-4 shadow-sm">
                      <div className="mx-auto w-12 h-12 bg-white rounded-full flex items-center justify-center border border-indigo-100 shadow-sm">
                        <FileText className="w-6 h-6 text-indigo-600" />
                      </div>
                      <div className="space-y-1">
                        <h5 className="text-sm font-bold text-stone-850">
                          ?²æ?è§€?‰ã€Šå·¥ä½œè?ç¨‹è?é»å??„ç?èªªæ??¸ã€‹å…¨??                        </h5>
                        <p className="text-[11px] text-stone-500 leading-relaxed">
                          ?ºç¶­è­·æ‚¨?„å?æ³•å??•è?ä¿å?æ¬Šä?å®œï??‘å€‘å·²å°‡å…¨å¥?27 ?ï??«æ€§é¨·?¾é˜²æ²»å??³è¨´ç®¡é?è¾¦æ?ï¼‰ä?å®Œæ•´?Šå·¥ä½œè?ç¨‹ã€‹æ?ä»¶ç½®??Google ?²ç«¯å®‰å…¨ç©ºé???                        </p>
                      </div>
                      <div>
                        <a
                          href="https://drive.google.com/file/d/1m7ogOK0tN95ghoO-eIrs3I1IU7NWBs3X/view?usp=sharing"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg active:translate-y-0 hover:-translate-y-0.5 cursor-pointer"
                        >
                          <span>?? é»æ­¤?¼æ–°?†é??è¦½å®Œæ•´è¦ç? (??27 ??PDF)</span>
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 py-1 justify-center max-w-md mx-auto">
                      <input
                        type="checkbox"
                        id="rulesCheckbox"
                        checked={rulesRead}
                        onChange={() => setRulesRead(!rulesRead)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <label htmlFor="rulesCheckbox" className="text-xs text-stone-700 select-none cursor-pointer font-semibold leading-normal">
                        ?‘å·²è©³è?ä¸¦å??¨æ‰¿è«¾éµå®ˆã€Œæœ¬?¬å¸å·¥ä?è¦ç??ä??„é??±å?ç¾©å??‡è?ç¯?                      </label>
                    </div>
                  </div>

                  <div className="space-y-4 border-t border-stone-100 pt-7">
                    <label className="block text-xs font-semibold text-stone-700 uppercase tracking-widest text-center">
                      ?‹äººè³‡æ??é??•ç??‡æ?æ¬Šå??å??¥ä???                    </label>
                    <div className="h-100 overflow-y-auto border border-stone-100 rounded-xl p-4 text-[11px] text-stone-500 leading-relaxed space-y-4 bg-stone-50/50 select-none max-w-2xl mx-auto">
                      <p>?¬å…¬?¸ä??‹äººè³‡æ?ä¿è­·æ³•ï?ä¸‹ç¨±?‹è?æ³•ï?ç¬?æ¢ç¬¬1?…è?å®šï??? ?°ç«¯?ŠçŸ¥ä¸‹å?äº‹é?ï¼Œè??°ç«¯è©³é–±ï¼?/p>
                      <p>ä¸€???é?ä¹‹ç›®?„ï?</p>
                      <p>     ??	äººä?ç®¡ç?ï¼ˆå??«ç??¸ã€é›¢?·å??€å±¬å“¡å·¥åŸº?¬è?è¨Šã€ç¾?·ã€å­¸ç¶“æ­·?è€ƒç¸¾?æ‡²?è–ªè³‡å??‡ã€è??†ä??®ç?å·®å‹¤?ç??©æª?½ã€ç‰¹æ®ŠæŸ¥?¸æ??¶ä?äººä??ªæ–½ï¼?/p>
                      <p>     äº?	?¨æ??¥åº·ä¿éšª?Šå?å·¥ä???/p>
                      <p>     ä¸?	å­˜æ¬¾?‡åŒ¯æ¬?/p>
                      <p>     ??	å¥‘ç??é?ä¼¼å?ç´„æ??¶ä?æ³•å??œä?äº‹å??Šåƒ±?¨è??å?ç®¡ç?</p>
                      <p>     äº?	ç¨…å?è¡Œæ”¿?Šæ?è¨ˆè??¸é??å?</p>
                      <p>     ??	è³‡é€šå??¨è?ç®¡ç??Šè?(??è¨Šè?è³‡æ?åº«ç®¡??/p>
                      <p>     ä¸?	è§€?‰æ?é¤¨æ¥­?æ?é¤¨æ¥­ç¶“ç?ç®¡ç?æ¥­å??Šå…¶ä»–ç??Ÿå??¼ç?æ¥­ç™»è¨˜é??®æ?çµ„ç?ç« ç??€å®šä?æ¥­å?</p>
                      <p>äºŒã€??é?ä¹‹å€‹äººè³‡æ?é¡åˆ¥</p>
                      <p>     ä¸€)	è¾¨è??‹äºº?…ã€è²¡?™è€…å??¿å?è³‡æ?ä¸­ä?è¾¨è???/p>
                      <p>     äº?	?‹æ€§å?èº«é??è¿°?è·æ¥­ã€åƒ±?¨ç??ã€å·¥ä½œç?é©—ã€å¥åº·ç??„ã€å­¸?¡ç??„ã€çŠ¯ç½ªå??‘è??™ã€å®¶åº­æ?å½¢è?å®¶åº­?å“¡ä¹‹ç´°ç¯€</p>
                      <p>     ä¸?	?ªè??‡é???¬¾?å¥åº·è?å®‰å…¨ç´€?„ã€æ´¥è²¼ã€ç??©ã€è?æ¬¾ã€ç¤¾?ƒä??ªçµ¦ä»˜ã€å°±é¤Šçµ¦ä»˜å??¶ä??€ä¼‘çµ¦ä»˜ã€è??Ÿæ¥­?‰é?ä¹‹åŸ·?§ã€å®¶åº­æ?å½¢è?å®¶åº­?å“¡ä¹‹ç´°ç¯€</p>
                      <p>     ??	?ªå?é¡ä?è³‡æ?</p>
                      <p>ä¸‰ã€??‹äººè³‡æ??©ç”¨ä¹‹æ??“ã€åœ°?€?å?è±¡å??¹å?ï¼?/p>
                      <p>     ä¸€)	?Ÿé?ï¼šå€‹äººè³‡æ??é?ä¹‹ç‰¹å®šç›®?„å?çºŒæ???ä¾ç›¸?œæ?ä»¤è?å®šæ?å¥‘ç?ç´„å?ä¹‹ä?å­˜å¹´?ï?å¦‚ï??å??ºæ?æ³•ç?ï¼??¬å…¬?¸ç??‹æ?æ¥­å??€å¿…é?ä¹‹ä?å­˜æ??“ã€?/p>
                      <p>     äº?	?°å?ï¼šæœ¬?‹ã€æœ¬?¬å¸æµ·å??†æ”¯æ©Ÿæ??€?¨åœ°?æœª?—ä¸­å¤®ç›®?„ä?æ¥­ä¸»ç®¡æ??œé??¶ä??‹é??³è¼¸?‹äººè³‡æ?ä¹‹æ¥?¶è€…æ??¨åœ°?æœ¬?¬å¸æ¥­å?å§”å?æ©Ÿæ??€?¨åœ°?è??¬å…¬?¸æ?æ¥­å?å¾€ä¾†ä?æ©Ÿæ??Ÿæ¥­?•æ??€?¨åœ°??/p>
                      <p>     ä¸?	å°è±¡ï¼šæœ¬?¬å¸?è??¬å…¬?¸æ??§åˆ¶?œä?ä¹‹æ??¬å¸?¨å…¶?†å…¬?¸æ??†å??œä?ä¹‹å…¬?¸ã€æœª?—ä¸­å¤®ç›®?„ä?æ¥­ä¸»ç®¡æ??œé??¶ä??‹é??³è¼¸?‹äººè³‡æ?ä¹‹æ¥?¶è€…ã€å…¶ä»–è??¬å…¬?¸æ??è¿°?¬å¸? æ¥­?™é?è¦è??‰å?ç´„é?ä¿‚æ??‰æ¥­?™å?ä¾†ä?æ©Ÿæ?ï¼ˆå«?±å?è¡ŒéŠ·?å?ä½œæ¨å»????/p>
                      <p>?›ã€?ä¾å€‹è?æ³•ç¬¬3æ¢è?å®šï??°ç«¯å°±æœ¬?¬å¸ä¿æ??°ç«¯ä¹‹å€‹äººè³‡æ?å¾—è?ä½¿ä??—æ??©ï??Šè?ä½¿æ??©ä??¹å?ï¼?/p>
                      <p>     ä¸€)	å¾—å??¬å…¬?¸æŸ¥è©¢ã€è?æ±‚é–±è¦½æ?è«‹æ?è£½çµ¦è¤‡è£½?¬ï??Œæœ¬?¬å¸ä¾æ?å¾—é??¶å?è¦æ??¬è²»?¨ã€?/p>
                      <p>     äº?	å¾—å??¬å…¬?¸è?æ±‚è??…æ??´æ­£ï¼Œæ?ä¾æ??°ç«¯?‰ç‚º?©ç•¶ä¹‹é??ã€?/p>
                      <p>     ä¸?	å¾—å??¬å…¬?¸è?æ±‚å?æ­¢è??†ã€è??†æ??©ç”¨?Šè?æ±‚åˆª?¤ï??Ÿä?æ³•æœ¬?¬å¸? åŸ·è¡Œæ¥­?™æ?å¿…é??…ï?å¾—ä?ä¾å°ç«¯è?æ±‚ç‚ºä¹‹ã€?/p>
                      <p>äº”ã€??°ç«¯ä¸æ?ä¾›å€‹äººè³‡æ??€?´æ??Šä?å½±éŸ¿ï¼?/p>
                      <p>     ?°ç«¯å¾—è‡ª?±é¸?‡æ˜¯?¦æ?ä¾›ç›¸?œå€‹äººè³‡æ?ï¼Œæ??°ç«¯?¥æ?çµ•æ?ä¾›ç›¸?œå€‹äººè³‡æ?ï¼Œæœ¬?¬å¸å°‡ç„¡æ³•é€²è?å¿…è?ä¹‹å¯©?¸ã€è??†ã€ä?æ¥­æ??¶ä??¸é?äº‹é?ï¼Œè‡´?¯èƒ½å½±éŸ¿?°ç«¯æ¬Šç??–ç„¡æ³•é€²è??¬å…¬?¸æ–°?²äºº?¡ä??²ç”¨æµç???/p>
                      <p>?­ã€??°ç«¯?Œæ??¬å…¬?¸æ?æ¬Šä¿®è¨‚æœ¬?ŠçŸ¥æ¢æ¬¾?§å®¹ï¼Œä¸¦?Œæ??¬å…¬?¸æ–¼ä¿®è?å¾Œï?å¾—ä»¥è¨€è©ã€æ›¸?¢ã€é›»è©±ã€ç°¡è¨Šã€é›»å­éƒµä»¶ã€å‚³?Ÿã€é›»å­æ?ä»¶æ??¶ä?è¶³ä»¥ä½¿å°ç«¯çŸ¥?‰æ??¯å??¥æ?ä¹‹æ–¹å¼ï??…æ‹¬ä½†ä??æ–¼ä»¥å?è¿°æ–¹å¼å??¥æ?ä¾›è©³è¼‰æœ¬?ŠçŸ¥æ¢æ¬¾?§å®¹ä¹‹ç¶²ç«™é€??ï¼‰ï??ŠçŸ¥ ?°ç«¯ä¿®è?è¦é??Šæ?å®šç¶²?ã€?/p>
                    </div>
                    <div className="flex items-center gap-2.5 py-1 justify-center max-w-lg mx-auto">
                      <input
                        type="checkbox"
                        id="privacyCheckbox"
                        checked={privacyRead}
                        onChange={() => setPrivacyRead(!privacyRead)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <label htmlFor="privacyCheckbox" className="text-xs text-stone-700 select-none cursor-pointer font-semibold leading-normal">
                        ?‘å·²?­è§£ä¸¦å??ä??‹ä??…ï?å¡«å¯«?é??è??†å??©ç”¨?‹äººè³‡æ??ŠçŸ¥æ¢æ¬¾?Šç›¸?œå€‹äººè³‡æ?æ¬„ä??¨å??æœ¬?¬å¸å¾—ä»¥æ³•ä»¤è¦å??é??è??†å??©ç”¨é¡§å®¢ä¹‹å€‹äººè³‡æ?ï¼Œè??™è??†åœ°?€æ¶µè??°ç£?‡å?è¿°ç›¸?œå?è±¡ä??€?¨åœ°?‚æœ¬äººå·²æ¸…æ??­è§£è²´å…¬?¸è??†ã€è??†æ??©ç”¨?¬äºº?‹äººè³‡æ?ä¹‹ç›®?„å??¨é€”ã€?                      </label>
                    </div>
                  </div>

                  <div className="border-t border-stone-100 pt-6 flex justify-end">
                    <button
                      type="button"
                      disabled={!rulesRead || !privacyRead}
                      onClick={handleRulesSubmit}
                      className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 cursor-pointer"
                    >
                      ç¢ºè?ä¸¦é€å‡ºè¦ç??²æ?
                    </button>
                  </div>
                </div>
              )}

              {/* 5. Tax Allowance Declaration Section */}
              {openSection === 'tax' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 space-y-6">
                  <div className="flex items-center gap-2 pb-4 border-b border-stone-100">
                    <FileText className="w-5 h-5 text-indigo-600" />
                    <div>
                      <h4 className="text-base font-semibold text-stone-900">5. ?ªè??—é?äººå?ç¨…é??³å ±è¡?/h4>
                      <p className="text-xs text-stone-500">æ­¤ç”³?±è¡¨?œä??°æ‚¨æ¯æ??ªè??€å¾—æ’¥ä»˜æ?ä¹‹é????æ¬¾è?ç®—ï?è«‹è©³å¯¦å¡«??/p>
                    </div>
                  </div>

                  {/* Prefilled payer info Linked from personal profile */}
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 md:p-5 space-y-3 shadow-inner">
                    <span className="block text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
                      ?? ?ªè??—é?äººåŸº?¬è???(?Œæ­¥?ªå€‹äºº?ºæœ¬è³‡æ?)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <span className="block text-[10px] font-semibold text-stone-500">?ªè??—é?äººå???/span>
                        <span className="text-xs text-stone-850 font-bold bg-white px-2.5 py-1.5 rounded border border-stone-200 block mt-1">
                          {personalForm.name || OnboardEmployee.personalData?.name || OnboardEmployee.name || '?ªå¡«å¯?}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-semibold text-stone-500">?ºç?å¹´æ???/span>
                        <span className="text-xs text-stone-850 font-medium bg-white px-2.5 py-1.5 rounded border border-stone-200 block mt-1">
                          {personalForm.birthday || OnboardEmployee.personalData?.birthday || '?ªå¡«å¯?}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-semibold text-stone-500">?‹æ?èº«å?è­?çµ±ä?è­‰è?</span>
                        <span className="text-xs text-stone-850 font-mono bg-white px-2.5 py-1.5 rounded border border-stone-200 block mt-1">
                          {personalForm.idNumber || OnboardEmployee.personalData?.idNumber || '?ªå¡«å¯?}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-semibold text-stone-500">ä½å?</span>
                        <span className="text-xs text-stone-850 font-medium bg-white px-2.5 py-1.5 rounded border border-stone-200 block mt-1 truncate" title={personalForm.contactAddress || OnboardEmployee.personalData?.contactAddress || '?ªå¡«å¯?}>
                          {personalForm.contactAddress || OnboardEmployee.personalData?.contactAddress || '?ªå¡«å¯?}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Spouse section */}
                  <div className="border border-stone-200/80 rounded-2xl p-4 md:p-5 space-y-4">
                    <span className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                      ?‘« ?ªè??—é?äººé??¶è???(?¡é??¶è€…å?å¡?
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-600 mb-1">?å¶å§“å?</label>
                        <input
                          type="text"
                          value={spouseName}
                          onChange={e => {
                            setSpouseName(e.target.value);
                            syncWithServer({ taxDeclaration: { spouseName: e.target.value, spouseBirthday, spouseIdNumber, dependents: taxDependents, signed: taxSigned, signName: taxSignName } });
                          }}
                          placeholder="è«‹è¼¸?¥å???
                          className="w-full text-stone-950 px-2.5 py-1.5 text-xs border border-stone-200 rounded focus:border-indigo-500 focus:outline-none bg-white font-sans"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-600 mb-1">?å¶?ºç?å¹´æ???/label>
                        <input
                          type="text"
                          value={spouseBirthday}
                          onChange={e => {
                            setSpouseBirthday(e.target.value);
                            syncWithServer({ taxDeclaration: { spouseName, spouseBirthday: e.target.value, spouseIdNumber, dependents: taxDependents, signed: taxSigned, signName: taxSignName } });
                          }}
                          placeholder="ä¾‹ï?æ°‘å?75å¹???0??
                          className="w-full text-stone-950 px-2.5 py-1.5 text-xs border border-stone-200 rounded focus:border-indigo-500 focus:outline-none bg-white font-sans"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-600 mb-1">?å¶èº«å?è­‰è?/çµ±ä?è­‰è?</label>
                        <input
                          type="text"
                          value={spouseIdNumber}
                          onChange={e => {
                            setSpouseIdNumber(e.target.value);
                            syncWithServer({ taxDeclaration: { spouseName, spouseBirthday, spouseIdNumber: e.target.value, dependents: taxDependents, signed: taxSigned, signName: taxSignName } });
                          }}
                          placeholder="ä¾‹ï?A234567890"
                          className="w-full text-stone-950 px-2.5 py-1.5 text-xs border border-stone-200 rounded focus:border-indigo-500 focus:outline-none bg-white font-sans"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Dependents list and edit */}
                  <div className="border border-stone-200/80 rounded-2xl p-4 md:p-5 space-y-4">
                    <div className="flex justify-between items-center border-b border-stone-100 pb-2">
                      <span className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                        ?‘¨?ğ?©â€ğ?§â€ğ???ˆæ–¼æ¸›é™¤?¶é?è¦ªå±¬?ç?é¡ä??—æ‰¶é¤Šè¦ªå±?(??{taxDependents.length} ??
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowDepForm(!showDepForm)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-150 cursor-pointer"
                      >
                        {showDepForm ? '???œé??°å?æ¬? : 'ï¼??°å??—æ‰¶é¤Šè¦ªå±?}
                      </button>
                    </div>

                    {/* Add Dependent Form Inline */}
                    {showDepForm && (
                      <div className="bg-slate-50 border border-indigo-100 rounded-xl p-4 space-y-3.5">
                        <strong className="block text-xs font-bold text-indigo-700">?? ?°å??—æ‰¶é¤Šè¦ªå±¬è???/strong>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                          <div>
                            <label className="block text-[10px] font-semibold text-stone-600 mb-1">è¦ªå±¬é¡åˆ¥</label>
                            <select
                              value={tempDepType}
                              onChange={e => setTempDepType(e.target.value)}
                              className="w-full text-stone-950 px-2 py-1.5 text-xs border border-stone-200 rounded focus:border-indigo-500 focus:outline-none bg-white"
                            >
                              <option value="?´ç³»å°Šè¦ªå±?>ä¸€?ç›´ç³»å?è¦ªå±¬</option>
                              <option value="å­å¥³">äºŒã€å?å¥?/option>
                              <option value="?Œè??„å?å§Šå¦¹">ä¸‰ã€å??å?å¼Ÿå?å¦?/option>
                              <option value="?¶ä?è¦ªå±¬">?›ã€å…¶ä»–è¦ªå±¬æ?å®¶å±¬</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-stone-600 mb-1">è¦ªå±¬å§“å?</label>
                            <input
                              type="text"
                              value={tempDepName}
                              onChange={e => setTempDepName(e.target.value)}
                              placeholder="å®¶å±¬å§“å?"
                              className="w-full text-stone-950 px-2 py-1.5 text-xs border border-stone-200 rounded focus:border-indigo-500 focus:outline-none bg-white font-sans"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-stone-600 mb-1">ç¨±è?</label>
                            <input
                              type="text"
                              value={tempDepRel}
                              onChange={e => setTempDepRel(e.target.value)}
                              placeholder="ä¾‹ï?å®¶åš´ / æ¬¡å?"
                              className="w-full text-stone-950 px-2 py-1.5 text-xs border border-stone-200 rounded focus:border-indigo-500 focus:outline-none bg-white font-sans"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-stone-600 mb-1">?ºç?å¹´æ???/label>
                            <input
                              type="text"
                              value={tempDepBirth}
                              onChange={e => setTempDepBirth(e.target.value)}
                              placeholder="ä¾‹ï?æ°‘å?40å¹?????
                              className="w-full text-stone-950 px-2 py-1.5 text-xs border border-stone-200 rounded focus:border-indigo-500 focus:outline-none bg-white font-sans"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-stone-600 mb-1">?»é?èº«å?è­‰è?</label>
                            <input
                              type="text"
                              value={tempDepId}
                              onChange={e => setTempDepId(e.target.value)}
                              placeholder="ä¾‹ï?E123456789"
                              className="w-full text-stone-950 px-2 py-1.5 text-xs border border-stone-200 rounded focus:border-indigo-500 focus:outline-none bg-white font-sans"
                            />
                          </div>
                          <div className="md:col-span-2 lg:col-span-4">
                            <label className="block text-[10px] font-semibold text-stone-600 mb-1">ç¬¦å?æ¢ä»¶ä¹‹èªª??/label>
                            <input
                              type="text"
                              value={tempDepCond}
                              onChange={e => setTempDepCond(e.target.value)}
                              placeholder="ä¾‹ï?å¹´æ»¿60æ­?/ ?¨æ ¡å°±å­¸ / ?¡è??Ÿèƒ½?›ä¸¦?‰å…±?Œç?æ´»ä?å¯?
                              className="w-full text-stone-950 px-2 py-1.5 text-xs border border-stone-200 rounded focus:border-indigo-500 focus:outline-none bg-white font-sans"
                            />
                          </div>
                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={addTaxDependent}
                              className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded transition cursor-pointer"
                            >
                              ï¼??°å??³å ±äº²å?
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Dependent Group Sections rendered */}
                    <div className="space-y-4">
                      {['?´ç³»å°Šè¦ªå±?, 'å­å¥³', '?Œè??„å?å§Šå¦¹', '?¶ä?è¦ªå±¬'].map(type => {
                        const list = taxDependents.filter(d => d.type === type);
                        return (
                          <div key={type} className="bg-stone-50 rounded-xl p-3 border border-stone-100">
                            <span className="block text-[10px] font-bold text-[#8D1B1B] mb-2 font-mono">
                              {type === '?´ç³»å°Šè¦ªå±? && 'ä¸€?ç?ç¨…ç¾©?™äºº?Šå…¶?å¶ä¹‹ç›´ç³»å?è¦ªå±¬ (å¦‚çˆ¶æ¯ã€ç??¶æ?ï¼Œé?æ»?0æ­²æ??¡è??Ÿèƒ½?›è€?'}
                              {type === 'å­å¥³' && 'äºŒã€å?å¥?(?ªæ?å¹´ï??–å·²?å¹´?¨å­¸?èº«å¿ƒé?ç¤™ã€ç„¡è¬€?Ÿèƒ½?›è€?'}
                              {type === '?Œè??„å?å§Šå¦¹' && 'ä¸‰ã€å??å?å¼Ÿå?å¦?(?ªæ?å¹´ï??–å·²?å¹´?¨å­¸?èº«å¿ƒé?ç¤™ã€ç„¡è¬€?Ÿèƒ½?›è€?'}
                              {type === '?¶ä?è¦ªå±¬' && '?›ã€å…¶ä»–è¦ªå±?or å®¶å±¬ (?ˆæ–¼æ°‘æ?è¦å?ï¼Œæœª?å¹´?–å·²?å¹´?¨å­¸ä¸”å…·?±å??Ÿæ´»??'}
                            </span>
                            {list.length === 0 ? (
                              <p className="text-[10px] text-stone-400 italic pl-2">?¶å??¡ç”³?±æ­¤?®æ?å®šå??¶é?è¦ªå±¬</p>
                            ) : (
                              <div className="space-y-1.5 animate-fade-in">
                                {list.map((dep) => {
                                  const actualIdx = taxDependents.indexOf(dep);
                                  return (
                                    <div key={actualIdx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 border border-stone-150 rounded-xl text-xs hover:border-stone-300 transition-colors">
                                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 flex-grow font-sans">
                                        <div>
                                          <span className="text-[10px] text-stone-400 block font-semibold mb-0.5">è¦ªå±¬å§“å?</span>
                                          <span className="font-bold text-stone-800">{dep.name}</span>
                                        </div>
                                        <div>
                                          <span className="text-[10px] text-stone-400 block font-semibold mb-0.5">?œä?/ç¨±è?</span>
                                          <span className="text-stone-700 font-medium">{dep.relationship}</span>
                                        </div>
                                        <div>
                                          <span className="text-[10px] text-stone-400 block font-semibold mb-0.5">?ºç?å¹´æ???/span>
                                          <span className="text-stone-700 font-medium">{dep.birthday}</span>
                                        </div>
                                        <div>
                                          <span className="text-[10px] text-stone-400 block font-semibold mb-0.5">èº«å?è­?çµ±ä?è­‰è?</span>
                                          <span className="text-stone-700 font-mono tracking-wider">{dep.idNumber}</span>
                                        </div>
                                        <div className="col-span-2 md:col-span-1">
                                          <span className="text-[10px] text-stone-400 block font-semibold mb-0.5">ç¬¦å??«é?ä¹‹æ?å¾‹è?ä»¶å???/span>
                                          <span className="text-stone-500 font-medium truncate block max-w-[200px]" title={dep.condition}>{dep.condition}</span>
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => removeTaxDependent(actualIdx)}
                                        className="text-stone-400 hover:text-red-750 p-1.5 rounded-lg hover:bg-stone-50 transition-colors self-end sm:self-auto cursor-pointer"
                                        title="ç§»é™¤æ­¤å??¶é?è¦ªå±¬"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Signature area */}
                  <div className="bg-[#FAF6F0] border-2 border-dashed border-[#8D1B1B]/20 rounded-2xl p-6 space-y-4 shadow-sm text-center">
                    <div className="space-y-1">
                      <strong className="block text-xs font-bold text-stone-850">
                        ?²æ??‡ç? ?€?€ ?¬äººä¾æ?å¾—ç?æ³•è?å®šï?è­‰æ?ä»¥ä?å¡«å ±äº‹é??‡ç¢ºå¯¦ç„¡è¨?                      </strong>
                      <p className="text-[10px] text-stone-500 leading-relaxed max-w-lg mx-auto">
                        ?¬è¡¨ä¿‚ä??€å¾—ç?æ³•ç¬¬?ä?æ¢ç¬¬ä¸€?…ç¬¬ä¸€æ¬¾è?å®šç”³?±å?ç¨…é?ä¹‹ç”¨?‚å??˜äººå¡«å ±ä¹‹å??¶é?è¦ªå±¬ï¼Œå…¶èº«å??é?ä¿‚ã€ç??¥å??€å¾—ç?æ³ç?ï¼Œå??‰ä?å¯¦ã€é?è¤‡ç”³?±ï?é¡˜è‡ªè² æ?å¾‹è²¬ä»»ã€?                      </p>
                    </div>

                    {OnboardEmployee.taxDeclaration?.signed ? (
                      <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 p-4 rounded-xl text-center text-xs space-y-2 max-w-md mx-auto shadow-sm flex flex-col justify-center items-center">
                        <p className="font-bold">?? ?ç?é¡ç”³?±è¡¨?¸ä?ç°½ç½²å·²æ??Ÿæ­¸?·ï?</p>
                        <p className="text-[10px] text-emerald-600/90 font-mono">
                          å®‰å…¨?¸å?äººï?<strong>{OnboardEmployee.taxDeclaration.signName}</strong> ï½?ç°½ç½²?‚é?ï¼?strong>{OnboardEmployee.taxDeclaration.signedAt}</strong>
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
                        <div className="w-full">
                          <input
                            type="text"
                            value={taxSignName}
                            onChange={e => {
                              setTaxSignName(e.target.value);
                              syncWithServer({ taxDeclaration: { spouseName, spouseBirthday, spouseIdNumber, dependents: taxDependents, signed: taxSigned, signName: e.target.value } });
                            }}
                            placeholder="è«‹åœ¨æ­¤è¼¸?¥æ‚¨?„å??ä??ºæ•¸ä½å°?‘ç?"
                            className="w-full text-stone-950 px-3 py-2 text-xs border border-stone-200 rounded-xl focus:border-indigo-500 focus:outline-none bg-white font-semibold font-sans text-center"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleTaxSave(true)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 text-xs font-bold rounded-xl shadow-md transition whitespace-nowrap cursor-pointer hover:scale-105"
                        >
                          ç°½ç½²ä¸¦å„²å­˜è‡³ä¸‹ä?æ­?                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 6. Direct Contract Agreement Section */}
              {openSection === 'contract' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 space-y-6">
                  <div className="flex items-center gap-2 pb-4 border-b border-stone-100">
                    <FileText className="w-5 h-5 text-indigo-600" />
                    <div>
                      <h4 className="text-base font-semibold text-stone-900">6. ç°½ç½²?†å??˜åƒ±?ˆç???/h4>
                      <p className="text-xs text-stone-500">ç·šä??ˆç?ç°½æ ¸ï¼Œè?ç¢ºè??ˆç?æ¢æ¬¾?‡å??…ç?å®šä??…å?ï¼ŒåŸ·è¡Œæ•¸ä½å??¨ç°½ç«?/p>
                    </div>
                  </div>

                  {(() => {
                    const dObj = OnboardEmployee.onboardDate ? new Date(OnboardEmployee.onboardDate) : new Date();
                    const rocYear = isNaN(dObj.getTime()) ? 115 : dObj.getFullYear() - 1911;
                    const rocMonth = isNaN(dObj.getTime()) ? 6 : dObj.getMonth() + 1;
                    const rocDay = isNaN(dObj.getTime()) ? 15 : dObj.getDate();
                    const companyDetails = getCompanyDetails(OnboardEmployee);
                    return (
                      <div className="border border-stone-300 bg-[#FCFBF7] rounded-2xl p-6 md:p-8 space-y-6 max-h-[500px] overflow-y-auto text-stone-800 font-sans text-xs leading-relaxed shadow-inner border-t-4 border-t-amber-805">
                        <div className="space-y-2 text-center pb-2">
                          <h2 className="text-base font-bold text-stone-900 tracking-wider">
                            {companyDetails.name}
                          </h2>
                          <h3 className="text-sm font-bold text-stone-850 tracking-widest border-b border-stone-300 pb-4">
                            ??????ç´???                          </h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium text-stone-900 leading-loose">
                          <div className="flex items-center gap-1.5 md:justify-end">
                            <div>
                             ç«‹å?ç´„äººï¼?span className="text-stone-900 font-bold border-b border-stone-500 px-2">{companyDetails.name}</span>(ä»¥ä?ç°¡ç¨±?²æ–¹)
                            </div>
                          </div>
                          <div className="flex items-start gap-1.5 md:justify-end">
                             ç«‹å?ç´„äººï¼?span className="border-b border-stone-300 font-bold text-indigo-700 px-4 py-0.5 bg-slate-50 rounded"> {personalForm.name || OnboardEmployee.personalData?.name || OnboardEmployee.name || '?ªå¡«å¯?}</span>(ä»¥ä?ç°¡ç¨±ä¹™æ–¹)
                          </div>
                        </div>

                        <p className="mt-4 font-semibold text-stone-900 leading-relaxed bg-[#FAF6F0] p-3 rounded-lg border border-dashed border-[#8D1B1B]/15">
                          ?²å??²æ–¹?±ç”¨ä¹™æ–¹?ºå“¡å·¥ï??™æ–¹?Œæ?è¨‚ç??¬å?ç´„ï??±å??µå?ç´„å?æ¢æ¬¾å¦‚ä?ï¼?                        </p>

                        <ol className="space-y-5 text-stone-800 text-[11px] leading-relaxed">
                          <li>
                            <strong className="text-stone-950 text-xs font-bold block mb-1">ä¸€?å?ç´„æ??“å?è©¦ç”¨?Ÿï?</strong>
                            ?¬å?ç´„è‡ªä¸­è¯æ°‘å? <strong>{rocYear}</strong> å¹?<strong>{rocMonth}</strong> ??<strong>{rocDay}</strong> ?¥èµ·?‚è©¦?¨æ??“ç‚º 
                            <span className="font-bold border-b border-stone-400 px-3 py-0.5 bg-stone-100 rounded text-stone-900 mx-1 inline-block selection:bg-indigo-200">
                              {OnboardEmployee.contractProbationMonths || 'ä¸?}
                            </span>
                            ?‹æ?ï¼Œè©¦?¨æ??“å??¨æ?çµ‚æ­¢å¥‘ç?ï¼Œè©¦?¨æ?æ»¿è€ƒæ ¸ä¸å??¼è€…ï?ä¾å??ºæ?è¦å?è¾¦ç??‚ä??¹æ–¼è©¦ç”¨?Ÿé?å¦‚æ¬²?¢è·ï¼Œæ??¼ä??¥å??å??‚è‹¥?‰å?è¦ï?è©¦ç”¨?Ÿé??¯å?å±•å»¶ä¸€?Ÿã€?                          </li>

                          <li>
                            <strong className="text-stone-950 text-xs font-bold block mb-1">äºŒã€å·¥ä½œé??®ï?</strong>
                            ?”ä»» <strong>{OnboardEmployee.department || 'é¤é£²?å?'}</strong> ä¹?<strong>{OnboardEmployee.title || '?å?å°ˆå“¡'}</strong> å·¥ä???                          </li>

                          <li>
                            <strong className="text-stone-950 text-xs font-bold block mb-1">ä¸‰ã€å·¥ä½œè??‡ï?</strong>
                            ä¹™æ–¹?Œæ??µå??²æ–¹?¶å?ä¹‹å·¥ä½œè??‡å?è¦ç??¶åº¦??                          </li>

                          <li>
                            <strong className="text-stone-950 text-xs font-bold block mb-1">?›ã€å·¥ä½œåœ°é»ï?</strong>
                            ä¹™æ–¹?¥å???<span className="text-stone-950 font-bold border-b border-stone-300 px-2 bg-stone-50">{OnboardEmployee.contractWorkLocation || '?›å??’å? (?°å?) (?°å?å¸‚æ‰¿å¾·è·¯ä¸€æ®???'}</span> ?°æ–¹?”ä»»ç´„å?ä¹‹å·¥ä½œã€?                          </li>

                          <li>
                            <strong className="text-stone-950 text-xs font-bold block mb-1">äº”ã€å·¥ä½œè??›ï?</strong>
                            ?²æ–¹? ç?æ¥­æ?å·¥ä??€è¦ï?å¾—é©?¶æ´¾ä»»ã€å…¼ä»»ã€è?èª¿æ?è¼ªèª¿ä¹™æ–¹?³å…¶ä»–ç­?¥ã€è·?™æ??³å??°å??¯æ?æ§‹ï?ä¹™æ–¹?Œæ??¥å??²æ–¹ä¹‹èª¿?•ã€?                          </li>

                          <li>
                            <strong className="text-stone-950 text-xs font-bold block mb-1">?­ã€å·¥ä½œæ??“ï?</strong>
                            ä¹™æ–¹?Œæ?æ¯æ—¥æ­?¸¸å·¥ä??‚é??ºä??¬å¸è¦å?ä¹‹èµ·è¿„æ??“è¾¦?†ã€?                            å¦‚å?æ¥­å??€?€å¾—æ¡?›é€±è?å½¢å·¥?‚ï??²æ–¹å¾—å??§èª¿?´ä??‡å?å·¥æ?ä¹‹èµ·è¿„ï?ä¸¦å??¼ä??å…¬?Šå‘¨?¥ã€?                            ?²æ–¹? æ¥­?™é?è¦å?å»¶é•·ä¹™æ–¹å»¶é•·å·¥ä??‚é??‚ï??¶å»¶?‚å·¥è³‡ä?çµ¦ä?ï¼Œä??å??ºæ?æ³•ä?è¦å?è¾¦ç?ï¼Œæ??‰ä??²æ–¹è¦å?ä¹‹å??­ç?åºè¾¦?†ï?ä¸¦æ?? ç­?æ??ºç”³è«‹ç??¸å?å§‹å?è¨ˆå…¥? ç­è²»ã€‚å‡º?¤ç??„ä?å¯¦è€…æ?äºˆè¨»?·ã€‚è‹¥ä¹™æ–¹?ºå¦è¡Œç?å®šè–ªè³‡çµ¦ä»˜æ–¹å¼äºº?¡ï??‡ä?å·¥ä??”æ??€æ³ï??ªè?èª¿æ•´å·¥ä??‚é?ï¼Œä??©ç”¨?æ­ä¹‹è?å®šã€?                          </li>

                          <li>
                            <strong className="text-stone-950 text-xs font-bold block mb-1">ä¸ƒã€ä??‡æ?å®šï?</strong>
                            <div className="space-y-2.5 mt-2 bg-stone-50 border border-stone-150 rounded-xl p-3 text-[11px] text-stone-800">
                              {(OnboardEmployee.contractLeaveOption || 'biweekly') === 'monthly' ? (
                                <div className="flex items-start gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#8D1B1B] mt-1.5 flex-shrink-0"></span>
                                  <span>
                                    ä¾é??¹ç?å®šæ–¼ç¬¦å?æ³•ä»¤è¦å?ç¯„å??§ï??±ç”²?¹æ?å®šä??‡æ–¹å¼æ??’ä? <span className="text-stone-950 font-bold border-b border-stone-300 px-2 bg-stone-50 font-mono">{OnboardEmployee.contractLeavedays || '8-10'}</span> ?¥ã€?                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-start gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#8D1B1B] mt-1.5 flex-shrink-0"></span>
                                  <span>?¼ç¬¦?ˆæ?å®šå·¥ä½œæ??¸è?å®šä??æ?ï¼Œæ¡ <strong>?±ä?äºŒæ—¥??/strong>??/span>
                                </div>
                              )}
                              <p className="text-[10px] text-stone-500 border-t border-stone-200/60 pt-2 leading-relaxed">
                                ?²æ–¹? æ¥­?™é?è¦ä??¹é??ˆæ¡?’ç­?’ä??–ç•«å¤œè¼ª?­æ–¹å¼å·¥ä½œï?ä¸”å??ç”²?¹å?å°‡ä??‡æ—¥?å?å®šå??¥è??¶ä?å·¥ä??¥æŒªç§»ï??ªç§»å¾Œä?ä¼‘å??¥ã€å?å®šå??¥å·²?æ­£å¸¸å·¥ä½œæ—¥ï¼Œä??¹æ–¼ä¼‘å??¥å‡º?¤ä??Ÿå??å·¥è³‡ã€?                              </p>
                            </div>
                          </li>

                          <li>
                            <strong className="text-stone-950 text-xs font-bold block mb-1">?«ã€å·¥è³‡è­°å®šï?</strong>
                            æ¬¡æ? 5 ?¥ç‚º?¼è–ª??(å¦‚é?ä¾‹å??¥å??å??³å?ä¸€å·¥ä????‚è–ªè³‡ä?æ¥­æ¡?–ä?å¯†åˆ¶ï¼Œä?å¾—è?è«–æ?æ´©æ?ç¬¬ä??…ã€‚è‹¥ä¹™æ–¹?¢è·?ˆå??é›¢?·äº¤?¥æ?çºŒï??¡æ?å®Œæ??¢è·äº¤æ¥?‹ç?ï¼Œé›¢?·ç•¶?ˆè–ªè³‡æ”¹ä¾å…¬?¸è?å®šä??¥æ??Šæ–¹å¼ç™¼?¾ã€?                            <div className="space-y-2 mt-2 bg-stone-50 border border-stone-150 rounded-xl p-3 text-[11px] text-stone-800">
                              {(OnboardEmployee.contractSalaryType || 'monthly') === 'monthly' && (
                                <div className="flex items-center gap-1.5 font-sans">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#8D1B1B] flex-shrink-0"></span>
                                  <span>
                                    ?™æ–¹è­°å???strong>?ˆè–ª??/strong>ï¼Œæ??ˆè–ªæ´¥ç‚º?°å°å¹?<span className="text-stone-950 font-bold border-b border-stone-300 px-2 bg-stone-50 font-mono text-xs">{OnboardEmployee.contractSalaryAmount || '36,000'}</span> ?ƒã€?                                  </span>
                                </div>
                              )}
                              {(OnboardEmployee.contractSalaryType || 'monthly') === 'daily' && (
                                <div className="flex items-center gap-1.5 font-sans">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#8D1B1B] flex-shrink-0"></span>
                                  <span>
                                    ?™æ–¹è­°å???strong>?¥è–ª??/strong>ï¼Œæ??¥è–ªæ´¥ç‚º?°å°å¹?<span className="text-stone-950 font-bold border-b border-stone-300 px-2 bg-stone-50 font-mono text-xs">{OnboardEmployee.contractSalaryAmount || '1,800'}</span> ?ƒã€?                                  </span>
                                </div>
                              )}
                              {(OnboardEmployee.contractSalaryType || 'monthly') === 'hourly' && (
                                <div className="flex items-center gap-1.5 font-sans">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#8D1B1B] flex-shrink-0"></span>
                                  <span>
                                    ?™æ–¹è­°å???strong>?‚è–ª??/strong>ï¼Œæ?å°æ??ªæ´¥?ºæ–°?°å¹£ <span className="text-stone-950 font-bold border-b border-stone-300 px-2 bg-stone-50 font-mono text-xs">{OnboardEmployee.contractSalaryAmount || '190'}</span> ?ƒã€?                                  </span>
                                </div>
                              )}
                            </div>
                          </li>

                          <li>
                            <strong className="text-stone-950 text-xs font-bold block mb-1">ä¹ã€æ™º?§è²¡?¢æ?ç´„å?ï¼?/strong>
                            <div className="space-y-1.5 mt-1 pl-2">
                              <p>ï¼ˆä?ï¼?ä¹™æ–¹ç¢ºè??¼ä»»?·æ??“æ?ä¾›ä??å??è?è¨Šç??¡ä¾µå®³å?ä»»å…¬?¸æ??¶ä?ç¬¬ä?äººä??ºæ…§è²¡ç”¢æ¬Šã€ç?æ¥­ç?å¯†æ??‰å±¥è¡Œä?ä¿å?ç¾©å?ï¼ˆå??¬ä?ä¸é??¼ç«¶æ¥­ç?æ­¢ï???/p>
                              <p>ï¼ˆä?ï¼?ä¹™æ–¹ä¸¦ä?è­‰æ–¼ä»»è·?Ÿé??€?ä??–å??ä??ºæ…§è²¡ç”¢?æ?ï¼Œå?ä¿‚ç”±ä¹™æ–¹?ªè??µä?ï¼Œä?çµ•ç„¡?„è¥²?–ä»¿?’ä?äººä??—ä?ï¼Œä¸¦ç¢ºå¯¦å°Šé?ä»–äººä¹‹æ™º?§è²¡?¢æ???/p>
                              <p>ï¼ˆä?ï¼??¼ä»»?·æ??“ï??¼è·?™ä??€å®Œæ?ä¹‹è?ä½œï??Œæ?ä»¥ç”²?¹æ??¶ä»£è¡¨äºº?ºè?ä½œäººï¼Œç›¸?œä??—ä?äººæ ¼æ¬Šå??—ä?è²¡ç”¢æ¬Šç?æ­¸ç”²?¹è‡ªå§‹æ??‰ã€?/p>
                            </div>
                          </li>

                          <li>
                            <strong className="text-stone-950 text-xs font-bold block mb-1">?ã€ä?å¯†æ?æ¬¾ï?</strong>
                            ä¹™æ–¹ä¿è?ä»»è·?–å??±ç?ç©¶æ??“ä?ä½¿ç”¨?åˆ©?¨ã€è?è£½ã€ä??™å??ƒè?å·¥ä?ä»»å??€?–å??çŸ¥?‰ä?ä»»ä?ç¶“ç?è³‡è??ç?æ¥­ç?å¯†ã€æ?å¯†æ?ä»¶ï?äº¦ä?ä»¥ä»»ä½•å½¢å¼ï??´æ¥?–é??¥å?ç¬¬ä?äººæ´©?²ã€ç§»è½‰æ?è©•è?ï¼Œæ??ä?ç¬¬ä?äººä½¿?¨ã€‚é›¢?·å?äº¦è??‰ä?è¿°ä?å¯†ç¾©?™ï?ä¸¦å??æ–¼?¢è·?‚ç°½ç½²ã€Œé›¢?·ç”³è«‹å–®?ä¸­ä¹‹ä?å¯†ç›¸?œç?å®šã€‚å??‰é??è‡´?²æ–¹?¼ç??å¤±ï¼Œå??è??”è??Ÿè²¬ä»»ã€?                          </li>

                          <li>
                            <strong className="text-stone-950 text-xs font-bold block mb-1">?ä??å€‹è?ä¿è­·ï¼?/strong>
                            ä¹™æ–¹? è·?™æ??Šä??·å?æ¶‰å??Šè??†ã€è??†ã€åˆ©?¨å€‹äººè³‡æ?ä¹‹è??ºè€…ï?ä¹™æ–¹?”ä??µå¾ª?‘å??Œå€‹äººè³‡æ?ä¿è­·æ³•ã€å?æ­ç??Œè??™ä?è­·ä??¬è???General Data Protection Regulation, GDPR)?ç›¸?œè?å®šï?ä¸¦å??æªå®ˆè·è²¬éµå®ˆç”²?¹é??¼å€‹äººè³‡æ?ä¿è­·?€è¨‚å?ä¹‹ç›¸?œåˆ¶åº¦ã€è¾¦æ³•å??ªæ–½??                          </li>
                        </ol>

                        {/* Sigs area */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-stone-300 font-sans text-[10px] text-stone-600 mt-6 leading-loose">
                          <div className="space-y-1">
                            <strong className="text-stone-900 text-xs font-bold block mb-1.5">?²æ–¹ (ç«‹å?ç´„äºº)</strong>
                            <div>?¬å¸?ç¨±ï¼š{companyDetails.name}</div>
                            <div>çµ±ä?ç·¨è?ï¼š{companyDetails.taxId}</div>
                            <div>è² è²¬äººï?{companyDetails.owner}</div>
                            <div>?¬å¸?°å?ï¼š{companyDetails.address}</div>
                          </div>
                          <div className="space-y-1 bg-indigo-50/20 border border-stone-150 p-3 rounded-xl">
                            <strong className="text-stone-900 text-xs font-bold block mb-1.5">ä¹™æ–¹ (ç«‹å?ç´„äºº)</strong>
                            <div>ä¹™æ–¹å§“å?ï¼?strong className="text-indigo-700 font-bold text-xs">{personalForm.name || OnboardEmployee.personalData?.name || OnboardEmployee.name}</strong></div>
                            <div>èº«å?è­‰è?ï¼?strong className="font-mono tracking-wider">{personalForm.idNumber || OnboardEmployee.personalData?.idNumber || 'å¾…è?å¡«å€‹äºº?ºæœ¬è³‡æ?'}</strong></div>
                            <div>?¾è¨­ä½å?ï¼š{personalForm.contactAddress || OnboardEmployee.personalData?.contactAddress || 'å¾…è?å¡«å€‹äºº?ºæœ¬è³‡æ?'}</div>
                            <div>ç°½ç½²?€?‹ï?{OnboardEmployee.contractSigned ? (
                              <span className="text-emerald-700 font-bold bg-emerald-100/60 px-1.5 py-0.5 rounded">
                                å·²å??ç?ä¸Šæ•¸ä½ç°½ç½?(?Ÿæ?)
                              </span>
                            ) : (
                              <span className="text-indigo-600 font-bold">å¾…æ•¸ä½ç°½ç½?/span>
                            )}</div>
                            {OnboardEmployee.contractSigned && (
                              <div className="text-stone-400 mt-1">
                                ?¸ä??°é?æ­¸æ??‚é?ï¼š{OnboardEmployee.contractDate}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {OnboardEmployee.contractSigned ? (
                    <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 p-5 rounded-2xl text-center text-xs space-y-3 flex flex-col items-center justify-center">
                      <p className="font-bold">?? ?™æ˜¯?Ÿæ??„ç¶²?ç¢ºèªï??¨å·²??<strong>{OnboardEmployee.contractDate}</strong> ?·è??ˆç?ç¢ºè?ç°½ç½²ï¼?/p>
                      <button
                        type="button"
                        onClick={() => setPrintContractOpen(true)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow transition hover:scale-105 active:scale-95 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        ?—å° / ?¯å‡º A4 ?˜åƒ±?ˆç???(PDF)
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 bg-stone-50 p-5 border border-stone-200 rounded-xl text-center">
                      <span className="text-xs text-stone-500">
                        é»æ?ä¸‹æ–¹?²è?ç¢ºè?ï¼Œå?ä»?<strong>{personalForm.name || OnboardEmployee.name}</strong> ?„å?ç¾©å??ˆç??²è??¸ä?èªè?ä¸¦å?æª”ã€?                      </span>
                      <button
                        type="button"
                        onClick={handleContractSign}
                        className="px-6 py-3 bg-indigo-600 text-white hover:bg-indigo-700 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                      >
                        ?‘å??ä¸¦å®Œæ??˜åƒ±?ˆç?ç°½ç½²
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 7. Direct Guarantor Agreement Section */}
              {openSection === 'guarantor' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 space-y-6">
                  <div className="flex items-center gap-2 pb-4 border-b border-stone-100">
                    <Users className="w-5 h-5 text-indigo-600" />
                    <div>
                      <h4 className="text-base font-semibold text-stone-900">7. ç°½ç½²?†å??·å“¡ä¿è???(äººä??¯ä?)</h4>
                      <p className="text-xs text-stone-500">è«‹å¡«å¯«æ‚¨?„é€?¸¶ä¿è?äº??¯ä?äº??ºæœ¬?¯çµ¡è³‡è?ï¼Œä¸¦å®Œæ??¸ä??¹ä?èªè?</p>
                    </div>
                  </div>

                  {(() => {
                    const companyDetails = getCompanyDetails(OnboardEmployee);
                    return (
                      <div className="space-y-6">
                        <div className="border border-stone-300 bg-[#FCFBF7] rounded-2xl p-6 md:p-8 max-h-[420px] overflow-y-auto text-stone-850 font-sans text-xs leading-relaxed shadow-inner border-t-4 border-t-amber-805 space-y-4">
                          <div className="space-y-2 text-center pb-2">
                            <h2 className="text-base font-bold text-stone-900 tracking-wider">
                              {companyDetails.name}
                            </h2>
                            <h3 className="text-sm font-bold text-stone-850 tracking-widest border-b border-stone-300 pb-4">
                              ????ä¿?è­???                            </h3>
                          </div>

                          <p className="font-semibold text-stone-900 leading-relaxed bg-[#FAF6F0] p-3 rounded-lg border border-dashed border-[#8D1B1B]/15 text-justify">
                            ç«‹ä?è­‰æ›¸äººèŒ²ä¿è? <strong>{personalForm.name || OnboardEmployee.name}</strong> ?›ï?ä»¥ä?ç°¡ç¨±è¢«ä?è­‰äººï¼‰åœ¨è²´å…¬?¸ï?<strong>{companyDetails.name}</strong>ï¼‰æ?ä»»è·?™æ??“ï??µå?è²´å…¬?¸æ?è¨‚å?ä¹‹ä??‡è?ç« ã€‚å€˜æ??•è??…ä??–ä¾µä½”å…¬æ¬¾ã€è²¡?©å??¶ä??±å®³?¬å¸è¡Œç‚ºï¼Œè‡´?å®³?¼è²´?¬å¸?‚ï??¤è¢«ä¿è?äººæ??—æ?å¾‹åˆ¶è£å??¬å¸?•å?å¤–ï?ä¿è?äººå??æ”¾æ£„å?è¨´æ?è¾¯æ?ï¼Œå?è¢«ä?è­‰äººä¹‹å‚µ?™è?å®Œå…¨è³ å?è²¬ä»»??                          </p>

                          <div className="space-y-3">
                            <h4 className="font-bold text-stone-950 border-b border-stone-200 pb-1 text-xs">?ä?è­‰è?ç´„æ?è¦ã€?/h4>
                            <p className="text-[11px] text-stone-600 leading-normal pl-2">
                              1. ä¿è?äººé??ºå¹´æ»¿ä??æ­²ä»¥ä??‰æ­£?¶è·æ¥­å??ºå?ä½æ?ä¹‹å€‹äºº??br />
                              2. è¢«ä?è­‰äººä¹‹é??¶è??Œå…¬?¸è·?¡ä?å¾—ä??ºä?è­‰äºº??br />
                              3. ä¿è??Ÿé?å¦‚æ?ä½å?è®Šæ›´?é›¢?·ã€é€€ä¿é?æ±‚ï??‰ç¬¬ä¸€?‚é?ä»¥æ›¸?¢å½¢å¼ç”³?±ã€?                            </p>
                          </div>
                        </div>

                        {/* Guarantor Info Inputs */}
                        {!OnboardEmployee.guarantorSigned && (
                          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 md:p-5 space-y-4">
                            <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 mb-1">
                              <span className="text-xs font-bold text-slate-800">?ï? å¡«å¯«??¸¶ä¿è?äº??¯ä?äº??ºæœ¬?‹è?</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <label className="block text-[11px] font-semibold text-stone-600 mb-1">ä¿è?äººå???<span className="text-rose-500">*</span></label>
                                <input
                                  type="text"
                                  value={guarantorForm.guarantorName}
                                  onChange={e => {
                                    const updated = { ...guarantorForm, guarantorName: e.target.value };
                                    setGuarantorForm(updated);
                                  }}
                                  placeholder="è«‹è¼¸?¥å???
                                  className="w-full text-stone-950 px-2.5 py-1.5 text-xs bg-white border border-stone-200 rounded focus:border-indigo-500 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-stone-600 mb-1">ä¿è?äººå‡º?Ÿå¹´?ˆæ—¥ <span className="text-rose-500">*</span></label>
                                <input
                                  type="text"
                                  value={guarantorForm.birthday}
                                  onChange={e => {
                                    const updated = { ...guarantorForm, birthday: e.target.value };
                                    setGuarantorForm(updated);
                                  }}
                                  placeholder="ä¾‹ï?æ°‘å?70å¹???0??
                                  className="w-full text-stone-950 px-2.5 py-1.5 text-xs bg-white border border-stone-200 rounded focus:border-indigo-500 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-stone-600 mb-1">ä¿è?äººèº«?†è???<span className="text-rose-500">*</span></label>
                                <input
                                  type="text"
                                  value={guarantorForm.idNumber}
                                  onChange={e => {
                                    const updated = { ...guarantorForm, idNumber: e.target.value };
                                    setGuarantorForm(updated);
                                  }}
                                  placeholder="ä¾‹ï?A123456789"
                                  className="w-full text-stone-950 px-2.5 py-1.5 text-xs bg-white border border-stone-200 rounded focus:border-indigo-500 focus:outline-none"
                                />
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-[11px] font-semibold text-stone-600 mb-1">ä¿è?äººç¾ä½åœ°?€ <span className="text-rose-500">*</span></label>
                                <input
                                  type="text"
                                  value={guarantorForm.address}
                                  onChange={e => {
                                    const updated = { ...guarantorForm, address: e.target.value };
                                    setGuarantorForm(updated);
                                  }}
                                  placeholder="è«‹æ ¸å¯¦è¼¸?¥å??´åœ°?€"
                                  className="w-full text-stone-950 px-2.5 py-1.5 text-xs bg-white border border-stone-200 rounded focus:border-indigo-500 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-stone-600 mb-1">ä¿è?äººè¯çµ¡é›»è©?<span className="text-rose-500">*</span></label>
                                <input
                                  type="text"
                                  value={guarantorForm.phone}
                                  onChange={e => {
                                    const updated = { ...guarantorForm, phone: e.target.value };
                                    setGuarantorForm(updated);
                                  }}
                                  placeholder="è«‹è¼¸?¥æ?æ©Ÿæ?ä½å®¶?»è©±"
                                  className="w-full text-stone-950 px-2.5 py-1.5 text-xs bg-white border border-stone-200 rounded focus:border-indigo-500 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-stone-600 mb-1">?‡è¢«ä¿è?äººé?ä¿?<span className="text-rose-500">*</span></label>
                                <input
                                  type="text"
                                  value={guarantorForm.relationship}
                                  onChange={e => {
                                    const updated = { ...guarantorForm, relationship: e.target.value };
                                    setGuarantorForm(updated);
                                  }}
                                  placeholder="å¦‚ï??¶ã€æ??å?å¼Ÿã€æ???.."
                                  className="w-full text-stone-950 px-2.5 py-1.5 text-xs bg-white border border-stone-200 rounded focus:border-indigo-500 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-stone-600 mb-1">?å?æ©Ÿæ??ç¨±</label>
                                <input
                                  type="text"
                                  value={guarantorForm.companyName}
                                  onChange={e => {
                                    const updated = { ...guarantorForm, companyName: e.target.value };
                                    setGuarantorForm(updated);
                                  }}
                                  placeholder="ä¾‹ï??°ç£æ°´æ³¥?¡ä»½?‰é??¬å¸"
                                  className="w-full text-stone-950 px-2.5 py-1.5 text-xs bg-white border border-stone-200 rounded focus:border-indigo-500 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-stone-600 mb-1">æ©Ÿæ??”ä»»?·ä?</label>
                                <input
                                  type="text"
                                  value={guarantorForm.companyTitle}
                                  onChange={e => {
                                    const updated = { ...guarantorForm, companyTitle: e.target.value };
                                    setGuarantorForm(updated);
                                  }}
                                  placeholder="ä¾‹ï?ç¶“ç??èª²??.."
                                  className="w-full text-stone-950 px-2.5 py-1.5 text-xs bg-white border border-stone-200 rounded focus:border-indigo-500 focus:outline-none"
                                />
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-[11px] font-semibold text-stone-600 mb-1">æ©Ÿæ??å??°å?</label>
                                <input
                                  type="text"
                                  value={guarantorForm.companyAddress}
                                  onChange={e => {
                                    const updated = { ...guarantorForm, companyAddress: e.target.value };
                                    setGuarantorForm(updated);
                                  }}
                                  placeholder="è«‹è¼¸?¥ä?è­‰äºº?å??¬å¸?„åœ°?€"
                                  className="w-full text-stone-950 px-2.5 py-1.5 text-xs bg-white border border-stone-200 rounded focus:border-indigo-500 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-stone-600 mb-1">æ©Ÿæ??¯çµ¡?»è©±</label>
                                <input
                                  type="text"
                                  value={guarantorForm.companyPhone}
                                  onChange={e => {
                                    const updated = { ...guarantorForm, companyPhone: e.target.value };
                                    setGuarantorForm(updated);
                                  }}
                                  placeholder="ä¾‹ï?02-21234567"
                                  className="w-full text-stone-950 px-2.5 py-1.5 text-xs bg-white border border-stone-200 rounded focus:border-indigo-500 focus:outline-none"
                                />
                              </div>
                            </div>
                            <div className="flex justify-start text-[10px] text-stone-500 italic">
                              * ä¿è?è¦ç?ï¼šä?è­‰äºº?‰éš¨?Œæœ¬ä¿è??¸äº¤ä»˜èº«ä»½è?ï¼ˆå½±?¬ä?ä»½ï??³äººäº‹å–®ä½æ ¸å°ç?åº•å??·ã€?                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {OnboardEmployee.guarantorSigned ? (
                    <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 p-5 rounded-2xl text-center text-xs space-y-3 flex flex-col items-center justify-center">
                      <p className="font-bold">?? ?™æ˜¯?Ÿæ??„ç¶²?ç¢ºèªï??¨å·²??<strong>{OnboardEmployee.guarantorDate}</strong> ?·è??·å“¡ä¿è??¸ç°½ç½²ï?</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 bg-stone-50 p-5 border border-stone-200 rounded-xl text-center">
                      <span className="text-xs text-stone-500">
                        é»æ?ä¸‹æ–¹?²è?æ­??ç¢ºè?ï¼Œç³»çµ±å?å»ºç?? å??„æ•¸ä½ç°½ç½²å?æª”ï?ä¸¦å?è©²ç°½ç½²ç??ˆè·?¡ä?è­‰æ›¸ä¸¦ç?æª”æ–¼HRè³‡æ?åº«ä¸­??                      </span>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => handleGuarantorSign(false)}
                          className="px-5 py-2.5 bg-stone-200 text-stone-700 hover:bg-stone-300 font-semibold text-xs rounded-xl transition cursor-pointer"
                        >
                          ?«å?ä¿è?äººè?è¨?                        </button>
                        <button
                          type="button"
                          onClick={() => handleGuarantorSign(true)}
                          className="px-6 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                        >
                          ?‘å??ä¸¦å®Œæ??·å“¡ä¿è??¸ç°½ç½?(?å?ä¸‹ä?æ­?
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 8. Direct Service Agreement Section */}
              {openSection === 'service' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 space-y-6">
                  <div className="flex items-center gap-2 pb-4 border-b border-stone-100">
                    <FileText className="w-5 h-5 text-indigo-600" />
                    <div>
                      <h4 className="text-base font-semibold text-stone-900">8. ç°½ç½²?·å·¥?å?ç´„å?</h4>
                      <p className="text-xs text-stone-500">ç·šä??·å·¥?å?ç´„å?ï¼Œæ‰¿è«¾éµå®ˆä»¥å®¢ç‚ºå°Šã€è©¦?¨æ?ç´„å??å€‹è?å®ˆå??Šä?å¯†æ?æ¬¾ç?è¦ç?</p>
                    </div>
                  </div>

                  {(() => {
                    const companyDetails = getCompanyDetails(OnboardEmployee);
                    const dObj = OnboardEmployee.onboardDate ? new Date(OnboardEmployee.onboardDate) : new Date();
                    const rocYear = isNaN(dObj.getTime()) ? 115 : dObj.getFullYear() - 1911;
                    const rocMonth = isNaN(dObj.getTime()) ? 6 : dObj.getMonth() + 1;
                    const rocDay = isNaN(dObj.getTime()) ? 15 : dObj.getDate();
                    return (
                      <div className="border border-stone-300 bg-[#FCFBF7] rounded-2xl p-6 md:p-8 space-y-5 max-h-[500px] overflow-y-auto text-stone-800 font-sans text-xs leading-relaxed shadow-inner border-t-4 border-t-amber-805">
                        <div className="space-y-2 text-center pb-2">
                          <h2 className="text-base font-bold text-stone-900 tracking-wider">
                            {companyDetails.name}
                          </h2>
                          <h3 className="text-sm font-bold text-stone-850 tracking-widest border-b border-stone-300 pb-4">
                            ??å·?????ç´?å®?                          </h3>
                        </div>

                        <div className="space-y-4 text-xs font-serif leading-relaxed text-justify">
                          <p><strong>ç¬¬ä?æ¢ï?</strong>?¬å…¬?¸è·å·¥ä»»?·æ??“é?ä»¥å®¢?ºå?ï¼Œä¸¦?µå??¬å…¬?¸å??…è?ç« ã€?/p>
                          <p><strong>ç¬¬ä?æ¢ï?</strong>?·å·¥?Œæ??ªå¯¦?›å·¥ä½œæ—¥èµ·ä??å¤©?§ç‚ºè©¦ç”¨?Ÿé?ï¼Œåœ¨æ­¤æ??“å?å·¥ä??½å?ä¸è¶³?–æ??™æ?åº¦ä?æ»¿æ??–ç‚º?¬å…¬?¸è?ä¼°ç„¡æ³•å?ä»»æ??‰å¾µä¹‹è·?™ï?å¾—ä??¸é?è¦å??œæ­¢è©¦ç”¨??/p>
                          <p><strong>ç¬¬ä?æ¢ï?</strong>?·å·¥?‰ä??Œå€‹äººè³‡æ?ä¿è­·æ³•ã€ä?å¾—å?é¡§å®¢?–æœ¬?¬å¸?¡å·¥ä¹‹å€‹äººè³‡æ??ä?äºˆç„¡?œä?ç¬¬ä?äººã€?/p>
                          <p><strong>ç¬¬å?æ¢ï?</strong>å°±è·å·¥æ?å¡«å¯«?‹äººè³‡æ?ï¼Œæœ¬?¬å¸?å??¬å¸?Šé?ä¿‚ä?æ¥­ï?ä¸‹ç¨±?¬å…¬?¸ï?å°‡æ–¼?·å·¥?˜åƒ±?Ÿé?ï¼Œæ–¼ä¸­è¯æ°‘å??°å?ï¼Œä??ºäººäº‹ç®¡?†ã€ç?ç¹”èª¿?´ã€å??‡ç??‹æ??œä?ä½¿ç”¨??/p>
                          <p><strong>ç¬¬ä?æ¢ï?</strong>?¬å…¬?¸ä??Œå€‹äººè³‡æ?ä¿è­·æ³•ã€ä??ƒæ?ä¾›ä??¡é?ä¹‹ç¬¬ä¸‰äºº?‚è·å·¥ä??Œå€‹äººè³‡æ?ä¿è­·æ³•ã€ä¸¦?¯å??¬å…¬?¸ç‚º?‹äººè³‡æ??¥è©¢?è?æ±‚é–±è¦½ã€è??…æ??´æ­£?–è?æ±‚äº¤ä»˜è?è£½æœ¬?‚å¦ï¼Œé?äº¦å¯è«‹æ??œæ­¢?é??è??†æ??©ç”¨?Šåˆª?¤ï?ä½†æ–¼?˜åƒ±?œä?å­˜ç??Ÿé?ï¼Œæ??˜åƒ±?œä?çµ‚æ­¢å¾Œï??¬å…¬?¸å??·è??·å? or æ¥­å??€å¿…é??…ï??·å·¥?¡æ?è«‹æ??œæ­¢?é??è??†æ??©ç”¨?Šåˆª?¤ã€?/p>
                          
                          <div className="p-3 bg-stone-50 border border-stone-150 rounded-xl text-stone-900 font-bold mt-2 leading-relaxed">
                            ä»¥ä?å®ˆå?ï¼Œç??¬äººï¼ˆ{personalForm.name || OnboardEmployee.name}ï¼‰é€æ?ä»”ç´°?±è?ä¸¦ç‚º?Œæ??‚æœ¬äººé??éµå®ˆï?å¦‚æ??•å?ï¼Œé?ä¾ç…§?¬å…¬?¸å“¡å·¥æ??Šç¬¬?ä?æ¢è·å·¥ç??²è¾¦æ³•è??†ï?çµ•ç„¡?°è­°??                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 border-t border-stone-200 pt-4 text-[10px] text-stone-500">
                          <div>
                            ç«‹å??æ›¸äººï?<strong className="text-indigo-700 text-xs border-b border-stone-300 px-3 pl-1 inline-block">{personalForm.name || OnboardEmployee.name}</strong>ï¼ˆç°½ç« ï?
                          </div>
                          <div className="text-right font-bold mt-1.5 font-sans whitespace-nowrap">
                            ä¸­è¯æ°‘å? {rocYear} å¹?{rocMonth} ??{rocDay} ??                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {OnboardEmployee.serviceSigned ? (
                    <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 p-5 rounded-2xl text-center text-xs space-y-3 flex flex-col items-center justify-center">
                      <p className="font-bold">?? ?™æ˜¯?Ÿæ??„ç¶²?ç¢ºèªï??¨å·²??<strong>{OnboardEmployee.serviceDate}</strong> ?·å·¥?å?ç´„å?ç°½ç½²ï¼?/p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 bg-stone-50 p-5 border border-stone-200 rounded-xl text-center">
                      <span className="text-xs text-stone-500">
                        é»æ?ä¸‹æ–¹?²è?ç¢ºè?ï¼Œå?ä»?<strong>{personalForm.name || OnboardEmployee.name}</strong> ?„å?ç¾©å??¬æ??™ç?å®šé€²è??¸ä?èªè?ä¸¦å?å­˜æ?æ¡ˆã€?                      </span>
                      <button
                        type="button"
                        onClick={handleServiceSign}
                        className="px-6 py-3 bg-indigo-600 text-white hover:bg-indigo-700 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                      >
                        ?‘å·²è©³ç´°?±è?ä¸¦å??éµå®ˆæœ¬?·å·¥?å?ç´„å?
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Default Welcome if none expanded */}
              {!openSection && (
                <div className="bg-white border border-[#E9E1D6] rounded-2xl p-12 text-center space-y-4">
                  <CheckCircle className="w-12 h-12 text-[#8D1B1B] mx-auto opacity-70 animate-pulse" />
                  <h4 className="text-sm font-semibold text-stone-800">
                    {OnboardEmployee.status === 'completed' ? 'ä»»å??‡å·²å¤§å??Šæ?ï¼? : 'è«‹é¸?‡ä??‹ä»»?™é?å§‹å¡«ç­?}
                  </h4>
                  <p className="text-xs text-stone-500 leading-relaxed max-w-sm mx-auto">
                    å·¦å´æ¸…å–®é¡¯ç¤º?®å??±åˆ°è³‡æ??„å¡«å¯«é€²åº¦ï¼Œæ‚¨?¯ä»¥é»é¸?¶ä¸­ä¸€?…ä»¥ä¿®æ”¹?–æ˜¯å¡«å¯«?¨ç?è³‡æ???                  </p>
                </div>
              )}

            </div>

          </div>
        )}

        {/* Tab 2: Training Booklet Section */}
        {activeTab === 'training' && (
          <div className="bg-white border border-[#EAE4DC] rounded-2xl p-6 md:p-8 space-y-6">
            <div className="flex items-center gap-2 pb-4 border-b border-stone-100">
              <BookOpen className="w-5 h-5 text-[#8D1B1B]" />
              <div>
                <h4 className="text-base font-semibold text-stone-900">?²æ?è§€?‰æ–°?²å?ä»å…¥?·æ??²è?ç·´å?è®€</h4>
                <p className="text-xs text-stone-500">
                  å¹«åŠ©?¨å¿«?Ÿè·¨è¶Šèµ·æ­¥æ?ï¼Œè??¥é›²?—è??‰ç??‡å??Šç’°å¢?                </p>
              </div>
            </div>

            {/* ?™å­¸å°è¦½ Section */}
            <div className="bg-[#FAF8F5] border border-[#E9E1D6] rounded-2xl p-5 md:p-6 space-y-4">
              <div className="flex items-center gap-2 select-none">
                <span className="text-xs font-bold text-[#8D1B1B] px-2.5 py-0.5 bg-[#8D1B1B]/10 rounded-md font-sans">
                  ?™å­¸å°è¦½
                </span>
                <span className="text-xs font-medium text-stone-600">?²æ?è§€?‰åŸ¹è¨“ç³»çµ±è?äººä?è«‹å?ç³»çµ±?ä?èªªæ?</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* å·¦å´ï¼šé›²?—çŸ¥è­˜åº« */}
                <div className="space-y-4 w-full max-w-md">
                  {/* ?²æ??¥è?åº«é€?? */}
                  <div className="w-full">
                    <a 
                      href="https://elearning.ldchotels.com/cltcms/" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="group flex items-center justify-between p-6 w-full border border-[#8D1B1B]/20 hover:border-[#8D1B1B] bg-white hover:bg-[#8D1B1B]/5 rounded-xl transition shadow-sm"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-[#8D1B1B]/10 flex items-center justify-center text-[#8D1B1B] group-hover:scale-105 transition-transform">
                          <BookOpen className="w-5 h-5 animate-pulse" />
                        </div>
                        <div className="text-left">
                          <span className="block text-xs font-bold text-[#8D1B1B]">?²æ??¥è?åº?/span>
                          <span className="block text-[10px] text-stone-400 font-mono">eHRD ç·šä??¹è??Šå­¸ç¿’å¹³?°â?</span>
                        </div>
                      </div>
                      <span className="text-xs text-[#8D1B1B] font-bold group-hover:translate-x-1 transition-transform">??/span>
                    </a>
                  </div>

                  {/* ä¸‹é¢?¾ç½®èªªæ? */}
                  <div className="text-xs text-stone-600 bg-white border border-[#E9E1D6]/60 p-6 rounded-xl w-full space-y-2 font-sans shadow-sm">
                    <div className="flex items-center gap-1.5 font-bold text-stone-800 border-b border-stone-100 pb-1.5 mb-1.5 text-[11px] select-none">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#8D1B1B]"></span>
                      å­¸ç?å¹³å°?»å…¥è³‡è?ï¼?                    </div>
                    <div className="font-mono flex flex-col gap-1.5">
                      <div className="flex items-start gap-1">
                        <span className="w-4 text-[#8D1B1B] font-bold">??/span>
                        <div>
                          <span className="font-sans font-semibold text-stone-500">?»å…¥å¸³è?ï¼?/span>
                          <span className="font-semibold text-stone-800 font-sans">?¡å·¥ç·¨è?</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-1">
                        <span className="w-4 text-[#8D1B1B] font-bold">??/span>
                        <div>
                          <span className="font-sans font-semibold text-stone-500">å¯†ç¢¼ï¼?/span>
                          <span className="font-semibold text-stone-800 font-sans">?¨ç?èº«å?è­‰å????å?å¯†ç¢¼)</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-stone-400 font-sans italic pt-1 border-t border-stone-50 select-none">
                      * ?å??»å…¥?¬ç³»çµ±å?å»ºè­°ç«‹å³?´æ”¹å¯†ç¢¼ï¼Œä»¥ç¢ºä??¨ç??‹è?å®‰å…¨??                    </p>
                  </div>
                </div>

                {/* ?³å´ï¼šå¾·å®‰Flowç³»çµ± */}
                <div className="space-y-4 w-full max-w-md">
                  {/* å¾·å?Flowç³»çµ±??? */}
                  <div className="w-full">
                    <a 
                      href="https://hrms.ldchotels.com/pms/node/api/callback/eip/305" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="group flex items-center justify-between p-6 w-full border border-[#8D1B1B]/20 hover:border-[#8D1B1B] bg-white hover:bg-[#8D1B1B]/5 rounded-xl transition shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[#8D1B1B]/10 flex items-center justify-center text-[#8D1B1B] group-hover:scale-105 transition-transform">
                          <Layers className="w-5 h-5 animate-pulse" />
                        </div>
                        <div className="text-left">
                          <span className="block text-xs font-bold text-[#8D1B1B]">å¾·å?Flowç³»çµ±</span>
                          <span className="block text-[10px] text-stone-400 font-mono">äººä?è«‹å??Šå‡ºç¼ºå‹¤ç´€?„æŸ¥è©¢å¹³?°â?</span>
                        </div>
                      </div>
                      <span className="text-xs text-[#8D1B1B] font-bold group-hover:translate-x-1 transition-transform">??/span>
                    </a>
                  </div>

                  {/* ä¸‹é¢?¾ç½®èªªæ? */}
                  <div className="text-xs text-stone-600 bg-white border border-[#E9E1D6]/60 p-6 rounded-xl w-full space-y-2 font-sans shadow-sm">
                    <div className="flex items-center gap-1.5 font-bold text-stone-800 border-b border-stone-100 pb-1.5 mb-1.5 text-[11px] select-none">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#8D1B1B]"></span>
                      å¾·å?Flow?»å…¥è³‡è?ï¼?                    </div>
                    <div className="font-mono flex flex-col gap-1.5">
                      <div className="flex items-start gap-1">
                        <span className="w-4 text-[#8D1B1B] font-bold">??/span>
                        <div>
                          <span className="font-sans font-semibold text-stone-500">?»å…¥å¸³è?ï¼?/span>
                          <span className="font-semibold text-stone-800 font-sans">?¡å·¥ç·¨è?</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-1">
                        <span className="w-4 text-[#8D1B1B] font-bold">??/span>
                        <div>
                          <span className="font-sans font-semibold text-stone-500">å¯†ç¢¼ï¼?/span>
                          <span className="font-semibold text-stone-800 font-sans">mis(?å?å¯†ç¢¼)</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-stone-400 font-sans italic pt-1 border-t border-stone-50 select-none">
                      * ?å?å¯†ç¢¼?±ç³»çµ±è‡ª?•é?ç½®ï??»å…¥å¾Œå»ºè­°ç??³é€²è?å®‰å…¨?§ä¿®?¹ã€?                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <a 
                href="https://drive.google.com/file/d/16cddV6W-77rVwhuU7iiQ9wnfAJa7re4j/view?usp=sharing"
                target="_blank"
                rel="noopener noreferrer"
                className="group block border border-stone-200/60 p-5 rounded-2xl space-y-2.5 bg-white hover:border-[#8D1B1B]/40 hover:bg-[#8D1B1B]/5 transition-all shadow-sm"
              >
                <div className="flex items-center justify-between">
                   <span className="text-[10px] uppercase font-bold text-[#8D1B1B] tracking-widest block">èª²ç?ä¸€</span>
                   <span className="text-[10px] font-bold text-[#8D1B1B] bg-[#8D1B1B]/10 px-2 py-0.5 rounded-full flex items-center gap-1 group-hover:scale-105 transition-transform">
                     <FileText className="w-3 h-3" />
                     ?‹å??™å­¸ ??                   </span>
                </div>
                <strong className="text-sm block text-stone-900 font-bold group-hover:text-[#8D1B1B] transition-colors">
                  ?²æ?è§€?‰åŸ¹è¨“ç³»çµ±æ?å­¸æ­¥é©?                </strong>
                <p className="text-xs text-stone-500 leading-relaxed group-hover:text-stone-600 transition-colors">
                  ?‹æ??‹æ?å­¸ï?è®“æ–°?²å“¡å·¥ä½¿?¨ç³»çµ±ä?å­¤å–®ï¼Œä??¡é?å®³æ€•é??Ÿç’°å¢ƒè??Œä?ä¸æ•¢?å??„ç?å¢ƒï??‹å??™å­¸ä¸€æ¬¡å°±ä¸Šæ?ï¼Œæ›´?½å¿«?Ÿç­è§???˜ç?ç¹”è??‡å???                </p>
              </a>

              <a 
                href="https://drive.google.com/file/d/19IH9CBkOyIL4eyA_lvhsfsA0jK7X3l_f/view?usp=sharing"
                target="_blank"
                rel="noopener noreferrer"
                className="group block border border-stone-200/60 p-5 rounded-2xl space-y-2.5 bg-white hover:border-[#8D1B1B]/40 hover:bg-[#8D1B1B]/5 transition-all shadow-sm"
              >
                <div className="flex items-center justify-between">
                   <span className="text-[10px] uppercase font-bold text-[#8D1B1B] tracking-widest block">èª²ç?äº?/span>
                   <span className="text-[10px] font-bold text-[#8D1B1B] bg-[#8D1B1B]/10 px-2 py-0.5 rounded-full flex items-center gap-1 group-hover:scale-105 transition-transform">
                     <FileText className="w-3 h-3" />
                     ?‹å??™å­¸ ??                   </span>
                </div>
                <strong className="text-sm block text-stone-900 font-bold group-hover:text-[#8D1B1B] transition-colors">
                  å¾·å?Flowç³»çµ±?™å­¸æ­¥é?
                </strong>
                <p className="text-xs text-stone-500 leading-relaxed group-hover:text-stone-600 transition-colors">
                  ?‹æ??‹æ?å­¸ï?è®“æ–°?²å“¡å·¥å¯ä»¥ç­è§??ä½•æŸ¥è©¢è‡ªèº«å‡ºç¼ºå‹¤?€æ³ä»¥?Šå?ä½•ç¨ç«‹å??ç?ä¸Šè??‡ï?è®“æ¶?®ä??å¡?œï?ä¹Ÿç„¡?ˆè??¥äºº?¥é?ä½ è?äº†ä?éº¼å?ï¼Œå?è§?°·å°¬æ??ã€?                </p>
              </a>
            </div>
            
            {/* LINE OnboardEmployee Official Account Block */}
            <div className="bg-[#FAF8F5] p-5 md:p-6 rounded-2xl border border-emerald-500/10 flex flex-col md:flex-row items-center gap-5">
              <div className="flex-shrink-0 bg-white p-2 rounded-xl border border-stone-150 shadow-xs flex flex-col items-center gap-1.5 select-none">
                <img 
                  src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://line.me/R/ti/p/%40112hpdie" 
                  alt="Line Official Account QR Code" 
                  className="w-28 h-28 object-contain rounded-lg"
                />
                <a 
                  href="https://line.me/R/ti/p/%40112hpdie" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[10px] text-emerald-600 font-semibold hover:underline flex items-center gap-0.5"
                >
                  é»æ?? å¥½????                </a>
              </div>
              <div className="space-y-2 text-center md:text-left flex-1">
                <div className="flex flex-col md:flex-row md:items-center gap-2">
                  <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md w-fit mx-auto md:mx-0">
                    LINE å®˜æ–¹å¸³è?
                  </span>
                  <span className="text-[#8D1B1B] text-[12px] font-bold">
                    å¸³è?IDï¼š@112hpdie
                  </span>
                </div>
                <h4 className="text-sm font-bold text-stone-900">
                  ?²å?ä½ ç??å¤© <span className="text-stone-400 font-normal text-xs">(?§éƒ¨?¡å·¥å®˜æ–¹å¸³è?)</span>
                </h4>
                <div className="text-[11px] text-stone-600 leading-relaxed space-y-1.5">
                  <p className="font-semibold text-emerald-800">
                    ?’¡ ?Ÿç”¨?‡èº«?†é?è­‰èªª?ï?
                  </p>
                  <p>
                    ? å…¥?¡å·¥å®˜æ–¹å¸³è?å¾Œï?<strong>è«‹å?å¿…å??¼é€æ‚¨?„ã€Œéƒ¨?€?ã€ã€Œå“¡å·¥ç·¨?Ÿã€å??Œä¸­?‡å??ã€?/strong>?‚ç®¡?†å“¡?¶åˆ°å¾Œå??ƒè??¥è?å¯©æ ¸?¨ç?èº«å?ï¼Œæ ¸?†å??³å¯æ­???Ÿç”¨?‡ä½¿?¨æ­¤å®˜æ–¹å¸³è???                  </p>
                  <p className="text-stone-500 text-[10px]">
                    ??æ­¤å¸³?Ÿå…§å®¹å??ä?ï¼?strong>?¡å·¥?¸é?ç¦åˆ©?ç›¸?œæ´»?•è?è¨Šã€å¸¸?¨å“¡å·¥ç³»çµ±æ·å¾?/strong>...ç­‰ç??°é€²å?ä»å?å±¬å…§å®¹ã€?                  </p>
                </div>
              </div>
            </div>

            <div className="bg-amber-50/30 p-5 rounded-xl border border-amber-100 flex items-start gap-3">
              <Clock className="w-5 h-5 text-[#8D1B1B] flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-xs text-[#8D1B1B] block">?é?ï¼?/strong>
                <p className="text-[11px] text-stone-600 mt-1">
                  å¾Œç??„ç?ä¸Šæ¸¬é©—å??°äººè¨“ç·´ï¼Œäººè³‡è?å°‡æ??¨æ‚¨å®Œæ??±åˆ°å¾Œï??¦è??šçŸ¥??                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: AI chatbot panel */}
        {activeTab === 'ai' && (
          <div className="bg-white border border-[#EAE4DC] flex flex-col rounded-2xl h-[560px] overflow-hidden shadow-sm">
            
            {/* Header info */}
            <div className="bg-stone-50 px-6 py-4 border-b border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#8D1B1B] flex items-center justify-center text-[#D4AF37]">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-stone-900">?²æ?è§€??AI ç§˜æ›¸</h4>
                  <p className="text-[10px] text-stone-500">24H?Šæ??ºæ‚¨è§???¹ä?ç¦åˆ©?å·¥ä½œæ??“å??ˆç??§å®¹ç­‰ç›¸?œå?é¡?/p>
                </div>
              </div>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded">
                ???¨æ??¨ç?
              </span>
            </div>

            {/* Messages box */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4 max-h-[380px]">
              {messages.map((m, idx) => (
                <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl p-4 text-xs leading-relaxed space-y-1 shadow-sm ${
                    m.role === 'user' 
                      ? 'bg-[#8D1B1B] text-white rounded-br-none' 
                      : 'bg-stone-50 text-stone-850 border border-stone-100 rounded-bl-none'
                  }`}>
                    {/* Preserve linebreaks and support Markdown lists roughly */}
                    <div className="whitespace-pre-wrap">{m.content}</div>
                    <span className={`block text-[9px] text-right mt-1.5 ${m.role === 'user' ? 'text-stone-300' : 'text-stone-400'}`}>
                      {m.timestamp}
                    </span>
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div className="flex justify-start">
                  <div className="bg-stone-50 border border-stone-100 rounded-2xl rounded-bl-none p-4 text-xs flex items-center gap-2.5">
                    <span className="inline-block w-2.5 h-2.5 bg-stone-300 rounded-full animate-bounce"></span>
                    <span className="inline-block w-2.5 h-2.5 bg-stone-300 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="inline-block w-2.5 h-2.5 bg-stone-300 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    <span className="text-stone-500">ç§˜æ›¸æ­?œ¨?ºæ‚¨?¥æ ¸?¬å¸è¦ç?...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef}></div>
            </div>

            {/* Quick recommendation prompts */}
            <div className="px-5 pb-3 pt-2 border-t border-stone-50 flex flex-wrap gap-1.5 select-none bg-stone-50/20">
              <button 
                onClick={() => sendAIMessage('?¹åˆ¥ä¼‘å??‡ç??¥å?è¦å??ºä?ï¼?)}
                className="text-[10px] text-stone-600 bg-white border border-stone-200 px-2.5 py-1 rounded-full hover:border-[#8D1B1B] hover:text-[#8D1B1B] transition-colors cursor-pointer"
              >
                ??ï¸??Ÿæ—¥?‡è??¹å?è¦å?ï¼?              </button>
              <button 
                onClick={() => sendAIMessage('ä¸æ?ä¾›èº«?†åŸº?¬è??™æ??‹è??ƒæ?ä»€éº¼å½±?¿å?ï¼?)}
                className="text-[10px] text-stone-600 bg-white border border-stone-200 px-2.5 py-1 rounded-full hover:border-[#8D1B1B] hover:text-[#8D1B1B] transition-colors cursor-pointer"
              >
                ?? ?œæ–¼?‹è??„é¡§?®ï?
              </button>
              <button 
                onClick={() => sendAIMessage('å®Œæ??‘ç›®?ç? 8 ?‹å…¥?·å ±?°ä»»?™æ­¥é©Ÿå??ƒæ€æ¨£ï¼?)}
                className="text-[10px] text-stone-600 bg-white border border-stone-200 px-2.5 py-1 rounded-full hover:border-[#8D1B1B] hover:text-[#8D1B1B] transition-colors cursor-pointer"
              >
                ?? å¦‚ä?å®Œæ??¥è·æµç?ï¼?              </button>
            </div>

            {/* Input form */}
            <div className="p-4 border-t border-stone-100 flex items-center gap-2">
              <input
                type="text"
                placeholder="?¨æ­¤è¼¸å…¥?¨å??¼å…¥?·ã€ç??©ã€å?ç´„ç??„å?é¡?.."
                value={inputMessage}
                onChange={e => setInputMessage(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') sendAIMessage();
                }}
                className="flex-grow text-stone-900 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-[#8D1B1B] focus:bg-white transition-colors"
                disabled={aiLoading}
              />
              <button
                onClick={() => sendAIMessage()}
                className="p-3 bg-[#8D1B1B] text-[#D4AF37] rounded-xl hover:bg-[#721515] transition-colors active:scale-95 flex items-center justify-center cursor-pointer"
                disabled={aiLoading || !inputMessage.trim()}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

          </div>
        )}

      </main>

      {/* A4 Print Modals */}
      {printTaxOpen && (
        <TaxDeclarationPrintModal
          OnboardEmployee={OnboardEmployee}
          onClose={() => setPrintTaxOpen(false)}
        />
      )}
      {printContractOpen && (
        <ContractPrintModal
          OnboardEmployee={OnboardEmployee}
          onClose={() => setPrintContractOpen(false)}
        />
      )}
      {printGuarantorOpen && (
        <GuarantorPrintModal
          OnboardEmployee={OnboardEmployee}
          onClose={() => setPrintGuarantorOpen(false)}
        />
      )}
      {printServiceOpen && (
        <ServicePrintModal
          OnboardEmployee={OnboardEmployee}
          onClose={() => setPrintServiceOpen(false)}
        />
      )}
    </div>
  );
}
