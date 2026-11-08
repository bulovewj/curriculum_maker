import { describe, expect, it } from 'vitest';
import { ORIGINAL, findFile, readBuffer } from '../../../tests/files';
import { defaultSubjects, renameAutonomy } from '../../model/subjects';
import type { SubjectId } from '../../model/types';
import { readHwpx } from '../hwpx/readHwpx';
import { readProgressHwpx, splitRemark, type ProgressResult } from './progressHwpx';

const subjects = renameAutonomy(defaultSubjects, '신명똑디');

describe('비고 쪼개기 (작업지시서 2.3)', () => {
  it('어울림프로그램 + 태그', () => {
    expect(splitRemark('어울림프로그램(학교폭력예방)【폭력예방 및 신변보호-학교폭력】')).toEqual({
      program: '어울림프로그램(학교폭력예방)', tags: ['폭력예방 및 신변보호-학교폭력'],
    });
  });
  it('메모 + 태그', () => {
    expect(splitRemark('학기별1회【민주시민교육】')).toEqual({ note: '학기별1회', tags: ['민주시민교육'] });
  });
  it('재구성 + 사유', () => {
    expect(splitRemark('◆재구성(감축), 결손 보완')).toEqual({ mark: { type: 'reduce', reason: '결손 보완' }, tags: [] });
    expect(splitRemark('◆재구성(증배)')).toEqual({ mark: { type: 'increase' }, tags: [] });
  });
  it('태그만, 쉼표로 여러 개', () => {
    expect(splitRemark('【민주시민교육, 교육활동침해행위예방교육】')).toEqual({ tags: ['민주시민교육', '교육활동침해행위예방교육'] });
  });
  it('행사·재구성 + 태그, 사유만 있는 결손 보완은 메모, 빈 글', () => {
    expect(splitRemark('◈6학년 수학여행【교통안전】')).toEqual({ eventName: '6학년 수학여행', tags: ['교통안전'] });
    expect(splitRemark('◆재구성(감축)【약물 및 사이버 중독 예방-사이버중독】')).toEqual({
      mark: { type: 'reduce' }, tags: ['약물 및 사이버 중독 예방-사이버중독'],
    });
    expect(splitRemark('결손 보완')).toEqual({ note: '결손 보완', tags: [] });
    expect(splitRemark('')).toEqual({ tags: [] });
  });
});

// 작업지시서 7.3: 교과·영역별 1학기·2학기·연간
const S1: Record<SubjectId, number> = { kor: 83, autonomy: 32, soc: 49, mor: 16, math: 73, sci: 50, prac: 32, pe: 52, music: 34, art: 34, eng: 52, 'ca-self': 36, 'ca-club': 9, 'ca-career': 3 };
const S2: Record<SubjectId, number> = { kor: 109, autonomy: 0, soc: 47, mor: 16, math: 67, sci: 48, prac: 32, pe: 50, music: 34, art: 34, eng: 50, 'ca-self': 36, 'ca-club': 9, 'ca-career': 5 };
const YEAR: Record<SubjectId, number> = { kor: 192, soc: 96, mor: 32, math: 140, sci: 98, prac: 64, pe: 102, music: 68, art: 68, eng: 102, 'ca-self': 72, 'ca-club': 18, 'ca-career': 8 };

const load = async (key: string): Promise<ProgressResult> => {
  const path = findFile(ORIGINAL, key)!;
  return readProgressHwpx(await readHwpx(readBuffer(path)), subjects, path.split('/').pop()!);
};
const byId = (r: ProgressResult) => Object.fromEntries(r.tables.filter((t) => !t.composite).map((t) => [t.subjectId!, t]));

describe.skipIf(!findFile(ORIGINAL, '1학기 교과진도'))('(d) 1학기 진도표', () => {
  it('표 15개, 교과별 행 수 = 맨 아래 줄 숫자 = 7.3', async () => {
    const r = await load('1학기 교과진도');
    expect(r.warnings).toEqual([]);
    expect(r.tables).toHaveLength(15);
    const t = byId(r);
    for (const [id, n] of Object.entries(S1)) {
      expect([id, t[id].entries.length, t[id].footer?.total]).toEqual([id, n, n]);
    }
  });

  it('창체 종합 = 자 36 + 동 9 + 진 3', async () => {
    const c = (await load('1학기 교과진도')).tables.find((t) => t.composite)!;
    const count = (id: string) => c.entries.filter((e) => e.plan.subjectId === id).length;
    expect([count('ca-self'), count('ca-club'), count('ca-career')]).toEqual([36, 9, 3]);
    expect(c.footer).toMatchObject({ total: 48, parts: { 자: 36, 동: 9, 진: 3 } });
  });

  it('첫 행들: 주·기간·차시·재구성·행사·어울림', async () => {
    const kor = byId(await load('1학기 교과진도')).kor.entries;
    expect(kor[0]).toMatchObject({ week: 1, period: '3.2~3.7', plan: { kind: 'lesson', unit: '교과서 살펴보기', n: 1, total: 1 } });
    expect(kor[1].plan).toMatchObject({ n: 1, total: 6, pages: '8~15', mark: { type: 'reduce' }, topic: '주제를 정해 읽을 책 정하기' });
    expect(kor[4].plan).toMatchObject({ kind: 'event', eventName: '기초학력진단평가', n: 1, total: 1 });
    expect(kor[4].week).toBe(2);
    expect(kor[5].plan).toMatchObject({ program: '어울림프로그램(학교폭력예방)', tags: ['폭력예방 및 신변보호-학교폭력'], n: 4, total: 6 });
    expect(kor[5].plan.rawNote).toContain('어울림프로그램');
  });
});

describe.skipIf(!findFile(ORIGINAL, '2학기 교과진도'))('(e) 2학기 진도표', () => {
  it('표 15개, 행 수 = 맨 아래 줄 = 7.3, 연간 총 시수', async () => {
    const r = await load('2학기 교과진도');
    expect(r.warnings).toEqual([]);
    expect(r.tables).toHaveLength(15);
    const t = byId(r);
    for (const [id, n] of Object.entries(S2)) {
      // 신명똑디 2학기는 자리표시자 표(예외 12: 연간 0시간으로 적힘)
      expect([id, id === 'autonomy' ? t[id].footer?.total : t[id].entries.length]).toEqual([id, n]);
    }
    expect(t.kor.entries).toHaveLength(109);
    for (const [id, n] of Object.entries(YEAR)) expect([id, t[id].footer?.annual]).toEqual([id, n]);
  });
});
