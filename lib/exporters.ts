type WorkbookCellValue = string | number | boolean | Date | null | undefined;

type SimpleWorkbookSheet = {
  name: string;
  headers: string[];
  rows: WorkbookCellValue[][];
};

const BRAND_LOGO_URL = '/brand/logo/paper_logo.svg';
const SIGNATURE_TEXT = 'Généré par Sheet of Paper';

const EXCEL_MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const EXCEL_REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const EXCEL_CONTENT_TYPES_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';
const EXCEL_PROPS_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/extended-properties';
const EXCEL_PROPS_VT_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes';
const EXCEL_CORE_PROPS_NS = 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties';
const EXCEL_CORE_DC_NS = 'http://purl.org/dc/elements/1.1/';
const EXCEL_CORE_DCTERMS_NS = 'http://purl.org/dc/terms/';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/\r?\n/g, '&#10;');
}

function columnName(index: number): string {
  let dividend = index + 1;
  let columnLabel = '';
  while (dividend > 0) {
    const modulo = (dividend - 1) % 26;
    columnLabel = String.fromCharCode(65 + modulo) + columnLabel;
    dividend = Math.floor((dividend - modulo) / 26);
  }
  return columnLabel;
}

function sanitizeSheetName(name: string, fallback: string): string {
  const trimmed = name.trim().replace(/[\/*?:\[\]]/g, '').slice(0, 31);
  return trimmed.length > 0 ? trimmed : fallback;
}

function normaliseCellValue(value: WorkbookCellValue): WorkbookCellValue {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value) || (value && typeof value === 'object')) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return value;
}

function buildCellXml(columnIndex: number, rowIndex: number, rawValue: WorkbookCellValue): string {
  const cellRef = `${columnName(columnIndex)}${rowIndex}`;
  const value = normaliseCellValue(rawValue);
  if (value === null || value === undefined || value === '') {
    return `<c r="${cellRef}"/>`;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${cellRef}"><v>${value}</v></c>`;
  }
  if (typeof value === 'boolean') {
    return `<c r="${cellRef}" t="b"><v>${value ? 1 : 0}</v></c>`;
  }
  const stringValue = String(value);
  const preserveAttr = stringValue.trim() !== stringValue ? ' xml:space="preserve"' : '';
  return `<c r="${cellRef}" t="inlineStr"><is><t${preserveAttr}>${escapeXml(stringValue)}</t></is></c>`;
}

function buildSheetXml(headers: string[], rows: WorkbookCellValue[][]): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
  lines.push(`<worksheet xmlns="${EXCEL_MAIN_NS}">`);
  lines.push('<sheetData>');

  const dataRowOffset = headers.length > 0 ? 2 : 1;

  if (headers.length > 0) {
    const headerCells = headers.map((header, index) => buildCellXml(index, 1, header));
    lines.push(`<row r="1">${headerCells.join('')}</row>`);
  }

  rows.forEach((row, rowIndex) => {
    const excelRowIndex = rowIndex + dataRowOffset;
    const cells = row.map((value, columnIndex) => buildCellXml(columnIndex, excelRowIndex, value));
    lines.push(`<row r="${excelRowIndex}">${cells.join('')}</row>`);
  });

  lines.push('</sheetData>');
  lines.push('</worksheet>');
  return lines.join('');
}

function buildStylesXml(): string {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<fonts count="1"><font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font></fonts>'
    + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
    + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>'
    + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
    + '</styleSheet>';
}

function buildContentTypesXml(sheetCount: number): string {
  const overrides: string[] = [];
  for (let i = 0; i < sheetCount; i += 1) {
    overrides.push(`<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
  }
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + `<Types xmlns="${EXCEL_CONTENT_TYPES_NS}">`
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
    + '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
    + overrides.join('')
    + '</Types>';
}

function buildRootRelsXml(): string {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
    + '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
    + '</Relationships>';
}

function buildWorkbookXml(sheetNames: string[]): string {
  const sheetsXml = sheetNames
    .map((name, index) => `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
    .join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + `<workbook xmlns="${EXCEL_MAIN_NS}" xmlns:r="${EXCEL_REL_NS}">`
    + '<sheets>'
    + sheetsXml
    + '</sheets>'
    + '</workbook>';
}

function buildWorkbookRelsXml(sheetCount: number): string {
  const relationships = Array.from({ length: sheetCount }, (_, index) => (
    `<Relationship Id="rId${index + 1}" Type="${EXCEL_REL_NS}/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  ));
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + relationships.join('')
    + '</Relationships>';
}

function buildCorePropsXml(): string {
  const now = new Date().toISOString();
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + `<cp:coreProperties xmlns:cp="${EXCEL_CORE_PROPS_NS}" xmlns:dc="${EXCEL_CORE_DC_NS}" xmlns:dcterms="${EXCEL_CORE_DCTERMS_NS}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">`
    + `<dc:creator>${escapeXml('Sheet of Paper')}</dc:creator>`
    + `<cp:lastModifiedBy>${escapeXml('Sheet of Paper')}</cp:lastModifiedBy>`
    + `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>`
    + `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>`
    + '</cp:coreProperties>';
}

function buildAppPropsXml(sheetNames: string[]): string {
  const size = sheetNames.length;
  const titles = sheetNames
    .map((name) => `<vt:lpstr>${escapeXml(name)}</vt:lpstr>`)
    .join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + `<Properties xmlns="${EXCEL_PROPS_NS}" xmlns:vt="${EXCEL_PROPS_VT_NS}">`
    + '<Application>Sheet of Paper</Application>'
    + '<DocSecurity>0</DocSecurity>'
    + '<ScaleCrop>false</ScaleCrop>'
    + '<HeadingPairs>'
    + '<vt:vector size="2" baseType="variant">'
    + '<vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant>'
    + `<vt:variant><vt:i4>${size}</vt:i4></vt:variant>`
    + '</vt:vector>'
    + '</HeadingPairs>'
    + '<TitlesOfParts>'
    + `<vt:vector size="${size}" baseType="lpstr">${titles}</vt:vector>`
    + '</TitlesOfParts>'
    + '<Company></Company>'
    + '<LinksUpToDate>false</LinksUpToDate>'
    + '<SharedDoc>false</SharedDoc>'
    + '<HyperlinksChanged>false</HyperlinksChanged>'
    + '<AppVersion>1.0</AppVersion>'
    + '</Properties>';
}

async function buildWorkbookBlob(sheets: SimpleWorkbookSheet[]): Promise<Blob> {
  const preparedSheets = sheets.length ? sheets : [{ name: 'Sheet 1', headers: [], rows: [] }];
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const usedNames = new Set<string>();
  const sheetNames = preparedSheets.map((sheet, index) => {
    const base = sanitizeSheetName(sheet.name, `Sheet ${index + 1}`);
    let candidate = base;
    let suffix = 1;
    while (usedNames.has(candidate)) {
      const suffixText = ` (${suffix})`;
      const truncated = base.slice(0, Math.max(0, 31 - suffixText.length));
      candidate = `${truncated}${suffixText}`;
      suffix += 1;
    }
    usedNames.add(candidate);
    return candidate;
  });

  preparedSheets.forEach((sheet, index) => {
    const sheetXml = buildSheetXml(sheet.headers, sheet.rows);
    zip.file(`xl/worksheets/sheet${index + 1}.xml`, sheetXml);
  });

  zip.file('xl/styles.xml', buildStylesXml());
  zip.file('xl/workbook.xml', buildWorkbookXml(sheetNames));
  zip.file('xl/_rels/workbook.xml.rels', buildWorkbookRelsXml(preparedSheets.length));
  zip.file('[Content_Types].xml', buildContentTypesXml(preparedSheets.length));
  zip.file('_rels/.rels', buildRootRelsXml());
  zip.file('docProps/core.xml', buildCorePropsXml());
  zip.file('docProps/app.xml', buildAppPropsXml(sheetNames));

  return zip.generateAsync({ type: 'blob' });
}

function baseStyles(): string {
  return `:root { color-scheme: light; }
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: #1f2937;
  margin: 32px;
  line-height: 1.6;
  background: #ffffff;
}
header.export-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 12px;
  border-bottom: 2px solid #fbbf1d;
}
header.export-header h1 {
  font-size: 28px;
  margin: 0;
}
header.export-header p {
  margin: 0;
  font-size: 14px;
  color: #4b5563;
}
section.export-section {
  margin-bottom: 24px;
}
section.export-section h2 {
  font-size: 20px;
  margin: 0 0 12px 0;
  color: #0f172a;
}
section.export-section ul {
  margin: 0;
  padding-left: 20px;
}
section.export-section li {
  margin-bottom: 6px;
}
table.export-table {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0 20px 0;
  font-size: 14px;
}
table.export-table th,
table.export-table td {
  border: 1px solid #e5e7eb;
  padding: 8px 10px;
  text-align: left;
}
table.export-table th {
  background: #fef3c7;
  color: #92400e;
}
.export-signature {
  margin-top: 40px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #6b7280;
}
.export-signature img {
  width: 18px;
  height: 18px;
}
@media print {
  body { margin: 24px; }
  header.export-header { page-break-after: avoid; }
  .export-signature { page-break-before: avoid; }
}`;
}

export function escapeHtml(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildSignatureHtml(): string {
  return `
    <div class="export-signature">
      <img src="${BRAND_LOGO_URL}" alt="Sheet of Paper" />
      <span>${escapeHtml(SIGNATURE_TEXT)}</span>
    </div>
  `;
}

type PrintableDocumentOptions = {
  title: string;
  body: string;
  styles?: string;
  autoPrint?: boolean;
};

export function openPrintableDocument({ title, body, styles = '', autoPrint = true }: PrintableDocumentOptions): void {
  if (typeof window === 'undefined') return;
  const printWindow = window.open('', '_blank', 'width=900,height=1100');
  if (!printWindow) return;
  const fullStyles = `${baseStyles()}\n${styles}`;
  const signature = buildSignatureHtml();
  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>${fullStyles}</style>
</head>
<body>
${body}
${signature}
${autoPrint ? '<script>window.addEventListener("load",()=>{window.print();setTimeout(()=>window.close(),400);});</script>' : ''}
</body>
</html>`);
  printWindow.document.close();
}

type DownloadDocOptions = {
  filename: string;
  body: string;
  styles?: string;
};

export function downloadHtmlAsDoc({ filename, body, styles = '' }: DownloadDocOptions): void {
  if (typeof window === 'undefined') return;
  const fullStyles = `${baseStyles()}\n${styles}`;
  const signature = buildSignatureHtml();
  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(filename)}</title>
  <style>${fullStyles}</style>
</head>
<body>
${body}
${signature}
</body>
</html>`;
  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.doc') ? filename : `${filename}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

type WorkbookOptions = {
  filename: string;
  sheets: SimpleWorkbookSheet[];
};

export async function downloadWorkbook({ filename, sheets }: WorkbookOptions): Promise<void> {
  if (typeof window === 'undefined') return;
  const blob = await buildWorkbookBlob(sheets);
  const finalName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = finalName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

type JsonSheetOptions = {
  name: string;
  rows: Record<string, unknown>[];
};

export async function downloadJsonWorkbook(filename: string, sheets: JsonSheetOptions[]): Promise<void> {
  if (typeof window === 'undefined') return;
  const structuredSheets: SimpleWorkbookSheet[] = sheets.map((sheet, index) => {
    const headers: string[] = [];
    sheet.rows.forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (!headers.includes(key)) headers.push(key);
      });
    });
    const rows = sheet.rows.map((row) => headers.map((key) => row[key] as WorkbookCellValue));
    return {
      name: sheet.name ?? `Sheet ${index + 1}`,
      headers,
      rows,
    };
  });
  await downloadWorkbook({ filename, sheets: structuredSheets });
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}min ${seconds.toString().padStart(2, '0')}s`;
}
