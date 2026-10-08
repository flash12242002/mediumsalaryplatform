const fs = require('fs');

const appTsx = fs.readFileSync('C:/Users/gordon.huang/Desktop/Test2/comp-rm-checking/src/App.tsx', 'utf8');

// We will construct the FreeroomPortal component
let newPortal = `import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building2, ChevronDown, FilterX, HelpCircle, 
  LayoutGrid, List, Plus, Search, Users, LogOut, ArrowUpDown 
} from 'lucide-react';
import { Employee, FilterState, UserViewMode } from '../types';
import officialLogo from '../assets/ldc_logo.svg';

import { Sidebar } from './Sidebar';
import { RoomBenefitCenter } from './RoomBenefitCenter';
import { EmployeeCard } from './EmployeeCard';
import { EmployeeDetailModal } from './EmployeeDetailModal';
import { VerifyIdModal } from './VerifyIdModal';

export default function FreeroomPortal({ currentUser, onLogout }: any) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  useEffect(() => {
    fetch('/api/freeroom/employees')
      .then(res => res.json())
      .then(data => setEmployees(data))
      .catch(err => console.error(err));
  }, []);

  const [currentView, setCurrentView] = useState<'directory' | 'room_center'>('directory');
  
  // Current view mode: 'EMPLOYEE' vs 'HR_ADMIN'
  const viewMode: UserViewMode = 'EMPLOYEE';

  const [filter, setFilter] = useState<FilterState>({
    searchQuery: '',
    company: '',
    department: '',
    status: '',
    viewType: 'card',
    sortBy: 'department',
  });

  const [detailModalEmployee, setDetailModalEmployee] = useState<Employee | null>(null);
  const [isBenefitUnlocked, setIsBenefitUnlocked] = useState(false);
  const [verifyTargetEmployee, setVerifyTargetEmployee] = useState<Employee | null>(null);
  
  const handleSelectCategory = (company: string, department: string) => {
    setFilter(prev => ({ ...prev, company, department }));
    setCurrentView('directory');
  };
  const handleResetData = () => {};
  const handleExportCSV = () => {};

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchCompany = filter.company ? emp.company === filter.company : true;
      const matchDept = filter.department ? emp.department === filter.department : true;
      const matchStatus = filter.status ? emp.status === filter.status : true;
      const q = filter.searchQuery.toLowerCase();
      const matchSearch = q ? (
        emp.nameZh.toLowerCase().includes(q) ||
        emp.nameEn.toLowerCase().includes(q) ||
        emp.email.toLowerCase().includes(q) ||
        (emp.extension && emp.extension.includes(q)) ||
        emp.id.toLowerCase().includes(q) ||
        (emp.empId && emp.empId.toLowerCase().includes(q)) ||
        emp.department.toLowerCase().includes(q) ||
        emp.title.toLowerCase().includes(q)
      ) : true;
      return matchCompany && matchDept && matchStatus && matchSearch;
    });
  }, [employees, filter]);

  const allCompanies = useMemo(() => Array.from(new Set(employees.map(e => e.company))), [employees]);

  const groupedData = useMemo(() => {
    let sorted = [...filteredEmployees];
    if (filter.sortBy === 'name') {
      sorted.sort((a, b) => a.nameZh.localeCompare(b.nameZh, 'zh-TW'));
    } else if (filter.sortBy === 'id') {
      sorted.sort((a, b) => (a.empId || a.id).localeCompare(b.empId || b.id));
    }
    const groups: Record<string, Record<string, Employee[]>> = {};
    sorted.forEach(emp => {
      if (!groups[emp.company]) groups[emp.company] = {};
      if (!groups[emp.company][emp.department]) groups[emp.company][emp.department] = [];
      groups[emp.company][emp.department].push(emp);
    });
    return Object.entries(groups).map(([companyName, depts]) => ({
      companyName,
      departments: Object.entries(depts).map(([departmentName, staff]) => ({
        departmentName,
        staff,
      })),
    }));
  }, [filteredEmployees, filter.sortBy]);

  const handleOpenVerifyForEmployee = (employee: Employee) => {
    if (currentUser.empId === employee.empId || currentUser.empId === employee.id) {
       setDetailModalEmployee(employee);
       setIsBenefitUnlocked(true);
       setCurrentView('room_center');
    } else {
       setVerifyTargetEmployee(employee);
    }
  };

  const handleVerifySuccess = (employee: Employee) => {
    setVerifyTargetEmployee(null);
    setDetailModalEmployee(employee);
    setIsBenefitUnlocked(true);
    setCurrentView('room_center');
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-slate-800 font-sans flex flex-col">
      {/* Platform Header matching HR Platform */}
      <header className="bg-white border-b border-slate-200 shadow-sm no-print z-10 sticky top-0">
        <div className="max-w-7xl xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
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
            <div className="flex items-center gap-4 text-xs">
              <div className="hidden sm:flex flex-col items-end mr-2 border-r border-slate-200 pr-4">
                <span className="font-bold text-slate-700">{currentUser.name}</span>
                <span className="text-[10px] text-slate-500 font-mono">{currentUser.empId}</span>
              </div>
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 text-slate-500 hover:text-red-600 transition-colors font-semibold"
                title="登出系統"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">安全登出</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Main Body Container */}
      <div className="max-w-[1680px] w-full mx-auto p-4 sm:p-6 flex-1 flex flex-col md:flex-row gap-5 items-start">
        {/* Left Sidebar */}
        <Sidebar
          currentView={currentView}
          setCurrentView={setCurrentView}
          employees={employees}
          selectedCompany={filter.company}
          selectedDepartment={filter.department}
          onSelectCategory={handleSelectCategory}
          viewMode={viewMode}
          onOpenAddModal={() => {}}
          onResetData={handleResetData}
          onExportCSV={handleExportCSV}
          currentUser={currentUser}
        />

        {/* Right Main Content Card Area */}
        <div className="flex-1 min-w-0 bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
          {/* Main Card Header */}
          <div className="border-b border-slate-150 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  員工查詢與免費客房使用狀況
                </h2>
                <span className="text-slate-400 font-medium text-sm">
                  / Staff Directory & Room Benefit
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                先依公司別及部門別分門別類，下方依序排列員工卡片。點選卡片可輸入身分證字號查詢個人免費客房使用狀況。
              </p>
            </div>
          </div>

          {/* Quick Search & Filters Bar */}
          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
            <div className="relative flex-1 max-w-lg">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="快速搜尋員工資料..."
                value={filter.searchQuery}
                onChange={(e) => setFilter((prev) => ({ ...prev, searchQuery: e.target.value }))}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={filter.status}
                onChange={(e) => setFilter((p) => ({ ...p, status: e.target.value }))}
                className="px-2.5 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs rounded-lg cursor-pointer"
              >
                <option value="">在職狀態：全部</option>
                <option value="在職">在職</option>
                <option value="試用期">試用期</option>
              </select>
              <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-700">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={filter.sortBy}
                  onChange={(e) => setFilter((p) => ({ ...p, sortBy: e.target.value as FilterState['sortBy'] }))}
                  className="bg-transparent focus:outline-hidden cursor-pointer"
                >
                  <option value="department">公司與部門</option>
                  <option value="name">姓名筆畫</option>
                  <option value="id">員工編號</option>
                </select>
              </div>
              <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-300">
                <button
                  onClick={() => setFilter((p) => ({ ...p, viewType: 'card' }))}
                  className={\`p-1.5 rounded transition \${filter.viewType === 'card' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-400'}\`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setFilter((p) => ({ ...p, viewType: 'table' }))}
                  className={\`p-1.5 rounded transition \${filter.viewType === 'table' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-400'}\`}
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Hotel quick filter buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-xs">
            <span className="text-slate-400 text-[11px] shrink-0 font-medium">館別快速切換：</span>
            <button
              onClick={() => handleSelectCategory('', '')}
              className={\`px-2.5 py-1 rounded-lg text-xs font-medium transition shrink-0 \${filter.company === '' ? 'bg-blue-600 text-white font-bold shadow-2xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}\`}
            >
              全部館別 ({employees.length})
            </button>
            {allCompanies.map((comp) => {
              const count = employees.filter((e) => e.company === comp).length;
              return (
                <button
                  key={comp}
                  onClick={() => handleSelectCategory(comp, '')}
                  className={\`px-2.5 py-1 rounded-lg text-xs transition shrink-0 \${filter.company === comp ? 'bg-blue-600 text-white font-bold shadow-2xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}\`}
                >
                  {comp} ({count})
                </button>
              );
            })}
          </div>

          {/* MAIN CONTENT PRESENTATION */}
          {currentView === 'directory' ? (
            groupedData.length === 0 ? (
              <div className="p-10 text-center bg-slate-50 rounded-2xl border border-slate-200">
                <Search className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-slate-700 text-sm">查無符合條件之同仁名冊</p>
                <p className="text-xs text-slate-400 mt-1">請嘗試清除搜尋關鍵字或館別篩選</p>
              </div>
            ) : filter.viewType === 'card' ? (
              <div className="space-y-8">
                {groupedData.map((compGroup) => (
                  <section key={compGroup.companyName} className="space-y-4">
                    <div className="flex items-center justify-between border-b-2 border-slate-200 pb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-blue-600 text-white shadow-2xs">
                          <Building2 className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-slate-900">{compGroup.companyName}</h3>
                          <p className="text-[11px] text-slate-500 font-medium">共 {compGroup.departments.reduce((acc, d) => acc + d.staff.length, 0)} 位員工</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-6">
                      {compGroup.departments.map((deptGroup) => (
                        <div key={deptGroup.departmentName} className="bg-slate-50/50 rounded-2xl p-4 sm:p-5 border border-slate-150">
                          <div className="flex items-center justify-between mb-4 border-b border-slate-200/70 pb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-blue-500 shadow-sm" />
                              <h4 className="font-bold text-slate-800 text-sm">{deptGroup.departmentName}</h4>
                              <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-full text-[10px] text-slate-500 font-semibold shadow-xs">
                                {deptGroup.staff.length} 人
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 bg-white px-2 py-1 rounded border border-slate-100 shadow-xs">
                              個人免費房需身分驗證解鎖
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
                            {deptGroup.staff.map((emp) => (
                              <EmployeeCard 
                                key={emp.id} 
                                employee={emp} 
                                onClick={() => handleOpenVerifyForEmployee(emp)} 
                                viewMode={viewMode}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-xs text-left whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">員工資訊</th>
                      <th className="py-3 px-4">公司別</th>
                      <th className="py-3 px-4">部門</th>
                      <th className="py-3 px-4">狀態</th>
                      <th className="py-3 px-4">分機</th>
                      <th className="py-3 px-4 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEmployees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-blue-50/50 transition cursor-pointer group" onClick={() => handleOpenVerifyForEmployee(emp)}>
                        <td className="py-2.5 px-4 flex items-center gap-3">
                          <img src={emp.avatar} alt="" className="w-8 h-8 rounded-full border border-slate-200 object-cover" />
                          <div>
                            <div className="font-bold text-slate-800">{emp.nameZh} <span className="text-slate-400 text-[10px] ml-1">{emp.nameEn}</span></div>
                            <div className="text-slate-400 text-[10px] font-mono">{emp.empId || emp.id} • {emp.title}</div>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">{emp.company}</td>
                        <td className="py-2.5 px-4 text-slate-600">{emp.department}</td>
                        <td className="py-2.5 px-4">
                          <span className={\`px-2 py-0.5 rounded text-[10px] font-bold border \${emp.status === '在職' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'}\`}>
                            {emp.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 font-mono">{emp.extension}</td>
                        <td className="py-2.5 px-4 text-right">
                          <button className="text-blue-600 hover:text-blue-800 text-[11px] font-bold">查看免費房</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <RoomBenefitCenter
              employees={employees}
              viewMode={viewMode}
              detailModalEmployee={detailModalEmployee}
              setDetailModalEmployee={setDetailModalEmployee}
              onSelectEmployeeForBenefit={handleOpenVerifyForEmployee}
            />
          )}
        </div>
      </div>

      {verifyTargetEmployee && (
        <VerifyIdModal
          employee={verifyTargetEmployee}
          onClose={() => setVerifyTargetEmployee(null)}
          onSuccess={() => handleVerifySuccess(verifyTargetEmployee)}
        />
      )}
    </div>
  );
}
`;

fs.writeFileSync('C:/Users/gordon.huang/Desktop/Test2/bonus-salary-platform/src/components/FreeroomPortal.tsx', newPortal);
