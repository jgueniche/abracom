import { describe, expect, it } from "vitest";

import { isTestSchool, pickSchool, schoolsOf } from "@/lib/auth/school-choice";

const neuilly = { id: "neuilly", name: "Abravanel Neuilly", modules: {} };
const levallois = { id: "levallois", name: "Abravanel Levallois", modules: {} };
const test = { id: "test", name: "École test Kesher", modules: { test: true } };

describe("schoolsOf", () => {
  it("lists the schools of the active memberships, each once, in order", () => {
    expect(
      schoolsOf([
        { status: "active", school: neuilly },
        { status: "active", school: neuilly },
        { status: "suspended", school: test },
        { status: "invited", school: levallois },
        { status: "active", school: null },
      ]),
    ).toEqual([neuilly]);
  });
});

describe("pickSchool", () => {
  const rows = [
    { status: "active", school: neuilly },
    { status: "active", school: levallois },
  ];

  it("opens the school asked for when the person belongs to it", () => {
    expect(pickSchool(rows, "levallois")).toBe(levallois);
  });

  it("ignores a school they do not belong to, and falls back on the first", () => {
    expect(pickSchool(rows, "test")).toBe(neuilly);
    expect(pickSchool(rows, undefined)).toBe(neuilly);
  });

  it("opens a real school rather than the test one when nothing was asked", () => {
    const owner = [
      { status: "active", school: test },
      { status: "active", school: neuilly },
    ];
    expect(pickSchool(owner, undefined)).toBe(neuilly);
    expect(pickSchool(owner, "test")).toBe(test);
    expect(pickSchool([{ status: "active", school: test }], undefined)).toBe(test);
  });

  it("never opens a school whose membership is not active", () => {
    expect(pickSchool([...rows, { status: "suspended", school: test }], "test")).toBe(neuilly);
  });

  it("still names the school of someone invited, for the onboarding screen", () => {
    expect(pickSchool([{ status: "invited", school: levallois }], null)).toBe(levallois);
    expect(pickSchool([], null)).toBeNull();
  });
});

describe("isTestSchool", () => {
  it("reads the flag in the modules, and nothing else", () => {
    expect(isTestSchool({ modules: { test: true, messaging: true } })).toBe(true);
    expect(isTestSchool({ modules: { test: false } })).toBe(false);
    expect(isTestSchool({ modules: { test: "true" } })).toBe(false);
    expect(isTestSchool({ modules: [] })).toBe(false);
    expect(isTestSchool({ modules: null })).toBe(false);
    expect(isTestSchool(null)).toBe(false);
  });
});
