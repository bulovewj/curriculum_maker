import { describe, expect, it } from 'vitest';
import { newProject } from '../model/newProject';
import { parseProjectFile, projectFileName, toProjectFile } from './projectFile';

describe('projectFile', () => {
  const p = { ...newProject('p1', 2027), school: { name: '신명초', office: '부산' as const } };

  it('내보내기 → 불러오기 하면 모든 값이 같다', () => {
    expect(parseProjectFile(toProjectFile(p, '2026-11-08T01:00:00.000Z'))).toEqual(p);
  });

  it('파일 이름', () => {
    expect(projectFileName(p, '2026-11-08T01:00:00.000Z')).toBe('내손안_2027_6학년_20261108.json');
  });

  it('깨진 파일·다른 파일·새 판 파일은 알맞은 문장으로 거절', () => {
    expect(() => parseProjectFile('{')).toThrow('파일을 읽을 수 없습니다.');
    expect(() => parseProjectFile('{"a":1}')).toThrow('내 손 안의 교육과정 파일이 아님');
    expect(() => parseProjectFile('{"app":"naesonan","schemaVersion":99,"project":{}}')).toThrow('새 판');
  });
});

describe('깨진 파일 거르기', () => {
  it('project가 비었으면 어느 칸이 없는지 알려 준다', () => {
    const text = JSON.stringify({ app: 'naesonan', schemaVersion: 1, project: {} });
    expect(() => parseProjectFile(text)).toThrow('id 없음');
  });
  it('배열 칸이 빠지면 그 칸 이름을 알려 준다', () => {
    const p = JSON.parse(toProjectFile(newProject('x', 2027), '2027-01-01T00:00:00Z'));
    delete p.project.events;
    expect(() => parseProjectFile(JSON.stringify(p))).toThrow('events 없음');
  });
});

describe('안쪽 칸 검사(GPT 검토 반영)', () => {
  it('편제 안쪽이 비면 거절, 옛 파일에 없는 설정 칸은 기본값으로 채움', () => {
    const p = JSON.parse(toProjectFile(newProject('x', 2027), '2027-01-01T00:00:00Z'));
    p.project.settings = {};
    expect(parseProjectFile(JSON.stringify(p)).settings.extraPeriodSubject).toBe('ca-self');
    p.project.curriculumPlan = {};
    expect(() => parseProjectFile(JSON.stringify(p))).toThrow('curriculumPlan.standard 없음');
  });
});
