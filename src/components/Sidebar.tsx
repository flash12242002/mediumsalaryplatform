import React, { useState } from 'react';
import {
  Users,
  Building2,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  PlusCircle,
  Building
} from 'lucide-react';
import { Employee, UserViewMode } from '../types';

interface SidebarProps {
  currentView: 'directory' | 'room_center';
  setCurrentView: (view: 'directory' | 'room_center') => void;
  employees: Employee[];
  selectedCompany: string;
  selectedDepartment: string;
  onSelectCategory: (company: string, department: string) => void;
  viewMode: UserViewMode;
  onOpenAddModal: () => void;
  onResetData: () => void;
  onExportCSV?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  setCurrentView,
  employees,
  selectedCompany,
  selectedDepartment,
  onSelectCategory,
  viewMode,
  onOpenAddModal,
  onResetData,
}) => {
  // When "員工查詢通訊錄" is clicked, show the list of hotels
  const [isHotelsListOpen, setIsHotelsListOpen] = useState(true);

  // Group hotel statistics
  const companiesList = Array.from(new Set(employees.map((e) => e.company)));
  const companyCounts: Record<string, number> = {};
  employees.forEach((emp) => {
    companyCounts[emp.company] = (companyCounts[emp.company] || 0) + 1;
  });

  const handleDirectoryClick = () => {
    setCurrentView('directory');
    setIsHotelsListOpen(true);
  };

  const handleSelectHotel = (company: string) => {
    setCurrentView('directory');
    // When selecting a hotel, prompt department selection on the right
    onSelectCategory(company, '');
  };

  return (
    <aside className="w-64 lg:w-72 flex flex-col gap-4 shrink-0 select-none">
      {/* Main Navigation Card matching screenshot */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col gap-4">
        {/* Section Header */}
        <div className="text-[11px] font-bold text-slate-400 tracking-wider uppercase px-2 pt-1">
          功能導航 / NAVIGATION
        </div>

        {/* Navigation Items */}
        <div className="space-y-1.5">
          {/* Main "員工查詢通訊錄" Button: 點選後跑出每個館別名稱 */}
          <button
            onClick={handleDirectoryClick}
            className={`w-full flex items-center justify-between p-2.5 rounded-xl transition text-left ${
              currentView === 'directory'
                ? 'bg-blue-50/90 text-blue-600 border border-blue-200/80 shadow-2xs font-semibold'
                : 'text-slate-700 hover:bg-slate-50 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3">
              <Users
                className={`w-5 h-5 shrink-0 ${
                  currentView === 'directory' ? 'text-blue-600' : 'text-slate-400'
                }`}
              />
              <div>
                <div className="text-sm font-bold leading-tight">員工查詢通訊錄</div>
                <div
                  className={`text-[11px] leading-tight mt-0.5 ${
                    currentView === 'directory' ? 'text-blue-500' : 'text-slate-400'
                  }`}
                >
                  Staff Directory
                </div>
              </div>
            </div>

            <span
              onClick={(e) => {
                e.stopPropagation();
                setIsHotelsListOpen(!isHotelsListOpen);
              }}
              className="p-1 hover:bg-white/60 rounded text-slate-400 hover:text-slate-600"
              title={isHotelsListOpen ? '收合館別清單' : '展開館別清單'}
            >
              {isHotelsListOpen ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </span>
          </button>
        </div>

        {/* 點選查詢通訊錄後，跑出每個館別的名稱 (Hotels / Properties List) */}
        {isHotelsListOpen && (
          <div className="border-t border-slate-150 pt-3 space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                選擇查詢館別 (PROPERTIES)
              </span>
              <button
                onClick={() => onSelectCategory('', '')}
                className={`text-[11px] px-2 py-0.5 rounded transition ${
                  selectedCompany === ''
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                全部
              </button>
            </div>

            {/* List of each hotel / property name as requested */}
            <div className="space-y-1 pr-0.5 max-h-64 overflow-y-auto custom-scrollbar">
              {companiesList.map((company) => {
                const isSelected = selectedCompany === company;
                return (
                  <div
                    key={company}
                    onClick={() => handleSelectHotel(company)}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition text-xs font-semibold ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-700 hover:bg-slate-50 border border-slate-150 bg-slate-50/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Building2
                        className={`w-4 h-4 shrink-0 ${
                          isSelected ? 'text-blue-200' : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate">{company}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-normal ${
                          isSelected ? 'bg-blue-700 text-blue-100' : 'bg-white text-slate-500 border border-slate-200'
                        }`}
                      >
                        {companyCounts[company] || 0}人
                      </span>
                      {isSelected && <ChevronRight className="w-3.5 h-3.5 text-blue-200" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Management Actions */}
        {viewMode === 'HR_ADMIN' && (
          <div className="border-t border-slate-150 pt-3 space-y-2 text-xs">
            <button
              onClick={onOpenAddModal}
              className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition text-xs"
            >
              <PlusCircle className="w-4 h-4" />
              新增員工 (身分證/配額)
            </button>
          </div>
        )}

        {/* Secure Notice */}
        <div className="border-t border-slate-150 pt-3 text-[11px] text-slate-500 space-y-1">
          <div className="flex items-center justify-between">
            <div className="font-bold text-slate-700">安全提示 Secure Notice :</div>
            <button
              onClick={onResetData}
              className="text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-1 hover:underline transition"
              title="還原預設示範資料"
            >
              <RotateCcw className="w-3 h-3" />
              還原資料
            </button>
          </div>
          <div className="text-slate-500">當前帳號：Gordon</div>
          <div className="text-slate-500">
            當前角色：{viewMode === 'HR_ADMIN' ? 'HR 行政管理員' : '一般員工'}
          </div>
          <div className="pt-1 text-[10px] text-amber-700 bg-amber-50/70 p-1.5 rounded-lg border border-amber-200/60 font-mono">
            🔑 測試密碼：mis (身分驗證用)
          </div>
        </div>
      </div>
    </aside>
  );
};
