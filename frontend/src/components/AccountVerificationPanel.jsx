import { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';
import TelegramLoginButton from './TelegramLoginButton';

export default function AccountVerificationPanel({
  currentUser,
  onUserUpdated,
}) {
  const [activeTab, setActiveTab] = useState('phone'); // 'email' | 'phone' | 'telegram'

  // SMS / Phone state
  const [phoneNumber, setPhoneNumber] = useState(currentUser?.phone || '');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneSending, setPhoneSending] = useState(false);
  const [phoneVerifying, setPhoneVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [phoneMsg, setPhoneMsg] = useState({ type: '', text: '' });

  // Email state
  const [emailSending, setEmailSending] = useState(false);
  const [emailMsg, setEmailMsg] = useState({ type: '', text: '' });

  // Telegram state
  const [telegramMsg, setTelegramMsg] = useState({ type: '', text: '' });

  // Timer countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Keep phone number synced with user changes
  useEffect(() => {
    if (currentUser?.phone) {
      setPhoneNumber(currentUser.phone);
    }
  }, [currentUser?.phone]);

  const handleSendPhoneOtp = async (e) => {
    if (e) e.preventDefault();
    if (!phoneNumber.trim()) {
      setPhoneMsg({ type: 'error', text: 'Please enter a valid phone number (e.g. 0771234567 or +94771234567)' });
      return;
    }

    setPhoneSending(true);
    setPhoneMsg({ type: '', text: '' });
    try {
      const token = sessionStorage.getItem('token');
      const res = await apiRequest('/auth/phone/send-otp', 'POST', { phone: phoneNumber.trim() }, token);
      setOtpSent(true);
      setResendCooldown(60);
      setPhoneMsg({
        type: 'success',
        text: res.mode === 'demo'
          ? 'Demo Mode: Verification code generated (use 123456).'
          : 'Verification code sent via SMS to your mobile phone.',
      });
    } catch (err) {
      setPhoneMsg({ type: 'error', text: err.message || 'Could not send SMS verification code.' });
    } finally {
      setPhoneSending(false);
    }
  };

  const handleVerifyPhoneOtp = async (e) => {
    if (e) e.preventDefault();
    if (!/^\d{6}$/.test(phoneOtp.trim())) {
      setPhoneMsg({ type: 'error', text: 'Please enter the 6-digit code sent to your phone.' });
      return;
    }

    setPhoneVerifying(true);
    setPhoneMsg({ type: '', text: '' });
    try {
      const token = sessionStorage.getItem('token');
      const res = await apiRequest('/auth/phone/verify-otp', 'POST', { phone: phoneNumber.trim(), code: phoneOtp.trim() }, token);
      setPhoneMsg({ type: 'success', text: '✓ Phone number verified successfully!' });
      setOtpSent(false);
      setPhoneOtp('');

      const updated = { ...currentUser, phone: res.phone, phoneVerified: true };
      if (onUserUpdated) onUserUpdated(updated);
      try {
        sessionStorage.setItem('user', JSON.stringify(updated));
      } catch {}
    } catch (err) {
      setPhoneMsg({ type: 'error', text: err.message || 'Verification failed. Please check the code.' });
    } finally {
      setPhoneVerifying(false);
    }
  };

  const handleSendEmailVerification = async () => {
    setEmailSending(true);
    setEmailMsg({ type: '', text: '' });
    try {
      const token = sessionStorage.getItem('token');
      await apiRequest('/auth/password-reset/request', 'POST', { email: currentUser?.email }, token);
      setEmailMsg({ type: 'success', text: 'A verification & security link has been sent via Resend to ' + currentUser?.email });
    } catch (err) {
      setEmailMsg({ type: 'error', text: err.message || 'Could not send email verification.' });
    } finally {
      setEmailSending(false);
    }
  };

  const handleTelegramSuccess = (data) => {
    setTelegramMsg({ type: 'success', text: '✓ Telegram account linked successfully: @' + (data?.user?.telegramUsername || data?.user?.name || 'Verified') });
    if (data?.user && onUserUpdated) {
      const updated = { ...currentUser, ...data.user };
      onUserUpdated(updated);
      try {
        sessionStorage.setItem('user', JSON.stringify(updated));
      } catch {}
    }
  };

  return (
    <div
      className="cd-verification-panel"
      style={{
        background: '#141417',
        border: '1px solid rgba(201, 168, 76, 0.25)',
        borderRadius: '14px',
        padding: '1.25rem',
        marginTop: '1rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <h4 style={{ margin: 0, color: '#fff', fontSize: '0.95rem', fontWeight: 800, letterSpacing: '0.04em' }}>
            ACCOUNT VERIFICATION
          </h4>
          <p style={{ margin: '0.2rem 0 0 0', color: '#888', fontSize: '0.75rem' }}>
            Verify your phone, email, and Telegram identities
          </p>
        </div>
      </div>

      {/* Verification Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.1rem', background: '#0e0e10', padding: '4px', borderRadius: '10px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('phone')}
          style={{
            flex: 1,
            padding: '0.5rem 0.6rem',
            background: activeTab === 'phone' ? 'rgba(201, 168, 76, 0.18)' : 'transparent',
            border: activeTab === 'phone' ? '1px solid var(--gold, #c9a84c)' : '1px solid transparent',
            borderRadius: '8px',
            color: activeTab === 'phone' ? 'var(--gold, #c9a84c)' : '#888',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
          }}
        >
          <span>📱 SMS Phone</span>
          {currentUser?.phoneVerified && <span style={{ color: '#22c55e', fontSize: '0.7rem' }}>✓</span>}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('email')}
          style={{
            flex: 1,
            padding: '0.5rem 0.6rem',
            background: activeTab === 'email' ? 'rgba(201, 168, 76, 0.18)' : 'transparent',
            border: activeTab === 'email' ? '1px solid var(--gold, #c9a84c)' : '1px solid transparent',
            borderRadius: '8px',
            color: activeTab === 'email' ? 'var(--gold, #c9a84c)' : '#888',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
          }}
        >
          <span>✉️ Email</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('telegram')}
          style={{
            flex: 1,
            padding: '0.5rem 0.6rem',
            background: activeTab === 'telegram' ? 'rgba(201, 168, 76, 0.18)' : 'transparent',
            border: activeTab === 'telegram' ? '1px solid var(--gold, #c9a84c)' : '1px solid transparent',
            borderRadius: '8px',
            color: activeTab === 'telegram' ? 'var(--gold, #c9a84c)' : '#888',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
          }}
        >
          <span>✈️ Telegram</span>
          {currentUser?.telegramId && <span style={{ color: '#22c55e', fontSize: '0.7rem' }}>✓</span>}
        </button>
      </div>

      {/* ── TAB 1: PHONE (SMS VIA TEXTBEE) ── */}
      {activeTab === 'phone' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
            <span style={{ color: '#aaa', fontSize: '0.75rem', fontWeight: 600 }}>PHONE NUMBER (SMS VIA TEXTBEE)</span>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '12px',
                background: currentUser?.phoneVerified ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                color: currentUser?.phoneVerified ? '#22c55e' : '#ef4444',
                border: currentUser?.phoneVerified ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(239,68,68,0.3)',
              }}
            >
              {currentUser?.phoneVerified ? 'VERIFIED' : 'NOT VERIFIED'}
            </span>
          </div>

          <form onSubmit={otpSent ? handleVerifyPhoneOtp : handleSendPhoneOtp} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/[^\d+]/g, '').slice(0, 15))}
                placeholder="Mobile (e.g. 0771234567)"
                disabled={phoneSending || phoneVerifying || (otpSent && resendCooldown > 0)}
                style={{
                  flex: 1,
                  background: '#0d0d0f',
                  border: '1px solid #2a2a2a',
                  borderRadius: '8px',
                  color: '#eee',
                  padding: '0.6rem 0.8rem',
                  fontSize: '0.85rem',
                  fontFamily: 'inherit',
                }}
              />
              <button
                type="button"
                onClick={handleSendPhoneOtp}
                disabled={phoneSending || resendCooldown > 0}
                style={{
                  background: resendCooldown > 0 ? '#222' : 'rgba(201, 168, 76, 0.15)',
                  border: '1px solid var(--gold, #c9a84c)',
                  color: resendCooldown > 0 ? '#666' : 'var(--gold, #c9a84c)',
                  borderRadius: '8px',
                  padding: '0.6rem 0.9rem',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {phoneSending
                  ? 'SENDING...'
                  : resendCooldown > 0
                    ? `RESEND (${resendCooldown}s)`
                    : 'SEND OTP BY SMS'}
              </button>
            </div>

            {/* OTP Input Field */}
            {otpSent && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={phoneOtp}
                  onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit SMS OTP"
                  autoFocus
                  style={{
                    flex: 1,
                    background: '#0d0d0f',
                    border: '1px solid var(--gold, #c9a84c)',
                    borderRadius: '8px',
                    color: '#fff',
                    padding: '0.6rem 0.8rem',
                    fontSize: '0.95rem',
                    letterSpacing: '3px',
                    fontWeight: 700,
                    textAlign: 'center',
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  type="button"
                  onClick={handleVerifyPhoneOtp}
                  disabled={phoneVerifying || phoneOtp.length !== 6}
                  style={{
                    background: 'var(--gold, #c9a84c)',
                    border: 'none',
                    color: '#000',
                    borderRadius: '8px',
                    padding: '0.6rem 1.1rem',
                    fontSize: '0.78rem',
                    fontWeight: 900,
                    cursor: phoneOtp.length === 6 ? 'pointer' : 'not-allowed',
                    opacity: phoneOtp.length === 6 ? 1 : 0.6,
                  }}
                >
                  {phoneVerifying ? 'VERIFYING...' : 'VERIFY CODE'}
                </button>
              </div>
            )}

            {phoneMsg.text && (
              <div
                style={{
                  fontSize: '0.78rem',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '6px',
                  color: phoneMsg.type === 'success' ? '#22c55e' : '#ef4444',
                  background: phoneMsg.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  border: phoneMsg.type === 'success' ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(239,68,68,0.2)',
                }}
              >
                {phoneMsg.text}
              </div>
            )}
          </form>
        </div>
      )}

      {/* ── TAB 2: EMAIL (RESEND) ── */}
      {activeTab === 'email' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: '#aaa', fontSize: '0.75rem', fontWeight: 600 }}>REGISTERED EMAIL</span>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '12px',
                background: 'rgba(34,197,94,0.15)',
                color: '#22c55e',
                border: '1px solid rgba(34,197,94,0.3)',
              }}
            >
              ACTIVE
            </span>
          </div>

          <div style={{ background: '#0d0d0f', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '0.6rem 0.8rem', color: '#fff', fontSize: '0.85rem' }}>
            {currentUser?.email || 'No email attached'}
          </div>

          <button
            type="button"
            onClick={handleSendEmailVerification}
            disabled={emailSending}
            style={{
              background: 'rgba(201, 168, 76, 0.15)',
              border: '1px solid var(--gold, #c9a84c)',
              color: 'var(--gold, #c9a84c)',
              borderRadius: '8px',
              padding: '0.6rem',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: emailSending ? 'not-allowed' : 'pointer',
              width: '100%',
            }}
          >
            {emailSending ? 'SENDING EMAIL...' : 'VERIFY WITH EMAIL'}
          </button>

          {emailMsg.text && (
            <div
              style={{
                fontSize: '0.78rem',
                padding: '0.4rem 0.6rem',
                borderRadius: '6px',
                color: emailMsg.type === 'success' ? '#22c55e' : '#ef4444',
                background: emailMsg.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                border: emailMsg.type === 'success' ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(239,68,68,0.2)',
              }}
            >
              {emailMsg.text}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: TELEGRAM ── */}
      {activeTab === 'telegram' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: '#aaa', fontSize: '0.75rem', fontWeight: 600 }}>TELEGRAM IDENTITY</span>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '12px',
                background: currentUser?.telegramId ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
                color: currentUser?.telegramId ? '#22c55e' : '#888',
                border: currentUser?.telegramId ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {currentUser?.telegramId ? 'LINKED' : 'NOT LINKED'}
            </span>
          </div>

          {currentUser?.telegramId ? (
            <div style={{ background: '#0d0d0f', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', padding: '0.75rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.3rem' }}>✈️</span>
              <div>
                <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 700 }}>
                  {currentUser.telegramUsername ? `@${currentUser.telegramUsername}` : 'Verified Telegram User'}
                </div>
                <div style={{ color: '#888', fontSize: '0.72rem' }}>
                  ID: {currentUser.telegramId}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0' }}>
              <p style={{ color: '#aaa', fontSize: '0.78rem', textAlign: 'center', margin: 0 }}>
                Link your Telegram account using the official Telegram Login Widget
              </p>
              <TelegramLoginButton
                onAuthSuccess={handleTelegramSuccess}
                onError={(err) => setTelegramMsg({ type: 'error', text: err })}
                linkOnly={true}
              />
            </div>
          )}

          {telegramMsg.text && (
            <div
              style={{
                fontSize: '0.78rem',
                padding: '0.4rem 0.6rem',
                borderRadius: '6px',
                color: telegramMsg.type === 'success' ? '#22c55e' : '#ef4444',
                background: telegramMsg.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                border: telegramMsg.type === 'success' ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(239,68,68,0.2)',
              }}
            >
              {telegramMsg.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
