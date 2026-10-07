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
        { id: "t1", min: 0, max: 50000, rate: 2, label: "?箸璆剔蜀" },
        { id: "t2", min: 50001, max: 150000, rate: 5, label: "璅?璆剔蜀" },
        { id: "t3", min: 150001, max: 300000, rate: 8, label: "?芾璆剔蜀" },
        { id: "t4", min: 300001, max: 99999999, rate: 12, label: "??璆剔蜀" }
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
        status TEXT DEFAULT '撌脰?蝞?,
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

    // ?? Seed Default Data (only if tables are empty) ??

    // Default Users
    const existingUsers = await db.get(`SELECT COUNT(*) as count FROM users`);
    if (existingUsers.count === 0) {
      await db.run(`INSERT INTO users (email, username, name, password, role) VALUES (?,?,?,?,?)`,
        ['gordon.huang@ldchotels.com', 'gordon.huang@ldchotels.com', 'Gordon', 'mis', 'HR_ADMIN']);
      await db.run(`INSERT INTO users (email, username, name, password, role) VALUES (?,?,?,?,?)`,
        ['vivian.chiang@ldchotels.com', 'vivian.chiang@ldchotels.com', '擃?銝餌恣', 'mis', 'EXECUTIVE']);
      await db.run(`INSERT INTO users (email, username, name, password, role) VALUES (?,?,?,?,?)`,
        ['sales_director@ldchotels.com', 'sales_leader', '璆剖?銝餌恣', 'sales', 'SALES_LEADER']);
      await db.run(`INSERT INTO users (email, username, name, password, role) VALUES (?,?,?,?,?)`,
        ['ann.hsu@ldchotels.com', 'ann.hsu@ldchotels.com', 'Ann', 'mis', 'HR_ADMIN']);
      console.log("??Seeded default users.");
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
      console.log("??Seeded default role permissions.");
    }

    // Default Sales Config
    const existingConfig = await db.get(`SELECT COUNT(*) as count FROM sales_config`);
    if (existingConfig.count === 0) {
      const tiers = JSON.stringify([
        { id: "t1", min: 0, max: 50000, rate: 2, label: "?箸璆剔蜀" },
        { id: "t2", min: 50001, max: 150000, rate: 5, label: "璅?璆剔蜀" },
        { id: "t3", min: 150001, max: 300000, rate: 8, label: "?芾璆剔蜀" },
        { id: "t4", min: 300001, max: 99999999, rate: 12, label: "??璆剔蜀" }
      ]);
      await db.run(`INSERT INTO sales_config (id, tiers, target_bonus, target_amount) VALUES (1, ?, 10000, 200000)`, [tiers]);
      console.log("??Seeded default sales config.");
    }

    // Default Drive Sync Settings
    const existingDrive = await db.get(`SELECT COUNT(*) as count FROM drive_sync_settings`);
    if (existingDrive.count === 0) {
      await db.run(`
        INSERT INTO drive_sync_settings (id, folder_url, folder_id, auto_sync, frequency, last_sync_status, target_year, auth_mode, google_client_id)
        VALUES (1, 'https://drive.google.com/drive/folders/1i8t5Q1r5-Y4RZeadGcq9QGEzLUponwQ7',
                '1i8t5Q1r5-Y4RZeadGcq9QGEzLUponwQ7', 0, 'manual', 'idle', 2025, 'direct', '')
      `);
      console.log("??Seeded default drive sync settings.");
    }

    console.log("?? SQLite initialization complete!");
  } catch (err) {
    console.error("??Failed to initialize SQLite tables:", err);
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
      await addAuditLog(employee.name, 'employee', "?∪極?勗?餃", "?圈脣撌仿?撠惇??蝣潛?亦頂蝯?);
      return res.json({ success: true, user: employee, role: 'employee' });
    } else {
      return res.status(401).json({ success: false, message: "?餃憭望?嚗摮隞嗆???蝣潔?甇?Ⅱ (Invalid token)" });
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
      await addAuditLog(matchedUser.username, matchedUser.role, "?餃蝟餌絞", `???餃蝟餌絞嚗?鈭?${matchedUser.role} 甈?`);
      return res.json({ success: true, user: matchedUser, role: matchedUser.role });
    }

    return res.status(401).json({ success: false, message: "撣唾???蝣潮隤?(Invalid username or password)" });
  } catch (err: any) {
    console.error("Login error:", err);
    return res.status(500).json({ success: false, message: "隡箸??券隤? " + err.message });
  }
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
    await addAuditLog(username || "蝞∠???, role || "HR_ADMIN", "?湔閫甈?閮剖?", "靽格鈭頂蝯梯??脩??摮?甈?");
    res.json({ success: true, rolePermissions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/permissions/users", async (req, res) => {
  const { email, username, name, password, role: newRole, creatorUsername, creatorRole } = req.body;
  if (!email || !username || !name || !password || !newRole) {
    return res.status(400).json({ error: "???雿??箏?憛恬?" });
  }
  try {
    const db = await getDb();
    const existing = await db.get(
      `SELECT id FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)`,
      [email, username]
    );
    if (existing) {
      return res.status(400).json({ error: "撣唾???E-mail 撌脣??剁?" });
    }
    await db.run(
      `INSERT INTO users (email, username, name, password, role) VALUES (?, ?, ?, ?, ?)`,
      [email, username, name, password, newRole]
    );
    const users = await db.all(`SELECT email, username, name, role FROM users`);
    await addAuditLog(creatorUsername || "蝞∠???, creatorRole || "HR_ADMIN", "?啣???撣唾?", `?啣?撣唾?: ${name} (${email}), 閫: ${newRole}`);
    res.json({ success: true, users });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/change-password", async (req, res) => {
  const { email, oldPassword, newPassword, username, role } = req.body;
  if (!email || !oldPassword || !newPassword) {
    return res.status(400).json({ error: "甈?銝雲嚗? });
  }
  try {
    const db = await getDb();
    const user = await db.get(`SELECT * FROM users WHERE LOWER(email) = LOWER(?)`, [email]);
    if (!user) return res.status(404).json({ error: "?曆??啗府??撣唾?嚗? });
    if (user.password !== oldPassword) return res.status(400).json({ error: "??蝣潔?甇?Ⅱ嚗? });
    await db.run(`UPDATE users SET password = ? WHERE LOWER(email) = LOWER(?)`, [newPassword, email]);
    await addAuditLog(username || user.name, role || user.role, "靽格撖Ⅳ", `?? ${user.name} (${email}) ??霈?餃撖Ⅳ`);
    res.json({ success: true, message: "撖Ⅳ靽格??嚗? });
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
    return res.status(403).json({ error: "甈?銝雲嚗??R蝞∠??∩耨??(HR Admin permission required)" });
  }
  try {
    const db = await getDb();
    await db.run(
      `INSERT INTO sales_config (id, tiers, target_bonus, target_amount) VALUES (1, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET tiers=excluded.tiers, target_bonus=excluded.target_bonus, target_amount=excluded.target_amount`,
      [JSON.stringify(tiers), targetBonus, targetAmount]
    );
    await refreshCommissionRecords();
    await addAuditLog(username, role, "?湔???", `霈?鈭平蝮曄???頝????嚗?憿???瑼鳴?${targetAmount}嚗?璅??蛛?${targetBonus}`);
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
        <div class="icon">??</div>
        <h2>甇??? Google ??...</h2>
        <p>隢???閬?撠????/p>
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
    return res.status(403).json({ error: "甈?銝雲嚗??R蝞∠??∩耨?? });
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
    await addAuditLog(username, role, "?湔?脩垢?郊閮剖?",
      `?湔 Google Drive ?芸??郊??嚗?{frequency}嚗璅冗嚗?{folderId}嚗?霅芋撘?${authMode || "direct"}`);
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
    return res.status(403).json({ error: "甈?銝雲 (HR Admin permission required)" });
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
        Number(baseSalary) + cal.totalPay, period, "撌脰?蝞?]
    );
    await addAuditLog(username, role, "?啣?璆剔蜀閮?",
      `?箏撌?${name} (${empId}) 撱箇? ${period} ?平蝮曇???璆剔蜀嚗?{salesAmount}嚗?蝞???${cal.totalPay}`);
    res.json({
      success: true, record: {
        id, empId, name, baseSalary: Number(baseSalary), salesAmount: Number(salesAmount),
        commission: cal.commission, bonus: cal.bonus,
        totalPay: Number(baseSalary) + cal.totalPay, period, status: "撌脰?蝞?
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/sales/records/:id", async (req, res) => {
  const { id } = req.params;
  const { salesAmount, baseSalary, status, username, role } = req.body;
  if (role === "SALES_LEADER" && status && status !== "?詨?銝?) {
    return res.status(403).json({ error: "璆剖?銝餌恣???詨?嚗??舐?亥??渡???(Access denied)" });
  }
  if (role !== "HR_ADMIN" && role !== "SALES_LEADER") {
    return res.status(403).json({ error: "甈?銝雲 (Permission required)" });
  }
  try {
    const db = await getDb();
    const old = await db.get(`SELECT * FROM sales_records WHERE id = ?`, [id]);
    if (!old) return res.status(404).json({ error: "?曆??啗府蝑平蝮曇??? });
    const newSalesAmount = salesAmount !== undefined ? Number(salesAmount) : Number(old.sales_amount);
    const newBaseSalary = baseSalary !== undefined ? Number(baseSalary) : Number(old.base_salary);
    const newStatus = status !== undefined ? status : old.status;
    const config = await getSalesConfig();
    const cal = calculateCommission(newSalesAmount, config);
    await db.run(
      `UPDATE sales_records SET base_salary=?, sales_amount=?, commission=?, bonus=?, total_pay=?, status=? WHERE id=?`,
      [newBaseSalary, newSalesAmount, cal.commission, cal.bonus, newBaseSalary + cal.totalPay, newStatus, id]
    );
    await addAuditLog(username, role, "靽格璆剔蜀閮?",
      `?湔 ${old.name} (${old.period}) 璆剔蜀??嚗????渡 ${newStatus}`);
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
    return res.status(403).json({ error: "甈?銝雲 (HR Admin permission required)" });
  }
  try {
    const db = await getDb();
    const record = await db.get(`SELECT * FROM sales_records WHERE id = ?`, [id]);
    if (!record) return res.status(404).json({ error: "?曆??啗府蝑平蝮曇??? });
    await db.run(`DELETE FROM sales_records WHERE id = ?`, [id]);
    await addAuditLog(String(username), String(role), "?芷璆剔蜀閮?",
      `?芷鈭?${record.name} (${record.period}) ?平蝮曄???蝞?蝝躬);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Employee Salary Records API (for Median listings report)
app.get("/api/employees/records", async (req, res) => {
  const { role } = req.query;
  if (role !== "HR_ADMIN" && role !== "EXECUTIVE") {
    return res.status(403).json({ error: "甈?銝雲嚗迨鞈?????芾?甈?嚗???HR 鈭箏???蜓蝞⊥?? });
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
    return res.status(403).json({ error: "甈?銝雲嚗??R鈭箏?臬?∪極?芾? (HR Admin only)" });
  }
  if (!Array.isArray(employees) || employees.length === 0) {
    return res.status(400).json({ error: "?⊥???交?? });
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
      const empValues = [
        emp.name, emp.title || "?冽?鈭箏", emp.department || "???,
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
      const existingMember = await db.get(`SELECT id FROM members WHERE emp_id = ?`, [emp.empId]);
      if (existingMember) {
        await db.run(`UPDATE members SET department=? WHERE emp_id=?`, [emp.department || "???, emp.empId]);
      } else {
        await db.run(
          `INSERT INTO members (emp_id, name, grade, onboarding_date, department) VALUES (?, ?, ?, ?, ?)`,
          [emp.empId, emp.name, "銝??, "", emp.department || "???]
        );
      }
    }
    await addAuditLog(username, role, "?臬?∪極?芾?",
      `???臬 ${year} 撟游漲?∪極?芣偌 CSV?憓?${addedCount} 蝑?閬??湔嚗?{updatedCount} 蝑);
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
    return res.status(403).json({ error: "甈?銝雲嚗??R鈭箏?啣??∪極?芾? (HR Admin only)" });
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
        [empId, name, "銝??, "", department]
      );
    }
    await addAuditLog(username, role, "?啣??∪極?芾?閮?",
      `撱箇? ${year} 撟游漲?蜓蝞∪撌伐?${name} (${empId})嚗鞈?${salary}嚗??拚?嚗?{welfare}`);
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
    return res.status(403).json({ error: "甈?銝雲嚗??R鈭箏靽格?∪極?芾? (HR Admin only)" });
  }
  try {
    const db = await getDb();
    const old = await db.get(`SELECT * FROM employees WHERE id = ?`, [id]);
    if (!old) return res.status(404).json({ error: "?曆??啗府?∪極?芾?閮?" });
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
        [old.emp_id, name || old.name, "銝??, "", updatedDept || "."]
      );
    }
    await addAuditLog(username, role, "靽格?∪極?芾?閮?",
      `?湔 ${name || old.name} (${year || old.year}撟游漲) ?芾????抵??);
    res.json({ success: true, employee: { id, empId: old.emp_id, name: name || old.name } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/employees/records/:id", async (req, res) => {
  const { id } = req.params;
  const { username, role } = req.query;
  if (role !== "HR_ADMIN") {
    return res.status(403).json({ error: "甈?銝雲嚗??R鈭箏?芷?∪極?芾? (HR Admin only)" });
  }
  try {
    const db = await getDb();
    const emp = await db.get(`SELECT * FROM employees WHERE id = ?`, [id]);
    if (!emp) return res.status(404).json({ error: "?曆??啗府?∪極?芾?閮?" });
    await db.run(`DELETE FROM employees WHERE id = ?`, [id]);
    await addAuditLog(String(username), String(role), "?芷?∪極?芾?閮?",
      `?芷鈭?${emp.name} (${emp.year}撟游漲) ?喳鞈?`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/employees/records", async (req, res) => {
  const { username, role, year } = req.query;
  if (role !== "HR_ADMIN") {
    return res.status(403).json({ error: "甈?銝雲嚗??R鈭箏?芷?∪極?芾? (HR Admin only)" });
  }
  try {
    const db = await getDb();
    if (year) {
      const targetYear = Number(year);
      const result = await db.get(`SELECT COUNT(*) as count FROM employees WHERE year = ?`, [targetYear]);
      const deletedCount = result.count;
      await db.run(`DELETE FROM employees WHERE year = ?`, [targetYear]);
      await addAuditLog(String(username), String(role), "?寞活?芷?∪極?芾?",
        `?寞活?芷鈭?${targetYear} 撟游漲??撌亦?梯?????${deletedCount} 蝑);
      return res.json({ success: true, deletedCount });
    } else {
      const result = await db.get(`SELECT COUNT(*) as count FROM employees`);
      const deletedCount = result.count;
      await db.run(`DELETE FROM employees`);
      await addAuditLog(String(username), String(role), "皜征??撌亥鞈?,
        `皜征鈭??僑摨衣??∪極?喳鞈?嚗 ${deletedCount} 蝑);
      return res.json({ success: true, deletedCount });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Member Management (鈭箏蝞∠?) Endpoints
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
    return res.status(403).json({ error: "甈?銝雲嚗??R鈭箏銝蝞∠?鈭箏鞈?" });
  }
  if (!Array.isArray(members)) {
    return res.status(400).json({ error: "鞈??澆??航炊" });
  }
  try {
    const db = await getDb();
    await db.run(`DELETE FROM members`);
    for (const m of members) {
      await db.run(
        `INSERT INTO members (emp_id, name, grade, onboarding_date, department) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(emp_id) DO UPDATE SET name=excluded.name, grade=excluded.grade, onboarding_date=excluded.onboarding_date, department=excluded.department`,
        [m.empId || m.emp_id, m.name, m.grade || "銝??, m.onboardingDate || m.onboarding_date || "", m.department || ""]
      );
    }
    await addAuditLog(String(username), String(role), "?臬鈭箏?", `?臬鈭?${members.length} 蝑犖?∪?祈??);
    res.json({ success: true, count: members.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/members", async (req, res) => {
  const { username, role } = req.query;
  if (role !== "HR_ADMIN") {
    return res.status(403).json({ error: "甈?銝雲嚗??R鈭箏皜征鈭箏鞈?" });
  }
  try {
    const db = await getDb();
    const result = await db.get(`SELECT COUNT(*) as count FROM members`);
    const originalCount = result.count;
    await db.run(`DELETE FROM members`);
    await addAuditLog(String(username), String(role), "皜征鈭箏?", `皜征鈭??犖?∪?祈?????${originalCount} 蝑);
    res.json({ success: true, deletedCount: originalCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Insiders (?折鈭? Management Endpoints
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
  if (!empId) return res.status(400).json({ error: "蝻箏??∪極蝺刻? (empId)" });
  try {
    const db = await getDb();
    await db.run(`INSERT OR IGNORE INTO insiders (emp_id) VALUES (?)`, [empId]);
    await addAuditLog(String(username || "蝟餌絞"), String(role || "HR_ADMIN"), "閮剖??折鈭?, `撠蝺?${empId} 閮剖??箏?其犖`);
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
    await addAuditLog(String(username || "蝟餌絞"), String(role || "HR_ADMIN"), "??閮剖??折鈭?, `撠蝺?${empId} ???折鈭箄澈?);
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
    return res.status(403).json({ error: "甈?銝雲嚗甈???梁絞閮??" });
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
    return res.status(403).json({ error: "甈?銝雲嚗瘜??蝡臬?瑼?" });
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
    return res.status(403).json({ error: "甈?銝雲嚗??R鈭箏銝??隞?(HR Admin only)" });
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
    await addAuditLog(username, role, "?脩垢?脣??遢", `撠銵具?{filename}??隞質摰?脩垢蝛粹?嚗?里?賊?皝?甈?靽風`);
    res.json({ success: true, backup: { id, filename, fileType, size, createdBy: username, createdAt, url } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// AI Gemini HR PM Assistant/Analyst (Taiwan Specific Regulation advisor & analysis)
app.post("/api/gemini/analyze", async (req, res) => {
  const { reportData, question, username, role } = req.body;

  if (role !== "HR_ADMIN" && role !== "EXECUTIVE") {
    return res.status(403).json({ error: "甈?銝雲嚗瘜蝙?杗I?????芾??豢?嚗? });
  }

  try {
    const reportSummary = JSON.stringify(reportData, null, 2);
    const systemPrompt = `雿銝雿?璆剔??啁銝?銝??砍鈭箏?鞈?撠?蝬???隞文?閬??“??
雿?隞餃??臬??拐犖鞈蜓蝞?HR Admin)??璆剝??蜓蝞?Executive)???啁霅鈭斗????鞎瑚葉敹?閬?銋??遙銝餌恣?瑕?銋?撌亥鞈葉雿?像???望??
??撠平?移皞泵??隞斗?閬?撠?撅斗扔?瑕???潛?蝜?銝剜?????

??閬??胯?
?啁?恣??霅漱?閬?嚗?撣??砍瘥僑??喳銝?撟游漲??銝餌恣?瑕?銋?撌亥鞈?閮??亙?貊泵?誑銝嗾??璅???璅?隞嗡?銝嚗???祇?鞈?閫皜祉?隤芣??鞈??扼?貉鞈蝑??芯??孵?閮嚗?
1. ?∪極撟喳??芾??芷?50?砍???
2. ?平?拍?銵圈嚗??蜓蝞∩??冽??∪極撟喳??芾??餉???撟游漲皜?嚗???皜嚗?
3. ?平?拍??嚗??蜓蝞∩??冽??∪極撟喳??芾??餅憓?嚗???膜嚗?
4. 閰脣僑摨阡?銝餌恣?冽??∪極?芾?銝凋??訾??澆?璆剖像?偌皞?

????撘?
1. ??蝯虫?銋絞閮銵?(??僑摨血撌乩犖?詻像?鞈葉雿???抵祥?具oY霈?????
2. ?閰脣?豢?行?蝚血??恣??餈啜??祇?隤芣??芾????扼?霅衣內????
3. ??HR?函?璆剔蜀???矽?游??迎?蝯虫?撖血?撱箄降??
4. ??蝚血?霅漱?閬??鞈蝑??芯??孵?閮隤芣??詻??啣神?祉??移蝪⊥蝔選?靘?訾??喳??閮?皜祉?雿輻??
5. 靽?隤除?渲牲?恥閫??璆准??恣?犖?拍??

?撓?亦??梯”?豢???
${reportSummary}
`;

    const userPrompt = question || "隢?撠?餈啁?望???脰??冽雿????扯????扯那?瘀?銝衣?箔?隞賜移蝪∠???鈭?蝪∪?????閮?皜祉??喳隤芣?撱箄降??;

    // Call Gemini
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        { text: systemPrompt },
        { text: userPrompt }
      ]
    });

    const aiText = response.text || "AI ?急??⊥??Ｙ????勗???;

    // Log this AI consult
    await addAuditLog(username, role, "AI 憿批???", `雿輻 Gemini AI 撠?勗銵券脰??????撖怠?閬牧?`);

    res.json({ analysis: aiText });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: "AI ???粹: " + (error.message || String(error)) });
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

let employees: Employee[] = [
  {
    id: 'emp_001',
    name: 'Alex ??,
    email: 'alex.chen@example.com',
    authToken: 'LDC888',
    department: '???? - 擗ㄡ??,
    title: '擗ㄡ?',
    onboardDate: '2026-06-15',
    status: 'pending',
    progress: 15,
    uploadedFiles: [],
    rulesAgreed: false,
    privacyAgreed: false,
    contractSigned: false,
    contractWorkLocation: '???? (?啣?) (?啣?撣敺瑁楝銝畾???',
    contractLeaveOption: 'biweekly',
    contractLeavedays: '8',
    contractSalaryType: 'monthly',
    contractSalaryAmount: '36,000',
    contractProbationMonths: '銝?,
    updatedAt: new Date().toISOString(),
    personalData: {
      name: 'Alex ??,
      idNumber: 'A123456789',
      birthday: '1998-05-12',
      gender: '??,
      phone: '0912-345-678',
      email: 'alex.chen@example.com',
      legalAddress: '?啣?撣之摰??啁??楝銝挾 10 ??,
      contactAddress: '?啣?撣之摰??啁??楝銝挾 10 ??,
      bankName: '?????平?銵?,
      bankAccount: '017123456789',
      dependentsCount: '0 鈭?,
      emergencyName: '?喳之??,
      emergencyRelationship: '?嗉扛',
      emergencyPhone: '0988-765-432'
    }
  },
  {
    id: 'emp_002',
    name: 'Sophia ??,
    email: 'sophia.lin@example.com',
    authToken: 'LDC999',
    department: '?脣?皞急??? - 摰Ｘ??,
    title: '撠旨摰Ｗ??亙?撠',
    onboardDate: '2026-07-01',
    status: 'pending',
    progress: 0,
    uploadedFiles: [],
    rulesAgreed: false,
    privacyAgreed: false,
    contractSigned: false,
    contractWorkLocation: '?脣?皞急??? (?交?瞏? (??蝮??瘙?銝剜迤頝?3??',
    contractLeaveOption: 'weekly',
    contractLeavedays: '8',
    contractSalaryType: 'monthly',
    contractSalaryAmount: '36,000',
    contractProbationMonths: '銝?,
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
      console.warn('?? Firestore Sync Info: Replication encountered permission error. Switched to local JSON database mode.');
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
      console.warn('?? Firestore Sync Info: Missing or insufficient permissions. Operating in reliable local-only JSON database mode.');
    } else {
      console.warn('?? Firestore Sync Info: Could not connect to Firestore (', err.message, '). Operating in reliable local-only JSON database mode.');
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
    operatorName: operatorName.trim() || '蝟餌絞蝞∠???,
    employeeName: employeeName ? employeeName.trim() : '?券??',
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
    return res.status(400).json({ error: '???雿??箏?憛? });
  }

  const exists = employees.some(emp => emp.email.toLowerCase() === email.trim().toLowerCase());
  if (exists) {
    return res.status(400).json({ error: '甇日摮隞嗅歇摮?潭?脣?隞??桐葉' });
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
    contractWorkLocation: contractWorkLocation || '???? (?啣?撣敺瑁楝銝畾???',
    contractLeaveOption: contractLeaveOption || 'biweekly',
    contractLeavedays: contractLeavedays || '8',
    contractSalaryType: contractSalaryType || 'monthly',
    contractSalaryAmount: contractSalaryAmount || '36,000',
    contractProbationMonths: contractProbationMonths || '銝?,
    updatedAt: new Date().toISOString()
  };

  employees.push(newEmp);
  logActivity(req, newEmp.name, 'CREATE_EMPLOYEE', `?啣??圈脣?隞? ${newEmp.name} (${newEmp.department} - ${newEmp.title})`);
  saveDatabase();
  return res.json({ message: '???啣??圈脣?隞?, employee: newEmp, employees });
});

// Delete individual employee
app.delete('/api/hr/employees/:id', (req, res) => {
  const { id } = req.params;
  const index = employees.findIndex(emp => emp.id === id);
  if (index === -1) {
    return res.status(404).json({ error: '?曆??啗府??鞈?' });
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

  logActivity(req, empName, 'DELETE_EMPLOYEE', `?芷??鞈?: ${empName} (${emp.department})`);
  saveDatabase();
  return res.json({ message: '???芷??鞈?', employees });
});

// Reject / Return employee onboarding to fill state (Reset signatures but keep text fields)
app.post('/api/hr/employees/:id/reject', (req, res) => {
  const { id } = req.params;
  const empIndex = employees.findIndex(emp => emp.id === id);
  if (empIndex === -1) {
    return res.status(404).json({ error: '?曆??啗府??鞈?' });
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
  logActivity(req, emp.name, 'REJECT_ONBOARDING', `撠?隞?圈???曆耨?? ${emp.name}`);
  saveDatabase();
  return res.json({ message: '撌脣????唾?????靽格', employee: emp, employees });
});

// Update employee ID (?∪極蝺刻?)
app.put('/api/hr/employees/:id/empid', (req, res) => {
  const { id } = req.params;
  const { empId } = req.body;
  const empIndex = employees.findIndex(emp => emp.id === id);
  if (empIndex === -1) {
    return res.status(404).json({ error: '?曆??啗府??鞈?' });
  }

  const emp = employees[empIndex];
  const oldId = emp.empId || '?芾身摰?;
  const newId = empId ? empId.trim() : '';
  emp.empId = newId;
  emp.updatedAt = new Date().toISOString();
  logActivity(req, emp.name, 'UPDATE_EMP_ID', `?湔??蝺刻?: "${oldId}" -> "${newId || '?芾身摰?}"`);
  saveDatabase();
  return res.json({ message: '?∪極蝺刻??湔摰?', employee: emp, employees });
});

// Update employee email address (靽格?餃??萎辣?啣?)
app.put('/api/hr/employees/:id/email', (req, res) => {
  const { id } = req.params;
  const { email } = req.body;
  
  if (!email || !email.trim()) {
    return res.status(400).json({ error: '?餃??萎辣?啣?銝?箇征' });
  }

  const empIndex = employees.findIndex(emp => emp.id === id);
  if (empIndex === -1) {
    return res.status(404).json({ error: '?曆??啗府??鞈?' });
  }

  const newEmail = email.trim().toLowerCase();
  const duplicateExists = employees.some(emp => emp.id !== id && emp.email.toLowerCase() === newEmail);
  if (duplicateExists) {
    return res.status(400).json({ error: '甇日摮隞嗅?撌脰◤?嗡???雿輻' });
  }

  const emp = employees[empIndex];
  const oldEmail = emp.email;
  emp.email = newEmail;
  emp.updatedAt = new Date().toISOString();
  
  logActivity(req, emp.name, 'UPDATE_EMAIL', `?湔???餃??萎辣?啣?: "${oldEmail}" -> "${newEmail}"`);
  saveDatabase();
  return res.json({ message: '?餃??萎辣?啣??湔摰?', employee: emp, employees });
});

// Update employee contract probation months (??閰衣??
app.put('/api/hr/employees/:id/probation', (req, res) => {
  const { id } = req.params;
  const { contractProbationMonths } = req.body;
  const empIndex = employees.findIndex(emp => emp.id === id);
  if (empIndex === -1) {
    return res.status(404).json({ error: '?曆??啗府??鞈?' });
  }

  const emp = employees[empIndex];
  const oldProbation = emp.contractProbationMonths || '銝?;
  const newProbation = contractProbationMonths ? contractProbationMonths.trim() : '銝?;
  emp.contractProbationMonths = newProbation;
  emp.updatedAt = new Date().toISOString();
  logActivity(req, emp.name, 'UPDATE_PROBATION', `?湔??閰衣?? "${oldProbation}" -> "${newProbation}"`);
  saveDatabase();
  return res.json({ message: '??閰衣??啣???, employee: emp, employees });
});

// Send onboarding notification email (simulated)
app.post('/api/hr/employees/:id/send-onboarding-email', (req, res) => {
  const { id } = req.params;
  const empIndex = employees.findIndex(emp => emp.id === id);
  if (empIndex === -1) {
    return res.status(404).json({ error: '?曆??啗府??鞈?' });
  }

  const emp = employees[empIndex];
  emp.updatedAt = new Date().toISOString();
  logActivity(
    req, 
    emp.name, 
    'SEND_ONBOARDING_EMAIL', 
    `?潮?瑕?圈靽∟: ${emp.email} (?憪?: ${emp.name}?蝔? ${emp.title}??? ${emp.onboardDate}?暺? ${emp.contractWorkLocation || '????'}?鞈? ${emp.contractSalaryAmount || '36,000'}??霅Ⅳ: ${emp.authToken})`
  );
  saveDatabase();
  return res.json({ message: '?勗?靽∠????, employee: emp, employees });
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
    return res.status(404).json({ error: '?曆??啗府??鞈?' });
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
          legalAddress: '??HR ??閬摰?',
          contactAddress: '??HR ??閬摰?',
          bankName: '???詨?',
          bankAccount: '???詨?',
          dependentsCount: '0 鈭?,
          emergencyName: '?舐窗鈭?,
          emergencyRelationship: '?嗡?',
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
          experiences: [{ companyName: '???詨?', jobTitle: '??, startDate: '', endDate: '', leaveReason: '' }],
          licenses: [],
          additionalNotes: '??HR ??閬摰?'
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
          docType: '?嗡??像?辣'
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
          guarantorName: '??閬',
          birthday: '1980-01-01',
          idNumber: 'A123456789',
          address: '??閬',
          phone: '0900-000-000',
          companyName: '??,
          companyTitle: '??,
          companyAddress: '??,
          companyPhone: '0900-000-000',
          relationship: '?嗡?',
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
  
  logActivity(req, emp.name, 'MANUAL_PROGRESS_UPDATE', `HR???湔????{emp.name}???勗?脣漲????(?脣漲: ${emp.progress}%, ??? ${emp.status})`);
  saveDatabase();

  return res.json({ message: '???湔?勗?脣漲??', employee: emp, employees });
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
    return res.status(403).json({ error: '?? ?函?蝞∠?撣唾?銝行???恣????admin)嚗瘜脰?蝞∠??董???啣?嚗? });
  }

  const { email, permissions } = req.body;
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email 甈?銝?箇征' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const exists = normalized.some(admin => admin.email === cleanEmail);

  if (exists) {
    return res.status(400).json({ error: '甇?Email 撌脫HR蝞∠???銝' });
  }

  const finalPermissions = Array.isArray(permissions) && permissions.length > 0
    ? permissions
    : ['tracker', 'publish', 'ai'];

  hrAdmins.push({ 
    email: cleanEmail, 
    password: 'mis',
    permissions: finalPermissions
  });
  logActivity(req, '鈭箄?蝞∠?蝟餌絞', 'ADD_ADMIN', `?啣? HR 蝞∠??? ${cleanEmail} (甈?: ${finalPermissions.join(', ')})`);
  saveDatabase();

  const freshAdmins = getNormalizedAdmins().map(admin => ({
    email: admin.email,
    permissions: admin.permissions || []
  }));
  return res.json({ message: '???啣?HR蝞∠???, hrAdmins: freshAdmins });
});

// Delete HR Admin
app.delete('/api/hr/admins', (req, res) => {
  const operatorEmail = decodeURIComponent(req.headers['x-operator-email'] as string || '').toLowerCase().trim();
  const targetEmail = (req.body.email || '').toLowerCase().trim();

  if (!targetEmail) {
    return res.status(400).json({ error: '?? 隢?靘炬?芷?恣?靽∠拳' });
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
    return res.status(403).json({ error: '?? ?函?蝞∠?撣唾?銝行???恣????admin)嚗瘜脰?蝞∠??∪董???芷嚗? });
  }

  // 2. Prevent deleting Primary Admin
  if (targetEmail === primaryAdminEmail.toLowerCase().trim()) {
    return res.status(400).json({ error: `?? 銝餉?鞎痊鈭?(${primaryAdminEmail}) ?箇頂蝯望敹董?塚?蝳迫?芷嚗?甈脣?方??脰?銝餉?蝞∠??宏頧 });
  }

  // 3. Prevent deleting themselves
  if (targetEmail === operatorEmail) {
    return res.status(400).json({ error: '?? ?粹?恣????蝛綽?蝢斤?撣唾?蝳迫?芷?桀?甇??餃雿輻?董?塚?' });
  }

  // Find target in current hrAdmins
  const targetIdx = hrAdmins.findIndex(admin => {
    const email = typeof admin === 'string' ? admin.toLowerCase().trim() : (admin.email || '').toLowerCase().trim();
    return email === targetEmail;
  });

  if (targetIdx === -1) {
    return res.status(404).json({ error: '?? ?曆??唳炬?芷?恣?撣唾?' });
  }

  // Remove from hrAdmins list
  hrAdmins.splice(targetIdx, 1);
  
  // Explicitly delete from Firestore to prevent orphaned documents
  if (db && isFirestoreAvailable) {
    firebaseDb.collection('admins').doc(targetEmail).delete().catch(err => {
      console.error(`Failed to delete admin ${targetEmail} from Firestore:`, err);
    });
  }

  logActivity(req, '鈭箄?蝞∠?蝟餌絞', 'DELETE_ADMIN', `?芷 HR 蝞∠??? ${targetEmail}`);
  saveDatabase();

  const freshAdmins = getNormalizedAdmins().map(admin => ({
    email: admin.email,
    permissions: admin.permissions || []
  }));
  return res.json({ message: '???芷 HR 蝞∠???, hrAdmins: freshAdmins });
});

// Transfer Primary Admin
app.post('/api/hr/transfer-primary', (req, res) => {
  const operatorEmail = decodeURIComponent(req.headers['x-operator-email'] as string || '').toLowerCase().trim();
  const { targetEmail } = req.body;

  if (!targetEmail) {
    return res.status(400).json({ error: '?? 隢??亦?銝餉?蝞∠??? });
  }

  const cleanTargetEmail = targetEmail.trim().toLowerCase();

  // 1. Verify operator is the current primary admin
  if (operatorEmail !== primaryAdminEmail.toLowerCase().trim()) {
    return res.status(403).json({ error: `?? ?芣??嗅??蜓閬恣??(${primaryAdminEmail}) ?隞仿脰?甈?蝘餉?嚗 });
  }

  // 2. Prevent transferring to themselves
  if (cleanTargetEmail === operatorEmail) {
    return res.status(400).json({ error: '?? ?⊥?蝘餉?蝯西撌梧?隢?隞?HR 撣唾??? });
  }

  // 3. Verify target admin exists
  const normalized = getNormalizedAdmins();
  const targetAdmin = normalized.find(a => a.email === cleanTargetEmail);
  if (!targetAdmin) {
    return res.status(404).json({ error: '?? ?曆??唳?亦? HR 撣唾?嚗?蝣箄?閰脖縑蝞勗歇鋡急憓蝞∠??? });
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

  logActivity(req, '鈭箄?蝞∠?蝟餌絞', 'TRANSFER_PRIMARY_ADMIN', `銝餉?蝞∠????宏頧???${operatorEmail} 蝘餉???${cleanTargetEmail}`);
  saveDatabase();

  const freshAdmins = getNormalizedAdmins().map(admin => ({
    email: admin.email,
    permissions: admin.permissions || [],
    isPrimary: admin.email.toLowerCase().trim() === primaryAdminEmail.toLowerCase().trim()
  }));

  return res.json({ 
    message: `??撠蜓閬恣???宏頧策??{cleanTargetEmail}??`, 
    hrAdmins: freshAdmins,
    primaryAdminEmail: primaryAdminEmail
  });
});

// Change Password Endpoint
app.post('/api/hr/change-password', (req, res) => {
  const { email, oldPassword, newPassword } = req.body;
  if (!email || !oldPassword || !newPassword) {
    return res.status(400).json({ error: '???雿??箏??詨‵' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalized = getNormalizedAdmins();
  const adminIndex = normalized.findIndex(admin => admin.email === normalizedEmail);

  if (adminIndex === -1) {
    return res.status(404).json({ error: '?曆??啗府蝞∠??∪董?? });
  }

  const currentPassword = normalized[adminIndex].password || 'mis';
  if (oldPassword !== currentPassword) {
    return res.status(400).json({ error: '?桀?撖Ⅳ撽?銝迤蝣綽?霈憭望?' });
  }

  if (newPassword.length < 3) {
    return res.status(400).json({ error: '?啣?蝣潮摨西撠? 3 ???? });
  }

  // Update in official array
  hrAdmins[adminIndex] = {
    email: normalizedEmail,
    password: newPassword
  };

  logActivity(req, '鈭箄?蝞∠?蝟餌絞', 'CHANGE_PASSWORD', `霈 HR 蝞∠???蝣潭??? ${normalizedEmail}`);
  saveDatabase();

  return res.json({ success: true, message: '撖Ⅳ霈??嚗?閮??函??啣?蝣? });
});

// Request Forgot Password (Simulated Email reset link)
app.post('/api/hr/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: '隢撓?仿摮隞? });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalized = getNormalizedAdmins();
  const exists = normalized.some(admin => admin.email === normalizedEmail);

  if (!exists) {
    return res.status(404).json({ error: '甇日摮隞園???銋?HR 蝞∠???隢?銝餉?鞎痊鈭箄蝯? });
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

  console.log(`\n==========================================\n[璅⊥?餃??萎辣? SMS / EMAIL SIMULATOR]\n==========================================\n?嗡辣??(To): ${normalizedEmail}\n璅? (Subject): ?脫???鈭箔?蝟餌絞 - HR蝞∠???閮剖?蝣潔縑隞跚n?批捆 (Body):\n?典末嚗?暺隞乩?????身?函? HR 敺?餃撖Ⅳ嚗?? 30 ???扳???嚗n${resetLink}\n==========================================\n`);

  return res.json({
    success: true,
    message: '?身撖Ⅳ靽∩辣撌脫????(?祉頂蝯勗歇?箸璅⊥?嗡縑?)嚗?,
    simulatedEmail: {
      to: normalizedEmail,
      subject: '?脫???鈭箔?蝟餌絞 - HR蝞∠???閮剖?蝣潔縑隞?,
      link: resetLink,
      token: token
    }
  });
});

// Confirm Password Reset with Token
app.post('/api/hr/reset-password', (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: '隢?靘?閮?Token ?撖Ⅳ' });
  }

  const record = forgotPasswordTokens[token];
  if (!record) {
    return res.status(400).json({ error: '?身????⊥???甇日??撌脰◤雿輻?? });
  }

  if (Date.now() > record.expires) {
    delete forgotPasswordTokens[token];
    return res.status(400).json({ error: '甇日??撌脤???隢??啁隢?閮剖?蝣? });
  }

  const normalizedEmail = record.email.toLowerCase().trim();
  const normalized = getNormalizedAdmins();
  const adminIndex = normalized.findIndex(admin => admin.email === normalizedEmail);

  if (adminIndex === -1) {
    delete forgotPasswordTokens[token];
    return res.status(404).json({ error: '?曆??啗府蝞∠??∪董?? });
  }

  if (newPassword.length < 3) {
    return res.status(400).json({ error: '撖Ⅳ?瑕漲?喳?? 3 ???? });
  }

  // Overwrite password
  hrAdmins[adminIndex] = {
    email: normalizedEmail,
    password: newPassword
  };

  // Burn token
  delete forgotPasswordTokens[token];

  logActivity(req, '鈭箄?蝞∠?蝟餌絞', 'RESET_PASSWORD', `HR蝞∠??∩???閮凋縑摰??身撖Ⅳ: ${normalizedEmail}`);
  saveDatabase();

  return res.json({ success: true, message: '撖Ⅳ?身??嚗???餃?銝虫蝙?冽撖Ⅳ?脰??餃?? });
});

// 3. Employee Endpoints
// Save / Update employee onboarding progress & data
app.put('/api/employee/save', (req, res) => {
  const { id, personalData, careerData, rulesAgreed, privacyAgreed, taxDeclaration, contractSigned, contractDate, guarantorSigned, guarantorDate, guarantorData, serviceSigned, serviceDate } = req.body;
  
  const empIndex = employees.findIndex(emp => emp.id === id);
  if (empIndex === -1) {
    return res.status(404).json({ error: '?曆??唳?脣?隞??? });
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

  return res.json({ message: '?阮?脣???', employee: emp });
});

// Upload verification documents (PDF file representation)
app.post('/api/employee/upload', (req, res) => {
  const { id, fileName, fileSize, base64Data, docType } = req.body;
  if (!id || !fileName || !fileSize) {
    return res.status(400).json({ error: '蝻箏?銝鞈?' });
  }

  const empIndex = employees.findIndex(emp => emp.id === id);
  if (empIndex === -1) {
    return res.status(404).json({ error: '?曆??啗府??鞈?' });
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
  
  return res.json({ message: '?辣銝??', employee: emp });
});

// Delete uploaded verification documents
app.delete('/api/employee/upload', (req, res) => {
  const { id, fileName } = req.body;
  const empIndex = employees.findIndex(emp => emp.id === id);
  if (empIndex === -1) {
    return res.status(404).json({ error: '?曆??啗府??鞈?' });
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

  return res.json({ message: '?辣撌脩宏??, employee: emp });
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

  const startServer = (port: number) => {
    const server = app.listen(port, "0.0.0.0", () => {
      console.log(`🚀 Server running on http://localhost:${port}`);
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`⚠️ Port ${port} is in use, trying ${port + 1}...`);
        startServer(port + 1);
      } else {
        console.error('Server error:', err);
      }
    });
  };

  startServer(PORT);

bootstrap().catch(err => {
  console.error("❌ Failed to start server:", err);
  process.exit(1);
});
