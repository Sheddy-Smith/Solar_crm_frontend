import { getMediaUrl } from '../api.js';

function safeFilePart(value, fallback = 'Survey') {
  const cleaned = String(value || '')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return cleaned || fallback;
}

function extensionFromUrl(url, fallback = 'jpg') {
  try {
    const path = String(url || '').split('?')[0];
    const match = path.match(/\.([a-zA-Z0-9]{2,5})$/);
    if (match) return match[1].toLowerCase();
  } catch {
    /* ignore */
  }
  return fallback;
}

function triggerBlobDownload(blob, filename) {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 2500);
}

async function fetchAuthenticatedBlob(imagePath) {
  const url = getMediaUrl(imagePath);
  if (!url) throw new Error('Photo URL missing');
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) throw new Error(`Photo download failed (${response.status})`);
  return response.blob();
}

function loadImageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const href = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(href);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(href);
      reject(new Error('Could not decode photo'));
    };
    image.src = href;
  });
}

function imageToJpegDataUrl(image, quality = 0.92) {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unsupported');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0);
  return canvas.toDataURL('image/jpeg', quality);
}

/** Download one survey photo at original binary quality (auth via getMediaUrl). */
export async function downloadSurveyPhoto(photo, label = 'Photo') {
  if (!photo?.image) throw new Error('No photo to download');
  const blob = await fetchAuthenticatedBlob(photo.image);
  const ext = extensionFromUrl(photo.image, (blob.type || '').includes('png') ? 'png' : 'jpg');
  const filename = `${safeFilePart(label || photo.slot || 'Site-Survey-Photo')}.${ext}`;
  triggerBlobDownload(blob, filename);
  return filename;
}

function orderedSurveyPhotos(photos, preferredSlots = []) {
  const list = Array.isArray(photos) ? photos.filter((p) => p?.image) : [];
  const bySlot = new Map();
  for (const photo of list) {
    const key = String(photo.slot || '');
    if (!bySlot.has(key)) bySlot.set(key, photo);
  }
  const ordered = [];
  const seen = new Set();
  for (const slot of preferredSlots) {
    const photo = bySlot.get(String(slot));
    if (photo && !seen.has(photo.id)) {
      ordered.push(photo);
      seen.add(photo.id);
    }
  }
  for (const photo of list) {
    if (!seen.has(photo.id)) {
      ordered.push(photo);
      seen.add(photo.id);
    }
  }
  return ordered;
}

/**
 * Build a multi-page PDF of the currently opened Site Survey photos only.
 * One photo per page, aspect-fit (no crop / no stretch).
 */
export async function downloadSurveyPhotosPdf({
  photos,
  preferredSlots = [],
  projectName = '',
  customerName = '',
  surveyId = '',
} = {}) {
  const ordered = orderedSurveyPhotos(photos, preferredSlots);
  if (!ordered.length) throw new Error('No uploaded photos in this Site Survey');

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  const headerSpace = 48;
  const maxWidth = pageWidth - margin * 2;
  const maxHeight = pageHeight - margin * 2 - headerSpace;

  for (let index = 0; index < ordered.length; index += 1) {
    const photo = ordered[index];
    if (index > 0) doc.addPage();

    const title = String(photo.slot || `Photo ${index + 1}`);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 50, 97);
    doc.text(title, margin, margin + 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(83, 100, 127);
    const meta = [
      projectName ? `Project: ${projectName}` : '',
      customerName ? `Customer: ${customerName}` : '',
      surveyId ? `Survey: ${surveyId}` : '',
      `${index + 1} / ${ordered.length}`,
    ].filter(Boolean).join('  ·  ');
    if (meta) doc.text(meta, margin, margin + 30, { maxWidth });

    const blob = await fetchAuthenticatedBlob(photo.image);
    const image = await loadImageFromBlob(blob);
    const dataUrl = imageToJpegDataUrl(image, 0.92);
    const naturalW = image.naturalWidth || image.width || 1;
    const naturalH = image.naturalHeight || image.height || 1;
    const scale = Math.min(maxWidth / naturalW, maxHeight / naturalH);
    const drawW = Math.max(1, naturalW * scale);
    const drawH = Math.max(1, naturalH * scale);
    const x = margin + (maxWidth - drawW) / 2;
    const y = margin + headerSpace + (maxHeight - drawH) / 2;
    doc.addImage(dataUrl, 'JPEG', x, y, drawW, drawH, undefined, 'FAST');
  }

  const nameBits = [
    safeFilePart(projectName || customerName || 'Site-Survey', 'Site-Survey'),
    surveyId ? safeFilePart(surveyId, 'Survey') : 'Photos',
  ];
  const filename = `${nameBits.join('_')}_SiteSurvey_Photos.pdf`;
  doc.save(filename);
  return { filename, count: ordered.length };
}
