import { toPng } from 'html-to-image';

export async function downloadElementPng(
  elementId: string,
  filename: string,
): Promise<void> {
  const el = document.getElementById(elementId);
  if (!el) throw new Error('Export element not found');

  // Use scroll dimensions so wide brackets export fully (not viewport-clipped).
  const width = el.scrollWidth;
  const height = el.scrollHeight;

  const dataUrl = await toPng(el, {
    pixelRatio: 2,
    backgroundColor: '#0a0c10',
    cacheBust: true,
    width,
    height,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      overflow: 'visible',
    },
  });

  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
