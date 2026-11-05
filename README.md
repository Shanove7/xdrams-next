# X-DRAMS — Next.js Edition

Website katalog dan pemutar drama pendek dengan desain minimalis **midnight navy + light blue**. Dibangun dengan Next.js App Router, React, dan scraper `dramabox.mjs` yang disertakan dalam proyek sumber.

**Developer:** Khasan — [instagram.com/Khasan27](https://instagram.com/Khasan27)

> **Batasan sumber yang wajib dipahami:** scraper tidak membuka episode terkunci. Episode gratis dapat menyediakan video penuh, sedangkan episode terkunci hanya menyediakan klip preview sekitar 15 detik. Website menandai status tersebut secara eksplisit dan tidak mengklaim preview sebagai episode penuh.

## Fitur website

- Homepage katalog dengan konten unggulan dari sumber.
- Pencarian judul drama.
- Jelajah genre/kategori dan pagination / load more.
- Detail drama, sinopsis, genre, jumlah episode, dan daftar episode.
- Player MP4 langsung untuk URL yang diberikan sumber.
- Label **Gratis / Episode penuh** dan **Preview ±15 detik**.
- Input link share DramaBox: membaca `bid`, `cid`, dan `lan` dari URL.
- Pemilihan locale katalog sumber: `in`, `en`, `es`, `pt`, `th`, `ar`, `ja`, `ko`, `fr`, `de`, `it`.
- Bahasa antarmuka terpisah: Bahasa Indonesia dan English.
- Preferensi bahasa UI dan locale sumber disimpan di `localStorage`.
- Login dengan nomor WhatsApp melalui OTP 6 digit.
- Sesi login menggunakan cookie HttpOnly, Secure di production, SameSite=Lax, dan masa berlaku 30 hari.
- Penyimpanan OTP/sesi dan rate limit terdistribusi menggunakan Upstash Redis.
- Pengiriman OTP melalui Wapito WhatsApp API; token hanya dibaca dari environment variable server.
- Responsive layout untuk mobile, tablet, dan desktop.
- Loading, empty, error, dan retry state.
- Metadata SEO, Open Graph, Twitter card, dan security headers.
- UI memakai CSS biasa tanpa framework CSS besar atau paket komponen tambahan.

### Penting: locale katalog bukan pilihan audio

Parameter `lang` yang dijelaskan README scraper adalah **locale halaman/katalog sumber**. Parameter itu dapat memengaruhi bahasa data/judul yang dikirim DramaBox, tetapi scraper tidak mengekspos pilihan track audio, dubbing, maupun subtitle. Karena itu dropdown **Bahasa katalog** tidak mengganti suara atau subtitle video. Ketersediaan bahasa audio/subtitle tidak dapat dijanjikan oleh modul ini.

## Teknologi

| Area | Teknologi |
|---|---|
| Framework | Next.js 15 App Router |
| UI | React 19 + CSS |
| Runtime | Node.js 20.9+ |
| API | Next.js Route Handler, Node runtime |
| Scraper | `lib/dramabox.mjs` (modul sumber) |
| Hosting | Vercel |

Fitur katalog tetap dapat berjalan tanpa konfigurasi auth. Untuk mengaktifkan login OTP WhatsApp, siapkan Wapito dan Upstash Redis sesuai bagian **Login OTP WhatsApp** di bawah.


## Login nomor WhatsApp (OTP)

X-DRAMS menyediakan alur login nomor telepon dengan kode OTP 6 digit melalui Wapito. OTP berlaku 5 menit, dibatasi maksimal 5 percobaan verifikasi, maksimal 5 permintaan per nomor per hari, cooldown 60 detik per nomor, serta batas permintaan per IP. Setelah berhasil, server membuat sesi 30 hari yang disimpan di Redis dan mengirim cookie `HttpOnly` (tidak dapat dibaca JavaScript), `SameSite=Lax`, serta `Secure` saat production.

### Environment variables

Salin `.env.example` menjadi `.env.local` untuk development, lalu isi nilai rahasia. Di Vercel, masukkan variabel yang sama melalui **Project → Settings → Environment Variables**.

| Variable | Kegunaan |
|---|---|
| `WAPITO_API_TOKEN` | Token baru Wapito untuk mengirim pesan WhatsApp |
| `WAPITO_API_URL` | Opsional; default endpoint Wapito `/v1/messages/text` |
| `UPSTASH_REDIS_REST_URL` | URL database Upstash Redis |
| `UPSTASH_REDIS_REST_TOKEN` | Token REST Upstash |
| `AUTH_SECRET` | Secret acak minimal 32 karakter untuk HMAC OTP/sesi (buat dengan `openssl rand -hex 32`) |

**Penting:** jangan commit `.env.local`, jangan taruh token di client/browser, dan jangan kirim secret melalui chat atau screenshot. Token Wapito yang pernah ditempel ke percakapan sebaiknya segera dicabut/di-rotate di dashboard Wapito lalu gunakan token baru di Vercel.

### Alur endpoint

- `POST /api/auth/send-otp` dengan JSON `{ "phone": "+6281234567890" }` mengirim OTP. Nomor harus format internasional E.164.
- `POST /api/auth/verify-otp` dengan JSON `{ "phone": "+6281234567890", "code": "123456" }` memverifikasi OTP dan membuat sesi.
- `GET /api/auth/session` memeriksa sesi dari cookie.
- `POST /api/auth/logout` menghapus sesi dan cookie.
- Halaman login tersedia di `/login`.

Status `pending` dari Wapito berarti pesan diterima/diproses oleh provider, bukan bukti pesan sudah sampai ke WhatsApp penerima. UI tidak mengklaim pengiriman berhasil sampai ke perangkat.

Login ini adalah autentikasi berbasis nomor telepon, bukan sistem profil lengkap. Nomor yang berhasil diverifikasi menjadi identitas akun. Tambahkan kebijakan privasi, penghapusan akun, dan verifikasi legal/consent yang sesuai sebelum membuka layanan untuk publik.

## Menjalankan lokal

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`.

Build produksi:

```bash
npm run build
npm run start
```

Gunakan Node.js **20.9 atau lebih baru**.

## Deploy ke Vercel

1. Extract ZIP.
2. Push isi folder proyek ke GitHub.
3. Import repository melalui Vercel → Add New → Project.
4. Framework akan terdeteksi sebagai **Next.js**.
5. Gunakan Node.js 20.9+; biarkan Build Command dan Output Directory mengikuti default Next.js.
6. Deploy.

`vercel.json` mengatur region `sin1` dan batas durasi function API 30 detik. Environment variable autentikasi hanya wajib jika fitur login OTP ingin diaktifkan.

## Struktur proyek

```text
xdrams-next/
├── app/
│   ├── api/
│   │   ├── [action]/route.js   # API katalog server-side
│   │   └── auth/[action]/route.js # OTP, sesi, logout
│   ├── globals.css             # UI dan responsive styles
│   ├── layout.tsx              # Metadata dan root layout
│   ├── login/page.tsx          # Login nomor + OTP WhatsApp
│   └── page.tsx                # Halaman utama
├── components/
│   └── explorer.tsx            # Katalog, pencarian, detail, player
├── docs/
│   └── DRAMABOX-MODULE.md      # Dokumentasi modul sumber
├── lib/
│   ├── auth.mjs                # OTP, Redis, sesi HMAC
│   └── dramabox.mjs            # Scraper DramaBox asli
├── .env.example
├── .gitignore
├── next.config.mjs
├── package.json
├── tsconfig.json
└── vercel.json
```

## API internal

Endpoint katalog adalah `GET`, diproses di server, dan mengembalikan JSON. Endpoint autentikasi memakai `POST` untuk OTP/logout dan `GET` untuk memeriksa sesi. Tidak ada endpoint yang menerima URL video arbitrary dari browser.

| Endpoint | Parameter | Fungsi |
|---|---|---|
| `/api/home` | `lang` | Featured rows dan konten beranda |
| `/api/categories` | `lang` | Daftar genre |
| `/api/browse` | `genre`, `page`, `lang` | Katalog berdasarkan genre |
| `/api/search` | `q`, `page`, `lang` | Pencarian judul |
| `/api/detail` | `id`, `lang` | Detail dan episode |
| `/api/stream` | `id`, `episode`, `lang` | Resolve URL MP4 satu episode |

Contoh:

```text
/api/home?lang=in
/api/categories?lang=en
/api/browse?genre=0&page=1&lang=in
/api/search?q=secret&lang=in
/api/detail?id=42000031854&lang=in
/api/stream?id=42000031854&episode=1&lang=in
```

Validasi server membatasi ID drama ke angka 5–20 digit, nomor episode 1–2000, kata kunci 2–80 karakter, halaman, genre, dan locale yang didukung.

## Cara kerja berdasarkan README scraper

Scraper sumber memiliki export berikut:

- Katalog: `home`, `categories`, `browse`.
- Pencarian: `search`.
- Informasi: `detail`, `episodes`.
- Resolusi media: `resolveEpisode`, `stream`, `allEpisodes`, `qualities`, `previews` (`unlock` hanya alias lama).
- Unduh file: `download`, `downloadEpisode`, `downloadAll`.

Website memakai `home`, `categories`, `browse`, `search`, `detail`, dan `stream`. Fungsi unduh massal tidak diekspos sebagai fitur publik website.

### Status episode

| Status | Yang diberikan sumber | Tampilan website |
|---|---|---|
| Gratis | MP4 penuh; kadang juga HLS | Gratis / Episode penuh |
| Terkunci | URL klip preview ±15 detik | Preview ±15 detik |

Untuk episode terkunci, `stream()` mengembalikan `locked: true`, `free: false`, dan URL preview MP4. Itu bukan episode penuh. HLS hanya tersedia pada kondisi episode gratis tertentu; website menggunakan MP4 untuk pemutaran yang lebih kompatibel.

### Link share DramaBox

Website membaca parameter yang didokumentasikan scraper:

- `bid` → ID drama (`bookId`).
- `cid` → ID chapter/episode.
- `lan` → locale sumber.

Parameter tracking lain pada link share tidak dibutuhkan.

### URL media dan gangguan sumber

- URL media merupakan signed URL dan dapat kedaluwarsa. Website meminta URL baru saat pengguna menekan tombol putar.
- Sumber dapat mengganti Next.js `buildId`, mengubah struktur halaman, membatasi CloudFront, atau mengalami gangguan sementara.
- Bila sumber memblokir request, website menampilkan pesan agar pengguna mencoba lagi nanti; jangan melakukan retry agresif.
- Judul episode bisa tetap berbahasa Mandarin karena `chapterList` sumber tidak menyediakan terjemahan judul episode secara konsisten.
- Durasi metadata episode bukan jaminan durasi file preview.

## Keamanan dan batasan produksi

Lapisan yang diterapkan:

- Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, dan HSTS.
- `X-Powered-By` dinonaktifkan.
- Validasi parameter API dan allowlist locale.
- Batas request sederhana per IP per instance.
- Respons API `no-store`.
- Pesan error publik tidak membocorkan stack trace atau detail upstream.
- Tidak menerima URL arbitrary dari client sehingga endpoint tidak menjadi proxy terbuka.

**Tidak ada sistem yang bisa dijamin 100% aman.** Rate limiter Map saat ini hanya best-effort per instance dan dapat reset saat function serverless berhenti atau berpindah. Untuk trafik publik/produksi, tambahkan Redis/Upstash untuk rate limiting terdistribusi, Vercel Firewall/WAF, bot protection, monitoring, dan pengujian berkala. CSP ketat belum diaktifkan karena sumber gambar dan media eksternal perlu kebijakan domain yang diuji. Jangan commit `.env` atau secret.

## Hak cipta dan penggunaan

Modul membaca data publik yang tersedia di sisi web sumber; modul ini tidak membobol DRM, tidak mematahkan enkripsi, dan tidak melewati akses berbayar. Mengunduh atau mendistribusikan ulang konten berhak cipta dapat melanggar ketentuan layanan dan hukum yang berlaku. Gunakan secara bertanggung jawab dan hormati hak pemilik konten.

## Developer

**Khasan** — [Instagram @Khasan27](https://instagram.com/Khasan27)

© X-DRAMS. All rights reserved.
