import { describe, expect, it } from "vitest";
import { bolloPlan, nextBusinessDay, quarterDeadlines, toIsoDate } from "../src/bolloTrimestrale";

describe("bolloTrimestrale", () => {
  it("slitta le scadenze che cadono nel weekend o in festivi", () => {
    const d2026 = quarterDeadlines(2026);
    expect(toIsoDate(d2026[0].effective)).toBe("2026-06-01"); // 31/5/2026 è domenica
    expect(toIsoDate(d2026[1].effective)).toBe("2026-09-30");
    expect(toIsoDate(d2026[2].effective)).toBe("2026-11-30");
    expect(toIsoDate(d2026[3].effective)).toBe("2027-03-01"); // 28/2/2027 è domenica
    const d2025 = quarterDeadlines(2025);
    expect(toIsoDate(d2025[3].effective)).toBe("2026-03-02"); // 28/2/2026 è sabato
    expect(toIsoDate(d2026[1].elencoB)).toBe("2026-09-10");
  });

  it("riconosce il Lunedì dell'Angelo", () => {
    // Pasqua 2026: 5 aprile → Pasquetta 6 aprile
    expect(toIsoDate(nextBusinessDay(new Date(Date.UTC(2026, 3, 6))))).toBe("2026-04-07");
  });

  it("applica la regola dei 5.000 €: poche fatture → tutto al 30 novembre + febbraio", () => {
    const plan = bolloPlan(2026, { 1: 10, 2: 12, 3: 8, 4: 15 });
    expect(plan.total).toBe(90);
    expect(plan.payments.map((p) => [p.quarter, p.amount, p.covers])).toEqual([
      [3, 60, [1, 2, 3]],
      [4, 30, [4]],
    ]);
    expect(toIsoDate(plan.payments[0].deadline.effective)).toBe("2026-11-30");
    expect(plan.payments[0].deadline.codiceTributo).toBe("2523");
  });

  it("sopra 5.000 € nel primo trimestre si paga a maggio", () => {
    const plan = bolloPlan(2026, { 1: 2600, 2: 1, 3: 0, 4: 0 });
    expect(plan.items[0].payWith).toBe(1);
    expect(plan.items[1].payWith).toBe(2);
    expect(plan.payments[0]).toMatchObject({ quarter: 1, amount: 5200 });
  });

  it("Q1 sotto soglia ma Q1+Q2 sopra: Q1 si versa con Q2", () => {
    const plan = bolloPlan(2026, { 1: 2000, 2: 1000, 3: 0, 4: 0 });
    expect(plan.items[0].payWith).toBe(2);
    expect(plan.payments[0]).toMatchObject({ quarter: 2, amount: 6000, covers: [1, 2] });
  });

  it("ignora trimestri a zero nei versamenti", () => {
    const plan = bolloPlan(2027, { 1: 0, 2: 0, 3: 0, 4: 3 });
    expect(plan.payments).toHaveLength(1);
    expect(toIsoDate(plan.payments[0].deadline.effective)).toBe("2028-02-29");
  });
});
