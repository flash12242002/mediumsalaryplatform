import React, { useState } from 'react';
import { X, UserPlus, Check } from 'lucide-react';
import { Employee, EmploymentStatus } from '../types';

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddEmployee: (newEmp: Employee) => void;
  existingCompanies: string[];
}

export const AddEmployeeModal: React.FC<AddEmployeeModalProps> = ({
  isOpen,
  onClose,
  onAddEmployee,
  existingCompanies,
}) => {
  if (!isOpen) return null;

  const [empId, setEmpId] = useState('');
  const [nameZh, setNameZh] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [extension, setExtension] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState(existingCompanies[0] || '雲朗觀光集團總部');
  const [department, setDepartment] = useState('客房營運部');
  const [title, setTitle] = useState('營運專員');
  const [status, setStatus] = useState<EmploymentStatus>('在職');
  const [totalQuota, setTotalQuota] = useState(3);
  const [location, setLocation] = useState('台北總部');
  const [mobile, setMobile] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empId || !nameZh || !nameEn || !extension || !email || !nationalId) {
      alert('請填寫完整必填欄位 (員工編號、中文姓名、英文姓名、身分證字號、分機、Email)！');
      return;
    }

    const cleanEmpId = empId.trim().toUpperCase();
    const newEmployee: Employee = {
      id: cleanEmpId,
      empId: cleanEmpId,
      nameZh,
      nameEn,
      extension,
      email,
      nationalId: nationalId.trim().toUpperCase(),
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=320&h=320&q=80',
      company,
      department,
      title,
      status,
      startDate: new Date().toISOString().split('T')[0],
      location,
      mobile: mobile || '0900-000-000',
      roomBenefit: {
        year: 2026,
        totalQuota,
        usedNights: 0,
        eligibleHotels: ['君品酒店 台北', '雲品溫泉酒店 日月潭', '翰品酒店 高雄', '品文旅 礁溪', '兆品酒店 嘉義'],
        history: [],
      },
    };

    onAddEmployee(newEmployee);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-white border-b border-slate-150 p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">HR 新增員工與身分證建檔</h3>
              <p className="text-xs text-slate-400">建檔個人通訊資料、身分證字號與 2026 年度免費房額度</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">員工編號 *</label>
            <input
              type="text"
              placeholder="例：LDC-001082"
              value={empId}
              onChange={(e) => setEmpId(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-500 uppercase font-mono text-slate-900 font-bold"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">中文姓名 *</label>
              <input
                type="text"
                placeholder="例：王小明"
                value={nameZh}
                onChange={(e) => setNameZh(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">英文姓名 *</label>
              <input
                type="text"
                placeholder="例：Kevin Wang"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              身分證字號 * (用於本人查詢免費房時驗證解鎖)
            </label>
            <input
              type="text"
              placeholder="例：A123456789"
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value)}
              className="w-full p-2 bg-blue-50/50 border border-blue-200 rounded-lg font-mono focus:outline-hidden focus:border-blue-500 uppercase font-bold text-blue-900"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">公司電話分機 *</label>
              <input
                type="text"
                placeholder="例：8230"
                value={extension}
                onChange={(e) => setExtension(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono focus:outline-hidden focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">電子信箱 (Email) *</label>
              <input
                type="email"
                placeholder="例：kevin.wang@ldchotels.com"
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
              <select
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-500 cursor-pointer"
              >
                {existingCompanies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">所屬部門</label>
              <input
                type="text"
                placeholder="例：客房營運部、資訊系統部"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
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
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-500 cursor-pointer font-medium"
              >
                <option value="在職">在職</option>
                <option value="試用期">試用期</option>
                <option value="留職停薪">留職停薪</option>
                <option value="育嬰留停">育嬰留停</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">年度免費房晚數</label>
              <input
                type="number"
                min="0"
                max="10"
                value={totalQuota}
                onChange={(e) => setTotalQuota(Number(e.target.value))}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-center font-bold focus:outline-hidden focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">辦公地點 (選填)</label>
            <input
              type="text"
              placeholder="例：總部 11F 資訊處"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-500"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
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
              建立員工資料
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
