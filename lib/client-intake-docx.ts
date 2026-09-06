import {
  AlignmentType, BorderStyle, Document, Footer, HeadingLevel, Packer, PageNumber,
  Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx';
import type { ClientIntake } from './client-intake';

const navy = '14275B';
const paleBlue = 'EEF4FF';
const gray = '65728C';
const line = 'D9D9D9';

function valueParagraph(label: string, value: string) {
  return new Paragraph({ spacing: { after: 150 }, children: [
    new TextRun({ text: `${label}: `, bold: true, color: navy }),
    new TextRun({ text: value || 'Not provided', color: value ? '111827' : gray, italics: !value }),
  ] });
}

function listSection(label: string, values: string[]) {
  const clean = values.filter(Boolean);
  return [
    new Paragraph({ text: label, heading: HeadingLevel.HEADING_2, spacing: { before: 180, after: 80 } }),
    ...(clean.length ? clean.map((value) => new Paragraph({ text: value, bullet: { level: 0 }, spacing: { after: 60 } }))
      : [new Paragraph({ children: [new TextRun({ text: 'Not provided', color: gray, italics: true })], spacing: { after: 100 } })]),
  ];
}

function statusCell(label: string, value: string) {
  return new TableCell({ width: { size: 33, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: paleBlue },
    margins: { top: 120, bottom: 120, left: 140, right: 140 }, children: [
      new Paragraph({ children: [new TextRun({ text: label, bold: true, color: navy, size: 19 })], spacing: { after: 50 } }),
      new Paragraph({ children: [new TextRun({ text: value || 'Not provided', color: value ? '111827' : gray, bold: true })] }),
    ] });
}

export function createClientIntakeDocument(input: { intake: ClientIntake; domain: string; createdAt: string }) {
  const { intake } = input;
  const border = { style: BorderStyle.SINGLE, size: 1, color: line };
  return new Document({
    creator: 'SpyderWeb', title: `${intake.clientName || 'Client'} Project Details`, description: 'Client website project intake details',
    styles: {
      default: { document: { run: { font: 'Aptos', size: 22, color: '111827' }, paragraph: { spacing: { line: 276 } } } },
      paragraphStyles: [
        { id: 'Title', name: 'Title', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { font: 'Aptos Display', size: 38, bold: true, color: '000000' }, paragraph: { spacing: { after: 120 } } },
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { font: 'Aptos Display', size: 27, bold: true, color: '000000' }, paragraph: { spacing: { before: 300, after: 130 }, keepNext: true } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { font: 'Aptos', size: 23, bold: true, color: '000000' }, paragraph: { spacing: { before: 220, after: 90 }, keepNext: true } },
      ],
    },
    sections: [{
      properties: { page: { margin: { top: 900, right: 900, bottom: 800, left: 900 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [
        new TextRun({ text: 'SpyderWeb Project Details   ', color: gray, size: 18 }),
        new TextRun({ children: [PageNumber.CURRENT], color: gray, size: 18 }),
      ] })] }) },
      children: [
        new Paragraph({ text: 'New Client Website Project Details', style: 'Title' }),
        new Paragraph({ children: [new TextRun({ text: 'Prepared for website planning, content production and build handover.', color: gray, size: 22 })], spacing: { after: 260 } }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [3200, 3200],
          borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
          rows: [new TableRow({ children: [
            new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, margins: { top: 130, bottom: 130, left: 150, right: 150 }, children: [valueParagraph('Client', intake.clientName)] }),
            new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, margins: { top: 130, bottom: 130, left: 150, right: 150 }, children: [valueParagraph('Development domain', input.domain)] }),
          ] }), new TableRow({ children: [
            new TableCell({ margins: { top: 130, bottom: 130, left: 150, right: 150 }, children: [valueParagraph('Industry', intake.industry)] }),
            new TableCell({ margins: { top: 130, bottom: 130, left: 150, right: 150 }, children: [valueParagraph('Prepared', new Date(input.createdAt).toLocaleDateString('en-ZA'))] }),
          ] })] }),
        new Paragraph({ text: 'Client and Contact Details', heading: HeadingLevel.HEADING_1 }),
        valueParagraph('Primary location or region', intake.primaryRegion), valueParagraph('Phone', intake.phone),
        valueParagraph('Email', intake.email), valueParagraph('WhatsApp', intake.whatsapp),
        valueParagraph('Contact form recipient email', intake.contactFormEmail), valueParagraph('Business address', intake.businessAddress),
        new Paragraph({ text: 'Reference Links', heading: HeadingLevel.HEADING_1 }),
        valueParagraph('Existing website for context and content reference only', intake.existingWebsite),
        ...listSection('Google Business Profile Links', intake.googleBusinessProfiles),
        ...listSection('Facebook and Social Accounts', intake.socialAccounts),
        new Paragraph({ text: 'Asset Readiness', heading: HeadingLevel.HEADING_1 }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border }, rows: [new TableRow({ children: [
          statusCell('Client folder created', intake.clientFolderCreated), statusCell('Logo resized and ready', intake.logoReady), statusCell('Image generation examples', intake.imageAssetExamples),
        ] })] }),
        new Paragraph({ text: 'Home Page Direction', heading: HeadingLevel.HEADING_1 }),
        valueParagraph('Home page H1', intake.homePageH1), valueParagraph('Focus key phrase', intake.focusKeyphrase),
        ...listSection('Primary Services for the Home Page', intake.primaryServices),
        ...listSection('Additional Services for the Services Page', intake.additionalServices),
        ...listSection('Additional Locations', intake.additionalLocations),
        new Paragraph({ text: 'Content and Brand Direction', heading: HeadingLevel.HEADING_1 }),
        valueParagraph('Additional information', intake.additionalInformation),
        ...listSection('Trust Facts', intake.trustFacts),
        valueParagraph('Brand guidelines', intake.brandGuidelines), valueParagraph('Content style', intake.contentStyle),
        valueParagraph('Colours and styles to avoid', intake.colorsToAvoid),
        new Paragraph({ text: 'Image Permissions', heading: HeadingLevel.HEADING_1 }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border }, rows: [new TableRow({ children: [
          statusCell('Client images available', intake.clientImagesAvailable), statusCell('AI images permitted', intake.aiImagesPermitted), statusCell('Free stock permitted', intake.stockImagesPermitted),
        ] })] }),
      ],
    }],
  });
}

export async function clientIntakeDocx(input: { intake: ClientIntake; domain: string; createdAt: string }) {
  return Packer.toBuffer(createClientIntakeDocument(input));
}
