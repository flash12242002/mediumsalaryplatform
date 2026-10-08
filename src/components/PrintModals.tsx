import React from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, FileText, CheckCircle2 } from 'lucide-react';
import { Employee, TaxDependent, PersonalData, TaxDeclaration } from '../types';
import { getCompanyDetails } from './EmployeeDashboard';

interface PrintModalProps {
  employee: Employee;
  onClose: () => void;
}

// Small helper to parse date to ROC date
function formatToRocDate(dateStr?: string) {
  if (!dateStr) return '  年  月  日';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    // Try to parse YYYY/MM/DD or similar raw-ly
    const parts = dateStr.split(/[-/]/);
    if (parts.length >= 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      return ` ${y > 1911 ? y - 1911 : y} 年 ${m} 月 ${day} 日`;
    }
    return dateStr;
  }
  const year = d.getFullYear() - 1911;
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return ` ${year} 年 ${month} 月 ${day} 日`;
}

export function TaxDeclarationPrintModal({ employee, onClose }: PrintModalProps) {
  const companyDetails = getCompanyDetails(employee);
  const p = (employee.personalData || {}) as PersonalData;
  const tax = (employee.taxDeclaration || { spouseName: '', spouseBirthday: '', spouseIdNumber: '', dependents: [], signed: false }) as TaxDeclaration;
  const dependentsList: TaxDependent[] = tax.dependents || [];
  
  const dObj = employee.onboardDate ? new Date(employee.onboardDate) : (employee.updatedAt ? new Date(employee.updatedAt) : new Date());
  const rocYear = isNaN(dObj.getTime()) ? 115 : dObj.getFullYear() - 1911;
  const rocMonth = isNaN(dObj.getTime()) ? 6 : dObj.getMonth() + 1;
  const rocDay = isNaN(dObj.getTime()) ? 15 : dObj.getDate();
  
  // Distribute dependents into types
  const ancestors = dependentsList.filter(d => 
    d.type === '直系尊親屬' || d.relationship === '父' || d.relationship === '母' || d.relationship === '父親' || d.relationship === '母親'
  );
  
  const children = dependentsList.filter(d => 
    d.type === '子女' || d.relationship === '子' || d.relationship === '女' || d.relationship === '長子' || d.relationship === '長女' || d.relationship === '次子' || d.relationship === '次女'
  );
  
  const siblings = dependentsList.filter(d => 
    d.type === '同胞兄弟姊妹' || d.relationship === '兄' || d.relationship === '弟' || d.relationship === '姐' || d.relationship === '妹' || d.relationship === '姊'
  );
  
  const others = dependentsList.filter(d => 
    !ancestors.includes(d) && !children.includes(d) && !siblings.includes(d)
  );

  // Helper to pad array to exactly 4 rows for grid structure matching
  const padArray = (arr: any[], count: number) => {
    const newArr = [...arr];
    while (newArr.length < count) {
      newArr.push({ name: '', relationship: '', birthday: '', idNumber: '', condition: '' });
    }
    return newArr.slice(0, count);
  };

  const paddedAncestors = padArray(ancestors, 4);
  const paddedChildren = padArray(children, 4);
  const paddedSiblings = padArray(siblings, 4);
  const paddedOthers = padArray(others, 4);

  // Parse tax id into 8 distinct digits
  const taxIdDigits = (companyDetails.taxId || '').padEnd(8, ' ').split('').slice(0, 8);

  const handlePrint = () => {
    window.print();
  };

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm p-4 md:p-8 flex items-start justify-center print-modal-overlay">
      <div className="bg-stone-50 max-w-4xl w-full rounded-2xl shadow-2xl border border-stone-200 overflow-hidden my-4 text-left print-modal-card">
        
        {/* Header - strictly non-printing */}
        <div className="bg-stone-900 text-[#D4AF37] px-6 py-4 flex items-center justify-between sticky top-0 z-10 border-b border-[#D4AF37]/30 no-print-el">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-stone-850 flex items-center justify-center border border-[#D4AF37]/20">
              <Printer className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">🖨️ 薪資受領人免稅額申報表 列印預覽</h3>
              <p className="text-[10px] text-stone-400">系統已自動將您線上申報之受扶養親屬轉化為 A4 標準雙頁表格，可直接列印或儲存為 PDF</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-5 py-1.5 bg-[#8D1B1B] hover:bg-[#A32222] text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              列印 ╱ 另存為 PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-stone-850 rounded-lg text-stone-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Info Notification - strictly non-printing */}
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 text-xs text-amber-800 flex items-center gap-2 no-print-el">
          <span className="shrink-0 bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded text-[10px] font-bold">說明</span>
          <p>請點擊右上方<strong>「列印 ╱ 另存為 PDF」</strong>按鈕。在列印對話框中將目標列印機選擇為<strong>「另存為 PDF / Save as PDF」</strong>，並務必開啟<strong>「背景圖形/Background graphics」</strong>以確保表格邊框與背景美觀呈現。</p>
        </div>

        {/* Paper Container - styled to resemble dual-A4 sheets */}
        <div className="p-8 bg-neutral-200/40 flex flex-col gap-10 items-center justify-center overflow-auto print-paper-container">
          <div id="tax-declaration-print-area" className="flex flex-col gap-10 bg-transparent items-center justify-center">
            
            {/* PAGE 1 */}
          <div className="bg-white print-page-a4 shadow-lg w-[794px] h-[1123px] p-[40px] flex flex-col justify-between text-stone-900 border border-stone-300 relative">
            
            {/* Header section */}
            <div>
              <div className="flex justify-between items-start mb-6">
                <div className="w-[60%] pt-6">
                  <h1 className="text-2xl font-bold tracking-[8px] text-stone-950 font-serif leading-relaxed text-center">
                    年薪資受領人免稅額申報表
                  </h1>
                  <p className="text-[10px] text-stone-600 tracking-wide text-center mt-1">（本表供申報受扶養親屬免稅額之用）</p>
                </div>

                {/* Top-right 扣繳單位 box */}
                <div className="w-[38%] border border-stone-800 text-[10px]">
                  <table className="w-full border-collapse">
                    <tbody>
                      <tr className="border-b border-stone-800 h-7">
                        <td className="w-20 bg-stone-50 border-r border-stone-800 text-center font-bold font-serif">統一編號</td>
                        <td className="px-1.5 flex items-center justify-center h-full gap-0.5 pt-1">
                          {taxIdDigits.map((digit, i) => (
                            <span key={i} className="w-4 h-4 border border-stone-400 flex items-center justify-center text-[10px] font-bold font-mono">
                              {digit}
                            </span>
                          ))}
                        </td>
                      </tr>
                      <tr className="border-b border-stone-800 h-8">
                        <td rowSpan={2} className="bg-stone-50 border-r border-stone-800 text-center font-bold font-serif leading-tight">扣繳<br />單位</td>
                        <td className="border-b border-stone-800 px-1.5 py-0.5 leading-tight font-serif whitespace-nowrap text-[9px]">
                          名稱：<strong className="text-stone-950 text-[10px]">{companyDetails.name}</strong>
                        </td>
                      </tr>
                      <tr className="border-b border-stone-800 h-8">
                        <td className="px-1.5 py-0.5 leading-tight font-serif text-[9px]">
                          地址：<span className="text-stone-850 text-[9px]">{companyDetails.address}</span>
                        </td>
                      </tr>
                      <tr className="h-7">
                        <td className="bg-stone-50 border-r border-stone-800 text-center font-bold font-serif">扣繳義務人</td>
                        <td className="px-1.5 font-bold text-stone-950 text-[10px]">{companyDetails.owner}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Main table grid Part 1 */}
              <table className="w-full border-collapse border border-stone-800 text-[11px] mb-4">
                <tbody>
                  <tr className="h-10 border-b border-stone-800">
                    <td rowSpan={2} className="w-[12%] border-r border-stone-800 bg-stone-50 text-center font-bold font-serif leading-relaxed">
                      薪資受<br />領人
                    </td>
                    <td className="w-[10%] bg-stone-50 border-r border-stone-800 text-center font-bold">姓名</td>
                    <td className="w-[20%] border-r border-stone-800 px-2 font-bold text-stone-950 font-serif">
                      {p.name || employee.name}
                    </td>
                    <td className="w-[12%] bg-stone-50 border-r border-stone-800 text-center font-bold">出生年月日</td>
                    <td className="w-[18%] border-r border-stone-800 px-2 font-mono">
                      {p.birthday || '未填寫'}
                    </td>
                    <td className="w-[12%] bg-stone-50 border-r border-stone-800 text-center font-bold leading-tight">國民身分證<br />統一編號</td>
                    <td className="w-[16%] px-2 font-mono font-bold tracking-wider uppercase text-stone-950">
                      {p.idNumber || '未填寫'}
                    </td>
                  </tr>
                  <tr className="h-10 border-b border-stone-800">
                    <td className="bg-stone-50 border-r border-stone-800 text-center font-bold">配偶</td>
                    <td className="border-r border-stone-800 px-2 font-bold text-stone-950">
                      {tax.spouseName || '無'}
                    </td>
                    <td className="bg-stone-50 border-r border-stone-800 text-center font-bold">出生年月日</td>
                    <td className="border-r border-stone-800 px-2 font-mono">
                      {tax.spouseBirthday || (tax.spouseName ? '待補填' : '')}
                    </td>
                    <td className="bg-stone-50 border-r border-stone-800 text-center font-bold leading-tight">國民身分證<br />統一編號</td>
                    <td className="px-2 font-mono uppercase">
                      {tax.spouseIdNumber || (tax.spouseName ? '待補填' : '')}
                    </td>
                  </tr>
                  <tr className="h-10">
                    <td className="bg-stone-50 border-r border-stone-800 text-center font-bold font-serif">住址</td>
                    <td colSpan={6} className="px-2 leading-relaxed font-serif">
                      {p.contactAddress || p.legalAddress || '未填寫'}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Subtitle declaration */}
              <p className="text-[11px] font-serif font-semibold text-stone-950 leading-relaxed mb-3">
                合於減除扶養親屬免稅額之受扶養親屬 (共計 <strong className="border-b border-stone-800 px-4 font-mono">{dependentsList.length}</strong> 人)。【下列表格不敷使用時，依式另加表格。】
              </p>

              {/* SECTION 1: ANCESTORS */}
              <div className="space-y-1 mb-6">
                <span className="text-[11px] font-bold text-stone-950 font-serif block">
                  一、依所得稅法第17條第1項第1款規定，納稅義務人及其配偶之直系尊親屬，合於下列條件之一者，每年每人得減除其扶養親屬免稅額。
                </span>
                <span className="text-[10px] text-stone-600 block pl-4">
                  (1)年滿60歲； ｜ (2)未滿60歲，但無謀生能力受納稅義務人扶養。
                </span>
                <span className="text-[10px] text-stone-800 block pl-4 font-semibold">
                  本人及配偶之直系尊親屬合於上列規定條件者，計有: <strong className="border-b border-stone-800 px-3 font-mono">{ancestors.length}</strong> 人
                </span>
                
                <table className="w-full border-collapse border border-stone-800 text-[10px]">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-800 h-7 font-bold text-center">
                      <td className="border-r border-stone-800 w-[18%]">姓名</td>
                      <td className="border-r border-stone-800 w-[12%]">稱謂</td>
                      <td className="border-r border-stone-800 w-[20%]">出生年月日</td>
                      <td className="border-r border-stone-800 w-[30%]">國民身分證統一編號或統一證號</td>
                      <td className="w-[20%]">符合之條件</td>
                    </tr>
                  </thead>
                  <tbody>
                    {paddedAncestors.map((dep, i) => (
                      <tr key={`ancestor-${i}`} className="border-b border-stone-800 h-8 text-center text-[11px]">
                        <td className="border-r border-stone-800 font-bold px-1">{dep.name}</td>
                        <td className="border-r border-stone-800 px-1">{dep.relationship}</td>
                        <td className="border-r border-stone-800 font-mono px-1">{dep.birthday}</td>
                        <td className="border-r border-stone-800 font-mono px-1 uppercase tracking-wider">{dep.idNumber}</td>
                        <td className="px-1 text-[10px] font-sans font-medium text-stone-700">
                          {dep.name && (dep.condition || '扶養滿60歲')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* SECTION 2: CHILDREN */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-stone-950 font-serif block">
                  二、依所得稅法第17條第1項第1款規定，納稅義務人之子女，合於下列條件之一者，每年每人得減除其扶養親屬免稅額。
                </span>
                <span className="text-[10px] text-stone-600 block pl-4 leading-tight">
                  (1)未成年； ｜ (2)已成年，因在校就學受納稅義務人扶養； ｜ (3)已成年，因身心障礙受納稅義務人扶養； ｜ (4)已成年，因無謀生能力受納稅義務人扶養。
                </span>
                <span className="text-[10px] text-stone-800 block pl-4 font-semibold">
                  本人之子女合於上列規定條件者，計有: <strong className="border-b border-stone-800 px-3 font-mono">{children.length}</strong> 人
                </span>
                
                <table className="w-full border-collapse border border-stone-800 text-[10px]">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-800 h-7 font-bold text-center">
                      <td className="border-r border-stone-800 w-[18%]">姓名</td>
                      <td className="border-r border-stone-800 w-[12%]">稱謂</td>
                      <td className="border-r border-stone-800 w-[20%]">出生年月日</td>
                      <td className="border-r border-stone-800 w-[30%]">國民身分證統一編號或統一證號</td>
                      <td className="w-[20%]">符合之條件</td>
                    </tr>
                  </thead>
                  <tbody>
                    {paddedChildren.map((dep, i) => (
                      <tr key={`children-${i}`} className="border-b border-stone-800 h-8 text-center text-[11px]">
                        <td className="border-r border-stone-800 font-bold px-1">{dep.name}</td>
                        <td className="border-r border-stone-800 px-1">{dep.relationship}</td>
                        <td className="border-r border-stone-800 font-mono px-1">{dep.birthday}</td>
                        <td className="border-r border-stone-800 font-mono px-1 uppercase tracking-wider">{dep.idNumber}</td>
                        <td className="px-1 text-[10px] font-sans font-medium text-stone-700">
                          {dep.name && (dep.condition || '未成年/在學')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
            </div>

            {/* Page Footer */}
            <div className="flex justify-between items-center text-[9px] text-stone-400 border-t border-stone-200 pt-3">
              <span>雲朗觀光集團 HR 人事報到系統</span>
              <span>第一頁 (共二頁)</span>
            </div>
          </div>

          {/* PAGE 2 */}
          <div className="bg-white print-page-a4 shadow-lg w-[794px] h-[1123px] p-[40px] flex flex-col justify-between text-stone-900 border border-stone-300 relative">
            
            <div>
              <div className="text-center pb-4 mb-4 border-b border-stone-200">
                <span className="text-xs tracking-[4px] font-bold text-stone-500 font-serif">年薪資受領人免稅額申報表</span>
              </div>

              {/* SECTION 3: SIBLINGS */}
              <div className="space-y-1 mb-6">
                <span className="text-[11px] font-bold text-stone-950 font-serif block">
                  三、依所得稅法第17條第1項第1款規定，納稅義務人及其配偶之同胞兄弟姊妹，合於下列條件之一者，每年每人得減除其扶養親屬免稅額。
                </span>
                <span className="text-[10px] text-stone-600 block pl-4">
                  (1)未成年； ｜ (2)已成年，因在校就學受納稅義務人扶養； ｜ (3)已成年，因身心障礙及無謀生能力。
                </span>
                <span className="text-[10px] text-stone-800 block pl-4 font-semibold">
                  本人及配偶之同胞兄弟姊妹合於上列規定條件者，計有: <strong className="border-b border-stone-800 px-3 font-mono">{siblings.length}</strong> 人
                </span>
                
                <table className="w-full border-collapse border border-stone-800 text-[10px]">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-800 h-7 font-bold text-center">
                      <td className="border-r border-stone-800 w-[18%]">姓名</td>
                      <td className="border-r border-stone-800 w-[12%]">稱謂</td>
                      <td className="border-r border-stone-800 w-[20%]">出生年月日</td>
                      <td className="border-r border-stone-800 w-[30%]">國民身分證統一編號或統一證號</td>
                      <td className="w-[20%]">符合之條件</td>
                    </tr>
                  </thead>
                  <tbody>
                    {paddedSiblings.map((dep, i) => (
                      <tr key={`sibling-${i}`} className="border-b border-stone-800 h-8 text-center text-[11px]">
                        <td className="border-r border-stone-800 font-bold px-1">{dep.name}</td>
                        <td className="border-r border-stone-800 px-1">{dep.relationship}</td>
                        <td className="border-r border-stone-800 font-mono px-1">{dep.birthday}</td>
                        <td className="border-r border-stone-800 font-mono px-1 uppercase tracking-wider">{dep.idNumber}</td>
                        <td className="px-1 text-[10px] font-sans font-medium text-stone-700">
                          {dep.name && (dep.condition || '未成年/在學')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* SECTION 4: OTHERS */}
              <div className="space-y-1 mb-6">
                <span className="text-[11px] font-bold text-stone-950 font-serif block">
                  四、依所得稅法第17條第1項第1款規定，納稅義務人其他親屬或家屬，合於民法第1114條第4款及第1123條第3項規定，且合於下列條件之一者，每年每人得減除其扶養親屬免稅額。
                </span>
                <span className="text-[10px] text-stone-600 block pl-4 leading-tight">
                  (1)未成年； ｜ (2)已成年，因在校就學受納稅義務人扶養； ｜ (3)已成年，因身心障礙及無謀生能力。
                </span>
                <span className="text-[10px] text-stone-800 block pl-4 font-semibold">
                  本人之其他親屬或家屬合於上列規定條件者，計有: <strong className="border-b border-stone-800 px-3 font-mono">{others.length}</strong> 人
                </span>
                
                <table className="w-full border-collapse border border-stone-800 text-[10px]">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-800 h-7 font-bold text-center">
                      <td className="border-r border-stone-800 w-[18%]">姓名</td>
                      <td className="border-r border-stone-800 w-[12%]">稱謂</td>
                      <td className="border-r border-stone-800 w-[20%]">出生年月日</td>
                      <td className="border-r border-stone-800 w-[30%]">國民身分證統一編號或統一證號</td>
                      <td className="w-[20%]">符合之條件</td>
                    </tr>
                  </thead>
                  <tbody>
                    {paddedOthers.map((dep, i) => (
                      <tr key={`other-${i}`} className="border-b border-stone-800 h-8 text-center text-[11px]">
                        <td className="border-r border-stone-800 font-bold px-1">{dep.name}</td>
                        <td className="border-r border-stone-800 px-1">{dep.relationship}</td>
                        <td className="border-r border-stone-800 font-mono px-1">{dep.birthday}</td>
                        <td className="border-r border-stone-800 font-mono px-1 uppercase tracking-wider">{dep.idNumber}</td>
                        <td className="px-1 text-[10px] font-sans font-medium text-stone-700">
                          {dep.name && (dep.condition || '共同居住並扶養')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Civil Law Notes */}
              <div className="bg-stone-50 p-4 border border-stone-200 rounded text-[9px] text-stone-600 font-serif leading-relaxed mb-6 space-y-1">
                <span className="font-bold">民法第1114條第4款、第1123條第3項規定：</span>
                <p>（一）家屬：非親屬而以共同生活為目的同居一家者，視為家屬。</p>
                <p>（二）親屬：左列親屬互負扶養之義務：一、直系血親尊親屬。二、直系血親卑親屬。三、旁系血親、旁系姻親互負扶養義務。四、家長家屬相互間。</p>
              </div>

              {/* Declaration and Signature Section */}
              <div className="border border-stone-800 p-4 space-y-3">
                <p className="text-[10px] text-stone-800 font-serif leading-normal font-semibold">
                  聲明切結：本人依所得稅法規定，證明以上填報事項均確實無訛。本表係依所得稅法第十七條第一項第一款規定申報免稅額之用。受領人填報之受扶養親屬，其身分、關係、生日及所得狀況等，如有不實、重複申報，願自負法律責任。
                </p>
                <div className="flex justify-between items-center pt-2 font-sans text-xs">
                  <div className="space-y-1">
                    <div>申報受領人：<span className="font-bold border-b border-stone-800 px-4 min-w-[120px] inline-block text-center">{p.name || employee.name}</span> (簽章)</div>
                    <div>身分證號：<span className="font-mono tracking-wider">{p.idNumber || '待補填'}</span></div>
                  </div>
                  <div className="text-right">
                    <div>中華民國 <span className="font-mono">{rocYear}</span> 年 <span className="font-mono">{rocMonth}</span> 月 <span className="font-mono">{rocDay}</span> 日</div>
                    <div className="text-[10px] text-stone-500 mt-1">
                      {tax.signed ? '（已完成線上數位簽署確認）' : '（待數位簽署）'}
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Page Footer */}
            <div className="flex justify-between items-center text-[9px] text-stone-400 border-t border-stone-200 pt-3">
              <span>雲朗觀光集團 HR 人事報到系統</span>
              <span>第二頁 (共二頁)</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>,
    document.body
  ) : null;
}

export function ContractPrintModal({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const companyDetails = getCompanyDetails(employee);
  const p = (employee.personalData || {}) as PersonalData;
  
  const dObj = employee.onboardDate ? new Date(employee.onboardDate) : (employee.updatedAt ? new Date(employee.updatedAt) : new Date());
  const rocYear = isNaN(dObj.getTime()) ? 115 : dObj.getFullYear() - 1911;
  const rocMonth = isNaN(dObj.getTime()) ? 6 : dObj.getMonth() + 1;
  const rocDay = isNaN(dObj.getTime()) ? 15 : dObj.getDate();

  const handlePrint = () => {
    window.print();
  };

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm p-4 md:p-8 flex items-start justify-center print-modal-overlay">
      <div className="bg-stone-50 max-w-4xl w-full rounded-2xl shadow-2xl border border-stone-200 overflow-hidden my-4 text-left print-modal-card">
        
        {/* Header - strictly non-printing */}
        <div className="bg-stone-900 text-[#D4AF37] px-6 py-4 flex items-center justify-between sticky top-0 z-10 border-b border-[#D4AF37]/30 no-print-el">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-stone-850 flex items-center justify-center border border-[#D4AF37]/20 font-serif text-[#D4AF37] font-bold text-lg">
              約
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">🖨️ 聘僱合約書 列印預覽</h3>
              <p className="text-[10px] text-stone-400">符合勞基法規範之正式聘僱勞動契約 (單頁流式版面)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-5 py-1.5 bg-[#8D1B1B] hover:bg-[#A32222] text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              列印 ╱ 另存為 PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-stone-850 rounded-lg text-stone-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Info Notification - strictly non-printing */}
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 text-xs text-amber-800 flex items-center gap-2 no-print-el">
          <span className="shrink-0 bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded text-[10px] font-bold">說明</span>
          <p>請點擊右上方<strong>「列印 ╱ 另存為 PDF」</strong>。在列印對話框中將目標印表機選擇為<strong>「另存為 PDF / Save as PDF」</strong>，並務必開啟<strong>「背景圖形/Background graphics」</strong>。</p>
        </div>

        {/* Paper Container - styled to resemble dual-A4 sheets */}
        <div className="p-8 bg-neutral-200/40 flex flex-col gap-10 items-center justify-center overflow-auto print-paper-container">
          <div id="contract-print-area" className="flex flex-col gap-10 bg-transparent items-center justify-center">
            
            {/* SINGLE UNIFIED FLOWING PAGE */}
            <div className="bg-white print-page-flow shadow-lg w-[794px] min-h-[1123px] p-[60px] flex flex-col justify-between text-stone-900 border border-stone-300 relative font-serif leading-relaxed">
              <div>
                {/* Document Header */}
                <div className="text-center space-y-2 mb-10 pb-6 border-b-2 border-stone-800">
                  <h1 className="text-2xl font-bold tracking-[6px] text-stone-950">
                    {companyDetails.name}
                  </h1>
                  <h2 className="text-lg font-bold tracking-[10px] text-stone-850 mt-1">
                    聘 僱 合 約 書
                  </h2>
                </div>

                {/* Contracting Parties Row */}
                <div className="flex justify-between items-center text-xs font-semibold text-stone-900 mb-8 border-b border-stone-200 pb-4">
                  <div>
                    立契約人：<strong className="text-stone-950 border-b border-stone-800 px-3 tracking-wider text-sm">{companyDetails.name}</strong>（以下簡稱甲方）
                  </div>
                  <div>
                    立契約人：<strong className="text-indigo-800 border-b border-stone-800 px-3 tracking-wider text-sm">{p.name || employee.name}</strong>（以下簡稱乙方）
                  </div>
                </div>

                <p className="text-xs font-semibold text-stone-900 mb-6 bg-[#FAF6F0] p-3 rounded-lg border border-dashed border-[#8D1B1B]/15 leading-relaxed">
                  茲因甲方僱用乙方為員工，雙方同意訂立本契約，共同遵守約定條款如下：
                </p>

                <ol className="space-y-4 text-xs text-stone-800">
                  <li>
                    <strong className="text-stone-950 text-sm font-bold block mb-1">一、契約期間及試用期：</strong>
                    本契約自中華民國 <span className="font-mono font-bold text-stone-950 border-b border-stone-800 px-1">{rocYear}</span> 年 <span className="font-mono font-bold text-stone-950 border-b border-stone-800 px-1">{rocMonth}</span> 月 <span className="font-mono font-bold text-stone-950 border-b border-stone-800 px-1">{rocDay}</span> 日起。試用期間為 <span className="font-bold border-b border-stone-800 px-2 bg-stone-50">{employee.contractProbationMonths || '三'}</span> 個月，試用期間得隨時終止契約，試用期滿考核不合格者，依勞基法規定辦理。乙方於試用期間如欲離職，應於七日前預告。若有必要，試用期間可展延一期。
                  </li>

                  <li>
                    <strong className="text-stone-950 text-sm font-bold block mb-1">二、工作項目：</strong>
                    擔任 <strong>{employee.department || '餐飲服務'}</strong> 之 <strong>{employee.title || '服務專員'}</strong> 工作。
                  </li>

                  <li>
                    <strong className="text-stone-950 text-sm font-bold block mb-1">三、工作規則：</strong>
                    乙方同意遵守甲方制定之工作規則及規章制度。
                  </li>

                  <li>
                    <strong className="text-stone-950 text-sm font-bold block mb-1">四、工作地點：</strong>
                    乙方接受在 <span className="text-stone-950 font-bold border-b border-stone-800 px-2 bg-stone-50">{employee.contractWorkLocation || '君品酒店 (台北) (台北市承德路一段3號)'}</span> 地方擔任約定之工作。
                  </li>

                  <li>
                    <strong className="text-stone-950 text-sm font-bold block mb-1">五、工作轉換：</strong>
                    甲方因營業 or 工作需要，得適當派任、兼任、轉調 or 輪調乙方至其他班別、職務 or 各地分支機構，乙方同意接受甲方之調動。
                  </li>

                  <li>
                    <strong className="text-stone-950 text-sm font-bold block mb-1">六、工作時間：</strong>
                    乙方同意每日正常工作時間為依公司規定之起迄時間辦理（四週變形工時範圍等彈性配置）。
                    甲方因業務需要，得依勞基法規定在程序完填並提出前置申請下排定延長工時，延時工資依法計給。
                  </li>

                  <li>
                    <strong className="text-stone-950 text-sm font-bold block mb-1">七、休假排定：</strong>
                    {(employee.contractLeaveOption || 'biweekly') === 'monthly' ? (
                      <p>
                        依雙方約定於符合法令規定範圍內，由甲方排定休假方式月排休 <span className="text-stone-950 font-bold border-b border-stone-800 px-2 bg-stone-50 font-mono">{employee.contractLeavedays || '8-10'}</span> 日。
                        且同意甲方得將年度休假日、國定假日與其他工作日挪移，挪移後已成正常工作日，出勤不生加倍工資。
                      </p>
                    ) : (
                      <p>
                        於符合法定工作時數與排休規定之前提下，採 <strong>週休二日制</strong>。
                        甲方因業務需要得要求乙方配合採排班排休 or 晝夜輪班方式工作，並同意甲方得將年度休假日、國定假日與其他工作日調整挪移，挪移後已成正常工作日，出勤不生加倍工資。
                      </p>
                    )}
                  </li>

                  <li>
                    <strong className="text-stone-950 text-sm font-bold block mb-1">八、工資議定：</strong>
                    次月 5 日為發薪日 (遇例假日則提前至前一工作日)。薪資作業採取保密制，不得討論 or 洩漏第三者。
                    {(employee.contractSalaryType || 'monthly') === 'monthly' && (
                      <p className="mt-1">
                        雙方議定為<strong>月薪制</strong>，每月薪津為新台幣 <span className="text-stone-950 font-bold border-b border-stone-800 px-2 bg-stone-50 font-mono text-xs">{employee.contractSalaryAmount || '36,000'}</span> 元。
                      </p>
                    )}
                    {(employee.contractSalaryType || 'monthly') === 'daily' && (
                      <p className="mt-1">
                        雙方議定為<strong>日薪制</strong>，每日薪津為新台幣 <span className="text-stone-950 font-bold border-b border-stone-800 px-2 bg-stone-50 font-mono text-xs">{employee.contractSalaryAmount || '1,800'}</span> 元。
                      </p>
                    )}
                    {(employee.contractSalaryType || 'monthly') === 'hourly' && (
                      <p className="mt-1">
                        雙方議定為<strong>時薪制</strong>，每小時薪資為新台幣 <span className="text-stone-950 font-bold border-b border-stone-800 px-2 bg-stone-50 font-mono text-xs">{employee.contractSalaryAmount || '190'}</span> 元。
                      </p>
                    )}
                  </li>

                  <li>
                    <strong className="text-stone-950 text-sm font-bold block mb-1">九、智慧財產權約定：</strong>
                    <div className="space-y-1 pl-2">
                      <p>（一） 乙方確認於任職期間提供之勞務、資訊絕無侵害前任公司或其他第三人之智慧財產權、營業秘密 or 應履行之保密義務（包括但不限於競業禁止）。</p>
                      <p>（二） 乙方並保證於任職期間所提供 or 完成之智慧財產成果，均係由乙方自行創作，且絕無抄襲 or 仿冒他人之著作，並確實尊重他人之智慧財產權。</p>
                      <p>（三） 於任職期間，於職務上所完成之著作，同意以甲方 or 其代表人為著作人，相關之著作人格權及著作財產權皆歸甲方自始所有。</p>
                    </div>
                  </li>

                  <li>
                    <strong className="text-stone-950 text-sm font-bold block mb-1">十、保密條款：</strong>
                    乙方保證任職 or 受僱研究期間不使用、利用、複製、保留因參與工作任務所取得、知悉之任何經營資訊、營業秘密、機密文件，亦不以任何形式，直接 or 間接對第三人洩露、移轉 or 評論，或提供第三人使用。離職後亦負有上述保密義務，並同意於離職時簽署「離職申請單」中之保密相關約定。如有違反致甲方發生損失，同意負擔賠償責任。
                  </li>

                  <li>
                    <strong className="text-stone-950 text-sm font-bold block mb-1">十一、個資保護：</strong>
                    乙方因職務涉及之職務涉及及蒐集、處理、利用個人資料之行為者，乙方擔保遵循我國「個人資料保護法」及歐盟「資料保護一般規則(General Data Protection Regulation, GDPR)」相關規定，並同意恪守職責遵守甲方關於個人資料保護所訂定之相關制度、辦法及措施。
                  </li>
                </ol>

                {/* Sigs Area */}
                <div className="grid grid-cols-2 gap-6 mt-8 border-t border-stone-300 pt-6 font-sans text-[10px] text-stone-600 leading-loose">
                  <div className="space-y-1">
                    <strong className="text-stone-900 text-xs font-bold block mb-1.5">甲方 (立契約人)</strong>
                    <div>公司名稱：{companyDetails.name}</div>
                    <div>統一編號：{companyDetails.taxId}</div>
                    <div>負責人：{companyDetails.owner}</div>
                    <div>公司地址：{companyDetails.address}</div>
                  </div>
                  <div className="space-y-1 bg-stone-50/50 border border-stone-150 p-3 rounded-lg">
                    <strong className="text-stone-900 text-xs font-bold block mb-1.5">乙方 (立契約人)</strong>
                    <div>乙方姓名：<strong className="text-[#8D1B1B] font-bold text-xs">{p.name || employee.name}</strong></div>
                    <div>身分證號：<span className="font-mono font-bold tracking-wider uppercase text-stone-950">{p.idNumber || '待補填'}</span></div>
                    <div>現設住址：<span className="truncate block" title={p.contactAddress || p.legalAddress || '待補填'}>{p.legalAddress || p.contactAddress || '待補填'}</span></div>
                    <div>簽署狀態：{employee.contractSigned ? (
                      <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-150 px-1.5 py-0.5 rounded text-[9px] inline-block">
                        已完成線上數位簽署 (生效)
                      </span>
                    ) : (
                      <span className="text-stone-500 font-bold">待數位簽署</span>
                    )}</div>
                    {employee.contractSigned && (
                      <div className="text-stone-400 mt-1">
                        數位印鑑存檔時間：{employee.contractDate}
                      </div>
                    )}
                  </div>
                </div>

                {/* Taiwan ROC custom date rendering */}
                <div className="text-right text-xs mt-8 pr-4 font-bold font-serif text-stone-800">
                  簽署日期：中華民國 <span className="font-mono tracking-wide">{rocYear}</span> 年 <span className="font-mono tracking-wide">{rocMonth}</span> 月 <span className="font-mono tracking-wide">{rocDay}</span> 日
                </div>

              </div>

              <div className="flex justify-between items-center text-[9px] text-stone-400 border-t border-stone-200 pt-3">
                <span>雲朗觀光股份有限公司版權所有</span>
                <span>第二頁 (共二頁)</span>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>,
    document.body
  ) : null;
}

export function ConsentPrintModal({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const companyDetails = getCompanyDetails(employee);
  const p = (employee.personalData || {}) as PersonalData;
  
  const dObj = employee.onboardDate ? new Date(employee.onboardDate) : (employee.updatedAt ? new Date(employee.updatedAt) : new Date());
  const rocYear = isNaN(dObj.getTime()) ? 115 : dObj.getFullYear() - 1911;
  const rocMonth = isNaN(dObj.getTime()) ? 6 : dObj.getMonth() + 1;
  const rocDay = isNaN(dObj.getTime()) ? 15 : dObj.getDate();

  const handlePrint = () => {
    window.print();
  };

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm p-4 md:p-8 flex items-start justify-center print-modal-overlay">
      <div className="bg-stone-50 max-w-4xl w-full rounded-2xl shadow-2xl border border-stone-200 overflow-hidden my-4 text-left print-modal-card">
        
        {/* Header - strictly non-printing */}
        <div className="bg-stone-900 text-[#D4AF37] px-6 py-4 flex items-center justify-between sticky top-0 z-10 border-b border-[#D4AF37]/30 no-print-el">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-stone-850 flex items-center justify-center border border-[#D4AF37]/20 font-serif text-[#D4AF37] font-bold text-lg">
              個
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">🖨️ 個人資料告知及同意書 列印預覽</h3>
              <p className="text-[10px] text-stone-400">符合個人資料保護法第 8 條規定之雙方個資保護告知書</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-5 py-1.5 bg-[#8D1B1B] hover:bg-[#A32222] text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              列印 ╱ 另存為 PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-stone-850 rounded-lg text-stone-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Info Notification - strictly non-printing */}
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 text-xs text-amber-800 flex items-center gap-2 no-print-el">
          <span className="shrink-0 bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded text-[10px] font-bold">說明</span>
          <p>請點擊右上方<strong>「列印 ╱ 另存為 PDF」</strong>。在列印對話框中將目標印表機選擇為<strong>「另存為 PDF / Save as PDF」</strong>，並務必開啟<strong>「背景圖形/Background graphics」</strong>。</p>
        </div>

        {/* Paper Container - styled to resemble dual-A4 sheets */}
        <div className="p-8 bg-neutral-200/40 flex flex-col gap-10 items-center justify-center overflow-auto print-paper-container">
          <div id="consent-print-area" className="flex flex-col gap-10 bg-transparent items-center justify-center">
            
            {/* SINGLE UNIFIED FLOWING PAGE */}
            <div className="bg-white print-page-flow shadow-lg w-[794px] min-h-[1123px] p-[50px] flex flex-col justify-between text-stone-900 border border-stone-300 relative font-serif leading-relaxed">
              <div>
                {/* Document Header */}
                <div className="text-center space-y-2 mb-6 pb-4 border-b-2 border-stone-800">
                  <h1 className="text-xl font-bold tracking-[4px] text-stone-950">
                    {companyDetails.name}
                  </h1>
                  <h2 className="text-base font-bold tracking-[4px] text-stone-850 mt-1">
                    員工/面試者蒐集、處理及利用個人資料告知條款
                  </h2>
                </div>

                <div className="text-xs text-stone-850 space-y-4 font-sans text-justify leading-relaxed">
                  <p>
                    {companyDetails.name}（下稱「本公司」）依個人資料保護法（下稱個資法）第 8 條第 1 項規定，向 台端告知下列事項，請台端詳閱：
                  </p>

                  <div className="space-y-2">
                    <span className="block font-bold text-stone-950 text-[13px] border-l-4 border-stone-850 pl-2 font-serif">一、 蒐集之目的：</span>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] text-stone-800 bg-stone-50 p-3 rounded-lg border border-stone-100 font-sans">
                      <div>○一 人事管理（包含基本資訊、考績、薪資、投保與福利等）</div>
                      <div>○二 全民健康保險及勞工保險</div>
                      <div>○三 存款與匯款</div>
                      <div>○四 契約、類似契約或其他法律關係事務</div>
                      <div>○五 場所進出安全管理</div>
                      <div>○六 稅務行政</div>
                      <div>○七 會計與相關服務</div>
                      <div>○八 資(通)訊與資料庫管理</div>
                      <div>○九 資通安全與管理</div>
                      <div>一○ 僱用與服務管理</div>
                      <div>一一 觀光旅館業、旅館業經營管理業務</div>
                      <div>一二 其他經營合於營業登記之業務</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="block font-bold text-stone-950 text-[13px] border-l-4 border-stone-850 pl-2 font-serif">二、 蒐集之個人資料類別：</span>
                    <p className="text-[11px] text-stone-600 font-sans">本公司視情況所需，蒐集的員工個資範疇包含但不限於以下類別：</p>
                    <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-[10px] text-stone-700 bg-stone-50/50 p-3 rounded-lg border border-stone-100 font-sans">
                      <div>○一 辨識個人者 (姓名、電話等)</div>
                      <div>○二 辨識財務者 (銀行帳戶)</div>
                      <div>○三 政府資料中之辨識者</div>
                      <div>○四 個人描述 (生日、性別)</div>
                      <div>○五 身體描述 (血型等)</div>
                      <div>○六 個性</div>
                      <div>○七 家庭情形</div>
                      <div>○八 家庭其他成員之細節</div>
                      <div>○九 其他社會關係</div>
                      <div>一○ 住家及設施 (聯絡地址)</div>
                      <div>一一 職業</div>
                      <div>一二 執照或其他許可</div>
                      <div>一三 學校紀錄 (學歷)</div>
                      <div>一四 資格或技術 (證照)</div>
                      <div>一五 現行之受僱情形</div>
                      <div>一六 僱用經過</div>
                      <div>一七 離職經過</div>
                      <div>一八 工作經驗</div>
                      <div>一九 工作、差勤紀錄</div>
                      <div>二○ 健康與安全紀錄</div>
                      <div>二一 薪資與預扣款</div>
                      <div>二二 受僱人所持有之財產</div>
                      <div>二三 工作管理之細節</div>
                      <div>二四 工作之評估細節</div>
                      <div>二五 受訓紀錄</div>
                      <div>二六 安全細節</div>
                      <div>二八 社會保險等退休給付</div>
                      <div>二九 約定或契約</div>
                      <div>三○ 與營業有關之執照</div>
                      <div>三一 健康紀錄</div>
                      <div>三二 犯罪嫌疑資料</div>
                      <div>三三 書面文件之檢索</div>
                      <div>三四 未分類之資料等</div>
                    </div>
                  </div>

                  <div className="space-y-3 font-sans text-justify leading-relaxed">
                    <div className="space-y-1">
                      <span className="block font-bold text-stone-950 text-[12px] font-serif">三、 個人資料利用之期間、地區、對象及方式：</span>
                      <p className="text-[11px] text-stone-800 pl-2">
                        <strong>○一 期間：</strong>個人資料蒐集之特定目的存續期間 / 依相關法令或契約約定之保存年限（如：勞基準法等）/ 本公司營運業務所必須之期間。<br />
                        <strong>○二 地區：</strong>本國、本公司海外分支機構所在地、本公司委外或有業務往來經營處所所在地。<br />
                        <strong>○三 對象：</strong>本公司、關係連鎖企業、受託處理業務之第三人、依法有調查權機關及司法機關。<br />
                        <strong>○四 方式：</strong>以自動化機器或其他非自動化之符合安全保護規範之合理利用方式。
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="block font-bold text-stone-950 text-[12px] font-serif">四、 依個資法第 3 條規定，台端得行使下列權利：</span>
                      <p className="text-[11px] text-stone-800 pl-2">
                        ○一 得向本公司查詢、請求閱覽或請求製給複製本（得酌收工本費）。<br />
                        ○二 得向本公司請求補充或更正。<br />
                        ○三 得向本公司請求停止蒐集、處理、利用或請求刪除（惟依勞動法規或業務必須者不在此限）。
                      </p>
                    </div>

                    <div className="space-y-1 text-[11px] text-stone-600 italic bg-stone-50 p-2 border border-stone-150 rounded">
                      本公司將持續秉持對台端個人資料保護的重視，並於取得您個人資料，直至您本人對 {companyDetails.name} 提出申請請求停止蒐集、處理、利用或刪除個資止。
                    </div>

                    <div className="space-y-1">
                      <span className="block font-bold text-stone-950 text-[12px] font-serif">五、 台端不提供個人資料所致權益之影響：</span>
                      <p className="text-[11px] text-stone-800 pl-2">
                        台端得自由選擇是否提供，惟若拒絕提供，本公司將無法進行必要之審核、差勤勞健保投保作業等新進人員進用報到流程，進而可能影響您之權益。
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="block font-bold text-stone-950 text-[12px] font-serif">六、 修訂條款之告知：</span>
                      <p className="text-[11px] text-stone-800 pl-2">
                        本公司有權修訂本告知條款，並得以書面、簡訊、電子郵件、官網連結或其他足以使台端知悉之方式完成告知。
                      </p>
                    </div>

                    <div className="pt-1.5 border-t border-dashed border-stone-300">
                      <p className="font-bold text-[11px] text-stone-950 bg-stone-100 p-3 rounded-lg leading-relaxed text-justify mb-2 font-serif text-stone-900">
                        經公司向本人告知上開事項，填寫本員工/面試者蒐集、處理及利用個人資料告知條款及相關個人資料欄位即同意 <strong>{companyDetails.name}</strong> 及其子公司和關聯企業所經營、特許經營以及租賃的酒店，或所委派第三人處置相關個資案件。本人已清楚瞭解貴公司蒐集、處理或利用本個人資料之目的及用途。
                      </p>
                    </div>

                    <div className="border border-stone-300 p-4 rounded-xl bg-stone-50/50 space-y-3">
                      <div className="font-semibold text-stone-950 border-b border-stone-200 pb-1.5 text-xs font-serif">【個資蒐集同意人安全確認簽章欄】</div>
                      <div className="flex justify-between items-center text-xs">
                        <div>
                          受告知人簽名：
                          <span className="text-[#8D1B1B] font-bold tracking-wider text-sm border-b border-stone-850 px-4 py-0.5 ml-1 bg-white font-serif inline-block min-w-[125px] text-center">
                            {p.name || employee.name}
                          </span>
                        </div>
                        <div>
                          {employee.privacyAgreed ? (
                            <span className="text-emerald-700 font-semibold bg-emerald-50 border border-emerald-150 px-2.5 py-0.5 rounded flex items-center gap-1 inline-flex">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 線上認證已簽署同意
                            </span>
                          ) : (
                            <span className="text-amber-700 font-semibold bg-amber-50 border border-amber-100 px-2.5 py-0.5 rounded inline-flex">
                              待核對簽署
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-xs pt-1.5 font-bold font-serif text-stone-850">
                        中華民國 <span className="font-mono">{rocYear}</span> 年 <span className="font-mono">{rocMonth}</span> 月 <span className="font-mono">{rocDay}</span> 日
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center text-[9px] text-stone-400 border-t border-stone-200 pt-3 mt-8 font-sans">
                <span>{companyDetails.name} 版權所有 ─ 個資及隱私安全管理科核備</span>
                <span>個人資料告知條款</span>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>,
    document.body
  ) : null;
}
export function GuarantorPrintModal({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const companyDetails = getCompanyDetails(employee);
  const p = employee.personalData || {} as any;
  const g = employee.guarantorData || {
    guarantorName: '', birthday: '', idNumber: '', address: '', phone: '',
    companyName: '', companyTitle: '', companyAddress: '', companyPhone: '', relationship: '', validUntil: ''
  };

  const dObj = employee.onboardDate ? new Date(employee.onboardDate) : (employee.updatedAt ? new Date(employee.updatedAt) : new Date());
  const rocYear = isNaN(dObj.getTime()) ? 115 : dObj.getFullYear() - 1911;
  const rocMonth = isNaN(dObj.getTime()) ? 6 : dObj.getMonth() + 1;
  const rocDay = isNaN(dObj.getTime()) ? 15 : dObj.getDate();

  const handlePrint = () => {
    window.print();
  };

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm p-4 md:p-8 flex items-start justify-center print-modal-overlay">
      <div className="bg-stone-50 max-w-4xl w-full rounded-2xl shadow-2xl border border-stone-200 overflow-hidden my-4 text-left print-modal-card">
        
        {/* Header - strictly non-printing */}
        <div className="bg-stone-900 text-[#D4AF37] px-6 py-4 flex items-center justify-between sticky top-0 z-10 border-b border-[#D4AF37]/30 no-print-el">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-stone-850 flex items-center justify-center border border-[#D4AF37]/20">
              <Printer className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">🖨️ 職員保證書 列印預覽</h3>
              <p className="text-[10px] text-stone-400">符合 A4 標準格式，共計五頁的職員基本資料卡與人事聯保單，可直接列印或儲存為 PDF</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-5 py-1.5 bg-[#8D1B1B] hover:bg-[#A32222] text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              列印 ╱ 另存為 PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-stone-850 rounded-lg text-stone-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Paper Container - resembling 5 A4 sheets */}
        <div className="p-8 bg-neutral-200/40 flex flex-col gap-10 items-center justify-center overflow-auto print-paper-container">
          <div id="guarantor-print-area" className="flex flex-col gap-10 bg-transparent items-center justify-center">
            
            {/* PAGE 1: 基本資料 */}
          <div className="bg-white print-page-a4 shadow-lg w-[794px] h-[1123px] p-[60px] flex flex-col justify-between text-stone-900 border border-stone-300 relative">
            <div className="space-y-8">
              <div className="flex justify-between items-center text-sm font-serif h-5">
              </div>

              <div className="text-center pt-8">
                <h1 className="text-2xl font-bold tracking-[8px] text-stone-950 font-serif leading-relaxed">
                  {companyDetails.name}
                </h1>
                <h2 className="text-xl font-bold tracking-[12px] text-stone-950 font-serif mt-2 border-b-2 border-stone-800 pb-6">
                  職員保證書
                </h2>
              </div>

              <div className="text-right text-xs pr-4 font-serif text-stone-800">
                館別：<span className="border-b border-stone-400 px-8 font-bold">
                  {(() => {
                    const loc = employee.contractWorkLocation ? employee.contractWorkLocation.split(' (')[0] : (employee.department ? employee.department : '台北君品');
                    return (loc === '雲朗觀光' || loc === '雲朗觀光股份有限公司') ? '總公司' : loc;
                  })()}
                </span>
              </div>

              <div className="pt-8 space-y-6 text-sm font-serif text-stone-900 leading-[3rem]">
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex border-b border-stone-400 pb-2">
                    <span className="w-40 font-bold">被保證人：</span>
                    <span className="font-bold text-indigo-700 px-2">{p.name || employee.name}</span>
                  </div>
                  <div className="flex border-b border-stone-400 pb-2">
                    <span className="w-40 font-bold">性　　別：</span>
                    <span>{p.gender || '男'}</span>
                  </div>
                  <div className="flex border-b border-stone-400 pb-2">
                    <span className="w-40 font-bold">籍　　貫：</span>
                    <span>台北市</span>
                  </div>
                  <div className="flex border-b border-stone-400 pb-2">
                    <span className="w-40 font-bold">出生年月日：</span>
                    <span>{formatToRocDate(p.birthday)}</span>
                  </div>
                  <div className="flex border-b border-stone-400 pb-2">
                    <span className="w-40 font-bold">戶籍地址：</span>
                    <span className="text-xs">{p.legalAddress || '未填寫'}</span>
                  </div>
                  <div className="flex border-b border-stone-400 pb-2">
                    <span className="w-40 font-bold">通訊地址：</span>
                    <span className="text-xs">{p.contactAddress || '未填寫'}</span>
                  </div>
                  <div className="flex border-b border-stone-400 pb-2">
                    <span className="w-40 font-bold">聯絡電話：</span>
                    <span className="font-mono">{p.phone || employee.email}</span>
                  </div>
                  <div className="flex border-b border-stone-400 pb-2">
                    <span className="w-40 font-bold">到職日期：</span>
                    <span>{formatToRocDate(employee.onboardDate)}</span>
                  </div>
                  <div className="flex border-b border-stone-400 pb-2">
                    <span className="w-40 font-bold">任職單位、職稱：</span>
                    <span>{employee.department || '餐飲服務'} / {employee.title}</span>
                  </div>
                  <div className="flex border-b border-stone-400 pb-2">
                    <span className="w-40 font-bold">員工編號：</span>
                    <span className="font-mono">{employee.empId || '待核發'}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-center text-xs text-stone-400 font-sans border-t border-stone-150 pt-4">
              第一頁 (共五頁)
            </div>
          </div>

          {/* PAGE 2: 立保證書書 */}
          <div className="bg-white print-page-a4 shadow-lg w-[794px] h-[1123px] p-[60px] flex flex-col justify-between text-stone-900 border border-stone-300 relative">
            <div className="space-y-6">
              <div className="flex justify-between items-center text-sm font-serif h-5">
              </div>

              <div className="pt-6">
                <h3 className="text-lg font-bold font-serif text-stone-950 border-b border-stone-300 pb-3">立保證書人聲明書</h3>
              </div>

              <p className="text-sm leading-relaxed font-serif text-stone-800 text-justify indent-8 pt-4">
                立保證書人茲保證 <strong className="text-stone-950 border-b border-stone-850 px-2 text-base">{p.name || employee.name}</strong> 君在貴公司擔任職務期間，遵守貴公司所訂定之一切規章，倘有違背情事或侵佔公款、財物及其他危害公司行為，致損害於貴公司時，除被保證人應受法律制裁及公司處分外，保證人同意放棄先訴抗辯權，對被保證人之債務負完全賠償責任。並履行本保證書後列「保證規約」之規定。
              </p>

              <div className="py-6 text-sm font-bold font-serif text-stone-900">
                此致
              </div>
              <div className="text-lg font-bold font-serif text-stone-950 pl-8 pb-4">
                {companyDetails.name} 館
              </div>

              <div className="border border-stone-400 p-4 rounded-xl bg-stone-50/50 text-xs font-serif leading-loose grid grid-cols-2 gap-x-6 gap-y-2.5">
                <div className="col-span-2 border-b border-stone-200 pb-1 font-bold text-stone-950 flex justify-between">
                  <span>保證人與被保證人關係欄</span>
                  {employee.guarantorSigned && (
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] border border-emerald-200">
                      ● 已完成線上聯保認證
                    </span>
                  )}
                </div>
                <div>被保證人姓名：<strong className="text-stone-950 text-sm border-b border-stone-300 px-4 inline-block min-w-[100px]">{p.name || employee.name}</strong>（簽章）</div>
                <div>保證人姓名：<strong className="text-indigo-700 text-sm border-b border-stone-300 px-4 inline-block min-w-[100px]">{g.guarantorName || '未簽屬'}</strong>（簽章）</div>
                <div>出生年月日：<span>{formatToRocDate(g.birthday)}</span></div>
                <div>身分證字號：<span className="font-mono tracking-wider">{g.idNumber || '未簽屬'}</span></div>
                <div className="col-span-2">現住地址：<span>{g.address || '未簽屬'}</span></div>
                <div>聯絡電話：<span className="font-mono">{g.phone || '未簽屬'}</span></div>
                <div>關係：<span className="font-bold">{g.relationship || '聯保人'}</span></div>
                <div>服務機構職位：<span>{g.companyName || '無'}({g.companyTitle || '無'})</span></div>
                <div>服務機構地址：<span>{g.companyAddress || '無'}</span></div>
                <div>機構電話：<span className="font-mono">{g.companyPhone || '無'}</span></div>
                <div>保證期間至：<span>{g.validUntil ? formatToRocDate(g.validUntil) : ' 116 年 12 月 31 日'}</span> 為止</div>
                <p className="col-span-2 text-[10px] text-stone-500 italic mt-1 leading-normal">
                  (保證人對於被保證人保證期間內之作為，仍負完全聯帶保證責任。)
                </p>
              </div>
            </div>
            <div className="text-center text-xs text-stone-400 font-sans border-t border-stone-150 pt-4">
              第二頁 (共五頁)
            </div>
          </div>

          {/* PAGE 3: 保證規約 */}
          <div className="bg-white print-page-a4 shadow-lg w-[794px] h-[1123px] p-[60px] flex flex-col justify-between text-stone-900 border border-stone-300 relative">
            <div className="space-y-6">
              <div className="flex justify-between items-center text-sm font-serif h-5">
              </div>

              <div className="text-center pt-4">
                <h3 className="text-base font-bold font-serif text-stone-950 tracking-widest border-b border-stone-800 pb-4">
                  保 證 規 約
                </h3>
              </div>

              <div className="text-xs leading-relaxed font-serif text-stone-850 space-y-4 text-justify pl-4 pr-2">
                <p>一、凡於本公司經手管理現金人員或擔任財務、總務、採購之職工於通知任用後而辦理報到手續前，應覓年滿二十歲以上有正當職業及固定住所之個人為保證人。</p>
                <p>二、下列人員，不得為保證人：<br />
                  <span className="pl-6 block">１．被保證人之配偶。</span>
                  <span className="pl-6 block">２．本公司同仁。</span>
                </p>
                <p>三、保證人如欲退保，應以書面通知本公司，俟被保證人辦妥換保手續後，保證人方免除保證人責任。</p>
                <p>四、被保證人所任職務如有變更或調遷情事，本保證書仍屬有效，且本公司將書面通知保證人。但保證人之住址有變更時，應由被保證人隨時通知本公司。</p>
                <p>五、被保證人離職後，如發現在職期間有違反規章或虧欠公款、侵損財物或其他不法情事應由被保證人負責時，保證人不得推卸其保證責任。</p>
                <p>六、本公司得隨時向保證人查對。</p>
                <p>七、保證人遇有意外或本公司認為不適當時，被保證人應於一個月內另覓保證人，否則應接受及同意公司職務調換。</p>
                <p>八、保證人應隨同本保證書，交付身份證影本一份，以俾核對。</p>
                <p>九、本保證書應填寫二份，一份送本公司人事單位，一份由保證人留存。</p>
              </div>

              <div className="pt-20 text-right text-sm font-bold font-serif tracking-widest pr-4">
                中華民國 {rocYear} 年 {rocMonth} 月 {rocDay} 日
              </div>
            </div>
            <div className="text-center text-xs text-stone-400 font-sans border-t border-stone-150 pt-4">
              第三頁 (共五頁)
            </div>
          </div>

          {/* PAGE 4: 對保記錄 */}
          <div className="bg-white print-page-a4 shadow-lg w-[794px] h-[1123px] p-[60px] flex flex-col justify-between text-stone-900 border border-stone-300 relative">
            <div className="space-y-6">
              <div className="flex justify-between items-center text-sm font-serif h-5">
              </div>

              <div className="text-center pt-4">
                <h3 className="text-base font-bold font-serif text-stone-950 tracking-widest border-b border-stone-800 pb-4">
                  對 保 記 錄
                </h3>
              </div>

              <div className="pt-8">
                <table className="w-full border-collapse border border-stone-800 text-xs font-serif text-center">
                  <thead>
                    <tr className="bg-stone-50 h-10 border-b border-stone-800">
                      <th className="border-r border-stone-800 w-[20%] font-bold">對保年月日</th>
                      <th className="border-r border-stone-800 w-[60%] font-bold">對 保 記 錄</th>
                      <th className="w-[20%] font-bold">對保人簽章</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="h-[240px] border-b border-stone-800">
                      <td className="border-r border-stone-800 p-2 font-mono">
                        {employee.guarantorSigned ? employee.guarantorDate : '  年  月  日'}
                      </td>
                      <td className="border-r border-stone-800 p-4 text-left leading-relaxed">
                        與保證人完成身分驗證，保證人本人同意擔保被保證人於任職期間之一切人事聯保行為。對保聯絡順利。
                      </td>
                      <td className="p-2 text-stone-400 font-serif italic text-[11px]">
                        人資主管簽章
                      </td>
                    </tr>
                    <tr className="h-[240px]">
                      <td className="border-r border-stone-800 p-2 font-mono">
                        年  月  日
                      </td>
                      <td className="border-r border-stone-800 p-4 text-left leading-relaxed text-stone-300">
                        (第二順位或定期追溯對保記錄留存處)
                      </td>
                      <td className="p-2 text-stone-300 font-serif italic text-[11px]">
                        核對欄
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="text-center text-xs text-stone-400 font-sans border-t border-stone-150 pt-4">
              第四頁 (共五頁)
            </div>
          </div>

          {/* PAGE 5: 對保面會照片/視訊截圖實貼處 */}
          <div className="bg-white print-page-a4 shadow-lg w-[794px] h-[1123px] p-[60px] flex flex-col justify-between text-stone-900 border border-stone-300 relative">
            <div className="space-y-6">
              <div className="flex justify-between items-center text-sm font-serif h-5">
              </div>

              <div className="text-center pt-4">
                <h3 className="text-base font-bold font-serif text-stone-950 tracking-wider border-b border-stone-800 pb-4">
                  對 保 面 會 照 片 ╱ 視 訊 截 圖 實 貼 處
                </h3>
              </div>

              <div className="grid grid-cols-5 gap-6 pt-6">
                <div className="col-span-1 text-[10px] text-stone-400 leading-relaxed font-serif border-r border-stone-200 pr-4 text-justify">
                  本保證書所蒐集之保證人與被保證人個人資料，僅作於本保證書範圍內、不作為他途之用。
                </div>
                
                <div className="col-span-4 space-y-8">
                  <div className="border-2 border-dashed border-stone-300 rounded-xl h-[260px] flex items-center justify-center p-6 text-center text-xs text-stone-400 bg-stone-50/40 relative">
                    <span className="leading-relaxed">
                      （照片或截圖影像需清晰可見對保人之容貌及身分證）
                    </span>
                    <div className="absolute bottom-3 right-4 text-[10px] text-stone-500 font-mono font-serif">
                      對保日期：{employee.guarantorSigned ? employee.guarantorDate : '    年    月    日'}
                    </div>
                  </div>

                  <div className="border-2 border-dashed border-stone-300 rounded-xl h-[260px] flex items-center justify-center p-6 text-center text-xs text-stone-400 bg-stone-50/40 relative">
                    <span className="leading-relaxed">
                      （證件或對保視訊實時確認影像備份處）
                    </span>
                    <div className="absolute bottom-3 right-4 text-[10px] text-stone-300 font-mono font-serif">
                      對保日期：     年     月     日
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-center text-xs text-stone-400 font-sans border-t border-stone-150 pt-4">
              第五頁 (共五頁)
            </div>
          </div>

          </div>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
}

export function ServicePrintModal({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const companyDetails = getCompanyDetails(employee);
  const p = employee.personalData || {} as any;

  const dObj = employee.onboardDate ? new Date(employee.onboardDate) : (employee.updatedAt ? new Date(employee.updatedAt) : new Date());
  const rocYear = isNaN(dObj.getTime()) ? 115 : dObj.getFullYear() - 1911;
  const rocMonth = isNaN(dObj.getTime()) ? 6 : dObj.getMonth() + 1;
  const rocDay = isNaN(dObj.getTime()) ? 15 : dObj.getDate();

  const handlePrint = () => {
    window.print();
  };

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm p-4 md:p-8 flex items-start justify-center print-modal-overlay">
      <div className="bg-stone-50 max-w-4xl w-full rounded-2xl shadow-2xl border border-stone-200 overflow-hidden my-4 text-left print-modal-card">
        
        {/* Header - strictly non-printing */}
        <div className="bg-stone-900 text-[#D4AF37] px-6 py-4 flex items-center justify-between sticky top-0 z-10 border-b border-[#D4AF37]/30 no-print-el">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-stone-850 flex items-center justify-center border border-[#D4AF37]/20">
              <Printer className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">🖨️ 職工服務約定書 列印預覽</h3>
              <p className="text-[10px] text-stone-400">標準 A4 合約書形式，包含數位保密法規與員工服務條款，可直接列印或儲存為 PDF</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-5 py-1.5 bg-[#8D1B1B] hover:bg-[#A32222] text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              列印 ╱ 另存為 PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-stone-850 rounded-lg text-stone-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Paper Container - A4 Sheet */}
        <div className="p-8 bg-neutral-200/40 flex flex-col gap-10 items-center justify-center overflow-auto print-paper-container">
          <div id="service-print-area" className="flex flex-col gap-10 bg-transparent items-center justify-center">
            
            <div className="bg-white print-page-a4 shadow-lg w-[794px] h-[1123px] p-[60px] flex flex-col justify-between text-stone-900 border border-stone-300 relative">
            <div className="space-y-6">
              <div className="flex justify-between items-center text-sm font-serif h-5">
              </div>

              <div className="text-center pt-8">
                <h1 className="text-2xl font-bold tracking-[8px] text-stone-950 font-serif leading-relaxed">
                  {companyDetails.name}
                </h1>
                <h2 className="text-xl font-bold tracking-[12px] text-stone-950 font-serif mt-2 border-b-2 border-stone-800 pb-4">
                  職 工 服 務 約 定
                </h2>
              </div>

              <div className="text-right text-xs pr-4 font-serif text-stone-800">
                館別：<span className="border-b border-stone-400 px-8 font-bold">
                  {(() => {
                    const loc = employee.contractWorkLocation ? employee.contractWorkLocation.split(' (')[0] : (employee.department ? employee.department : '台北君品');
                    return (loc === '雲朗觀光' || loc === '雲朗觀光股份有限公司') ? '總公司' : loc;
                  })()}
                </span>
              </div>

              <div className="space-y-5 text-xs text-stone-800 leading-6 font-serif text-justify pt-4">
                <p><strong>第一條：</strong>本公司職工任職期間須以客為尊，並遵守本公司各項規章。</p>
                <p><strong>第二條：</strong>職工同意自實際工作日起九十天內為試用期間，在此期間如工作能力不足或服務態度不滿意或為本公司評估無法勝任所應徵之職務，得依相關規定停止試用。</p>
                <p><strong>第三條：</strong>職工應依「個人資料保護法」不得將顧客或本公司員工之個人資料提供予無關之第三人。</p>
                <p><strong>第四條：</strong>就職工所填寫個人資料，本公司、分公司及關係企業（下稱本公司）將於職工聘僱期間，於中華民國地區，作為人事管理、組織調整、及與營運有關之使用。</p>
                <p><strong>第五條：</strong>本公司依「個人資料保護法」不會提供予無關之第三人。職工依「個人資料保護法」並可向本公司為個人資料查詢、請求閱覽、補充或更正或請求交付複製本。另，雖亦可請求停止蒐集、處理或利用及刪除，但於聘僱關係存續期間，或聘僱關係終止後，本公司因執行職務或業務所必須者，職工無權請求停止蒐集、處理或利用及刪除。</p>
                
                <div className="pt-4 border-t border-dashed border-stone-300">
                  <p className="font-bold text-stone-950 bg-stone-50 p-4 border border-stone-150 rounded-xl leading-relaxed">
                    以上守則，經本人逐條仔細閱讀並為同意。本人願意遵守，如有違反，願依照本公司員工手冊第十二條職工獎懲辦法處理，絕無異議。
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-10 font-serif">
                <div className="space-y-4">
                  <div className="text-xs">
                    立同意書人：
                    <span className="text-[#8D1B1B] font-bold tracking-wider text-sm border-b border-stone-850 px-4 ml-1 bg-white inline-block">
                      {p.name || employee.name}
                    </span>
                  </div>
                  <div className="text-xs">
                    簽章：
                    {employee.serviceSigned ? (
                      <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded text-[10px] ml-1 border border-emerald-150 font-bold inline-block">
                        ✔ 線上已簽屬
                      </span>
                    ) : (
                      <span className="text-stone-400 italic">待電子認證</span>
                    )}
                  </div>
                </div>

                <div className="flex items-end justify-end text-right text-xs font-bold leading-loose">
                  中華民國 {rocYear} 年 {rocMonth} 月 {rocDay} 日
                </div>
              </div>
            </div>

            <div className="text-center text-xs text-stone-400 font-sans border-t border-stone-150 pt-4">
              第一頁 (共一頁)
            </div>
          </div>
          </div>

        </div>
      </div>
    </div>,
    document.body
  ) : null;
}
