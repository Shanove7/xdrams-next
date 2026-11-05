'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';

type UiLanguage = 'id' | 'en';

type Book = {
  bookId: string;
  title: string;
  titleEn?: string;
  cover: string;
  intro?: string;
  chapterCount?: number;
  viewCount?: number;
  genres?: string[];
  tags?: string[];
  author?: string;
  rating?: number | null;
};

type Genre = {
  id: number | string;
  name: string;
};

type Episode = {
  index: number;
  chapterId: string;
  name: string;
  free: boolean;
  cover?: string;
  duration?: number;
};

type Details = {
  book: Book;
  episodes: Episode[];
  totalEpisodes: number;
  freeEpisodes: number;
};

type Player = {
  url: string;
  free: boolean;
  name: string;
  index: number;
};

const SOURCE_LANGUAGES = [
  ['in', 'Bahasa Indonesia'],
  ['en', 'English'],
  ['es', 'Español'],
  ['pt', 'Português'],
  ['th', 'ไทย'],
  ['ar', 'العربية'],
  ['ja', '日本語'],
  ['ko', '한국어'],
  ['fr', 'Français'],
  ['de', 'Deutsch'],
  ['it', 'Italiano'],
] as const;

const COPY = {
  id: {
    navDiscover: 'Jelajahi',
    navGenres: 'Genre',
    navAbout: 'Tentang',
    developer: 'Developer',
    eyebrow: 'TEMUKAN CERITA BERIKUTNYA',
    heroA: 'Cerita yang',
    heroB: 'tinggal di ingatan.',
    intro: 'Jelajahi drama pendek dari berbagai genre. Temukan cerita yang cocok untuk waktumu.',
    search: 'Cari judul drama...',
    searchButton: 'Cari',
    library: 'KATALOG',
    picks: 'Pilihan untukmu',
    sectionIntro: 'Jelajahi kisah yang mungkin jadi favorit berikutnya.',
    reset: 'Kembali ke beranda',
    all: 'Semua',
    loading: 'Memuat cerita...',
    loadError: 'Katalog belum bisa dimuat',
    retry: 'Coba lagi',
    empty: 'Belum ada cerita ditemukan',
    emptyHint: 'Coba kata kunci atau kategori lain.',
    more: 'Muat lebih banyak',
    aboutEyebrow: 'DIBUAT UNTUK PECINTA CERITA',
    aboutA: 'Lebih sedikit gangguan.',
    aboutB: 'Lebih banyak cerita.',
    aboutText: 'X-DRAMS menghadirkan pengalaman menjelajahi drama pendek dengan tampilan yang ringan, fokus, dan nyaman di berbagai perangkat.',
    sourceNote: 'Ketersediaan video mengikuti sumber. Episode gratis dapat menyediakan video penuh; episode terkunci hanya menyediakan preview sekitar 15 detik.',
    details: 'DETAIL DRAMA',
    episodes: 'Daftar episode',
    total: 'total',
    free: 'Gratis',
    full: 'EPISODE PENUH',
    preview: 'PREVIEW ±15 DETIK',
    play: 'Putar',
    playing: 'Memuat...',
    previewNotice: 'Episode ini terkunci di sumber dan hanya tersedia sebagai preview sekitar 15 detik.',
    fullNotice: 'Episode gratis dari sumber. Durasi video mengikuti file yang tersedia.',
    noDescription: 'Belum ada deskripsi untuk drama ini.',
    close: 'Tutup',
    contentLanguage: 'Bahasa katalog',
    interfaceLanguage: 'Bahasa UI',
    languageNote: 'Bahasa katalog mengubah data/judul yang disediakan sumber, bukan audio atau subtitle video.',
    uiLanguage: 'Tampilan',
    share: 'Tempel link DramaBox',
    sharePlaceholder: 'Tempel link share DramaBox untuk membuka drama...',
    openLink: 'Buka',
    invalidLink: 'Link share tidak valid. Pastikan berisi parameter bid.',
    footer: 'RUANG KECIL UNTUK CERITA BESAR.',
    source: 'Data dari DramaBox',
    minSearch: 'Masukkan minimal 2 karakter untuk mencari.',
    videoUnavailable: 'Video belum tersedia.',
    noEpisodes: 'Daftar episode tidak tersedia.',
  },
  en: {
    navDiscover: 'Discover',
    navGenres: 'Genres',
    navAbout: 'About',
    developer: 'Developer',
    eyebrow: 'FIND YOUR NEXT STORY',
    heroA: 'Stories that',
    heroB: 'stay with you.',
    intro: 'Explore short dramas across genres. Find a story that fits your moment.',
    search: 'Search drama titles...',
    searchButton: 'Search',
    library: 'THE LIBRARY',
    picks: 'Picked for you',
    sectionIntro: 'Explore a story that might become your next favourite.',
    reset: 'Back to home',
    all: 'All',
    loading: 'Loading stories...',
    loadError: 'The catalogue could not be loaded',
    retry: 'Try again',
    empty: 'No stories found',
    emptyHint: 'Try another keyword or genre.',
    more: 'Load more',
    aboutEyebrow: 'BUILT FOR STORY LOVERS',
    aboutA: 'Less noise.',
    aboutB: 'More stories.',
    aboutText: 'X-DRAMS makes short-drama discovery feel lightweight, focused, and comfortable on every screen.',
    sourceNote: 'Video availability depends on the source. Free episodes may provide full videos; locked episodes provide previews of around 15 seconds only.',
    details: 'DRAMA DETAILS',
    episodes: 'Episodes',
    total: 'total',
    free: 'Free',
    full: 'FULL EPISODE',
    preview: 'PREVIEW ±15 SEC',
    play: 'Play',
    playing: 'Loading...',
    previewNotice: 'This episode is locked at the source and is available as a preview of around 15 seconds only.',
    fullNotice: 'This is a free episode from the source. Video duration depends on the available file.',
    noDescription: 'No description is available for this drama.',
    close: 'Close',
    contentLanguage: 'Catalogue language',
    interfaceLanguage: 'UI language',
    languageNote: 'Catalogue language changes source-provided data and titles, not the video audio or subtitles.',
    uiLanguage: 'Interface',
    share: 'Paste a DramaBox link',
    sharePlaceholder: 'Paste a DramaBox share link to open a drama...',
    openLink: 'Open',
    invalidLink: 'Invalid share link. Make sure it contains a bid parameter.',
    footer: 'A LITTLE SPACE FOR BIG STORIES.',
    source: 'Data from DramaBox',
    minSearch: 'Enter at least 2 characters to search.',
    videoUnavailable: 'Video is not available yet.',
    noEpisodes: 'Episode list is not available.',
  },
} as const;

async function api<T>(
  action: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const url = new URL(`/api/${action}`, window.location.origin);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });

  const controller = new AbortController();

  const timer = window.setTimeout(
    () => controller.abort(),
    28_000,
  );

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
      cache: 'no-store',
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload.success) {
      throw new Error(payload.error || 'Request failed.');
    }

    return payload.data as T;
  } finally {
    window.clearTimeout(timer);
  }
}

function Cover({
  book,
  large = false,
}: {
  book: Book;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={`cover ${large ? 'cover-large' : ''}`}>
      {!failed && book.cover ? (
        <img
          src={book.cover}
          alt={book.title || 'Drama poster'}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="cover-fallback">
          <span>✳</span>
          <small>X-DRAMS</small>
        </div>
      )}

      <span className="cover-shade" />
    </div>
  );
}

function BookCard({
  book,
  onOpen,
  language,
}: {
  book: Book;
  onOpen: (book: Book) => void;
  language: UiLanguage;
}) {
  return (
    <button
      className="book-card"
      onClick={() => onOpen(book)}
      aria-label={`${language === 'id' ? 'Lihat detail' : 'View details'} ${book.title}`}
    >
      <Cover book={book} />

      <div className="card-copy">
        <strong>{book.title || 'Untitled story'}</strong>

        <span>
          {book.chapterCount || 0}{' '}
          {language === 'id' ? 'episode' : 'episodes'}
          {' · '}
          {language === 'id' ? 'Drama pendek' : 'Short drama'}
        </span>
      </div>
    </button>
  );
}

export default function Explorer() {
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>('id');
  const [sourceLanguage, setSourceLanguage] = useState('in');

  const t = COPY[uiLanguage];

  const [books, setBooks] = useState<Book[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);

  const [activeGenre, setActiveGenre] = useState('0');

  // FIX: Gunakan string agar section bisa menerima hasil pencarian dinamis.
  const [section, setSection] = useState<string>(t.picks);

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selected, setSelected] = useState<Details | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);

  const [busyEpisode, setBusyEpisode] = useState<number | null>(null);
  const [toast, setToast] = useState('');

  const [mode, setMode] = useState<'home' | 'browse' | 'search'>('home');

  const [shareLink, setShareLink] = useState('');
  const [openingShare, setOpeningShare] = useState(false);

  const [accountPhone, setAccountPhone] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  const notify = useCallback((message: string) => {
    setToast(message);

    window.setTimeout(() => {
      setToast('');
    }, 3200);
  }, []);

  const loadHome = useCallback(
    async (lang = sourceLanguage) => {
      setLoading(true);
      setError('');
      setMode('home');
      setActiveGenre('0');
      setPage(1);

      try {
        const data = await api<any>('home', { lang });

        const list: Book[] = [
          ...(data.featured || []),
          ...(data.rows || []).flatMap(
            (row: any) => row.books || [],
          ),
        ];

        const seen = new Set<string>();

        setBooks(
          list
            .filter(book => {
              if (!book.bookId || seen.has(book.bookId)) {
                return false;
              }

              seen.add(book.bookId);
              return true;
            })
            .slice(0, 30),
        );

        setSection(COPY[uiLanguage].picks);
        setTotalPages(1);
      } catch (reason: any) {
        setError(reason?.message || 'Unable to load.');
        setBooks([]);
      } finally {
        setLoading(false);
      }
    },
    [sourceLanguage, uiLanguage],
  );

  const loadGenres = useCallback(
    async (lang = sourceLanguage) => {
      try {
        const data = await api<{ genres: Genre[] }>(
          'categories',
          { lang },
        );

        setGenres(data.genres || []);
      } catch {
        setGenres([]);
      }
    },
    [sourceLanguage],
  );

  const loadBrowse = useCallback(
    async (
      genre: string,
      pageNo = 1,
      append = false,
      lang = sourceLanguage,
    ) => {
      setLoading(true);
      setError('');
      setMode('browse');
      setActiveGenre(genre);
      setPage(pageNo);

      try {
        const data = await api<any>('browse', {
          genre,
          page: pageNo,
          lang,
        });

        setBooks(old =>
          append
            ? [...old, ...(data.books || [])]
            : data.books || [],
        );

        setSection(data.genreName || COPY[uiLanguage].picks);

        setTotalPages(Number(data.totalPages) || 1);
      } catch (reason: any) {
        setError(reason?.message || 'Unable to load.');

        if (!append) {
          setBooks([]);
        }
      } finally {
        setLoading(false);
      }
    },
    [sourceLanguage, uiLanguage],
  );

  const runSearch = useCallback(
    async (term = query, lang = sourceLanguage) => {
      const clean = term.trim();

      if (clean.length < 2) {
        notify(COPY[uiLanguage].minSearch);
        return;
      }

      setLoading(true);
      setError('');
      setMode('search');
      setPage(1);

      try {
        const data = await api<any>('search', {
          q: clean,
          page: 1,
          lang,
        });

        setBooks(data.books || []);

        // FIX: section sudah bertipe string.
        setSection(
          `${uiLanguage === 'id' ? 'Hasil untuk' : 'Results for'} “${clean}”`,
        );

        setTotalPages(Number(data.totalPages) || 1);
      } catch (reason: any) {
        setError(reason?.message || 'Unable to search.');
        setBooks([]);
      } finally {
        setLoading(false);
      }
    },
    [query, sourceLanguage, uiLanguage, notify],
  );

  useEffect(() => {
    fetch('/api/auth/session', {
      cache: 'no-store',
    })
      .then(response => response.json())
      .then(data => {
        if (data?.authenticated && data.user?.phone) {
          setAccountPhone(data.user.phone);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const savedUi = window.localStorage.getItem(
      'xdrams-ui-language',
    );

    const savedSource = window.localStorage.getItem(
      'xdrams-source-language',
    );

    if (savedUi === 'id' || savedUi === 'en') {
      setUiLanguage(savedUi);
    }

    if (
      savedSource &&
      SOURCE_LANGUAGES.some(([code]) => code === savedSource)
    ) {
      setSourceLanguage(savedSource);
    }
  }, []);

  useEffect(() => {
    loadHome(sourceLanguage);
    loadGenres(sourceLanguage);
  }, [sourceLanguage]);

  useEffect(() => {
    window.localStorage.setItem(
      'xdrams-ui-language',
      uiLanguage,
    );
  }, [uiLanguage]);

  useEffect(() => {
    window.localStorage.setItem(
      'xdrams-source-language',
      sourceLanguage,
    );
  }, [sourceLanguage]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelected(null);
        setPlayer(null);
      }
    };

    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const openBook = async (book: Book) => {
    try {
      const data = await api<Details>('detail', {
        id: book.bookId,
        lang: sourceLanguage,
      });

      setSelected(data);
      setPlayer(null);
    } catch (reason: any) {
      notify(reason?.message || 'Unable to load details.');
    }
  };

  const playEpisode = async (episode: Episode) => {
    if (!selected) return;

    setBusyEpisode(episode.index);

    try {
      const data = await api<any>('stream', {
        id: selected.book.bookId,
        episode: episode.index,
        lang: sourceLanguage,
      });

      if (!data.url) {
        throw new Error(t.videoUnavailable);
      }

      setPlayer({
        url: data.url,
        free: !!data.free,
        name: episode.name || `Episode ${episode.index}`,
        index: episode.index,
      });
    } catch (reason: any) {
      notify(reason?.message || t.videoUnavailable);
    } finally {
      setBusyEpisode(null);
    }
  };

  const openShareLink = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setOpeningShare(true);

    try {
      const parsed = new URL(shareLink.trim());

      const bookId = parsed.searchParams.get('bid');
      const episodeId = parsed.searchParams.get('cid');
      const sharedLang = parsed.searchParams.get('lan');

      if (!bookId || !/^\d{5,20}$/.test(bookId)) {
        throw new Error(t.invalidLink);
      }

      const selectedLang =
        sharedLang &&
        SOURCE_LANGUAGES.some(([code]) => code === sharedLang)
          ? sharedLang
          : sourceLanguage;

      if (selectedLang !== sourceLanguage) {
        setSourceLanguage(selectedLang);
      }

      const data = await api<Details>('detail', {
        id: bookId,
        lang: selectedLang,
      });

      setSelected(data);
      setPlayer(null);

      if (episodeId) {
        const episode = data.episodes.find(
          item => item.chapterId === episodeId,
        );

        if (episode) {
          const streamData = await api<any>('stream', {
            id: bookId,
            episode: episode.index,
            lang: selectedLang,
          });

          if (streamData.url) {
            setPlayer({
              url: streamData.url,
              free: !!streamData.free,
              name:
                episode.name ||
                `Episode ${episode.index}`,
              index: episode.index,
            });
          }
        }
      }
    } catch (reason: any) {
      notify(reason?.message || t.invalidLink);
    } finally {
      setOpeningShare(false);
    }
  };

  const logout = async () => {
    setLoggingOut(true);

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });

      setAccountPhone('');
      notify('Kamu sudah keluar.');
    } catch {
      notify('Gagal keluar. Coba lagi.');
    } finally {
      setLoggingOut(false);
    }
  };

  const visibleGenres = useMemo(
    () => genres.slice(0, 16),
    [genres],
  );

  const closeModal = () => {
    setSelected(null);
    setPlayer(null);
  };

  const changeSourceLanguage = (value: string) => {
    setSourceLanguage(value);
    setSelected(null);
    setPlayer(null);
  };

  return (
    <main>
      <header className="topbar">
        <a
          className="brand"
          href="#top"
          onClick={event => {
            event.preventDefault();
            loadHome();
          }}
        >
          <span className="brand-mark">X</span>
          <span>X-DRAMS</span>
        </a>

        <nav>
          <a href="#discover">{t.navDiscover}</a>
          <a href="#genres">{t.navGenres}</a>
          <a href="#about">{t.navAbout}</a>
        </nav>

        <div className="top-actions">
          <label
            className="select-wrap"
            title={t.interfaceLanguage}
          >
            <span>UI</span>

            <select
              aria-label={t.interfaceLanguage}
              value={uiLanguage}
              onChange={event =>
                setUiLanguage(event.target.value as UiLanguage)
              }
            >
              <option value="id">ID</option>
              <option value="en">EN</option>
            </select>
          </label>

          {accountPhone ? (
            <button
              className="login-cta"
              onClick={logout}
              disabled={loggingOut}
            >
              {loggingOut ? '...' : 'Keluar'}
            </button>
          ) : (
            <a className="login-cta" href="/login">
              Masuk <span>↗</span>
            </a>
          )}

          <a
            className="top-cta"
            href="https://instagram.com/Khasan27"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.developer} <span>↗</span>
          </a>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-glow" />

        <div className="hero-content">
          <div className="eyebrow">
            <span className="live-dot" />
            {t.eyebrow}
          </div>

          <h1>
            {t.heroA}
            <br />
            <em>{t.heroB}</em>
          </h1>

          <p>{t.intro}</p>

          <form
            className="searchbar"
            onSubmit={event => {
              event.preventDefault();
              runSearch();
            }}
          >
            <span className="search-icon">⌕</span>

            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={t.search}
              aria-label={t.search}
            />

            <button type="submit" disabled={loading}>
              {t.searchButton} <span>→</span>
            </button>
          </form>

          <form
            className="share-form"
            onSubmit={openShareLink}
          >
            <input
              value={shareLink}
              onChange={event =>
                setShareLink(event.target.value)
              }
              placeholder={t.sharePlaceholder}
              aria-label={t.sharePlaceholder}
            />

            <button
              type="submit"
              disabled={openingShare || !shareLink.trim()}
            >
              {openingShare ? '...' : t.openLink}
            </button>
          </form>

          <div className="hero-foot">
            <span>CURATED FOR YOUR NEXT BINGE</span>
            <span>SCROLL TO EXPLORE ↓</span>
          </div>
        </div>

        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="art-core">
            <span>X</span>
          </div>
          <div className="art-label">
            A WORLD OF
            <br />
            SHORT STORIES
          </div>
          <div className="art-number">01 — ∞</div>
        </div>
      </section>

      <section
        className="discover section-wrap"
        id="discover"
      >
        <div className="section-heading">
          <div>
            <div className="eyebrow">{t.library}</div>
            <h2>
              {section}
              <span>.</span>
            </h2>
            <p>{t.sectionIntro}</p>
          </div>

          <button
            className="text-button"
            onClick={() => loadHome()}
          >
            {t.reset} <span>↗</span>
          </button>
        </div>

        <div className="catalog-tools">
          <div className="genre-row" id="genres">
            <button
              className={
                activeGenre === '0' && mode === 'browse'
                  ? 'genre active'
                  : 'genre'
              }
              onClick={() => loadBrowse('0')}
            >
              {t.all}
            </button>

            {visibleGenres.map(genre => (
              <button
                key={String(genre.id)}
                className={
                  activeGenre === String(genre.id) &&
                  mode === 'browse'
                    ? 'genre active'
                    : 'genre'
                }
                onClick={() =>
                  loadBrowse(String(genre.id))
                }
              >
                {genre.name}
              </button>
            ))}
          </div>

          <label className="content-language">
            <span>{t.contentLanguage}</span>

            <select
              value={sourceLanguage}
              onChange={event =>
                changeSourceLanguage(event.target.value)
              }
            >
              {SOURCE_LANGUAGES.map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="language-note">
          ⓘ {t.languageNote}
        </p>

        {error && (
          <div className="state-box error-box">
            <strong>{t.loadError}</strong>
            <span>{error}</span>

            <button
              onClick={() =>
                mode === 'home'
                  ? loadHome()
                  : mode === 'search'
                    ? runSearch()
                    : loadBrowse(activeGenre)
              }
            >
              {t.retry}
            </button>
          </div>
        )}

        {loading && (
          <div className="loading-state">
            <span className="spinner" />
            {t.loading}
          </div>
        )}

        {!loading && !error && books.length === 0 && (
          <div className="state-box">
            <strong>{t.empty}</strong>
            <span>{t.emptyHint}</span>
          </div>
        )}

        <div className="book-grid">
          {books.map((book, index) => (
            <BookCard
              key={`${book.bookId}-${index}`}
              book={book}
              onOpen={openBook}
              language={uiLanguage}
            />
          ))}
        </div>

        {!loading &&
          mode === 'browse' &&
          page < totalPages && (
            <button
              className="load-more"
              onClick={() =>
                loadBrowse(activeGenre, page + 1, true)
              }
            >
              {t.more} <span>↓</span>
            </button>
          )}
      </section>

      <section
        className="about section-wrap"
        id="about"
      >
        <div className="about-line" />

        <div>
          <div className="eyebrow">{t.aboutEyebrow}</div>

          <h2>
            {t.aboutA}
            <br />
            <em>{t.aboutB}</em>
          </h2>
        </div>

        <div className="about-copy">
          <p>{t.aboutText}</p>
          <p className="disclaimer">{t.sourceNote}</p>
        </div>
      </section>

      <footer>
        <a className="brand" href="#top">
          <span className="brand-mark">X</span>
          <span>X-DRAMS</span>
        </a>

        <span className="footer-center">
          {t.footer}
        </span>

        <a
          className="dev-link"
          href="https://instagram.com/Khasan27"
          target="_blank"
          rel="noopener noreferrer"
        >
          DEV · @Khasan27 ↗
        </a>

        <span className="copyright">
          © {new Date().getFullYear()} X-DRAMS · {t.source}
        </span>
      </footer>

      {selected && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <section
            className="detail-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t.details}
          >
            <button
              className="modal-close"
              onClick={closeModal}
              aria-label={t.close}
            >
              ×
            </button>

            <div className="detail-top">
              <Cover book={selected.book} large />

              <div className="detail-info">
                <div className="eyebrow">{t.details}</div>

                <h2>{selected.book.title}</h2>

                <p>
                  {selected.book.intro || t.noDescription}
                </p>

                <div className="detail-stats">
                  <span>
                    <b>{selected.totalEpisodes || 0}</b>{' '}
                    {t.episodes}
                  </span>

                  <span>
                    <b>{selected.freeEpisodes || 0}</b>{' '}
                    {t.free}
                  </span>
                </div>

                <div className="tag-list">
                  {(selected.book.genres || [])
                    .slice(0, 5)
                    .map(tag => (
                      <span key={tag}>{tag}</span>
                    ))}
                </div>
              </div>
            </div>

            {player && (
              <div className="player-panel">
                <div className="player-title">
                  <strong>{player.name}</strong>

                  <span
                    className={
                      player.free
                        ? 'free-pill'
                        : 'preview-pill'
                    }
                  >
                    {player.free ? t.full : t.preview}
                  </span>
                </div>

                <video
                  key={player.url}
                  src={player.url}
                  controls
                  playsInline
                  preload="metadata"
                  className="video-player"
                >
                  {uiLanguage === 'id'
                    ? 'Browser tidak mendukung pemutar video.'
                    : 'Your browser does not support video playback.'}
                </video>

                <p className="player-note">
                  {player.free
                    ? t.fullNotice
                    : t.previewNotice}
                </p>
              </div>
            )}

            <div className="episode-heading">
              <div>
                <div className="eyebrow">
                  CONTINUE THE STORY
                </div>

                <h3>{t.episodes}</h3>
              </div>

              <span>
                {selected.totalEpisodes} {t.total}
              </span>
            </div>

            {selected.episodes?.length ? (
              <div className="episode-grid">
                {selected.episodes.map(episode => (
                  <button
                    key={episode.chapterId}
                    className={`episode-btn ${
                      player?.index === episode.index
                        ? 'episode-active'
                        : ''
                    }`}
                    onClick={() => playEpisode(episode)}
                    disabled={
                      busyEpisode === episode.index
                    }
                  >
                    <span className="episode-number">
                      {String(episode.index).padStart(2, '0')}
                    </span>

                    <span className="episode-name">
                      {busyEpisode === episode.index
                        ? t.playing
                        : episode.name ||
                          `${t.episodes} ${episode.index}`}
                    </span>

                    <span
                      className={
                        episode.free
                          ? 'episode-status free-pill'
                          : 'episode-status preview-pill'
                      }
                    >
                      {episode.free ? t.free : 'Preview'}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="state-box">
                <span>{t.noEpisodes}</span>
              </div>
            )}
          </section>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </main>
  );
}
