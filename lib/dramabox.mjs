import https from "node:https";
import { URL } from "node:url";
import { createWriteStream, mkdirSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { dirname, basename } from "node:path";

const ORIGINS = ["https://www.dramaboxapp.com", "https://dramaboxapp.com"];
const CACHE_MS = 60_000;
const BLOCK = "blocked";

let buildCache = { id: null, at: 0, origin: ORIGINS[0] };

function isBlock(status, body) {
  return (
    status === 403 &&
    typeof body === "string" &&
    (body.includes("cloudfront") || body.includes("Request blocked") || body.includes("Access Denied"))
  );
}

function http(url, { method = "GET", headers = {}, redirect = 3 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method,
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9,id;q=0.8",
          ...headers,
        },
        timeout: 25_000,
      },
      (res) => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400 && res.headers.location && redirect > 0) {
          res.resume();
          const next = new URL(res.headers.location, url).toString();
          http(next, { method, headers, redirect: redirect - 1 }).then(resolve, reject);
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          })
        );
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout " + url)));
    req.on("error", reject);
    req.end();
  });
}

async function buildId() {
  const now = Date.now();
  if (buildCache.id && now - buildCache.at < CACHE_MS) return buildCache.id;
  let blocked = 0;
  for (const origin of ORIGINS) {
    const r = await http(origin + "/").catch(() => null);
    if (!r) continue;
    if (isBlock(r.status, r.body)) {
      blocked++;
      continue;
    }
    const m = r.body.match(/"buildId":"([^"]+)"/);
    if (m) {
      buildCache = { id: m[1], at: now, origin };
      return m[1];
    }
  }
  if (blocked) throw new Error(BLOCK + ": CloudFront denied all origins");
  throw new Error("buildId not found");
}

function loc(lang) {
  const v = String(lang || "en").trim().toLowerCase();
  return /^[a-z]{2}(-[a-z]{2})?$/.test(v) ? v : "en";
}

async function data(p, query) {
  const qs = query
    ? "?" +
      new URLSearchParams(
        Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== "")
      ).toString()
    : "";
  const clean = p.replace(/^\/+/, "");
  const b = await buildId();
  const origin = buildCache.origin || ORIGINS[0];
  const url = `${origin}/_next/data/${b}/${clean}.json${qs}`;
  const r = await http(url);
  if (r.status === 404) {
    buildCache.at = 0;
    const b2 = await buildId();
    const o2 = buildCache.origin || origin;
    const r2 = await http(`${o2}/_next/data/${b2}/${clean}.json${qs}`);
    if (r2.status !== 200) throw new Error(`HTTP ${r2.status} ${url}`);
    return parse(r2.body, url);
  }
  if (isBlock(r.status, r.body)) {
    buildCache.at = 0;
    buildCache.origin = null;
    throw new Error(BLOCK + ": CloudFront denied " + url);
  }
  if (r.status !== 200) throw new Error(`HTTP ${r.status} ${url}`);
  return parse(r.body, url);
}

function parse(body, url) {
  let j;
  try {
    j = JSON.parse(body);
  } catch {
    throw new Error("invalid JSON from " + url);
  }
  const pp = (j && j.pageProps) || {};
  if (pp.__N_REDIRECT) return { redirect: pp.__N_REDIRECT, status: pp.__N_REDIRECT_STATUS };
  return pp;
}

function pickBook(b) {
  return {
    bookId: String(b.bookId || b.originalBookId || ""),
    title: b.bookName || "",
    titleEn: b.bookNameEn || "",
    cover: b.cover || b.coverWap || "",
    intro: b.introduction || "",
    tags: b.tags || b.labels || [],
    genres: (b.typeTwoList || []).map((t) => t.name).filter(Boolean),
    chapterCount: Number(b.chapterCount || 0),
    viewCount: Number(b.viewCount || 0),
    followCount: Number(b.followCount || 0),
    rating: b.ratings === undefined ? null : Number(b.ratings),
    author: b.author || "",
    performers: b.performerList || [],
    language: b.simpleLanguage || b.language || "",
  };
}

function pickEpisode(c, pos) {
  const free = c.unlock === true;
  const num = Number(c.indexStr || 0) || pos;
  return {
    chapterId: String(c.id || ""),
    index: num,
    indexStr: c.indexStr || String(num).padStart(3, "0"),
    name: c.name || "",
    free,
    duration: Number(c.duration || 0),
    price: Number(c.chapterPrice || 0),
    cover: c.cover || "",
    mp4: free ? c.mp4 || null : null,
    m3u8: free ? c.m3u8Url || null : null,
  };
}

function splitUrl(u) {
  const i = u.indexOf("?");
  return i < 0 ? { base: u, qs: "" } : { base: u.slice(0, i), qs: u.slice(i) };
}

async function head(url) {
  try {
    const r = await http(url, {
      method: "HEAD",
      headers: { range: "bytes=0-1023" },
      redirect: 5,
    });
    return {
      status: r.status,
      type: r.headers["content-type"] || "",
      size: Number(r.headers["content-length"] || 0),
    };
  } catch (e) {
    return { status: 0, type: "", size: 0, error: e.message };
  }
}

function variants(url) {
  const { base, qs } = splitUrl(url);
  const dir = base.slice(0, base.lastIndexOf("/") + 1);
  const file = base.slice(base.lastIndexOf("/") + 1);
  const id = file.split(".")[0];
  const token = file.slice(id.length + 1);
  const list = [{ label: "default", url }];
  const seen = new Set([base]);
  const push = (label, name) => {
    const b = dir + name;
    if (seen.has(b)) return;
    seen.add(b);
    list.push({ label, url: b + qs });
  };
  if (/nav2\.\d+s/.test(token)) {
    push("1080p", id + ".1080p.nav2.15s.mp4");
    push("540p", id + ".540p.nav2.15s.mp4");
    push("plain", id + ".mp4");
    push("narrowv3", id + ".720p.narrowv3.mp4");
  } else if (/narrowv3/.test(token)) {
    push("nav2", id + ".720p.nav2.15s.mp4");
  }
  if (dir.includes("hwvideoseo")) {
    push("hls-720p", "m3u8/" + id + ".720p.m3u8");
  }
  return list;
}

function asEpisode(list, episode) {
  if (!list.length) throw new Error("no episodes");
  if (episode === undefined || episode === null || episode === "") {
    return list.find((c) => c.free) || list[0];
  }
  const want = String(episode).trim();
  const asNum = Number(want);
  const hit =
    list.find((c) => c.chapterId === want) ||
    (Number.isFinite(asNum) ? list.find((c) => c.index === asNum) : undefined);
  if (!hit) throw new Error("episode not found");
  return hit;
}

export async function browse({ lang = "en", genre = 0, page = 1 } = {}) {
  const L = loc(lang);
  const g = Number(genre) || 0;
  const p = Math.max(1, Number(page) || 1);
  const path = p === 1 ? `${L}/browse/${g}` : `${L}/browse/${g}/${p}`;
  let pp = await data(path);
  if (pp && pp.redirect) {
    const rp = String(pp.redirect).replace(/^\/+/, "").replace(/\.json$/, "");
    pp = await data(rp);
  }
  const books = (pp.bookList || []).map(pickBook);
  return {
    lang: pp.locale || L,
    genre: Number(pp.typeTwoId || g),
    genreName: pp.typeTwoName || "all",
    page: Number(pp.pageNo || p),
    totalPages: Number(pp.pages || 0),
    count: books.length,
    books,
    genres: (pp.types || [])
      .map((t) => ({ id: Number(t.id), name: t.name, slug: t.replaceName }))
      .filter((t) => t.id > 0),
  };
}

export async function search({ keyword, lang = "en", page = 1 } = {}) {
  const q = String(keyword || "").trim();
  if (!q) throw new Error("keyword required");
  const L = loc(lang);
  const p = Number(page) || 1;
  const pp = await data(`${L}/search`, { searchValue: q, page: p });
  const books = (pp.bookList || []).map(pickBook);
  return {
    lang: pp.locale || L,
    keyword: pp.sValue || q,
    page: Number(pp.pageNo || p),
    totalPages: Number(pp.totalPage || 0),
    total: Number(pp.totalNum || 0),
    count: books.length,
    books,
    performers: (pp.actorList || []).map((a) => ({
      performerId: String(a.performerId || a.id || ""),
      name: a.name || a.performerName || "",
      avatar: a.avatar || a.cover || "",
    })),
  };
}

export async function detail({ bookId, lang = "en" } = {}) {
  const id = String(bookId || "").trim();
  if (!id) throw new Error("bookId required");
  const L = loc(lang);
  const pp = await data(`${L}/film/${id}`);
  const info = pp.bookInfo || {};
  const chapters = (pp.chapterList || []).map((c, i) => pickEpisode(c, i + 1));
  return {
    lang: pp.locale || L,
    book: pickBook(info),
    totalEpisodes: chapters.length,
    freeEpisodes: chapters.filter((c) => c.free).length,
    tabData: pp.tabData || [],
    episodes: chapters,
  };
}

export async function episodes({ bookId, lang = "en" } = {}) {
  const d = await detail({ bookId, lang });
  return {
    bookId: d.book.bookId,
    title: d.book.title,
    lang: d.lang,
    totalEpisodes: d.totalEpisodes,
    freeEpisodes: d.freeEpisodes,
    episodes: d.episodes,
  };
}

export async function resolveEpisode({ bookId, episode, lang = "en", check = false } = {}) {
  const id = String(bookId || "").trim();
  if (!id) throw new Error("bookId required");
  const L = loc(lang);
  const d = await detail({ bookId: id, lang: L });
  const ep = asEpisode(d.episodes, episode);
  if (ep.free) {
    const out = {
      bookId: id,
      title: d.book.title,
      lang: d.lang,
      chapterId: ep.chapterId,
      index: ep.index,
      name: ep.name,
      free: true,
      source: "chapterList",
      duration: ep.duration,
      mp4: ep.mp4,
      m3u8: ep.m3u8,
      url: ep.mp4 || ep.m3u8 || null,
      alternatives: [],
    };
    if (check && out.url) out.verified = await head(out.url);
    return out;
  }
  const pp = await data(`${L}/episode/${id}/${ep.chapterId}`);
  const src = pp.freeSource || pp.currentUrl || pp.videoUrl || null;
  const out = {
    bookId: id,
    title: d.book.title,
    lang: d.lang,
    chapterId: ep.chapterId,
    index: ep.index,
    name: ep.name,
    free: false,
    source: "freeSource",
    duration: ep.duration,
    mp4: src,
    m3u8: null,
    url: src,
    alternatives: [],
  };
  if (check && src) out.verified = await head(src);
  return out;
}

export async function allEpisodes({ bookId, lang = "en", concurrency = 6 } = {}) {
  const id = String(bookId || "").trim();
  if (!id) throw new Error("bookId required");
  const L = loc(lang);
  const d = await detail({ bookId: id, lang: L });
  const list = d.episodes;
  const out = new Array(list.length);
  let cursor = 0;
  const limit = Math.max(1, Math.min(12, Number(concurrency) || 6));
  const worker = async () => {
    while (true) {
      const i = cursor++;
      if (i >= list.length) return;
      const ep = list[i];
      if (ep.free) {
        out[i] = {
          chapterId: ep.chapterId,
          index: ep.index,
          name: ep.name,
          free: true,
          source: "chapterList",
          url: ep.mp4 || ep.m3u8 || null,
          mp4: ep.mp4,
          m3u8: ep.m3u8,
          duration: ep.duration,
          ok: Boolean(ep.mp4 || ep.m3u8),
        };
        continue;
      }
      try {
        const pp = await data(`${L}/episode/${id}/${ep.chapterId}`);
        const src = pp.freeSource || pp.currentUrl || pp.videoUrl || null;
        out[i] = {
          chapterId: ep.chapterId,
          index: ep.index,
          name: ep.name,
          free: false,
          source: "freeSource",
          url: src,
          mp4: src,
          m3u8: null,
          duration: ep.duration,
          ok: Boolean(src),
        };
      } catch (e) {
        out[i] = {
          chapterId: ep.chapterId,
          index: ep.index,
          name: ep.name,
          free: false,
          source: "freeSource",
          url: null,
          mp4: null,
          m3u8: null,
          duration: ep.duration,
          ok: false,
          error: e.message,
        };
      }
    }
  };
  await Promise.all(Array.from({ length: limit }, worker));
  return {
    bookId: id,
    title: d.book.title,
    lang: d.lang,
    totalEpisodes: list.length,
    resolved: out.filter((x) => x.ok).length,
    failed: out.filter((x) => !x.ok).length,
    episodes: out,
  };
}

export async function stream({ bookId, episode, lang = "en", format = "mp4" } = {}) {
  const r = await resolveEpisode({ bookId, episode, lang });
  const fmt = String(format || "mp4").toLowerCase() === "m3u8" ? "m3u8" : "mp4";
  return {
    bookId: r.bookId,
    title: r.title,
    lang: r.lang,
    chapterId: r.chapterId,
    index: r.index,
    name: r.name,
    free: r.free,
    duration: r.duration,
    format: fmt,
    url: fmt === "m3u8" ? r.m3u8 : r.mp4 || r.url,
    mp4: r.mp4,
    m3u8: r.m3u8,
    locked: !r.free,
    source: r.source,
  };
}

export async function qualities({ bookId, episode, lang = "en" } = {}) {
  const r = await resolveEpisode({ bookId, episode, lang });
  if (!r.url) return { ...r, qualities: [] };
  const list = variants(r.url);
  const results = [];
  for (const v of list) {
    const vh = await head(v.url);
    results.push({
      label: v.label,
      url: v.url,
      ok: vh.status === 200 || vh.status === 206,
      status: vh.status,
      type: vh.type,
      size: vh.size,
    });
  }
  return { ...r, qualities: results };
}

export async function previews({ bookId, lang = "en", concurrency = 6 } = {}) {
  const a = await allEpisodes({ bookId, lang, concurrency });
  const locked = a.episodes.filter((e) => !e.free);
  const resolved = locked.filter((e) => e.ok && e.url);
  return {
    bookId: a.bookId,
    title: a.title,
    lang: a.lang,
    totalEpisodes: a.totalEpisodes,
    lockedCount: locked.length,
    resolvedCount: resolved.length,
    allResolved: locked.length > 0 && resolved.length === locked.length,
    note: "preview only: locked episodes resolve to a ~15 second signed clip, not the full episode",
    episodes: resolved.map((e) => ({
      chapterId: e.chapterId,
      index: e.index,
      name: e.name,
      free: false,
      source: e.source,
      url: e.url,
      duration: e.duration,
    })),
  };
}

export async function downloadAll({
  bookId,
  lang = "en",
  dir,
  concurrency = 6,
  from,
  to,
  onProgress,
} = {}) {
  const id = String(bookId || "").trim();
  if (!id) throw new Error("bookId required");
  const base = dir || ".";
  mkdirSync(base, { recursive: true });
  const a = await allEpisodes({ bookId: id, lang, concurrency });
  const lo = from === undefined ? 1 : Number(from) || 1;
  const hi = to === undefined ? a.totalEpisodes : Number(to) || a.totalEpisodes;
  const targets = a.episodes.filter((e) => e.ok && e.url && e.index >= lo && e.index <= hi);
  const results = [];
  let cursor = 0;
  const limit = Math.max(1, Math.min(6, Number(concurrency) || 6));
  const worker = async () => {
    while (true) {
      const i = cursor++;
      if (i >= targets.length) return;
      const ep = targets[i];
      const name = `${id}_${String(ep.index).padStart(3, "0")}_${ep.chapterId}.mp4`;
      const dest = `${base}/${name}`;
      try {
        const res = await download({
          url: ep.url,
          out: dest,
          onProgress: onProgress
            ? (p) => onProgress({ index: ep.index, chapterId: ep.chapterId, ...p })
            : undefined,
        });
        results.push({ index: ep.index, chapterId: ep.chapterId, free: ep.free, ok: true, path: dest, bytes: res.bytes });
      } catch (e) {
        results.push({ index: ep.index, chapterId: ep.chapterId, free: ep.free, ok: false, error: e.message });
      }
    }
  };
  await Promise.all(Array.from({ length: limit }, worker));
  results.sort((x, y) => x.index - y.index);
  return {
    bookId: id,
    title: a.title,
    dir: base,
    totalEpisodes: a.totalEpisodes,
    requested: targets.length,
    downloaded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    files: results,
  };
}

export async function download({
  url,
  out,
  onProgress,
  headers = {},
  redirect = 5,
} = {}) {
  const target = String(url || "").trim();
  if (!target) throw new Error("url required");
  const dest = out || basename(splitUrl(target).base) || "video.mp4";
  mkdirSync(dirname(dest) || ".", { recursive: true });
  const fetchInto = (link, hops) =>
    new Promise((resolve, reject) => {
      const u = new URL(link);
      const req = https.request(
        {
          hostname: u.hostname,
          path: u.pathname + u.search,
          method: "GET",
          headers: {
            "user-agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            accept: "*/*",
            ...headers,
          },
          timeout: 60_000,
        },
        async (res) => {
          const status = res.statusCode || 0;
          if (status >= 300 && status < 400 && res.headers.location && hops > 0) {
            res.resume();
            try {
              resolve(await fetchInto(new URL(res.headers.location, link).toString(), hops - 1));
            } catch (e) {
              reject(e);
            }
            return;
          }
          if (status !== 200 && status !== 206) {
            res.resume();
            reject(new Error(`HTTP ${status} ${link}`));
            return;
          }
          const total = Number(res.headers["content-length"] || 0);
          let got = 0;
          res.on("data", (c) => {
            got += c.length;
            if (onProgress) onProgress({ received: got, total, percent: total ? got / total : 0 });
          });
          try {
            await pipeline(res, createWriteStream(dest));
            resolve({
              path: dest,
              status,
              type: res.headers["content-type"] || "",
              bytes: got,
              total,
            });
          } catch (e) {
            reject(e);
          }
        }
      );
      req.on("timeout", () => req.destroy(new Error("timeout " + link)));
      req.on("error", reject);
      req.end();
    });
  return fetchInto(target, redirect);
}

export async function downloadEpisode({
  bookId,
  episode,
  lang = "en",
  out,
  onProgress,
  check = true,
} = {}) {
  const r = await resolveEpisode({ bookId, episode, lang, check });
  if (!r.url) throw new Error("no playable url for episode " + String(episode));
  const dest =
    out ||
    `${r.bookId}_${String(r.index).padStart(3, "0")}_${r.chapterId}.mp4`;
  const res = await download({ url: r.url, out: dest, onProgress });
  return { ...r, ...res };
}

export async function home({ lang = "en" } = {}) {
  const L = loc(lang);
  const pp = await data(L);
  const big = (pp.bigList || []).filter((x) => x && typeof x === "object" && !Array.isArray(x));
  const small = Array.isArray(pp.smallData) ? pp.smallData : [];
  const rows = small.map((row) => ({
    id: row.id || "",
    title: row.name || "",
    style: row.style || "",
    more: row.more || null,
    books: (row.items || row.bookList || row.list || []).map(pickBook),
  }));
  return {
    lang: pp.locale || L,
    rows: rows.filter((r) => r.books.length),
    featured: big.map(pickBook),
  };
}

export async function categories({ lang = "en" } = {}) {
  const b = await browse({ lang, genre: 0, page: 1 });
  return { lang: b.lang, genres: b.genres };
}

export const unlock = previews;

export default {
  browse,
  search,
  detail,
  episodes,
  resolveEpisode,
  allEpisodes,
  stream,
  qualities,
  previews,
  unlock,
  download,
  downloadEpisode,
  downloadAll,
  home,
  categories,
};