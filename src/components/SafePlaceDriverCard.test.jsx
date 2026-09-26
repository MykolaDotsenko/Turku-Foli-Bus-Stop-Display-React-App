import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import SafePlaceDriverCard from "./SafePlaceDriverCard";
import { resetLanguageForTests } from "../i18n";

const originalSpeechSynthesis = Object.getOwnPropertyDescriptor(
  globalThis,
  "speechSynthesis"
);
const originalUtterance = Object.getOwnPropertyDescriptor(
  globalThis,
  "SpeechSynthesisUtterance"
);

afterEach(() => {
  vi.restoreAllMocks();
  resetLanguageForTests("en");

  if (originalSpeechSynthesis) {
    Object.defineProperty(
      globalThis,
      "speechSynthesis",
      originalSpeechSynthesis
    );
  } else {
    delete globalThis.speechSynthesis;
  }

  if (originalUtterance) {
    Object.defineProperty(
      globalThis,
      "SpeechSynthesisUtterance",
      originalUtterance
    );
  } else {
    delete globalThis.SpeechSynthesisUtterance;
  }
});

test("offers Finnish read-aloud help only when browser speech is supported", () => {
  const speak = vi.fn();
  const cancel = vi.fn();

  class FakeUtterance {
    constructor(text) {
      this.text = text;
      this.lang = "";
      this.rate = 1;
    }
  }

  Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
    configurable: true,
    value: FakeUtterance,
  });
  Object.defineProperty(globalThis, "speechSynthesis", {
    configurable: true,
    value: { speak, cancel },
  });

  render(
    <SafePlaceDriverCard
      place={{ id: "home", label: "Home" }}
      primaryStop={{ id: "164", name: "Kauppatori" }}
      onClose={vi.fn()}
    />
  );

  fireEvent.click(
    screen.getByRole("button", { name: "Read aloud in Finnish" })
  );

  expect(cancel).toHaveBeenCalledTimes(1);
  expect(speak).toHaveBeenCalledTimes(1);

  const utterance = speak.mock.calls[0][0];
  expect(utterance.lang).toBe("fi-FI");
  expect(utterance.rate).toBe(0.9);
  expect(utterance.text).toContain("Kauppatori");
  expect(utterance.text).toContain("pysäkki 164");
});

test("does not show a broken read-aloud control when speech is unavailable", () => {
  delete globalThis.speechSynthesis;
  delete globalThis.SpeechSynthesisUtterance;

  render(
    <SafePlaceDriverCard
      place={{ id: "work", label: "Work" }}
      primaryStop={{ id: "32", name: "Puistokatu" }}
      onClose={vi.fn()}
    />
  );

  expect(
    screen.queryByRole("button", { name: "Read aloud in Finnish" })
  ).not.toBeInTheDocument();
});


test("moves focus into the driver card, closes with Escape, and restores focus", () => {
  const onClose = vi.fn();
  const opener = document.createElement("button");
  opener.textContent = "Show to driver";
  document.body.appendChild(opener);
  opener.focus();

  const { unmount } = render(
    <SafePlaceDriverCard
      place={{ id: "home", label: "Home" }}
      primaryStop={{ id: "164", name: "Kauppatori" }}
      onClose={onClose}
    />
  );

  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveFocus();

  fireEvent.keyDown(document, { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(1);

  unmount();
  expect(opener).toHaveFocus();
  opener.remove();
});
// Held up to a driver through the cab window, an inline card with an 18px
// stop name was unreadable, and "I need to get to Home" told the driver
// nothing while telling everyone nearby it was the passenger's home.
test("fills the screen for the driver and leads in Finnish, without naming the place", () => {
  render(
    <SafePlaceDriverCard
      place={{ id: "home", label: "Home" }}
      primaryStop={{ id: "164", name: "Kauppatori" }}
      onClose={vi.fn()}
    />
  );

  const dialog = screen.getByRole("dialog", { name: /Kauppatori/ });
  expect(dialog).toHaveAttribute("aria-modal", "true");
  expect(screen.getByRole("heading", { name: /Kauppatori/ })).toBeInTheDocument();
  expect(screen.getByText("Olen menossa pysäkille")).toHaveAttribute("lang", "fi");
  expect(screen.getByText("Please help me get off at this stop.")).toBeInTheDocument();
  expect(dialog).not.toHaveTextContent(/Home/);
});

test("keeps keyboard focus inside the full-screen card", () => {
  Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
    configurable: true,
    value: class {},
  });
  Object.defineProperty(globalThis, "speechSynthesis", {
    configurable: true,
    value: { speak: vi.fn(), cancel: vi.fn() },
  });

  render(
    <SafePlaceDriverCard
      place={{ id: "home", label: "Home" }}
      primaryStop={{ id: "164", name: "Kauppatori" }}
      onClose={vi.fn()}
    />
  );

  const readAloud = screen.getByRole("button", { name: "Read aloud in Finnish" });
  const close = screen.getByRole("button", { name: "Close" });

  close.focus();
  fireEvent.keyDown(document, { key: "Tab" });
  expect(readAloud).toHaveFocus();

  fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
  expect(close).toHaveFocus();
});

// The driver reads, and hears, the same card whichever language the
// passenger uses the app in. Only the passenger's own controls follow it.
test("shows the driver the same card in both languages, with the passenger's controls in theirs", () => {
  const speak = vi.fn();
  Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
    configurable: true,
    value: class {
      constructor(text) {
        this.text = text;
      }
    },
  });
  Object.defineProperty(globalThis, "speechSynthesis", {
    configurable: true,
    value: { speak, cancel: vi.fn() },
  });

  const driverView = () => {
    const dialog = screen.getByRole("dialog");
    return {
      heading: within(dialog).getByRole("heading").textContent,
      lines: [...dialog.querySelectorAll("[lang]")].map(
        (node) => `${node.getAttribute("lang")}: ${node.textContent}`
      ),
    };
  };
  const renderCard = () =>
    render(
      <SafePlaceDriverCard
        place={{ id: "home", label: "Home" }}
        primaryStop={{ id: "164", name: "Kauppatori" }}
        onClose={vi.fn()}
      />
    );

  const english = renderCard();
  const englishView = driverView();
  fireEvent.click(screen.getByRole("button", { name: "Read aloud in Finnish" }));
  english.unmount();

  resetLanguageForTests("fi");
  renderCard();

  expect(driverView()).toEqual(englishView);
  expect(englishView.lines).toEqual([
    "fi: Olen menossa pysäkille",
    "fi: Kauppatori",
    "fi: Pysäkki",
    "en: Stop 164",
    "fi: Voitteko auttaa minua jäämään pois oikealla pysäkillä?",
    "en: Please help me get off at this stop.",
  ]);

  expect(screen.getByText("Näytä tämä kuljettajalle")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Lue ääneen suomeksi" }));
  expect(screen.getByRole("button", { name: "Sulje" })).toBeInTheDocument();

  const [englishSpeech, finnishSpeech] = speak.mock.calls.map(
    ([utterance]) => utterance.text
  );
  expect(finnishSpeech).toBe(englishSpeech);
  expect(finnishSpeech).toBe(
    "Tarvitsen apua. Olen menossa pysäkille Kauppatori, pysäkki 164. Voitteko auttaa minua jäämään pois oikealla pysäkillä?"
  );
});
