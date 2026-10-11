import { expect, it } from "vitest";
import { defaults, type CigaretteLog } from "./domain";
import { currentGoal } from "./goals";
import { milestones, patterns } from "./progress";
const log: CigaretteLog = {
  id: "one",
  variantId: "red",
  brand: "Test",
  variant: "Red",
  quantity: 2,
  smokedAt: "2026-10-11T02:00:00Z",
  priceSnapshot: 12,
  trigger: "Stress",
  mood: "",
  location: "",
  notes: "",
  revision: 1,
  updatedAt: "2026-10-11T02:00:00Z",
  deletedAt: null,
};
it("never awards achievements just for cigarette consumption or missing days", () => {
  expect(
    milestones([log], [], defaults, "2026-10-11").some((row) => row.unlocked),
  ).toBe(false);
});
it("recalculates smoke-free milestones after historical entries change", () => {
  const checkins = ["2026-10-09", "2026-10-10", "2026-10-11"].map((date) => ({
    date,
    confirmedCount: 0,
    completedAt: `${date}T12:00:00Z`,
  }));
  expect(
    milestones([], checkins, defaults, "2026-10-11").find(
      (row) => row.id === "free3",
    )?.unlocked,
  ).toBe(true);
  expect(
    milestones([log], checkins, defaults, "2026-10-11").find(
      (row) => row.id === "free3",
    )?.unlocked,
  ).toBe(false);
});
it("uses local timezone hours and only confirmed days in baseline comparisons", () => {
  const checkins = [
    {
      date: "2026-10-11",
      confirmedCount: 2,
      completedAt: "2026-10-11T12:00:00Z",
    },
  ];
  const result = patterns(
    [log],
    checkins,
    {
      ...defaults,
      baseline: 10,
      price: 12,
      goalHistory: [
        currentGoal(
          { ...defaults, baseline: 10 },
          new Date("2026-10-11T00:00:00Z"),
        ),
      ],
    },
    "2026-10-11",
    7,
  );
  expect(result.hours[10]).toBe(2);
  expect(result.completed).toBe(1);
  expect(result.estimatedDifference).toBe(96);
  expect(
    patterns([log], [], defaults, "2026-10-11", 7).estimatedDifference,
  ).toBeNull();
});
