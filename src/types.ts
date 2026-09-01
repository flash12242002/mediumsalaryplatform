export type UserRole = "HR_ADMIN" | "EXECUTIVE" | "SALES_LEADER";

export interface User {
  username: string;
  role: UserRole;
  email: string;
  permissions?: any;
}

export interface CommissionTier {
  id: string;
  min: number;
  max: number;
  rate: number;
  label: string;
}

export interface SalesConfig {
  tiers: CommissionTier[];
  targetBonus: number;
  targetAmount: number;
}

export interface SalesRecord {
  id: string;
  empId: string;
  name: string;
  baseSalary: number;
  salesAmount: number;
  commission: number;
  bonus: number;
  totalPay: number;
  period: string;
  status: "已計算" | "核准中" | "已發放";
}

export interface Employee {
  id: string;
  empId: string;
  name: string;
  title: string;
  department: string;
  salary: number; // in NTD
  welfare: number; // in NTD
  year: number;
  
  // CSV detailed salary breakdown fields
  months?: number; // 任職月數
  originalAnnualSalary?: number; // 原始年薪金額 (A)
  firstYearEndBonus?: number; // 第一次年終獎金(含董事長紅包)
  secondPerfBonus?: number; // 第二次績效獎金(含特別獎金)
  otherBonus?: number; // 其他獎金
  bonus28?: number; // 二八獎金
  companyStockContribution?: number; // 公提持股金
  salesCommission?: number; // 業績獎金
  workBonus?: number; // 工作獎金
  festivalBonus?: number; // 節金
  birthdayGift?: number; // 生日禮金
  overtime?: number; // 加班費
  severance?: number; // 資遣費離職金
  maternityAllowance?: number; // 生育津貼
  nonRegularSalary?: number; // 非經常性薪資 D
  monthlySalaries?: number[]; // 1月到12月薪資 [m1, m2, ..., m12]
}

export interface EmployeeStats {
  year: number;
  employeeCount: number;
  totalSalary: number;
  avgSalary: number;
  medianSalary: number;
  totalWelfare: number;
  avgWelfare: number;
  medianWelfare: number;
  yoySalaryCount: string;
  yoySalaryAvg: string;
  yoySalaryMedian: string;
  excludedCount?: number;
  excludedTotalSalary?: number;
  excludedAvgSalary?: number;
  excludedTotalWelfare?: number;
  excludedAvgWelfare?: number;
  excludedEmployees?: any[];
}

export interface Backup {
  id: string;
  filename: string;
  fileType: "PDF" | "CSV" | "JSON";
  size: string;
  createdBy: string;
  createdAt: string;
  url: string;
}

export interface AuditLog {
  id: string;
  username: string;
  role: UserRole;
  action: string;
  details: string;
  createdAt: string;
}
