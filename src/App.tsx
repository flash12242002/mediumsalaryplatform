import { useState, useEffect } from 'react';
import Login from './components/Login';
import EmployeeDashboard from './components/EmployeeDashboard';
import HrDashboard from './components/HrDashboard';
import ResetPassword from './components/ResetPassword';
import { Employee } from './types';
import { AlertCircle, X } from 'lucide-react';

export default function App() {
  const [session, setSession] = useState<{
    role: 'hr' | 'employee' | null;
    user: any;
    adminEmails: string[];
  }>({
    role: null,
    user: null,
    adminEmails: []
  });

  const [loading, setLoading] = useState(true);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);

  // Hook window.alert to direct to our custom state toaster
  useEffect(() => {
    try {
      window.alert = (msg: string) => {
        console.log("Global window.alert interceptor:", msg);
        setToast({ message: msg, type: 'info' });
      };
    } catch (e) {
      console.warn("Could not patch window.alert:", e);
    }
  }, []);

  // Dismiss toast after 5s
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Check URL on load for password reset token
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('reset_token');
      if (token) {
        setResetToken(token);
        try {
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (e) {
          console.warn('replaceState blocked by browser or sandbox:', e);
        }
      }
    } catch (e) {
      console.warn('Failed to access search params:', e);
    }
  }, []);

  // Check LocalStorage for existing session on load
  useEffect(() => {
    let savedRole: string | null = null;
    let savedUser: string | null = null;
    try {
      savedRole = localStorage.getItem('ldc_onboard_role');
      savedUser = localStorage.getItem('ldc_onboard_user');
    } catch (e) {
      console.warn('Reading from localStorage is blocked or disabled dynamic configurations:', e);
    }
    
    if (savedRole && savedUser) {
      try {
        setSession({
          role: savedRole as 'hr' | 'employee',
          user: JSON.parse(savedUser),
          adminEmails: []
        });
      } catch (e) {
        try {
          localStorage.removeItem('ldc_onboard_role');
          localStorage.removeItem('ldc_onboard_user');
        } catch (removeError) {
          console.warn('Failed to remove corrupted session storage item:', removeError);
        }
      }
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (role: 'hr' | 'employee', user: any, adminEmails?: string[]) => {
    try {
      localStorage.setItem('ldc_onboard_role', role);
      localStorage.setItem('ldc_onboard_user', JSON.stringify(user));
    } catch (e) {
      console.warn('Writing to localStorage blocked or denied:', e);
    }
    
    setSession({
      role,
      user,
      adminEmails: adminEmails || []
    });
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('ldc_onboard_role');
      localStorage.removeItem('ldc_onboard_user');
    } catch (e) {
      console.warn('Removing storage item blocked or denied:', e);
    }
    setSession({
      role: null,
      user: null,
      adminEmails: []
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#8D1B1B]/10 border-t-[#8D1B1B] rounded-full animate-spin"></div>
        <p className="text-xs text-stone-500 mt-4 tracking-wider">正在載入資料中...</p>
      </div>
    );
  }

  // Reset Password Token intercepts, Hr, Employee and Login routing with global custom alert toasts
  let mainContent;
  if (resetToken) {
    mainContent = (
      <ResetPassword
        token={resetToken}
        onBackToLogin={() => setResetToken(null)}
      />
    );
  } else if (session.role === 'hr') {
    mainContent = (
      <HrDashboard
        currentUser={session.user}
        initialEmployees={[]} // Will be loaded dynamically inside HrDashboard
        onLogout={handleLogout}
      />
    );
  } else if (session.role === 'employee') {
    mainContent = (
      <EmployeeDashboard
        initialEmployee={session.user}
        onLogout={handleLogout}
      />
    );
  } else {
    mainContent = <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <>
      {mainContent}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-stone-900 border border-[#D4AF37]/50 text-stone-100 text-xs font-medium px-5 py-3.5 rounded-xl shadow-2xl max-w-sm sm:max-w-md animate-in fade-in slide-in-from-top-4 duration-300">
          <AlertCircle className="w-4 h-4 text-[#D4AF37] shrink-0" />
          <div className="flex-1 pr-2 tracking-wide leading-relaxed">{toast.message}</div>
          <button 
            type="button"
            onClick={() => setToast(null)}
            className="text-stone-400 hover:text-white transition duration-200 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </>
  );
}
