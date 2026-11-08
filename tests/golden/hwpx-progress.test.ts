import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { progressHwpx } from '../../src/export/progressHwpx';
import { readHwpx } from '../../src/import/hwpx/readHwpx';
import { readProgressHwpx, type ProgressTable } from '../../src/import/mappers/progressHwpx';
import { need2026, project2026 } from './project2026';

const read = (name: string) => JSON.parse(new TextDecoder().decode(readFileSync(name)));
const template = (() => { try { const b = readFileSync('templates/progress.hwpx'); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; } catch { return undefined; } })();

interface Want { subjectId: string; footer: unknown; rows: { week: number; period: string; unit: string; topic: string; n?: number; total?: number; pages?: string; area?: string; rawNote?: string }[] }
const rowKey = (r: { week: number; period: string; unit: string; topic: string; n?: number; total?: number; pages?: string; area?: string; rawNote?: string }) =>
  [r.week, r.period, r.unit, r.topic, r.n ?? '', r.total ?? '', r.pages ?? '', r.area ?? '', r.rawNote ?? ''].join('¦');

describe.skipIf(!need2026 || !template)('정답지 B(문서): 진도표 hwpx 칸 글자가 (d)(e)와 같다', () => {
  for (const sem of [1, 2] as const) {
    it(`${sem}학기: 표 15개, 모든 칸 글자·맨 아래 줄이 같다`, async () => {
      const p = await project2026();
      const out = await progressHwpx(p, sem, template!);
      const back = readProgressHwpx(await readHwpx(out), p.subjects, 'out');
      expect(back.warnings).toEqual([]);
      expect(back.tables).toHaveLength(15);
      const want: Want[] = read(`fixtures/2026-g6/expected/progress-s${sem}.json`);
      const diffs: string[] = [];
      back.tables.forEach((t: ProgressTable, i) => {
        const w = want[i];
        const id = t.composite ? 'creative-total' : t.subjectId;
        if (id !== w.subjectId) diffs.push(`표 ${i + 1}: 교과 ${id} ≠ ${w.subjectId}`);
        // 예외 12: (e) 신명똑디 끝줄은 '연간 총 시수: 0시간'(실제 32). 우리는 실제 값을 쓰므로 그 칸만 다르다
        const wantFooter = id === 'autonomy' && sem === 2 ? { ...(w.footer as object), annual: 32 } : w.footer;
        if (JSON.stringify(t.footer) !== JSON.stringify(wantFooter)) diffs.push(`${id} 맨 아래 줄: ${JSON.stringify(t.footer)} ≠ ${JSON.stringify(wantFooter)}`);
        const got = t.entries.map((e) => rowKey({ week: e.week, period: e.period, unit: e.plan.unit, topic: e.plan.topic, n: e.plan.n, total: e.plan.total, pages: e.plan.pages, area: e.plan.area, rawNote: e.plan.rawNote }));
        const exp = w.rows.map(rowKey);
        // 창체 종합 표는 같은 주 안에서 영역이 섞이는 순서가 정해져 있지 않아 줄 묶음으로 비교한다
        const [a, b] = t.composite ? [[...got].sort(), [...exp].sort()] : [got, exp];
        if (a.length !== b.length) diffs.push(`${id}: 행 수 ${a.length} ≠ ${b.length}`);
        a.forEach((g, k) => { if (g !== b[k] && diffs.length < 15) diffs.push(`${id} ${k + 1}행: ${g} ≠ ${b[k]}`); });
      });
      expect(diffs).toEqual([]);
    });
  }

  it('만든 파일 구조: mimetype 첫 항목, 폴더 항목 없음, 본문은 표 15개', async () => {
    const p = await project2026();
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(await progressHwpx(p, 1, template!));
    const names = Object.keys(zip.files);
    expect(names[0]).toBe('mimetype');
    expect(names.some((n) => n.endsWith('/'))).toBe(false);
    const xml = await zip.file('Contents/section0.xml')!.async('string');
    expect(xml.match(/<hp:tbl /g)).toHaveLength(15);
    expect(xml.match(/pageBreak="1"/g)).toHaveLength(14); // 첫 표 뒤 14개 표는 새 쪽
  });
});
