import { afterEach, expect, test } from "vitest";
import { resetLanguageForTests } from "../i18n";
import { realStopName, stopLabel } from "./stopNames";

afterEach(() => resetLanguageForTests("en"));

test("keeps Föli's own names and drops stand-ins, including stored ones", () => {
  expect(realStopName(" Kauppatori ")).toBe("Kauppatori");
  expect(realStopName("Stop 164")).toBe("");
  expect(realStopName("Pysäkki 164")).toBe("");
  expect(realStopName("")).toBe("");
  expect(realStopName(null)).toBe("");
  // Not a stand-in: a real name that happens to contain a number.
  expect(realStopName("Stop 164 Terminal")).toBe("Stop 164 Terminal");
});

test("calls a nameless stop by its number in the reader's language", () => {
  expect(stopLabel({ id: "164", name: "" })).toBe("Stop 164");
  expect(stopLabel({ id: "164", name: "Stop 164" })).toBe("Stop 164");
  expect(stopLabel(null, "32")).toBe("Stop 32");

  resetLanguageForTests("fi");
  expect(stopLabel({ id: "164", name: "Stop 164" })).toBe("Pysäkki 164");
  expect(stopLabel({ id: "164", name: "Kauppatori" })).toBe("Kauppatori");
});
