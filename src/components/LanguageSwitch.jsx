import { setLanguage, useLanguage } from "../i18n";

// Each language is offered in its own words, so the way out of a language
// the passenger cannot read is one they can.
const OTHER = {
  en: { code: "fi", label: "Suomeksi" },
  fi: { code: "en", label: "In English" },
};

export default function LanguageSwitch() {
  const language = useLanguage();
  const other = OTHER[language] || OTHER.en;

  return (
    <button
      type="button"
      className="language-switch"
      lang={other.code}
      onClick={() => setLanguage(other.code)}
    >
      {other.label}
    </button>
  );
}
