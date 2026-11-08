import { useState } from 'react';
import { readHwpx, type HwpxBlock } from '../import/hwpx/readHwpx';
import { isMerged, type HwpxTable } from '../import/hwpx/table';

// 교사 이름은 1차에서 읽지 않는다(CLAUDE.md). 표지·안건 표(작은 표 + 안건·제안 글자)는 화면에서 가린다.
const isCover = (t: HwpxTable) => t.rows <= 3 && t.cells.some((c) => /안\s*건|제\s*안|심\s*의/.test(c.text));

/** ?dev 전용: hwpx 문단·표를 순서대로 보여 준다. 병합은 rowSpan/colSpan으로. */
export function HwpxView() {
  const [blocks, setBlocks] = useState<HwpxBlock[] | null>(null);
  const [error, setError] = useState('');

  async function onFile(f: File | undefined) {
    if (!f) return;
    setError('');
    try {
      setBlocks(await readHwpx(await f.arrayBuffer()));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  let tableNo = 0;
  return (
    <section>
      <h2>hwpx 표 보기</h2>
      <label>hwpx<input type="file" accept=".hwpx" onChange={(e) => onFile(e.target.files?.[0])} /></label>
      {error && <p className="error">{error}</p>}
      {blocks && <p>표 {blocks.filter((b) => b.kind === 'table').length}개</p>}
      {blocks?.map((b, i) =>
        b.kind === 'para' ? (
          <p key={i} className="muted">{b.text}</p>
        ) : isCover(b) ? (
          <p key={i} className="muted">표 {++tableNo} (표지·안건 표 — 이름이 있어 가림)</p>
        ) : (
          <div key={i}>
            <strong>표 {++tableNo} ({b.rows}×{b.cols})</strong>
            <table className="dev-table">
              <tbody>
                {b.grid.map((row, r) => (
                  <tr key={r}>
                    {row.map((c, k) => {
                      if (isMerged(c)) return null;
                      if (!c) return <td key={k} />;
                      const Tag = c.header ? 'th' : 'td';
                      return <Tag key={k} rowSpan={c.rowSpan} colSpan={c.colSpan} style={{ whiteSpace: 'pre-wrap' }}>{c.text}</Tag>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
      )}
    </section>
  );
}
