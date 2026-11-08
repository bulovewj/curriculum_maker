import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { need2026 as need, project2026 } from './project2026';
import { runChecks } from '../../src/engine/checks';
import { standardsOf } from '../../src/lib/standards';
import type { Standards } from '../../src/model/standards';

const std = standardsOf('busan-2027');
const by = (rs: ReturnType<typeof runChecks>, id: string) => rs.filter((r) => r.ruleId === id);

describe.skipIf(!need)('규정 검사 (2026 6학년)', () => {
  it('R1~R9: fail이 없고 R2·R5 외에는 모두 통과', async () => {
    const rs = runChecks(await project2026(), std);
    for (const id of ['R1', 'R2', 'R3', 'R4', 'R6', 'R7', 'R8', 'R9']) expect([id, by(rs, id).map((r) => r.level)]).toEqual([id, ['pass']]);
    expect(by(rs, 'R5').map((r) => r.level)).toEqual(['warn']); // 작년 정보교육 값이 없어 warn(통과로 본다)
    expect(rs.filter((r) => r.level === 'fail')).toEqual([]);
  });

  it('R11 (가) 통과, (나) 경고가 작업지시서 7.5의 4번과 같다', async () => {
    const rs = by(runChecks(await project2026(), std), 'R11');
    expect(rs.filter((r) => r.message.startsWith('(가)')).map((r) => r.level)).toEqual(['pass']);
    const nae = rs.filter((r) => r.message.startsWith('(나)'));
    const pick = (text: string) => nae.filter((r) => r.message.includes(text)).map((r) => `${r.where[0].semester}학기 ${r.where[0].subjectId}`).sort();
    // ◆는 있는데 증감 기록 없음: 1학기 체육·음악·영어, 2학기 국어·과학·체육·미술·영어
    expect(pick('◆ 표시는 있는데')).toEqual(['1학기 eng', '1학기 music', '1학기 pe', '2학기 art', '2학기 eng', '2학기 kor', '2학기 pe', '2학기 sci']);
    // 기록은 있는데 ◆ 없음: 1학기 창체, 2학기 도덕
    expect(pick('증감 기록은 있는데')).toEqual(['1학기 창체', '2학기 mor']);
  });

  it('기준 JSON 숫자를 바꾸면 결과가 바뀐다', async () => {
    const p = await project2026();
    const edit = (f: (s: Standards) => void) => { const s = structuredClone(std); f(s); return runChecks(p, s); };
    expect(by(edit((s) => { s.schoolDays.min = 200; }), 'R1')[0].level).toBe('fail');
    expect(by(edit((s) => { s.adjustRange.percent = 5; }), 'R3').some((r) => r.level === 'fail')).toBe(true);
    expect(by(edit((s) => { s.gradeBands['5-6'].total = 3000; }), 'R2')[0].level).toBe('fail');
    expect(by(edit((s) => { s.autonomy['5-6'] = 40; }), 'R6')[0].level).toBe('warn');
    expect(by(edit((s) => { s.noReduce.groups = ['체육', '국어']; s.gradeBands['5-6'].hours['국어'] = 600; }), 'R4')[0].level).toBe('fail');
  });
});

describe('기준 숫자를 코드에 두지 않는다', () => {
  it('src/engine/checks 안에 190·2176·1088·0.2가 없다', () => {
    const dir = 'src/engine/checks';
    const bad = readdirSync(dir).filter((f) => f.endsWith('.ts')).filter((f) => /\b(190|2176|1088|0\.2|34|32)\b/.test(new TextDecoder().decode(readFileSync(`${dir}/${f}`))));
    expect(bad).toEqual([]);
  });
});
