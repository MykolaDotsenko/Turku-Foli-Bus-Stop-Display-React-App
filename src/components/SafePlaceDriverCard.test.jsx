import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import SafePlaceDriverCard from "./SafePlaceDriverCard";

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
