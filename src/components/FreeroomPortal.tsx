import React from 'react';
import { LogOut, CheckCircle } from 'lucide-react';
// @ts-ignore
import officialLogo from '../assets/ldc_logo.svg';
import { RoomBenefitCenter } from './RoomBenefitCenter';
import { Employee } from '../types';
import { INITIAL_EMPLOYEES } from '../data/roomMockData';

export default function FreeroomPortal({ currentUser, onLogout }: any) {
  // 測試帳號使用 mock 資料，真實帳號若無 roomBenefit 給預設值
  const mockEmployee = INITIAL_EMPLOYEES.find(e => e.empId === currentUser.empId || e.id === currentUser.empId) || INITIAL_EMPLOYEES[0];
  const employeeData = { ...currentUser, roomBenefit: currentUser.roomBenefit || mockEmployee.roomBenefit, status: '在職', avatar: mockEmployee.avatar, company: currentUser.company || '雲朗觀光集團總部', nameZh: currentUser.name, nameEn: currentUser.name };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-800">
      {/* Platform Header matching HR Platform */}
      <header className="bg-white border-b border-slate-200 shadow-sm no-print">
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

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <RoomBenefitCenter 
          employees={[employeeData as unknown as Employee]} 
          viewMode="EMPLOYEE" 
          onSelectEmployeeForBenefit={() => {}} 
        />
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 border-t border-slate-200 bg-white no-print">
        <div className="max-w-7xl xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-[11px] text-slate-500 flex items-center gap-2">
              <span className="font-semibold text-slate-700">LDC Hotels & Resorts</span>
              <span className="text-slate-300">|</span>
              <span>雲朗觀光集團</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Strictly Confidential. © {new Date().getFullYear()} LDC Hotels & Resorts.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
