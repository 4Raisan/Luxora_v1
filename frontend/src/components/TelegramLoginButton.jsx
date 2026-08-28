import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../services/api';

/**
 * Official Telegram Login Widget component.
 * @param {Function} onAuthSuccess - callback when server-side Telegram verification succeeds
 * @param {Function} onError - callback when error occurs
 * @param {string} botName - Telegram bot username (defaults to 'Luxora_v1_Bot')
 * @param {string} buttonSize - 'large', 'medium', 'small'
 * @param {boolean} linkOnly - true if linking to existing logged-in session
 */
export default function TelegramLoginButton({
  onAuthSuccess,
  onError,
  botName = 'Luxora_v1_Bot',
  buttonSize = 'large',
  linkOnly = false,
}) {
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const callbackName = `luxoraTelegramAuth_${Math.random().toString(36).substring(2, 9)}`;

    window[callbackName] = async (telegramUser) => {
      setLoading(true);
      setErrorMsg('');
      try {
        const token = sessionStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await apiRequest('/auth/telegram', 'POST', telegramUser, headers);
        if (onAuthSuccess) {
          onAuthSuccess(response);
        }
      } catch (err) {
        const msg = err.message || 'Telegram authentication failed';
        setErrorMsg(msg);
        if (onError) onError(msg);
      } finally {
        setLoading(false);
      }
    };

    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.setAttribute('data-telegram-login', botName);
      script.setAttribute('data-size', buttonSize);
      script.setAttribute('data-radius', '8');
      script.setAttribute('data-onauth', `${callbackName}(user)`);
      script.setAttribute('data-request-access', 'write');
      script.async = true;
      containerRef.current.appendChild(script);
    }

    return () => {
      delete window[callbackName];
    };
  }, [botName, buttonSize, linkOnly, onAuthSuccess, onError]);

  return (
    <div className="telegram-login-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
      {loading ? (
        <div style={{ color: 'var(--gold, #c9a84c)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem' }}>
          <span className="auth-spinner" style={{ width: '16px', height: '16px', border: '2px solid rgba(201,168,76,0.3)', borderTopColor: '#c9a84c' }} />
          Verifying Telegram credentials...
        </div>
      ) : (
        <div ref={containerRef} style={{ minHeight: '40px', display: 'flex', justifyContent: 'center' }} />
      )}
      {errorMsg && (
        <div style={{ color: '#ef4444', fontSize: '0.78rem', textAlign: 'center', background: 'rgba(239,68,68,0.1)', padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)' }}>
          {errorMsg}
        </div>
      )}
    </div>
  );
}
