import busan2027 from '../../data/standards/busan-2027.json';
import type { Standards } from '../model/standards';

/** 기준 데이터 판본 이름 → 데이터. 새 해 파일을 만들면 여기에 한 줄 더한다. */
export const STANDARDS: Record<string, Standards> = {
  'busan-2027': busan2027 as unknown as Standards,
};

export const standardsOf = (version: string): Standards => STANDARDS[version] ?? STANDARDS['busan-2027'];
