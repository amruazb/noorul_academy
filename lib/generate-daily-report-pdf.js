import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export function buildPdfFilename({ date, className }) {
  const safeClass = (className || 'All-Classes').replace(/\s+/g, '-');
  const safeDate = date.replace(/-/g, '');
  return `Daily-Report-${safeClass}-${safeDate}.pdf`;
}

export async function generateDailyReportPdf(element) {
  if (!element) {
    throw new Error('PDF template not found.');
  }

  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * pageWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  return pdf;
}

export async function createDailyReportPdfFile(element, meta) {
  const pdf = await generateDailyReportPdf(element);
  const blob = pdf.output('blob');
  const filename = buildPdfFilename(meta);
  return new File([blob], filename, { type: 'application/pdf' });
}

export function downloadPdfFile(pdf, filename) {
  pdf.save(filename);
}

export function downloadBlobFile(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
}

export async function sharePdfToWhatsApp({ pdfFile, message, whatsappUrl }) {
  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.({ files: [pdfFile] })) {
    await navigator.share({
      title: pdfFile.name,
      text: message,
      files: [pdfFile]
    });
    return 'shared';
  }

  downloadBlobFile(pdfFile);
  window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  return 'download-and-open';
}
