# DramaBox Scraper — `dramabox.mjs`

Modul Node.js untuk mengambil data katalog dan URL video dari **DramaBox** (`dramaboxapp.com`) lewat sisi web Next.js mereka. Tanpa login, tanpa token, tanpa API key.

| | |
|---|---|
| Runtime | Node.js 18+ (ESM) |
| Dependensi | **Nol** — hanya modul bawaan Node |
| Ukuran | ~670 baris |

---

## ⚠️ Baca ini dulu — batasan paling penting

Modul ini **tidak** membuka episode terkunci secara penuh.

| Jenis episode | Yang didapat |
|---|---|
| **Gratis** (~10–20% per seri) | ✅ **Video penuh** — MP4 + HLS, durasi asli |
| **Terkunci** (~80–90% per seri) | ⚠️ **Preview ~15 detik** — bukan episode penuh |

Episode terkunci bisa diambil URL-nya, tetapi isi file-nya **selalu sekitar 15 detik** (378 frame @ 25 fps). Itu potongan yang disediakan server untuk pengunjung tanpa akses — semacam cuplikan untuk memancing pembelian.

Sudah diuji menyeluruh: 15 pendekatan berbeda (ganti host, tukar token nama file, tukar signature, tebak segmen, path HLS, API mobile, bundle JS, `schema.org contentUrl`) — **tidak ada** yang menghasilkan video penuh. Bahkan `contentUrl` yang DramaBox publikasikan untuk SEO menunjuk ke file preview yang sama.

**Jadi: katalog, pencarian, detail, dan episode gratis berfungsi penuh. Episode terkunci hanya memberi preview.**

Kalau kamu mencari alat untuk menonton episode terkunci secara utuh, modul ini **bukan** itu.

---

## Daftar Isi

1. [Kemampuan](#kemampuan)
2. [Pemasangan](#pemasangan)
3. [Mulai Cepat](#mulai-cepat)
4. [Mengambil `bookId` dari Link Share](#mengambil-bookid-dari-link-share)
5. [Referensi Fungsi](#referensi-fungsi)
6. [Daftar Export](#daftar-export)
7. [Kode Locale](#kode-locale)
8. [Batasan & Hal Penting](#batasan--hal-penting)
9. [Resep Siap Pakai](#resep-siap-pakai)
10. [Hasil Uji](#hasil-uji)
11. [Catatan Hukum](#catatan-hukum)

---

## Kemampuan

- Jelajah katalog — halaman depan, kategori, browse per genre
- Cari judul
- Ambil detail buku + daftar seluruh episode dengan status gratis/terkunci
- Ambil URL video satu episode
- Ambil URL **semua** episode sekaligus (gratis + preview terkunci)
- Unduh episode gratis secara penuh
- Unduh preview episode terkunci
- Periksa varian kualitas yang benar-benar tersedia

---

## Pemasangan

Tidak ada instalasi.

1. Salin `dramabox.mjs` ke folder proyek.
2. Pastikan Node.js 18+:

   ```bash
   node --version
   ```

3. Import fungsinya:

   ```js
   // Named import
   import { detail, previews, downloadAll } from "./dramabox.mjs";

   // Atau default import
   import db from "./dramabox.mjs";
   const d = await db.detail({ bookId: "42000031854" });
   ```

> File berekstensi `.mjs` otomatis dianggap ESM. Kalau proyekmu memakai `.js` dengan CommonJS, ubah nama file atau tambahkan `"type": "module"` di `package.json`.

---

## Mulai Cepat

```js
import { detail, stream } from "./dramabox.mjs";

// Info buku
const d = await detail({ bookId: "42000031854", lang: "en" });
console.log(d.book.title);        // Mr. Reid Is My Husband
console.log(d.totalEpisodes);     // 41
console.log(d.freeEpisodes);      // 8

// Episode gratis -> video penuh
const ep1 = await stream({ bookId: "42000031854", episode: 1, lang: "en" });
console.log(ep1.locked);          // false
console.log(ep1.url);             // MP4 penuh

// Episode terkunci -> preview ~15 detik
const ep41 = await stream({ bookId: "42000031854", episode: 41, lang: "en" });
console.log(ep41.locked);         // true
console.log(ep41.url);            // klip preview, bukan episode penuh
```

---

## Mengambil `bookId` dari Link Share

Link share DramaBox bentuknya seperti ini:

```
https://sharet.dramabox.com/play?bid=42000031854&cid=701820052
  &cindex=0&uid=f51a...&lan=en&st=98&rf=1&layer=962&group=2484
```

| Parameter | Kegunaan |
|---|---|
| `bid` | **`bookId`** → `42000031854` |
| `cid` | **`chapterId`** episode → bisa dipakai sebagai parameter `episode` |
| `lan` | **`lang`** → `en` |
| `cindex`, `uid`, `st`, `rf`, `layer`, `group` | Tidak diperlukan |

```js
const params = new URL(link).searchParams;
const bookId = params.get("bid");
const lang = params.get("lan") || "en";
const episode = params.get("cid");
```

---

## Referensi Fungsi

Semua fungsi mengembalikan `Promise` dan menerima **satu objek opsi**.

### `home({ lang })`

Halaman depan: baris konten unggulan.

**Return:** `{ lang, rows: [ { id, title, style, more, books: [Book] } ], featured: [Book] }`

```js
const h = await home({ lang: "in" });
h.rows.forEach(r => console.log(r.title, "->", r.books.length, "judul"));
```

---

### `categories({ lang })`

Daftar genre.

**Return:** `{ lang, genres: [ { id, name, slug } ] }`

```js
const c = await categories({ lang: "in" });
console.log(c.genres.length, "genre");
```

---

### `browse({ lang, genre, page })`

Jelajah buku per genre, dengan paginasi.

| Parameter | Default | Keterangan |
|---|---|---|
| `lang` | `"en"` | Kode locale |
| `genre` | `0` | ID genre, `0` = semua |
| `page` | `1` | Nomor halaman |

**Return:** `{ lang, genre, genreName, page, totalPages, count, books, genres }`

```js
const b = await browse({ lang: "in", genre: 449, page: 2 });
```

---

### `search({ keyword, lang, page })`

Cari judul.

| Parameter | Default | Keterangan |
|---|---|---|
| `keyword` | **wajib** | Kata kunci |
| `lang` | `"en"` | Kode locale |
| `page` | `1` | Nomor halaman |

**Return:** `{ lang, keyword, page, totalPages, total, count, books, performers }`

> Kata kunci bersifat locale-spesifik. `total` dibatasi maksimum 500.

```js
const s = await search({ keyword: "Cinta", lang: "in" });
```

---

### `detail({ bookId, lang })`

Info lengkap satu buku + seluruh daftar episode.

**Return:**

```js
{
  lang, book, totalEpisodes, freeEpisodes,
  tabData, episodes: [ Episode ]
}
```

**Objek `Episode`:**

```js
{
  chapterId, index, indexStr, name, free,
  duration,          // milidetik (metadata, bukan durasi file preview)
  price, cover,
  mp4, m3u8          // HANYA terisi kalau free === true
}
```

```js
const d = await detail({ bookId: "42000031854", lang: "en" });
console.log(d.freeEpisodes, "gratis dari", d.totalEpisodes);
```

---

### `episodes({ bookId, lang })`

Versi ringkas `detail()` tanpa objek `book`.

**Return:** `{ bookId, title, lang, totalEpisodes, freeEpisodes, episodes }`

---

### `resolveEpisode({ bookId, episode, lang, check })`

Ambil URL video untuk satu episode.

| Parameter | Default | Keterangan |
|---|---|---|
| `bookId` | **wajib** | ID buku |
| `episode` | — | `chapterId` atau nomor episode 1-based |
| `lang` | `"en"` | Kode locale |
| `check` | `false` | HEAD request untuk verifikasi |

**Return:**

```js
{
  bookId, title, lang, chapterId, index, name,
  free,              // true = gratis (video penuh)
  source,            // "chapterList" (gratis) | "freeSource" (terkunci/preview)
  duration,          // metadata
  mp4, m3u8,         // m3u8 hanya untuk episode gratis
  url,
  alternatives: [],
  verified           // ada kalau check: true
}
```

> Untuk episode terkunci, `url` berisi **klip preview ~15 detik**, bukan episode penuh. HEAD akan balas `200 video/mp4`, tapi durasi isinya tetap 15 detik.

```js
const r = await resolveEpisode({ bookId: "42000031854", episode: 41, lang: "en", check: true });
console.log(r.free, r.verified.status);   // false 200
```

---

### `allEpisodes({ bookId, lang, concurrency })`

Resolve semua episode sekaligus dengan worker pool.

| Parameter | Default | Keterangan |
|---|---|---|
| `bookId` | **wajib** | ID buku |
| `lang` | `"en"` | Kode locale |
| `concurrency` | `6` | Worker paralel, maks 12 |

**Return:**

```js
{
  bookId, title, lang, totalEpisodes, resolved, failed,
  episodes: [ {
    chapterId, index, name, free, source,
    url, mp4, m3u8, duration, ok, error?
  } ]
}
```

> 41 episode selesai ~0,7 detik; 89 episode ~3,3 detik pada concurrency 6.

```js
const a = await allEpisodes({ bookId: "41000118942", lang: "in", concurrency: 8 });
console.log(a.resolved, "/", a.totalEpisodes);
```

---

### `previews({ bookId, lang, concurrency })` — sebelumnya `unlock`

Laporan URL untuk semua episode terkunci. **Namanya `previews` karena yang didapat adalah klip preview, bukan episode penuh.**

| Parameter | Default | Keterangan |
|---|---|---|
| `bookId` | **wajib** | ID buku |
| `lang` | `"en"` | Kode locale |
| `concurrency` | `6` | Worker paralel |

**Return:**

```js
{
  bookId, title, lang, totalEpisodes,
  lockedCount, resolvedCount,
  allResolved,       // semua URL preview berhasil didapat
  note,              // pengingat bahwa ini preview
  episodes: [ { chapterId, index, name, free, source, url, duration } ]
}
```

```js
const p = await previews({ bookId: "42000031854", lang: "en" });
console.log(p.lockedCount, "terkunci,", p.resolvedCount, "URL didapat");
console.log(p.allResolved);   // true
console.log(p.note);          // "preview only: ..."
```

> **Alias lama:** `unlock` masih tersedia dan setara dengan `previews`, demi kompatibilitas kode lama. Nama `unlock` **menyesatkan** dan sebaiknya tidak dipakai di kode baru.

---

### `stream({ bookId, episode, lang, format })`

Pembungkus `resolveEpisode()` dengan bentuk ramah pemutar.

| Parameter | Default | Keterangan |
|---|---|---|
| `bookId` | **wajib** | ID buku |
| `episode` | — | `chapterId` atau nomor 1-based |
| `lang` | `"en"` | Kode locale |
| `format` | `"mp4"` | `"mp4"` atau `"m3u8"` |

**Return:** `{ bookId, title, lang, chapterId, index, name, free, duration, format, url, mp4, m3u8, locked, source }`

> Episode terkunci selalu `m3u8: null`. Gunakan `format: "mp4"`.

```js
const s = await stream({ bookId: "42000031854", episode: 1, lang: "en" });
```

---

### `qualities({ bookId, episode, lang })`

Cek varian kualitas yang benar-benar bisa diakses. Menebak nama file alternatif lalu HEAD request.

**Return:** hasil `resolveEpisode()` + `qualities: [ { label, url, ok, status, type, size } ]`

> Hasil khas untuk episode terkunci:
>
> | Label | Status |
> |---|---|
> | `default` | **200** (720p preview) |
> | `1080p`, `540p`, `plain`, `narrowv3` | 403 |
>
> Ini alat bukti, bukan janji multi-kualitas.

```js
const q = await qualities({ bookId: "41000118942", episode: 40, lang: "in" });
q.qualities.forEach(x => console.log(x.label, x.status));
```

---

### `download({ url, out, onProgress, headers, redirect })`

Unduh file dari URL apa pun ke disk.

| Parameter | Default | Keterangan |
|---|---|---|
| `url` | **wajib** | URL sumber |
| `out` | nama file dari URL | Path tujuan |
| `onProgress` | — | Callback `({ received, total, percent })` |
| `headers` | `{}` | Header tambahan |
| `redirect` | `5` | Maksimum redirect |

**Return:** `{ path, status, type, bytes, total }`

Fitur: streaming via `pipeline`, menerima 200 **dan** 206, ikuti redirect, buat folder otomatis, timeout 60 detik.

```js
await download({
  url: "https://...",
  out: "./video/ep1.mp4",
  onProgress: p => console.log(Math.round(p.percent * 100) + "%")
});
```

---

### `downloadEpisode({ bookId, episode, lang, out, onProgress, check })`

Resolve satu episode lalu unduh.

**Return:** gabungan hasil `resolveEpisode()` dan `download()`.

> Kalau episode terkunci, yang terunduh adalah **preview 15 detik**.

```js
const r = await downloadEpisode({ bookId: "42000031854", episode: 1, lang: "en", out: "./ep1.mp4" });
console.log(r.bytes, r.type);
```

---

### `downloadAll({ bookId, lang, dir, concurrency, from, to, onProgress })`

Unduh banyak episode sekaligus.

| Parameter | Default | Keterangan |
|---|---|---|
| `bookId` | **wajib** | ID buku |
| `lang` | `"en"` | Kode locale |
| `dir` | `"."` | Folder tujuan |
| `concurrency` | `6` | Worker paralel, maks 6 |
| `from` | `1` | Episode awal (inklusif) |
| `to` | episode terakhir | Episode akhir (inklusif) |
| `onProgress` | — | Callback `({ index, chapterId, received, total, percent })` |

**Return:** `{ bookId, title, dir, totalEpisodes, requested, downloaded, failed, files }`

Nama file: `<bookId>_<NNN>_<chapterId>.mp4`

> **Penting:** episode terkunci akan tersimpan sebagai klip 15 detik. Kalau tujuanmu mengarsipkan seri utuh, sadari bahwa 80–90% file-nya hanya preview.

```js
const r = await downloadAll({
  bookId: "42000031854", lang: "en", dir: "./reid",
  from: 1, to: 41, concurrency: 3,
});
console.log(r.downloaded, "/", r.requested);
```

---

## Daftar Export

**Named export:**

```
home, categories, browse, search, detail, episodes,
resolveEpisode, allEpisodes, stream, qualities,
previews, unlock (alias), download, downloadEpisode, downloadAll
```

**Default export:** objek berisi semua fungsi di atas.

---

## Kode Locale

| Kode | Bahasa |
|---|---|
| `in` | Bahasa Indonesia |
| `en` | English |
| `es` | Español |
| `pt` | Português |
| `th` | ไทย |
| `ar` | العربية |
| `ja` | 日本語 |
| `ko` | 한국어 |
| `fr` | Français |
| `de` | Deutsch |
| `it` | Italiano |

Nilai tidak valid otomatis jatuh ke `"en"`.

---

## Batasan & Hal Penting

### 1. Episode terkunci = preview 15 detik

Ini batasan utama. Sudah diuji 15 pendekatan berbeda, tidak ada yang menghasilkan video penuh. Detailnya ada di bagian atas dokumen ini.

### 2. Kualitas: 720p

Episode terkunci hanya punya satu varian: 720p H.264 (720×1280/1282) + AAC. Varian 1080p/540p/HLS mengembalikan 403.

Episode gratis lebih kaya: 720p `narrowv3` MP4 + HLS `m3u8`.

### 3. URL kedaluwarsa

Semua URL adalah CloudFront signed URL dengan `Expires`. Setelah lewat, akses jadi 403. Panggil ulang `stream()` / `resolveEpisode()` untuk URL baru.

### 4. Nama file `15s` itu jujur

`...720p.nav2.15s.mp4` **benar-benar 15 detik**. Bukan artefak penamaan — sudah dibuktikan dengan `ffprobe` di 5 episode berbeda, semuanya 378 frame.

Episode gratis memakai pola nama berbeda (`wz.h264`, `narrowv3`) dan durasinya penuh.

### 5. Blokir sementara CloudFront

Situs kadang memblokir seluruh zona `dramaboxapp.com` beberapa menit kalau terlalu banyak request. Gejala: 403 dengan body `Request blocked`.

Modul melempar error berawalan `blocked:` dan membuang cache `buildId`. Blokir hilang sendiri.

Kalau mengunduh banyak seri: beri jeda 10–30 detik antar buku, `concurrency` 3–4, tangani error `blocked:` dengan retry.

### 6. HLS tidak bisa dibuka di browser

URL `m3u8` valid (200, 12 segmen, tiap `.ts` 206 `video/mp2t`), tetapi Content-Type-nya `text/plain` dan tidak ada `#EXT-X-STREAM-INF`. Browser non-Safari tidak bisa memutar langsung.

Gunakan Safari, VLC, mpv, atau ekstensi HLS. Untuk menonton biasa, pakai MP4.

### 7. Judul episode tetap Mandarin

`chapterList` tidak menyediakan terjemahan judul episode. Walau `lang: "en"`, nama tetap seperti `第一集`.

### 8. `buildId` berputar

Next.js mengubah `buildId` tiap deploy. Modul cache 60 detik dan resolve ulang saat 404.

### 9. Jebakan off-by-one

Di halaman film `indexStr` 0-based (`"000"` = ep 1); di halaman `/episode` 1-based (`"015"` = ep 16). Modul normalisasi ke 1-based dari posisi array.

---

## Resep Siap Pakai

### Cek berapa episode yang benar-benar bisa ditonton penuh

```js
import { detail } from "./dramabox.mjs";

const d = await detail({ bookId: "42000031854", lang: "en" });
const locked = d.totalEpisodes - d.freeEpisodes;
console.log(`${d.freeEpisodes} episode penuh, ${locked} episode hanya preview 15 detik`);
```

### Unduh hanya episode gratis (yang benar-benar utuh)

```js
import { detail, download } from "./dramabox.mjs";

const d = await detail({ bookId: "42000031854", lang: "en" });
for (const ep of d.episodes.filter(e => e.free)) {
  const out = `./reid/${String(ep.index).padStart(3, "0")}.mp4`;
  const r = await download({ url: ep.mp4, out });
  console.log(`ep ${ep.index}: ${r.bytes} bytes`);
}
```

### Unduh preview episode terkunci (untuk referensi)

```js
import { previews, download } from "./dramabox.mjs";

const p = await previews({ bookId: "42000031854", lang: "en" });
for (const ep of p.episodes.slice(0, 3)) {
  await download({ url: ep.url, out: `./preview_${ep.index}.mp4` });
}
console.log("selesai — ingat ini klip 15 detik");
```

### Dari link share

```js
import { stream } from "./dramabox.mjs";

const params = new URL(link).searchParams;
const s = await stream({
  bookId: params.get("bid"),
  episode: params.get("cid"),
  lang: params.get("lan") || "en",
});
console.log(s.name, "locked:", s.locked);
```

### Retry saat kena blokir

```js
async function retry(fn, tries = 5, wait = 30000) {
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (!String(e.message).startsWith("blocked:") || i === tries - 1) throw e;
      console.log("kena blokir, tunggu", wait / 1000, "detik...");
      await new Promise(r => setTimeout(r, wait));
    }
  }
}
```

---

## Hasil Uji

### Semua fungsi (dari raw Gist, Node 24)

28/28 PASS — katalog, pencarian, detail, resolve, stream, download, error handling, locale.

### Durasi file preview episode terkunci

| Episode | Ukuran | Frame | Durasi |
|---|---:|---:|---:|
| 9 | 1.653.979 B | 378 | 15,24 s |
| 17 | 1.631.833 B | 378 | 15,36 s |
| 25 | 1.593.702 B | 378 | 15,16 s |
| 33 | 1.159.556 B | 378 | 15,40 s |
| 41 | 1.302.764 B | 378 | 15,36 s |

**Konsisten 378 frame.** Batas keras dari server.

### Episode gratis

| Episode | Ukuran | Durasi |
|---|---:|---:|
| Ep 1 Mr. Reid | 11.401.378 B | **116,03 s** |

Video penuh. HLS-nya juga 12 segmen dengan total 116 detik — cocok dengan metadata.

### Katalog

| Uji | Hasil |
|---|---|
| Genre | 50 |
| Browse | 12 buku/halaman, 167 halaman |
| Search "love" | 20 buku, total 500 |
| Buku terbesar diuji | 89 episode |
| Locale | 11 bahasa |

---

## Catatan Hukum

Modul ini mengakses data yang tersedia publik di sisi web DramaBox. Tidak ada DRM yang dibobol, tidak ada enkripsi yang dipatahkan, tidak ada akun yang dieksploitasi — justru modul ini **tidak** bisa melewati batas akses berbayar.

Mengunduh dan mendistribusikan ulang konten berhak cipta melanggar ketentuan layanan mereka. Gunakan untuk keperluan pribadi dan pembelajaran.