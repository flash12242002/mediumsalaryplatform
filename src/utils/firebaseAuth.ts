// Firebase has been removed. Google Drive auth is now handled via
// the direct OAuth flow using /auth/google/callback endpoint.

// Caching in memory and localStorage to persist connection on reload
let cachedAccessToken: string | null = null;
try {
  cachedAccessToken = typeof window !== 'undefined'
    ? (localStorage.getItem("gdrive_access_token_direct") || localStorage.getItem("gdrive_access_token"))
    : null;
} catch (e) {
  console.error("Failed to read token from localStorage", e);
}

// Stub: auth object (no-op, kept for interface compatibility)
export const auth = {
  signOut: async () => {
    cachedAccessToken = null;
    try {
      localStorage.removeItem("gdrive_access_token_direct");
      localStorage.removeItem("gdrive_access_token");
    } catch (e) { /* ignore */ }
  }
};

// Stub: provider (no-op)
export const provider = {};

// Stub: initAuth — not used in direct OAuth mode
export const initAuth = (
  onAuthSuccess?: (user: any, token: string) => void,
  onAuthFailure?: () => void
) => {
  if (cachedAccessToken && onAuthSuccess) {
    onAuthSuccess({ displayName: "Google User", email: "" }, cachedAccessToken);
  } else if (onAuthFailure) {
    onAuthFailure();
  }
  // Return unsubscribe no-op
  return () => {};
};

// Stub: googleSignIn — direct OAuth via popup window to /auth/google/callback
export const googleSignIn = async (): Promise<{ user: any; accessToken: string } | null> => {
  return new Promise((resolve, reject) => {
    const token = localStorage.getItem("gdrive_access_token_direct");
    if (token) {
      cachedAccessToken = token;
      resolve({ user: { displayName: "Google User", email: "" }, accessToken: token });
      return;
    }
    reject(new Error("請使用 Google Drive 設定頁面的直接授權功能連接 Google Drive。"));
  });
};

// Get current token
export const getAccessToken = async (): Promise<string | null> => {
  if (!cachedAccessToken) {
    try {
      cachedAccessToken = localStorage.getItem("gdrive_access_token_direct")
        || localStorage.getItem("gdrive_access_token");
    } catch (e) { /* ignore */ }
  }
  return cachedAccessToken;
};

// Logout
export const logoutGoogle = async () => {
  cachedAccessToken = null;
  try {
    localStorage.removeItem("gdrive_access_token_direct");
    localStorage.removeItem("gdrive_access_token");
  } catch (e) {
    console.error("Failed to remove token from localStorage", e);
  }
};
