import React, { useState } from 'react';
import {
  X,
  Phone,
  Mail,
  MapPin,
  Calendar,
  BedDouble,
  Lock,
  Unlock,
  CheckCircle2,
  Building,
  UserCheck,
  ShieldCheck,
  History,
  Hotel,
  KeyRound,
  Sparkles,
  Plus
} from 'lucide-react';
import { Employee, RoomUsageRecord, UserViewMode } from '../types';
import { HOTEL_LOCATIONS } from '../data/mockData';

interface EmployeeDetailModalProps {
  employee: Employee | null;
  onClose: () => void;
  viewMode: UserViewMode;
  isBenefitUnlocked: boolean;
  onUnlockBenefit: () => void;
  onUpdateQuota?: (employeeId: string, newTotalQuota: number, newUsedNights: number) => void;
  onAddHistoryRecord?: (employeeId: string, record: Omit<RoomUsageRecord, 'id'>) => void;
}

export const EmployeeDetailModal: React.FC<EmployeeDetailModalProps> = ({
  employee,
  onClose,
  viewMode,
  isBenefitUnlocked,
  onUnlockBenefit,
  onUpdateQuota,
  onAddHistoryRecord,
}) => {
  if (!employee) return null;

  const [verifyInput, setVerifyInput] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [isAddingRecord, setIsAddingRecord] = useState(false);

  // New record form state for HR
  const [newHotel, setNewHotel] = useState(HOTEL_LOCATIONS[0].name);
  const [newRoomType, setNewRoomType] = useState(HOTEL_LOCATIONS[0].roomTypes[0]);
  const [newCheckIn, setNewCheckIn] = useState('2026-11-01');
  const [newCheckOut, setNewCheckOut] = useState('2026-11-03');
  const [newNights, setNewNights] = useState(2);
  const [newNotes, setNewNotes] = useState('休假放鬆');

  // HR Quota edit state
  const [isEditingQuota, setIsEditingQuota] = useState(false);
  const [editTotalQuota, setEditTotalQuota] = useState(employee.roomBenefit.totalQuota);
  const [editUsedNights, setEditUsedNights] = useState(employee.roomBenefit.usedNights);

  const { totalQuota, usedNights, history, eligibleHotels } = employee.roomBenefit;
  const remainingNights = Math.max(0, totalQuota - usedNights);

  const hasAccess = viewMode === 'HR_ADMIN' || isBenefitUnlocked;

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = verifyInput.trim().toUpperCase();
    if (trimmed === employee.nationalId.trim().toUpperCase() || trimmed === 'MIS') {
      setVerifyError('');
      setVerifyInput('');
      onUnlockBenefit();
    } else {
      setVerifyError('身分證字號不符。測試體驗請輸入 mis 即可解鎖！');
    }
  };

  const handleSaveQuota = () => {
    if (onUpdateQuota) {
      onUpdateQuota(employee.id, editTotalQuota, editUsedNights);
    }
    setIsEditingQuota(false);
  };

  const handleCreateRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (onAddHistoryRecord) {
      onAddHistoryRecord(employee.id, {
        hotelName: newHotel,
        checkInDate: newCheckIn,
        checkOutDate: newCheckOut,
        nights: newNights,
        roomType: newRoomType,
        bookingCode: `LDC-REC-${Date.now().toString().slice(-4)}`,
        registeredDate: new Date().toISOString().split('T')[0],
        notes: newNotes,
      });
      setIsAddingRecord(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div
        className="bg-white rounded-2xl shadow-xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-white border-b border-slate-200 p-5 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="relative">
              <img
                src={employee.avatar}
                alt={employee.nameZh}
                className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl object-cover object-top border-2 border-slate-200 shadow-xs"
              />
              <span
                className={`absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-2xs ${
                  employee.status === '在職'
                    ? 'bg-emerald-600'
                    : employee.status === '試用期'
                    ? 'bg-amber-600'
                    : 'bg-slate-600'
                }`}
              >
                {employee.status}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">{employee.nameZh}</h2>
                <span className="text-sm text-slate-500 font-medium">{employee.nameEn}</span>
                <span className="text-xs font-mono bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded">
                  {employee.id}
                </span>
              </div>

              <p className="text-xs text-slate-600 mt-1 flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-800">{employee.company}</span>
                <span className="text-slate-300">•</span>
                <span>{employee.department}</span>
                <span className="text-slate-300">•</span>
                <span>{employee.title}</span>
              </p>

              <div className="mt-2.5 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-blue-600" />
                  <span>分機: <strong className="text-slate-900 font-mono">{employee.extension}</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  <span className="font-mono text-slate-700">{employee.email}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-[#F8FAFC] text-xs">
          {/* SECTION 1: Free Room Usage Section */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${hasAccess ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                  {hasAccess ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    2026 年度員工免費房間使用狀況
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {hasAccess ? '已通過身分驗證，福利資料已解鎖' : '此為個人隱私資料，需驗證身分證字號或 mis 密碼'}
                  </p>
                </div>
              </div>

              {hasAccess && (
                <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 已驗證解鎖
                </span>
              )}
            </div>

            {!hasAccess ? (
              /* Verification Prompt */
              <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 space-y-3">
                <div className="flex items-start gap-2 text-blue-950">
                  <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">請驗證本人身分以查詢免費客房額度：</span>
                    通訊錄不公開個人剩餘房數。請輸入該同仁之身分證字號，或輸入測試專用密碼 <code className="bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded font-mono">mis</code> 即可觀看。
                  </div>
                </div>

                <form onSubmit={handleVerifySubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    placeholder="輸入身分證字號或 mis..."
                    value={verifyInput}
                    onChange={(e) => {
                      setVerifyInput(e.target.value);
                      if (verifyError) setVerifyError('');
                    }}
                    className="flex-1 p-2 bg-white border border-slate-300 rounded-lg font-mono text-xs focus:outline-hidden focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setVerifyInput('mis')}
                    className="px-2.5 py-2 bg-blue-100 hover:bg-blue-200 text-blue-800 font-semibold rounded-lg"
                  >
                    帶入 mis
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition shadow-2xs"
                  >
                    解鎖查看
                  </button>
                </form>

                {verifyError && (
                  <p className="text-rose-600 font-medium text-[11px]">{verifyError}</p>
                )}
              </div>
            ) : (
              /* Unlocked Room Benefit Content */
              <div className="space-y-4">
                {/* 3 Metric Cards matching screenshot */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                    <span className="text-[11px] text-slate-500 font-medium">年度總配額</span>
                    <p className="text-xl sm:text-2xl font-extrabold text-slate-900 font-mono mt-0.5">
                      {totalQuota} <span className="text-xs font-normal text-slate-500">晚</span>
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-center">
                    <span className="text-[11px] text-emerald-700 font-bold">目前剩餘晚數</span>
                    <p className="text-xl sm:text-2xl font-extrabold text-emerald-700 font-mono mt-0.5">
                      {remainingNights} <span className="text-xs font-normal text-emerald-600">晚</span>
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-center">
                    <span className="text-[11px] text-slate-600 font-medium">已入住折抵</span>
                    <p className="text-xl sm:text-2xl font-extrabold text-slate-700 font-mono mt-0.5">
                      {usedNights} <span className="text-xs font-normal text-slate-500">晚</span>
                    </p>
                  </div>
                </div>

                {/* HR Adjustment Toolbar in HR Mode */}
                {viewMode === 'HR_ADMIN' && (
                  <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-900">🛡️ HR 配額維護</span>
                      {isEditingQuota ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={handleSaveQuota}
                            className="px-2.5 py-1 bg-blue-600 text-white rounded font-bold"
                          >
                            儲存
                          </button>
                          <button
                            onClick={() => setIsEditingQuota(false)}
                            className="px-2 py-1 bg-slate-200 text-slate-700 rounded"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditTotalQuota(totalQuota);
                            setEditUsedNights(usedNights);
                            setIsEditingQuota(true);
                          }}
                          className="px-2.5 py-1 bg-white border border-blue-300 text-blue-700 rounded hover:bg-blue-100"
                        >
                          修改配額與已用晚數
                        </button>
                      )}
                    </div>

                    {isEditingQuota && (
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div>
                          <label className="block text-slate-600 mb-1">年度總配額 (晚)</label>
                          <input
                            type="number"
                            min="0"
                            max="20"
                            value={editTotalQuota}
                            onChange={(e) => setEditTotalQuota(Number(e.target.value))}
                            className="w-full p-1.5 bg-white border border-blue-300 rounded text-center font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 mb-1">已使用晚數 (晚)</label>
                          <input
                            type="number"
                            min="0"
                            max={editTotalQuota}
                            value={editUsedNights}
                            onChange={(e) => setEditUsedNights(Number(e.target.value))}
                            className="w-full p-1.5 bg-white border border-blue-300 rounded text-center font-bold"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Usage History Records List */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <History className="w-4 h-4 text-slate-500" />
                      歷次住宿折抵紀錄 ({history.length} 筆)
                    </span>

                    {viewMode === 'HR_ADMIN' && (
                      <button
                        onClick={() => setIsAddingRecord(!isAddingRecord)}
                        className="px-2 py-1 bg-blue-600 text-white rounded flex items-center gap-1 text-[11px]"
                      >
                        <Plus className="w-3 h-3" />
                        登記住宿紀錄
                      </button>
                    )}
                  </div>

                  {isAddingRecord && (
                    <form onSubmit={handleCreateRecord} className="p-3 bg-slate-100 rounded-xl space-y-2 border border-slate-300">
                      <span className="font-bold text-slate-800 block">登記新住宿折抵：</span>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={newHotel}
                          onChange={(e) => setNewHotel(e.target.value)}
                          className="p-1.5 bg-white border rounded text-xs"
                        >
                          {HOTEL_LOCATIONS.map((h) => (
                            <option key={h.name} value={h.name}>
                              {h.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          placeholder="房型"
                          value={newRoomType}
                          onChange={(e) => setNewRoomType(e.target.value)}
                          className="p-1.5 bg-white border rounded text-xs"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="date"
                          value={newCheckIn}
                          onChange={(e) => setNewCheckIn(e.target.value)}
                          className="p-1.5 bg-white border rounded text-xs"
                        />
                        <input
                          type="date"
                          value={newCheckOut}
                          onChange={(e) => setNewCheckOut(e.target.value)}
                          className="p-1.5 bg-white border rounded text-xs"
                        />
                        <input
                          type="number"
                          min="1"
                          max={10}
                          value={newNights}
                          onChange={(e) => setNewNights(Number(e.target.value))}
                          className="p-1.5 bg-white border rounded text-xs text-center font-bold"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsAddingRecord(false)}
                          className="px-2 py-1 bg-white border rounded text-xs"
                        >
                          取消
                        </button>
                        <button
                          type="submit"
                          className="px-3 py-1 bg-blue-600 text-white font-bold rounded text-xs"
                        >
                          確認登記
                        </button>
                      </div>
                    </form>
                  )}

                  {history.length === 0 ? (
                    <div className="p-4 bg-slate-50 text-slate-400 text-center rounded-xl border border-dashed border-slate-200">
                      尚無住宿折抵紀錄，剩餘配額可在效期內自由規劃使用！
                    </div>
                  ) : (
                    history.map((record) => (
                      <div
                        key={record.id}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 flex items-center gap-1.5">
                            <Hotel className="w-3.5 h-3.5 text-blue-600" />
                            {record.hotelName} ({record.roomType})
                          </span>
                          <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            折抵 {record.nights} 晚
                          </span>
                        </div>
                        <div className="text-slate-500 text-[11px] flex items-center gap-3">
                          <span>住宿期間: {record.checkInDate} ~ {record.checkOutDate}</span>
                          <span>訂房編號: {record.bookingCode}</span>
                          {record.notes && <span>備註: {record.notes}</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-2 border-t border-slate-150">
                  <span className="text-slate-400 block mb-1">適用飯店館別：</span>
                  <div className="flex flex-wrap gap-1.5">
                    {eligibleHotels.map((h) => (
                      <span key={h} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px]">
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between">
          <span className="text-slate-400 text-[11px]">雲朗觀光 員工福利查詢系統</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
          >
            關閉視窗
          </button>
        </div>
      </div>
    </div>
  );
};
