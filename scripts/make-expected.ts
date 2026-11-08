// 정답지 기대값 JSON 만들기: npm run expected
// M3~M6 매퍼로 2026 신명초 6학년 원본을 읽어 fixtures/2026-g6/expected/*.json 을 쓰고,
// 손으로 옮긴 totals.json(작업지시서 7.3)과 대조한다. 하나라도 다르면 어느 칸인지 적고 실패한다.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readScheduleP04 } from '../src/import/mappers/scheduleP04';
import { readCurriculum } from '../src/import/mappers/curriculumHwpx';
import { readPlanAdjust } from '../src/import/mappers/planAdjustHwpx';
import { readProgressHwpx, type ProgressResult } from '../src/import/mappers/progressHwpx';
import { readTimePlan } from '../src/import/mappers/timePlanHwpx';
import { readHwpx } from '../src/import/hwpx/readHwpx';
import { readWorkbook } from '../src/import/xlsx/readWorkbook';
import { defaultSubjects, renameAutonomy } from '../src/model/subjects';
import { ORIGINAL, REF, findFile, readBuffer } from '../tests/files';

const OUT = 'fixtures/2026-g6/expected';
const YEAR = 2026;
const GRADE = 6;
const subjects = renameAutonomy(defaultSubjects, '신명똑디');
const CA = ['ca-self', 'ca-club', 'ca-career'];
const ids = subjects.map((s) => s.id);

function need(dir: string, key: string): string {
  const f = findFile(dir, key);
  if (!f) throw new Error(`원본이 없어 만들 수 없습니다: ${dir}/…${key}…`);
  return f;
}
const write = (name: string, data: unknown) => writeFileSync(`${OUT}/${name}`, JSON.stringify(data, null, 1) + '\n');
const hwpx = async (path: string) => readHwpx(readBuffer(path));
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** 진도표에서 파일 이름·행 id·원본 위치를 뺀 기대값 */
function progressExpected(r: ProgressResult) {
  return r.tables.map((t) => ({
    subjectId: t.subjectId ?? 'creative-total', semester: t.semester, footer: t.footer,
    rows: t.entries.map(({ week, period, plan: p }) => ({
      week, period, subjectId: p.subjectId, kind: p.kind, unit: p.unit, topic: p.topic, n: p.n, total: p.total,
      pages: p.pages, area: p.area, mark: p.mark, eventName: p.eventName, program: p.program, tags: p.tags, note: p.note, rawNote: p.rawNote,
    })),
  }));
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const p04 = readScheduleP04(await readWorkbook(readBuffer(need(ORIGINAL, '행사 및 일정'))), YEAR, GRADE);
  const timePlan = readTimePlan(await hwpx(need(ORIGINAL, '시간 운영계획')), subjects);
  const d = readProgressHwpx(await hwpx(need(ORIGINAL, '1학기 교과진도')), subjects, '(d)');
  const e = readProgressHwpx(await hwpx(need(ORIGINAL, '2학기 교과진도')), subjects, '(e)');
  const plan = readPlanAdjust(await hwpx(need(REF, '시수 증가')), subjects);
  const cur = readCurriculum(await hwpx(need(REF, '학사일정 및 교육과정편제')), subjects, YEAR, GRADE);
  const school = await readWorkbook(readBuffer(need(need(REF, '6학년 1학기 진도표'), '국어')));
  const warnings = [...p04.warnings, ...timePlan.warnings, ...d.warnings, ...e.warnings, ...plan.warnings, ...cur.warnings];

  write('calendar.json', p04.calendar.map((c) => ({
    date: c.date, semester: c.semester, schoolDay: c.schoolDay, periods: c.periods, holiday: c.holiday, notes: c.notes.length ? c.notes : undefined,
  })));
  write('week-grid.json', timePlan.tables);
  write('progress-s1.json', progressExpected(d));
  write('progress-s2.json', progressExpected(e));
  write('plan-adjust.json', plan);
  write('curriculum.json', cur);
  const [head, ...rows] = school[0].rows;
  write('neis-format.json', {
    sheetName: school[0].name, headers: head,
    examples: {
      first: rows[0], event: rows.filter((r) => r[4].startsWith('◈')).slice(0, 3),
      tagged: rows.find((r) => r[5].includes('【')), memo: rows.find((r) => r[8] === ''),
    },
  });

  // ── totals.json(손으로 옮긴 7.3)과 대조 ──
  const totals = JSON.parse(new TextDecoder().decode(readFileSync(`${OUT}/totals.json`)));
  const bad: string[] = [];
  const check = (label: string, want: unknown, got: unknown) => {
    if (JSON.stringify(want) !== JSON.stringify(got)) bad.push(`${label}: 기대 ${JSON.stringify(want)} / 실제 ${JSON.stringify(got)}`);
  };
  const [w1, w2] = timePlan.tables;
  // 창체는 영역별 표(자율·동아리·진로)와 종합 표에 같은 행이 있다. 영역별 표로 세고, 종합 표는 따로 맞춰 본다.
  const count = (r: ProgressResult, id: string, composite = false) =>
    r.tables.filter((t) => t.composite === composite).flatMap((t) => t.entries).filter((x) => x.plan.subjectId === id).length;
  const lines: string[] = ['교과·영역 | 1학기 | 2학기 | 연간 | 기준 | 증감 | 진도행(1/2)'];
  for (const id of [...ids, 'creative', 'total']) {
    const want = totals.subjects[id];
    const grp = id === 'creative' ? CA : id === 'total' ? ids : [id];
    const h = (t: typeof w1, key: 'semesterTotal' | 'annual') => sum(grp.map((g) => t[key]?.hours[g] ?? 0));
    const s1 = h(w1, 'semesterTotal');
    const s2 = h(w2, 'semesterTotal');
    const year = h(w2, 'annual');
    const std = id === 'creative' ? plan.creative.standard : id === 'total' ? plan.total.standard : plan.standard[id] ?? null;
    const diff = id === 'creative' ? plan.creative.diff : id === 'total' ? plan.total.diff : CA.includes(id) ? null : plan.diff[id] ?? null;
    check(`${id} 1학기(시간 운영계획)`, want.s1, s1);
    check(`${id} 2학기(시간 운영계획)`, want.s2, s2);
    check(`${id} 연간(시간 운영계획)`, want.year, year);
    check(`${id} 교육부 기준(증감계획)`, want.standard, std);
    check(`${id} 증감(증감계획)`, want.diff, diff);
    const ann = id === 'creative' ? plan.creative.school : id === 'total' ? plan.total.school : plan.annual[id];
    if (ann !== undefined) check(`${id} 연간(증감계획 본교 시수)`, want.year, ann);
    const rows1 = grp.reduce((a, g) => a + count(d, g), 0);
    const rows2 = grp.reduce((a, g) => a + count(e, g), 0);
    if (id !== 'total') { check(`${id} 1학기 진도 행 수`, want.s1, rows1); check(`${id} 2학기 진도 행 수`, want.s2, rows2); }
    lines.push(`${id} | ${s1} | ${s2} | ${year} | ${std ?? '–'} | ${diff ?? '–'} | ${id === 'total' ? '' : `${rows1}/${rows2}`}`);
  }
  for (const [r, name] of [[d, '1학기'], [e, '2학기']] as const) for (const id of CA) check(`${id} ${name} 진도 행 수(종합 표 = 영역별 표)`, count(r, id), count(r, id, true));
  const day = (sem: 1 | 2) => p04.calendar.filter((c) => c.semester === sem && c.schoolDay);
  check('수업일 1학기', totals.schoolDays.s1, day(1).length);
  check('수업일 2학기', totals.schoolDays.s2, day(2).length);
  check('수업일 시간 운영계획', [totals.schoolDays.s1, totals.schoolDays.s2], [w1.semesterTotal?.schoolDays, w2.semesterTotal?.schoolDays]);
  for (const [k, sem, t] of [['s1', 1, w1], ['s2', 2, w2]] as const) {
    check(`요일별 교시 ${k}(시간 운영계획)`, totals.dayPeriods[k], t.semesterTotal?.dayPeriods.slice(0, 5));
    // 학기 중 변경 2건(2026-09-29·2027-02-02, 7.2)은 화요일에서 서로 상쇄되어 요일별 합은 같다
    check(`요일별 교시 ${k}(P04)`, totals.dayPeriods[k], [1, 2, 3, 4, 5].map((w) => sum(day(sem).filter((c) => new Date(c.date).getUTCDay() === w).map((c) => c.periods))));
  }
  check('주 수', [totals.weeks.s1, totals.weeks.s2], [w1.rows.length, w2.rows.length]);

  console.log(lines.join('\n'));
  if (warnings.length) console.log('\n경고:\n' + warnings.map((w) => `- ${w}`).join('\n'));
  if (bad.length) throw new Error(`totals.json과 다른 곳 ${bad.length}곳:\n- ${bad.join('\n- ')}`);
  console.log(`\n✔ totals.json과 모두 같음. ${OUT}/ 에 JSON을 썼습니다.`);
}

main();
