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
export interface Dependent {
  name: string;
  relationship: string;
  idNumber: string;
  birthday: string;
}

export interface PersonalData {
  name: string;
  englishName?: string;
  avatarUrl?: string;
  idNumber: string;
  birthday: string;
  gender: string;
  bloodType?: string;
  phone: string;
  email: string;
  legalAddress: string;
  contactAddress: string;
  bankName: string;
  bankAccount: string;
  dependentsCount: string;
  dependents?: Dependent[];
  healthDependentsCount?: string;
  healthDependents?: Dependent[];
  emergencyName: string;
  emergencyRelationship: string;
  emergencyPhone: string;
}

export interface CareerExperience {
  companyName: string;
  jobTitle: string;
  startDate: string;
  endDate: string;
  leaveReason: string;
}

export interface Education {
  schoolName: string;
  major: string;
  degree: string;
  period: string;
  status: '?�業' | '?�業' | '就�?�? | '';
}

export interface ProfessionalLicense {
  licenseName: string;
  badgeLevel: string;
  issueDate: string;
  expiryDate: string;
}

export interface LanguageSkill {
  language: string; // '?��?' | '?��?' | '?��?' | '?��?'
  level: '精�? | '?�良' | '中�?' | '?��?' | '';
  customName?: string; // If '?��?', custom language name
}

export interface CareerData {
  experiences: CareerExperience[];
  educations?: Education[];
  licenses: ProfessionalLicense[];
  languages?: LanguageSkill[];
  additionalNotes: string;
}

export interface UploadedFile {
  name: string;
  size: number;
  uploadedAt: string;
  base64Data?: string;
  docType?: string;
}

export interface OnboardEmployee {
  id: string;
  empId?: string;
  name: string;
  email: string;
  authToken: string;
  department: string;
  title: string;
  onboardDate: string;
  status: 'pending' | 'completed';
  progress: number;
  personalData?: PersonalData;
  careerData?: CareerData;
  uploadedFiles: UploadedFile[];
  rulesAgreed: boolean;
  privacyAgreed: boolean;
  taxDeclaration?: TaxDeclaration;
  contractSigned: boolean;
  contractDate?: string;
  contractWorkLocation?: string;
  contractLeaveOption?: string;
  contractLeavedays?: string;
  contractSalaryType?: string;
  contractSalaryAmount?: string;
  contractProbationMonths?: string;
  guarantorSigned?: boolean;
  guarantorDate?: string;
  guarantorData?: GuarantorData;
  serviceSigned?: boolean;
  serviceDate?: string;
  updatedAt: string;
}

export interface GuarantorData {
  guarantorName: string;
  birthday: string;
  idNumber: string;
  address: string;
  phone: string;
  companyName: string;
  companyTitle: string;
  companyAddress: string;
  companyPhone: string;
  relationship: string;
  validUntil: string;
}

export interface TaxDependent {
  name: string;
  relationship: string;
  birthday: string;
  idNumber: string;
  condition: string;
  type: '?�系尊親�? | '子女' | '?��??��?姊妹' | '?��?親屬' | string;
}

export interface TaxDeclaration {
  spouseName: string;
  spouseBirthday: string;
  spouseIdNumber: string;
  dependents: TaxDependent[];
  signed: boolean;
  signName?: string;
  signedAt?: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
