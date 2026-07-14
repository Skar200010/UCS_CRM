const fs = require('fs');
const { marked } = require('marked');
const htmlToDocx = require('html-to-docx');

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Read markdown
const md = fs.readFileSync(
  'C:\\Users\\Administrator\\Desktop\\attendance\\UCS_CRM\\docs\\MASTER_DOCUMENTATION.md',
  'utf-8'
);

// Custom renderers for marked v18
const renderer = new marked.Renderer();

renderer.heading = (...args) => {
  const text = args[0]?.text ?? args[0] ?? '';
  const level = args[0]?.depth ?? args[1] ?? 1;
  const anchor = String(text).toLowerCase().replace(/[^\w]+/g, '-');
  return `<h${level} id="${anchor}">${text}</h${level}>\n`;
};

renderer.code = (...args) => {
  const text = args[0]?.text ?? args[0] ?? '';
  const lang = args[0]?.lang ?? args[1] ?? '';
  return `<pre class="code-block"><code class="language-${lang}">${escapeHtml(text)}</code></pre>\n`;
};

renderer.codespan = (...args) => {
  const text = args[0]?.text ?? args[0] ?? '';
  return `<code class="inline-code">${escapeHtml(text)}</code>`;
};

renderer.paragraph = (...args) => {
  const text = args[0]?.text ?? args[0] ?? '';
  return `<p>${text}</p>\n`;
};

renderer.list = (...args) => {
  const body = args[0]?.text ?? args[0] ?? '';
  const ordered = args[0]?.ordered ?? false;
  return ordered ? `<ol>${body}</ol>\n` : `<ul>${body}</ul>\n`;
};

renderer.listitem = (...args) => {
  const text = args[0]?.text ?? args[0] ?? '';
  return `<li>${text}</li>\n`;
};

renderer.table = (...args) => {
  const header = args[0]?.header ?? args[0] ?? '';
  const body = args[0]?.rows ?? args[1] ?? '';
  const thead = header ? `<thead><tr>${header}</tr></thead>\n` : '';
  const tbody = body ? `<tbody>${body}</tbody>\n` : '';
  return `<table class="doc-table">${thead}${tbody}</table>\n`;
};

renderer.tablerow = (...args) => {
  const text = args[0]?.text ?? args[0] ?? '';
  return `<tr>${text}</tr>\n`;
};

renderer.tablecell = (...args) => {
  const content = args[0]?.text ?? args[0] ?? '';
  const token = args[0] || {};
  const tag = token.header ? 'th' : 'td';
  return `<${tag}>${content}</${tag}>\n`;
};

renderer.strong = (...args) => {
  const text = args[0]?.text ?? args[0] ?? '';
  return `<strong>${text}</strong>`;
};

renderer.em = (...args) => {
  const text = args[0]?.text ?? args[0] ?? '';
  return `<em>${text}</em>`;
};

renderer.blockquote = (...args) => {
  const text = args[0]?.text ?? args[0] ?? '';
  return `<blockquote>${text}</blockquote>\n`;
};

renderer.link = (...args) => {
  const href = args[0]?.href ?? args[1] ?? '';
  const text = args[0]?.text ?? args[0] ?? '';
  return `<a href="${href}">${text}</a>`;
};

renderer.hr = () => '<hr />\n';
renderer.br = () => '<br />\n';
renderer.image = (...args) => {
  const href = args[0]?.href ?? args[1] ?? '';
  const text = args[0]?.text ?? args[0] ?? '';
  return `<img src="${href}" alt="${text}" />\n`;
};

marked.setOptions({ renderer, gfm: true, breaks: false });

const htmlBody = marked.parse(md);

// Build complete HTML with professional CSS
const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #1E293B; margin: 1in; }
  h1 { font-family: 'Calibri Light', Calibri, sans-serif; font-size: 20pt; color: #1F3A5F; margin-top: 30pt; margin-bottom: 14pt; page-break-before: always; }
  h1:first-of-type { page-break-before: avoid; }
  h2 { font-family: 'Calibri Light', Calibri, sans-serif; font-size: 16pt; color: #2563EB; margin-top: 22pt; margin-bottom: 10pt; }
  h3 { font-family: 'Calibri Light', Calibri, sans-serif; font-size: 13pt; color: #1E293B; margin-top: 16pt; margin-bottom: 8pt; }
  h4 { font-family: 'Calibri Light', Calibri, sans-serif; font-size: 11pt; color: #334155; margin-top: 12pt; margin-bottom: 6pt; }
  p { margin: 0 0 6pt 0; text-align: justify; }

  table { width: 100%; border-collapse: collapse; margin: 8pt 0; font-size: 9pt; }
  th { background-color: #1E3A5F; color: #FFFFFF; font-weight: bold; padding: 5pt 6pt; border: 1pt solid #1E3A5F; text-align: left; }
  td { padding: 3pt 6pt; border: 1pt solid #CBD5E1; vertical-align: top; }
  tr:nth-child(even) td { background-color: #F8FAFC; }

  pre { background-color: #1E293B; color: #E2E8F0; font-family: Consolas, monospace; font-size: 8pt; padding: 8pt 10pt; margin: 6pt 0; white-space: pre-wrap; word-break: break-all; }
  pre code { background: none; color: inherit; padding: 0; font-family: inherit; font-size: inherit; }
  code { font-family: Consolas, monospace; font-size: 9.5pt; background-color: #F1F5F9; color: #2563EB; padding: 1pt 3pt; }
  blockquote { border-left: 3pt solid #2563EB; margin: 6pt 0; padding: 4pt 10pt; background-color: #EFF6FF; color: #1E40AF; }
  ul, ol { margin: 3pt 0 6pt 0; padding-left: 22pt; }
  li { margin-bottom: 2pt; }
  hr { border: none; border-top: 1pt solid #CBD5E1; margin: 16pt 0; }
  a { color: #2563EB; }
  strong { font-weight: bold; color: #0F172A; }
</style>
</head>
<body>
<div class="title-page" style="text-align:center;padding-top:120pt;">
  <h1 style="font-size:28pt;page-break-before:avoid;margin-bottom:4pt;">UCS CRM</h1>
  <p style="font-size:16pt;color:#2563EB;font-family:'Calibri Light',Calibri,sans-serif;margin-bottom:24pt;">Master Documentation</p>
  <hr style="width:60%;margin:14pt auto;" />
  <p style="font-size:10pt;color:#64748B;margin-top:40pt;line-height:2;">
    <strong>Last Updated:</strong> July 13, 2026<br/>
    <strong>Project Root:</strong> C:\Users\Administrator\Desktop\attendance\UCS_CRM<br/>
    <strong>Live Backend:</strong> https://ucs-crm-backend.vercel.app<br/>
    <strong>Document Type:</strong> Technical Reference / API Documentation
  </p>
</div>
<div style="page-break-before:always;">
<h1>Table of Contents</h1>
</div>
${htmlBody}
</body>
</html>`;

const htmlPath = 'C:\\Users\\Administrator\\Desktop\\attendance\\UCS_CRM\\docs\\MASTER_DOCUMENTATION.html';
fs.writeFileSync(htmlPath, html);
console.log(`✅ HTML generated: ${htmlPath}`);

// Convert HTML to DOCX using html-to-docx
const docxPath = 'C:\\Users\\Administrator\\Desktop\\attendance\\UCS_CRM\\docs\\MASTER_DOCUMENTATION.docx';

(async () => {
  try {
    const buffer = await htmlToDocx(html, null, {
      table: { style: 'border-collapse: collapse; width: 100%;' },
      font: 'Calibri',
      fontSize: 11,
    });
    fs.writeFileSync(docxPath, buffer);
    const stats = fs.statSync(docxPath);
    console.log(`✅ DOCX generated: ${docxPath}`);
    console.log(`   Size: ${(stats.size / 1024).toFixed(1)} KB`);
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
})();
