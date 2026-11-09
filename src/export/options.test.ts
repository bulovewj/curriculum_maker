import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { weekGrid } from '../engine/weekGrid';
import { newProject } from '../model/newProject';
import type { Adjustment, CalendarDay } from '../model/types';
import { fillTemplate } from './hwpx/package';
import { adjustRowsOf } from './planAdjustHwpx';

const adj = (id: string, hours: number, content = '합치기'): Adjustment => ({ id, semester: 1, subjectId: 'kor', area: '읽기', standards: [`S${id}`], unit: 'U1', content, hours, planRowIds: [] });

describe('출력 설정(GPT 검토 17번)', () => {
  it('증감표 묶기: 기본은 그대로, merged면 같은 단원·내용·부호끼리 시수를 더한다', () => {
    const p0 = newProject('x', 2027);
    const p = { ...p0, adjustments: [adj('a', -1), adj('b', -1), adj('c', 1), adj('d', -1, '다른 내용')] };
    expect(adjustRowsOf(p)).toHaveLength(4);
    const m = adjustRowsOf({ ...p, settings: { ...p.settings, adjustRows: 'merged' } });
    expect(m.map((a) => `${a.content}${a.hours}`)).toEqual(['합치기-2', '합치기1', '다른 내용-1']);
    expect(m[0].standards).toEqual(['Sa', 'Sb']);
  });

  it('비고에 넣기로 한 행사가 그 주 비고에 붙는다', () => {
    const day = (date: string, weekday: 1 | 2 | 3 | 4 | 5): CalendarDay => ({ date, weekday, semester: 1, schoolDay: true, periods: 6, notes: [] });
    const cal = [day('2027-03-02', 2), day('2027-03-03', 3)];
    const sems = [{ no: 1 as const, start: '2027-03-02', end: '2027-07-20' }, { no: 2 as const, start: '2027-08-20', end: '2028-02-28' }];
    const ev = (show: boolean) => [{ id: 'e', name: '수학여행', start: '2027-03-02', end: '2027-03-03', showInPlanNote: show, source: 'user' as const }];
    expect(weekGrid(cal, [], sems, 'weekStart', [], ev(true))[0].note).toBe('3.2.~3.3. 수학여행');
    expect(weekGrid(cal, [], sems, 'weekStart', [], ev(false))[0].note).toBe('');
  });

  it('글자 크기 비율: 양식의 글자 크기를 모두 그 비율로', async () => {
    const tpl = readFileSync('templates/timeplan.hwpx');
    const out = await fillTemplate(new Uint8Array(tpl).buffer as ArrayBuffer, [], 90);
    const head = await (await JSZip.loadAsync(out)).file('Contents/header.xml')!.async('string');
    expect(head).toContain('<hh:charPr id="0" height="900"');
    expect(head).toContain('<hh:charPr id="3" height="630"');
  });
});
