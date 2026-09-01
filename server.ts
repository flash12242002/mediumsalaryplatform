import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

// Initialize Gemini AI
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use(express.json());

// ==========================================
// MySQL Connection Pool
// ==========================================
const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "hr_app",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "hr_system",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: "+08:00",
  charset: "utf8mb4",
});

// ==========================================
// Helper Functions
// ==========================================

const formatTime = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

function calculateCommission(salesAmount: number, config: { tiers: any[], targetBonus: number, targetAmount: number }) {
  let commission = 0;
  const sortedTiers = [...config.tiers].sort((a, b) => a.min - b.min);
  for (let i = 0; i < sortedTiers.length; i++) {
    const tier = sortedTiers[i];
    if (salesAmount > tier.min) {
      const rangeMax = Math.min(salesAmount, tier.max);
      const rangeApplicable = rangeMax - tier.min;
      if (rangeApplicable > 0) {
        commission += rangeApplicable * (tier.rate / 100);
      }
    }
  }
  let bonus = 0;
  if (salesAmount >= config.targetAmount) {
    bonus = config.targetBonus;
  }
  return {
    commission: Math.round(commission),
    bonus,
    totalPay: Math.round(commission + bonus)
  };
}

function getMedian(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) return sorted[half];
  return Math.round((sorted[half - 1] + sorted[half]) / 2);
}

async function addAuditLog(username: string, role: string, action: string, details: string) {
  try {
    const id = `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    await pool.query(
      `INSERT INTO audit_logs (id, username, role, action, details, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, username, role, action, details, formatTime()]
    );
    // Keep only last 100 logs
    await pool.query(
      `DELETE FROM audit_logs WHERE id NOT IN (SELECT id FROM (SELECT id FROM audit_logs ORDER BY created_at DESC LIMIT 100) t)`
    );
  } catch (err) {
    console.error("Error writing audit log:", err);
  }
}

async function getSalesConfig() {
  const [rows] = await pool.query(`SELECT * FROM sales_config WHERE id = 1`) as any[];
  if ((rows as any[]).length === 0) {
    return {
      tiers: [
        { id: "t1", min: 0, max: 50000, rate: 2, label: "基本業績" },
        { id: "t2", min: 50001, max: 150000, rate: 5, label: "標準業績" },
        { id: "t3", min: 150001, max: 300000, rate: 8, label: "優良業績" },
        { id: "t4", min: 300001, max: 99999999, rate: 12, label: "卓越業績" }
      ],
      targetBonus: 10000,
      targetAmount: 200000
    };
  }
  const row = (rows as any[])[0];
  return {
    tiers: typeof row.tiers === 'string' ? JSON.parse(row.tiers) : row.tiers,
    targetBonus: row.target_bonus,
    targetAmount: row.target_amount
  };
}

async function refreshCommissionRecords() {
  try {
    const config = await getSalesConfig();
    const [records] = await pool.query(`SELECT * FROM sales_records`) as any[];
    for (const rec of (records as any[])) {
      const cal = calculateCommission(Number(rec.sales_amount), config);
      await pool.query(
        `UPDATE sales_records SET commission=?, bonus=?, total_pay=? WHERE id=?`,
        [cal.commission, cal.bonus, Number(rec.base_salary) + cal.totalPay, rec.id]
      );
    }
  } catch (err) {
    console.error("Error refreshing commission records:", err);
  }
}

// ==========================================
// MySQL Table Initialization + Seeding
// ==========================================
async function initMySQL() {
  console.log("Initializing MySQL tables...");
  const conn = await pool.getConnection();
  try {
    await conn.query(`SET NAMES utf8mb4`);

    // Users table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        username VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Role Permissions table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role VARCHAR(50) PRIMARY KEY,
        permissions JSON NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Employees table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id VARCHAR(100) PRIMARY KEY,
        emp_id VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        title VARCHAR(255),
        department VARCHAR(255),
        salary BIGINT NOT NULL DEFAULT 0,
        welfare BIGINT NOT NULL DEFAULT 0,
        year INT NOT NULL,
        months FLOAT,
        original_annual_salary BIGINT,
        first_year_end_bonus BIGINT,
        second_perf_bonus BIGINT,
        other_bonus BIGINT,
        bonus28 BIGINT,
        company_stock_contribution BIGINT,
        sales_commission BIGINT,
        work_bonus BIGINT,
        festival_bonus BIGINT,
        birthday_gift BIGINT,
        overtime BIGINT,
        severance BIGINT,
        maternity_allowance BIGINT,
        non_regular_salary BIGINT,
        monthly_salaries JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_emp_id (emp_id),
        INDEX idx_year (year)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Members table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        emp_id VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        grade VARCHAR(50),
        onboarding_date VARCHAR(50),
        department VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Sales Config table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS sales_config (
        id INT PRIMARY KEY DEFAULT 1,
        tiers JSON NOT NULL,
        target_bonus INT NOT NULL DEFAULT 10000,
        target_amount INT NOT NULL DEFAULT 200000
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Sales Records table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS sales_records (
        id VARCHAR(100) PRIMARY KEY,
        emp_id VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        base_salary BIGINT NOT NULL DEFAULT 0,
        sales_amount BIGINT NOT NULL DEFAULT 0,
        commission BIGINT NOT NULL DEFAULT 0,
        bonus BIGINT NOT NULL DEFAULT 0,
        total_pay BIGINT NOT NULL DEFAULT 0,
        period VARCHAR(50),
        status VARCHAR(50) DEFAULT '已計算',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Insiders table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS insiders (
        emp_id VARCHAR(50) PRIMARY KEY
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Audit Logs table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(100) PRIMARY KEY,
        username VARCHAR(255),
        role VARCHAR(50),
        action VARCHAR(255),
        details TEXT,
        created_at VARCHAR(50),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Backups table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS backups (
        id VARCHAR(100) PRIMARY KEY,
        filename VARCHAR(500),
        file_type VARCHAR(50),
        size VARCHAR(50),
        created_by VARCHAR(255),
        created_at VARCHAR(50),
        url TEXT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Drive Sync Settings table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS drive_sync_settings (
        id INT PRIMARY KEY DEFAULT 1,
        folder_url VARCHAR(500),
        folder_id VARCHAR(200),
        auto_sync BOOLEAN DEFAULT FALSE,
        frequency VARCHAR(50) DEFAULT 'manual',
        last_sync_time VARCHAR(50),
        last_sync_status VARCHAR(50) DEFAULT 'idle',
        last_sync_log TEXT,
        target_year INT DEFAULT 2025,
        auth_mode VARCHAR(50) DEFAULT 'direct',
        google_client_id VARCHAR(500)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ── Seed Default Data (only if tables are empty) ──

    // Default Users
    const [existingUsers] = await conn.query(`SELECT COUNT(*) as count FROM users`) as any[];
    if ((existingUsers as any[])[0].count === 0) {
      await conn.query(`
        INSERT INTO users (email, username, name, password, role) VALUES
        ('gordon.huang@ldchotels.com', 'gordon.huang@ldchotels.com', 'Gordon', 'mis', 'HR_ADMIN'),
        ('vivian.chiang@ldchotels.com', 'vivian.chiang@ldchotels.com', '高階主管', 'mis', 'EXECUTIVE'),
        ('sales_director@ldchotels.com', 'sales_leader', '業務主管', 'sales', 'SALES_LEADER'),
        ('ann.hsu@ldchotels.com', 'ann.hsu@ldchotels.com', 'Ann', 'mis', 'HR_ADMIN')
      `);
      console.log("✅ Seeded default users.");
    }

    // Default Role Permissions
    const [existingPerms] = await conn.query(`SELECT COUNT(*) as count FROM role_permissions`) as any[];
    if ((existingPerms as any[])[0].count === 0) {
      const perms = [
        ['HR_ADMIN', JSON.stringify({ view_salary: true, calculate_commission: true, manage_backups: true, ai_compliance: true, audit_trail: true, permission_management: true })],
        ['EXECUTIVE', JSON.stringify({ view_salary: true, calculate_commission: false, manage_backups: false, ai_compliance: true, audit_trail: true, permission_management: false })],
        ['SALES_LEADER', JSON.stringify({ view_salary: false, calculate_commission: true, manage_backups: false, ai_compliance: false, audit_trail: false, permission_management: false })],
      ];
      for (const [role, permissions] of perms) {
        await conn.query(`INSERT INTO role_permissions (role, permissions) VALUES (?, ?)`, [role, permissions]);
      }
      console.log("✅ Seeded default role permissions.");
    }

    // Default Sales Config
    const [existingConfig] = await conn.query(`SELECT COUNT(*) as count FROM sales_config`) as any[];
    if ((existingConfig as any[])[0].count === 0) {
      const tiers = JSON.stringify([
        { id: "t1", min: 0, max: 50000, rate: 2, label: "基本業績" },
        { id: "t2", min: 50001, max: 150000, rate: 5, label: "標準業績" },
        { id: "t3", min: 150001, max: 300000, rate: 8, label: "優良業績" },
        { id: "t4", min: 300001, max: 99999999, rate: 12, label: "卓越業績" }
      ]);
      await conn.query(`INSERT INTO sales_config (id, tiers, target_bonus, target_amount) VALUES (1, ?, 10000, 200000)`, [tiers]);
      console.log("✅ Seeded default sales config.");
    }

    // Default Drive Sync Settings
    const [existingDrive] = await conn.query(`SELECT COUNT(*) as count FROM drive_sync_settings`) as any[];
    if ((existingDrive as any[])[0].count === 0) {
      await conn.query(`
        INSERT INTO drive_sync_settings (id, folder_url, folder_id, auto_sync, frequency, last_sync_status, target_year, auth_mode, google_client_id)
        VALUES (1, 'https://drive.google.com/drive/folders/1i8t5Q1r5-Y4RZeadGcq9QGEzLUponwQ7',
                '1i8t5Q1r5-Y4RZeadGcq9QGEzLUponwQ7', FALSE, 'manual', 'idle', 2025, 'direct', '')
      `);
      console.log("✅ Seeded default drive sync settings.");
    }

    console.log("🎉 MySQL initialization complete!");
  } catch (err) {
    console.error("❌ Failed to initialize MySQL tables:", err);
    throw err;
  } finally {
    conn.release();
  }
}

// ==========================================
// API ROUTES
// ==========================================

// Auth Endpoint
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;

  if (username === "LOGOUT") {
    return res.json({ success: true });
  }

  try {
    const [users] = await pool.query(
      `SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)`,
      [username, username]
    ) as any[];

    const [permRows] = await pool.query(`SELECT * FROM role_permissions`) as any[];
    const rolePermissions: any = {};
    for (const row of (permRows as any[])) {
      rolePermissions[row.role] = typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions;
    }

    if ((users as any[]).length > 0 && (users as any[])[0].password === password) {
      const userRecord = (users as any[])[0];
      const permissions = rolePermissions[userRecord.role] || {
        view_salary: false, calculate_commission: false, manage_backups: false,
        ai_compliance: false, audit_trail: false, permission_management: false
      };
      const matchedUser = {
        username: userRecord.name || userRecord.username,
        role: userRecord.role,
        email: userRecord.email,
        permissions
      };
      await addAuditLog(matchedUser.username, matchedUser.role, "登入系統", `成功登入系統，授予 ${matchedUser.role} 權限`);
      return res.json({ success: true, user: matchedUser });
    }

    return res.status(401).json({ success: false, message: "帳號或密碼錯誤 (Invalid username or password)" });
  } catch (err: any) {
    console.error("Login error:", err);
    return res.status(500).json({ success: false, message: "伺服器錯誤: " + err.message });
  }
});

// Permissions API Endpoints
app.get("/api/permissions", async (req, res) => {
  try {
    const [users] = await pool.query(`SELECT email, username, name, role FROM users`) as any[];
    const [permRows] = await pool.query(`SELECT * FROM role_permissions`) as any[];
    const rolePermissions: any = {};
    for (const row of (permRows as any[])) {
      rolePermissions[row.role] = typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions;
    }
    res.json({ success: true, users, rolePermissions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/permissions/roles", async (req, res) => {
  const { rolePermissions, username, role } = req.body;
  try {
    for (const [r, perms] of Object.entries(rolePermissions)) {
      await pool.query(
        `INSERT INTO role_permissions (role, permissions) VALUES (?, ?) ON DUPLICATE KEY UPDATE permissions = VALUES(permissions)`,
        [r, JSON.stringify(perms)]
      );
    }
    await addAuditLog(username || "管理員", role || "HR_ADMIN", "更新角色權限設定", "修改了系統角色的功能存取權限");
    res.json({ success: true, rolePermissions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/permissions/users", async (req, res) => {
  const { email, username, name, password, role: newRole, creatorUsername, creatorRole } = req.body;
  if (!email || !username || !name || !password || !newRole) {
    return res.status(400).json({ error: "所有欄位皆為必填！" });
  }
  try {
    const [existing] = await pool.query(
      `SELECT id FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)`,
      [email, username]
    ) as any[];
    if ((existing as any[]).length > 0) {
      return res.status(400).json({ error: "帳號或 E-mail 已存在！" });
    }
    await pool.query(
      `INSERT INTO users (email, username, name, password, role) VALUES (?, ?, ?, ?, ?)`,
      [email, username, name, password, newRole]
    );
    const [users] = await pool.query(`SELECT email, username, name, role FROM users`) as any[];
    await addAuditLog(creatorUsername || "管理員", creatorRole || "HR_ADMIN", "新增同仁帳號", `新增帳號: ${name} (${email}), 角色: ${newRole}`);
    res.json({ success: true, users });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/change-password", async (req, res) => {
  const { email, oldPassword, newPassword, username, role } = req.body;
  if (!email || !oldPassword || !newPassword) {
    return res.status(400).json({ error: "欄位不足！" });
  }
  try {
    const [users] = await pool.query(`SELECT * FROM users WHERE LOWER(email) = LOWER(?)`, [email]) as any[];
    if ((users as any[]).length === 0) return res.status(404).json({ error: "找不到該同仁帳號！" });
    const user = (users as any[])[0];
    if (user.password !== oldPassword) return res.status(400).json({ error: "舊密碼不正確！" });
    await pool.query(`UPDATE users SET password = ? WHERE LOWER(email) = LOWER(?)`, [newPassword, email]);
    await addAuditLog(username || user.name, role || user.role, "修改密碼", `同仁 ${user.name} (${email}) 成功變更登入密碼`);
    res.json({ success: true, message: "密碼修改成功！" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Audit Logs Endpoint
app.get("/api/audit/logs", async (req, res) => {
  try {
    const [logs] = await pool.query(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100`) as any[];
    const mapped = (logs as any[]).map((l) => ({
      id: l.id, username: l.username, role: l.role,
      action: l.action, details: l.details, createdAt: l.created_at
    }));
    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Sales Config API
app.get("/api/sales/config", async (req, res) => {
  try {
    const config = await getSalesConfig();
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/sales/config", async (req, res) => {
  const { tiers, targetBonus, targetAmount, username, role } = req.body;
  if (role !== "HR_ADMIN") {
    return res.status(403).json({ error: "權限不足，僅限HR管理員修改 (HR Admin permission required)" });
  }
  try {
    await pool.query(
      `INSERT INTO sales_config (id, tiers, target_bonus, target_amount) VALUES (1, ?, ?, ?)
       ON DUPLICATE KEY UPDATE tiers=VALUES(tiers), target_bonus=VALUES(target_bonus), target_amount=VALUES(target_amount)`,
      [JSON.stringify(tiers), targetBonus, targetAmount]
    );
    await refreshCommissionRecords();
    await addAuditLog(username, role, "更新獎金參數", `變動了業績獎金級距與達標參數：高額獎金門檻：${targetAmount}，達標獎勵：${targetBonus}`);
    const config = await getSalesConfig();
    res.json({ success: true, salesConfig: config });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Google Direct OAuth callback
app.get("/auth/google/callback", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Google Direct Authorization Callback</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background: #f8fafc;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
        }
        .container {
          background: white;
          border-radius: 12px;
          padding: 40px;
          max-width: 480px;
          width: 90%;
          box-shadow: 0 4px 24px rgba(0,0,0,0.08);
          text-align: center;
        }
        .icon { font-size: 48px; margin-bottom: 16px; }
        h2 { color: #1a202c; margin: 0 0 8px; font-size: 1.4rem; }
        p { color: #64748b; margin: 0; }
        .spinner {
          width: 40px; height: 40px;
          border: 4px solid #e2e8f0;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 20px auto 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">🔐</div>
        <h2>正在處理 Google 授權...</h2>
        <p>請稍候，視窗將自動關閉。</p>
        <div class="spinner"></div>
      </div>
      <script>
        (function() {
          var hash = window.location.hash.substring(1);
          var params = new URLSearchParams(hash);
          var accessToken = params.get('access_token');
          var error = params.get('error');

          if (accessToken) {
            if (window.opener) {
              window.opener.postMessage({ type: 'GOOGLE_DIRECT_AUTH_SUCCESS', accessToken: accessToken }, window.location.origin);
            }
            localStorage.setItem("gdrive_access_token_direct", accessToken);
            setTimeout(function() { window.close(); }, 1000);
          } else if (error) {
            if (window.opener) {
              window.opener.postMessage({ type: 'GOOGLE_DIRECT_AUTH_FAILURE', error: error }, window.location.origin);
            }
            setTimeout(function() { window.close(); }, 2000);
          } else {
            var code = params.get('code') || new URLSearchParams(window.location.search).get('code');
            if (code && window.opener) {
              window.opener.postMessage({ type: 'GOOGLE_DIRECT_AUTH_CODE', code: code }, window.location.origin);
            }
            setTimeout(function() { window.close(); }, 1500);
          }
        })();
      </script>
    </body>
    </html>
  `);
});

// Google Drive Sync Settings API
app.get("/api/drive-sync/settings", async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM drive_sync_settings WHERE id = 1`) as any[];
    if ((rows as any[]).length === 0) {
      return res.json({
        folderUrl: "https://drive.google.com/drive/folders/1i8t5Q1r5-Y4RZeadGcq9QGEzLUponwQ7",
        folderId: "1i8t5Q1r5-Y4RZeadGcq9QGEzLUponwQ7",
        autoSync: false, frequency: "manual", lastSyncTime: null,
        lastSyncStatus: "idle", lastSyncLog: "", targetYear: 2025,
        authMode: "direct", googleClientId: ""
      });
    }
    const r = (rows as any[])[0];
    res.json({
      folderUrl: r.folder_url, folderId: r.folder_id, autoSync: !!r.auto_sync,
      frequency: r.frequency, lastSyncTime: r.last_sync_time,
      lastSyncStatus: r.last_sync_status, lastSyncLog: r.last_sync_log,
      targetYear: r.target_year, authMode: r.auth_mode, googleClientId: r.google_client_id
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/drive-sync/settings", async (req, res) => {
  const {
    folderUrl, folderId, autoSync, frequency, lastSyncTime, lastSyncStatus, lastSyncLog, targetYear,
    username, role, authMode, googleClientId
  } = req.body;
  if (role !== "HR_ADMIN") {
    return res.status(403).json({ error: "權限不足，僅限HR管理員修改" });
  }
  try {
    await pool.query(`
      INSERT INTO drive_sync_settings
        (id, folder_url, folder_id, auto_sync, frequency, last_sync_time, last_sync_status, last_sync_log, target_year, auth_mode, google_client_id)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        folder_url=VALUES(folder_url), folder_id=VALUES(folder_id), auto_sync=VALUES(auto_sync),
        frequency=VALUES(frequency), last_sync_time=VALUES(last_sync_time),
        last_sync_status=VALUES(last_sync_status), last_sync_log=VALUES(last_sync_log),
        target_year=VALUES(target_year), auth_mode=VALUES(auth_mode), google_client_id=VALUES(google_client_id)
    `, [
      folderUrl || "https://drive.google.com/drive/folders/1i8t5Q1r5-Y4RZeadGcq9QGEzLUponwQ7",
      folderId || "1i8t5Q1r5-Y4RZeadGcq9QGEzLUponwQ7",
      !!autoSync, frequency || "manual",
      lastSyncTime !== undefined ? lastSyncTime : null,
      lastSyncStatus || "idle",
      lastSyncLog !== undefined ? lastSyncLog : "",
      Number(targetYear || 2025),
      authMode || "direct",
      googleClientId || ""
    ]);
    await addAuditLog(username, role, "更新雲端同步設定",
      `更新 Google Drive 自動同步排程：${frequency}，目標夾：${folderId}，驗證模式：${authMode || "direct"}`);
    const [rows] = await pool.query(`SELECT * FROM drive_sync_settings WHERE id = 1`) as any[];
    const r = (rows as any[])[0];
    res.json({
      success: true, driveSyncSettings: {
        folderUrl: r.folder_url, folderId: r.folder_id, autoSync: !!r.auto_sync,
        frequency: r.frequency, lastSyncTime: r.last_sync_time,
        lastSyncStatus: r.last_sync_status, lastSyncLog: r.last_sync_log,
        targetYear: r.target_year, authMode: r.auth_mode, googleClientId: r.google_client_id
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Sales Records API
app.get("/api/sales/records", async (req, res) => {
  try {
    const [records] = await pool.query(`SELECT * FROM sales_records ORDER BY created_at DESC`) as any[];
    const mapped = (records as any[]).map((r) => ({
      id: r.id, empId: r.emp_id, name: r.name, baseSalary: r.base_salary,
      salesAmount: r.sales_amount, commission: r.commission, bonus: r.bonus,
      totalPay: r.total_pay, period: r.period, status: r.status
    }));
    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/sales/records", async (req, res) => {
  const { empId, name, baseSalary, salesAmount, period, username, role } = req.body;
  if (role !== "HR_ADMIN") {
    return res.status(403).json({ error: "權限不足 (HR Admin permission required)" });
  }
  try {
    const config = await getSalesConfig();
    const cal = calculateCommission(Number(salesAmount), config);
    const id = `sr_${Date.now()}`;
    await pool.query(
      `INSERT INTO sales_records (id, emp_id, name, base_salary, sales_amount, commission, bonus, total_pay, period, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, empId, name, Number(baseSalary), Number(salesAmount), cal.commission, cal.bonus,
        Number(baseSalary) + cal.totalPay, period, "已計算"]
    );
    await addAuditLog(username, role, "新增業績記錄",
      `為員工 ${name} (${empId}) 建立 ${period} 的業績記錄，業績：${salesAmount}，計算獎金：${cal.totalPay}`);
    res.json({
      success: true, record: {
        id, empId, name, baseSalary: Number(baseSalary), salesAmount: Number(salesAmount),
        commission: cal.commission, bonus: cal.bonus,
        totalPay: Number(baseSalary) + cal.totalPay, period, status: "已計算"
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/sales/records/:id", async (req, res) => {
  const { id } = req.params;
  const { salesAmount, baseSalary, status, username, role } = req.body;
  if (role === "SALES_LEADER" && status && status !== "核准中") {
    return res.status(403).json({ error: "業務主管僅能送出核准，不可直接變更狀態 (Access denied)" });
  }
  if (role !== "HR_ADMIN" && role !== "SALES_LEADER") {
    return res.status(403).json({ error: "權限不足 (Permission required)" });
  }
  try {
    const [rows] = await pool.query(`SELECT * FROM sales_records WHERE id = ?`, [id]) as any[];
    if ((rows as any[]).length === 0) return res.status(404).json({ error: "找不到該筆業績記錄" });
    const old = (rows as any[])[0];
    const newSalesAmount = salesAmount !== undefined ? Number(salesAmount) : Number(old.sales_amount);
    const newBaseSalary = baseSalary !== undefined ? Number(baseSalary) : Number(old.base_salary);
    const newStatus = status !== undefined ? status : old.status;
    const config = await getSalesConfig();
    const cal = calculateCommission(newSalesAmount, config);
    await pool.query(
      `UPDATE sales_records SET base_salary=?, sales_amount=?, commission=?, bonus=?, total_pay=?, status=? WHERE id=?`,
      [newBaseSalary, newSalesAmount, cal.commission, cal.bonus, newBaseSalary + cal.totalPay, newStatus, id]
    );
    await addAuditLog(username, role, "修改業績記錄",
      `更新 ${old.name} (${old.period}) 業績獎金：狀態變更為 ${newStatus}`);
    res.json({
      success: true, record: {
        id, empId: old.emp_id, name: old.name, baseSalary: newBaseSalary,
        salesAmount: newSalesAmount, commission: cal.commission, bonus: cal.bonus,
        totalPay: newBaseSalary + cal.totalPay, period: old.period, status: newStatus
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/sales/records/:id", async (req, res) => {
  const { id } = req.params;
  const { username, role } = req.query;
  if (role !== "HR_ADMIN") {
    return res.status(403).json({ error: "權限不足 (HR Admin permission required)" });
  }
  try {
    const [rows] = await pool.query(`SELECT * FROM sales_records WHERE id = ?`, [id]) as any[];
    if ((rows as any[]).length === 0) return res.status(404).json({ error: "找不到該筆業績記錄" });
    const record = (rows as any[])[0];
    await pool.query(`DELETE FROM sales_records WHERE id = ?`, [id]);
    await addAuditLog(String(username), String(role), "刪除業績記錄",
      `刪除了 ${record.name} (${record.period}) 的業績獎金計算明細`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Employee Salary Records API (for Median listings report)
app.get("/api/employees/records", async (req, res) => {
  const { role } = req.query;
  if (role !== "HR_ADMIN" && role !== "EXECUTIVE") {
    return res.status(403).json({ error: "權限不足！此資料包含敏感薪資欄位，僅限 HR 人員或高階主管查看。" });
  }
  try {
    const [employees] = await pool.query(`SELECT * FROM employees ORDER BY year DESC`) as any[];
    const [members] = await pool.query(`SELECT * FROM members`) as any[];
    const mapped = (employees as any[]).map((e) => {
      const m = (members as any[]).find((m) => m.emp_id === e.emp_id);
      return {
        id: e.id, empId: e.emp_id, name: e.name, title: e.title,
        department: (m && m.department) ? m.department : e.department,
        salary: e.salary, welfare: e.welfare, year: e.year,
        months: e.months,
        originalAnnualSalary: e.original_annual_salary,
        firstYearEndBonus: e.first_year_end_bonus,
        secondPerfBonus: e.second_perf_bonus,
        otherBonus: e.other_bonus,
        bonus28: e.bonus28,
        companyStockContribution: e.company_stock_contribution,
        salesCommission: e.sales_commission,
        workBonus: e.work_bonus,
        festivalBonus: e.festival_bonus,
        birthdayGift: e.birthday_gift,
        overtime: e.overtime,
        severance: e.severance,
        maternityAllowance: e.maternity_allowance,
        nonRegularSalary: e.non_regular_salary,
        monthlySalaries: typeof e.monthly_salaries === 'string'
          ? JSON.parse(e.monthly_salaries || 'null') : e.monthly_salaries,
      };
    });
    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/employees/import", async (req, res) => {
  const { employees, year, username, role } = req.body;
  if (role !== "HR_ADMIN") {
    return res.status(403).json({ error: "權限不足，僅限HR人員匯入員工薪資 (HR Admin only)" });
  }
  if (!Array.isArray(employees) || employees.length === 0) {
    return res.status(400).json({ error: "無效的匯入數據" });
  }
  try {
    let addedCount = 0;
    let updatedCount = 0;
    const targetYear = Number(year);
    for (const emp of employees) {
      const [existing] = await pool.query(
        `SELECT id FROM employees WHERE emp_id = ? AND year = ?`, [emp.empId, targetYear]
      ) as any[];
      const empValues = [
        emp.name, emp.title || "全時人員", emp.department || "研發部",
        Math.max(0, Number(emp.salary || 0)), Math.max(0, Number(emp.welfare || 70000)), targetYear,
        emp.months !== undefined ? Number(emp.months) : null,
        emp.originalAnnualSalary !== undefined ? Number(emp.originalAnnualSalary) : null,
        emp.firstYearEndBonus !== undefined ? Number(emp.firstYearEndBonus) : null,
        emp.secondPerfBonus !== undefined ? Number(emp.secondPerfBonus) : null,
        emp.otherBonus !== undefined ? Number(emp.otherBonus) : null,
        emp.bonus28 !== undefined ? Number(emp.bonus28) : null,
        emp.companyStockContribution !== undefined ? Number(emp.companyStockContribution) : null,
        emp.salesCommission !== undefined ? Number(emp.salesCommission) : null,
        emp.workBonus !== undefined ? Number(emp.workBonus) : null,
        emp.festivalBonus !== undefined ? Number(emp.festivalBonus) : null,
        emp.birthdayGift !== undefined ? Number(emp.birthdayGift) : null,
        emp.overtime !== undefined ? Number(emp.overtime) : null,
        emp.severance !== undefined ? Number(emp.severance) : null,
        emp.maternityAllowance !== undefined ? Number(emp.maternityAllowance) : null,
        emp.nonRegularSalary !== undefined ? Number(emp.nonRegularSalary) : null,
        Array.isArray(emp.monthlySalaries) ? JSON.stringify(emp.monthlySalaries) : null,
      ];
      if ((existing as any[]).length > 0) {
        await pool.query(`
          UPDATE employees SET
            name=?, title=?, department=?, salary=?, welfare=?, year=?,
            months=?, original_annual_salary=?, first_year_end_bonus=?, second_perf_bonus=?,
            other_bonus=?, bonus28=?, company_stock_contribution=?, sales_commission=?,
            work_bonus=?, festival_bonus=?, birthday_gift=?, overtime=?, severance=?,
            maternity_allowance=?, non_regular_salary=?, monthly_salaries=?
          WHERE emp_id=? AND year=?
        `, [...empValues, emp.empId, targetYear]);
        updatedCount++;
      } else {
        const id = `emp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        await pool.query(`
          INSERT INTO employees (
            id, emp_id, name, title, department, salary, welfare, year,
            months, original_annual_salary, first_year_end_bonus, second_perf_bonus,
            other_bonus, bonus28, company_stock_contribution, sales_commission,
            work_bonus, festival_bonus, birthday_gift, overtime, severance,
            maternity_allowance, non_regular_salary, monthly_salaries
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [id, emp.empId, ...empValues]);
        addedCount++;
      }
      // Sync with members table
      const [existingMember] = await pool.query(`SELECT id FROM members WHERE emp_id = ?`, [emp.empId]) as any[];
      if ((existingMember as any[]).length > 0) {
        await pool.query(`UPDATE members SET department=? WHERE emp_id=?`, [emp.department || "研發部", emp.empId]);
      } else {
        await pool.query(
          `INSERT INTO members (emp_id, name, grade, onboarding_date, department) VALUES (?, ?, ?, ?, ?)`,
          [emp.empId, emp.name, "一般", "", emp.department || "研發部"]
        );
      }
    }
    await addAuditLog(username, role, "匯入員工薪資",
      `成功匯入 ${year} 年度員工薪水 CSV。新增：${addedCount} 筆，覆蓋更新：${updatedCount} 筆。`);
    res.json({ success: true, addedCount, updatedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/employees/records", async (req, res) => {
  const {
    empId, name, title, department, salary, welfare, year, username, role,
    months, originalAnnualSalary, firstYearEndBonus, secondPerfBonus, otherBonus,
    bonus28, companyStockContribution, salesCommission, workBonus, festivalBonus,
    birthdayGift, overtime, severance, maternityAllowance, nonRegularSalary, monthlySalaries
  } = req.body;
  if (role !== "HR_ADMIN") {
    return res.status(403).json({ error: "權限不足，僅限HR人員新增員工薪資 (HR Admin only)" });
  }
  try {
    const id = `emp_${Date.now()}`;
    await pool.query(`
      INSERT INTO employees (
        id, emp_id, name, title, department, salary, welfare, year,
        months, original_annual_salary, first_year_end_bonus, second_perf_bonus,
        other_bonus, bonus28, company_stock_contribution, sales_commission,
        work_bonus, festival_bonus, birthday_gift, overtime, severance,
        maternity_allowance, non_regular_salary, monthly_salaries
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, empId, name, title, department, Number(salary), Number(welfare), Number(year),
      months !== undefined ? Number(months) : null,
      originalAnnualSalary !== undefined ? Number(originalAnnualSalary) : null,
      firstYearEndBonus !== undefined ? Number(firstYearEndBonus) : null,
      secondPerfBonus !== undefined ? Number(secondPerfBonus) : null,
      otherBonus !== undefined ? Number(otherBonus) : null,
      bonus28 !== undefined ? Number(bonus28) : null,
      companyStockContribution !== undefined ? Number(companyStockContribution) : null,
      salesCommission !== undefined ? Number(salesCommission) : null,
      workBonus !== undefined ? Number(workBonus) : null,
      festivalBonus !== undefined ? Number(festivalBonus) : null,
      birthdayGift !== undefined ? Number(birthdayGift) : null,
      overtime !== undefined ? Number(overtime) : null,
      severance !== undefined ? Number(severance) : null,
      maternityAllowance !== undefined ? Number(maternityAllowance) : null,
      nonRegularSalary !== undefined ? Number(nonRegularSalary) : null,
      Array.isArray(monthlySalaries) ? JSON.stringify(monthlySalaries) : null,
    ]);
    // Sync with members table
    const [existingMember] = await pool.query(`SELECT id FROM members WHERE emp_id = ?`, [empId]) as any[];
    if ((existingMember as any[]).length > 0) {
      await pool.query(`UPDATE members SET department=? WHERE emp_id=?`, [department, empId]);
    } else {
      await pool.query(
        `INSERT INTO members (emp_id, name, grade, onboarding_date, department) VALUES (?, ?, ?, ?, ?)`,
        [empId, name, "一般", "", department]
      );
    }
    await addAuditLog(username, role, "新增員工薪資記錄",
      `建立 ${year} 年度非主管員工：${name} (${empId})，薪資：${salary}，福利金：${welfare}`);
    res.json({
      success: true,
      employee: { id, empId, name, title, department, salary: Number(salary), welfare: Number(welfare), year: Number(year) }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/employees/records/:id", async (req, res) => {
  const { id } = req.params;
  const {
    name, title, department, salary, welfare, year, username, role,
    months, originalAnnualSalary, firstYearEndBonus, secondPerfBonus, otherBonus,
    bonus28, companyStockContribution, salesCommission, workBonus, festivalBonus,
    birthdayGift, overtime, severance, maternityAllowance, nonRegularSalary, monthlySalaries
  } = req.body;
  if (role !== "HR_ADMIN") {
    return res.status(403).json({ error: "權限不足，僅限HR人員修改員工薪資 (HR Admin only)" });
  }
  try {
    const [rows] = await pool.query(`SELECT * FROM employees WHERE id = ?`, [id]) as any[];
    if ((rows as any[]).length === 0) return res.status(404).json({ error: "找不到該員工薪資記錄" });
    const old = (rows as any[])[0];
    await pool.query(`
      UPDATE employees SET
        name=?, title=?, department=?, salary=?, welfare=?, year=?,
        months=?, original_annual_salary=?, first_year_end_bonus=?, second_perf_bonus=?,
        other_bonus=?, bonus28=?, company_stock_contribution=?, sales_commission=?,
        work_bonus=?, festival_bonus=?, birthday_gift=?, overtime=?, severance=?,
        maternity_allowance=?, non_regular_salary=?, monthly_salaries=?
      WHERE id=?
    `, [
      name || old.name, title || old.title, department || old.department,
      salary !== undefined ? Number(salary) : old.salary,
      welfare !== undefined ? Number(welfare) : old.welfare,
      year !== undefined ? Number(year) : old.year,
      months !== undefined ? Number(months) : old.months,
      originalAnnualSalary !== undefined ? Number(originalAnnualSalary) : old.original_annual_salary,
      firstYearEndBonus !== undefined ? Number(firstYearEndBonus) : old.first_year_end_bonus,
      secondPerfBonus !== undefined ? Number(secondPerfBonus) : old.second_perf_bonus,
      otherBonus !== undefined ? Number(otherBonus) : old.other_bonus,
      bonus28 !== undefined ? Number(bonus28) : old.bonus28,
      companyStockContribution !== undefined ? Number(companyStockContribution) : old.company_stock_contribution,
      salesCommission !== undefined ? Number(salesCommission) : old.sales_commission,
      workBonus !== undefined ? Number(workBonus) : old.work_bonus,
      festivalBonus !== undefined ? Number(festivalBonus) : old.festival_bonus,
      birthdayGift !== undefined ? Number(birthdayGift) : old.birthday_gift,
      overtime !== undefined ? Number(overtime) : old.overtime,
      severance !== undefined ? Number(severance) : old.severance,
      maternityAllowance !== undefined ? Number(maternityAllowance) : old.maternity_allowance,
      nonRegularSalary !== undefined ? Number(nonRegularSalary) : old.non_regular_salary,
      Array.isArray(monthlySalaries) ? JSON.stringify(monthlySalaries) : old.monthly_salaries,
      id
    ]);
    // Sync with members table
    const updatedDept = department || old.department;
    const [existingMember] = await pool.query(`SELECT id FROM members WHERE emp_id = ?`, [old.emp_id]) as any[];
    if ((existingMember as any[]).length > 0) {
      if (updatedDept) await pool.query(`UPDATE members SET department=? WHERE emp_id=?`, [updatedDept, old.emp_id]);
    } else {
      await pool.query(
        `INSERT INTO members (emp_id, name, grade, onboarding_date, department) VALUES (?, ?, ?, ?, ?)`,
        [old.emp_id, name || old.name, "一般", "", updatedDept || "."]
      );
    }
    await addAuditLog(username, role, "修改員工薪資記錄",
      `更新 ${name || old.name} (${year || old.year}年度) 薪資與福利資料`);
    res.json({ success: true, employee: { id, empId: old.emp_id, name: name || old.name } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/employees/records/:id", async (req, res) => {
  const { id } = req.params;
  const { username, role } = req.query;
  if (role !== "HR_ADMIN") {
    return res.status(403).json({ error: "權限不足，僅限HR人員刪除員工薪資 (HR Admin only)" });
  }
  try {
    const [rows] = await pool.query(`SELECT * FROM employees WHERE id = ?`, [id]) as any[];
    if ((rows as any[]).length === 0) return res.status(404).json({ error: "找不到該員工薪資記錄" });
    const emp = (rows as any[])[0];
    await pool.query(`DELETE FROM employees WHERE id = ?`, [id]);
    await addAuditLog(String(username), String(role), "刪除員工薪資記錄",
      `刪除了 ${emp.name} (${emp.year}年度) 申報資料`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/employees/records", async (req, res) => {
  const { username, role, year } = req.query;
  if (role !== "HR_ADMIN") {
    return res.status(403).json({ error: "權限不足，僅限HR人員刪除員工薪資 (HR Admin only)" });
  }
  try {
    if (year) {
      const targetYear = Number(year);
      const [result] = await pool.query(`SELECT COUNT(*) as count FROM employees WHERE year = ?`, [targetYear]) as any[];
      const deletedCount = (result as any[])[0].count;
      await pool.query(`DELETE FROM employees WHERE year = ?`, [targetYear]);
      await addAuditLog(String(username), String(role), "批次刪除員工薪資",
        `批次刪除了 ${targetYear} 年度所有員工申報資料，共 ${deletedCount} 筆`);
      return res.json({ success: true, deletedCount });
    } else {
      const [result] = await pool.query(`SELECT COUNT(*) as count FROM employees`) as any[];
      const deletedCount = (result as any[])[0].count;
      await pool.query(`DELETE FROM employees`);
      await addAuditLog(String(username), String(role), "清空所有員工薪資",
        `清空了所有年度的員工申報資料，共 ${deletedCount} 筆`);
      return res.json({ success: true, deletedCount });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Member Management (人員管理) Endpoints
app.get("/api/members", async (req, res) => {
  try {
    const [members] = await pool.query(`SELECT * FROM members`) as any[];
    const mapped = (members as any[]).map((m) => ({
      empId: m.emp_id, name: m.name, grade: m.grade,
      onboardingDate: m.onboarding_date, department: m.department
    }));
    res.json({ success: true, members: mapped });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/members/bulk", async (req, res) => {
  const { username, role, members } = req.body;
  if (role !== "HR_ADMIN") {
    return res.status(403).json({ error: "權限不足，僅限HR人員上傳管理人員資料" });
  }
  if (!Array.isArray(members)) {
    return res.status(400).json({ error: "資料格式錯誤" });
  }
  try {
    await pool.query(`DELETE FROM members`);
    for (const m of members) {
      await pool.query(
        `INSERT INTO members (emp_id, name, grade, onboarding_date, department) VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), grade=VALUES(grade), onboarding_date=VALUES(onboarding_date), department=VALUES(department)`,
        [m.empId || m.emp_id, m.name, m.grade || "一般", m.onboardingDate || m.onboarding_date || "", m.department || ""]
      );
    }
    await addAuditLog(String(username), String(role), "匯入人員名單", `匯入了 ${members.length} 筆人員基本資料`);
    res.json({ success: true, count: members.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/members", async (req, res) => {
  const { username, role } = req.query;
  if (role !== "HR_ADMIN") {
    return res.status(403).json({ error: "權限不足，僅限HR人員清空人員資料" });
  }
  try {
    const [result] = await pool.query(`SELECT COUNT(*) as count FROM members`) as any[];
    const originalCount = (result as any[])[0].count;
    await pool.query(`DELETE FROM members`);
    await addAuditLog(String(username), String(role), "清空人員名單", `清空了所有人員基本資料，共 ${originalCount} 筆`);
    res.json({ success: true, deletedCount: originalCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Insiders (內部人) Management Endpoints
app.get("/api/insiders", async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT emp_id FROM insiders`) as any[];
    res.json({ success: true, insiders: (rows as any[]).map((r) => r.emp_id) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/insiders", async (req, res) => {
  const { empId, username, role } = req.body;
  if (!empId) return res.status(400).json({ error: "缺少員工編號 (empId)" });
  try {
    await pool.query(`INSERT IGNORE INTO insiders (emp_id) VALUES (?)`, [empId]);
    await addAuditLog(String(username || "系統"), String(role || "HR_ADMIN"), "設定內部人", `將員編 ${empId} 設定為內部人`);
    const [rows] = await pool.query(`SELECT emp_id FROM insiders`) as any[];
    res.json({ success: true, insiders: (rows as any[]).map((r) => r.emp_id) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/insiders/:empId", async (req, res) => {
  const { empId } = req.params;
  const { username, role } = req.query;
  try {
    await pool.query(`DELETE FROM insiders WHERE emp_id = ?`, [empId]);
    await addAuditLog(String(username || "系統"), String(role || "HR_ADMIN"), "取消設定內部人", `將員編 ${empId} 取消內部人身分`);
    const [rows] = await pool.query(`SELECT emp_id FROM insiders`) as any[];
    res.json({ success: true, insiders: (rows as any[]).map((r) => r.emp_id) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Dynamic Statistics Engine
app.get("/api/employees/statistics", async (req, res) => {
  const { role } = req.query;
  if (role !== "HR_ADMIN" && role !== "EXECUTIVE") {
    return res.status(403).json({ error: "權限不足，無權存取申報統計數據！" });
  }
  try {
    const [employees] = await pool.query(`SELECT * FROM employees`) as any[];
    const [members] = await pool.query(`SELECT * FROM members`) as any[];
    const [insiderRows] = await pool.query(`SELECT emp_id FROM insiders`) as any[];
    const insidersList = (insiderRows as any[]).map((r) => r.emp_id);
    const boardEmpIds = (members as any[]).filter((m) => m.grade === "9").map((m) => m.emp_id);

    const enrichedEmployees = (employees as any[]).map((e) => {
      const m = (members as any[]).find((m) => m.emp_id === e.emp_id);
      return { ...e, department: (m && m.department) ? m.department : e.department };
    });

    const isExcluded = (empId: string) => boardEmpIds.includes(empId) || insidersList.includes(empId);
    const years: number[] = [...new Set(enrichedEmployees.map((e) => e.year as number))];

    const statsByYear: any = {};
    for (const yr of years) {
      const yrEmployees = enrichedEmployees.filter((e) => e.year === yr);
      if (yrEmployees.length === 0) continue;
      const reportEmployees = yrEmployees.filter((e) => !isExcluded(e.emp_id));
      const excludedEmployees = yrEmployees.filter((e) => isExcluded(e.emp_id));
      const count = reportEmployees.length;
      const totalSalary = reportEmployees.reduce((sum, e) => sum + Number(e.salary), 0);
      const totalWelfare = reportEmployees.reduce((sum, e) => sum + Number(e.welfare), 0);
      const salaries = reportEmployees.map((e) => Number(e.salary));
      const welfares = reportEmployees.map((e) => Number(e.welfare));
      const avgSalary = count > 0 ? Math.round(totalSalary / count) : 0;
      const medianSalary = count > 0 ? getMedian(salaries) : 0;
      const avgWelfare = count > 0 ? Math.round(totalWelfare / count) : 0;
      const medianWelfare = count > 0 ? getMedian(welfares) : 0;
      const excludedCount = excludedEmployees.length;
      const excludedTotalSalary = excludedEmployees.reduce((sum, e) => sum + Number(e.salary), 0);
      const excludedAvgSalary = excludedCount > 0 ? Math.round(excludedTotalSalary / excludedCount) : 0;
      const excludedTotalWelfare = excludedEmployees.reduce((sum, e) => sum + Number(e.welfare), 0);
      const excludedAvgWelfare = excludedCount > 0 ? Math.round(excludedTotalWelfare / excludedCount) : 0;
      statsByYear[yr] = {
        year: yr, employeeCount: count, totalSalary, avgSalary, medianSalary,
        totalWelfare, avgWelfare, medianWelfare,
        excludedCount, excludedTotalSalary, excludedAvgSalary, excludedTotalWelfare, excludedAvgWelfare,
        excludedEmployees: excludedEmployees.map((e) => ({
          empId: e.emp_id, name: e.name, title: e.title, department: e.department,
          salary: e.salary, welfare: e.welfare,
          isBoard: boardEmpIds.includes(e.emp_id), isInsider: insidersList.includes(e.emp_id)
        }))
      };
    }

    const calculatedStats = Object.values(statsByYear).map((stat: any) => {
      const prevStat = statsByYear[stat.year - 1];
      let yoySalaryCount = "N/A", yoySalaryAvg = "N/A", yoySalaryMedian = "N/A";
      if (prevStat) {
        yoySalaryCount = prevStat.employeeCount > 0
          ? (((stat.employeeCount - prevStat.employeeCount) / prevStat.employeeCount) * 100).toFixed(2) + "%" : "0.00%";
        yoySalaryAvg = prevStat.avgSalary > 0
          ? (((stat.avgSalary - prevStat.avgSalary) / prevStat.avgSalary) * 100).toFixed(2) + "%" : "0.00%";
        yoySalaryMedian = prevStat.medianSalary > 0
          ? (((stat.medianSalary - prevStat.medianSalary) / prevStat.medianSalary) * 100).toFixed(2) + "%" : "0.00%";
      }
      return { ...stat, yoySalaryCount, yoySalaryAvg, yoySalaryMedian };
    }).sort((a: any, b: any) => b.year - a.year);

    res.json(calculatedStats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Cloud Backups API
app.get("/api/cloud/backups", async (req, res) => {
  const { role } = req.query;
  if (role !== "HR_ADMIN" && role !== "EXECUTIVE") {
    return res.status(403).json({ error: "權限不足，無法讀取雲端存檔！" });
  }
  try {
    const [rows] = await pool.query(`SELECT * FROM backups ORDER BY created_at DESC`) as any[];
    const mapped = (rows as any[]).map((r) => ({
      id: r.id, filename: r.filename, fileType: r.file_type, size: r.size,
      createdBy: r.created_by, createdAt: r.created_at, url: r.url
    }));
    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/cloud/backups", async (req, res) => {
  const { filename, fileType, size, username, role } = req.body;
  if (role !== "HR_ADMIN") {
    return res.status(403).json({ error: "權限不足，僅限HR人員上傳或備份 (HR Admin only)" });
  }
  try {
    const id = `bk_${Date.now()}`;
    const createdAt = formatTime();
    const url = `https://cloud-storage.local/hr-reports/${encodeURIComponent((filename || "").split('.')[0])}_hash${Math.floor(100 + Math.random() * 900)}.${(fileType || "").toLowerCase()}`;
    await pool.query(
      `INSERT INTO backups (id, filename, file_type, size, created_by, created_at, url) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, filename, fileType, size, username, createdAt, url]
    );
    await addAuditLog(username, role, "雲端儲存備份", `將報表「${filename}」備份至安全雲端空間，產生稽核雜湊與權限保護`);
    res.json({ success: true, backup: { id, filename, fileType, size, createdBy: username, createdAt, url } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// AI Gemini HR PM Assistant/Analyst (Taiwan Specific Regulation advisor & analysis)
app.post("/api/gemini/analyze", async (req, res) => {
  const { reportData, question, username, role } = req.body;

  if (role !== "HR_ADMIN" && role !== "EXECUTIVE") {
    return res.status(403).json({ error: "權限不足，無法使用AI分析分析薪資數據！" });
  }

  try {
    const reportSummary = JSON.stringify(reportData, null, 2);
    const systemPrompt = `你是一位專業的台灣上市上櫃公司人力資源專案經理與法令合規分析顧問。
你的任務是協助人資主管(HR Admin)或企業高階主管(Executive)分析台灣證券交易所及櫃買中心所規定之「非擔任主管職務之全時員工薪資中位數及平均數」申報數據。
提供專業、精準、符合法令法規且對高層極具參考價值的繁體中文分析。

【法規背景】：
台灣金管會與證交所規定，上市櫃公司每年需申報上一年度「非主管職務之全時員工薪資資訊」，若公司符合以下幾項「黃標」或「紅標」條件之一，必須在公開資訊觀測站說明「薪資合理性」、公司薪資政策與未來改善計畫：
1. 員工平均薪資未達50萬元者。
2. 營業利益衰退，但非主管之全時員工平均薪資卻較前一年度減少（不合理減薪）。
3. 營業利益成長，但非主管之全時員工平均薪資卻未增加（未合理分潤）。
4. 該年度非主管全時員工薪資中位數低於同業平均水準。

【分析指引】：
1. 分析給予之統計報表 (包含各年度員工人數、平均薪資、中位數、福利費用、YoY變動率)。
2. 指出該公司是否有符合金管會上述「需公開說明薪資合理性」的警示指標。
3. 針對HR在算業績獎金或調整底薪，給予實務建議。
4. 提供符合證交所規定「薪資政策與未來改善計畫說明書」的撰寫公版或精簡擬稿，供公司上傳公開資訊觀測站使用。
5. 保持語氣嚴謹、客觀、專業、高階管理人適用。

【輸入的報表數據】：
${reportSummary}
`;

    const userPrompt = question || "請針對上述申報數據，進行全方位的合規性與合理性診斷，並產出一份精簡的董監事級簡報指引與公開資訊觀測站申報說明建議。";

    // Call Gemini
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        { text: systemPrompt },
        { text: userPrompt }
      ]
    });

    const aiText = response.text || "AI 暫時無法產生分析報告。";

    // Log this AI consult
    await addAuditLog(username, role, "AI 顧問分析", `使用 Gemini AI 對申報報表進行合規分析與撰寫合規說明書`);

    res.json({ analysis: aiText });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: "AI 分析出錯: " + (error.message || String(error)) });
  }
});


// ==========================================
// VITE OR STATIC MIDDLEWARE (Bootstrapper)
// ==========================================

async function bootstrap() {
  // Initialize MySQL tables and seed data
  await initMySQL();

  // Recalculate all commission records on startup
  await refreshCommissionRecords();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

bootstrap().catch(err => {
  console.error("❌ Failed to start server:", err);
  process.exit(1);
});
