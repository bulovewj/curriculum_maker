import { describe, expect, it } from 'vitest';
import { ORIGINAL, REF, EXTRACTED, findFile, listFiles, readBuffer } from '../../tests/files';
import { NOTICES, detectFile } from './detect';

const kind = async (path: string) => (await detectFile(path.split('/').pop()!, readBuffer(path))).kind;
const bytes = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;

describe('판별: 안내가 필요한 파일', () => {
  it('hwp·pdf·깨진 파일·다른 형식', async () => {
    expect(await detectFile('a.hwp', bytes('x'))).toEqual({ kind: 'unknown', notice: NOTICES.hwp });
    expect(await detectFile('a.PDF', bytes('x'))).toEqual({ kind: 'unknown', notice: NOTICES.pdf });
    expect(await detectFile('a.xlsx', bytes('깨짐'))).toEqual({ kind: 'unknown', notice: NOTICES.broken });
    expect(await detectFile('a.hwpx', bytes('깨짐'))).toEqual({ kind: 'unknown', notice: NOTICES.broken });
    expect((await detectFile('a.docx', bytes('x'))).notice).toBe(NOTICES.other);
  });
  it('자모 분리형 확장자·이름도 같다', async () => {
    expect((await detectFile('진도.hwp'.normalize('NFD'), bytes('x'))).notice).toBe(NOTICES.hwp);
  });
});

const have = findFile(ORIGINAL, '행사 및 일정') && findFile(REF, '시수 증가');
describe.skipIf(!have)('판별: 작업지시서 7.1 입력 파일', () => {
  const cases: [string, string, string][] = [
    [ORIGINAL, '행사 및 일정', 'scheduleP04'],
    [ORIGINAL, '전담 및 학급', 'timetableP02'],
    [ORIGINAL, '시간 운영계획', 'timePlanHwpx'],
    [ORIGINAL, '1학기 교과진도', 'progressHwpx'],
    [ORIGINAL, '2학기 교과진도', 'progressHwpx'],
    [ORIGINAL, '학교자율시간', 'autonomyHwpx'],
    [REF, '시수 증가', 'planAdjustHwpx'],
    [REF, '학사일정 및 교육과정편제', 'curriculumHwpx'],
    [REF, '과학(강) 6-1', 'publisherLessons'],
    [REF, '과학(강) 6-2', 'publisherLessons'],
    [REF, '사회(설) 6-1', 'publisherLessons'],
    [REF, '사회(설) 6-2', 'publisherLessons'],
    [EXTRACTED, '2학기_국어_진도표', 'neisLessons'],
  ];
  for (const [dir, key, want] of cases) {
    it.skipIf(!findFile(dir, key))(`${key} → ${want}`, async () => {
      expect(await kind(findFile(dir, key)!)).toBe(want);
    });
  }
  it('1학기 NEIS 진도 11개 → neisLessons', async () => {
    const dir = findFile(REF, '6학년 1학기 진도표')!;
    const kinds = await Promise.all(listFiles(dir, '.xlsx').map(kind));
    expect(kinds).toEqual(Array(11).fill('neisLessons'));
  });
  it('자율시간 hwpx는 안내가 붙는다', async () => {
    const f = findFile(ORIGINAL, '학교자율시간')!;
    expect((await detectFile('a.hwpx', readBuffer(f))).notice).toBe(NOTICES.autonomy);
  });
});
