/**
 * Calcolo del bollo trimestrale sulle fatture elettroniche (D.M. 17/6/2014 art. 6;
 * soglia 5.000 € del D.L. 73/2022 art. 3). Logica pura, senza dipendenze, usata
 * dal calcolatore pubblico /calcolatore-bollo. Riferimento OKF:
 * docs/okf/domain/scadenze-fiscali.md.
 */

export const BOLLO_IMPORTO = 2;
export const BOLLO_SOGLIA_FATTURA = 77.47;
export const BOLLO_SOGLIA_CUMULO = 5000;

export type Quarter = 1 | 2 | 3 | 4;

export const CODICI_TRIBUTO: Record<Quarter, string> = { 1: "2521", 2: "2522", 3: "2523", 4: "2524" };

/** Festività nazionali italiane a data fissa (mese 1-12, giorno). */
const FIXED_HOLIDAYS: [number, number][] = [
  [1, 1],
  [1, 6],
  [4, 25],
  [5, 1],
  [6, 2],
  [8, 15],
  [11, 1],
  [12, 8],
  [12, 25],
  [12, 26],
];

/** Lunedì dell'Angelo (Pasqua + 1) con l'algoritmo di Meeus. */
function easterMonday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day + 1));
}

export function isHoliday(d: Date): boolean {
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  if (FIXED_HOLIDAYS.some(([hm, hd]) => hm === m && hd === day)) return true;
  const em = easterMonday(d.getUTCFullYear());
  return em.getUTCMonth() === d.getUTCMonth() && em.getUTCDate() === day;
}

/** Primo giorno lavorativo (lun–ven, non festivo) uguale o successivo. */
export function nextBusinessDay(d: Date): Date {
  const out = new Date(d.getTime());
  while (out.getUTCDay() === 0 || out.getUTCDay() === 6 || isHoliday(out)) {
    out.setUTCDate(out.getUTCDate() + 1);
  }
  return out;
}

function utc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

/** Ultimo giorno di febbraio dell'anno indicato. */
function endOfFebruary(year: number): Date {
  return new Date(Date.UTC(year, 2, 0));
}

export type QuarterDeadline = {
  quarter: Quarter;
  /** Scadenza ordinaria di versamento (prima dello slittamento). */
  nominal: Date;
  /** Scadenza effettiva, slittata al primo giorno lavorativo. */
  effective: Date;
  /** Termine per correggere l'elenco B. */
  elencoB: Date;
  codiceTributo: string;
};

/** Scadenze di versamento del bollo per i quattro trimestri dell'anno d'imposta `year`. */
export function quarterDeadlines(year: number): QuarterDeadline[] {
  const q: Array<[Quarter, Date, Date]> = [
    [1, utc(year, 5, 31), utc(year, 4, 30)],
    [2, utc(year, 9, 30), utc(year, 9, 10)],
    [3, utc(year, 11, 30), utc(year, 10, 31)],
    [4, endOfFebruary(year + 1), utc(year + 1, 1, 31)],
  ];
  return q.map(([quarter, nominal, elencoB]) => ({
    quarter,
    nominal,
    effective: nextBusinessDay(nominal),
    elencoB: nextBusinessDay(elencoB),
    codiceTributo: CODICI_TRIBUTO[quarter],
  }));
}

export type BolloPlanItem = {
  quarter: Quarter;
  /** Imposta maturata nel trimestre. */
  due: number;
  /** Trimestre in cui viene effettivamente versata (può essere successivo per la regola dei 5.000 €). */
  payWith: Quarter;
  deadline: QuarterDeadline;
};

export type BolloPlan = {
  items: BolloPlanItem[];
  /** Versamenti aggregati per scadenza effettiva. */
  payments: { quarter: Quarter; amount: number; covers: Quarter[]; deadline: QuarterDeadline }[];
  total: number;
};

/**
 * Piano di versamento dato il numero di fatture con bollo per trimestre.
 * Regola dei 5.000 €: Q1 ≤ 5.000 → si versa con Q2; Q1+Q2 ≤ 5.000 → si versa con Q3.
 * Q4 ha sempre la sua scadenza. Si applica il rinvio massimo consentito.
 */
export function bolloPlan(year: number, invoicesPerQuarter: Record<Quarter, number>): BolloPlan {
  const deadlines = quarterDeadlines(year);
  const due = (q: Quarter) => Math.max(0, Math.floor(invoicesPerQuarter[q] || 0)) * BOLLO_IMPORTO;
  const d1 = due(1);
  const d2 = due(2);
  const d3 = due(3);
  const d4 = due(4);

  let pay1: Quarter = 1;
  let pay2: Quarter = 2;
  if (d1 <= BOLLO_SOGLIA_CUMULO) pay1 = 2;
  if (d1 + d2 <= BOLLO_SOGLIA_CUMULO) {
    pay1 = 3;
    pay2 = 3;
  }

  const items: BolloPlanItem[] = [
    { quarter: 1, due: d1, payWith: pay1, deadline: deadlines[pay1 - 1] },
    { quarter: 2, due: d2, payWith: pay2, deadline: deadlines[pay2 - 1] },
    { quarter: 3, due: d3, payWith: 3, deadline: deadlines[2] },
    { quarter: 4, due: d4, payWith: 4, deadline: deadlines[3] },
  ];

  const payments: BolloPlan["payments"] = [];
  for (const q of [1, 2, 3, 4] as Quarter[]) {
    const covered = items.filter((i) => i.payWith === q && i.due > 0);
    if (!covered.length) continue;
    payments.push({
      quarter: q,
      amount: covered.reduce((s, i) => s + i.due, 0),
      covers: covered.map((i) => i.quarter),
      deadline: deadlines[q - 1],
    });
  }

  return { items, payments, total: d1 + d2 + d3 + d4 };
}

const DATE_FMT = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const SHORT_FMT = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function formatDeadline(d: Date): string {
  return DATE_FMT.format(d);
}

export function formatShort(d: Date): string {
  return SHORT_FMT.format(d);
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
