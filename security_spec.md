# Firebase Security Specification (TDD)

## 1. Data Invariants
1. **Sales Tiers & Configuration**: Can only be read by authenticated users, and can only be updated/configured by HR managers (`HR_ADMIN`).
2. **Sales Records & Commission Rules**:
   - `SALES_LEADER` can only read and update specific status fields (to submit for review/approval: status must change to "核准中").
   - `HR_ADMIN` has full access to create, update, and delete sales records.
   - Any modification must maintain standard calculations and must not overwrite immutable employee IDs.
3. **Employees Salary Details**: Contains highly sensitive data (PII & direct salaries).
   - Only `HR_ADMIN` and `EXECUTIVE` can read employee salary records.
   - Only `HR_ADMIN` can write/import employee records.
   - Non-authenticated users or other roles are strictly denied access.
4. **Audit Trail Logs**:
   - Strictly immutable: Once written, they can never be modified or deleted.
   - Can only be read by authorized roles (`HR_ADMIN` and `EXECUTIVE`).
5. **Users & Credentials**:
   - Only `HR_ADMIN` can create, update, or delete system users.
   - User document path matches their userId to secure access.

---

## 2. The "Dirty Dozen" Malicious Payloads

### Payload 1: Privilege Escalation via User Account Creation
- **Objective**: Create a new user with `HR_ADMIN` role without having HR permission.
- **Path**: `/users/attacker_uid`
- **Payload**: `{"email": "attacker@ldchotels.com", "username": "attacker", "name": "Attacker", "password": "hack", "role": "HR_ADMIN"}`
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 2: Hostile Sales Config Hijack
- **Objective**: Change the sales commission rate of tier 1 from 2% to 90% as a salesperson or non-admin.
- **Path**: `/config/salesConfig`
- **Payload**: `{"tiers": [{"id": "t1", "min": 0, "max": 50000, "rate": 90, "label": "基本業績"}], "targetBonus": 1000000, "targetAmount": 100}`
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 3: Forging Sales Commission Record
- **Objective**: Sales leader directly overrides a sales record to status "已發放" (Approved/Paid) instead of "核准中" (Pending Review).
- **Path**: `/salesRecords/sr_1`
- **Payload**: `{"id": "sr_1", "empId": "S001", "name": "王小明 (Alvin)", "baseSalary": 38000, "salesAmount": 240000, "commission": 999999, "bonus": 99999, "totalPay": 1099998, "period": "2026-Q1", "status": "已發放"}`
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 4: Unauthorized Employee Salary Peek
- **Objective**: A standard sales leader attempts to download the master employee salary index.
- **Path**: `/employees/emp_1`
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 5: Unauthorized Audit Log Tampering
- **Objective**: Attacker attempts to delete or alter a system audit log to cover tracks.
- **Path**: `/auditLogs/log_123`
- **Payload**: `{"id": "log_123", "username": "HR 行政人員", "role": "HR_ADMIN", "action": "刪除記錄", "details": "Alteration attempt", "createdAt": "2026-07-01 09:00:15"}`
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 6: Spoofing Audit Log Owner
- **Objective**: A lower-tier role attempts to write an audit log entry acting as the HR admin.
- **Path**: `/auditLogs/log_new`
- **Payload**: `{"id": "log_new", "username": "HR 行政人員", "role": "HR_ADMIN", "action": "登入系統", "details": "Attacked", "createdAt": "2026-07-01 09:00:15"}`
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 7: Deleting Backup Files
- **Objective**: Delete official system S3 backups of median reports.
- **Path**: `/backups/bk_1`
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 8: Corrupting System Role Permissions
- **Objective**: Attacker attempts to grant `SALES_LEADER` the permission to view salaries and manage backups.
- **Path**: `/config/rolePermissions`
- **Payload**: `{"SALES_LEADER": {"view_salary": true, "calculate_commission": true, "manage_backups": true, "ai_compliance": true, "audit_trail": true, "permission_management": true}}`
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 9: Empty Document ID Bypass Attempt
- **Objective**: Push invalid key formats or oversized string values to crash document ID resolution.
- **Path**: `/salesRecords/invalid@character$#`
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 10: Modifying Employee Salary Directly (Non-HR)
- **Objective**: Attacker attempts to modify an employee's annual salary record.
- **Path**: `/employees/emp_1`
- **Payload**: `{"salary": 50000000}`
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 11: Inserting Invalid Fields in Config (Shadow Update Test)
- **Objective**: Update sales configuration with a hidden/shadow "ghost" key to bypass validation checks.
- **Path**: `/config/salesConfig`
- **Payload**: `{"tiers": [], "targetBonus": 10, "targetAmount": 100, "attackerGhostKey": "malicious_payload"}`
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 12: Anonymous Access Attempt
- **Objective**: Read system configurations without logging in.
- **Path**: `/config/salesConfig`
- **Expected Outcome**: `PERMISSION_DENIED`

---

## 3. Test Spec Configuration
All "Dirty Dozen" attempts must yield `PERMISSION_DENIED` during rule validation.
These access rules will be enforced at the firestore security rules engine level.
