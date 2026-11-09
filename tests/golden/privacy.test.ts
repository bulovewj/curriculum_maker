import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { EXTRACTED, ORIGINAL, findFile, listFiles, readBuffer } from '../files';
import JSZip from 'jszip';
import { readWorkbook } from '../../src/import/xlsx/readWorkbook';

// 교사 이름은 1차에서 읽지 않는다(CLAUDE.md). P02의 이름 목록을 실행 중에 읽어서
// expected/*.json 과 추출/*.json 에 하나도 없는지 확인한다. 이름 목록 자체는 어디에도 저장하지 않는다.
const p02 = findFile(ORIGINAL, '전담 및 학급');

describe.skipIf(!p02)('개인정보: 정답지 JSON에 교사 이름이 없다', () => {
  it('P02의 교사 이름이 expected·추출 JSON에 없다', async () => {
    const sheets = await readWorkbook(readBuffer(p02!));
    // 전담시간표 블록 머리: '이름: 교실' 꼴
    const names = new Set(
      sheets.flatMap((s) => s.rows.flat()).flatMap((t) => {
        const m = t.match(/^\s*([가-힣]{2,4})\s*[:：]/);
        return m ? [m[1]] : [];
      }),
    );
    expect(names.size).toBeGreaterThan(3); // 이름을 못 찾으면 이 검사가 의미 없다
    const files = [...listFiles('fixtures/2026-g6/expected', '.json'), ...listFiles(EXTRACTED, '.json')];
    expect(files.length).toBeGreaterThan(5);
    const hits = files.flatMap((f) => {
      const text = new TextDecoder().decode(readFileSync(f));
      return [...names].filter((n) => text.includes(n)).map((n) => `${f}: 이름 ${n.length}글자`); // 이름은 출력하지 않는다
    });
    expect(hits).toEqual([]);
  });

  it('공개되는 빈 양식(templates/*.hwpx)과 기준 데이터에도 교사 이름이 없다', async () => {
    const sheets = await readWorkbook(readBuffer(p02!));
    const names = new Set(sheets.flatMap((s) => s.rows.flat()).flatMap((t) => { const m = t.match(/^\s*([가-힣]{2,4})\s*[:：]/); return m ? [m[1]] : []; }));
    const hits: string[] = [];
    for (const f of listFiles('templates', '.hwpx')) {
      const zip = await JSZip.loadAsync(readFileSync(f));
      for (const [name, entry] of Object.entries(zip.files)) {
        if (entry.dir || !/\.(xml|hpf|txt)$/.test(name)) continue;
        const text = await entry.async('string');
        for (const n of names) if (text.includes(n)) hits.push(`${f}/${name}: 이름 ${n.length}글자`);
      }
    }
    expect(hits).toEqual([]);
  });
});
