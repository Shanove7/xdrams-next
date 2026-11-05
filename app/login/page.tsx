'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';

type Step = 'phone' | 'otp';

export default function LoginPage() {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('+62');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submitPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/auth/send-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }), cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Gagal mengirim OTP.');
      setStep('otp'); setMessage(data.message || 'Kode dikirim melalui WhatsApp.');
    } catch (reason: any) { setError(reason?.message || 'Terjadi kesalahan.'); }
    finally { setBusy(false); }
  }

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/auth/verify-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, code }), cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Verifikasi gagal.');
      window.location.replace('/?login=success');
    } catch (reason: any) { setError(reason?.message || 'Terjadi kesalahan.'); }
    finally { setBusy(false); }
  }

  return <main className="auth-page">
    <div className="auth-glow" />
    <section className="auth-card">
      <Link className="brand auth-brand" href="/"><span className="brand-mark">X</span><span>X-DRAMS</span></Link>
      <div className="eyebrow">YOUR STORY, YOUR SPACE</div>
      <h1>{step === 'phone' ? 'Masuk dengan nomor.' : 'Periksa WhatsApp.'}</h1>
      <p className="auth-intro">{step === 'phone' ? 'Masukkan nomor WhatsApp aktif. Kami akan mengirim kode verifikasi untuk mengamankan akunmu.' : `Masukkan 6 digit kode yang dikirim ke ${phone}. Kode berlaku selama 5 menit.`}</p>
      {step === 'phone' ? <form className="auth-form" onSubmit={submitPhone}>
        <label htmlFor="phone">Nomor WhatsApp</label>
        <input id="phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="+6281234567890" required maxLength={18} />
        <button type="submit" disabled={busy}>{busy ? 'Mengirim...' : 'Kirim kode WhatsApp'} <span>→</span></button>
      </form> : <form className="auth-form" onSubmit={submitCode}>
        <label htmlFor="otp">Kode verifikasi</label>
        <input id="otp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" required />
        <button type="submit" disabled={busy || code.length !== 6}>{busy ? 'Memverifikasi...' : 'Verifikasi & masuk'} <span>→</span></button>
        <button type="button" className="auth-secondary" onClick={() => { setStep('phone'); setCode(''); setMessage(''); setError(''); }}>Ganti nomor</button>
      </form>}
      {message && <p className="auth-message" role="status">{message}</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      <p className="auth-terms">Dengan melanjutkan, kamu menyetujui penggunaan nomor hanya untuk verifikasi dan keamanan akun.</p>
      <Link className="auth-back" href="/">← Kembali ke X-DRAMS</Link>
    </section>
    <span className="auth-dev">DEVELOPED BY <a href="https://instagram.com/Khasan27" target="_blank" rel="noopener noreferrer">@Khasan27</a></span>
  </main>;
}
