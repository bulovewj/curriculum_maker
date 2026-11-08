import { describe, expect, it } from 'vitest';
import { newProject, shiftSemesters } from './newProject';

describe('shiftSemesters', () => {
  it('학년도를 바꾸면 학기 날짜가 그 해로 옮겨진다', () => {
    const p = newProject('x', 2027);
    expect(shiftSemesters(p.semesters, 2026)).toEqual(newProject('x', 2026).semesters);
    expect(shiftSemesters(p.semesters, 2027)).toEqual(p.semesters);
  });
  it('윤년: 2월 끝은 그 해의 말일', () => {
    const p = newProject('x', 2026); // 2027-02-28
    expect(shiftSemesters(p.semesters, 2027)[1].end).toBe('2028-02-29');
  });
});
