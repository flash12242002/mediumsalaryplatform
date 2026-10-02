import React from 'react';
import { X, Printer, FileText, CheckCircle2 } from 'lucide-react';
import { OnboardEmployee, TaxDependent, PersonalData, TaxDeclaration } from '../types';
import { getCompanyDetails } from './EmployeeDashboard';

interface PrintModalProps {
  OnboardEmployee: OnboardEmployee;
  onClose: () => void;
}

// Small helper to parse date to ROC date
function formatToRocDate(dateStr?: string) {
  if (!dateStr) return '  å¹? ?? ??;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    // Try to parse YYYY/MM/DD or similar raw-ly
    const parts = dateStr.split(/[-/]/);
    if (parts.length >= 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      return ` ${y > 1911 ? y - 1911 : y} å¹?${m} ??${day} ?¥`;
    }
    return dateStr;
  }
  const year = d.getFullYear() - 1911;
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return ` ${year} å¹?${month} ??${day} ?¥`;
}

export function TaxDeclarationPrintModal({ OnboardEmployee, onClose }: PrintModalProps) {
  const companyDetails = getCompanyDetails(OnboardEmployee);
  const p = (OnboardEmployee.personalData || {}) as PersonalData;
  const tax = (OnboardEmployee.taxDeclaration || { spouseName: '', spouseBirthday: '', spouseIdNumber: '', dependents: [], signed: false }) as TaxDeclaration;
  const dependentsList: TaxDependent[] = tax.dependents || [];
  
  const dObj = OnboardEmployee.onboardDate ? new Date(OnboardEmployee.onboardDate) : (OnboardEmployee.updatedAt ? new Date(OnboardEmployee.updatedAt) : new Date());
  const rocYear = isNaN(dObj.getTime()) ? 115 : dObj.getFullYear() - 1911;
  const rocMonth = isNaN(dObj.getTime()) ? 6 : dObj.getMonth() + 1;
  const rocDay = isNaN(dObj.getTime()) ? 15 : dObj.getDate();
  
  // Distribute dependents into types
  const ancestors = dependentsList.filter(d => 
    d.type === '?´ç³»å°Šè¦ªå±? || d.relationship === '?? || d.relationship === 'æ¯? || d.relationship === '?¶è¦ª' || d.relationship === 'æ¯è¦ª'
  );
  
  const children = dependentsList.filter(d => 
    d.type === 'å­å¥³' || d.relationship === 'å­? || d.relationship === 'å¥? || d.relationship === '?·å?' || d.relationship === '?·å¥³' || d.relationship === 'æ¬¡å?' || d.relationship === 'æ¬¡å¥³'
  );
  
  const siblings = dependentsList.filter(d => 
    d.type === '?Œè??„å?å§Šå¦¹' || d.relationship === '?? || d.relationship === 'å¼? || d.relationship === 'å§? || d.relationship === 'å¦? || d.relationship === 'å§?
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm p-4 md:p-8 flex items-start justify-center print-modal-overlay">
      <div className="bg-stone-50 max-w-4xl w-full rounded-2xl shadow-2xl border border-stone-200 overflow-hidden my-4 text-left print-modal-card">
        
        {/* Header - strictly non-printing */}
        <div className="bg-stone-900 text-[#D4AF37] px-6 py-4 flex items-center justify-between sticky top-0 z-10 border-b border-[#D4AF37]/30 no-print-el">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-stone-850 flex items-center justify-center border border-[#D4AF37]/20">
              <Printer className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">?–¨ï¸??ªè??—é?äººå?ç¨…é??³å ±è¡??—å°?è¦½</h3>
              <p className="text-[10px] text-stone-400">ç³»çµ±å·²è‡ª?•å??¨ç?ä¸Šç”³?±ä??—æ‰¶é¤Šè¦ªå±¬è??–ç‚º A4 æ¨™æ??™é?è¡¨æ ¼ï¼Œå¯?´æ¥?—å°?–å„²å­˜ç‚º PDF</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-5 py-1.5 bg-[#8D1B1B] hover:bg-[#A32222] text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              ?—å° ???¦å???PDF
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
          <span className="shrink-0 bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded text-[10px] font-bold">èªªæ?</span>
          <p>è«‹é??Šå³ä¸Šæ–¹<strong>?Œå??????¦å???PDF??/strong>?‰é??‚åœ¨?—å°å°è©±æ¡†ä¸­å°‡ç›®æ¨™å??°æ??¸æ???strong>?Œå¦å­˜ç‚º PDF / Save as PDF??/strong>ï¼Œä¸¦?™å??‹å?<strong>?Œè??¯å?å½?Background graphics??/strong>ä»¥ç¢ºä¿è¡¨?¼é?æ¡†è??Œæ™¯ç¾è??ˆç¾??/p>
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
                    å¹´è–ªè³‡å??˜äºº?ç?é¡ç”³?±è¡¨
                  </h1>
                  <p className="text-[10px] text-stone-600 tracking-wide text-center mt-1">ï¼ˆæœ¬è¡¨ä??³å ±?—æ‰¶é¤Šè¦ªå±¬å?ç¨…é?ä¹‹ç”¨ï¼?/p>
                </div>

                {/* Top-right ??¹³?®ä? box */}
                <div className="w-[38%] border border-stone-800 text-[10px]">
                  <table className="w-full border-collapse">
                    <tbody>
                      <tr className="border-b border-stone-800 h-7">
                        <td className="w-20 bg-stone-50 border-r border-stone-800 text-center font-bold font-serif">çµ±ä?ç·¨è?</td>
                        <td className="px-1.5 flex items-center justify-center h-full gap-0.5 pt-1">
                          {taxIdDigits.map((digit, i) => (
                            <span key={i} className="w-4 h-4 border border-stone-400 flex items-center justify-center text-[10px] font-bold font-mono">
                              {digit}
                            </span>
                          ))}
                        </td>
                      </tr>
                      <tr className="border-b border-stone-800 h-8">
                        <td rowSpan={2} className="bg-stone-50 border-r border-stone-800 text-center font-bold font-serif leading-tight">??¹³<br />?®ä?</td>
                        <td className="border-b border-stone-800 px-1.5 py-0.5 leading-tight font-serif whitespace-nowrap text-[9px]">
                          ?ç¨±ï¼?strong className="text-stone-950 text-[10px]">{companyDetails.name}</strong>
                        </td>
                      </tr>
                      <tr className="border-b border-stone-800 h-8">
                        <td className="px-1.5 py-0.5 leading-tight font-serif text-[9px]">
                          ?°å?ï¼?span className="text-stone-850 text-[9px]">{companyDetails.address}</span>
                        </td>
                      </tr>
                      <tr className="h-7">
                        <td className="bg-stone-50 border-r border-stone-800 text-center font-bold font-serif">??¹³ç¾©å?äº?/td>
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
                      ?ªè???br />?˜äºº
                    </td>
                    <td className="w-[10%] bg-stone-50 border-r border-stone-800 text-center font-bold">å§“å?</td>
                    <td className="w-[20%] border-r border-stone-800 px-2 font-bold text-stone-950 font-serif">
                      {p.name || OnboardEmployee.name}
                    </td>
                    <td className="w-[12%] bg-stone-50 border-r border-stone-800 text-center font-bold">?ºç?å¹´æ???/td>
                    <td className="w-[18%] border-r border-stone-800 px-2 font-mono">
                      {p.birthday || '?ªå¡«å¯?}
                    </td>
                    <td className="w-[12%] bg-stone-50 border-r border-stone-800 text-center font-bold leading-tight">?‹æ?èº«å?è­?br />çµ±ä?ç·¨è?</td>
                    <td className="w-[16%] px-2 font-mono font-bold tracking-wider uppercase text-stone-950">
                      {p.idNumber || '?ªå¡«å¯?}
                    </td>
                  </tr>
                  <tr className="h-10 border-b border-stone-800">
                    <td className="bg-stone-50 border-r border-stone-800 text-center font-bold">?å¶</td>
                    <td className="border-r border-stone-800 px-2 font-bold text-stone-950">
                      {tax.spouseName || '??}
                    </td>
                    <td className="bg-stone-50 border-r border-stone-800 text-center font-bold">?ºç?å¹´æ???/td>
                    <td className="border-r border-stone-800 px-2 font-mono">
                      {tax.spouseBirthday || (tax.spouseName ? 'å¾…è?å¡? : '')}
                    </td>
                    <td className="bg-stone-50 border-r border-stone-800 text-center font-bold leading-tight">?‹æ?èº«å?è­?br />çµ±ä?ç·¨è?</td>
                    <td className="px-2 font-mono uppercase">
                      {tax.spouseIdNumber || (tax.spouseName ? 'å¾…è?å¡? : '')}
                    </td>
                  </tr>
                  <tr className="h-10">
                    <td className="bg-stone-50 border-r border-stone-800 text-center font-bold font-serif">ä½å?</td>
                    <td colSpan={6} className="px-2 leading-relaxed font-serif">
                      {p.contactAddress || p.legalAddress || '?ªå¡«å¯?}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Subtitle declaration */}
              <p className="text-[11px] font-serif font-semibold text-stone-950 leading-relaxed mb-3">
                ?ˆæ–¼æ¸›é™¤?¶é?è¦ªå±¬?ç?é¡ä??—æ‰¶é¤Šè¦ªå±?(?±è? <strong className="border-b border-stone-800 px-4 font-mono">{dependentsList.length}</strong> äº??‚ã€ä??—è¡¨?¼ä??·ä½¿?¨æ?ï¼Œä?å¼å¦? è¡¨?¼ã€‚ã€?              </p>

              {/* SECTION 1: ANCESTORS */}
              <div className="space-y-1 mb-6">
                <span className="text-[11px] font-bold text-stone-950 font-serif block">
                  ä¸€?ä??€å¾—ç?æ³•ç¬¬17æ¢ç¬¬1?…ç¬¬1æ¬¾è?å®šï?ç´ç?ç¾©å?äººå??¶é??¶ä??´ç³»å°Šè¦ªå±¬ï??ˆæ–¼ä¸‹å?æ¢ä»¶ä¹‹ä??…ï?æ¯å¹´æ¯äººå¾—æ??¤å…¶?¶é?è¦ªå±¬?ç?é¡ã€?                </span>
                <span className="text-[10px] text-stone-600 block pl-4">
                  (1)å¹´æ»¿60æ­²ï? ï½?(2)?ªæ»¿60æ­²ï?ä½†ç„¡è¬€?Ÿèƒ½?›å?ç´ç?ç¾©å?äººæ‰¶é¤Šã€?                </span>
                <span className="text-[10px] text-stone-800 block pl-4 font-semibold">
                  ?¬äºº?Šé??¶ä??´ç³»å°Šè¦ªå±¬å??¼ä??—è?å®šæ?ä»¶è€…ï?è¨ˆæ?: <strong className="border-b border-stone-800 px-3 font-mono">{ancestors.length}</strong> äº?                </span>
                
                <table className="w-full border-collapse border border-stone-800 text-[10px]">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-800 h-7 font-bold text-center">
                      <td className="border-r border-stone-800 w-[18%]">å§“å?</td>
                      <td className="border-r border-stone-800 w-[12%]">ç¨±è?</td>
                      <td className="border-r border-stone-800 w-[20%]">?ºç?å¹´æ???/td>
                      <td className="border-r border-stone-800 w-[30%]">?‹æ?èº«å?è­‰çµ±ä¸€ç·¨è??–çµ±ä¸€è­‰è?</td>
                      <td className="w-[20%]">ç¬¦å?ä¹‹æ?ä»?/td>
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
                          {dep.name && (dep.condition || '?¶é?æ»?0æ­?)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* SECTION 2: CHILDREN */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-stone-950 font-serif block">
                  äºŒã€ä??€å¾—ç?æ³•ç¬¬17æ¢ç¬¬1?…ç¬¬1æ¬¾è?å®šï?ç´ç?ç¾©å?äººä?å­å¥³ï¼Œå??¼ä??—æ?ä»¶ä?ä¸€?…ï?æ¯å¹´æ¯äººå¾—æ??¤å…¶?¶é?è¦ªå±¬?ç?é¡ã€?                </span>
                <span className="text-[10px] text-stone-600 block pl-4 leading-tight">
                  (1)?ªæ?å¹´ï? ï½?(2)å·²æ?å¹´ï?? åœ¨?¡å°±å­¸å?ç´ç?ç¾©å?äººæ‰¶é¤Šï? ï½?(3)å·²æ?å¹´ï?? èº«å¿ƒé?ç¤™å?ç´ç?ç¾©å?äººæ‰¶é¤Šï? ï½?(4)å·²æ?å¹´ï?? ç„¡è¬€?Ÿèƒ½?›å?ç´ç?ç¾©å?äººæ‰¶é¤Šã€?                </span>
                <span className="text-[10px] text-stone-800 block pl-4 font-semibold">
                  ?¬äººä¹‹å?å¥³å??¼ä??—è?å®šæ?ä»¶è€…ï?è¨ˆæ?: <strong className="border-b border-stone-800 px-3 font-mono">{children.length}</strong> äº?                </span>
                
                <table className="w-full border-collapse border border-stone-800 text-[10px]">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-800 h-7 font-bold text-center">
                      <td className="border-r border-stone-800 w-[18%]">å§“å?</td>
                      <td className="border-r border-stone-800 w-[12%]">ç¨±è?</td>
                      <td className="border-r border-stone-800 w-[20%]">?ºç?å¹´æ???/td>
                      <td className="border-r border-stone-800 w-[30%]">?‹æ?èº«å?è­‰çµ±ä¸€ç·¨è??–çµ±ä¸€è­‰è?</td>
                      <td className="w-[20%]">ç¬¦å?ä¹‹æ?ä»?/td>
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
                          {dep.name && (dep.condition || '?ªæ?å¹??¨å­¸')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
            </div>

            {/* Page Footer */}
            <div className="flex justify-between items-center text-[9px] text-stone-400 border-t border-stone-200 pt-3">
              <span>?²æ?è§€?‰é???HR äººä??±åˆ°ç³»çµ±</span>
              <span>ç¬¬ä???(?±ä???</span>
            </div>
          </div>

          {/* PAGE 2 */}
          <div className="bg-white print-page-a4 shadow-lg w-[794px] h-[1123px] p-[40px] flex flex-col justify-between text-stone-900 border border-stone-300 relative">
            
            <div>
              <div className="text-center pb-4 mb-4 border-b border-stone-200">
                <span className="text-xs tracking-[4px] font-bold text-stone-500 font-serif">å¹´è–ªè³‡å??˜äºº?ç?é¡ç”³?±è¡¨</span>
              </div>

              {/* SECTION 3: SIBLINGS */}
              <div className="space-y-1 mb-6">
                <span className="text-[11px] font-bold text-stone-950 font-serif block">
                  ä¸‰ã€ä??€å¾—ç?æ³•ç¬¬17æ¢ç¬¬1?…ç¬¬1æ¬¾è?å®šï?ç´ç?ç¾©å?äººå??¶é??¶ä??Œè??„å?å§Šå¦¹ï¼Œå??¼ä??—æ?ä»¶ä?ä¸€?…ï?æ¯å¹´æ¯äººå¾—æ??¤å…¶?¶é?è¦ªå±¬?ç?é¡ã€?                </span>
                <span className="text-[10px] text-stone-600 block pl-4">
                  (1)?ªæ?å¹´ï? ï½?(2)å·²æ?å¹´ï?? åœ¨?¡å°±å­¸å?ç´ç?ç¾©å?äººæ‰¶é¤Šï? ï½?(3)å·²æ?å¹´ï?? èº«å¿ƒé?ç¤™å??¡è??Ÿèƒ½?›ã€?                </span>
                <span className="text-[10px] text-stone-800 block pl-4 font-semibold">
                  ?¬äºº?Šé??¶ä??Œè??„å?å§Šå¦¹?ˆæ–¼ä¸Šå?è¦å?æ¢ä»¶?…ï?è¨ˆæ?: <strong className="border-b border-stone-800 px-3 font-mono">{siblings.length}</strong> äº?                </span>
                
                <table className="w-full border-collapse border border-stone-800 text-[10px]">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-800 h-7 font-bold text-center">
                      <td className="border-r border-stone-800 w-[18%]">å§“å?</td>
                      <td className="border-r border-stone-800 w-[12%]">ç¨±è?</td>
                      <td className="border-r border-stone-800 w-[20%]">?ºç?å¹´æ???/td>
                      <td className="border-r border-stone-800 w-[30%]">?‹æ?èº«å?è­‰çµ±ä¸€ç·¨è??–çµ±ä¸€è­‰è?</td>
                      <td className="w-[20%]">ç¬¦å?ä¹‹æ?ä»?/td>
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
                          {dep.name && (dep.condition || '?ªæ?å¹??¨å­¸')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* SECTION 4: OTHERS */}
              <div className="space-y-1 mb-6">
                <span className="text-[11px] font-bold text-stone-950 font-serif block">
                  ?›ã€ä??€å¾—ç?æ³•ç¬¬17æ¢ç¬¬1?…ç¬¬1æ¬¾è?å®šï?ç´ç?ç¾©å?äººå…¶ä»–è¦ªå±¬æ?å®¶å±¬ï¼Œå??¼æ?æ³•ç¬¬1114æ¢ç¬¬4æ¬¾å?ç¬?123æ¢ç¬¬3?…è?å®šï?ä¸”å??¼ä??—æ?ä»¶ä?ä¸€?…ï?æ¯å¹´æ¯äººå¾—æ??¤å…¶?¶é?è¦ªå±¬?ç?é¡ã€?                </span>
                <span className="text-[10px] text-stone-600 block pl-4 leading-tight">
                  (1)?ªæ?å¹´ï? ï½?(2)å·²æ?å¹´ï?? åœ¨?¡å°±å­¸å?ç´ç?ç¾©å?äººæ‰¶é¤Šï? ï½?(3)å·²æ?å¹´ï?? èº«å¿ƒé?ç¤™å??¡è??Ÿèƒ½?›ã€?                </span>
                <span className="text-[10px] text-stone-800 block pl-4 font-semibold">
                  ?¬äººä¹‹å…¶ä»–è¦ªå±¬æ?å®¶å±¬?ˆæ–¼ä¸Šå?è¦å?æ¢ä»¶?…ï?è¨ˆæ?: <strong className="border-b border-stone-800 px-3 font-mono">{others.length}</strong> äº?                </span>
                
                <table className="w-full border-collapse border border-stone-800 text-[10px]">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-800 h-7 font-bold text-center">
                      <td className="border-r border-stone-800 w-[18%]">å§“å?</td>
                      <td className="border-r border-stone-800 w-[12%]">ç¨±è?</td>
                      <td className="border-r border-stone-800 w-[20%]">?ºç?å¹´æ???/td>
                      <td className="border-r border-stone-800 w-[30%]">?‹æ?èº«å?è­‰çµ±ä¸€ç·¨è??–çµ±ä¸€è­‰è?</td>
                      <td className="w-[20%]">ç¬¦å?ä¹‹æ?ä»?/td>
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
                          {dep.name && (dep.condition || '?±å?å±…ä?ä¸¦æ‰¶é¤?)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Civil Law Notes */}
              <div className="bg-stone-50 p-4 border border-stone-200 rounded text-[9px] text-stone-600 font-serif leading-relaxed mb-6 space-y-1">
                <span className="font-bold">æ°‘æ?ç¬?114æ¢ç¬¬4æ¬¾ã€ç¬¬1123æ¢ç¬¬3?…è?å®šï?</span>
                <p>ï¼ˆä?ï¼‰å®¶å±¬ï??è¦ªå±¬è€Œä»¥?±å??Ÿæ´»?ºç›®?„å?å±…ä?å®¶è€…ï?è¦–ç‚ºå®¶å±¬??/p>
                <p>ï¼ˆä?ï¼‰è¦ªå±¬ï?å·¦å?è¦ªå±¬äº’è??¶é?ä¹‹ç¾©?™ï?ä¸€?ç›´ç³»è?è¦ªå?è¦ªå±¬?‚ä??ç›´ç³»è?è¦ªå?è¦ªå±¬?‚ä??æ?ç³»è?è¦ªã€æ?ç³»å§»è¦ªä?è² æ‰¶é¤Šç¾©?™ã€‚å??å®¶?·å®¶å±¬ç›¸äº’é???/p>
              </div>

              {/* Declaration and Signature Section */}
              <div className="border border-stone-800 p-4 space-y-3">
                <p className="text-[10px] text-stone-800 font-serif leading-normal font-semibold">
                  ?²æ??‡ç?ï¼šæœ¬äººä??€å¾—ç?æ³•è?å®šï?è­‰æ?ä»¥ä?å¡«å ±äº‹é??‡ç¢ºå¯¦ç„¡è¨›ã€‚æœ¬è¡¨ä?ä¾æ?å¾—ç?æ³•ç¬¬?ä?æ¢ç¬¬ä¸€?…ç¬¬ä¸€æ¬¾è?å®šç”³?±å?ç¨…é?ä¹‹ç”¨?‚å??˜äººå¡«å ±ä¹‹å??¶é?è¦ªå±¬ï¼Œå…¶èº«å??é?ä¿‚ã€ç??¥å??€å¾—ç?æ³ç?ï¼Œå??‰ä?å¯¦ã€é?è¤‡ç”³?±ï?é¡˜è‡ªè² æ?å¾‹è²¬ä»»ã€?                </p>
                <div className="flex justify-between items-center pt-2 font-sans text-xs">
                  <div className="space-y-1">
                    <div>?³å ±?—é?äººï?<span className="font-bold border-b border-stone-800 px-4 min-w-[120px] inline-block text-center">{p.name || OnboardEmployee.name}</span> (ç°½ç?)</div>
                    <div>èº«å?è­‰è?ï¼?span className="font-mono tracking-wider">{p.idNumber || 'å¾…è?å¡?}</span></div>
                  </div>
                  <div className="text-right">
                    <div>ä¸­è¯æ°‘å? <span className="font-mono">{rocYear}</span> å¹?<span className="font-mono">{rocMonth}</span> ??<span className="font-mono">{rocDay}</span> ??/div>
                    <div className="text-[10px] text-stone-500 mt-1">
                      {tax.signed ? 'ï¼ˆå·²å®Œæ?ç·šä??¸ä?ç°½ç½²ç¢ºè?ï¼? : 'ï¼ˆå??¸ä?ç°½ç½²ï¼?}
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Page Footer */}
            <div className="flex justify-between items-center text-[9px] text-stone-400 border-t border-stone-200 pt-3">
              <span>?²æ?è§€?‰é???HR äººä??±åˆ°ç³»çµ±</span>
              <span>ç¬¬ä???(?±ä???</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
  );
}

export function ContractPrintModal({ OnboardEmployee, onClose }: { OnboardEmployee: OnboardEmployee; onClose: () => void }) {
  const companyDetails = getCompanyDetails(OnboardEmployee);
  const p = (OnboardEmployee.personalData || {}) as PersonalData;
  
  const dObj = OnboardEmployee.onboardDate ? new Date(OnboardEmployee.onboardDate) : (OnboardEmployee.updatedAt ? new Date(OnboardEmployee.updatedAt) : new Date());
  const rocYear = isNaN(dObj.getTime()) ? 115 : dObj.getFullYear() - 1911;
  const rocMonth = isNaN(dObj.getTime()) ? 6 : dObj.getMonth() + 1;
  const rocDay = isNaN(dObj.getTime()) ? 15 : dObj.getDate();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm p-4 md:p-8 flex items-start justify-center print-modal-overlay">
      <div className="bg-stone-50 max-w-4xl w-full rounded-2xl shadow-2xl border border-stone-200 overflow-hidden my-4 text-left print-modal-card">
        
        {/* Header - strictly non-printing */}
        <div className="bg-stone-900 text-[#D4AF37] px-6 py-4 flex items-center justify-between sticky top-0 z-10 border-b border-[#D4AF37]/30 no-print-el">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-stone-850 flex items-center justify-center border border-[#D4AF37]/20 font-serif text-[#D4AF37] font-bold text-lg">
              ç´?            </div>
            <div>
              <h3 className="text-sm font-bold text-white">?–¨ï¸??˜åƒ±?ˆç????—å°?è¦½</h3>
              <p className="text-[10px] text-stone-400">ç¬¦å??åŸºæ³•è?ç¯„ä?æ­???˜åƒ±?å?å¥‘ç? (?®é?æµå??ˆé¢)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-5 py-1.5 bg-[#8D1B1B] hover:bg-[#A32222] text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              ?—å° ???¦å???PDF
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
          <span className="shrink-0 bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded text-[10px] font-bold">èªªæ?</span>
          <p>è«‹é??Šå³ä¸Šæ–¹<strong>?Œå??????¦å???PDF??/strong>?‚åœ¨?—å°å°è©±æ¡†ä¸­å°‡ç›®æ¨™å°è¡¨æ??¸æ???strong>?Œå¦å­˜ç‚º PDF / Save as PDF??/strong>ï¼Œä¸¦?™å??‹å?<strong>?Œè??¯å?å½?Background graphics??/strong>??/p>
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
                    ??????ç´???                  </h2>
                </div>

                {/* Contracting Parties Row */}
                <div className="flex justify-between items-center text-xs font-semibold text-stone-900 mb-8 border-b border-stone-200 pb-4">
                  <div>
                    ç«‹å?ç´„äººï¼?strong className="text-stone-950 border-b border-stone-800 px-3 tracking-wider text-sm">{companyDetails.name}</strong>ï¼ˆä»¥ä¸‹ç°¡ç¨±ç”²?¹ï?
                  </div>
                  <div>
                    ç«‹å?ç´„äººï¼?strong className="text-indigo-800 border-b border-stone-800 px-3 tracking-wider text-sm">{p.name || OnboardEmployee.name}</strong>ï¼ˆä»¥ä¸‹ç°¡ç¨±ä??¹ï?
                  </div>
                </div>

                <p className="text-xs font-semibold text-stone-900 mb-6 bg-[#FAF6F0] p-3 rounded-lg border border-dashed border-[#8D1B1B]/15 leading-relaxed">
                  ?²å??²æ–¹?±ç”¨ä¹™æ–¹?ºå“¡å·¥ï??™æ–¹?Œæ?è¨‚ç??¬å?ç´„ï??±å??µå?ç´„å?æ¢æ¬¾å¦‚ä?ï¼?                </p>

                <ol className="space-y-4 text-xs text-stone-800">
                  <li>
                    <strong className="text-stone-950 text-sm font-bold block mb-1">ä¸€?å?ç´„æ??“å?è©¦ç”¨?Ÿï?</strong>
                    ?¬å?ç´„è‡ªä¸­è¯æ°‘å? <span className="font-mono font-bold text-stone-950 border-b border-stone-800 px-1">{rocYear}</span> å¹?<span className="font-mono font-bold text-stone-950 border-b border-stone-800 px-1">{rocMonth}</span> ??<span className="font-mono font-bold text-stone-950 border-b border-stone-800 px-1">{rocDay}</span> ?¥èµ·?‚è©¦?¨æ??“ç‚º <span className="font-bold border-b border-stone-800 px-2 bg-stone-50">{OnboardEmployee.contractProbationMonths || 'ä¸?}</span> ?‹æ?ï¼Œè©¦?¨æ??“å??¨æ?çµ‚æ­¢å¥‘ç?ï¼Œè©¦?¨æ?æ»¿è€ƒæ ¸ä¸å??¼è€…ï?ä¾å??ºæ?è¦å?è¾¦ç??‚ä??¹æ–¼è©¦ç”¨?Ÿé?å¦‚æ¬²?¢è·ï¼Œæ??¼ä??¥å??å??‚è‹¥?‰å?è¦ï?è©¦ç”¨?Ÿé??¯å?å»¶ä??Ÿã€?                  </li>

                  <li>
                    <strong className="text-stone-950 text-sm font-bold block mb-1">äºŒã€å·¥ä½œé??®ï?</strong>
                    ?”ä»» <strong>{OnboardEmployee.department || 'é¤é£²?å?'}</strong> ä¹?<strong>{OnboardEmployee.title || '?å?å°ˆå“¡'}</strong> å·¥ä???                  </li>

                  <li>
                    <strong className="text-stone-950 text-sm font-bold block mb-1">ä¸‰ã€å·¥ä½œè??‡ï?</strong>
                    ä¹™æ–¹?Œæ??µå??²æ–¹?¶å?ä¹‹å·¥ä½œè??‡å?è¦ç??¶åº¦??                  </li>

                  <li>
                    <strong className="text-stone-950 text-sm font-bold block mb-1">?›ã€å·¥ä½œåœ°é»ï?</strong>
                    ä¹™æ–¹?¥å???<span className="text-stone-950 font-bold border-b border-stone-800 px-2 bg-stone-50">{OnboardEmployee.contractWorkLocation || '?›å??’å? (?°å?) (?°å?å¸‚æ‰¿å¾·è·¯ä¸€æ®???'}</span> ?°æ–¹?”ä»»ç´„å?ä¹‹å·¥ä½œã€?                  </li>

                  <li>
                    <strong className="text-stone-950 text-sm font-bold block mb-1">äº”ã€å·¥ä½œè??›ï?</strong>
                    ?²æ–¹? ç?æ¥?or å·¥ä??€è¦ï?å¾—é©?¶æ´¾ä»»ã€å…¼ä»»ã€è?èª?or è¼ªèª¿ä¹™æ–¹?³å…¶ä»–ç­?¥ã€è·??or ?„åœ°?†æ”¯æ©Ÿæ?ï¼Œä??¹å??æ¥?—ç”²?¹ä?èª¿å???                  </li>

                  <li>
                    <strong className="text-stone-950 text-sm font-bold block mb-1">?­ã€å·¥ä½œæ??“ï?</strong>
                    ä¹™æ–¹?Œæ?æ¯æ—¥æ­?¸¸å·¥ä??‚é??ºä??¬å¸è¦å?ä¹‹èµ·è¿„æ??“è¾¦?†ï??›é€±è?å½¢å·¥?‚ç??ç?å½ˆæ€§é?ç½®ï???                    ?²æ–¹? æ¥­?™é?è¦ï?å¾—ä??åŸºæ³•è?å®šåœ¨ç¨‹å?å®Œå¡«ä¸¦æ??ºå?ç½®ç”³è«‹ä??’å?å»¶é•·å·¥æ?ï¼Œå»¶?‚å·¥è³‡ä?æ³•è?çµ¦ã€?                  </li>

                  <li>
                    <strong className="text-stone-950 text-sm font-bold block mb-1">ä¸ƒã€ä??‡æ?å®šï?</strong>
                    {(OnboardEmployee.contractLeaveOption || 'biweekly') === 'monthly' ? (
                      <p>
                        ä¾é??¹ç?å®šæ–¼ç¬¦å?æ³•ä»¤è¦å?ç¯„å??§ï??±ç”²?¹æ?å®šä??‡æ–¹å¼æ??’ä? <span className="text-stone-950 font-bold border-b border-stone-800 px-2 bg-stone-50 font-mono">{OnboardEmployee.contractLeavedays || '8-10'}</span> ?¥ã€?                        ä¸”å??ç”²?¹å?å°‡å¹´åº¦ä??‡æ—¥?å?å®šå??¥è??¶ä?å·¥ä??¥æŒªç§»ï??ªç§»å¾Œå·²?æ­£å¸¸å·¥ä½œæ—¥ï¼Œå‡º?¤ä??Ÿå??å·¥è³‡ã€?                      </p>
                    ) : (
                      <p>
                        ?¼ç¬¦?ˆæ?å®šå·¥ä½œæ??¸è??’ä?è¦å?ä¹‹å??ä?ï¼Œæ¡ <strong>?±ä?äºŒæ—¥??/strong>??                        ?²æ–¹? æ¥­?™é?è¦å?è¦æ?ä¹™æ–¹?å??¡æ??­æ?ä¼?or ?å?è¼ªç­?¹å?å·¥ä?ï¼Œä¸¦?Œæ??²æ–¹å¾—å?å¹´åº¦ä¼‘å??¥ã€å?å®šå??¥è??¶ä?å·¥ä??¥èª¿?´æŒªç§»ï??ªç§»å¾Œå·²?æ­£å¸¸å·¥ä½œæ—¥ï¼Œå‡º?¤ä??Ÿå??å·¥è³‡ã€?                      </p>
                    )}
                  </li>

                  <li>
                    <strong className="text-stone-950 text-sm font-bold block mb-1">?«ã€å·¥è³‡è­°å®šï?</strong>
                    æ¬¡æ? 5 ?¥ç‚º?¼è–ª??(?‡ä??‡æ—¥?‡æ??è‡³?ä?å·¥ä????‚è–ªè³‡ä?æ¥­æ¡?–ä?å¯†åˆ¶ï¼Œä?å¾—è?è«?or æ´©æ?ç¬¬ä??…ã€?                    {(OnboardEmployee.contractSalaryType || 'monthly') === 'monthly' && (
                      <p className="mt-1">
                        ?™æ–¹è­°å???strong>?ˆè–ª??/strong>ï¼Œæ??ˆè–ªæ´¥ç‚º?°å°å¹?<span className="text-stone-950 font-bold border-b border-stone-800 px-2 bg-stone-50 font-mono text-xs">{OnboardEmployee.contractSalaryAmount || '36,000'}</span> ?ƒã€?                      </p>
                    )}
                    {(OnboardEmployee.contractSalaryType || 'monthly') === 'daily' && (
                      <p className="mt-1">
                        ?™æ–¹è­°å???strong>?¥è–ª??/strong>ï¼Œæ??¥è–ªæ´¥ç‚º?°å°å¹?<span className="text-stone-950 font-bold border-b border-stone-800 px-2 bg-stone-50 font-mono text-xs">{OnboardEmployee.contractSalaryAmount || '1,800'}</span> ?ƒã€?                      </p>
                    )}
                    {(OnboardEmployee.contractSalaryType || 'monthly') === 'hourly' && (
                      <p className="mt-1">
                        ?™æ–¹è­°å???strong>?‚è–ª??/strong>ï¼Œæ?å°æ??ªè??ºæ–°?°å¹£ <span className="text-stone-950 font-bold border-b border-stone-800 px-2 bg-stone-50 font-mono text-xs">{OnboardEmployee.contractSalaryAmount || '190'}</span> ?ƒã€?                      </p>
                    )}
                  </li>

                  <li>
                    <strong className="text-stone-950 text-sm font-bold block mb-1">ä¹ã€æ™º?§è²¡?¢æ?ç´„å?ï¼?/strong>
                    <div className="space-y-1 pl-2">
                      <p>ï¼ˆä?ï¼?ä¹™æ–¹ç¢ºè??¼ä»»?·æ??“æ?ä¾›ä??å??è?è¨Šç??¡ä¾µå®³å?ä»»å…¬?¸æ??¶ä?ç¬¬ä?äººä??ºæ…§è²¡ç”¢æ¬Šã€ç?æ¥­ç?å¯?or ?‰å±¥è¡Œä?ä¿å?ç¾©å?ï¼ˆå??¬ä?ä¸é??¼ç«¶æ¥­ç?æ­¢ï???/p>
                      <p>ï¼ˆä?ï¼?ä¹™æ–¹ä¸¦ä?è­‰æ–¼ä»»è·?Ÿé??€?ä? or å®Œæ?ä¹‹æ™º?§è²¡?¢æ??œï??‡ä??±ä??¹è‡ªè¡Œå‰µä½œï?ä¸”ç??¡æ?è¥?or ä»¿å?ä»–äººä¹‹è?ä½œï?ä¸¦ç¢ºå¯¦å??ä?äººä??ºæ…§è²¡ç”¢æ¬Šã€?/p>
                      <p>ï¼ˆä?ï¼??¼ä»»?·æ??“ï??¼è·?™ä??€å®Œæ?ä¹‹è?ä½œï??Œæ?ä»¥ç”²??or ?¶ä»£è¡¨äºº?ºè?ä½œäººï¼Œç›¸?œä??—ä?äººæ ¼æ¬Šå??—ä?è²¡ç”¢æ¬Šç?æ­¸ç”²?¹è‡ªå§‹æ??‰ã€?/p>
                    </div>
                  </li>

                  <li>
                    <strong className="text-stone-950 text-sm font-bold block mb-1">?ã€ä?å¯†æ?æ¬¾ï?</strong>
                    ä¹™æ–¹ä¿è?ä»»è· or ?—åƒ±?”ç©¶?Ÿé?ä¸ä½¿?¨ã€åˆ©?¨ã€è?è£½ã€ä??™å??ƒè?å·¥ä?ä»»å??€?–å??çŸ¥?‰ä?ä»»ä?ç¶“ç?è³‡è??ç?æ¥­ç?å¯†ã€æ?å¯†æ?ä»¶ï?äº¦ä?ä»¥ä»»ä½•å½¢å¼ï??´æ¥ or ?“æ¥å°ç¬¬ä¸‰äººæ´©éœ²?ç§»è½?or è©•è?ï¼Œæ??ä?ç¬¬ä?äººä½¿?¨ã€‚é›¢?·å?äº¦è??‰ä?è¿°ä?å¯†ç¾©?™ï?ä¸¦å??æ–¼?¢è·?‚ç°½ç½²ã€Œé›¢?·ç”³è«‹å–®?ä¸­ä¹‹ä?å¯†ç›¸?œç?å®šã€‚å??‰é??è‡´?²æ–¹?¼ç??å¤±ï¼Œå??è??”è??Ÿè²¬ä»»ã€?                  </li>

                  <li>
                    <strong className="text-stone-950 text-sm font-bold block mb-1">?ä??å€‹è?ä¿è­·ï¼?/strong>
                    ä¹™æ–¹? è·?™æ??Šä??·å?æ¶‰å??Šè??†ã€è??†ã€åˆ©?¨å€‹äººè³‡æ?ä¹‹è??ºè€…ï?ä¹™æ–¹?”ä??µå¾ª?‘å??Œå€‹äººè³‡æ?ä¿è­·æ³•ã€å?æ­ç??Œè??™ä?è­·ä??¬è???General Data Protection Regulation, GDPR)?ç›¸?œè?å®šï?ä¸¦å??æªå®ˆè·è²¬éµå®ˆç”²?¹é??¼å€‹äººè³‡æ?ä¿è­·?€è¨‚å?ä¹‹ç›¸?œåˆ¶åº¦ã€è¾¦æ³•å??ªæ–½??                  </li>
                </ol>

                {/* Sigs Area */}
                <div className="grid grid-cols-2 gap-6 mt-8 border-t border-stone-300 pt-6 font-sans text-[10px] text-stone-600 leading-loose">
                  <div className="space-y-1">
                    <strong className="text-stone-900 text-xs font-bold block mb-1.5">?²æ–¹ (ç«‹å?ç´„äºº)</strong>
                    <div>?¬å¸?ç¨±ï¼š{companyDetails.name}</div>
                    <div>çµ±ä?ç·¨è?ï¼š{companyDetails.taxId}</div>
                    <div>è² è²¬äººï?{companyDetails.owner}</div>
                    <div>?¬å¸?°å?ï¼š{companyDetails.address}</div>
                  </div>
                  <div className="space-y-1 bg-stone-50/50 border border-stone-150 p-3 rounded-lg">
                    <strong className="text-stone-900 text-xs font-bold block mb-1.5">ä¹™æ–¹ (ç«‹å?ç´„äºº)</strong>
                    <div>ä¹™æ–¹å§“å?ï¼?strong className="text-[#8D1B1B] font-bold text-xs">{p.name || OnboardEmployee.name}</strong></div>
                    <div>èº«å?è­‰è?ï¼?span className="font-mono font-bold tracking-wider uppercase text-stone-950">{p.idNumber || 'å¾…è?å¡?}</span></div>
                    <div>?¾è¨­ä½å?ï¼?span className="truncate block" title={p.contactAddress || p.legalAddress || 'å¾…è?å¡?}>{p.legalAddress || p.contactAddress || 'å¾…è?å¡?}</span></div>
                    <div>ç°½ç½²?€?‹ï?{OnboardEmployee.contractSigned ? (
                      <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-150 px-1.5 py-0.5 rounded text-[9px] inline-block">
                        å·²å??ç?ä¸Šæ•¸ä½ç°½ç½?(?Ÿæ?)
                      </span>
                    ) : (
                      <span className="text-stone-500 font-bold">å¾…æ•¸ä½ç°½ç½?/span>
                    )}</div>
                    {OnboardEmployee.contractSigned && (
                      <div className="text-stone-400 mt-1">
                        ?¸ä??°é?å­˜æ??‚é?ï¼š{OnboardEmployee.contractDate}
                      </div>
                    )}
                  </div>
                </div>

                {/* Taiwan ROC custom date rendering */}
                <div className="text-right text-xs mt-8 pr-4 font-bold font-serif text-stone-800">
                  ç°½ç½²?¥æ?ï¼šä¸­?¯æ???<span className="font-mono tracking-wide">{rocYear}</span> å¹?<span className="font-mono tracking-wide">{rocMonth}</span> ??<span className="font-mono tracking-wide">{rocDay}</span> ??                </div>

              </div>

              <div className="flex justify-between items-center text-[9px] text-stone-400 border-t border-stone-200 pt-3">
                <span>?²æ?è§€?‰è‚¡ä»½æ??å…¬?¸ç?æ¬Šæ???/span>
                <span>ç¬¬ä???(?±ä???</span>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}

export function ConsentPrintModal({ OnboardEmployee, onClose }: { OnboardEmployee: OnboardEmployee; onClose: () => void }) {
  const companyDetails = getCompanyDetails(OnboardEmployee);
  const p = (OnboardEmployee.personalData || {}) as PersonalData;
  
  const dObj = OnboardEmployee.onboardDate ? new Date(OnboardEmployee.onboardDate) : (OnboardEmployee.updatedAt ? new Date(OnboardEmployee.updatedAt) : new Date());
  const rocYear = isNaN(dObj.getTime()) ? 115 : dObj.getFullYear() - 1911;
  const rocMonth = isNaN(dObj.getTime()) ? 6 : dObj.getMonth() + 1;
  const rocDay = isNaN(dObj.getTime()) ? 15 : dObj.getDate();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm p-4 md:p-8 flex items-start justify-center print-modal-overlay">
      <div className="bg-stone-50 max-w-4xl w-full rounded-2xl shadow-2xl border border-stone-200 overflow-hidden my-4 text-left print-modal-card">
        
        {/* Header - strictly non-printing */}
        <div className="bg-stone-900 text-[#D4AF37] px-6 py-4 flex items-center justify-between sticky top-0 z-10 border-b border-[#D4AF37]/30 no-print-el">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-stone-850 flex items-center justify-center border border-[#D4AF37]/20 font-serif text-[#D4AF37] font-bold text-lg">
              ??            </div>
            <div>
              <h3 className="text-sm font-bold text-white">?–¨ï¸??‹äººè³‡æ??ŠçŸ¥?Šå??æ›¸ ?—å°?è¦½</h3>
              <p className="text-[10px] text-stone-400">ç¬¦å??‹äººè³‡æ?ä¿è­·æ³•ç¬¬ 8 æ¢è?å®šä??™æ–¹?‹è?ä¿è­·?ŠçŸ¥??/p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-5 py-1.5 bg-[#8D1B1B] hover:bg-[#A32222] text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              ?—å° ???¦å???PDF
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
          <span className="shrink-0 bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded text-[10px] font-bold">èªªæ?</span>
          <p>è«‹é??Šå³ä¸Šæ–¹<strong>?Œå??????¦å???PDF??/strong>?‚åœ¨?—å°å°è©±æ¡†ä¸­å°‡ç›®æ¨™å°è¡¨æ??¸æ???strong>?Œå¦å­˜ç‚º PDF / Save as PDF??/strong>ï¼Œä¸¦?™å??‹å?<strong>?Œè??¯å?å½?Background graphics??/strong>??/p>
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
                    ?¡å·¥/?¢è©¦?…è??†ã€è??†å??©ç”¨?‹äººè³‡æ??ŠçŸ¥æ¢æ¬¾
                  </h2>
                </div>

                <div className="text-xs text-stone-850 space-y-4 font-sans text-justify leading-relaxed">
                  <p>
                    {companyDetails.name}ï¼ˆä?ç¨±ã€Œæœ¬?¬å¸?ï?ä¾å€‹äººè³‡æ?ä¿è­·æ³•ï?ä¸‹ç¨±?‹è?æ³•ï?ç¬?8 æ¢ç¬¬ 1 ?…è?å®šï????°ç«¯?ŠçŸ¥ä¸‹å?äº‹é?ï¼Œè??°ç«¯è©³é–±ï¼?                  </p>

                  <div className="space-y-2">
                    <span className="block font-bold text-stone-950 text-[13px] border-l-4 border-stone-850 pl-2 font-serif">ä¸€???é?ä¹‹ç›®?„ï?</span>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] text-stone-800 bg-stone-50 p-3 rounded-lg border border-stone-100 font-sans">
                      <div>?‹ä? äººä?ç®¡ç?ï¼ˆå??«åŸº?¬è?è¨Šã€è€ƒç¸¾?è–ªè³‡ã€æ?ä¿è?ç¦åˆ©ç­‰ï?</div>
                      <div>?‹ä? ?¨æ??¥åº·ä¿éšª?Šå?å·¥ä???/div>
                      <div>?‹ä? å­˜æ¬¾?‡åŒ¯æ¬?/div>
                      <div>?‹å? å¥‘ç??é?ä¼¼å?ç´„æ??¶ä?æ³•å??œä?äº‹å?</div>
                      <div>?‹ä? ?´æ??²å‡ºå®‰å…¨ç®¡ç?</div>
                      <div>?‹å…­ ç¨…å?è¡Œæ”¿</div>
                      <div>?‹ä? ?ƒè??‡ç›¸?œæ???/div>
                      <div>?‹å…« è³???è¨Šè?è³‡æ?åº«ç®¡??/div>
                      <div>?‹ä? è³‡é€šå??¨è?ç®¡ç?</div>
                      <div>ä¸€???±ç”¨?‡æ??™ç®¡??/div>
                      <div>ä¸€ä¸€ è§€?‰æ?é¤¨æ¥­?æ?é¤¨æ¥­ç¶“ç?ç®¡ç?æ¥­å?</div>
                      <div>ä¸€äº??¶ä?ç¶“ç??ˆæ–¼?Ÿæ¥­?»è?ä¹‹æ¥­??/div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="block font-bold text-stone-950 text-[13px] border-l-4 border-stone-850 pl-2 font-serif">äºŒã€??é?ä¹‹å€‹äººè³‡æ?é¡åˆ¥ï¼?/span>
                    <p className="text-[11px] text-stone-600 font-sans">?¬å…¬?¸è??…æ??€?€ï¼Œè??†ç??¡å·¥?‹è?ç¯„ç??…å«ä½†ä??æ–¼ä»¥ä?é¡åˆ¥ï¼?/p>
                    <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-[10px] text-stone-700 bg-stone-50/50 p-3 rounded-lg border border-stone-100 font-sans">
                      <div>?‹ä? è¾¨è??‹äºº??(å§“å??é›»è©±ç?)</div>
                      <div>?‹ä? è¾¨è?è²¡å???(?€è¡Œå¸³??</div>
                      <div>?‹ä? ?¿å?è³‡æ?ä¸­ä?è¾¨è???/div>
                      <div>?‹å? ?‹äºº?è¿° (?Ÿæ—¥?æ€§åˆ¥)</div>
                      <div>?‹ä? èº«é??è¿° (è¡€?‹ç?)</div>
                      <div>?‹å…­ ?‹æ€?/div>
                      <div>?‹ä? å®¶åº­?…å½¢</div>
                      <div>?‹å…« å®¶åº­?¶ä??å“¡ä¹‹ç´°ç¯€</div>
                      <div>?‹ä? ?¶ä?ç¤¾æ??œä?</div>
                      <div>ä¸€??ä½å®¶?Šè¨­??(?¯çµ¡?°å?)</div>
                      <div>ä¸€ä¸€ ?·æ¥­</div>
                      <div>ä¸€äº??·ç…§?–å…¶ä»–è¨±??/div>
                      <div>ä¸€ä¸?å­¸æ ¡ç´€??(å­¸æ­·)</div>
                      <div>ä¸€??è³‡æ ¼?–æ?è¡?(è­‰ç…§)</div>
                      <div>ä¸€äº??¾è?ä¹‹å??±æ?å½?/div>
                      <div>ä¸€???±ç”¨ç¶“é?</div>
                      <div>ä¸€ä¸??¢è·ç¶“é?</div>
                      <div>ä¸€??å·¥ä?ç¶“é?</div>
                      <div>ä¸€ä¹?å·¥ä??å·®?¤ç???/div>
                      <div>äºŒâ? ?¥åº·?‡å??¨ç???/div>
                      <div>äºŒä? ?ªè??‡é???¬¾</div>
                      <div>äºŒä? ?—åƒ±äººæ??æ?ä¹‹è²¡??/div>
                      <div>äºŒä? å·¥ä?ç®¡ç?ä¹‹ç´°ç¯€</div>
                      <div>äºŒå? å·¥ä?ä¹‹è?ä¼°ç´°ç¯€</div>
                      <div>äºŒä? ?—è?ç´€??/div>
                      <div>äºŒå…­ å®‰å…¨ç´°ç?</div>
                      <div>äºŒå…« ç¤¾æ?ä¿éšªç­‰é€€ä¼‘çµ¦ä»?/div>
                      <div>äºŒä? ç´„å??–å?ç´?/div>
                      <div>ä¸‰â? ?‡ç?æ¥­æ??œä??·ç…§</div>
                      <div>ä¸‰ä? ?¥åº·ç´€??/div>
                      <div>ä¸‰ä? ?¯ç½ªå«Œç?è³‡æ?</div>
                      <div>ä¸‰ä? ?¸é¢?‡ä»¶ä¹‹æª¢ç´?/div>
                      <div>ä¸‰å? ?ªå?é¡ä?è³‡æ?ç­?/div>
                    </div>
                  </div>

                  <div className="space-y-3 font-sans text-justify leading-relaxed">
                    <div className="space-y-1">
                      <span className="block font-bold text-stone-950 text-[12px] font-serif">ä¸‰ã€??‹äººè³‡æ??©ç”¨ä¹‹æ??“ã€åœ°?€?å?è±¡å??¹å?ï¼?/span>
                      <p className="text-[11px] text-stone-800 pl-2">
                        <strong>?‹ä? ?Ÿé?ï¼?/strong>?‹äººè³‡æ??é?ä¹‹ç‰¹å®šç›®?„å?çºŒæ???/ ä¾ç›¸?œæ?ä»¤æ?å¥‘ç?ç´„å?ä¹‹ä?å­˜å¹´?ï?å¦‚ï??åŸºæº–æ?ç­‰ï?/ ?¬å…¬?¸ç??‹æ¥­?™æ?å¿…é?ä¹‹æ??“ã€?br />
                        <strong>?‹ä? ?°å?ï¼?/strong>?¬å??æœ¬?¬å¸æµ·å??†æ”¯æ©Ÿæ??€?¨åœ°?æœ¬?¬å¸å§”å??–æ?æ¥­å?å¾€ä¾†ç??Ÿè??€?€?¨åœ°??br />
                        <strong>?‹ä? å°è±¡ï¼?/strong>?¬å…¬?¸ã€é?ä¿‚é€??ä¼æ¥­?å?è¨—è??†æ¥­?™ä?ç¬¬ä?äººã€ä?æ³•æ?èª¿æŸ¥æ¬Šæ??œå??¸æ?æ©Ÿé???br />
                        <strong>?‹å? ?¹å?ï¼?/strong>ä»¥è‡ª?•å?æ©Ÿå™¨?–å…¶ä»–é??ªå??–ä?ç¬¦å?å®‰å…¨ä¿è­·è¦ç?ä¹‹å??†åˆ©?¨æ–¹å¼ã€?                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="block font-bold text-stone-950 text-[12px] font-serif">?›ã€?ä¾å€‹è?æ³•ç¬¬ 3 æ¢è?å®šï??°ç«¯å¾—è?ä½¿ä??—æ??©ï?</span>
                      <p className="text-[11px] text-stone-800 pl-2">
                        ?‹ä? å¾—å??¬å…¬?¸æŸ¥è©¢ã€è?æ±‚é–±è¦½æ?è«‹æ?è£½çµ¦è¤‡è£½?¬ï?å¾—é??¶å·¥?¬è²»ï¼‰ã€?br />
                        ?‹ä? å¾—å??¬å…¬?¸è?æ±‚è??…æ??´æ­£??br />
                        ?‹ä? å¾—å??¬å…¬?¸è?æ±‚å?æ­¢è??†ã€è??†ã€åˆ©?¨æ?è«‹æ??ªé™¤ï¼ˆæ?ä¾å??•æ?è¦æ?æ¥­å?å¿…é??…ä??¨æ­¤?ï???                      </p>
                    </div>

                    <div className="space-y-1 text-[11px] text-stone-600 italic bg-stone-50 p-2 border border-stone-150 rounded">
                      ?¬å…¬?¸å??ç?ç§‰æ?å°å°ç«¯å€‹äººè³‡æ?ä¿è­·?„é?è¦–ï?ä¸¦æ–¼?–å??¨å€‹äººè³‡æ?ï¼Œç›´?³æ‚¨?¬äººå°?{companyDetails.name} ?å‡º?³è?è«‹æ??œæ­¢?é??è??†ã€åˆ©?¨æ??ªé™¤?‹è?æ­¢ã€?                    </div>

                    <div className="space-y-1">
                      <span className="block font-bold text-stone-950 text-[12px] font-serif">äº”ã€??°ç«¯ä¸æ?ä¾›å€‹äººè³‡æ??€?´æ??Šä?å½±éŸ¿ï¼?/span>
                      <p className="text-[11px] text-stone-800 pl-2">
                        ?°ç«¯å¾—è‡ª?±é¸?‡æ˜¯?¦æ?ä¾›ï??Ÿè‹¥?’ç??ä?ï¼Œæœ¬?¬å¸å°‡ç„¡æ³•é€²è?å¿…è?ä¹‹å¯©?¸ã€å·®?¤å??¥ä??•ä?ä½œæ¥­ç­‰æ–°?²äºº?¡é€²ç”¨?±åˆ°æµç?ï¼Œé€²è€Œå¯?½å½±?¿æ‚¨ä¹‹æ??Šã€?                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="block font-bold text-stone-950 text-[12px] font-serif">?­ã€?ä¿®è?æ¢æ¬¾ä¹‹å??¥ï?</span>
                      <p className="text-[11px] text-stone-800 pl-2">
                        ?¬å…¬?¸æ?æ¬Šä¿®è¨‚æœ¬?ŠçŸ¥æ¢æ¬¾ï¼Œä¸¦å¾—ä»¥?¸é¢?ç°¡è¨Šã€é›»å­éƒµä»¶ã€å?ç¶²é€???–å…¶ä»–è¶³ä»¥ä½¿?°ç«¯?¥æ?ä¹‹æ–¹å¼å??å??¥ã€?                      </p>
                    </div>

                    <div className="pt-1.5 border-t border-dashed border-stone-300">
                      <p className="font-bold text-[11px] text-stone-950 bg-stone-100 p-3 rounded-lg leading-relaxed text-justify mb-2 font-serif text-stone-900">
                        ç¶“å…¬?¸å??¬äºº?ŠçŸ¥ä¸Šé?äº‹é?ï¼Œå¡«å¯«æœ¬?¡å·¥/?¢è©¦?…è??†ã€è??†å??©ç”¨?‹äººè³‡æ??ŠçŸ¥æ¢æ¬¾?Šç›¸?œå€‹äººè³‡æ?æ¬„ä??³å???<strong>{companyDetails.name}</strong> ?Šå…¶å­å…¬?¸å??œè¯ä¼æ¥­?€ç¶“ç??ç‰¹è¨±ç??Ÿä»¥?Šç?è³ƒç??’å?ï¼Œæ??€å§”æ´¾ç¬¬ä?äººè?ç½®ç›¸?œå€‹è?æ¡ˆä»¶?‚æœ¬äººå·²æ¸…æ??­è§£è²´å…¬?¸è??†ã€è??†æ??©ç”¨?¬å€‹äººè³‡æ?ä¹‹ç›®?„å??¨é€”ã€?                      </p>
                    </div>

                    <div className="border border-stone-300 p-4 rounded-xl bg-stone-50/50 space-y-3">
                      <div className="font-semibold text-stone-950 border-b border-stone-200 pb-1.5 text-xs font-serif">?å€‹è??é??Œæ?äººå??¨ç¢ºèªç°½ç« æ???/div>
                      <div className="flex justify-between items-center text-xs">
                        <div>
                          ?—å??¥äººç°½å?ï¼?                          <span className="text-[#8D1B1B] font-bold tracking-wider text-sm border-b border-stone-850 px-4 py-0.5 ml-1 bg-white font-serif inline-block min-w-[125px] text-center">
                            {p.name || OnboardEmployee.name}
                          </span>
                        </div>
                        <div>
                          {OnboardEmployee.privacyAgreed ? (
                            <span className="text-emerald-700 font-semibold bg-emerald-50 border border-emerald-150 px-2.5 py-0.5 rounded flex items-center gap-1 inline-flex">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> ç·šä?èªè?å·²ç°½ç½²å???                            </span>
                          ) : (
                            <span className="text-amber-700 font-semibold bg-amber-50 border border-amber-100 px-2.5 py-0.5 rounded inline-flex">
                              å¾…æ ¸å°ç°½ç½?                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-xs pt-1.5 font-bold font-serif text-stone-850">
                        ä¸­è¯æ°‘å? <span className="font-mono">{rocYear}</span> å¹?<span className="font-mono">{rocMonth}</span> ??<span className="font-mono">{rocDay}</span> ??                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center text-[9px] text-stone-400 border-t border-stone-200 pt-3 mt-8 font-sans">
                <span>{companyDetails.name} ?ˆæ??€???€ ?‹è??Šéš±ç§å??¨ç®¡?†ç??¸å?</span>
                <span>?‹äººè³‡æ??ŠçŸ¥æ¢æ¬¾</span>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
export function GuarantorPrintModal({ OnboardEmployee, onClose }: { OnboardEmployee: OnboardEmployee; onClose: () => void }) {
  const companyDetails = getCompanyDetails(OnboardEmployee);
  const p = OnboardEmployee.personalData || {} as any;
  const g = OnboardEmployee.guarantorData || {
    guarantorName: '', birthday: '', idNumber: '', address: '', phone: '',
    companyName: '', companyTitle: '', companyAddress: '', companyPhone: '', relationship: '', validUntil: ''
  };

  const dObj = OnboardEmployee.onboardDate ? new Date(OnboardEmployee.onboardDate) : (OnboardEmployee.updatedAt ? new Date(OnboardEmployee.updatedAt) : new Date());
  const rocYear = isNaN(dObj.getTime()) ? 115 : dObj.getFullYear() - 1911;
  const rocMonth = isNaN(dObj.getTime()) ? 6 : dObj.getMonth() + 1;
  const rocDay = isNaN(dObj.getTime()) ? 15 : dObj.getDate();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm p-4 md:p-8 flex items-start justify-center print-modal-overlay">
      <div className="bg-stone-50 max-w-4xl w-full rounded-2xl shadow-2xl border border-stone-200 overflow-hidden my-4 text-left print-modal-card">
        
        {/* Header - strictly non-printing */}
        <div className="bg-stone-900 text-[#D4AF37] px-6 py-4 flex items-center justify-between sticky top-0 z-10 border-b border-[#D4AF37]/30 no-print-el">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-stone-850 flex items-center justify-center border border-[#D4AF37]/20">
              <Printer className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">?–¨ï¸??·å“¡ä¿è????—å°?è¦½</h3>
              <p className="text-[10px] text-stone-400">ç¬¦å? A4 æ¨™æ??¼å?ï¼Œå…±è¨ˆä??ç??·å“¡?ºæœ¬è³‡æ??¡è?äººä??¯ä??®ï??¯ç›´?¥å??°æ??²å???PDF</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-5 py-1.5 bg-[#8D1B1B] hover:bg-[#A32222] text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              ?—å° ???¦å???PDF
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
            
            {/* PAGE 1: ?ºæœ¬è³‡æ? */}
          <div className="bg-white print-page-a4 shadow-lg w-[794px] h-[1123px] p-[60px] flex flex-col justify-between text-stone-900 border border-stone-300 relative">
            <div className="space-y-8">
              <div className="flex justify-between items-center text-sm font-serif h-5">
              </div>

              <div className="text-center pt-8">
                <h1 className="text-2xl font-bold tracking-[8px] text-stone-950 font-serif leading-relaxed">
                  {companyDetails.name}
                </h1>
                <h2 className="text-xl font-bold tracking-[12px] text-stone-950 font-serif mt-2 border-b-2 border-stone-800 pb-6">
                  ?·å“¡ä¿è???                </h2>
              </div>

              <div className="text-right text-xs pr-4 font-serif text-stone-800">
                é¤¨åˆ¥ï¼?span className="border-b border-stone-400 px-8 font-bold">
                  {(() => {
                    const loc = OnboardEmployee.contractWorkLocation ? OnboardEmployee.contractWorkLocation.split(' (')[0] : (OnboardEmployee.department ? OnboardEmployee.department : '?°å??›å?');
                    return (loc === '?²æ?è§€?? || loc === '?²æ?è§€?‰è‚¡ä»½æ??å…¬??) ? 'ç¸½å…¬?? : loc;
                  })()}
                </span>
              </div>

              <div className="pt-8 space-y-6 text-sm font-serif text-stone-900 leading-[3rem]">
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex border-b border-stone-400 pb-2">
                    <span className="w-40 font-bold">è¢«ä?è­‰äººï¼?/span>
                    <span className="font-bold text-indigo-700 px-2">{p.name || OnboardEmployee.name}</span>
                  </div>
                  <div className="flex border-b border-stone-400 pb-2">
                    <span className="w-40 font-bold">?§ã€€?€?¥ï?</span>
                    <span>{p.gender || '??}</span>
                  </div>
                  <div className="flex border-b border-stone-400 pb-2">
                    <span className="w-40 font-bold">ç±ã€€?€è²«ï?</span>
                    <span>?°å?å¸?/span>
                  </div>
                  <div className="flex border-b border-stone-400 pb-2">
                    <span className="w-40 font-bold">?ºç?å¹´æ??¥ï?</span>
                    <span>{formatToRocDate(p.birthday)}</span>
                  </div>
                  <div className="flex border-b border-stone-400 pb-2">
                    <span className="w-40 font-bold">?¶ç??°å?ï¼?/span>
                    <span className="text-xs">{p.legalAddress || '?ªå¡«å¯?}</span>
                  </div>
                  <div className="flex border-b border-stone-400 pb-2">
                    <span className="w-40 font-bold">?šè??°å?ï¼?/span>
                    <span className="text-xs">{p.contactAddress || '?ªå¡«å¯?}</span>
                  </div>
                  <div className="flex border-b border-stone-400 pb-2">
                    <span className="w-40 font-bold">?¯çµ¡?»è©±ï¼?/span>
                    <span className="font-mono">{p.phone || OnboardEmployee.email}</span>
                  </div>
                  <div className="flex border-b border-stone-400 pb-2">
                    <span className="w-40 font-bold">?°è·?¥æ?ï¼?/span>
                    <span>{formatToRocDate(OnboardEmployee.onboardDate)}</span>
                  </div>
                  <div className="flex border-b border-stone-400 pb-2">
                    <span className="w-40 font-bold">ä»»è·?®ä??è·ç¨±ï?</span>
                    <span>{OnboardEmployee.department || 'é¤é£²?å?'} / {OnboardEmployee.title}</span>
                  </div>
                  <div className="flex border-b border-stone-400 pb-2">
                    <span className="w-40 font-bold">?¡å·¥ç·¨è?ï¼?/span>
                    <span className="font-mono">{OnboardEmployee.empId || 'å¾…æ ¸??}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-center text-xs text-stone-400 font-sans border-t border-stone-150 pt-4">
              ç¬¬ä???(?±ä???
            </div>
          </div>

          {/* PAGE 2: ç«‹ä?è­‰æ›¸??*/}
          <div className="bg-white print-page-a4 shadow-lg w-[794px] h-[1123px] p-[60px] flex flex-col justify-between text-stone-900 border border-stone-300 relative">
            <div className="space-y-6">
              <div className="flex justify-between items-center text-sm font-serif h-5">
              </div>

              <div className="pt-6">
                <h3 className="text-lg font-bold font-serif text-stone-950 border-b border-stone-300 pb-3">ç«‹ä?è­‰æ›¸äººè²?æ›¸</h3>
              </div>

              <p className="text-sm leading-relaxed font-serif text-stone-800 text-justify indent-8 pt-4">
                ç«‹ä?è­‰æ›¸äººèŒ²ä¿è? <strong className="text-stone-950 border-b border-stone-850 px-2 text-base">{p.name || OnboardEmployee.name}</strong> ?›åœ¨è²´å…¬?¸æ?ä»»è·?™æ??“ï??µå?è²´å…¬?¸æ?è¨‚å?ä¹‹ä??‡è?ç« ï??˜æ??•è??…ä??–ä¾µä½”å…¬æ¬¾ã€è²¡?©å??¶ä??±å®³?¬å¸è¡Œç‚ºï¼Œè‡´?å®³?¼è²´?¬å¸?‚ï??¤è¢«ä¿è?äººæ??—æ?å¾‹åˆ¶è£å??¬å¸?•å?å¤–ï?ä¿è?äººå??æ”¾æ£„å?è¨´æ?è¾¯æ?ï¼Œå?è¢«ä?è­‰äººä¹‹å‚µ?™è?å®Œå…¨è³ å?è²¬ä»»?‚ä¸¦å±¥è??¬ä?è­‰æ›¸å¾Œå??Œä?è­‰è?ç´„ã€ä?è¦å???              </p>

              <div className="py-6 text-sm font-bold font-serif text-stone-900">
                æ­¤è‡´
              </div>
              <div className="text-lg font-bold font-serif text-stone-950 pl-8 pb-4">
                {companyDetails.name} é¤?              </div>

              <div className="border border-stone-400 p-4 rounded-xl bg-stone-50/50 text-xs font-serif leading-loose grid grid-cols-2 gap-x-6 gap-y-2.5">
                <div className="col-span-2 border-b border-stone-200 pb-1 font-bold text-stone-950 flex justify-between">
                  <span>ä¿è?äººè?è¢«ä?è­‰äºº?œä?æ¬?/span>
                  {OnboardEmployee.guarantorSigned && (
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] border border-emerald-200">
                      ??å·²å??ç?ä¸Šè¯ä¿è?è­?                    </span>
                  )}
                </div>
                <div>è¢«ä?è­‰äººå§“å?ï¼?strong className="text-stone-950 text-sm border-b border-stone-300 px-4 inline-block min-w-[100px]">{p.name || OnboardEmployee.name}</strong>ï¼ˆç°½ç« ï?</div>
                <div>ä¿è?äººå??ï?<strong className="text-indigo-700 text-sm border-b border-stone-300 px-4 inline-block min-w-[100px]">{g.guarantorName || '?ªç°½å±?}</strong>ï¼ˆç°½ç« ï?</div>
                <div>?ºç?å¹´æ??¥ï?<span>{formatToRocDate(g.birthday)}</span></div>
                <div>èº«å?è­‰å??Ÿï?<span className="font-mono tracking-wider">{g.idNumber || '?ªç°½å±?}</span></div>
                <div className="col-span-2">?¾ä??°å?ï¼?span>{g.address || '?ªç°½å±?}</span></div>
                <div>?¯çµ¡?»è©±ï¼?span className="font-mono">{g.phone || '?ªç°½å±?}</span></div>
                <div>?œä?ï¼?span className="font-bold">{g.relationship || '?¯ä?äº?}</span></div>
                <div>?å?æ©Ÿæ??·ä?ï¼?span>{g.companyName || '??}({g.companyTitle || '??})</span></div>
                <div>?å?æ©Ÿæ??°å?ï¼?span>{g.companyAddress || '??}</span></div>
                <div>æ©Ÿæ??»è©±ï¼?span className="font-mono">{g.companyPhone || '??}</span></div>
                <div>ä¿è??Ÿé??³ï?<span>{g.validUntil ? formatToRocDate(g.validUntil) : ' 116 å¹?12 ??31 ??}</span> ?ºæ­¢</div>
                <p className="col-span-2 text-[10px] text-stone-500 italic mt-1 leading-normal">
                  (ä¿è?äººå??¼è¢«ä¿è?äººä?è­‰æ??“å…§ä¹‹ä??ºï?ä»è?å®Œå…¨?¯å¸¶ä¿è?è²¬ä»»??
                </p>
              </div>
            </div>
            <div className="text-center text-xs text-stone-400 font-sans border-t border-stone-150 pt-4">
              ç¬¬ä???(?±ä???
            </div>
          </div>

          {/* PAGE 3: ä¿è?è¦ç? */}
          <div className="bg-white print-page-a4 shadow-lg w-[794px] h-[1123px] p-[60px] flex flex-col justify-between text-stone-900 border border-stone-300 relative">
            <div className="space-y-6">
              <div className="flex justify-between items-center text-sm font-serif h-5">
              </div>

              <div className="text-center pt-4">
                <h3 className="text-base font-bold font-serif text-stone-950 tracking-widest border-b border-stone-800 pb-4">
                  ä¿?è­?è¦?ç´?                </h3>
              </div>

              <div className="text-xs leading-relaxed font-serif text-stone-850 space-y-4 text-justify pl-4 pr-2">
                <p>ä¸€?å‡¡?¼æœ¬?¬å¸ç¶“æ?ç®¡ç??¾é?äººå“¡?–æ?ä»»è²¡?™ã€ç¸½?™ã€æ¡è³¼ä??·å·¥?¼é€šçŸ¥ä»»ç”¨å¾Œè€Œè¾¦?†å ±?°æ?çºŒå?ï¼Œæ?è¦“å¹´æ»¿ä??æ­²ä»¥ä??‰æ­£?¶è·æ¥­å??ºå?ä½æ?ä¹‹å€‹äºº?ºä?è­‰äºº??/p>
                <p>äºŒã€ä??—äºº?¡ï?ä¸å??ºä?è­‰äººï¼?br />
                  <span className="pl-6 block">ï¼‘ï?è¢«ä?è­‰äººä¹‹é??¶ã€?/span>
                  <span className="pl-6 block">ï¼’ï??¬å…¬?¸å?ä»ã€?/span>
                </p>
                <p>ä¸‰ã€ä?è­‰äººå¦‚æ¬²?€ä¿ï??‰ä»¥?¸é¢?šçŸ¥?¬å…¬?¸ï?ä¿Ÿè¢«ä¿è?äººè¾¦å¦¥æ?ä¿æ?çºŒå?ï¼Œä?è­‰äºº?¹å??¤ä?è­‰äººè²¬ä»»??/p>
                <p>?›ã€è¢«ä¿è?äººæ?ä»»è·?™å??‰è??´æ?èª¿é·?…ä?ï¼Œæœ¬ä¿è??¸ä?å±¬æ??ˆï?ä¸”æœ¬?¬å¸å°‡æ›¸?¢é€šçŸ¥ä¿è?äººã€‚ä?ä¿è?äººä?ä½å??‰è??´æ?ï¼Œæ??±è¢«ä¿è?äººéš¨?‚é€šçŸ¥?¬å…¬?¸ã€?/p>
                <p>äº”ã€è¢«ä¿è?äººé›¢?·å?ï¼Œå??¼ç¾?¨è·?Ÿé??‰é??è?ç« æ??§æ??¬æ¬¾?ä¾µ?è²¡?©æ??¶ä?ä¸æ??…ä??‰ç”±è¢«ä?è­‰äººè² è²¬?‚ï?ä¿è?äººä?å¾—æ¨?¸å…¶ä¿è?è²¬ä»»??/p>
                <p>?­ã€æœ¬?¬å¸å¾—éš¨?‚å?ä¿è?äººæŸ¥å°ã€?/p>
                <p>ä¸ƒã€ä?è­‰äºº?‡æ??å??–æœ¬?¬å¸èªç‚ºä¸é©?¶æ?ï¼Œè¢«ä¿è?äººæ??¼ä??‹æ??§å¦è¦“ä?è­‰äººï¼Œå¦?‡æ??¥å??Šå??å…¬?¸è·?™èª¿?›ã€?/p>
                <p>?«ã€ä?è­‰äºº?‰éš¨?Œæœ¬ä¿è??¸ï?äº¤ä?èº«ä»½è­‰å½±?¬ä?ä»½ï?ä»¥ä¿¾?¸å???/p>
                <p>ä¹ã€æœ¬ä¿è??¸æ?å¡«å¯«äºŒä»½ï¼Œä?ä»½é€æœ¬?¬å¸äººä??®ä?ï¼Œä?ä»½ç”±ä¿è?äººç?å­˜ã€?/p>
              </div>

              <div className="pt-20 text-right text-sm font-bold font-serif tracking-widest pr-4">
                ä¸­è¯æ°‘å? {rocYear} å¹?{rocMonth} ??{rocDay} ??              </div>
            </div>
            <div className="text-center text-xs text-stone-400 font-sans border-t border-stone-150 pt-4">
              ç¬¬ä???(?±ä???
            </div>
          </div>

          {/* PAGE 4: å°ä?è¨˜é? */}
          <div className="bg-white print-page-a4 shadow-lg w-[794px] h-[1123px] p-[60px] flex flex-col justify-between text-stone-900 border border-stone-300 relative">
            <div className="space-y-6">
              <div className="flex justify-between items-center text-sm font-serif h-5">
              </div>

              <div className="text-center pt-4">
                <h3 className="text-base font-bold font-serif text-stone-950 tracking-widest border-b border-stone-800 pb-4">
                  å°?ä¿?è¨???                </h3>
              </div>

              <div className="pt-8">
                <table className="w-full border-collapse border border-stone-800 text-xs font-serif text-center">
                  <thead>
                    <tr className="bg-stone-50 h-10 border-b border-stone-800">
                      <th className="border-r border-stone-800 w-[20%] font-bold">å°ä?å¹´æ???/th>
                      <th className="border-r border-stone-800 w-[60%] font-bold">å°?ä¿?è¨???/th>
                      <th className="w-[20%] font-bold">å°ä?äººç°½ç«?/th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="h-[240px] border-b border-stone-800">
                      <td className="border-r border-stone-800 p-2 font-mono">
                        {OnboardEmployee.guarantorSigned ? OnboardEmployee.guarantorDate : '  å¹? ?? ??}
                      </td>
                      <td className="border-r border-stone-800 p-4 text-left leading-relaxed">
                        ?‡ä?è­‰äººå®Œæ?èº«å?é©—è?ï¼Œä?è­‰äºº?¬äºº?Œæ??”ä?è¢«ä?è­‰äºº?¼ä»»?·æ??“ä?ä¸€?‡äººäº‹è¯ä¿è??ºã€‚å?ä¿è¯çµ¡é??©ã€?                      </td>
                      <td className="p-2 text-stone-400 font-serif italic text-[11px]">
                        äººè?ä¸»ç®¡ç°½ç?
                      </td>
                    </tr>
                    <tr className="h-[240px]">
                      <td className="border-r border-stone-800 p-2 font-mono">
                        å¹? ?? ??                      </td>
                      <td className="border-r border-stone-800 p-4 text-left leading-relaxed text-stone-300">
                        (ç¬¬ä??†ä??–å??Ÿè¿½æº¯å?ä¿è??„ç?å­˜è?)
                      </td>
                      <td className="p-2 text-stone-300 font-serif italic text-[11px]">
                        ?¸å?æ¬?                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="text-center text-xs text-stone-400 font-sans border-t border-stone-150 pt-4">
              ç¬¬å???(?±ä???
            </div>
          </div>

          {/* PAGE 5: å°ä??¢æ??§ç?/è¦–è??ªå?å¯¦è²¼??*/}
          <div className="bg-white print-page-a4 shadow-lg w-[794px] h-[1123px] p-[60px] flex flex-col justify-between text-stone-900 border border-stone-300 relative">
            <div className="space-y-6">
              <div className="flex justify-between items-center text-sm font-serif h-5">
              </div>

              <div className="text-center pt-4">
                <h3 className="text-base font-bold font-serif text-stone-950 tracking-wider border-b border-stone-800 pb-4">
                  å°?ä¿???????????è¦?è¨?????å¯?è²???                </h3>
              </div>

              <div className="grid grid-cols-5 gap-6 pt-6">
                <div className="col-span-1 text-[10px] text-stone-400 leading-relaxed font-serif border-r border-stone-200 pr-4 text-justify">
                  ?¬ä?è­‰æ›¸?€?é?ä¹‹ä?è­‰äºº?‡è¢«ä¿è?äººå€‹äººè³‡æ?ï¼Œå?ä½œæ–¼?¬ä?è­‰æ›¸ç¯„å??§ã€ä?ä½œç‚ºä»–é€”ä??¨ã€?                </div>
                
                <div className="col-span-4 space-y-8">
                  <div className="border-2 border-dashed border-stone-300 rounded-xl h-[260px] flex items-center justify-center p-6 text-center text-xs text-stone-400 bg-stone-50/40 relative">
                    <span className="leading-relaxed">
                      ï¼ˆç…§?‡æ??ªå?å½±å??€æ¸…æ™°?¯è?å°ä?äººä?å®¹è??Šèº«?†è?ï¼?                    </span>
                    <div className="absolute bottom-3 right-4 text-[10px] text-stone-500 font-mono font-serif">
                      å°ä??¥æ?ï¼š{OnboardEmployee.guarantorSigned ? OnboardEmployee.guarantorDate : '    å¹?   ??   ??}
                    </div>
                  </div>

                  <div className="border-2 border-dashed border-stone-300 rounded-xl h-[260px] flex items-center justify-center p-6 text-center text-xs text-stone-400 bg-stone-50/40 relative">
                    <span className="leading-relaxed">
                      ï¼ˆè?ä»¶æ?å°ä?è¦–è?å¯¦æ?ç¢ºè?å½±å??™ä»½?•ï?
                    </span>
                    <div className="absolute bottom-3 right-4 text-[10px] text-stone-300 font-mono font-serif">
                      å°ä??¥æ?ï¼?    å¹?    ??    ??                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-center text-xs text-stone-400 font-sans border-t border-stone-150 pt-4">
              ç¬¬ä???(?±ä???
            </div>
          </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export function ServicePrintModal({ OnboardEmployee, onClose }: { OnboardEmployee: OnboardEmployee; onClose: () => void }) {
  const companyDetails = getCompanyDetails(OnboardEmployee);
  const p = OnboardEmployee.personalData || {} as any;

  const dObj = OnboardEmployee.onboardDate ? new Date(OnboardEmployee.onboardDate) : (OnboardEmployee.updatedAt ? new Date(OnboardEmployee.updatedAt) : new Date());
  const rocYear = isNaN(dObj.getTime()) ? 115 : dObj.getFullYear() - 1911;
  const rocMonth = isNaN(dObj.getTime()) ? 6 : dObj.getMonth() + 1;
  const rocDay = isNaN(dObj.getTime()) ? 15 : dObj.getDate();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm p-4 md:p-8 flex items-start justify-center print-modal-overlay">
      <div className="bg-stone-50 max-w-4xl w-full rounded-2xl shadow-2xl border border-stone-200 overflow-hidden my-4 text-left print-modal-card">
        
        {/* Header - strictly non-printing */}
        <div className="bg-stone-900 text-[#D4AF37] px-6 py-4 flex items-center justify-between sticky top-0 z-10 border-b border-[#D4AF37]/30 no-print-el">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-stone-850 flex items-center justify-center border border-[#D4AF37]/20">
              <Printer className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">?–¨ï¸??·å·¥?å?ç´„å????—å°?è¦½</h3>
              <p className="text-[10px] text-stone-400">æ¨™æ? A4 ?ˆç??¸å½¢å¼ï??…å«?¸ä?ä¿å?æ³•è??‡å“¡å·¥æ??™æ?æ¬¾ï??¯ç›´?¥å??°æ??²å???PDF</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-5 py-1.5 bg-[#8D1B1B] hover:bg-[#A32222] text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              ?—å° ???¦å???PDF
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
                  ??å·?????ç´?å®?                </h2>
              </div>

              <div className="text-right text-xs pr-4 font-serif text-stone-800">
                é¤¨åˆ¥ï¼?span className="border-b border-stone-400 px-8 font-bold">
                  {(() => {
                    const loc = OnboardEmployee.contractWorkLocation ? OnboardEmployee.contractWorkLocation.split(' (')[0] : (OnboardEmployee.department ? OnboardEmployee.department : '?°å??›å?');
                    return (loc === '?²æ?è§€?? || loc === '?²æ?è§€?‰è‚¡ä»½æ??å…¬??) ? 'ç¸½å…¬?? : loc;
                  })()}
                </span>
              </div>

              <div className="space-y-5 text-xs text-stone-800 leading-6 font-serif text-justify pt-4">
                <p><strong>ç¬¬ä?æ¢ï?</strong>?¬å…¬?¸è·å·¥ä»»?·æ??“é?ä»¥å®¢?ºå?ï¼Œä¸¦?µå??¬å…¬?¸å??…è?ç« ã€?/p>
                <p><strong>ç¬¬ä?æ¢ï?</strong>?·å·¥?Œæ??ªå¯¦?›å·¥ä½œæ—¥èµ·ä??å¤©?§ç‚ºè©¦ç”¨?Ÿé?ï¼Œåœ¨æ­¤æ??“å?å·¥ä??½å?ä¸è¶³?–æ??™æ?åº¦ä?æ»¿æ??–ç‚º?¬å…¬?¸è?ä¼°ç„¡æ³•å?ä»»æ??‰å¾µä¹‹è·?™ï?å¾—ä??¸é?è¦å??œæ­¢è©¦ç”¨??/p>
                <p><strong>ç¬¬ä?æ¢ï?</strong>?·å·¥?‰ä??Œå€‹äººè³‡æ?ä¿è­·æ³•ã€ä?å¾—å?é¡§å®¢?–æœ¬?¬å¸?¡å·¥ä¹‹å€‹äººè³‡æ??ä?äºˆç„¡?œä?ç¬¬ä?äººã€?/p>
                <p><strong>ç¬¬å?æ¢ï?</strong>å°±è·å·¥æ?å¡«å¯«?‹äººè³‡æ?ï¼Œæœ¬?¬å¸?å??¬å¸?Šé?ä¿‚ä?æ¥­ï?ä¸‹ç¨±?¬å…¬?¸ï?å°‡æ–¼?·å·¥?˜åƒ±?Ÿé?ï¼Œæ–¼ä¸­è¯æ°‘å??°å?ï¼Œä??ºäººäº‹ç®¡?†ã€ç?ç¹”èª¿?´ã€å??‡ç??‹æ??œä?ä½¿ç”¨??/p>
                <p><strong>ç¬¬ä?æ¢ï?</strong>?¬å…¬?¸ä??Œå€‹äººè³‡æ?ä¿è­·æ³•ã€ä??ƒæ?ä¾›ä??¡é?ä¹‹ç¬¬ä¸‰äºº?‚è·å·¥ä??Œå€‹äººè³‡æ?ä¿è­·æ³•ã€ä¸¦?¯å??¬å…¬?¸ç‚º?‹äººè³‡æ??¥è©¢?è?æ±‚é–±è¦½ã€è??…æ??´æ­£?–è?æ±‚äº¤ä»˜è?è£½æœ¬?‚å¦ï¼Œé?äº¦å¯è«‹æ??œæ­¢?é??è??†æ??©ç”¨?Šåˆª?¤ï?ä½†æ–¼?˜åƒ±?œä?å­˜ç??Ÿé?ï¼Œæ??˜åƒ±?œä?çµ‚æ­¢å¾Œï??¬å…¬?¸å??·è??·å??–æ¥­?™æ?å¿…é??…ï??·å·¥?¡æ?è«‹æ??œæ­¢?é??è??†æ??©ç”¨?Šåˆª?¤ã€?/p>
                
                <div className="pt-4 border-t border-dashed border-stone-300">
                  <p className="font-bold text-stone-950 bg-stone-50 p-4 border border-stone-150 rounded-xl leading-relaxed">
                    ä»¥ä?å®ˆå?ï¼Œç??¬äºº?æ?ä»”ç´°?±è?ä¸¦ç‚º?Œæ??‚æœ¬äººé??éµå®ˆï?å¦‚æ??•å?ï¼Œé?ä¾ç…§?¬å…¬?¸å“¡å·¥æ??Šç¬¬?ä?æ¢è·å·¥ç??²è¾¦æ³•è??†ï?çµ•ç„¡?°è­°??                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-10 font-serif">
                <div className="space-y-4">
                  <div className="text-xs">
                    ç«‹å??æ›¸äººï?
                    <span className="text-[#8D1B1B] font-bold tracking-wider text-sm border-b border-stone-850 px-4 ml-1 bg-white inline-block">
                      {p.name || OnboardEmployee.name}
                    </span>
                  </div>
                  <div className="text-xs">
                    ç°½ç?ï¼?                    {OnboardEmployee.serviceSigned ? (
                      <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded text-[10px] ml-1 border border-emerald-150 font-bold inline-block">
                        ??ç·šä?å·²ç°½å±?                      </span>
                    ) : (
                      <span className="text-stone-400 italic">å¾…é›»å­è?è­?/span>
                    )}
                  </div>
                </div>

                <div className="flex items-end justify-end text-right text-xs font-bold leading-loose">
                  ä¸­è¯æ°‘å? {rocYear} å¹?{rocMonth} ??{rocDay} ??                </div>
              </div>
            </div>

            <div className="text-center text-xs text-stone-400 font-sans border-t border-stone-150 pt-4">
              ç¬¬ä???(?±ä???
            </div>
          </div>
          </div>

        </div>
      </div>
    </div>
  );
}
