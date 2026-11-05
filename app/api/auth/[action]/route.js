import { NextResponse } from 'next/server';
import { deleteSession, normalizePhone, readSession, sendOtp, SESSION_COOKIE, verifyOtp } from '../../../../lib/auth.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' } });
}
function clientIp(request) {
  return (request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown').slice(0, 80);
}
async function bodyOf(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 2048) return null;
  try { return await request.json(); } catch { return null; }
}

export async function GET(request, { params }) {
  const { action } = await params;
  if (action !== 'session') return json({ success: false, error: 'Endpoint tidak ditemukan.' }, 404);
  try {
    const session = await readSession(request.cookies.get(SESSION_COOKIE)?.value);
    return json({ success: true, authenticated: !!session, user: session ? { phone: session.phone } : null });
  } catch {
    return json({ success: false, error: 'Layanan autentikasi belum dikonfigurasi.' }, 503);
  }
}

export async function POST(request, { params }) {
  const { action } = await params;
  try {
    if (action === 'send-otp') {
      const body = await bodyOf(request);
      const phone = normalizePhone(body?.phone);
      if (!phone) return json({ success: false, error: 'Gunakan format internasional, contoh +6281234567890.' }, 400);
      const result = await sendOtp({ phone, ip: clientIp(request) });
      if (!result.ok) return json({ success: false, error: result.error }, result.status);
      return json({ success: true, message: 'Permintaan kode diterima oleh penyedia WhatsApp. Periksa pesan masuk.', providerStatus: result.providerStatus });
    }
    if (action === 'verify-otp') {
      const body = await bodyOf(request);
      const phone = normalizePhone(body?.phone);
      const code = String(body?.code || '').trim();
      if (!phone || !/^\d{6}$/.test(code)) return json({ success: false, error: 'Nomor atau kode OTP tidak valid.' }, 400);
      const result = await verifyOtp({ phone, code });
      if (!result.ok) return json({ success: false, error: result.error }, result.status);
      const response = json({ success: true, user: { phone: result.phone } });
      response.cookies.set(SESSION_COOKIE, result.cookie, {
        httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
        path: '/', maxAge: result.maxAge,
      });
      return response;
    }
    if (action === 'logout') {
      await deleteSession(request.cookies.get(SESSION_COOKIE)?.value);
      const response = json({ success: true });
      response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
      return response;
    }
    return json({ success: false, error: 'Endpoint tidak ditemukan.' }, 404);
  } catch (error) {
    console.error('[X-DRAMS AUTH]', String(error?.message || 'unknown').slice(0, 180));
    return json({ success: false, error: 'Autentikasi belum siap. Periksa konfigurasi server.' }, 503);
  }
}
