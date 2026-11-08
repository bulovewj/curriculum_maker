// 빈 양식 만들기: npm run templates
// 한글에서 본문을 모두 지우고 저장한 파일과 같은 모양을 얻기 위해, 정답지 hwpx에서 본문(표)만 지운다.
// 쪽 설정·글꼴·표 스타일(header.xml)과 첫 문단의 구역 설정(secPr)은 그대로 남는다.
import { readFileSync, writeFileSync } from 'node:fs';
import JSZip from 'jszip';
import { ORIGINAL, findFile } from '../tests/files';

const bytes = (p: string) => readFileSync(p);

async function blank(source: string, out: string) {
  const zip = await JSZip.loadAsync(bytes(source));
  const section = await zip.file('Contents/section0.xml')!.async('string');
  const cut = section.indexOf('<hp:tbl');
  if (cut < 0) throw new Error(`${source}: 표를 찾지 못했습니다.`);
  // 첫 문단(구역 설정 포함)만 남긴다. 표가 시작하기 전까지 + 빈 글 + 문단 끝
  zip.file('Contents/section0.xml', `${section.slice(0, cut)}<hp:t/></hp:run></hp:p></hs:sec>`, { createFolders: false });
  // 정답지 내용이 비치지 않게 미리보기를 지우고, 작성자 표시를 비운다(manifest에 올라 있지 않아 지워도 된다)
  zip.remove('Preview/PrvText.txt');
  zip.remove('Preview/PrvImage.png');
  const hpf = await zip.file('Contents/content.hpf')!.async('string');
  zip.file('Contents/content.hpf', hpf.replace(/(name="lastsaveby" content="text">)[^<]*(<)/, '$1$2'), { createFolders: false });
  zip.file('mimetype', await zip.file('mimetype')!.async('string'), { compression: 'STORE', createFolders: false }); // hwpx는 mimetype을 압축하지 않는다
  const data = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', mimeType: 'application/hwp+zip' });
  writeFileSync(out, data);
}

async function main() {
  const need = (key: string) => {
    const f = findFile(ORIGINAL, key);
    if (!f) throw new Error(`원본이 없어 만들 수 없습니다: ${ORIGINAL}/…${key}…`);
    return f;
  };
  await blank(need('1학기 교과진도'), 'templates/progress.hwpx');
  await blank(need('시간 운영계획'), 'templates/timeplan.hwpx');
  console.log('templates/progress.hwpx, templates/timeplan.hwpx 를 만들었습니다.');
}
main();
