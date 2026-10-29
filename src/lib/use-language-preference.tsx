"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  asLocale,
  DEFAULT_LOCALE,
  getLocale,
  isLocale,
  LOCALE_COOKIE_NAME,
  setLocale,
  type Locale,
} from "@/lib/game/i18n";

// =====================================================================
// [Bilingual Harbor: the captain's language] The client half of the
// language pack. The readers (./game/i18n) answer in whichever language
// the process holds; this file is where a captain's pick is read,
// remembered and applied, and it is three pieces:
//
//   * the pick itself, stored under one localStorage key the way the
//     colorblind preference beside it is (see ./use-color-preference):
//     read once on mount, written on change, no server round trip for
//     the captain's own screen.
//
//   * a readable cookie (pm_locale) kept in step with the pick, because
//     the realtime layer composes some captain facing lines on the
//     server and the socket that carries them reads the cookie at the
//     handshake. It is not a second setting, only the same one written
//     where the other end of the connection can read it.
//
//   * the provider every screen sits under, so the switch reaches the
//     trees that are on screen when the pick is made rather than only
//     the next one that renders.
//
// The module reader is written first in setLanguage on purpose: text
// composed outside React (a ledger line between renders, a value read
// back from storage) has to answer in the new language the moment the
// pick is made, and the state write after it is what redraws the
// screens.
// =====================================================================

// The key the pick is stored under. Named rather than implied, the same
// reading the colorblind key beside it takes. The cookie the server
// reads is named next to the language pair itself (LOCALE_COOKIE_NAME in
// @/lib/game/i18n), because the handshake reader on the other end of the
// connection spells it too.
const LANGUAGE_KEY = "portmasters_language";

// A year, in the seconds a cookie counts in. The pick is a taste rather
// than a session fact, so it outlives the tab by as much as a cookie can.
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** The pick on the readable cookie, for a browser that kept it but not storage. */
function readCookieLocale(): Locale | null {
  try {
    const match = document.cookie.match(
      new RegExp("(?:^|; )" + LOCALE_COOKIE_NAME + "=([^;]*)"),
    );
    if (!match) return null;
    return asLocale(decodeURIComponent(match[1]));
  } catch {
    // A hand edited cookie that will not decode names no language.
    return null;
  }
}

/** The captain's stored pick, or the shipped language where none is stored. */
function readStoredLocale(): Locale {
  try {
    const stored = asLocale(localStorage.getItem(LANGUAGE_KEY));
    if (stored) return stored;
  } catch {
    // Private browsing or a disabled storage API: the cookie below stands.
  }
  // The cookie is the same pick written where the server can read it (see
  // storeLocale). Reading it back here covers the browser that kept the
  // cookie and lost storage, which is otherwise the one case where the
  // server composes Mandarin lines for a screen printing English.
  return readCookieLocale() ?? DEFAULT_LOCALE;
}

/**
 * Apply a pick everywhere it has to hold: the process reader, the stored
 * key, and the cookie the server reads.
 *
 * The one write, so the three copies cannot disagree about what the
 * captain chose. The storage failures are swallowed for the reason the
 * colorblind write swallows them: the in memory reader above still
 * applies for the rest of the session even when nothing persists.
 */
function storeLocale(locale: Locale): void {
  setLocale(locale);
  try {
    localStorage.setItem(LANGUAGE_KEY, locale);
  } catch {
    // Best effort only.
  }
  try {
    document.cookie = `${LOCALE_COOKIE_NAME}=${locale};path=/;max-age=${COOKIE_MAX_AGE};samesite=lax`;
  } catch {
    // Best effort only.
  }
}

type LanguageSetting = {
  locale: Locale;
  setLanguage: (next: Locale) => void;
};

const LanguageContext = createContext<LanguageSetting | null>(null);

/**
 * The reading for a render outside the provider.
 *
 * One object rather than a new one per call, so a consumer that reads it
 * is not handed a fresh identity every time it renders, and the language
 * it carries is read live rather than captured, so a screen mounted
 * without the provider still prints in the language the process holds.
 */
const OUTSIDE_PROVIDER: LanguageSetting = {
  get locale() {
    return getLocale();
  },
  setLanguage: storeLocale,
};

/**
 * The captain's language, and the write that changes it.
 *
 * Read through the context so every screen under the provider redraws
 * the moment the pick is made; the fallback reading is for a render
 * outside the provider (a check, a storybook style isolated mount),
 * which still prints the right language but has no tree above it to
 * redraw.
 */
export function useLanguage(): LanguageSetting {
  const context = useContext(LanguageContext);
  if (context) return context;
  return OUTSIDE_PROVIDER;
}

/**
 * The one place the pick is held in state and read back on mount.
 *
 * Mounted once, by the root providers; every consumer below shares this
 * state rather than reading storage of its own, so a second screen
 * cannot hold a second opinion about the language.
 */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getLocale());

  useEffect(() => {
    const stored = readStoredLocale();
    if (stored === getLocale()) return;
    // Deferred so this isn't a synchronous setState call inside the
    // effect body (react-hooks/set-state-in-effect), the same pattern
    // the colorblind preference beside it uses.
    storeLocale(stored);
    Promise.resolve().then(() => setLocaleState(stored));
  }, []);

  // The document's own language follows the pick the moment it is made,
  // the same attribute the root layout writes from the cookie on a fresh
  // load (see src/app/layout.tsx). Without this, a captain who flips the
  // pick with the tab open leaves the page declaring English to a screen
  // reader and to the browser's own font fallback until the next reload.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLanguage = useCallback((next: Locale) => {
    if (!isLocale(next)) return;
    storeLocale(next);
    setLocaleState(next);
  }, []);

  // The value is one object for as long as the language and the write
  // are the same, so the screens that read it redraw when the pick
  // changes rather than every time this provider renders for any other
  // reason.
  const setting = useMemo<LanguageSetting>(
    () => ({ locale, setLanguage }),
    [locale, setLanguage],
  );

  return (
    <LanguageContext.Provider value={setting}>
      {children}
    </LanguageContext.Provider>
  );
}
