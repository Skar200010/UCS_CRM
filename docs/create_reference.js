const { Document, Packer, Paragraph, TextRun, StyleLevel, HeadingLevel, TabStopType, TabStopPosition, AlignmentType } = require('docx');
const fs = require('fs');

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: 'Calibri', size: 22, color: '1E293B' },
        paragraph: { spacing: { after: 120, line: 276 } },
      },
    },
    paragraphStyles: [
      {
        id: 'Heading1',
        name: 'heading 1',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        level: StyleLevel.SECTION,
        run: { font: 'Calibri Light', size: 52, bold: true, color: '1F3A5F' },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: HeadingLevel.HEADING_1 },
      },
      {
        id: 'Heading2',
        name: 'heading 2',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        level: StyleLevel.SECTION,
        run: { font: 'Calibri Light', size: 44, bold: true, color: '2563EB' },
        paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: HeadingLevel.HEADING_2 },
      },
      {
        id: 'Heading3',
        name: 'heading 3',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        level: StyleLevel.SECTION,
        run: { font: 'Calibri Light', size: 36, bold: true, color: '1E293B' },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: HeadingLevel.HEADING_3 },
      },
      {
        id: 'Heading4',
        name: 'heading 4',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        level: StyleLevel.SECTION,
        run: { font: 'Calibri Light', size: 32, bold: true, color: '334155' },
        paragraph: { spacing: { before: 160, after: 100 }, outlineLevel: HeadingLevel.HEADING_4 },
      },
      {
        id: 'Code',
        name: 'Code',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: { font: 'Consolas', size: 18, color: 'E2E8F0' },
        paragraph: { spacing: { after: 0, line: 240 } },
      },
      {
        id: 'TableHeader',
        name: 'Table Header',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: { font: 'Calibri', size: 20, bold: true, color: 'FFFFFF' },
        paragraph: { spacing: { after: 0 } },
      },
      {
        id: 'TableContent',
        name: 'Table Content',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: { font: 'Calibri', size: 20, color: '1E293B' },
        paragraph: { spacing: { after: 0 } },
      },
    ],
  },
  sections: [
    {
      children: [
        new Paragraph({
          text: 'UCS CRM — Master Documentation',
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({ text: 'Last Updated: July 13, 2026', spacing: { after: 200 } }),
        new Paragraph({
          text: 'This is a reference document for pandoc styling.',
          spacing: { after: 400 },
          style: 'Normal',
        }),
        new Paragraph({
          text: 'Heading 1 Example',
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          text: 'Heading 2 Example',
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({
          text: 'Heading 3 Example',
          heading: HeadingLevel.HEADING_3,
        }),
        new Paragraph({
          text: 'Heading 4 Example',
          heading: HeadingLevel.HEADING_4,
        }),
        new Paragraph({
          text: 'Normal paragraph text in Calibri 11pt with proper spacing for body content.',
          spacing: { after: 120, line: 276 },
        }),
        new Paragraph({
          text: 'Code block example in Consolas font:',
          spacing: { after: 60 },
        }),
        new Paragraph({
          text: 'const x = 42;',
          style: 'Code',
          spacing: { after: 0, line: 240 },
        }),
        new Paragraph({
          text: 'function test() { return true; }',
          style: 'Code',
          spacing: { after: 120, line: 240 },
        }),
      ],
    },
  ],
});

(async () => {
  const buffer = await Packer.toBuffer(doc);
  const outPath = 'C:\\Users\\Administrator\\Desktop\\attendance\\UCS_CRM\\docs\\pandoc-reference.docx';
  fs.writeFileSync(outPath, buffer);
  console.log('✅ Reference document created at:', outPath);
})();
