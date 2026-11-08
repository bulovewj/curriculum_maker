import { describe, expect, it } from 'vitest';
import { REF, findFile, readBuffer } from '../../../tests/files';
import { defaultSubjects, renameAutonomy } from '../../model/subjects';
import { readHwpx } from '../hwpx/readHwpx';
import { readCurriculum } from './curriculumHwpx';

const subjects = renameAutonomy(defaultSubjects, '신명똑디');
const file = findFile(REF, '학사일정 및 교육과정편제');

describe.skipIf(!file)('CUR 학년군 편제 (2026 6학년)', () => {
  const load = async (year = 2026, grade = 6) => readCurriculum(await readHwpx(readBuffer(file!)), subjects, year, grade);

  it('작년 5학년(2025): 교과별 값과 합 1,092', async () => {
    const r = await load();
    expect(r.warnings).toEqual([]);
    expect(r.priorYear).toEqual({
      year: 2025, grade: 5,
      school: { kor: 202, soc: 106, mor: 34, math: 138, sci: 102, prac: 68, pe: 102, music: 68, art: 68, eng: 102 },
      creativeTotal: 102, total: 1092,
    });
  });

  it('올해 6학년(2026, 안): 수학 139·합 1,091', async () => {
    const r = await load();
    expect(r.school).toEqual({ kor: 192, autonomy: 32, soc: 96, mor: 32, math: 139, sci: 98, prac: 64, pe: 102, music: 68, art: 68, eng: 102 });
    expect(r.standard).toEqual({ kor: 204, soc: 102, mor: 34, math: 136, sci: 102, prac: 68, pe: 102, music: 68, art: 68, eng: 102 });
    expect(r.creative).toEqual({ standard: 102, school: 98 });
    expect(r.total).toEqual({ standard: 1088, school: 1091 });
  });

  it('창체 영역: 자율·자치 72, 동아리 18, 진로 8', async () => {
    const r = await load();
    expect(r.creativeAreas).toMatchObject({ '자율·자치활동': 72, '동아리활동': 18, '진로활동': 8, 계: 98 });
  });

  it('없는 학년·학년도는 알아듣게 오류', async () => {
    await expect(load(2031, 6)).rejects.toThrow('머리글을 찾지 못했습니다');
  });
});
