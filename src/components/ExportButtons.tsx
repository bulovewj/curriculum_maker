import { useState } from 'react';
import { checkXlsx } from '../export/checkXlsx';
import { neisZip } from '../export/neisXlsx';
import { planAdjustFileName, planAdjustHwpx } from '../export/planAdjustHwpx';
import { progressFileName, progressHwpx } from '../export/progressHwpx';
import { timePlanFileName, timePlanHwpx } from '../export/timePlanHwpx';
import { download } from '../lib/download';
import { standardsOf } from '../lib/standards';
import { loadTemplate } from '../lib/templates';
import type { Project, Semester } from '../model/types';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const HWPX = 'application/hwp+zip';

/** S7 출력 단추. 빨간 항목이 있으면 만들기 전에 한 번 묻는다. */
export function ExportButtons({ project: p, fails }: { project: Project; fails: number }) {
  const [msg, setMsg] = useState('');
  const run = (make: () => Promise<[string, ArrayBuffer, string]>) => async () => {
    if (fails > 0 && !window.confirm(`빨간 항목 ${fails}개가 있습니다. 그래도 만들까요?`)) return;
    try {
      setMsg('');
      const [name, data, type] = await make();
      download(name, data, type);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '파일을 만들지 못했습니다.');
    }
  };
  const sems: Semester[] = [1, 2];
  return (
    <div>
      <div className="row">
        {sems.map((s) => <button key={`p${s}`} onClick={run(async () => [progressFileName(p, s), await progressHwpx(p, s, await loadTemplate('progress')), HWPX])}>진도표 {s}학기(hwpx)</button>)}
        {sems.map((s) => <button key={`t${s}`} onClick={run(async () => [timePlanFileName(p, s), await timePlanHwpx(p, s, await loadTemplate('timeplan')), HWPX])}>시간 운영계획 {s}학기(hwpx)</button>)}
        <button onClick={run(async () => [planAdjustFileName(p), await planAdjustHwpx(p, await loadTemplate('progress')), HWPX])}>시수증감 운영계획(hwpx)</button>
      </div>
      <div className="row">
        <button onClick={run(async () => [`${p.year}학년도 ${p.grade}학년 NEIS 교과진도.zip`, await neisZip(p), 'application/zip'])}>NEIS 엑셀(zip)</button>
        <button onClick={run(async () => [`${p.year}학년도 ${p.grade}학년 시수 점검표.xlsx`, await checkXlsx(p, standardsOf(p.standardsVersion)), XLSX])}>시수 점검표(xlsx)</button>
      </div>
      {msg && <p className="error">{msg}</p>}
    </div>
  );
}
