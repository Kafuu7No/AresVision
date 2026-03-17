import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../contexts/ToastContext';
import { useT } from '../i18n';
import C from '../constants/colors';
import { useScrollLock } from '../hooks/useScrollLock';

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Input({ label, type = 'text', value, onChange, placeholder, disabled, error, name, autoComplete }) {
  const { settings } = useSettings();
  const isLight = settings.theme === 'light';
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? C.mars
    : focused
      ? C.blue
      : isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)';

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
        color: isLight ? 'rgba(42,42,58,0.55)' : 'rgba(232,237,243,0.55)',
        marginBottom: 6, textTransform: 'uppercase',
      }}>
        {label}
      </label>
      <input
        type={type}
        name={name}
        autoComplete={autoComplete}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '10px 14px',
          background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${borderColor}`,
          borderRadius: 8,
          color: isLight ? '#1e1e30' : '#e8edf3',
          fontSize: 14,
          outline: 'none',
          transition: 'border-color 0.15s',
          fontFamily: 'inherit',
        }}
      />
      {error && (
        <div style={{ fontSize: 12, color: C.mars, marginTop: 5 }}>{error}</div>
      )}
    </div>
  );
}

function TabBar({ tab, setTab, t, isLight }) {
  const activeColor = C.blue;
  const inactiveColor = isLight ? 'rgba(42,42,58,0.45)' : 'rgba(232,237,243,0.45)';
  const borderBase = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';

  return (
    <div style={{ display: 'flex', borderBottom: `1px solid ${borderBase}`, marginBottom: 24 }}>
      {['login', 'register'].map(k => (
        <button
          key={k}
          onClick={() => setTab(k)}
          style={{
            flex: 1, padding: '12px 0',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, letterSpacing: '0.06em',
            color: tab === k ? activeColor : inactiveColor,
            borderBottom: tab === k ? `2px solid ${activeColor}` : '2px solid transparent',
            marginBottom: -1,
            transition: 'color 0.15s, border-color 0.15s',
            fontFamily: 'inherit',
          }}
        >
          {k === 'login' ? t('auth.loginTab') : t('auth.registerTab')}
        </button>
      ))}
    </div>
  );
}

export default function AuthModal() {
  const { authModalOpen, authModalTab, closeAuthModal, login, register } = useAuth();
  const { settings } = useSettings();
  const { showToast } = useToast();
  const t = useT();
  const isLight = settings.theme === 'light';
  useScrollLock(authModalOpen);

  const [tab, setTab] = useState(authModalTab);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [loading, setLoading] = useState(false);

  // Reset form state when switching tabs
  const switchTab = (newTab) => {
    setTab(newTab);
    setEmail('');
    setUsername('');
    setPassword('');
    setErrors({});
    setGlobalError('');
  };

  // Sync tab + reset when modal opens
  useEffect(() => {
    if (authModalOpen) {
      setTab(authModalTab);
      setEmail('');
      setUsername('');
      setPassword('');
      setErrors({});
      setGlobalError('');
    }
  }, [authModalOpen, authModalTab]);

  if (!authModalOpen) return null;

  const L = isLight;
  const overlayBg    = L ? 'rgba(220,224,240,0.72)' : 'rgba(0,0,8,0.75)';
  const cardBg       = L ? '#ffffff'                : '#0d0d20';
  const cardBorder   = L ? 'rgba(0,0,0,0.09)'      : 'rgba(255,255,255,0.1)';
  const cardShadow   = L
    ? '0 16px 48px rgba(0,0,0,0.14), 0 4px 12px rgba(0,0,0,0.07)'
    : '0 16px 48px rgba(0,0,0,0.75), 0 4px 12px rgba(0,0,0,0.4)';
  const titleColor   = L ? '#1e1e30'               : '#e8edf3';
  const subtitleClr  = L ? 'rgba(42,42,58,0.48)'   : 'rgba(232,237,243,0.45)';
  const closeColor   = L ? 'rgba(42,42,58,0.45)'   : 'rgba(232,237,243,0.45)';
  const switchColor  = L ? 'rgba(42,42,58,0.55)'   : 'rgba(232,237,243,0.5)';

  const validate = () => {
    const e = {};
    if (!email.trim()) e.email = t('auth.errEmailRequired');
    if (!password.trim()) e.password = t('auth.errPasswordRequired');
    if (tab === 'register' && !username.trim()) e.username = t('auth.errUsernameRequired');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setGlobalError('');
    setLoading(true);
    try {
      if (tab === 'login') {
        const user = await login(email.trim(), password);
        closeAuthModal();
        showToast(t('auth.toastWelcome', { username: user.username || user.email }), 'success');
      } else {
        const user = await register(email.trim(), username.trim(), password);
        closeAuthModal();
        showToast(t('auth.toastRegistered'), 'success');
      }
    } catch (err) {
      setGlobalError(tab === 'login' ? t('auth.errLoginFailed') : t('auth.errRegisterFailed'));
    } finally {
      setLoading(false);
    }
  };

  // Autocomplete attributes per tab
  const emailAC    = tab === 'login' ? 'email'         : 'off';
  const passwordAC = tab === 'login' ? 'current-password' : 'new-password';
  const emailName    = tab === 'login' ? 'login-email'    : 'register-email';
  const passwordName = tab === 'login' ? 'login-password' : 'register-password';

  return (
    <>
      <style>{`
        @keyframes _amodal { from { opacity:0; transform:scale(0.96) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
      `}</style>

      <div
        onClick={closeAuthModal}
        style={{
          position: 'fixed', inset: 0,
          background: overlayBg,
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          zIndex: 9000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overscrollBehavior: 'contain',
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: 400, maxWidth: 'calc(100vw - 48px)',
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            borderRadius: 16,
            boxShadow: cardShadow,
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            padding: '28px 32px 32px',
            animation: '_amodal 0.18s ease-out',
            position: 'relative',
          }}
        >
          {/* Close */}
          <button
            onClick={closeAuthModal}
            style={{
              position: 'absolute', top: 18, right: 18,
              background: 'none', border: 'none', cursor: 'pointer',
              color: closeColor, padding: 4, display: 'flex', borderRadius: 6,
            }}
          >
            <CloseIcon />
          </button>

          {/* Header */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: C.blue, fontFamily: 'Orbitron, sans-serif', marginBottom: 4 }}>
              ARESVISION
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: titleColor, fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.02em' }}>
              {tab === 'login' ? t('auth.loginTitle') : t('auth.registerTitle')}
            </div>
            <div style={{ fontSize: 12, color: subtitleClr, marginTop: 4 }}>
              Mars Ozone Intelligence Platform
            </div>
          </div>

          {/* Tabs */}
          <TabBar tab={tab} setTab={switchTab} t={t} isLight={L} />

          {/* Form — keyed by tab so DOM resets between tabs, preventing autocomplete bleed */}
          <form key={tab} onSubmit={handleSubmit} noValidate autoComplete={tab === 'login' ? 'on' : 'off'}>
            <Input
              label={t('auth.email')}
              type="email"
              name={emailName}
              autoComplete={emailAC}
              value={email}
              onChange={setEmail}
              placeholder={t('auth.emailPlaceholder')}
              disabled={loading}
              error={errors.email}
            />

            {tab === 'register' && (
              <Input
                label={t('auth.username')}
                name="register-username"
                autoComplete="username"
                value={username}
                onChange={setUsername}
                placeholder={t('auth.usernamePlaceholder')}
                disabled={loading}
                error={errors.username}
              />
            )}

            <Input
              label={t('auth.password')}
              type="password"
              name={passwordName}
              autoComplete={passwordAC}
              value={password}
              onChange={setPassword}
              placeholder={t('auth.passwordPlaceholder')}
              disabled={loading}
              error={errors.password}
            />

            {globalError && (
              <div style={{
                fontSize: 13, color: C.mars, marginBottom: 14,
                padding: '8px 12px', borderRadius: 7,
                background: L ? 'rgba(220,80,50,0.07)' : 'rgba(220,80,50,0.12)',
                border: '1px solid rgba(220,80,50,0.22)',
              }}>
                {globalError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '11px 0',
                background: loading
                  ? (L ? 'rgba(66,133,244,0.5)' : 'rgba(66,133,244,0.35)')
                  : C.blue,
                border: 'none', borderRadius: 9,
                color: '#fff', fontSize: 14, fontWeight: 700,
                letterSpacing: '0.04em',
                cursor: loading ? 'default' : 'pointer',
                fontFamily: 'Orbitron, sans-serif',
                transition: 'background 0.15s',
                marginTop: 4,
              }}
            >
              {loading
                ? (tab === 'login' ? t('auth.loggingIn') : t('auth.registering'))
                : (tab === 'login' ? t('auth.loginBtn') : t('auth.registerBtn'))}
            </button>
          </form>

          {/* Switch link */}
          <div style={{ textAlign: 'center', marginTop: 18 }}>
            <button
              onClick={() => switchTab(tab === 'login' ? 'register' : 'login')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, color: switchColor,
                textDecoration: 'underline', textUnderlineOffset: 3,
                fontFamily: 'inherit',
              }}
            >
              {tab === 'login' ? t('auth.switchToRegister') : t('auth.switchToLogin')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
