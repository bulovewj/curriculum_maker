import { useMemo, useState } from 'react';
import { schoolDaysByMonth } from '../../engine/calendar';
import { computeGrid } from '../../engine/grid';
import { importWeekGrid } from '../../engine/importWeekGrid';
import { generateSlots, orphanOverrides } from '../../engine/slots';
import { semesterTotals } from '../../engine/weekGrid';
import { readHwpx } from '../../import/hwpx/readHwpx';
import { readTimePlan } from '../../import/mappers/timePlanHwpx';
import { BalancePanel } from '../../components/BalancePanel';
import { EstimatedNotice } from '../../components/PlanGapNotice';
import { MoveForm, type MoveTarget } from '../../components/MoveForm';
import { moveHours, unlockWeek } from '../../engine/moveHours';
import { useProject } from '../../state/ProjectContext';

/** S5 주별 시수표(읽기 전용): 시간 운영계획(c)과 같은 열 순서 + 학기 계·편제·차이 */
export function WeekGrid() {
  const { project: p, update } = useProject();
  const [msg, setMsg] = useState<string[]>([]);
  const [target, setTarget] = useState<MoveTarget | null>(null);
  const grid = useMemo(() => (p ? computeGrid(p) : null), [p]);
  if (!p || !grid) return null;

  /** 작년 시수표 가져오기: (c) 시간 운영계획 hwpx의 주별 값으로 칸을 맞춘다('imported' 덮어쓰기) */
  async function importPlan(file: File | undefined) {
    if (!file || !p) return;
    try {
      const plan = readTimePlan(await readHwpx(await file.arrayBuffer()), p.subjects);
      const base = generateSlots(p.calendar, p.baseTimetable, p.settings);
      const r = importWeekGrid(base, plan.tables.flatMap((t) => t.rows), p.subjects.map((s) => s.id));
      update((q) => {
        const kept = Object.fromEntries(Object.entries(q.slotOverrides).filter(([, o]) => o.kind !== 'imported'));
        // 교사가 직접 고치거나 잠근 칸은 가져오기로 덮어쓰지 않는다
        const mine = (k: string) => kept[k] !== undefined && (kept[k].locked || kept[k].kind === 'edited');
        return { ...q, slotOverrides: { ...kept, ...Object.fromEntries(Object.entries(r.overrides).filter(([k]) => !mine(k))) } };
      });
      setMsg([`가져온 칸 ${Object.keys(r.overrides).length}개`, ...plan.warnings, ...r.warnings]);
    } catch (e) {
      setMsg([e instanceof Error ? e.message : '파일을 읽지 못했습니다.']);
    }
  }

  if (grid.rows.length === 0) return <p className="muted">S3을 먼저 채우세요(학사력과 기초 시간표).</p>;

  const subj = p.subjects.filter((s) => s.kind !== 'creative');
  const crea = p.subjects.filter((s) => s.kind === 'creative');
  const sum = (h: Record<string, number>, list: typeof subj) => list.reduce((a, s) => a + (h[s.id] ?? 0), 0);
  const total = [1, 2].map((n) => semesterTotals(grid.rows, n as 1 | 2));
  const year = Object.fromEntries(p.subjects.map((s) => [s.id, (total[0][s.id] ?? 0) + (total[1][s.id] ?? 0)]));
  const plan = p.curriculumPlan.schoolAnnual;
  const hasPlan = Object.keys(plan).length > 0;
  const heads = [...subj, ...crea];
  const cols = (h: Record<string, number>, bold = false, at?: { semester: 1 | 2; week: number }) => (
    <>
      {subj.map((s) => <td key={s.id} onClick={at ? () => setTarget({ ...at, from: s.id }) : undefined} className={at ? 'clickable' : undefined}>{bold ? <b>{h[s.id] ?? 0}</b> : h[s.id] ?? 0}</td>)}
      <td>{sum(h, subj)}</td>
      {crea.map((s) => <td key={s.id} onClick={at ? () => setTarget({ ...at, from: s.id }) : undefined} className={at ? 'clickable' : undefined}>{h[s.id] ?? 0}</td>)}
      <td>{sum(h, crea)}</td>
      <td>{sum(h, subj) + sum(h, crea)}</td>
    </>
  );

  return (
    <section>
      <h2>주별 시수표</h2>
      <label className="button">
        작년 시수표 가져오기(시간 운영계획 hwpx)
        <input type="file" accept=".hwpx" hidden onChange={(e) => importPlan(e.target.files?.[0])} />
      </label>
      {msg.map((m) => <p key={m} className="muted">{m}</p>)}
      <EstimatedNotice project={p} />
      {(() => {
        const lost = orphanOverrides(grid.slots, p.slotOverrides); // 학사력이 바뀌어 사라진 칸에 있던 고침
        if (lost.length === 0) return null;
        return (
          <p className="yellow">
            학사력이 바뀌어 없어진 칸의 고침 {lost.length}개: {lost.map((k) => k.replace('#', ' ') + '교시').join(', ')}{' '}
            <button onClick={() => update((q) => ({ ...q, slotOverrides: Object.fromEntries(Object.entries(q.slotOverrides).filter(([k]) => !lost.includes(k))) }))}>목록에서 지우기</button>
          </p>
        );
      })()}
      <BalancePanel project={p} update={update} />
      {target && (
        <MoveForm target={target} subjects={p.subjects} onCancel={() => setTarget(null)} onMove={(to, n) => {
          const r = moveHours(grid.slots, p.slotOverrides, { ...target, to, n });
          update((q) => ({ ...q, slotOverrides: r.overrides }));
          setMsg(r.warnings);
          setTarget(null);
        }} />
      )}
      <div className="table-wrap">
      <table className="dev-table">
        <thead>
          <tr>
            <th>월[수업일]</th><th>주</th><th>기간</th><th>수업일</th>{['월', '화', '수', '목', '금', '토'].map((d) => <th key={d}>{d}</th>)}
            {subj.map((s) => <th key={s.id}>{s.name}</th>)}<th>소계</th>{crea.map((s) => <th key={s.id}>{s.name}</th>)}<th>소계</th><th>총계</th><th>비고</th>
          </tr>
        </thead>
        <tbody>
          {[1, 2].flatMap((n) => {
            const rows = grid.rows.filter((r) => r.semester === n);
            const days = schoolDaysByMonth(p.calendar, n as 1 | 2);
            return [
              <tr key={`h${n}`}><th colSpan={heads.length + 14}>{n}학기</th></tr>,
              ...rows.map((r, i) => (
                <tr key={`${n}-${r.week}`}>
                  <td>{i === 0 || rows[i - 1].month !== r.month ? `${r.month}[${days[r.month] ?? 0}]` : ''}</td>
                  <td>{r.week}</td><td>{r.period}</td><td>{r.schoolDays}</td>
                  {r.dayPeriods.map((v, k) => <td key={k}>{v}</td>)}
                  {cols(r.hours, false, { semester: n as 1 | 2, week: r.week })}
                  <td style={{ whiteSpace: 'pre-line' }}>
                    {r.note}
                    {grid.slots.some((s) => s.semester === n && s.week === r.week && s.locked) && (
                      <> 🔒 <button className="link" onClick={() => update((q) => ({ ...q, slotOverrides: unlockWeek(grid.slots, q.slotOverrides, n as 1 | 2, r.week) }))}>잠금 풀기</button></>
                    )}
                  </td>
                </tr>
              )),
              <tr key={`t${n}`}><td colSpan={4}><b>{n}학기 계</b></td><td colSpan={6} />{cols(total[n - 1], true)}<td /></tr>,
            ];
          })}
          <tr><td colSpan={4}><b>연간 계</b></td><td colSpan={6} />{cols(year, true)}<td /></tr>
          {hasPlan && <tr><td colSpan={4}>본교 편제 시수</td><td colSpan={6} />{cols(plan)}<td /></tr>}
          {hasPlan && (
            <tr><td colSpan={4}>차이(편제−칸)</td><td colSpan={6} />{cols(Object.fromEntries(heads.map((s) => [s.id, (plan[s.id] ?? 0) - (year[s.id] ?? 0)])))}<td /></tr>
          )}
        </tbody>
      </table>
      </div>
    </section>
  );
}
