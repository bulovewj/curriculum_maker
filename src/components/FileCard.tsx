import type { ImportKind, Subject } from '../model/types';
import type { Unknown } from '../import/interpret';
import type { Interpretation } from '../import/interpret';

// 준비물(입력) 먼저, 출력 문서·받지 않는 문서는 [참고]로 뒤에
export const KIND_LABEL: Record<ImportKind, string> = {
  scheduleP04: '학사일정', timetableP02: '전담·학급 시간표', curriculumHwpx: '학년군 편제(hwpx)',
  neisLessons: '진도: NEIS형 엑셀(학교)', publisherLessons: '진도: 출판사 나이스 업로드용 엑셀', progressHwpx: '진도: 작년 진도표(hwpx)',
  timePlanHwpx: '[참고] 시간 운영계획(hwpx) — 출력 문서', planAdjustHwpx: '[참고] 시수증감 운영계획(hwpx) — 출력 문서',
  autonomyHwpx: '[참고] 학교자율시간 운영(안) — 받지 않음', unknown: '알 수 없음',
};

export interface Item {
  id: string;
  name: string;
  kind: ImportKind;
  notice?: string;
  error?: string;
  interp?: Interpretation;
  confirmed: boolean;
}

interface Props {
  item: Item;
  subjects: Subject[];
  onKind: (k: ImportKind) => void;
  onFix: (u: Unknown, subjectId: string) => void;
  onConfirm: () => void;
}

/** 파일 카드: 파일명·종류(바꿀 수 있음)·상태·노란 칸·원문/해석·확정 */
export function FileCard({ item, subjects, onKind, onFix, onConfirm }: Props) {
  const { interp } = item;
  const yellow = interp?.unknown.length ?? 0;
  const status = item.confirmed ? '확정' : item.error ? '읽지 못함' : item.notice && !item.interp ? '읽지 않음' : interp ? (yellow ? `확인 필요 ${yellow}칸` : '확인 가능') : '해석 중';
  return (
    <li className="file-card">
      <div className="row">
        <strong>{item.name}</strong>
        <select value={item.kind} onChange={(e) => onKind(e.target.value as ImportKind)} disabled={item.confirmed}>
          {Object.entries(KIND_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
        <span className={yellow ? 'yellow' : 'muted'}>{status}</span>
        <span className="spacer" />
        <button className="primary" onClick={onConfirm} disabled={!interp || item.confirmed || yellow > 0}>확정</button>
      </div>
      {item.notice && <p className="notice">{item.notice}</p>}
      {item.error && <p className="error">{item.error}</p>}
      {interp?.unknown.map((u) => (
        <p key={u.value} className="yellow-cell">
          모르는 {u.type === 'name' ? '편제 이름' : '시간표 약자'} '{u.value}' →{' '}
          <select defaultValue="" onChange={(e) => e.target.value && onFix(u, e.target.value)}>
            <option value="">교과 고르기</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </p>
      ))}
      {interp && (
        <div className="compare">
          <details><summary>원문</summary><pre>{interp.raw.join('\n')}</pre></details>
          <div>
            <b>해석</b>
            <ul>{interp.summary.map((s) => <li key={s}>{s}</li>)}</ul>
            {interp.warnings.map((w) => <p key={w} className="yellow-cell">{w}</p>)}
          </div>
        </div>
      )}
    </li>
  );
}
