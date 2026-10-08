import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { open, Database } from "sqlite";
import sqlite3 from "sqlite3";
import dotenv from "dotenv";
import fs from 'fs';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import nodemailer from "nodemailer";

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
// SQLite Database Connection
// ==========================================
let db: Database;
async function getDb() {
  if (!db) {
    db = await open({
      filename: process.env.DB_PATH || "./database.sqlite",
      driver: sqlite3.Database,
    });
    await db.run("PRAGMA journal_mode = WAL;");
    await db.run("PRAGMA foreign_keys = ON;");
  }
  return db;
}

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
    const db = await getDb();
    const id = `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    await db.run(
      `INSERT INTO audit_logs (id, username, role, action, details, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, username, role, action, details, formatTime()]
    );
    // Keep only last 100 logs
    await db.run(
      `DELETE FROM audit_logs WHERE id NOT IN (SELECT id FROM audit_logs ORDER BY created_at DESC LIMIT 100)`
    );
  } catch (err) {
    console.error("Error writing audit log:", err);
  }
}

async function getSalesConfig() {
  const db = await getDb();
  const row = await db.get(`SELECT * FROM sales_config WHERE id = 1`);
  if (!row) {
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
  return {
    tiers: typeof row.tiers === 'string' ? JSON.parse(row.tiers) : row.tiers,
    targetBonus: row.target_bonus,
    targetAmount: row.target_amount
  };
}

async function refreshCommissionRecords() {
  try {
    const db = await getDb();
    const config = await getSalesConfig();
    const records = await db.all(`SELECT * FROM sales_records`);
    for (const rec of records) {
      const cal = calculateCommission(Number(rec.sales_amount), config);
      await db.run(
        `UPDATE sales_records SET commission=?, bonus=?, total_pay=? WHERE id=?`,
        [cal.commission, cal.bonus, Number(rec.base_salary) + cal.totalPay, rec.id]
      );
    }
  } catch (err) {
    console.error("Error refreshing commission records:", err);
  }
}

// ==========================================
// SQLite Table Initialization + Seeding
// ==========================================
async function initSQLite() {
  console.log("Initializing SQLite tables...");
  const db = await getDb();
  try {
    // Users table
    await db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Role Permissions table
    await db.run(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role TEXT PRIMARY KEY,
        permissions TEXT NOT NULL
      )
    `);

    // Employees table
    await db.run(`
      CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        emp_id TEXT NOT NULL,
        name TEXT NOT NULL,
        title TEXT,
        department TEXT,
        salary INTEGER NOT NULL DEFAULT 0,
        welfare INTEGER NOT NULL DEFAULT 0,
        year INTEGER NOT NULL,
        months REAL,
        original_annual_salary INTEGER,
        first_year_end_bonus INTEGER,
        second_perf_bonus INTEGER,
        other_bonus INTEGER,
        bonus28 INTEGER,
        company_stock_contribution INTEGER,
        sales_commission INTEGER,
        work_bonus INTEGER,
        festival_bonus INTEGER,
        birthday_gift INTEGER,
        overtime INTEGER,
        severance INTEGER,
        maternity_allowance INTEGER,
        non_regular_salary INTEGER,
        monthly_salaries TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_emp_id ON employees (emp_id)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_year ON employees (year)`);

    // Members table
    await db.run(`
      CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        emp_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        grade TEXT,
        onboarding_date TEXT,
        department TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Sales Config table
    await db.run(`
      CREATE TABLE IF NOT EXISTS sales_config (
        id INTEGER PRIMARY KEY DEFAULT 1,
        tiers TEXT NOT NULL,
        target_bonus INTEGER NOT NULL DEFAULT 10000,
        target_amount INTEGER NOT NULL DEFAULT 200000
      )
    `);

    // Sales Records table
    await db.run(`
      CREATE TABLE IF NOT EXISTS sales_records (
        id TEXT PRIMARY KEY,
        emp_id TEXT NOT NULL,
        name TEXT NOT NULL,
        base_salary INTEGER NOT NULL DEFAULT 0,
        sales_amount INTEGER NOT NULL DEFAULT 0,
        commission INTEGER NOT NULL DEFAULT 0,
        bonus INTEGER NOT NULL DEFAULT 0,
        total_pay INTEGER NOT NULL DEFAULT 0,
        period TEXT,
        status TEXT DEFAULT '已計算',
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Insiders table
    await db.run(`
      CREATE TABLE IF NOT EXISTS insiders (
        emp_id TEXT PRIMARY KEY
      )
    `);

    // Audit Logs table
    await db.run(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        username TEXT,
        role TEXT,
        action TEXT,
        details TEXT,
        created_at TEXT
      )
    `);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs (created_at)`);

    // Backups table
    await db.run(`
      CREATE TABLE IF NOT EXISTS backups (
        id TEXT PRIMARY KEY,
        filename TEXT,
        file_type TEXT,
        size TEXT,
        created_by TEXT,
        created_at TEXT,
        url TEXT
      )
    `);

    // Drive Sync Settings table
    await db.run(`
      CREATE TABLE IF NOT EXISTS drive_sync_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        folder_url TEXT,
        folder_id TEXT,
        auto_sync INTEGER DEFAULT 0,
        frequency TEXT DEFAULT 'manual',
        last_sync_time TEXT,
        last_sync_status TEXT DEFAULT 'idle',
        last_sync_log TEXT,
        target_year INTEGER DEFAULT 2025,
        auth_mode TEXT DEFAULT 'direct',
        google_client_id TEXT
      )
    `);

    // ── Seed Default Data (only if tables are empty) ──

    // Default Users
    const existingUsers = await db.get(`SELECT COUNT(*) as count FROM users`);
    if (existingUsers.count === 0) {
      await db.run(`INSERT INTO users (email, username, name, password, role) VALUES (?,?,?,?,?)`,
        ['gordon.huang@ldchotels.com', 'gordon.huang@ldchotels.com', 'Gordon', 'mis', 'HR_ADMIN']);
      await db.run(`INSERT INTO users (email, username, name, password, role) VALUES (?,?,?,?,?)`,
        ['vivian.chiang@ldchotels.com', 'vivian.chiang@ldchotels.com', '高階主管', 'mis', 'EXECUTIVE']);
      await db.run(`INSERT INTO users (email, username, name, password, role) VALUES (?,?,?,?,?)`,
        ['sales_director@ldchotels.com', 'sales_leader', '業務主管', 'sales', 'SALES_LEADER']);
      await db.run(`INSERT INTO users (email, username, name, password, role) VALUES (?,?,?,?,?)`,
        ['ann.hsu@ldchotels.com', 'ann.hsu@ldchotels.com', 'Ann', 'mis', 'HR_ADMIN']);
      console.log("✅ Seeded default users.");
    }

    // Default Role Permissions
    const existingPerms = await db.get(`SELECT COUNT(*) as count FROM role_permissions`);
    if (existingPerms.count === 0) {
      const perms = [
        ['HR_ADMIN', JSON.stringify({ view_salary: true, calculate_commission: true, manage_backups: true, onboarding_portal: true, audit_trail: true, permission_management: true })],
        ['EXECUTIVE', JSON.stringify({ view_salary: true, calculate_commission: false, manage_backups: false, onboarding_portal: true, audit_trail: true, permission_management: false })],
        ['SALES_LEADER', JSON.stringify({ view_salary: false, calculate_commission: true, manage_backups: false, onboarding_portal: false, audit_trail: false, permission_management: false })],
      ];
      for (const [role, permissions] of perms) {
        await db.run(`INSERT INTO role_permissions (role, permissions) VALUES (?, ?)`, [role, permissions]);
      }
      console.log("✅ Seeded default role permissions.");
    }

    // Default Sales Config
    const existingConfig = await db.get(`SELECT COUNT(*) as count FROM sales_config`);
    if (existingConfig.count === 0) {
      const tiers = JSON.stringify([
        { id: "t1", min: 0, max: 50000, rate: 2, label: "基本業績" },
        { id: "t2", min: 50001, max: 150000, rate: 5, label: "標準業績" },
        { id: "t3", min: 150001, max: 300000, rate: 8, label: "優良業績" },
        { id: "t4", min: 300001, max: 99999999, rate: 12, label: "卓越業績" }
      ]);
      await db.run(`INSERT INTO sales_config (id, tiers, target_bonus, target_amount) VALUES (1, ?, 10000, 200000)`, [tiers]);
      console.log("✅ Seeded default sales config.");
    }

    // Default Drive Sync Settings
    const existingDrive = await db.get(`SELECT COUNT(*) as count FROM drive_sync_settings`);
    if (existingDrive.count === 0) {
      await db.run(`
        INSERT INTO drive_sync_settings (id, folder_url, folder_id, auto_sync, frequency, last_sync_status, target_year, auth_mode, google_client_id)
        VALUES (1, 'https://drive.google.com/drive/folders/1i8t5Q1r5-Y4RZeadGcq9QGEzLUponwQ7',
                '1i8t5Q1r5-Y4RZeadGcq9QGEzLUponwQ7', 0, 'manual', 'idle', 2025, 'direct', '')
      `);
      console.log("✅ Seeded default drive sync settings.");
    }

    console.log("🎉 SQLite initialization complete!");
  } catch (err) {
    console.error("❌ Failed to initialize SQLite tables:", err);
    throw err;
  }
}

// ==========================================
// API ROUTES
// ==========================================

// Auth Endpoint
app.post("/api/auth/login", async (req, res) => {
  const { username, password, email, authToken, role } = req.body;

  // Handle HR login mapping from Onboarding UI integration or fallback to traditional
  const loginRole = role || 'hr';
  const loginIdentifier = email || username;
  const loginSecret = authToken || password;

  if (loginIdentifier === "LOGOUT") {
    return res.json({ success: true });
  }

  // Employee Login Path (checking onboard_db employees)
  if (loginRole === 'employee') {
    const normalizedEmail = loginIdentifier.trim().toLowerCase();
    
    // Check real employees DB
    const employee = employees.find(
      (emp) => emp.email.toLowerCase() === normalizedEmail && emp.authToken.trim() === loginSecret.trim()
    );

    if (employee) {
      await addAuditLog(employee.name, 'employee', "員工報到登入", "新進員工透過專屬授權碼登入系統");
      return res.json({ success: true, user: employee, role: 'employee' });
    } else {
      return res.status(401).json({ success: false, message: "登入失敗，電子郵件或授權碼不正確 (Invalid token)" });
    }
  }

  // Free Room Login Path
  if (loginRole === 'freeroom') {
    if (loginIdentifier.trim() === 'admin' && loginSecret.trim() === 'mis') {
      await addAuditLog('測試管理員', 'freeroom', "免費房間登入", "使用測試帳號登入免費房間系統");
      return res.json({ success: true, user: { name: '測試管理員', empId: 'admin' }, role: 'freeroom' });
    }
    const frEmployee = freeroomEmployees.find(
      (emp) => (emp.id === loginIdentifier.trim() || emp.empId === loginIdentifier.trim()) && emp.nationalId === loginSecret.trim().toUpperCase()
    );
    if (frEmployee) {
      await addAuditLog(frEmployee.nameZh, 'freeroom', "免費房間登入", "使用身分證字號登入免費房間系統");
      return res.json({ success: true, user: frEmployee, role: 'freeroom' });
    } else {
      return res.status(401).json({ success: false, message: "登入失敗，員編或身分證字號不正確" });
    }
  }

  // HR / Admin Login Path
  try {
    const db = await getDb();
    const userRecord = await db.get(
      `SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)`,
      [loginIdentifier, loginIdentifier]
    );

    const permRows = await db.all(`SELECT * FROM role_permissions`);
    const rolePermissions: any = {};
    for (const row of permRows) {
      let perms = typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions;
      if (perms && perms.ai_compliance !== undefined && perms.onboarding_portal === undefined) {
        perms.onboarding_portal = perms.ai_compliance;
        delete perms.ai_compliance;
      }
      rolePermissions[row.role] = perms;
    }

    if (userRecord && userRecord.password === loginSecret) {
      const permissions = rolePermissions[userRecord.role] || {
        view_salary: false, calculate_commission: false, manage_backups: false,
        onboarding_portal: false, audit_trail: false, permission_management: false
      };
      const matchedUser = {
        username: userRecord.name || userRecord.username,
        role: userRecord.role,
        email: userRecord.email,
        permissions
      };
      await addAuditLog(matchedUser.username, matchedUser.role, "登入系統", `成功登入系統，授予 ${matchedUser.role} 權限`);
      return res.json({ success: true, user: matchedUser, role: matchedUser.role });
    }

    return res.status(401).json({ success: false, message: "帳號或密碼錯誤 (Invalid username or password)" });
  } catch (err: any) {
    console.error("Login error:", err);
    return res.status(500).json({ success: false, message: "伺服器錯誤: " + err.message });
  }
});

// Freeroom Endpoints
app.get("/api/freeroom/employees", (req, res) => {
  res.json(freeroomEmployees);
});

app.post("/api/freeroom/employees", (req, res) => {
  freeroomEmployees = req.body;
  saveFreeroomDb();
  res.json({ success: true });
});

// Freeroom Endpoints
app.get("/api/freeroom/employees", (req, res) => {
  res.json(freeroomEmployees);
});

app.post("/api/freeroom/employees", (req, res) => {
  freeroomEmployees = req.body;
  saveFreeroomDb();
  res.json({ success: true });
});

// Permissions API Endpoints
app.get("/api/permissions", async (req, res) => {
  try {
    const db = await getDb();
    const users = await db.all(`SELECT email, username, name, role FROM users`);
    const permRows = await db.all(`SELECT * FROM role_permissions`);
    const rolePermissions: any = {};
    for (const row of permRows) {
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
    const db = await getDb();
    for (const [r, perms] of Object.entries(rolePermissions)) {
      await db.run(
        `INSERT INTO role_permissions (role, permissions) VALUES (?, ?) ON CONFLICT(role) DO UPDATE SET permissions=excluded.permissions`,
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
    const db = await getDb();
    const existing = await db.get(
      `SELECT id FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)`,
      [email, username]
    );
    if (existing) {
      return res.status(400).json({ error: "帳號或 E-mail 已存在！" });
    }
    await db.run(
      `INSERT INTO users (email, username, name, password, role) VALUES (?, ?, ?, ?, ?)`,
      [email, username, name, password, newRole]
    );
    const users = await db.all(`SELECT email, username, name, role FROM users`);
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
    const db = await getDb();
    const user = await db.get(`SELECT * FROM users WHERE LOWER(email) = LOWER(?)`, [email]);
    if (!user) return res.status(404).json({ error: "找不到該同仁帳號！" });
    if (user.password !== oldPassword) return res.status(400).json({ error: "舊密碼不正確！" });
    await db.run(`UPDATE users SET password = ? WHERE LOWER(email) = LOWER(?)`, [newPassword, email]);
    await addAuditLog(username || user.name, role || user.role, "修改密碼", `同仁 ${user.name} (${email}) 成功變更登入密碼`);
    res.json({ success: true, message: "密碼修改成功！" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Audit Logs Endpoint
app.get("/api/audit/logs", async (req, res) => {
  try {
    const db = await getDb();
    const logs = await db.all(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100`);
    const mapped = logs.map((l: any) => ({
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
    const db = await getDb();
    await db.run(
      `INSERT INTO sales_config (id, tiers, target_bonus, target_amount) VALUES (1, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET tiers=excluded.tiers, target_bonus=excluded.target_bonus, target_amount=excluded.target_amount`,
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
    const db = await getDb();
    const r = await db.get(`SELECT * FROM drive_sync_settings WHERE id = 1`);
    if (!r) {
      return res.json({
        folderUrl: "https://drive.google.com/drive/folders/1i8t5Q1r5-Y4RZeadGcq9QGEzLUponwQ7",
        folderId: "1i8t5Q1r5-Y4RZeadGcq9QGEzLUponwQ7",
        autoSync: false, frequency: "manual", lastSyncTime: null,
        lastSyncStatus: "idle", lastSyncLog: "", targetYear: 2025,
        authMode: "direct", googleClientId: ""
      });
    }
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
    const db = await getDb();
    await db.run(`
      INSERT INTO drive_sync_settings
        (id, folder_url, folder_id, auto_sync, frequency, last_sync_time, last_sync_status, last_sync_log, target_year, auth_mode, google_client_id)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        folder_url=excluded.folder_url, folder_id=excluded.folder_id, auto_sync=excluded.auto_sync,
        frequency=excluded.frequency, last_sync_time=excluded.last_sync_time,
        last_sync_status=excluded.last_sync_status, last_sync_log=excluded.last_sync_log,
        target_year=excluded.target_year, auth_mode=excluded.auth_mode, google_client_id=excluded.google_client_id
    `, [
      folderUrl || "https://drive.google.com/drive/folders/1i8t5Q1r5-Y4RZeadGcq9QGEzLUponwQ7",
      folderId || "1i8t5Q1r5-Y4RZeadGcq9QGEzLUponwQ7",
      autoSync ? 1 : 0, frequency || "manual",
      lastSyncTime !== undefined ? lastSyncTime : null,
      lastSyncStatus || "idle",
      lastSyncLog !== undefined ? lastSyncLog : "",
      Number(targetYear || 2025),
      authMode || "direct",
      googleClientId || ""
    ]);
    await addAuditLog(username, role, "更新雲端同步設定",
      `更新 Google Drive 自動同步排程：${frequency}，目標夾：${folderId}，驗證模式：${authMode || "direct"}`);
    const r = await db.get(`SELECT * FROM drive_sync_settings WHERE id = 1`);
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
    const db = await getDb();
    const records = await db.all(`SELECT * FROM sales_records ORDER BY created_at DESC`);
    const mapped = records.map((r: any) => ({
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
    const db = await getDb();
    const config = await getSalesConfig();
    const cal = calculateCommission(Number(salesAmount), config);
    const id = `sr_${Date.now()}`;
    await db.run(
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
    const db = await getDb();
    const old = await db.get(`SELECT * FROM sales_records WHERE id = ?`, [id]);
    if (!old) return res.status(404).json({ error: "找不到該筆業績記錄" });
    const newSalesAmount = salesAmount !== undefined ? Number(salesAmount) : Number(old.sales_amount);
    const newBaseSalary = baseSalary !== undefined ? Number(baseSalary) : Number(old.base_salary);
    const newStatus = status !== undefined ? status : old.status;
    const config = await getSalesConfig();
    const cal = calculateCommission(newSalesAmount, config);
    await db.run(
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
    const db = await getDb();
    const record = await db.get(`SELECT * FROM sales_records WHERE id = ?`, [id]);
    if (!record) return res.status(404).json({ error: "找不到該筆業績記錄" });
    await db.run(`DELETE FROM sales_records WHERE id = ?`, [id]);
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
    const db = await getDb();
    const employees = await db.all(`SELECT * FROM employees ORDER BY year DESC`);
    const members = await db.all(`SELECT * FROM members`);
    const mapped = employees.map((e: any) => {
      const m = members.find((m: any) => m.emp_id === e.emp_id);
      return {
        id: e.id, empId: e.emp_id, name: e.name, title: e.title,
        department: (m && (m as any).department) ? (m as any).department : e.department,
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
    const db = await getDb();
    let addedCount = 0;
    let updatedCount = 0;
    const targetYear = Number(year);
    for (const emp of employees) {
      const existing = await db.get(
        `SELECT id FROM employees WHERE emp_id = ? AND year = ?`, [emp.empId, targetYear]
      );
      const existingMember = await db.get(`SELECT id, department FROM members WHERE emp_id = ?`, [emp.empId]);
      let finalDepartment = emp.department || "研發部";
      if (finalDepartment === "." || finalDepartment.trim() === "") {
        finalDepartment = "研發部";
      }
      if (existingMember && existingMember.department && existingMember.department.trim() !== "." && existingMember.department.trim() !== "") {
        finalDepartment = existingMember.department;
      }

      const empValues = [
        emp.name, emp.title || "全時人員", finalDepartment,
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
      if (existing) {
        await db.run(`
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
        await db.run(`
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
      if (existingMember) {
        // Only update member department if we have a valid one and member's is empty
        if ((!existingMember.department || existingMember.department.trim() === "" || existingMember.department === ".") && finalDepartment !== "研發部" && finalDepartment !== ".") {
          await db.run(`UPDATE members SET department=? WHERE emp_id=?`, [finalDepartment, emp.empId]);
        }
      } else {
        await db.run(
          `INSERT INTO members (emp_id, name, grade, onboarding_date, department) VALUES (?, ?, ?, ?, ?)`,
          [emp.empId, emp.name, "一般", "", finalDepartment]
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
    const db = await getDb();
    const id = `emp_${Date.now()}`;
    await db.run(`
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
    const existingMember = await db.get(`SELECT id FROM members WHERE emp_id = ?`, [empId]);
    if (existingMember) {
      await db.run(`UPDATE members SET department=? WHERE emp_id=?`, [department, empId]);
    } else {
      await db.run(
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
    const db = await getDb();
    const old = await db.get(`SELECT * FROM employees WHERE id = ?`, [id]);
    if (!old) return res.status(404).json({ error: "找不到該員工薪資記錄" });
    await db.run(`
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
    const existingMember = await db.get(`SELECT id FROM members WHERE emp_id = ?`, [old.emp_id]);
    if (existingMember) {
      if (updatedDept) await db.run(`UPDATE members SET department=? WHERE emp_id=?`, [updatedDept, old.emp_id]);
    } else {
      await db.run(
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
    const db = await getDb();
    const emp = await db.get(`SELECT * FROM employees WHERE id = ?`, [id]);
    if (!emp) return res.status(404).json({ error: "找不到該員工薪資記錄" });
    await db.run(`DELETE FROM employees WHERE id = ?`, [id]);
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
    const db = await getDb();
    if (year) {
      const targetYear = Number(year);
      const result = await db.get(`SELECT COUNT(*) as count FROM employees WHERE year = ?`, [targetYear]);
      const deletedCount = result.count;
      await db.run(`DELETE FROM employees WHERE year = ?`, [targetYear]);
      await addAuditLog(String(username), String(role), "批次刪除員工薪資",
        `批次刪除了 ${targetYear} 年度所有員工申報資料，共 ${deletedCount} 筆`);
      return res.json({ success: true, deletedCount });
    } else {
      const result = await db.get(`SELECT COUNT(*) as count FROM employees`);
      const deletedCount = result.count;
      await db.run(`DELETE FROM employees`);
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
    const db = await getDb();
    const members = await db.all(`SELECT * FROM members`);
    const mapped = members.map((m: any) => ({
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
    const db = await getDb();
    await db.run(`DELETE FROM members`);
    for (const m of members) {
      await db.run(
        `INSERT INTO members (emp_id, name, grade, onboarding_date, department) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(emp_id) DO UPDATE SET name=excluded.name, grade=excluded.grade, onboarding_date=excluded.onboarding_date, department=excluded.department`,
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
    const db = await getDb();
    const result = await db.get(`SELECT COUNT(*) as count FROM members`);
    const originalCount = result.count;
    await db.run(`DELETE FROM members`);
    await addAuditLog(String(username), String(role), "清空人員名單", `清空了所有人員基本資料，共 ${originalCount} 筆`);
    res.json({ success: true, deletedCount: originalCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Insiders (內部人) Management Endpoints
app.get("/api/insiders", async (req, res) => {
  try {
    const db = await getDb();
    const rows = await db.all(`SELECT emp_id FROM insiders`);
    res.json({ success: true, insiders: rows.map((r: any) => r.emp_id) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/insiders", async (req, res) => {
  const { empId, username, role } = req.body;
  if (!empId) return res.status(400).json({ error: "缺少員工編號 (empId)" });
  try {
    const db = await getDb();
    await db.run(`INSERT OR IGNORE INTO insiders (emp_id) VALUES (?)`, [empId]);
    await addAuditLog(String(username || "系統"), String(role || "HR_ADMIN"), "設定內部人", `將員編 ${empId} 設定為內部人`);
    const rows = await db.all(`SELECT emp_id FROM insiders`);
    res.json({ success: true, insiders: rows.map((r: any) => r.emp_id) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/insiders/:empId", async (req, res) => {
  const { empId } = req.params;
  const { username, role } = req.query;
  try {
    const db = await getDb();
    await db.run(`DELETE FROM insiders WHERE emp_id = ?`, [empId]);
    await addAuditLog(String(username || "系統"), String(role || "HR_ADMIN"), "取消設定內部人", `將員編 ${empId} 取消內部人身分`);
    const rows = await db.all(`SELECT emp_id FROM insiders`);
    res.json({ success: true, insiders: rows.map((r: any) => r.emp_id) });
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
    const db = await getDb();
    const employees = await db.all(`SELECT * FROM employees`);
    const members = await db.all(`SELECT * FROM members`);
    const insiderRows = await db.all(`SELECT emp_id FROM insiders`);
    const insidersList = insiderRows.map((r: any) => r.emp_id);
    const boardEmpIds = members.filter((m: any) => m.grade === "9").map((m: any) => m.emp_id);

    const enrichedEmployees = employees.map((e: any) => {
      const m = members.find((m: any) => m.emp_id === e.emp_id);
      return { ...e, department: (m && (m as any).department) ? (m as any).department : e.department };
    });

    const settlementDate = (req.query.settlementDate as string) || "2026-07-02";

    const isNewbie = (empId: string) => {
      const m = members.find((m: any) => m.emp_id === empId);
      if (m && m.onboarding_date) {
        const start = new Date(m.onboarding_date);
        const end = new Date(settlementDate);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          start.setHours(0, 0, 0, 0);
          end.setHours(0, 0, 0, 0);
          const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          return diffDays < 183;
        }
      }
      return false;
    };

    const isExcluded = (empId: string) => boardEmpIds.includes(empId) || insidersList.includes(empId) || isNewbie(empId);
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
          isBoard: boardEmpIds.includes(e.emp_id), isInsider: insidersList.includes(e.emp_id),
          isNewbie: isNewbie(e.emp_id)
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
    const db = await getDb();
    const rows = await db.all(`SELECT * FROM backups ORDER BY created_at DESC`);
    const mapped = rows.map((r: any) => ({
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
    const db = await getDb();
    const id = `bk_${Date.now()}`;
    const createdAt = formatTime();
    const url = `https://cloud-storage.local/hr-reports/${encodeURIComponent((filename || "").split('.')[0])}_hash${Math.floor(100 + Math.random() * 900)}.${(fileType || "").toLowerCase()}`;
    await db.run(
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


// === ONBOARDING PORTAL INTEGRATION: DB HELPERS ===
// Database mock with file persistence
const DB_FILE = path.join(process.cwd(), 'onboard_db.json');

// Default HR admin accounts as specified in the requirements with custom password support
let primaryAdminEmail = 'gordon.huang@ldchotels.com';

let hrAdmins: any[] = [
  { email: 'gordon.huang@ldchotels.com', password: 'mis' },
  { email: 'vivian.chiang@ldchotels.com', password: 'mis' }
];

// Helper to normalize legacy string admins to objects
function getNormalizedAdmins(): { email: string; password: string; permissions?: string[] }[] {
  return hrAdmins.map(admin => {
    if (typeof admin === 'string') {
      const email = admin.toLowerCase().trim();
      return { 
        email, 
        password: 'mis',
        permissions: email === primaryAdminEmail.toLowerCase().trim()
          ? ['admin', 'tracker', 'publish', 'ai', 'audit'] 
          : ['tracker', 'publish', 'ai']
      };
    }
    const email = (admin.email || '').toLowerCase().trim();
    return {
      email,
      password: admin.password || 'mis',
      permissions: admin.permissions || (
        email === primaryAdminEmail.toLowerCase().trim()
          ? ['admin', 'tracker', 'publish', 'ai', 'audit'] 
          : ['tracker', 'publish', 'ai']
      )
    };
  });
}

// Memory store for forgot password tokens
let forgotPasswordTokens: Record<string, { email: string; expires: number }> = {};

interface Employee {
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
  personalData?: any;
  careerData?: any;
  uploadedFiles: any[];
  rulesAgreed: boolean;
  privacyAgreed: boolean;
  contractSigned: boolean;
  contractDate?: string;
  contractWorkLocation?: string;
  contractLeaveOption?: string;
  contractLeavedays?: string;
  contractSalaryType?: string;
  contractSalaryAmount?: string;
  contractProbationMonths?: string;
  taxDeclaration?: any;
  guarantorSigned?: boolean;
  guarantorDate?: string;
  guarantorData?: any;
  serviceSigned?: boolean;
  serviceDate?: string;
  updatedAt: string;
}
// --- Freeroom Employees DB ---
const FREEROOM_DB_FILE = path.join(__dirname, "freeroom_db.json");
let freeroomEmployees: any[] = [];
if (!fs.existsSync(FREEROOM_DB_FILE)) {
  try {
    const mockDataCode = fs.readFileSync(path.join(__dirname, 'src/data/roomMockData.ts'), 'utf8');
    // Extract the array using simple regex for demo purposes (assuming INITIAL_EMPLOYEES is an array)
    const match = mockDataCode.match(/export const INITIAL_EMPLOYEES: Employee\[\] = (\[[\s\S]*?\]);/);
    if (match) {
       freeroomEmployees = eval(match[1].replace(/Date\.now\(\)/g, "1711200000000"));
    }
    fs.writeFileSync(FREEROOM_DB_FILE, JSON.stringify(freeroomEmployees, null, 2));
  } catch(e) {
    console.error("Could not parse roomMockData.ts", e);
  }
} else {
  freeroomEmployees = JSON.parse(fs.readFileSync(FREEROOM_DB_FILE, "utf-8"));
}

const saveFreeroomDb = () => {
  fs.writeFileSync(FREEROOM_DB_FILE, JSON.stringify(freeroomEmployees, null, 2));
};

let employees: Employee[] = [
  {
    id: 'emp_001',
    name: 'Alex 陳',
    email: 'alex.chen@example.com',
    authToken: 'LDC888',
    department: '君品酒店 - 餐飲部',
    title: '餐飲領班',
    onboardDate: '2026-06-15',
    status: 'pending',
    progress: 15,
    uploadedFiles: [],
    rulesAgreed: false,
    privacyAgreed: false,
    contractSigned: false,
    contractWorkLocation: '君品酒店 (台北) (台北市承德路一段3號)',
    contractLeaveOption: 'biweekly',
    contractLeavedays: '8',
    contractSalaryType: 'monthly',
    contractSalaryAmount: '36,000',
    contractProbationMonths: '三',
    updatedAt: new Date().toISOString(),
    personalData: {
      name: 'Alex 陳',
      idNumber: 'A123456789',
      birthday: '1998-05-12',
      gender: '男',
      phone: '0912-345-678',
      email: 'alex.chen@example.com',
      legalAddress: '台北市大安區新生南路三段 10 號',
      contactAddress: '台北市大安區新生南路三段 10 號',
      bankName: '兆豐國際商業銀行',
      bankAccount: '017123456789',
      dependentsCount: '0 人',
      emergencyName: '陳大同',
      emergencyRelationship: '父親',
      emergencyPhone: '0988-765-432'
    }
  },
  {
    id: 'emp_002',
    name: 'Sophia 林',
    email: 'sophia.lin@example.com',
    authToken: 'LDC999',
    department: '雲品溫泉酒店 - 客房部',
    title: '尊榮客務接待專員',
    onboardDate: '2026-07-01',
    status: 'pending',
    progress: 0,
    uploadedFiles: [],
    rulesAgreed: false,
    privacyAgreed: false,
    contractSigned: false,
    contractWorkLocation: '雲品溫泉酒店 (日月潭) (南投縣魚池鄉中正路23號)',
    contractLeaveOption: 'weekly',
    contractLeavedays: '8',
    contractSalaryType: 'monthly',
    contractSalaryAmount: '36,000',
    contractProbationMonths: '三',
    updatedAt: new Date().toISOString()
  }
];

interface ActivityLog {
  id: string;
  operatorEmail: string;
  operatorName: string;
  employeeName: string;
  actionType: string;
  details: string;
  timestamp: string;
}

let activityLogs: ActivityLog[] = [];

// Load from disk if exists
function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed.hrAdmins) {
        hrAdmins = parsed.hrAdmins.map((admin: any) => {
          if (typeof admin === 'string') {
            return { email: admin.toLowerCase().trim(), password: 'mis' };
          }
          return {
            email: (admin.email || '').toLowerCase().trim(),
            password: admin.password || 'mis',
            permissions: admin.permissions
          };
        });
      }
      if (parsed.employees) employees = parsed.employees;
      if (parsed.activityLogs) activityLogs = parsed.activityLogs;
      if (parsed.primaryAdminEmail) {
        primaryAdminEmail = parsed.primaryAdminEmail.toLowerCase().trim();
      }
      console.log('Database loaded successfully from disk.');
      cleanOldLogs();
    } else {
      saveDatabase();
    }
  } catch (err) {
    console.error('Error loading database:', err);
  }
}

function cleanOldLogs() {
  const fifteenDaysAgo = Date.now() - 15 * 24 * 60 * 60 * 1000;
  const originalLength = activityLogs.length;
  activityLogs = activityLogs.filter(log => {
    const logTime = new Date(log.timestamp).getTime();
    return logTime >= fifteenDaysAgo;
  });
  if (activityLogs.length !== originalLength) {
    console.log(`Cleaned ${originalLength - activityLogs.length} activity logs older than 15 days.`);
  }
}

// Firebase Firestore database initialization
const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseDb: Firestore | null = null;
let isFirestoreAvailable = true;

if (fs.existsSync(firebaseConfigPath)) {
  try {
    const config = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
    const app = initializeApp({
      projectId: config.projectId
    });
    firebaseDb = getFirestore(app, config.firestoreDatabaseId || undefined);
    console.log('Firebase Admin initialized with project ID:', config.projectId, 'database ID:', config.firestoreDatabaseId);
  } catch (err) {
    console.error('Failed to initialize Firebase Admin:', err);
    isFirestoreAvailable = false;
  }
} else {
  console.warn('firebase-applet-config.json not found, skipping Firebase Admin initialization');
  isFirestoreAvailable = false;
}

// Background replication to Firestore
async function replicateToFirestoreBg() {
  if (!db || !isFirestoreAvailable) return;
  try {
    const batch = firebaseDb.batch();

    // 1. Sync all admins
    const normalizedAdmins = getNormalizedAdmins();
    for (const adminObj of normalizedAdmins) {
      const docRef = firebaseDb.collection('admins').doc(adminObj.email);
      batch.set(docRef, adminObj);
    }

    // 2. Sync all employees
    for (const emp of employees) {
      const docRef = firebaseDb.collection('employees').doc(emp.id);
      batch.set(docRef, emp);
    }

    // 3. Sync all activity logs (limit to last 100 for efficiency)
    const logsToSync = activityLogs.slice(0, 100);
    for (const log of logsToSync) {
      const docRef = firebaseDb.collection('activity_logs').doc(log.id);
      batch.set(docRef, log);
    }

    await batch.commit();
    console.log('Background replication to Firestore completed successfully.');
  } catch (err: any) {
    const isPermissionError = err.message && (err.message.includes('PERMISSION_DENIED') || err.message.includes('insufficient permissions'));
    if (isPermissionError) {
      isFirestoreAvailable = false;
      console.warn('⚠️ Firestore Sync Info: Replication encountered permission error. Switched to local JSON database mode.');
    } else {
      console.error('Failed background replication to Firestore:', err);
    }
  }
}

// Migrate local database to Firestore
async function migrateToFirestore() {
  if (!db || !isFirestoreAvailable) return;
  try {
    const batch = firebaseDb.batch();

    // 1. Migrate Admins
    const normalizedAdmins = getNormalizedAdmins();
    for (const adminObj of normalizedAdmins) {
      const docRef = firebaseDb.collection('admins').doc(adminObj.email);
      batch.set(docRef, adminObj);
    }

    // 2. Migrate Employees
    for (const emp of employees) {
      const docRef = firebaseDb.collection('employees').doc(emp.id);
      batch.set(docRef, emp);
    }

    // 3. Migrate Logs
    for (const log of activityLogs) {
      const docRef = firebaseDb.collection('activity_logs').doc(log.id);
      batch.set(docRef, log);
    }

    await batch.commit();
    console.log('One-time migration to Firestore completed successfully.');
  } catch (err) {
    console.error('Failed to migrate local database to Firestore:', err);
  }
}

// Load database from Firestore on startup
async function loadDatabaseFromFirestore() {
  // First, always load from the local file as a baseline / fallback
  loadDatabase();

  if (!db) {
    console.log('Firestore is not initialized. Using local JSON database.');
    isFirestoreAvailable = false;
    return;
  }

  try {
    console.log('Syncing database with Firestore...');
    
    // 1. Fetch Admins
    const adminsSnapshot = await firebaseDb.collection('admins').get();
    let firestoreAdmins: any[] = [];
    adminsSnapshot.forEach(doc => {
      firestoreAdmins.push(doc.data());
    });

    // 2. Fetch Employees
    const employeesSnapshot = await firebaseDb.collection('employees').get();
    let firestoreEmployees: Employee[] = [];
    employeesSnapshot.forEach(doc => {
      firestoreEmployees.push(doc.data() as Employee);
    });

    // 3. Fetch Activity Logs
    const logsSnapshot = await firebaseDb.collection('activity_logs').orderBy('timestamp', 'desc').limit(100).get();
    let firestoreLogs: ActivityLog[] = [];
    logsSnapshot.forEach(doc => {
      firestoreLogs.push(doc.data() as ActivityLog);
    });

    if (firestoreAdmins.length > 0 || firestoreEmployees.length > 0) {
      console.log('Firestore data found. Updating in-memory state with Firestore.');
      if (firestoreAdmins.length > 0) {
        hrAdmins = firestoreAdmins;
      }
      if (firestoreEmployees.length > 0) {
        employees = firestoreEmployees;
      }
      if (firestoreLogs.length > 0) {
        activityLogs = firestoreLogs;
      }
      // Keep local JSON in sync
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify({ hrAdmins, employees, activityLogs }, null, 2), 'utf-8');
      } catch (err) {
        console.error('Error saving back to local DB:', err);
      }
    } else {
      console.log('Firestore is empty. Migrating local database to Firestore...');
      await migrateToFirestore();
    }
  } catch (err: any) {
    isFirestoreAvailable = false;
    const isPermissionError = err.message && (err.message.includes('PERMISSION_DENIED') || err.message.includes('insufficient permissions'));
    if (isPermissionError) {
      console.warn('⚠️ Firestore Sync Info: Missing or insufficient permissions. Operating in reliable local-only JSON database mode.');
    } else {
      console.warn('⚠️ Firestore Sync Info: Could not connect to Firestore (', err.message, '). Operating in reliable local-only JSON database mode.');
    }
  }
}

function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify({ hrAdmins, employees, activityLogs, primaryAdminEmail }, null, 2), 'utf-8');
    
    // Trigger background replication to Firestore
    replicateToFirestoreBg();
  } catch (err) {
    console.error('Error saving database:', err);
  }
}

function logActivity(req: express.Request, employeeName: string, actionType: string, details: string) {
  const operatorEmail = (req.headers['x-operator-email'] as string) || '';
  let operatorName = (req.headers['x-operator-name'] as string) || '';
  
  if (operatorName) {
    try {
      operatorName = decodeURIComponent(operatorName);
    } catch (e) {
      // ignore decoding error if it is already regular string
    }
  }

  const newLog: ActivityLog = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    operatorEmail: operatorEmail.trim() || 'system@ldchotels.com',
    operatorName: operatorName.trim() || '系統管理員',
    employeeName: employeeName ? employeeName.trim() : '全體項目',
    actionType,
    details: details.trim(),
    timestamp: new Date().toISOString()
  };

  activityLogs.unshift(newLog);
  cleanOldLogs();
  saveDatabase();
}

// Initialize Server-Side Gemini API
let aiClient: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    console.log('Gemini AI Client initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize Gemini AI Client:', err);
  }
}
// === ONBOARDING PORTAL INTEGRATION: API ROUTES ===

// 2. HR Endpoints
// Get all activity logs
app.get('/api/hr/activity-logs', (req, res) => {
  cleanOldLogs();
  saveDatabase();
  return res.json(activityLogs || []);
});

// Get all employees
app.get('/api/hr/employees', (req, res) => {
  return res.json(employees);
});

// Create single employee
app.post('/api/hr/employees', (req, res) => {
  const { 
    name, 
    email, 
    authToken, 
    department, 
    title, 
    onboardDate,
    empId,
    contractWorkLocation,
    contractLeaveOption,
    contractLeavedays,
    contractSalaryType,
    contractSalaryAmount,
    contractProbationMonths
  } = req.body;
  
  if (!name || !email || !authToken || !department || !title || !onboardDate) {
    return res.status(400).json({ error: '所有欄位均為必填' });
  }

  const exists = employees.some(emp => emp.email.toLowerCase() === email.trim().toLowerCase());
  if (exists) {
    return res.status(400).json({ error: '此電子郵件已存在於新進同仁名單中' });
  }

  const newEmp: Employee = {
    id: 'emp_' + Date.now(),
    empId: empId ? empId.trim() : '',
    name: name.trim(),
    email: email.trim().toLowerCase(),
    authToken: authToken.trim(),
    department: department.trim(),
    title: title.trim(),
    onboardDate: onboardDate,
    status: 'pending',
    progress: 0,
    uploadedFiles: [],
    rulesAgreed: false,
    privacyAgreed: false,
    contractSigned: false,
    contractWorkLocation: contractWorkLocation || '君品酒店 (台北市承德路一段3號)',
    contractLeaveOption: contractLeaveOption || 'biweekly',
    contractLeavedays: contractLeavedays || '8',
    contractSalaryType: contractSalaryType || 'monthly',
    contractSalaryAmount: contractSalaryAmount || '36,000',
    contractProbationMonths: contractProbationMonths || '三',
    updatedAt: new Date().toISOString()
  };

  employees.push(newEmp);
  logActivity(req, newEmp.name, 'CREATE_EMPLOYEE', `新增新進同仁: ${newEmp.name} (${newEmp.department} - ${newEmp.title})`);
  saveDatabase();
  return res.json({ message: '成功新增新進同仁', employee: newEmp, employees });
});

// Delete individual employee
app.delete('/api/hr/employees/:id', (req, res) => {
  const { id } = req.params;
  const index = employees.findIndex(emp => emp.id === id);
  if (index === -1) {
    return res.status(404).json({ error: '找不到該同仁資料' });
  }

  const emp = employees[index];
  const empName = emp.name;
  employees.splice(index, 1);
  
  // Explicitly delete from Firestore to prevent orphaned documents
  if (db && isFirestoreAvailable) {
    firebaseDb.collection('employees').doc(id).delete().catch(err => {
      console.error(`Failed to delete employee ${id} from Firestore:`, err);
    });
  }

  logActivity(req, empName, 'DELETE_EMPLOYEE', `刪除同仁資料: ${empName} (${emp.department})`);
  saveDatabase();
  return res.json({ message: '成功刪除同仁資料', employees });
});

// Reject / Return employee onboarding to fill state (Reset signatures but keep text fields)
app.post('/api/hr/employees/:id/reject', (req, res) => {
  const { id } = req.params;
  const empIndex = employees.findIndex(emp => emp.id === id);
  if (empIndex === -1) {
    return res.status(404).json({ error: '找不到該同仁資料' });
  }

  const emp = employees[empIndex];
  emp.status = 'pending';
  emp.contractSigned = false;
  emp.rulesAgreed = false;
  emp.privacyAgreed = false;
  emp.guarantorSigned = false;
  emp.serviceSigned = false;
  if (emp.taxDeclaration) {
    emp.taxDeclaration.signed = false;
  }

  // Recalculate progress across 8 parts:
  let newProgress = 0;
  if (emp.personalData && emp.personalData.name && emp.personalData.phone) {
    newProgress += 15;
  }
  if (emp.careerData && (emp.careerData.experiences?.length > 0 || emp.careerData.educations?.length > 0 || emp.careerData.licenses?.length > 0)) {
    newProgress += 15;
  }
  if (emp.uploadedFiles && emp.uploadedFiles.length > 0) {
    newProgress += 15;
  }
  if (emp.rulesAgreed && emp.privacyAgreed) {
    newProgress += 10;
  }
  if (emp.taxDeclaration && emp.taxDeclaration.signed) {
    newProgress += 15;
  }
  if (emp.contractSigned) {
    newProgress += 10;
  }
  if (emp.guarantorSigned) {
    newProgress += 10;
  }
  if (emp.serviceSigned) {
    newProgress += 10;
  }

  emp.progress = newProgress;
  emp.updatedAt = new Date().toISOString();
  
  employees[empIndex] = emp;
  logActivity(req, emp.name, 'REJECT_ONBOARDING', `將同仁報到退回開放修改: ${emp.name}`);
  saveDatabase();
  return res.json({ message: '已將同仁申請退回，開放修改', employee: emp, employees });
});

// Update employee ID (員工編號)
app.put('/api/hr/employees/:id/empid', (req, res) => {
  const { id } = req.params;
  const { empId } = req.body;
  const empIndex = employees.findIndex(emp => emp.id === id);
  if (empIndex === -1) {
    return res.status(404).json({ error: '找不到該同仁資料' });
  }

  const emp = employees[empIndex];
  const oldId = emp.empId || '未設定';
  const newId = empId ? empId.trim() : '';
  emp.empId = newId;
  emp.updatedAt = new Date().toISOString();
  logActivity(req, emp.name, 'UPDATE_EMP_ID', `更新同仁編號: "${oldId}" -> "${newId || '未設定'}"`);
  saveDatabase();
  return res.json({ message: '員工編號更新完成', employee: emp, employees });
});

// Update employee email address (修改電子郵件地址)
app.put('/api/hr/employees/:id/email', (req, res) => {
  const { id } = req.params;
  const { email } = req.body;
  
  if (!email || !email.trim()) {
    return res.status(400).json({ error: '電子郵件地址不能為空' });
  }

  const empIndex = employees.findIndex(emp => emp.id === id);
  if (empIndex === -1) {
    return res.status(404).json({ error: '找不到該同仁資料' });
  }

  const newEmail = email.trim().toLowerCase();
  const duplicateExists = employees.some(emp => emp.id !== id && emp.email.toLowerCase() === newEmail);
  if (duplicateExists) {
    return res.status(400).json({ error: '此電子郵件地址已被其他同仁使用' });
  }

  const emp = employees[empIndex];
  const oldEmail = emp.email;
  emp.email = newEmail;
  emp.updatedAt = new Date().toISOString();
  
  logActivity(req, emp.name, 'UPDATE_EMAIL', `更新同仁電子郵件地址: "${oldEmail}" -> "${newEmail}"`);
  saveDatabase();
  return res.json({ message: '電子郵件地址更新完成', employee: emp, employees });
});

// Update employee contract probation months (合約試用期)
app.put('/api/hr/employees/:id/probation', (req, res) => {
  const { id } = req.params;
  const { contractProbationMonths } = req.body;
  const empIndex = employees.findIndex(emp => emp.id === id);
  if (empIndex === -1) {
    return res.status(404).json({ error: '找不到該同仁資料' });
  }

  const emp = employees[empIndex];
  const oldProbation = emp.contractProbationMonths || '三';
  const newProbation = contractProbationMonths ? contractProbationMonths.trim() : '三';
  emp.contractProbationMonths = newProbation;
  emp.updatedAt = new Date().toISOString();
  logActivity(req, emp.name, 'UPDATE_PROBATION', `更新同仁試用期: "${oldProbation}" -> "${newProbation}"`);
  saveDatabase();
  return res.json({ message: '合約試用期更新完成', employee: emp, employees });
});

// Send onboarding notification email (simulated)
app.post('/api/hr/employees/:id/send-onboarding-email', async (req, res) => {
  const { id } = req.params;
  const empIndex = employees.findIndex(emp => emp.id === id);
  if (empIndex === -1) {
    return res.status(404).json({ error: '找不到該同仁資料' });
  }

  const emp = employees[empIndex];
  
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_PASS;

  if (gmailUser && gmailPass) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: gmailUser,
          pass: gmailPass
        }
      });

      const host = req.get('host') || 'localhost:3000';
      const protocol = req.protocol || 'http';
      const loginLink = `${protocol}://${host}/`;

      await transporter.sendMail({
        from: `"雲朗集團人事系統" <${gmailUser}>`,
        to: emp.email,
        subject: `【雲朗觀光集團】新進同仁 ${emp.name} 報到通知`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #4f46e5;">新進同仁報到通知</h2>
            <p>親愛的 <strong>${emp.name}</strong> (${emp.title})，您好：</p>
            <p>歡迎您加入雲朗觀光集團！請於報到日 <strong>${emp.onboardDate}</strong> 前完成線上報到手續。</p>
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #334155;">報到登入資訊</h3>
              <ul style="list-style-type: none; padding: 0;">
                <li style="margin-bottom: 8px;">登入帳號(Email): <strong>${emp.email}</strong></li>
                <li style="margin-bottom: 8px;">專屬驗證碼(Token): <strong>${emp.authToken}</strong></li>
              </ul>
            </div>
            <div style="margin: 30px 0;">
              <a href="${loginLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">前往線上報到系統</a>
            </div>
            <p style="color: #64748b; font-size: 12px; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
              若有任何問題，請聯絡您的所屬人資主管。<br>
              雲朗觀光集團 HR 管理團隊 敬上
            </p>
          </div>
        `
      });

      emp.updatedAt = new Date().toISOString();
      logActivity(
        req, 
        emp.name, 
        'SEND_ONBOARDING_EMAIL', 
        `發送入職報到通知信至: ${emp.email} (包含姓名: ${emp.name}、職稱: ${emp.title}、日期: ${emp.onboardDate}、地點: ${emp.contractWorkLocation || '君品酒店'}、薪資: ${emp.contractSalaryAmount || '36,000'}與驗證碼: ${emp.authToken})`
      );
      saveDatabase();
      return res.json({ message: '報到通知信已成功發送！', employee: emp, employees });
    } catch (err: any) {
      console.error('發送郵件失敗:', err);
      return res.status(500).json({ error: '郵件發送失敗，請檢查系統 Gmail 設定。錯誤訊息: ' + err.message });
    }
  } else {
    // Fallback if .env not set
    console.log(`[模擬發送報到信] To: ${emp.email}`);
    emp.updatedAt = new Date().toISOString();
    logActivity(
      req, 
      emp.name, 
      'SEND_ONBOARDING_EMAIL', 
      `發送入職報到通知信至: ${emp.email} (模擬發送)`
    );
    saveDatabase();
    return res.json({ message: '【模擬發送】系統未設定 Gmail，報到通知信已模擬發送', employee: emp, employees });
  }
});

// Update onboarding progress and checklists manually by HR
app.put('/api/hr/employees/:id/onboarding-progress', (req, res) => {
  const { id } = req.params;
  const { 
    personalDataCompleted,
    careerDataCompleted,
    filesCompleted,
    rulesAgreedCompleted,
    taxCompleted,
    contractCompleted,
    guarantorCompleted,
    serviceCompleted,
    manualStatus, // 'pending' | 'completed'
    manualProgress // number (0 to 100)
  } = req.body;

  const empIndex = employees.findIndex(emp => emp.id === id);
  if (empIndex === -1) {
    return res.status(404).json({ error: '找不到該同仁資料' });
  }

  const emp = employees[empIndex];

  // 1. Handle individual checkbox overrides
  if (personalDataCompleted !== undefined) {
    if (personalDataCompleted) {
      if (!emp.personalData) {
        emp.personalData = {
          name: emp.name,
          phone: '0900-000-000',
          idNumber: 'A123456789',
          birthday: '2000-01-01',
          email: emp.email,
          legalAddress: '由 HR 手動覆核完成',
          contactAddress: '由 HR 手動覆核完成',
          bankName: '手動核備',
          bankAccount: '手動核備',
          dependentsCount: '0 人',
          emergencyName: '聯絡人',
          emergencyRelationship: '其他',
          emergencyPhone: '0900-000-000'
        };
      }
    } else {
      delete emp.personalData;
    }
  }

  if (careerDataCompleted !== undefined) {
    if (careerDataCompleted) {
      if (!emp.careerData) {
        emp.careerData = {
          experiences: [{ companyName: '手動核備', jobTitle: '無', startDate: '', endDate: '', leaveReason: '' }],
          licenses: [],
          additionalNotes: '由 HR 手動覆核完成'
        };
      }
    } else {
      delete emp.careerData;
    }
  }

  if (filesCompleted !== undefined) {
    if (filesCompleted) {
      if (!emp.uploadedFiles || emp.uploadedFiles.length === 0) {
        emp.uploadedFiles = [{
          name: 'HR_MANUAL_VERIFIED.pdf',
          size: 1024,
          uploadedAt: new Date().toISOString(),
          docType: '其他應繳文件'
        }];
      }
    } else {
      emp.uploadedFiles = [];
    }
  }

  if (rulesAgreedCompleted !== undefined) {
    emp.rulesAgreed = rulesAgreedCompleted;
    emp.privacyAgreed = rulesAgreedCompleted;
  }

  if (taxCompleted !== undefined) {
    if (taxCompleted) {
      emp.taxDeclaration = {
        spouseName: '', spouseBirthday: '', spouseIdNumber: '',
        dependents: [],
        signed: true,
        signName: emp.name,
        signedAt: new Date().toISOString().split('T')[0]
      };
    } else {
      if (emp.taxDeclaration) {
        emp.taxDeclaration.signed = false;
      }
    }
  }

  if (contractCompleted !== undefined) {
    emp.contractSigned = contractCompleted;
    if (contractCompleted && !emp.contractDate) {
      emp.contractDate = new Date().toISOString().split('T')[0];
    }
  }

  if (guarantorCompleted !== undefined) {
    emp.guarantorSigned = guarantorCompleted;
    if (guarantorCompleted) {
      if (!emp.guarantorDate) emp.guarantorDate = new Date().toISOString().split('T')[0];
      if (!emp.guarantorData) {
        emp.guarantorData = {
          guarantorName: '手動覆核',
          birthday: '1980-01-01',
          idNumber: 'A123456789',
          address: '手動覆核',
          phone: '0900-000-000',
          companyName: '無',
          companyTitle: '無',
          companyAddress: '無',
          companyPhone: '0900-000-000',
          relationship: '其他',
          validUntil: new Date().toISOString().split('T')[0]
        };
      }
    }
  }

  if (serviceCompleted !== undefined) {
    emp.serviceSigned = serviceCompleted;
    if (serviceCompleted && !emp.serviceDate) {
      emp.serviceDate = new Date().toISOString().split('T')[0];
    }
  }

  // 2. Recalculate progress or apply manual override
  let calculatedProgress = 0;
  if (emp.personalData && emp.personalData.name && emp.personalData.phone) {
    calculatedProgress += 15;
  }
  if (emp.careerData && (emp.careerData.experiences?.length > 0 || emp.careerData.educations?.length > 0 || emp.careerData.licenses?.length > 0)) {
    calculatedProgress += 15;
  }
  if (emp.uploadedFiles && emp.uploadedFiles.length > 0) {
    calculatedProgress += 15;
  }
  if (emp.rulesAgreed && emp.privacyAgreed) {
    calculatedProgress += 10;
  }
  if (emp.taxDeclaration && emp.taxDeclaration.signed) {
    calculatedProgress += 15;
  }
  if (emp.contractSigned) {
    calculatedProgress += 10;
  }
  if (emp.guarantorSigned) {
    calculatedProgress += 10;
  }
  if (emp.serviceSigned) {
    calculatedProgress += 10;
  }

  if (manualProgress !== undefined) {
    emp.progress = manualProgress;
  } else {
    emp.progress = calculatedProgress;
  }

  if (manualStatus !== undefined) {
    emp.status = manualStatus;
  } else {
    if (emp.progress === 100) {
      emp.status = 'completed';
    } else {
      emp.status = 'pending';
    }
  }

  emp.updatedAt = new Date().toISOString();
  employees[empIndex] = emp;
  
  logActivity(req, emp.name, 'MANUAL_PROGRESS_UPDATE', `HR手動更新同仁「${emp.name}」的報到進度與狀態 (進度: ${emp.progress}%, 狀態: ${emp.status})`);
  saveDatabase();

  return res.json({ message: '手動更新報到進度成功', employee: emp, employees });
});

// Get HR Admins
app.get('/api/hr/admins', (req, res) => {
  const normalized = getNormalizedAdmins();
  const clientAdmins = normalized.map(admin => ({
    email: admin.email,
    permissions: admin.permissions || [],
    isPrimary: admin.email.toLowerCase().trim() === primaryAdminEmail.toLowerCase().trim()
  }));
  return res.json(clientAdmins);
});

// Add HR Admin
app.post('/api/hr/admins', (req, res) => {
  const operatorEmail = decodeURIComponent(req.headers['x-operator-email'] as string || '').toLowerCase().trim();
  const normalized = getNormalizedAdmins();
  const operatorAdmin = normalized.find(a => a.email === operatorEmail);
  const operatorPermissions = operatorAdmin?.permissions || (
    operatorEmail === primaryAdminEmail.toLowerCase().trim() 
      ? ['admin', 'tracker', 'publish', 'ai', 'audit'] 
      : ['tracker', 'publish', 'ai']
  );

  if (!operatorPermissions.includes('admin')) {
    return res.status(403).json({ error: '⚠️ 您的管理帳號並未附加「管理權限」(admin)，無法進行管理者帳號之新增！' });
  }

  const { email, permissions } = req.body;
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email 欄位不能為空' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const exists = normalized.some(admin => admin.email === cleanEmail);

  if (exists) {
    return res.status(400).json({ error: '此 Email 已是HR管理者之一' });
  }

  const finalPermissions = Array.isArray(permissions) && permissions.length > 0
    ? permissions
    : ['tracker', 'publish', 'ai'];

  hrAdmins.push({ 
    email: cleanEmail, 
    password: 'mis',
    permissions: finalPermissions
  });
  logActivity(req, '人資管理系統', 'ADD_ADMIN', `新增 HR 管理者: ${cleanEmail} (權限: ${finalPermissions.join(', ')})`);
  saveDatabase();

  const freshAdmins = getNormalizedAdmins().map(admin => ({
    email: admin.email,
    permissions: admin.permissions || []
  }));
  return res.json({ message: '成功新增HR管理者', hrAdmins: freshAdmins });
});

// Delete HR Admin
app.delete('/api/hr/admins', (req, res) => {
  const operatorEmail = decodeURIComponent(req.headers['x-operator-email'] as string || '').toLowerCase().trim();
  const targetEmail = (req.body.email || '').toLowerCase().trim();

  if (!targetEmail) {
    return res.status(400).json({ error: '⚠️ 請提供欲刪除的管理員信箱' });
  }

  // 1. Verify operator has 'admin' permission
  const normalized = getNormalizedAdmins();
  const operatorAdmin = normalized.find(a => a.email === operatorEmail);
  const operatorPermissions = operatorAdmin?.permissions || (
    operatorEmail === primaryAdminEmail.toLowerCase().trim() 
      ? ['admin', 'tracker', 'publish', 'ai', 'audit'] 
      : ['tracker', 'publish', 'ai']
  );

  if (!operatorPermissions.includes('admin')) {
    return res.status(403).json({ error: '⚠️ 您的管理帳號並未附加「管理權限」(admin)，無法進行管理員帳號之刪除！' });
  }

  // 2. Prevent deleting Primary Admin
  if (targetEmail === primaryAdminEmail.toLowerCase().trim()) {
    return res.status(400).json({ error: `⚠️ 主要負責人 (${primaryAdminEmail}) 為系統核心帳戶，禁止刪除！如欲刪除請先進行主要管理者移轉。` });
  }

  // 3. Prevent deleting themselves
  if (targetEmail === operatorEmail) {
    return res.status(400).json({ error: '⚠️ 為避免管理權限真空，群組帳號禁止刪除目前正在登入使用的帳戶！' });
  }

  // Find target in current hrAdmins
  const targetIdx = hrAdmins.findIndex(admin => {
    const email = typeof admin === 'string' ? admin.toLowerCase().trim() : (admin.email || '').toLowerCase().trim();
    return email === targetEmail;
  });

  if (targetIdx === -1) {
    return res.status(404).json({ error: '⚠️ 找不到欲刪除的管理員帳號' });
  }

  // Remove from hrAdmins list
  hrAdmins.splice(targetIdx, 1);
  
  // Explicitly delete from Firestore to prevent orphaned documents
  if (db && isFirestoreAvailable) {
    firebaseDb.collection('admins').doc(targetEmail).delete().catch(err => {
      console.error(`Failed to delete admin ${targetEmail} from Firestore:`, err);
    });
  }

  logActivity(req, '人資管理系統', 'DELETE_ADMIN', `刪除 HR 管理者: ${targetEmail}`);
  saveDatabase();

  const freshAdmins = getNormalizedAdmins().map(admin => ({
    email: admin.email,
    permissions: admin.permissions || []
  }));
  return res.json({ message: '成功刪除 HR 管理者', hrAdmins: freshAdmins });
});

// Transfer Primary Admin
app.post('/api/hr/transfer-primary', (req, res) => {
  const operatorEmail = decodeURIComponent(req.headers['x-operator-email'] as string || '').toLowerCase().trim();
  const { targetEmail } = req.body;

  if (!targetEmail) {
    return res.status(400).json({ error: '⚠️ 請選擇承接的主要管理者' });
  }

  const cleanTargetEmail = targetEmail.trim().toLowerCase();

  // 1. Verify operator is the current primary admin
  if (operatorEmail !== primaryAdminEmail.toLowerCase().trim()) {
    return res.status(403).json({ error: `⚠️ 只有當前的主要管理者 (${primaryAdminEmail}) 才可以進行權限移轉！` });
  }

  // 2. Prevent transferring to themselves
  if (cleanTargetEmail === operatorEmail) {
    return res.status(400).json({ error: '⚠️ 無法移轉給自己！請選擇其他 HR 帳號。' });
  }

  // 3. Verify target admin exists
  const normalized = getNormalizedAdmins();
  const targetAdmin = normalized.find(a => a.email === cleanTargetEmail);
  if (!targetAdmin) {
    return res.status(404).json({ error: '⚠️ 找不到承接的 HR 帳號，請確認該信箱已被新增為管理者。' });
  }

  // 4. Update the target admin's permissions to ensure they have all permissions
  const targetIdx = hrAdmins.findIndex(admin => {
    const email = typeof admin === 'string' ? admin.toLowerCase().trim() : (admin.email || '').toLowerCase().trim();
    return email === cleanTargetEmail;
  });

  if (targetIdx !== -1) {
    if (typeof hrAdmins[targetIdx] === 'string') {
      hrAdmins[targetIdx] = {
        email: cleanTargetEmail,
        password: 'mis',
        permissions: ['admin', 'tracker', 'publish', 'ai', 'audit']
      };
    } else {
      hrAdmins[targetIdx].permissions = ['admin', 'tracker', 'publish', 'ai', 'audit'];
    }
  }

  // Also ensure previous primary admin has 'admin' and standard permissions
  const prevIdx = hrAdmins.findIndex(admin => {
    const email = typeof admin === 'string' ? admin.toLowerCase().trim() : (admin.email || '').toLowerCase().trim();
    return email === operatorEmail;
  });

  if (prevIdx !== -1) {
    if (typeof hrAdmins[prevIdx] === 'string') {
      hrAdmins[prevIdx] = {
        email: operatorEmail,
        password: 'mis',
        permissions: ['admin', 'tracker', 'publish', 'ai', 'audit']
      };
    } else {
      hrAdmins[prevIdx].permissions = hrAdmins[prevIdx].permissions || ['admin', 'tracker', 'publish', 'ai', 'audit'];
    }
  }

  // 5. Update primaryAdminEmail
  primaryAdminEmail = cleanTargetEmail;

  logActivity(req, '人資管理系統', 'TRANSFER_PRIMARY_ADMIN', `主要管理者權限移轉：由 ${operatorEmail} 移轉至 ${cleanTargetEmail}`);
  saveDatabase();

  const freshAdmins = getNormalizedAdmins().map(admin => ({
    email: admin.email,
    permissions: admin.permissions || [],
    isPrimary: admin.email.toLowerCase().trim() === primaryAdminEmail.toLowerCase().trim()
  }));

  return res.json({ 
    message: `成功將主要管理者權限移轉給「${cleanTargetEmail}」！`, 
    hrAdmins: freshAdmins,
    primaryAdminEmail: primaryAdminEmail
  });
});

// Change Password Endpoint
app.post('/api/hr/change-password', (req, res) => {
  const { email, oldPassword, newPassword } = req.body;
  if (!email || !oldPassword || !newPassword) {
    return res.status(400).json({ error: '所有欄位均為必選填' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalized = getNormalizedAdmins();
  const adminIndex = normalized.findIndex(admin => admin.email === normalizedEmail);

  if (adminIndex === -1) {
    return res.status(404).json({ error: '找不到該管理員帳號' });
  }

  const currentPassword = normalized[adminIndex].password || 'mis';
  if (oldPassword !== currentPassword) {
    return res.status(400).json({ error: '目前密碼驗證不正確，變更失敗' });
  }

  if (newPassword.length < 3) {
    return res.status(400).json({ error: '新密碼長度至少需 3 個字元' });
  }

  // Update in official array
  hrAdmins[adminIndex] = {
    email: normalizedEmail,
    password: newPassword
  };

  logActivity(req, '人資管理系統', 'CHANGE_PASSWORD', `變更 HR 管理者密碼成功: ${normalizedEmail}`);
  saveDatabase();

  return res.json({ success: true, message: '密碼變更成功，請記住您的新密碼' });
});

// Request Forgot Password (Simulated Email reset link)
app.post('/api/hr/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: '請輸入電子郵件' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  
  try {
    const db = await getDb();
    const userRecord = await db.get(`SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?`, [normalizedEmail, normalizedEmail]);
    
    if (!userRecord) {
      return res.status(404).json({ error: '此電子郵件非授權之 HR 管理者，請與主要負責人聯絡' });
    }
  } catch (err: any) {
    console.error("Forgot password db error:", err);
    return res.status(500).json({ error: "伺服器錯誤: " + err.message });
  }

  // Generate simple token: "tok_xxxx"
  const token = 'tok_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  
  // Save token in memory memory map (Expires in 30 minutes)
  forgotPasswordTokens[token] = {
    email: normalizedEmail,
    expires: Date.now() + 30 * 60 * 1000
  };

  // Construct standard HTTP link pointing to port 3000 web index
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol || 'http';
  const resetLink = `${protocol}://${host}/?reset_token=${token}`;

  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_PASS;

  if (gmailUser && gmailPass) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: gmailUser,
          pass: gmailPass
        }
      });

      await transporter.sendMail({
        from: `"雲朗集團人事系統" <${gmailUser}>`,
        to: normalizedEmail,
        subject: '雲朗集團人事系統 - HR管理者重設密碼信件',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #4f46e5;">HR 管理者密碼重置</h2>
            <p>您好，</p>
            <p>請點選下方按鈕重設您的 HR 後台登入密碼（此連結將在 30 分鐘後失效）：</p>
            <div style="margin: 30px 0;">
              <a href="${resetLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">重設密碼</a>
            </div>
            <p style="color: #64748b; font-size: 12px; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
              如果您並未要求重設密碼，請忽略此封信件。<br>
              若有任何問題，請聯絡系統管理員。
            </p>
          </div>
        `
      });

      return res.json({
        success: true,
        message: '重設密碼信件已成功發送至您的信箱！'
      });
    } catch (err: any) {
      console.error('發送郵件失敗:', err);
      return res.status(500).json({ error: '郵件發送失敗，請檢查系統 Gmail 設定。錯誤訊息: ' + err.message });
    }
  } else {
    // Fallback to simulated email
    console.log(`\n==========================================\n[模擬電子郵件通知 SMS / EMAIL SIMULATOR]\n==========================================\n收件者 (To): ${normalizedEmail}\n標題 (Subject): 雲朗集團人事系統 - HR管理者重設密碼信件\n內容 (Body):\n您好，請點選以下連結重設您的 HR 後台登入密碼（連結 30 分鐘內有效）：\n${resetLink}\n==========================================\n`);

    return res.json({
      success: true,
      message: '【系統未設定 GMAIL_USER，已啟用模擬發送】重設密碼信件已成功發送 (本系統已為您模擬收信通知)！',
      simulatedEmail: {
        to: normalizedEmail,
        subject: '雲朗集團人事系統 - HR管理者重設密碼信件',
        link: resetLink,
        token: token
      }
    });
  }
});

// Confirm Password Reset with Token
app.post('/api/hr/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: '請提供重設 Token 與新密碼' });
  }

  const record = forgotPasswordTokens[token];
  if (!record) {
    return res.status(400).json({ error: '重設連結無效、或此連結已被使用過' });
  }

  if (Date.now() > record.expires) {
    delete forgotPasswordTokens[token];
    return res.status(400).json({ error: '此連結已過期，請重新申請重設密碼' });
  }

  const normalizedEmail = record.email.toLowerCase().trim();
  
  try {
    const db = await getDb();
    const userRecord = await db.get(`SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?`, [normalizedEmail, normalizedEmail]);

    if (!userRecord) {
      delete forgotPasswordTokens[token];
      return res.status(404).json({ error: '找不到該管理員帳號' });
    }

    if (newPassword.length < 3) {
      return res.status(400).json({ error: '密碼長度至少需 3 個字元' });
    }

    // Overwrite password in SQLite DB
    await db.run(`UPDATE users SET password = ? WHERE id = ?`, [newPassword, userRecord.id]);

    // Burn token
    delete forgotPasswordTokens[token];

    logActivity(req, '人資管理系統', 'RESET_PASSWORD', `HR管理員依靠重設信完成重設密碼: ${normalizedEmail}`);
    saveDatabase();

    return res.json({ success: true, message: '密碼重設成功！請回到登入頁面並使用新密碼進行登入。' });
  } catch (err: any) {
    console.error("Reset password error:", err);
    return res.status(500).json({ error: "伺服器錯誤: " + err.message });
  }
});

// 3. Employee Endpoints
// Save / Update employee onboarding progress & data
app.put('/api/employee/save', (req, res) => {
  const { id, personalData, careerData, rulesAgreed, privacyAgreed, taxDeclaration, contractSigned, contractDate, guarantorSigned, guarantorDate, guarantorData, serviceSigned, serviceDate } = req.body;
  
  const empIndex = employees.findIndex(emp => emp.id === id);
  if (empIndex === -1) {
    return res.status(404).json({ error: '找不到新進同仁資料' });
  }

  const emp = employees[empIndex];

  if (personalData !== undefined) emp.personalData = personalData;
  if (careerData !== undefined) emp.careerData = careerData;
  if (rulesAgreed !== undefined) emp.rulesAgreed = rulesAgreed;
  if (privacyAgreed !== undefined) emp.privacyAgreed = privacyAgreed;
  if (taxDeclaration !== undefined) emp.taxDeclaration = taxDeclaration;
  if (contractSigned !== undefined) emp.contractSigned = contractSigned;
  if (contractDate !== undefined) emp.contractDate = contractDate;
  if (guarantorSigned !== undefined) emp.guarantorSigned = guarantorSigned;
  if (guarantorDate !== undefined) emp.guarantorDate = guarantorDate;
  if (guarantorData !== undefined) emp.guarantorData = guarantorData;
  if (serviceSigned !== undefined) emp.serviceSigned = serviceSigned;
  if (serviceDate !== undefined) emp.serviceDate = serviceDate;

  // Recalculate progress across 8 parts summing to exactly 100%:
  // 1. PersonalData: 15%
  // 2. CareerData: 15%
  // 3. uploadedFiles length > 0: 15%
  // 4. rulesAgreed & privacyAgreed: 10%
  // 5. taxDeclaration signed: 15%
  // 6. contractSigned: 10%
  // 7. guarantorSigned: 10%
  // 8. serviceSigned: 10%
  let newProgress = 0;
  
  if (emp.personalData && emp.personalData.name && emp.personalData.phone) {
    newProgress += 15;
  }
  if (emp.careerData && (emp.careerData.experiences?.length > 0 || emp.careerData.educations?.length > 0 || emp.careerData.licenses?.length > 0)) {
    newProgress += 15;
  }
  if (emp.uploadedFiles && emp.uploadedFiles.length > 0) {
    newProgress += 15;
  }
  if (emp.rulesAgreed && emp.privacyAgreed) {
    newProgress += 10;
  }
  if (emp.taxDeclaration && emp.taxDeclaration.signed) {
    newProgress += 15;
  }
  if (emp.contractSigned) {
    newProgress += 10;
  }
  if (emp.guarantorSigned) {
    newProgress += 10;
  }
  if (emp.serviceSigned) {
    newProgress += 10;
  }

  emp.progress = newProgress;
  if (newProgress === 100) {
    emp.status = 'completed';
  } else {
    emp.status = 'pending';
  }

  emp.updatedAt = new Date().toISOString();
  employees[empIndex] = emp;
  saveDatabase();

  return res.json({ message: '草稿儲存成功', employee: emp });
});

// Upload verification documents (PDF file representation)
app.post('/api/employee/upload', (req, res) => {
  const { id, fileName, fileSize, base64Data, docType } = req.body;
  if (!id || !fileName || !fileSize) {
    return res.status(400).json({ error: '缺少上傳資訊' });
  }

  const empIndex = employees.findIndex(emp => emp.id === id);
  if (empIndex === -1) {
    return res.status(404).json({ error: '找不到該同仁資料' });
  }

  const emp = employees[empIndex];
  
  // Clean file representation
  const newFile = {
    name: fileName,
    size: fileSize,
    uploadedAt: new Date().toLocaleDateString('zh-TW', { hour12: false }),
    base64Data: base64Data || '',
    docType: docType || ''
  };

  // If we receive a docType, make sure we only keep one file for that docType
  if (docType) {
    emp.uploadedFiles = (emp.uploadedFiles || []).filter(f => f.docType !== docType);
  } else {
    emp.uploadedFiles = emp.uploadedFiles || [];
  }
  emp.uploadedFiles.push(newFile);
  
  // Recalculate progress across 8 parts:
  let newProgress = 0;
  if (emp.personalData && emp.personalData.name && emp.personalData.phone) newProgress += 15;
  if (emp.careerData && (emp.careerData.experiences?.length > 0 || emp.careerData.educations?.length > 0 || emp.careerData.licenses?.length > 0)) newProgress += 15;
  if (emp.uploadedFiles && emp.uploadedFiles.length > 0) newProgress += 15;
  if (emp.rulesAgreed && emp.privacyAgreed) newProgress += 10;
  if (emp.taxDeclaration && emp.taxDeclaration.signed) newProgress += 15;
  if (emp.contractSigned) newProgress += 10;
  if (emp.guarantorSigned) newProgress += 10;
  if (emp.serviceSigned) newProgress += 10;

  emp.progress = newProgress;
  if (newProgress === 100) emp.status = 'completed';
  
  emp.updatedAt = new Date().toISOString();
  saveDatabase();
  
  return res.json({ message: '文件上傳成功', employee: emp });
});

// Delete uploaded verification documents
app.delete('/api/employee/upload', (req, res) => {
  const { id, fileName } = req.body;
  const empIndex = employees.findIndex(emp => emp.id === id);
  if (empIndex === -1) {
    return res.status(404).json({ error: '找不到該同仁資料' });
  }

  const emp = employees[empIndex];
  emp.uploadedFiles = emp.uploadedFiles.filter(f => f.name !== fileName);

  // Recalculate progress across 8 parts:
  let newProgress = 0;
  if (emp.personalData && emp.personalData.name && emp.personalData.phone) newProgress += 15;
  if (emp.careerData && (emp.careerData.experiences?.length > 0 || emp.careerData.educations?.length > 0 || emp.careerData.licenses?.length > 0)) newProgress += 15;
  if (emp.uploadedFiles && emp.uploadedFiles.length > 0) newProgress += 15;
  if (emp.rulesAgreed && emp.privacyAgreed) newProgress += 10;
  if (emp.taxDeclaration && emp.taxDeclaration.signed) newProgress += 15;
  if (emp.contractSigned) newProgress += 10;
  if (emp.guarantorSigned) newProgress += 10;
  if (emp.serviceSigned) newProgress += 10;

  emp.progress = newProgress;
  emp.status = newProgress === 100 ? 'completed' : 'pending';
  emp.updatedAt = new Date().toISOString();
  saveDatabase();

  return res.json({ message: '文件已移除', employee: emp });
});

async function bootstrap() {
  // Initialize SQLite tables and seed data
  await initSQLite();
  loadDatabase();

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

  // Strict port: never silently hop to another port.
  // Hopping caused the old server to keep serving stale UI behind ngrok.
  app.listen(PORT, "0.0.0.0", () => {
    console.log("==================================================");
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📁 Working directory: ${process.cwd()}`);
    console.log("==================================================");
  }).on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error("==================================================");
      console.error(`❌ Port ${PORT} 已被其他程式佔用（很可能是舊版伺服器還在跑）`);
      console.error(`   請先執行以下指令關掉舊程式，再重新 npm run dev：`);
      console.error(`   kill $(ss -ltnp | grep ':${PORT} ' | grep -oP 'pid=\\K[0-9]+')`);
      console.error("==================================================");
    } else {
      console.error(err);
    }
    process.exit(1);
  });
}

bootstrap().catch(err => {
  console.error("❌ Failed to start server:", err);
  process.exit(1);
});
