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
