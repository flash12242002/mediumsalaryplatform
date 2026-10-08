import React, { useState } from 'react';
import {
  Phone,
  Mail,
  Lock,
  Check,
  Copy
} from 'lucide-react';
import { Employee, UserViewMode } from '../types';

interface EmployeeCardProps {
  employee: Employee;
  viewMode: UserViewMode;
  onOpenVerify: (employee: Employee) => void;
  onSelectEmployee: (employee: Employee) => void;
  onOpenEditEmployee?: (employee: Employee) => void;
}

export const EmployeeCard: React.FC<EmployeeCardProps> = ({
  employee,
  viewMode,
  onOpenVerify,
  onSelectEmployee,
  onOpenEditEmployee,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, field: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1800);
  };

  // Status badge styling
  const getStatusBadge = (status: string) => {
    switch (status) {
      case '在職':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case '試用期':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case '留職停薪':
        return 'bg-slate-100 text-slate-600 border-slate-300';
      case '育嬰留停':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-rose-50 text-rose-700 border-rose-200';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 hover:border-blue-400/80 shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col group">
      {/* Upper Main Card Body: Left Photo, Right Brief Intro */}
      <div className="p-4 sm:p-4.5 flex flex-col sm:flex-row gap-4 flex-1">
        {/* Left Side: Avatar & Employment Status Indicator */}
        <div className="flex flex-row sm:flex-col items-center sm:items-center gap-2.5 shrink-0">
          <div className="relative">
            <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-slate-100 border-2 border-slate-100 group-hover:border-blue-300 transition-all">
              <img
                src={employee.avatar}
                alt={`${employee.nameZh} 大頭照`}
                className="w-full h-full object-cover object-top transition duration-300 group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="w-full h-full bg-linear-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-700 font-bold text-xl">
                {employee.nameZh.slice(0, 1)}
              </div>
            </div>

            {/* In-service status dot */}
            <span
              className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                employee.status === '在職'
                  ? 'bg-emerald-500'
                  : employee.status === '試用期'
                  ? 'bg-amber-500'
                  : 'bg-slate-400'
              }`}
              title={`在職狀態：${employee.status}`}
            />
          </div>

          <div className="text-center">
            <span className="font-mono text-[10px] text-slate-500 font-medium px-1.5 py-0.5 bg-slate-100 rounded-md">
              {employee.id}
            </span>
          </div>
        </div>

        {/* Right Side: Card-style Brief Introduction as requested */}
        <div className="flex-1 min-w-0 flex flex-col justify-between space-y-2.5">
          {/* Top Line: Chinese Name, English Name, Status */}
          <div>
            <div className="flex items-start justify-between gap-1.5">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition">
                    {employee.nameZh}
                  </h3>
                  <span className="text-xs font-medium text-slate-500 truncate">
                    {employee.nameEn}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-slate-700">{employee.title}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-400 truncate">{employee.company}</span>
                </div>
              </div>

              {/* Status Badge */}
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${getStatusBadge(
                  employee.status
                )}`}
              >
                {employee.status}
              </span>
            </div>

            {/* Contact Details: Extension & E-mail */}
            <div className="mt-2.5 grid grid-cols-1 gap-1 text-xs">
              {/* Extension */}
              <div
                onClick={(e) => handleCopy(employee.extension, 'ext', e)}
                className="flex items-center justify-between p-1.5 px-2 rounded-lg bg-slate-50 hover:bg-blue-50/50 border border-slate-200/60 group/item transition cursor-pointer"
                title="點擊複製分機"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Phone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="text-slate-400 text-[11px]">分機:</span>
                  <span className="font-semibold text-slate-800 font-mono tracking-wider text-xs">
                    {employee.extension}
                  </span>
                </div>
                <span className="text-slate-400 group-hover/item:text-blue-600">
                  {copiedField === 'ext' ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Copy className="w-3 h-3 opacity-50 group-hover/item:opacity-100" />
                  )}
                </span>
              </div>

              {/* Email */}
              <div
                onClick={(e) => handleCopy(employee.email, 'email', e)}
                className="flex items-center justify-between p-1.5 px-2 rounded-lg bg-slate-50 hover:bg-blue-50/50 border border-slate-200/60 group/item transition cursor-pointer"
                title="點擊複製 Email"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="text-slate-400 text-[11px] shrink-0">Email:</span>
                  <span className="text-slate-700 truncate font-mono text-[11px]">
                    {employee.email}
                  </span>
                </div>
                <span className="text-slate-400 group-hover/item:text-blue-600 shrink-0">
                  {copiedField === 'email' ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Copy className="w-3 h-3 opacity-50 group-hover/item:opacity-100" />
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card Footer Actions */}
      <div className="px-3.5 py-2.5 bg-slate-50/70 border-t border-slate-150 flex items-center justify-between text-xs">
        {/* Verification Button to Unlock Free Room Quota matching blue theme */}
        <button
          onClick={() => onOpenVerify(employee)}
          className="w-full py-2 px-3 bg-white hover:bg-blue-50 text-blue-700 hover:text-blue-800 font-semibold rounded-xl flex items-center justify-center gap-1.5 transition border border-blue-200 shadow-2xs text-xs"
        >
          <Lock className="w-3.5 h-3.5 text-blue-600" />
          <span>查看免費客房狀況</span>
        </button>
      </div>
    </div>
  );
};
