<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# 雲朗觀光 HR 平台 (Bonus Salary Platform)

這份文件包含運行與操作此應用程式的所有必要資訊。

## 🌐 專案相關網址
*   **部署網址 (App URL)**: 
    *   [https://35.229.197.41.nip.io/](https://35.229.197.41.nip.io/)
    *   [https://headgear-sibling-masses.ngrok-free.dev/](https://headgear-sibling-masses.ngrok-free.dev/) (ngrok 備用網址)
*   **AI Studio 預覽與開發網址**: [https://ai.studio/apps/eda6aa30-cdaf-42eb-b56b-1a1a90a06631](https://ai.studio/apps/eda6aa30-cdaf-42eb-b56b-1a1a90a06631)

## 🔐 登入操作模式
本系統提供兩種不同的身分登入模式：

1.  **新進同仁報到 (Employee)**
    *   **登入方式**：輸入「電子信箱」與 6 碼「授權碼」。
    *   **授權碼範例**：`LDC888`
    *   **適用對象**：一般員工或新進同仁。
2.  **HR 管理後台 (Admin/HR)**
    *   **登入方式**：輸入授權的「電子信箱」與「登入密碼」。
    *   **忘記密碼**：支援忘記密碼功能，系統會發送模擬重置信件以供重新設定密碼。
    *   **適用對象**：僅限授權的 HR 管理員使用。

## 💾 資料儲存位置
本專案的資料主要儲存於以下兩個地方：

1.  **本地端 SQLite 資料庫 (主要)**
    *   **位置**：專案根目錄下的 `database.sqlite`
    *   **說明**：負責儲存系統主要的運行資料，建議若要備份可直接複製此檔案。
2.  **雲端 Firebase Firestore (若啟用)**
    *   **說明**：若系統配置了 `firebase-applet-config.json`，則會將部分資料 (如管理員、員工、活動日誌) 儲存並同步至 Google Cloud / Firebase 的 Firestore 資料庫中。

## 🚀 本地端運行方式 (Run Locally)

**環境要求:** Node.js

1.  安裝相依套件：
    ```bash
    npm install
    ```
2.  在 `.env` 或 `.env.local` 中設定您的環境變數 (如 `GEMINI_API_KEY`)
3.  啟動應用程式：
    ```bash
    npm run dev
    ```
