import { describe, expect, it } from 'vitest';
import { REF, findFile, readBuffer } from '../../../tests/files';
import { defaultSubjects, renameAutonomy } from '../../model/subjects';
import { readHwpx } from '../hwpx/readHwpx';
import { readPlanAdjust } from './planAdjustHwpx';

const subjects = renameAutonomy(defaultSubjects, '신명똑디');
const file = findFile(REF, '시수 증가');

describe.skipIf(!file)('PLAN 시수증감 hwpx (작업지시서 7.3)', () => {
  const load = async () => readPlanAdjust(await readHwpx(readBuffer(file!)), subjects);

  it('표1 숫자', async () => {
    const r = await load();
    expect(r.warnings).toEqual([]);
    expect(r.standard).toEqual({ kor: 204, soc: 102, mor: 34, math: 136, sci: 102, prac: 68, pe: 102, music: 68, art: 68, eng: 102 });
    expect(r.annual).toEqual({ kor: 192, autonomy: 32, soc: 96, mor: 32, math: 140, sci: 98, prac: 64, pe: 102, music: 68, art: 68, eng: 102 });
    expect(r.diff).toEqual({ kor: -12, autonomy: 32, soc: -6, mor: -2, math: 4, sci: -4, prac: -4, pe: 0, music: 0, art: 0, eng: 0 });
    expect(r.creative).toEqual({ standard: 102, school: 98, diff: -4 });
    expect(r.total).toEqual({ standard: 1088, school: 1092, diff: 4 });
  });

  it('표2 36행: 문서 안 표 3개를 이어 붙이고, 교과별 시수 합 = 증감', async () => {
    const r = await load();
    expect(r.adjustments).toHaveLength(36);
    const sum = (ids: string[]) => r.adjustments.filter((a) => ids.includes(a.subjectId)).reduce((s, a) => s + a.hours, 0);
    for (const id of ['kor', 'soc', 'mor', 'math', 'sci', 'prac', 'pe', 'music', 'art', 'eng']) expect(sum([id])).toBe(r.diff[id]);
    expect(sum(['ca-self', 'ca-club', 'ca-career'])).toBe(r.creative.diff);
    expect(r.adjustments.some((a) => a.subjectId === 'autonomy')).toBe(false); // 신명똑디 +32는 표1에만
    expect(r.adjustments.every((a) => Math.abs(a.hours) === 1)).toBe(true);
  });

  it('성취기준 코드·창체 병합 칸·학기', async () => {
    const r = (await load()).adjustments;
    expect(r[0]).toMatchObject({ semester: 1, subjectId: 'kor', area: '읽기', standards: ['6국02-05'], hours: -1 });
    expect(r[0].unit).toContain('<독서>');
    const ca = r.filter((a) => a.subjectId.startsWith('ca-'));
    expect(ca).toHaveLength(4);
    expect(ca.every((a) => a.standards.length === 0 && a.unit === '' && a.content.length > 0)).toBe(true);
    expect(new Set(r.map((a) => a.id)).size).toBe(36);
  });
});
