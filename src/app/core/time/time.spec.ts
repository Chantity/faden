import { describe, expect, it } from 'vitest';
import { createList, createTask, type Task, type TodoList } from '../model';
import {
  earliestNextTask,
  estimateSums,
  formatBytes,
  formatDayLabel,
  formatDuration,
  formatPlannedRange,
  isValidHhMm,
  minutesToHhMm,
  parseHhMm,
  planBounds,
  plannedBounds,
  proposeTimes,
  referenceRelation,
  shiftPlan,
  sortPlannedFirst,
  stretchPlan,
  timeStatus,
  transferDayTimesToList,
  validateDayTimes,
  modeSwitchOffer,
  withTimeboxMode,
} from './index';

function task(partial: Partial<Task> & { id: string; title: string }): Task {
  return { done: false, ...partial };
}

function dayPlanList(tasks: Task[], referenceDate?: string): TodoList {
  const list = createList('Plan', 'dayPlan');
  list.tasks = tasks;
  if (referenceDate) list.dayPlanReferenceDate = referenceDate;
  return list;
}

function scheduleList(tasks: Task[]): TodoList {
  const list = createList('Plan', 'schedule');
  list.tasks = tasks;
  return list;
}

const TODAY = new Date(2026, 2, 12, 10, 0, 0); // 12.03.2026, 10:00

describe('formatDuration', () => {
  it('formatiert Minuten, Stunden und Mischformen', () => {
    expect(formatDuration(25)).toBe('25 Min');
    expect(formatDuration(60)).toBe('1 Std');
    expect(formatDuration(85)).toBe('1 Std 25 Min');
    expect(formatDuration(0)).toBe('0 Min');
  });

  it('formatiert englisch', () => {
    expect(formatDuration(25, 'en')).toBe('25 min');
    expect(formatDuration(60, 'en')).toBe('1 h');
    expect(formatDuration(85, 'en')).toBe('1 h 25 min');
  });
});

describe('parseHhMm / minutesToHhMm / isValidHhMm', () => {
  it('liest und schreibt Uhrzeiten', () => {
    expect(parseHhMm('09:05')).toBe(545);
    expect(parseHhMm('9:05')).toBe(545);
    expect(parseHhMm('24:00')).toBeNull();
    expect(parseHhMm('12:60')).toBeNull();
    expect(parseHhMm(undefined)).toBeNull();
    expect(isValidHhMm('23:59')).toBe(true);
    expect(minutesToHhMm(545)).toBe('09:05');
    expect(minutesToHhMm(1500)).toBe('01:00');
  });
});

describe('formatDayLabel', () => {
  it('liefert Wochentag und Datum', () => {
    expect(formatDayLabel(new Date(2026, 2, 12))).toBe('Do. 12.03.');
  });

  it('liefert englisches Format', () => {
    expect(formatDayLabel(new Date(2026, 2, 12), 'en')).toBe('Thu 12 Mar');
  });
});

describe('validateDayTimes', () => {
  it('erlaubt Start + Dauer bis höchstens 24:00', () => {
    expect(validateDayTimes('09:00', 60).ok).toBe(true);
    expect(validateDayTimes('09:00', undefined).ok).toBe(true);
    expect(validateDayTimes(undefined, undefined).ok).toBe(true);
    expect(validateDayTimes('23:00', 60).ok).toBe(true);
    expect(validateDayTimes('23:30', 60)).toEqual({ ok: false, message: 'order' });
    expect(validateDayTimes('25:00', 10)).toEqual({ ok: false, message: 'invalid' });
  });
});

describe('estimateSums', () => {
  it('summiert offen, gesamt und erledigt', () => {
    const list = createList('L', 'estimate');
    list.tasks = [
      task({ id: 'a', title: 'A', estimateMinutes: 30 }),
      task({ id: 'b', title: 'B', estimateMinutes: 45, done: true }),
      task({ id: 'c', title: 'C' }),
    ];
    expect(estimateSums(list)).toEqual({
      openMinutes: 30,
      totalMinutes: 75,
      doneMinutes: 45,
      openWithoutEstimate: 1,
    });
  });
});

describe('timeStatus – schedule', () => {
  const list = scheduleList([
    task({ id: 'run', title: 'Läuft', startAt: '2026-03-12T09:30', estimateMinutes: 60 }),
    task({ id: 'late', title: 'Verpasst', startAt: '2026-03-12T08:00', estimateMinutes: 60 }),
    task({ id: 'next', title: 'Später', startAt: '2026-03-12T11:00', estimateMinutes: 60 }),
    task({ id: 'done', title: 'Erledigt', startAt: '2026-03-12T08:00', done: true }),
  ]);

  it('leitet Läuft/Nicht abgehakt/Als Nächstes ab', () => {
    expect(timeStatus(list, list.tasks[0]!, TODAY)).toBe('running');
    expect(timeStatus(list, list.tasks[1]!, TODAY)).toBe('late');
    expect(timeStatus(list, list.tasks[2]!, TODAY)).toBe('next');
    expect(timeStatus(list, list.tasks[3]!, TODAY)).toBeUndefined();
  });

  it('Grenzfälle: genau Start = läuft, genau Ende = nicht abgehakt', () => {
    const startAt = new Date(2026, 2, 12, 10, 0);
    const atStart = scheduleList([
      task({ id: 'x', title: 'X', startAt: '2026-03-12T10:00', estimateMinutes: 60 }),
    ]);
    expect(timeStatus(atStart, atStart.tasks[0]!, startAt)).toBe('running');

    const atEnd = scheduleList([
      task({ id: 'y', title: 'Y', startAt: '2026-03-12T09:00', estimateMinutes: 60 }),
    ]);
    expect(timeStatus(atEnd, atEnd.tasks[0]!, startAt)).toBe('late');
  });

  it('über Mitternacht', () => {
    const now = new Date(2026, 2, 13, 0, 30); // nach Mitternacht
    const list2 = scheduleList([
      task({ id: 'n', title: 'Nacht', startAt: '2026-03-12T23:00', estimateMinutes: 120 }),
    ]);
    expect(timeStatus(list2, list2.tasks[0]!, now)).toBe('running');
  });

  it('ermittelt das früheste „Als Nächstes"', () => {
    const list3 = scheduleList([
      task({ id: 'a', title: 'A', startAt: '2026-03-12T13:00', estimateMinutes: 60 }),
      task({ id: 'b', title: 'B', startAt: '2026-03-12T11:30', estimateMinutes: 30 }),
    ]);
    expect(earliestNextTask(list3, TODAY)?.id).toBe('b');
  });

  it('sortiert Läuft vor Nicht abgehakt vor Als Nächstes', () => {
    const sorted = sortPlannedFirst(list, [...list.tasks], TODAY);
    const ids = sorted.map((t) => t.id);
    expect(ids.slice(0, 3)).toEqual(['run', 'late', 'next']);
  });
});

describe('timeStatus – dayPlan', () => {
  it('Bezugstag heute: normale Ableitung', () => {
    const list = dayPlanList(
      [
        task({ id: 'r', title: 'Läuft', dayStart: '09:30', estimateMinutes: 60 }),
        task({ id: 'l', title: 'Verpasst', dayStart: '08:00', estimateMinutes: 60 }),
        task({ id: 'n', title: 'Später', dayStart: '11:00', estimateMinutes: 60 }),
      ],
      '2026-03-12',
    );
    expect(timeStatus(list, list.tasks[0]!, TODAY)).toBe('running');
    expect(timeStatus(list, list.tasks[1]!, TODAY)).toBe('late');
    expect(timeStatus(list, list.tasks[2]!, TODAY)).toBe('next');
    expect(referenceRelation(list, TODAY)).toBe('today');
  });

  it('Bezugstag in der Vergangenheit: alles offen = nicht abgehakt', () => {
    const list = dayPlanList(
      [task({ id: 'a', title: 'A', dayStart: '09:00', estimateMinutes: 60 })],
      '2026-03-10',
    );
    expect(referenceRelation(list, TODAY)).toBe('past');
    expect(timeStatus(list, list.tasks[0]!, TODAY)).toBe('late');
  });

  it('Bezugstag in der Zukunft: geplant', () => {
    const list = dayPlanList(
      [task({ id: 'a', title: 'A', dayStart: '09:00', estimateMinutes: 60 })],
      '2026-03-20',
    );
    expect(referenceRelation(list, TODAY)).toBe('future');
    expect(timeStatus(list, list.tasks[0]!, TODAY)).toBe('planned');
  });

  it('ohne Zeiten kein Status', () => {
    const list = dayPlanList([task({ id: 'a', title: 'A' })], '2026-03-12');
    expect(timeStatus(list, list.tasks[0]!, TODAY)).toBeUndefined();
  });

  it('formatPlannedRange zeigt die Spanne', () => {
    const list = dayPlanList(
      [task({ id: 'a', title: 'A', dayStart: '13:00', estimateMinutes: 30 })],
      '2026-03-12',
    );
    expect(formatPlannedRange(list, list.tasks[0]!)).toBe('13:00–13:30');
  });
});

describe('shiftPlan', () => {
  it('verschiebt schedule-Zeiten um einen Tag', () => {
    const list = scheduleList([
      task({ id: 'a', title: 'A', startAt: '2026-03-12T09:00', estimateMinutes: 60 }),
    ]);
    const shifted = shiftPlan(list, 24 * 60 * 60_000);
    expect(shifted.tasks[0]!.startAt).toBe('2026-03-13T09:00');
    expect(shifted.tasks[0]!.estimateMinutes).toBe(60);
  });

  it('verschiebt dayPlan-Zeiten um Minuten', () => {
    const list = dayPlanList(
      [task({ id: 'a', title: 'A', dayStart: '09:00', estimateMinutes: 60 })],
      '2026-03-12',
    );
    const shifted = shiftPlan(list, 30 * 60_000);
    expect(shifted.tasks[0]!.dayStart).toBe('09:30');
    expect(shifted.tasks[0]!.estimateMinutes).toBe(60);
  });
});

describe('stretchPlan', () => {
  it('bildet proportional auf den neuen Zeitraum ab (5-Minuten-Rundung)', () => {
    const list = scheduleList([
      task({ id: 'a', title: 'A', startAt: '2026-03-12T08:00', estimateMinutes: 60 }),
      task({ id: 'b', title: 'B', startAt: '2026-03-12T09:00', estimateMinutes: 60 }),
    ]);
    const stretched = stretchPlan(list, {
      oldStart: '2026-03-12T08:00',
      oldEnd: '2026-03-12T10:00',
      newStart: '2026-03-12T08:00',
      newEnd: '2026-03-12T12:00',
    });
    expect(stretched.tasks[0]!.startAt).toBe('2026-03-12T08:00');
    expect(stretched.tasks[0]!.estimateMinutes).toBe(120);
    expect(stretched.tasks[1]!.startAt).toBe('2026-03-12T10:00');
    expect(stretched.tasks[1]!.estimateMinutes).toBe(120);
  });

  it('lässt den Plan unverändert, wenn der alte Zeitraum leer ist', () => {
    const list = scheduleList([
      task({ id: 'a', title: 'A', startAt: '2026-03-12T08:00', estimateMinutes: 60 }),
    ]);
    const out = stretchPlan(list, {
      oldStart: '2026-03-12T08:00',
      oldEnd: '2026-03-12T08:00',
      newStart: '2026-03-12T08:00',
      newEnd: '2026-03-12T12:00',
    });
    expect(out.tasks[0]!.startAt).toBe('2026-03-12T08:00');
  });
});

describe('planBounds', () => {
  it('liefert frühesten Start und spätestes Ende', () => {
    const list = scheduleList([
      task({ id: 'a', title: 'A', startAt: '2026-03-12T09:00', estimateMinutes: 60 }),
      task({ id: 'b', title: 'B', startAt: '2026-03-12T08:00', estimateMinutes: 180 }),
    ]);
    expect(planBounds(list)).toEqual({ start: '2026-03-12T08:00', end: '2026-03-12T11:00' });
  });
});

describe('transferDayTimesToList', () => {
  it('überträgt Tageszeiten auf ein Datum', () => {
    const list = dayPlanList(
      [task({ id: 'a', title: 'A', dayStart: '09:00', estimateMinutes: 60 })],
      '2026-03-12',
    );
    const schedule = transferDayTimesToList(list, '2026-03-15');
    expect(schedule.tasks[0]!.startAt).toBe('2026-03-15T09:00');
    expect(schedule.tasks[0]!.estimateMinutes).toBe(60);
    // Tageszeiten bleiben erhalten.
    expect(schedule.tasks[0]!.dayStart).toBe('09:00');
  });
});

describe('proposeTimes', () => {
  it('legt ToDos nacheinander ab und nutzt 15 Min Standard', () => {
    const list = createList('L', 'schedule');
    list.tasks = [
      task({ id: 'a', title: 'A', estimateMinutes: 30 }),
      task({ id: 'b', title: 'B' }),
    ];
    const out = proposeTimes(list, { startAt: '2026-03-12T09:00' }, ['a', 'b']);
    expect(out.tasks[0]!.startAt).toBe('2026-03-12T09:00');
    expect(out.tasks[0]!.estimateMinutes).toBe(30);
    expect(out.tasks[1]!.startAt).toBe('2026-03-12T09:30');
    expect(out.tasks[1]!.estimateMinutes).toBe(15);
  });
});

describe('plannedBounds', () => {
  it('kombiniert Tageszeit mit dem Bezugstag', () => {
    const list = dayPlanList(
      [task({ id: 'a', title: 'A', dayStart: '09:00', estimateMinutes: 60 })],
      '2026-03-12',
    );
    expect(plannedBounds(list, list.tasks[0]!)).toEqual({
      start: '2026-03-12T09:00',
      end: '2026-03-12T10:00',
    });
  });
});

describe('withTimeboxMode (Bezugstag)', () => {
  const NOW = new Date(2026, 2, 12, 9, 30);

  it('setzt beim Aktivieren des Tagesplans heute als Bezugstag', () => {
    const list = withTimeboxMode(createList('Plan'), 'dayPlan', NOW);
    expect(list.timeboxMode).toBe('dayPlan');
    expect(list.dayPlanReferenceDate).toBe('2026-03-12');
  });

  it('macht damit Zeitstatus im neuen Tagesplan sofort wirksam', () => {
    const list = withTimeboxMode(createList('Plan'), 'dayPlan', NOW);
    list.tasks = [task({ id: 'a', title: 'A', dayStart: '09:00', estimateMinutes: 60 })];
    expect(timeStatus(list, list.tasks[0]!, NOW)).toBe('running');
  });

  it('lässt einen vorhandenen Bezugstag unverändert, solange der Modus bleibt', () => {
    const list = { ...createList('Plan', 'dayPlan'), dayPlanReferenceDate: '2026-03-01' };
    expect(withTimeboxMode(list, 'dayPlan', NOW)).toBe(list);
  });

  it('setzt den Bezugstag neu, wenn der Tagesplan erneut aktiviert wird', () => {
    const list = { ...createList('Plan', 'estimate'), dayPlanReferenceDate: '2026-03-01' };
    expect(withTimeboxMode(list, 'dayPlan', NOW).dayPlanReferenceDate).toBe('2026-03-12');
  });

  it('behält Zeitfelder und Bezugstag beim Wechsel in andere Modi', () => {
    const list = { ...createList('Plan', 'dayPlan'), dayPlanReferenceDate: '2026-03-01' };
    list.tasks = [task({ id: 'a', title: 'A', dayStart: '09:00', estimateMinutes: 15 })];
    const switched = withTimeboxMode(list, 'schedule', NOW);
    expect(switched.timeboxMode).toBe('schedule');
    expect(switched.dayPlanReferenceDate).toBe('2026-03-01');
    expect(switched.tasks).toBe(list.tasks);
  });
});

describe('modeSwitchOffer', () => {
  it('bietet beim Wechsel Tagesplan → fester Zeitplan das Übertragen an', () => {
    const list = createList('Plan', 'dayPlan');
    list.tasks = [task({ id: 'a', title: 'A', dayStart: '09:00' })];
    expect(modeSwitchOffer(list, 'schedule')).toBe('convert');
  });

  it('bietet nichts an, wenn es keine Tageszeiten gibt', () => {
    const list = createList('Plan', 'dayPlan');
    list.tasks = [task({ id: 'a', title: 'A' })];
    expect(modeSwitchOffer(list, 'schedule')).toBeNull();
  });

  it('gibt beim Wechsel fester Zeitplan → Tagesplan nur einen Hinweis', () => {
    const list = createList('Plan', 'schedule');
    list.tasks = [task({ id: 'a', title: 'A', startAt: '2026-03-12T09:00' })];
    expect(modeSwitchOffer(list, 'dayPlan')).toBe('scheduleKept');
    expect(modeSwitchOffer(list, 'estimate')).toBeNull();
  });
});

describe('formatBytes', () => {
  it('formatiert Bytes lesbar und lokalisiert', () => {
    expect(formatBytes(512, 'en')).toBe('512 B');
    expect(formatBytes(1536, 'de')).toBe('1,5 KB');
    expect(formatBytes(1536, 'en')).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 ** 3, 'en')).toBe('5 GB');
    expect(formatBytes(300 * 1024 ** 2, 'en')).toBe('300 MB');
  });
});
