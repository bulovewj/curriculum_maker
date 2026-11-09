import JSZip from 'jszip';

const TAIL = '<hp:t/></hp:run></hp:p></hs:sec>';

/** 첫 표를 넣을 자리까지의 앞부분(구역 설정이 든 첫 문단). 빈 양식의 본문 끝은 TAIL이다. */
function prefixOf(section: string): string {
  if (!section.endsWith(TAIL)) throw new Error('빈 양식의 본문 모양이 예상과 다릅니다. npm run templates 로 양식을 다시 만드세요.');
  return section.slice(0, -TAIL.length);
}

const PARA = '<hp:p id="0" paraPrIDRef="1" styleIDRef="0" pageBreak="1" columnBreak="0" merged="0"><hp:run charPrIDRef="1">';

/**
 * 빈 양식 hwpx(zip)의 본문에 표들을 넣어 새 hwpx를 만든다. 표마다 새 쪽에서 시작한다.
 * 한글이 저장한 모양을 그대로 따른다: 첫 표는 구역 설정 문단 안, 다음 표는 쪽 나눔 문단마다.
 */
export async function fillTemplate(template: ArrayBuffer, tables: string[], fontScale?: number): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(template);
  if (fontScale && fontScale !== 100) await scaleFonts(zip, fontScale);
  const file = zip.file('Contents/section0.xml');
  if (!file) throw new Error('hwpx 본문(Contents/section0.xml)이 없습니다.');
  const prefix = prefixOf(await file.async('string'));
  const body = tables.map((t, i) => (i === 0 ? t : `${PARA}${t}`) + '<hp:t/></hp:run></hp:p>').join('');
  zip.file('Contents/section0.xml', `${prefix}${body}</hs:sec>`, { createFolders: false });
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
}

/** 양식의 글자 모양(charPr) 크기를 모두 비율(%)로 바꾼다. 한 쪽에 안 들어갈 때 줄이는 설정 */
async function scaleFonts(zip: JSZip, percent: number): Promise<void> {
  const head = zip.file('Contents/header.xml');
  if (!head) return;
  const xml = (await head.async('string')).replace(/(<hh:charPr\b[^>]*\bheight=")(\d+)"/g, (_m, pre: string, h: string) => `${pre}${Math.max(100, Math.round((Number(h) * percent) / 100))}"`);
  zip.file('Contents/header.xml', xml, { createFolders: false });
}
