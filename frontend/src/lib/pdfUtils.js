import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

// Use a CDN worker that matches the installed pdfjs-dist version.
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';

export const readFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });

export const download = (bytes, filename, type = 'application/pdf') => {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

export const getPageCount = async (file) => {
  const doc = await PDFDocument.load(await readFile(file), { ignoreEncryption: true });
  return doc.getPageCount();
};

// Merge multiple PDFs (in given order) into one
export const mergePdfs = async (files) => {
  const out = await PDFDocument.create();
  for (const f of files) {
    if (f.type && f.type.startsWith('image/')) {
      let bytes = new Uint8Array(await readFile(f));
      let img;
      if (f.type === 'image/png') img = await out.embedPng(bytes);
      else if (f.type === 'image/jpeg') img = await out.embedJpg(bytes);
      else {
        const url = URL.createObjectURL(f);
        const el = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
        const canvas = document.createElement('canvas');
        canvas.width = el.naturalWidth; canvas.height = el.naturalHeight;
        canvas.getContext('2d').drawImage(el, 0, 0);
        URL.revokeObjectURL(url);
        const dataUrl = canvas.toDataURL('image/png');
        img = await out.embedPng(dataUrl);
      }
      const page = out.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    } else {
      const src = await PDFDocument.load(await readFile(f), { ignoreEncryption: true });
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((p) => out.addPage(p));
    }
  }
  return out.save();
};

// Parse a range string like "1-3, 5, 8-10" into 0-based unique indices
export const parseRanges = (str, total) => {
  const set = new Set();
  (str || '').split(',').forEach((part) => {
    const t = part.trim();
    if (!t) return;
    if (t.includes('-')) {
      let [a, b] = t.split('-').map((n) => parseInt(n.trim(), 10));
      if (isNaN(a)) a = 1;
      if (isNaN(b)) b = total;
      for (let i = a; i <= b; i++) if (i >= 1 && i <= total) set.add(i - 1);
    } else {
      const n = parseInt(t, 10);
      if (!isNaN(n) && n >= 1 && n <= total) set.add(n - 1);
    }
  });
  return [...set].sort((a, b) => a - b);
};

// Extract only the given 0-based indices into a new PDF
export const extractPages = async (file, indices) => {
  const src = await PDFDocument.load(await readFile(file), { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, indices);
  pages.forEach((p) => out.addPage(p));
  return out.save();
};

// Split into one PDF per range group -> returns array of {name, bytes}
export const splitByRanges = async (file, rangeStr) => {
  const src = await PDFDocument.load(await readFile(file), { ignoreEncryption: true });
  const total = src.getPageCount();
  const groups = (rangeStr || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const results = [];
  const base = file.name.replace(/\.pdf$/i, '');
  let idx = 1;
  for (const g of groups) {
    const indices = parseRanges(g, total);
    if (!indices.length) continue;
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, indices);
    pages.forEach((p) => out.addPage(p));
    results.push({ name: `${base}_part${idx}.pdf`, bytes: await out.save() });
    idx++;
  }
  return results;
};

export const removePages = async (file, indicesToRemove) => {
  const src = await PDFDocument.load(await readFile(file), { ignoreEncryption: true });
  const total = src.getPageCount();
  const keep = [];
  for (let i = 0; i < total; i++) if (!indicesToRemove.includes(i)) keep.push(i);
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, keep);
  pages.forEach((p) => out.addPage(p));
  return out.save();
};

// Rebuild the PDF in the exact order given (array of 0-based indices)
export const reorderPages = async (file, order) => {
  const src = await PDFDocument.load(await readFile(file), { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, order);
  pages.forEach((p) => out.addPage(p));
  return out.save();
};

// Rotate: angle applied to all pages (or a subset of indices)
export const rotatePdf = async (file, angle, indices = null) => {
  const doc = await PDFDocument.load(await readFile(file), { ignoreEncryption: true });
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    if (indices && !indices.includes(i)) return;
    const current = p.getRotation().angle || 0;
    p.setRotation(degrees((current + angle) % 360));
  });
  return doc.save();
};

// Images -> single PDF
export const imagesToPdf = async (files, { fit = 'fit', margin = 24 } = {}) => {
  const out = await PDFDocument.create();
  for (const f of files) {
    const bytes = await readFile(f);
    let img;
    if (/png$/i.test(f.type) || /\.png$/i.test(f.name)) img = await out.embedPng(bytes);
    else img = await out.embedJpg(bytes);
    const iw = img.width;
    const ih = img.height;
    const page = out.addPage([iw + margin * 2, ih + margin * 2]);
    page.drawImage(img, { x: margin, y: margin, width: iw, height: ih });
  }
  return out.save();
};

// PDF -> array of JPG blobs (rendered via pdf.js)
export const pdfToImages = async (file, { scale = 2, quality = 0.92, onProgress } = {}) => {
  const data = await readFile(file);
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const images = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    images.push({ blob, name: `page_${n}.jpg`, url: URL.createObjectURL(blob) });
    if (onProgress) onProgress(n, pdf.numPages);
  }
  return images;
};

// Render first N page thumbnails (data urls) for previews
export const renderThumbnails = async (file, max = 30, scale = 0.5) => {
  const data = await readFile(file);
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const thumbs = [];
  const count = Math.min(pdf.numPages, max);
  for (let n = 1; n <= count; n++) {
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    thumbs.push({ index: n - 1, url: canvas.toDataURL('image/jpeg', 0.7) });
  }
  return { thumbs, total: pdf.numPages };
};

export const addPageNumbers = async (file, { position = 'bottom-center', start = 1, size = 11 } = {}) => {
  const doc = await PDFDocument.load(await readFile(file), { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const { width, height } = p.getSize();
    const label = `${start + i}`;
    const tw = font.widthOfTextAtSize(label, size);
    let x = width / 2 - tw / 2;
    let y = 18;
    if (position.includes('top')) y = height - 24;
    if (position.includes('left')) x = 28;
    if (position.includes('right')) x = width - tw - 28;
    p.drawText(label, { x, y, size, font, color: rgb(0.25, 0.25, 0.3) });
  });
  return doc.save();
};

export const addWatermark = async (file, { text = 'CONFIDENTIAL', size = 48, opacity = 0.25, rotate = 45 } = {}) => {
  const doc = await PDFDocument.load(await readFile(file), { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.getPages().forEach((p) => {
    const { width, height } = p.getSize();
    const tw = font.widthOfTextAtSize(text, size);
    p.drawText(text, {
      x: width / 2 - tw / 2,
      y: height / 2,
      size,
      font,
      color: rgb(1, 0.18, 0.33),
      opacity,
      rotate: degrees(rotate),
    });
  });
  return doc.save();
};

// Render a single page to a data URL at a target preview width (px).
// Returns pt dimensions so callers can map overlay coordinates back to PDF space.
export const renderPageImage = async (file, pageIndex = 0, previewWidth = 640) => {
  const data = await readFile(file);
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const page = await pdf.getPage(pageIndex + 1);
  const vp1 = page.getViewport({ scale: 1 });
  const scale = previewWidth / vp1.width;
  const vp = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(vp.width);
  canvas.height = Math.ceil(vp.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.85),
    ptW: vp1.width,
    ptH: vp1.height,
    pxW: canvas.width,
    pxH: canvas.height,
    total: pdf.numPages,
  };
};

// Embed a PNG signature (data URL) onto one page at preview-space coordinates.
export const placeSignature = async (file, { pageIndex, sigPngDataUrl, box, preview }) => {
  const bytes = await readFile(file);
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const png = await doc.embedPng(sigPngDataUrl);
  const page = doc.getPages()[pageIndex];
  const { width: ptW, height: ptH } = page.getSize();
  const sx = ptW / preview.pxW; // pt per preview px
  const sy = ptH / preview.pxH;
  const x = box.x * sx;
  const w = box.w * sx;
  const h = box.h * sy;
  const y = ptH - (box.y + box.h) * sy;
  page.drawImage(png, { x, y, width: w, height: h });
  return doc.save();
};

// Lightweight "compress": re-save with object streams. Real gains vary by source.
export const compressPdf = async (file) => {
  const doc = await PDFDocument.load(await readFile(file), { ignoreEncryption: true });
  return doc.save({ useObjectStreams: true });
};

// Render all pages once to canvases (kept in memory for re-encoding).
const renderPageCanvases = async (data, baseScale, onProgress) => {
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const canvases = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const vp1 = page.getViewport({ scale: 1 }); // points (72dpi)
    const vp = page.getViewport({ scale: baseScale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(vp.width);
    canvas.height = Math.ceil(vp.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    canvases.push({ canvas, ptW: vp1.width, ptH: vp1.height });
    if (onProgress) onProgress(Math.round((n / pdf.numPages) * 40));
  }
  return canvases;
};

const buildRasterPdf = async (canvases, scaleFactor, quality) => {
  const out = await PDFDocument.create();
  for (const c of canvases) {
    let src = c.canvas;
    if (scaleFactor < 0.999) {
      const tmp = document.createElement('canvas');
      tmp.width = Math.max(1, Math.round(c.canvas.width * scaleFactor));
      tmp.height = Math.max(1, Math.round(c.canvas.height * scaleFactor));
      const tctx = tmp.getContext('2d');
      tctx.fillStyle = '#ffffff';
      tctx.fillRect(0, 0, tmp.width, tmp.height);
      tctx.drawImage(c.canvas, 0, 0, tmp.width, tmp.height);
      src = tmp;
    }
    const blob = await new Promise((r) => src.toBlob(r, 'image/jpeg', quality));
    const buf = await blob.arrayBuffer();
    const img = await out.embedJpg(buf);
    const page = out.addPage([c.ptW, c.ptH]);
    page.drawImage(img, { x: 0, y: 0, width: c.ptW, height: c.ptH });
  }
  return out.save({ useObjectStreams: true });
};

// Compress a PDF trying to land at or below targetBytes. Returns { bytes, size }.
export const compressToTarget = async (file, targetBytes, { onProgress } = {}) => {
  const data = await readFile(file);
  // First, a cheap lossless re-save. If it already meets the target, use it.
  const lossless = await compressPdf(file);
  if (targetBytes && lossless.length <= targetBytes) {
    return { bytes: lossless, size: lossless.length };
  }

  const canvases = await renderPageCanvases(data, 2.0, onProgress);
  const scales = [1, 0.8, 0.62, 0.48, 0.36, 0.26];
  let best = null; // best <= target (highest quality)
  let smallest = null; // fallback: smallest overall

  const track = (bytes) => {
    if (!smallest || bytes.length < smallest.length) smallest = bytes;
  };

  outer: for (let si = 0; si < scales.length; si++) {
    const sf = scales[si];
    let lo = 0.28, hi = 0.9, found = null;
    for (let it = 0; it < 6; it++) {
      const q = (lo + hi) / 2;
      const bytes = await buildRasterPdf(canvases, sf, q);
      track(bytes);
      if (onProgress) onProgress(40 + Math.min(55, si * 9 + it * 1.5));
      if (!targetBytes || bytes.length <= targetBytes) {
        found = bytes; // meets target, try higher quality
        lo = q;
      } else {
        hi = q; // too big, lower quality
      }
    }
    if (found) { best = found; break outer; }
    // if even lowest quality at this scale is over target, go smaller scale
  }

  if (onProgress) onProgress(100);
  const chosen = best || smallest || lossless;
  return { bytes: chosen, size: chosen.length };
};
