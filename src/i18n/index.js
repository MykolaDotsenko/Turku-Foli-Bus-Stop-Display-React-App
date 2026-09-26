// The interface speaks the passenger's language: Finnish when the phone asks
// for it, English otherwise, and whichever the passenger picks from then on.
// Stop and destination names are never translated. They are what the stop
// pole and the bus sign say, in every language.
//
// The English text is the key, so the code reads as the screen does and a
// phrase missing from a dictionary falls back to English instead of breaking.
// A dictionary entry is either a template ("Stop {id}") or, where word forms
// follow a number, a function of the same parameters.
import { useSyncExternalStore } from "react";
import fi from "./fi";

export const LANGUAGES = Object.freeze(["en", "fi"]);

const DICTIONARIES = { en: {}, fi };
const STORAGE_KEY = "foli-language-v1";

function browserLanguages() {
  const nav = globalThis.navigator;
  if (!nav) return [];
  return Array.isArray(nav.languages) && nav.languages.length > 0
    ? nav.languages
    : [nav.language];
}

// The first language the phone lists that the app speaks.
export function preferredLanguage(languages = browserLanguages()) {
  for (const tag of languages) {
    const primary = String(tag || "").toLowerCase().split("-")[0];
    if (LANGUAGES.includes(primary)) return primary;
  }
  return "en";
}

function storedLanguage() {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    return LANGUAGES.includes(stored) ? stored : null;
  } catch {
    // Blocked storage: the phone's own language still applies.
    return null;
  }
}

function applyToDocument(language) {
  // Screen readers pick their voice from this, and the browser its
  // hyphenation and quotes.
  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.lang = language;
  }
}

let current = storedLanguage() || preferredLanguage();
const listeners = new Set();
applyToDocument(current);

export function getLanguage() {
  return current;
}

function switchTo(language) {
  current = language;
  applyToDocument(language);
  listeners.forEach((listener) => listener());
}

export function setLanguage(language) {
  if (!LANGUAGES.includes(language) || language === current) return;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, language);
  } catch {
    // Still switches for this visit.
  }
  switchTo(language);
}

// Tests start every case from the same place, without touching storage.
export function resetLanguageForTests(language = "en") {
  switchTo(LANGUAGES.includes(language) ? language : "en");
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Re-renders the calling component when the language changes.
export function useLanguage() {
  return useSyncExternalStore(subscribe, getLanguage, getLanguage);
}

// Marks a phrase for translation where it is defined, in a table built
// before any language is known; t() translates it where it is shown.
export function msg(key) {
  return key;
}

function render(template, params) {
  if (typeof template === "function") return template(params ?? {});
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.hasOwn(params, name) ? String(params[name]) : match
  );
}

export function t(key, params) {
  return render(DICTIONARIES[current]?.[key] ?? key, params);
}

// Where one English phrase carries two meanings ("Due" heads the time column
// and is also what a bus due now says), a context keeps the translations
// apart. The dictionary holds it as "context|phrase"; English shows the
// phrase alone.
export function tc(context, key, params) {
  return render(DICTIONARIES[current]?.[`${context}|${key}`] ?? key, params);
}

// Dates and numbers follow the language; the transit clock does not (see
// TRANSIT_CLOCK_LOCALE in utils/time.js).
export function intlLocale(language = current) {
  return language === "fi" ? "fi-FI" : "en-GB";
}

// Which of Föli's own texts to show: its notices and destination names come
// in Finnish, with Swedish and English translations. In the Finnish
// interface that is the Finnish original, never a translation the phone
// happens to list next. In English the phone's own languages come first (a
// Swedish phone keeps Föli's Swedish), then English, but never Finnish,
// which the passenger has just chosen not to read.
export function providerLanguages(language = current) {
  if (language === "fi") return ["fi"];
  return [
    ...browserLanguages().filter(
      (tag) => tag && !/^fi\b/i.test(String(tag))
    ),
    "en",
  ];
}
