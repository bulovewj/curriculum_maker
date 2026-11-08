/** 브라우저에서 파일 내려받기 */
export function download(fileName: string, data: ArrayBuffer | string, type: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000); // 바로 풀면 일부 브라우저(Safari)에서 빈 파일이 된다
}
