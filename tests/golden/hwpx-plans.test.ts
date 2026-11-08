import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { planAdjustHwpx } from '../../src/export/planAdjustHwpx';
import { timePlanHwpx } from '../../src/export/timePlanHwpx';
import { readHwpx } from '../../src/import/hwpx/readHwpx';
import { readPlanAdjust } from '../../src/import/mappers/planAdjustHwpx';
import { readTimePlan, type TimePlanTable } from '../../src/import/mappers/timePlanHwpx';
import { need2026, project2026 } from './project2026';

const read = (name: string) => JSON.parse(new TextDecoder().decode(readFileSync(`fixtures/2026-g6/expected/${name}`)));
const tpl = (name: string): ArrayBuffer | undefined => { try { const b = readFileSync(`templates/${name}.hwpx`); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; } catch { return undefined; } };
const timeplan = tpl('timeplan');
const progress = tpl('progress');

describe.skipIf(!need2026 || !timeplan)('시간 운영계획 hwpx = (c)', () => {
  for (const sem of [1, 2] as const) {
    it(`${sem}학기: 주별 칸 글자·학기 계가 (c)와 같다(빈칸=0, 비고는 차이만 보고)`, async () => {
      const p = await project2026();
      const out = await timePlanHwpx(p, sem, timeplan!);
      const back = readTimePlan(await readHwpx(out), p.subjects);
      expect(back.warnings).toEqual([]);
      expect(back.tables).toHaveLength(1);
      const got = back.tables[0];
      const want: TimePlanTable = read('week-grid.json')[sem - 1];
      expect(got.semester).toBe(sem);
      expect(got.rows).toHaveLength(want.rows.length);
      let noteDiff = 0;
      want.rows.forEach((w, i) => {
        const g = got.rows[i];
        expect([sem, g.week, g.period, g.month, g.schoolDays, g.dayPeriods, g.hours]).toEqual([sem, w.week, w.period, w.month, w.schoolDays, w.dayPeriods, w.hours]);
        if (g.note !== w.note) noteDiff++;
      });
      console.log(`${sem}학기 비고가 (c)와 다른 주 ${noteDiff}/${want.rows.length} (예외 11: 입력 파일에 없는 행사 포함)`);
      expect(got.semesterTotal).toEqual(want.semesterTotal);
      if (sem === 2) for (const k of ['annual', 'plan', 'diff'] as const) expect([k, got[k]]).toEqual([k, want[k]]);
    });
  }

  it('월 묶음 글자 `3[21]`·0시간 `⋅`, 학기 계 아래 줄이 (c)와 같은 꼴', async () => {
    const p = await project2026();
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(await timePlanHwpx(p, 2, timeplan!));
    const xml = await zip.file('Contents/section0.xml')!.async('string');
    expect(xml).toContain('<hp:t>9[20]</hp:t>');
    expect(xml).toContain('<hp:t>⋅</hp:t>'); // 2학기 신명똑디 0시간
    expect(xml).toContain('<hp:t>연간 계</hp:t>');
    expect(Object.keys(zip.files).some((n) => n.endsWith('/'))).toBe(false);
  });
});

describe.skipIf(!need2026 || !progress)('시수증감 운영계획 hwpx = PLAN', () => {
  it('표1 숫자와 표2 36행이 PLAN과 같다', async () => {
    const p = await project2026();
    const back = readPlanAdjust(await readHwpx(await planAdjustHwpx(p, progress!)), p.subjects);
    const want = read('plan-adjust.json');
    expect(back.warnings).toEqual([]);
    for (const k of ['standard', 'annual', 'diff', 'creative', 'total']) expect([k, (back as never)[k]]).toEqual([k, want[k]]);
    expect(back.adjustments).toHaveLength(36);
    const strip = (a: { semester: number; subjectId: string; area: string; standards: string[]; unit: string; content: string; hours: number }) =>
      ({ semester: a.semester, subjectId: a.subjectId, area: a.area.replace(/\s+/g, ' '), standards: a.standards, unit: a.unit, content: a.content, hours: a.hours });
    expect(back.adjustments.map(strip)).toEqual(want.adjustments.map(strip));
  });
});
