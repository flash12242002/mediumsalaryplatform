import React, { useState } from 'react';
import { X, Check, ShieldCheck, BedDouble, Trash2 } from 'lucide-react';
import { Employee, EmploymentStatus } from '../types';

interface EditEmployeeModalProps {
  employee: Employee | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: Employee) => void;
  onDelete?: (id: string) => void;
}

export const EditEmployeeModal: React.FC<EditEmployeeModalProps> = ({
  employee,
  isOpen,
  onClose,
  onSave,
  onDelete,
}) => {
  if (!isOpen || !employee) return null;

  const [nameZh, setNameZh] = useState(employee.nameZh);
  const [nameEn, setNameEn] = useState(employee.nameEn);
  const [nationalId, setNationalId] = useState(employee.nationalId);
  const [extension, setExtension] = useState(employee.extension);
  const [email, setEmail] = useState(employee.email);
  const [company, setCompany] = useState(employee.company);
  const [department, setDepartment] = useState(employee.department);
  const [title, setTitle] = useState(employee.title);
  const [status, setStatus] = useState<EmploymentStatus>(employee.status);
  const [totalQuota, setTotalQuota] = useState(employee.roomBenefit.totalQuota);
  const [usedNights, setUsedNights] = useState(employee.roomBenefit.usedNights);
  const [location, setLocation] = useState(employee.location || '');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const updatedEmployee: Employee = {
      ...employee,
      nameZh,
      nameEn,
      nationalId: nationalId.trim().toUpperCase(),
      extension,
      email,
      company,
      department,
      title,
      status,
      location,
      roomBenefit: {
        ...employee.roomBenefit,
        totalQuota,
        usedNights,
      },
    };

    onSave(updatedEmployee);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-white border-b border-slate-150 p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">HR 後端：編輯資料與身分證維護</h3>
              <p className="text-xs text-slate-400">
                編號：{employee.id} • {employee.nameZh}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">中文姓名</label>
              <input
                type="text"
                value={nameZh}
                onChange={(e) => setNameZh(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-500 font-bold"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">英文姓名</label>
              <input
                type="text"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              身分證字號 (用於本人安全驗證查詢免費房)
            </label>
            <input
              type="text"
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value)}
              className="w-full p-2 bg-blue-50/50 border border-blue-200 rounded-lg font-mono focus:outline-hidden focus:border-blue-500 uppercase font-bold text-blue-950"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">分機號碼</label>
              <input
                type="text"
                value={extension}
                onChange={(e) => setExtension(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono focus:outline-hidden focus:border-blue-500 font-bold"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">電子信箱 (Email)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono focus:outline-hidden focus:border-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">所屬公司</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">部門別</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">職稱</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">在職狀態</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as EmploymentStatus)}
                className="w-full p-2 bg-blue-50/60 border border-blue-300 rounded-lg focus:outline-hidden focus:border-blue-500 cursor-pointer font-bold text-blue-900"
              >
                <option value="在職">在職 (Active)</option>
                <option value="試用期">試用期 (Probation)</option>
                <option value="留職停薪">留職停薪 (Leave)</option>
                <option value="育嬰留停">育嬰留停 (Parental Leave)</option>
                <option value="已離職">已離職 (Resigned)</option>
              </select>
            </div>
          </div>

          {/* Quota adjustments */}
          <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200">
            <span className="font-bold text-blue-900 flex items-center gap-1.5 mb-2">
              <BedDouble className="w-4 h-4 text-blue-700" />
              2026 年度免費客房配額調整
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 mb-1">總分配晚數</label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={totalQuota}
                  onChange={(e) => setTotalQuota(Number(e.target.value))}
                  className="w-full p-2 bg-white border border-blue-300 rounded-lg text-center font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">已折抵晚數</label>
                <input
                  type="number"
                  min="0"
                  max={totalQuota}
                  value={usedNights}
                  onChange={(e) => setUsedNights(Number(e.target.value))}
                  className="w-full p-2 bg-white border border-blue-300 rounded-lg text-center font-bold"
                />
              </div>
            </div>
            <div className="mt-2 text-right text-[11px] text-blue-800 font-medium">
              調整後剩餘可用：{Math.max(0, totalQuota - usedNights)} 晚
            </div>
          </div>

          <div className="pt-3 flex items-center justify-between border-t border-slate-200">
            {onDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`確定要刪除員工「${employee.nameZh}」的資料與紀錄嗎？`)) {
                    onDelete(employee.id);
                    onClose();
                  }
                }}
                className="px-3 py-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg flex items-center gap-1 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                刪除員工
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition"
              >
                <Check className="w-4 h-4" />
                儲存變更
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
