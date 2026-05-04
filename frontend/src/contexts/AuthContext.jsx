import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  apiLogin,
  apiRegister,
  apiGetMe,
  apiChangePassword,
  prewarmPredictSource,
} from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  // AuthModal 开关状态放在这里，方便从任意组件触发
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('login'); // 'login' | 'register'
  const prewarmedKeysRef = useRef(new Set());

  // 初始化：检查 localStorage 中是否有有效 token
  useEffect(() => {
    const stored = localStorage.getItem('aresvision_token');
    if (!stored) {
      setIsLoading(false);
      return;
    }
    // 验证 token 是否仍有效
    apiGetMe()
      .then((me) => {
        setUser(me);
        setToken(stored);
      })
      .catch(() => {
        localStorage.removeItem('aresvision_token');
      })
      .finally(() => setIsLoading(false));
  }, []);

  // 监听 authedFetch 发出的全局 logout 事件（token 过期时）
  useEffect(() => {
    const handler = () => {
      setUser(null);
      setToken(null);
    };
    window.addEventListener('aresvision:logout', handler);
    return () => window.removeEventListener('aresvision:logout', handler);
  }, []);

  // 用户登录后静默预热 personal 数据源，避免首次切换卡顿。
  useEffect(() => {
    if (!user?.id || !token) return;
    const warmKey = `${user.id}:${token}`;
    if (prewarmedKeysRef.current.has(warmKey)) return;
    prewarmedKeysRef.current.add(warmKey);

    prewarmPredictSource(27, { dataSource: 'personal' }).catch(() => {
      // Silent prewarm failure should never block login UX.
    });
  }, [user?.id, token]);

  const login = useCallback(async (email, password) => {
    const data = await apiLogin(email, password);
    localStorage.setItem('aresvision_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (email, username, password, verificationCode) => {
    await apiRegister(email, username, password, verificationCode);
    return login(email, password);
  }, [login]);

  const logout = useCallback(() => {
    localStorage.removeItem('aresvision_token');
    setToken(null);
    setUser(null);
  }, []);

  const changePassword = useCallback(async (oldPassword, newPassword) => {
    return apiChangePassword(oldPassword, newPassword);
  }, []);

  const openAuthModal = useCallback((tab = 'login') => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isLoading,
      authModalOpen,
      authModalTab,
      login,
      register,
      logout,
      changePassword,
      openAuthModal,
      closeAuthModal,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
