import React, { useState } from 'react';
import {
  BedDouble,
  Building,
  Hotel,
  Search,
  Sparkles,
  Lock,
  ShieldCheck,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { Employee, UserViewMode } from '../types';
import { HOTEL_LOCATIONS } from '../data/roomMockData';

interface RoomBenefitCenterProps {
  employees: Employee[];
  viewMode: UserViewMode;
  onSelectEmployeeForBenefit: (employee: Employee) => void;
}

export const RoomBenefitCenter: React.FC<RoomBenefitCenterProps> = ({
  employees,
  viewMode,
  onSelectEmployeeForBenefit,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Compute aggregate statistics
  let totalQuotaGranted = 0;
  let totalUsedNights = 0;

  interface FlattenedRecord {
    id: string;
    employeeId: string;
    employeeNameZh: string;
    employeeNameEn: string;
    employeeCompany: string;
    employeeDept: string;
    hotelName: string;
    roomType: string;
    checkInDate: string;
    checkOutDate: string;
    nights: number;
    bookingCode: string;
    notes?: string;
  }

  const allRecords: FlattenedRecord[] = [];

  employees.forEach((emp) => {
    totalQuotaGranted += emp.roomBenefit.totalQuota;
    totalUsedNights += emp.roomBenefit.usedNights;

    emp.roomBenefit.history.forEach((rec) => {
      allRecords.push({
        ...rec,
        employeeId: emp.id,
        employeeNameZh: emp.nameZh,
        employeeNameEn: emp.nameEn,
        employeeCompany: emp.company,
        employeeDept: emp.department,
      });
    });
  });

  const remainingNightsPool = Math.max(0, totalQuotaGranted - totalUsedNights);
  const utilizationPercent = totalQuotaGranted > 0 ? Math.round((totalUsedNights / totalQuotaGranted) * 100) : 0;

  // Filtered records for HR view
  const filteredRecords = allRecords.filter((rec) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      rec.employeeNameZh.includes(term) ||
      rec.employeeNameEn.toLowerCase().includes(term) ||
      rec.bookingCode.toLowerCase().includes(term) ||
      rec.hotelName.includes(term) ||
      rec.employeeDept.includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Overview in clean white/blue card theme */}
      <div className="bg-gradient-to-r from-blue-50/80 via-white to-slate-50 rounded-2xl p-6 border border-blue-200/80 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-blue-100 pb-5">
          <div>
            <div className="flex items-center gap-2 text-blue-600 text-xs font-bold uppercase tracking-wider mb-1">
              <Sparkles className="w-4 h-4" />
              雲朗觀光集團 • 員工免費客房規章與總覽
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              2026 年度員工免費住宿福利總覽
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              本系統僅提供福利額度與使用狀況查詢，為保護同仁隱私，個人額度需經身分驗證方可檢視。
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 shadow-2xs">
              集團人數：<strong className="text-slate-900 font-mono">{employees.length}</strong> 人
            </span>
            <span className="text-xs bg-blue-100/70 text-blue-800 border border-blue-200 px-3 py-1.5 rounded-lg font-bold">
              總使用率：{utilizationPercent}%
            </span>
          </div>
        </div>

        {/* 3 Overview Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-5">
          <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs">
            <span className="text-xs text-slate-400 block mb-1">全集團總配額</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-900">{totalQuotaGranted}</span>
              <span className="text-xs text-slate-400">晚</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">全體在職員工年度福利額度合計</span>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs">
            <span className="text-xs text-slate-400 block mb-1">已入住折抵</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-700">{totalUsedNights}</span>
              <span className="text-xs text-slate-400">晚</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">已完成入住退房之總晚數</span>
          </div>

          <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 shadow-2xs">
            <span className="text-xs text-emerald-700 block mb-1 font-semibold">目前集團剩餘晚數</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-700">{remainingNightsPool}</span>
              <span className="text-xs text-emerald-600">晚</span>
            </div>
            <span className="text-[10px] text-emerald-600/80 mt-1 block">尚有 {remainingNightsPool} 晚福利額度可享用</span>
          </div>
        </div>
      </div>

      {/* Group Hotel Eligibility Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <Hotel className="w-4 h-4 text-blue-600" />
          集團免費客房適用館別清單
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {HOTEL_LOCATIONS.map((hotel) => (
            <div key={hotel.name} className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200 space-y-1.5 hover:border-blue-200 transition">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm">{hotel.name}</span>
                <span className="text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {hotel.city}
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                <span>適用房型：</span>
                <span className="text-slate-700">{hotel.roomTypes.join('、')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* HR Admin Stay Records Table */}
      {viewMode === 'HR_ADMIN' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                HR 後端：全集團住宿使用總表 ({allRecords.length} 筆紀錄)
              </h3>
              <p className="text-slate-500 text-[11px]">可於此查核同仁之住宿歷史紀錄與核銷資訊</p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="搜尋姓名、訂房代號、飯店..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:border-blue-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[11px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">同仁姓名 / 工號</th>
                  <th className="py-3 px-4">公司與部門</th>
                  <th className="py-3 px-4">入住飯店與房型</th>
                  <th className="py-3 px-4">住宿日期</th>
                  <th className="py-3 px-4 text-center">折抵晚數</th>
                  <th className="py-3 px-4">訂房代號</th>
                  <th className="py-3 px-4">備註</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      查無住宿紀錄
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-4">
                        <span className="font-bold text-slate-900 block">{row.employeeNameZh}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{row.employeeId}</span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="font-medium text-slate-800">{row.employeeDept}</span>
                        <span className="text-[10px] text-slate-400 block">{row.employeeCompany}</span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="font-semibold text-blue-900 block">{row.hotelName}</span>
                        <span className="text-slate-500 text-[11px]">{row.roomType}</span>
                      </td>
                      <td className="py-2.5 px-4 font-mono">
                        {row.checkInDate} ~ {row.checkOutDate}
                      </td>
                      <td className="py-2.5 px-4 text-center font-bold font-mono text-slate-900">
                        {row.nights} 晚
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">
                        {row.bookingCode}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                        {row.notes || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-blue-50/50 border border-blue-200 rounded-2xl p-5 text-xs text-blue-950 space-y-2">
          <div className="flex items-center gap-2 font-bold text-blue-900 text-sm">
            <Lock className="w-4 h-4 text-blue-600" />
            個人住宿紀錄隱私防護說明
          </div>
          <p className="leading-relaxed">
            為兼顧企業內部通訊錄便利性與員工福利隱私，本系統不會向他人公開您剩餘的免費房晚數或過往入住飯店紀錄。若您需要查詢個人額度，請回到通訊錄點擊您的個人卡片，輸入您的身分證字號（或測試密碼 mis）即可立即查閱！
          </p>
        </div>
      )}
    </div>
  );
};
