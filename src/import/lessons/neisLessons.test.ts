import { describe, expect, it } from 'vitest';
import { defaultSubjects, renameAutonomy } from '../../model/subjects';
import { EXTRACTED, REF, findFile, listFiles, readBuffer } from '../../../tests/files';
import { readWorkbook } from '../xlsx/readWorkbook';
import { expandLessonNo, readNeisLessons, splitTags, subjectByName, type LessonFile } from './neisLessons';

const subjects = renameAutonomy(defaultSubjects, '신명똑디').map((s) =>
  s.kind === 'autonomy' ? { ...s, aliases: ['신명똑띠'] } : s,
);
const S1 = findFile(REF, '6학년 1학기 진도표');
const load = async (path: string): Promise<LessonFile> => ({
  fileName: path.split('/').pop()!.normalize('NFC'),
  sheets: await readWorkbook(readBuffer(path)),
});
const count = (rows: { subjectId: string; kind: string }[], id: string, kind = 'lesson') =>
  rows.filter((r) => r.subjectId === id && r.kind === kind).length;

describe('조각 함수', () => {
  it('해당차시 펼치기', () => {
    expect(expandLessonNo('4')).toEqual([{ n: 4 }]);
    expect(expandLessonNo('3~4')).toEqual([{ n: 3, part: 1 }, { n: 4, part: 2 }]);
    expect(expandLessonNo('5~6(2)')).toEqual([{ n: 6, part: 2 }]);
    expect(expandLessonNo('자율')).toEqual([]);
  });
  it('태그 떼기(쉼표 여러 개)', () => {
    expect(splitTags('견학 기록문 쓰기 -1- 【교통안전, 안전】')).toEqual({ topic: '견학 기록문 쓰기 -1-', tags: ['교통안전', '안전'] });
    expect(splitTags('그냥 ')).toEqual({ topic: '그냥', tags: [] });
  });
  it('자모 분리형(NFD) 편제 이름도 인식', () => {
    expect(subjectByName(subjects, '국어'.normalize('NFD'))).toBe('kor');
    expect(subjectByName(subjects, '신명똑띠')).toBe('autonomy');
  });
});

describe.skipIf(!S1)('학교 1학기 NEIS형 진도', () => {
  it('국어 83 + 메모 1, 신명똑디 32, 행사·태그', async () => {
    const { rows, warnings } = readNeisLessons([await load(findFile(S1!, '국어')!)], subjects);
    expect(warnings).toEqual([]);
    expect(count(rows, 'kor')).toBe(80);
    expect(count(rows, 'kor', 'event')).toBe(3);
    expect(count(rows, 'kor', 'memo')).toBe(1);
    expect(count(rows, 'autonomy')).toBe(32);
    const ev = rows.filter((r) => r.kind === 'event');
    expect(ev.map((r) => [r.eventName, r.n, r.total])).toEqual([1, 2, 3].map((n) => ['기초학력진단평가', n, 3]));
    const tagged = rows.find((r) => r.topic === '주제 중심 독서 하기 -3-');
    expect(tagged?.tags).toEqual(['폭력예방 및 신변보호-학교폭력']);
  });

  it('11개 파일을 모두 넣어도 신명똑디는 32행', async () => {
    const files = await Promise.all(listFiles(S1!, '.xlsx').map(load));
    expect(files).toHaveLength(11);
    const { rows, warnings } = readNeisLessons(files, subjects);
    expect(warnings).toEqual([]);
    expect(rows.filter((r) => r.subjectId === 'autonomy')).toHaveLength(32);
  });
});

const sci = findFile(REF, '과학(강) 6-1');
const soc = findFile(REF, '사회(설) 6-1');
describe.skipIf(!sci || !soc)('출판사 나이스 업로드용', () => {
  it('과학·사회 6-1: 범위 차시 펼침', async () => {
    const r = readNeisLessons([await load(sci!), await load(soc!)], subjects);
    expect(r.warnings).toEqual([]);
    expect(count(r.rows, 'sci')).toBe(SCI_ROWS);
    expect(count(r.rows, 'soc')).toBe(SOC_ROWS);
    expect(r.rows.some((x) => x.topic.endsWith(' -2-') && x.subjectId === 'sci')).toBe(true);
    expect(r.rows.find((x) => x.subjectId === 'soc')?.rawNote).toContain('소단원');
  });
});

const ext = findFile(EXTRACTED, '2학기_국어_진도표');
describe.skipIf(!ext)('PDF 추출 2학기 국어', () => {
  it('국어 109행', async () => {
    const { rows } = readNeisLessons([await load(ext!)], subjects);
    expect(rows.filter((r) => r.subjectId === 'kor')).toHaveLength(109);
  });
});

const SCI_ROWS = 48; // 단원 전체차시 합 11+10+14+13
const SOC_ROWS = 45; // 15+17+13
