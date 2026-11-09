import { useEffect, useState } from 'react';
import { blankNameColumns } from '../ai/maskNames';
import { callAi } from '../ai/client';
import { writeXlsx } from '../export/xlsxWrite';
import { TARGETS, buildStandardRows, findHeaderRow, guessColumns, mappingFromAi, type Mapping, type Target } from '../import/columnMap';
import { readWorkbook, type Sheet } from '../import/xlsx/readWorkbook';
import type { Subject } from '../model/types';

interface Props {
  buffer: ArrayBuffer;
  subjects: Subject[];
  aiEnabled: boolean;
  onDone: (data: ArrayBuffer) => void; // 열을 맞춘 표(NEIS형 진도 xlsx)를 돌려준다. 이후는 일반 진도 읽기로 간다.
}

/** S2 모르는 xlsx의 열 맞추기: 머리글 아래 값을 보며 열마다 목표를 고른다. AI가 켜져 있으면 [AI로 열 맞추기]. 꺼져도 손으로 고를 수 있다. */
export function ColumnMapper({ buffer, subjects, aiEnabled, onDone }: Props) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [subject, setSubject] = useState('');
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const at = sheet ? findHeaderRow(sheet) : 0;
  // 머리글보다 오른쪽에 데이터 열이 있어도 맞출 수 있게 가장 넓은 줄 기준으로 센다
  const width = Math.max(sheet?.rows[at]?.length ?? 0, ...(sheet?.rows.slice(at + 1, at + 30) ?? []).map((r) => r.length));
  const headers = Array.from({ length: width }, (_, i) => sheet?.rows[at]?.[i] ?? '');

  useEffect(() => {
    void readWorkbook(buffer).then((sheets) => {
      const s = sheets.find((x) => x.rows.length > 1) ?? sheets[0];
      setSheet(s);
      if (s) setMapping(guessColumns(Array.from({ length: Math.max(...s.rows.slice(findHeaderRow(s)).slice(0, 30).map((r) => r.length)) }, (_, i) => s.rows[findHeaderRow(s)][i] ?? '')));
    }).catch(() => setNotes(['파일을 읽지 못했습니다.']));
  }, [buffer]);
  if (!sheet) return <p className="muted">열을 읽는 중…</p>;

  const hasSubjectCol = Object.values(mapping).some((m) => m.target === '편제');
  const pick = (i: number, target: Target | '') => setMapping((m) => ({
    // 같은 목표를 다른 열에 이미 줬다면 거기는 비운다
    ...Object.fromEntries(Object.entries(m).map(([k, v]) => [k, target && v.target === target ? { target: '' as const, confidence: 0 } : v])),
    [i]: { target, confidence: 1 },
  }));

  async function askAi() {
    setBusy(true);
    const sample = blankNameColumns(headers, sheet!.rows.slice(at + 1, at + 4).map((r) => headers.map((_, i) => r[i] ?? ''))); // 표본은 3줄, 이름 열은 비움
    const res = await callAi('mapColumns', { headers, sample, targets: [...TARGETS] });
    setBusy(false);
    if (!res.ok) return setNotes([res.error]);
    const r = mappingFromAi(res.output, headers.length);
    setMapping(r.mapping);
    setNotes(r.warnings);
  }

  async function done() {
    const fixed = subjects.find((s) => s.id === subject)?.neisName ?? subjects.find((s) => s.id === subject)?.name;
    onDone(await writeXlsx({ 진도: buildStandardRows(sheet!, at, mapping, fixed) }));
  }

  const missing = (['학습내용', '해당차시'] as Target[]).filter((t) => !Object.values(mapping).some((m) => m.target === t));
  return (
    <div className="file-card">
      <b>열 맞추기</b> <span className="muted">머리글 {at + 1}번째 줄 · 열마다 진도의 어느 칸인지 고르세요</span>
      <table className="dev-table">
        <thead><tr><th>열</th><th>머리글</th><th>값 예</th><th>진도 칸</th><th>자신감</th></tr></thead>
        <tbody>
          {headers.map((h, i) => (
            <tr key={i}>
              <td>{i + 1}</td><td>{h}</td>
              <td>{[1, 2].map((k) => sheet.rows[at + k]?.[i] ?? '').join(' / ').slice(0, 40)}</td>
              <td><select value={mapping[i]?.target ?? ''} onChange={(e) => pick(i, e.target.value as Target | '')}>
                <option value="">(안 씀)</option>{TARGETS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select></td>
              <td className={mapping[i]?.target && mapping[i].confidence < 0.7 ? 'is-warn' : undefined}>{mapping[i]?.target ? mapping[i].confidence.toFixed(1) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!hasSubjectCol && (
        <label>이 파일의 교과 <select value={subject} onChange={(e) => setSubject(e.target.value)}>
          <option value="">(고르세요)</option>{subjects.filter((s) => s.kind !== 'creative').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select></label>
      )}
      {missing.length > 0 && <p className="yellow-cell">{missing.join('·')} 열을 골라야 읽을 수 있습니다.</p>}
      {notes.map((n, i) => <p key={i} className="yellow-cell">{n}</p>)}
      <div className="row">
        {aiEnabled && <button disabled={busy} onClick={() => void askAi()}>{busy ? '맞추는 중…' : 'AI로 열 맞추기'}</button>}
        <button className="primary" disabled={missing.length > 0 || (!hasSubjectCol && !subject)} onClick={() => void done()}>이 열 맞추기로 읽기</button>
      </div>
    </div>
  );
}
