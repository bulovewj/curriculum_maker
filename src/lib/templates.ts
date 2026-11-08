// templates/*.hwpx 는 형이 한글에서 본문을 지워 만든 빈 양식(또는 npm run templates 로 만든 것)이다. 없어도 앱은 뜬다.
const urls = import.meta.glob('../../templates/*.hwpx', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

export type TemplateName = 'progress' | 'timeplan';

/** 빈 양식 읽기. 없으면 정해진 안내 문장으로 Error. */
export async function loadTemplate(name: TemplateName): Promise<ArrayBuffer> {
  const url = Object.entries(urls).find(([k]) => k.endsWith(`/${name}.hwpx`))?.[1];
  if (!url) throw new Error(`templates/${name}.hwpx가 필요합니다(CODING_PLAN 3장).`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`templates/${name}.hwpx를 읽지 못했습니다(${res.status}).`);
  return res.arrayBuffer();
}
