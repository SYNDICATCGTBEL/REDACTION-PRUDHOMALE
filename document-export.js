const { AlignmentType, Document, Packer, Paragraph, ShadingType, TextRun, UnderlineType } = require('docx');

const DOCUMENT_FONT = 'Aptos';
const DOCUMENT_SIZE = 24;
const DECISION_PATTERN = /^(DIT|RECONNAÎT|PRONONCE|ORDONNE|CONDAMNE|DÉBOUTE)\b/iu;

function safeFileName(value) {
  return String(value || 'jugement').replace(/[\\/:*?"<>|]/g, '-').trim() || 'jugement';
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function colorToHex(value) {
  const color = String(value || '').trim();
  const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) return hex[1].length === 3 ? [...hex[1]].map(character => character + character).join('').toUpperCase() : hex[1].toUpperCase();
  const rgb = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) return rgb.slice(1, 4).map(number => Math.max(0, Math.min(255, Number(number))).toString(16).padStart(2, '0')).join('').toUpperCase();
  const named = { black: '000000', white: 'FFFFFF', red: 'FF0000', blue: '0000FF', green: '008000', yellow: 'FFFF00', pink: 'FFC0CB', cyan: '00FFFF', gray: '808080', grey: '808080' };
  return named[color.toLowerCase()] || '';
}

function fontSizeToHalfPoints(value) {
  const match = String(value || '').trim().match(/^(\d+(?:\.\d+)?)(pt|px)$/i);
  if (!match) return undefined;
  const points = match[2].toLowerCase() === 'px' ? Number(match[1]) * 0.75 : Number(match[1]);
  return Math.max(12, Math.min(144, Math.round(points * 2)));
}

function styleFromAttributes(attributes, parent, tagName) {
  const next = { ...parent };
  if (tagName === 'B' || tagName === 'STRONG') next.bold = true;
  if (tagName === 'I' || tagName === 'EM') next.italics = true;
  if (tagName === 'U') next.underline = true;
  if (tagName === 'S' || tagName === 'STRIKE') next.strike = true;
  if (tagName === 'SUB') next.subScript = true;
  if (tagName === 'SUP') next.superScript = true;
  if (tagName === 'H2') Object.assign(next, { bold: true, size: 36 });
  if (tagName === 'H3') Object.assign(next, { bold: true, size: 28 });
  const styleMatch = String(attributes || '').match(/\bstyle\s*=\s*["']([^"']*)["']/i);
  if (styleMatch) {
    for (const declaration of styleMatch[1].split(';')) {
      const separator = declaration.indexOf(':');
      if (separator < 0) continue;
      const property = declaration.slice(0, separator).trim().toLowerCase();
      const value = declaration.slice(separator + 1).trim();
      if (property === 'font-family') next.font = value.split(',')[0].replace(/["']/g, '').trim();
      if (property === 'font-size') next.size = fontSizeToHalfPoints(value) || next.size;
      if (property === 'color') next.color = colorToHex(value) || next.color;
      if (property === 'background-color') next.background = colorToHex(value) || next.background;
      if (property === 'text-align') next.alignment = value.toLowerCase();
    }
  }
  return next;
}

function runOptions(style, overrides = {}) {
  const options = {
    font: style.font || DOCUMENT_FONT,
    size: style.size || DOCUMENT_SIZE,
    bold: Boolean(style.bold),
    italics: Boolean(style.italics),
    strike: Boolean(style.strike),
    subScript: Boolean(style.subScript),
    superScript: Boolean(style.superScript),
    ...overrides
  };
  if (style.underline) options.underline = { type: UnderlineType.SINGLE };
  if (style.color) options.color = style.color;
  if (style.background) options.shading = { type: ShadingType.CLEAR, fill: style.background };
  return options;
}

function descriptorsToRuns(descriptors, emphasizeDecisions) {
  const runs = [];
  let lineStart = true;
  for (const descriptor of descriptors) {
    if (descriptor.break) {
      runs.push(new TextRun(runOptions(descriptor.style, { text: '', break: 1 })));
      lineStart = true;
      continue;
    }
    const text = descriptor.text || '';
    if (!text) continue;
    if (emphasizeDecisions && lineStart) {
      const match = text.match(/^(\s*)(DIT|RECONNAÎT|PRONONCE|ORDONNE|CONDAMNE|DÉBOUTE)(\b.*)$/iu);
      if (match) {
        if (match[1]) runs.push(new TextRun(runOptions(descriptor.style, { text: match[1] })));
        runs.push(new TextRun(runOptions(descriptor.style, { text: match[2].toUpperCase(), bold: true })));
        if (match[3]) runs.push(new TextRun(runOptions(descriptor.style, { text: match[3] })));
        lineStart = false;
        continue;
      }
    }
    runs.push(new TextRun(runOptions(descriptor.style, { text })));
    if (text.trim()) lineStart = false;
  }
  return runs.length ? runs : [new TextRun(runOptions({}, { text: ' ' }))];
}

function paragraphAlignment(value) {
  return ({ left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED })[value];
}

function richTextParagraphs(html, fallbackText, options = {}) {
  const safeHtml = String(html || '').replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
  if (!safeHtml.trim()) return String(fallbackText || '[À compléter]').split(/\r?\n/).map(line => textParagraph(line || ' ', { spacing: { after: 120 } }));
  const tokens = safeHtml.match(/<[^>]+>|[^<]+/g) || [];
  const blocks = [];
  const styleStack = [{ tag: 'ROOT', style: {} }];
  const listStack = [];
  let orderedIndex = 0;
  let current = { descriptors: [], alignment: undefined, list: null };
  const flush = force => {
    if (!force && !current.descriptors.some(item => item.break || item.text?.length)) return;
    const paragraphOptions = { spacing: { after: 120 } };
    const alignment = paragraphAlignment(current.alignment);
    if (alignment) paragraphOptions.alignment = alignment;
    if (current.list === 'ul') paragraphOptions.bullet = { level: 0 };
    const descriptors = [...current.descriptors];
    if (current.list === 'ol') descriptors.unshift({ text: `${++orderedIndex}. `, style: {} });
    blocks.push(new Paragraph({ ...paragraphOptions, children: descriptorsToRuns(descriptors, options.decision) }));
    current = { descriptors: [], alignment: undefined, list: listStack.at(-1) || null };
  };
  for (const token of tokens) {
    if (!token.startsWith('<')) {
      current.descriptors.push({ text: decodeHtml(token), style: styleStack.at(-1).style });
      continue;
    }
    const closing = /^<\//.test(token);
    const match = token.match(/^<\/?\s*([a-z0-9]+)([^>]*)>/i);
    if (!match) continue;
    const tagName = match[1].toUpperCase();
    const attributes = match[2] || '';
    if (tagName === 'BR' && !closing) {
      current.descriptors.push({ break: true, style: styleStack.at(-1).style });
      continue;
    }
    if (tagName === 'UL' || tagName === 'OL') {
      if (!closing) {
        flush(false);
        listStack.push(tagName.toLowerCase());
        if (tagName === 'OL') orderedIndex = 0;
        current.list = listStack.at(-1);
      } else {
        flush(false);
        listStack.pop();
        current.list = listStack.at(-1) || null;
      }
      continue;
    }
    const block = ['P', 'DIV', 'H2', 'H3', 'LI'].includes(tagName);
    if (!closing) {
      if (block) flush(false);
      const style = styleFromAttributes(attributes, styleStack.at(-1).style, tagName);
      styleStack.push({ tag: tagName, style });
      current.alignment = style.alignment || current.alignment;
      if (tagName === 'LI') current.list = listStack.at(-1) || 'ul';
    } else {
      if (block) flush(false);
      const index = styleStack.map(item => item.tag).lastIndexOf(tagName);
      if (index > 0) styleStack.splice(index);
    }
  }
  flush(false);
  return blocks.length ? blocks : [textParagraph(fallbackText || ' ', { spacing: { after: 120 } })];
}

function textParagraph(text, options = {}) {
  return new Paragraph({
    ...options,
    children: [new TextRun({ text: String(text || ''), font: DOCUMENT_FONT, size: DOCUMENT_SIZE })]
  });
}

function sectionParagraph(section) {
  const paragraphs = [new Paragraph({
    spacing: { before: 300, after: 120 },
    children: [new TextRun({ text: section.title.toUpperCase(), bold: true, font: DOCUMENT_FONT, size: DOCUMENT_SIZE })]
  })];
  const isDispositif = section.title.toLowerCase() === 'par ces motifs';
  const isMotifs = section.title.toLowerCase() === 'motifs de la décision';
  (section.fields || []).forEach(field => {
    if (field.title && !isMotifs) paragraphs.push(new Paragraph({ spacing: { before: 160, after: 90 }, children: [new TextRun({ text: field.title.toUpperCase(), bold: true, font: DOCUMENT_FONT, size: DOCUMENT_SIZE })] }));
    paragraphs.push(...richTextParagraphs(field.html, field.content || '[À compléter]', { decision: isDispositif }));
  });
  return paragraphs;
}

async function buildDocxBuffer(judgment) {
  const info = judgment?.info || {};
  const sections = judgment?.sections || [];
  const closings = judgment?.closings || (judgment?.closing ? [judgment.closing] : []);
  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [new TextRun({ text: 'CONSEIL DE PRUD’HOMMES', bold: true, font: DOCUMENT_FONT, size: 28 })]
    }),
    textParagraph(`Dossier : ${info.caseNumber || 'non renseigné'}`),
    textParagraph(`Demandeur : ${info.claimant || 'non renseigné'}`),
    textParagraph(`Défendeur : ${info.defendant || 'non renseigné'}`),
    textParagraph(`AGS : ${info.ags || 'non renseignés'}`),
    textParagraph(`Mandataire judiciaire : ${info.judicialRepresentative || 'non renseigné'}`),
    textParagraph(`Convention collective : ${info.collectiveAgreement || 'non renseignée'}`),
    textParagraph(`Date de saisine : ${info.filingDate || 'non renseignée'}`),
    textParagraph(`Audience : ${info.hearing || 'non renseignée'}`),
    textParagraph(`MDAG — Mise à disposition au greffe : ${info.judgmentDate || 'non renseignée'}`),
    ...sections.flatMap(section => sectionParagraph(section)),
    ...closings.filter(Boolean).flatMap((closing, index) => String(closing).split(/\n{2,}/).map((paragraph, paragraphIndex) => textParagraph(paragraph, { spacing: { before: index === 0 && paragraphIndex === 0 ? 320 : 220 } })))
  ];
  const document = new Document({
    sections: [{ properties: { page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } }, children }]
  });
  return Packer.toBuffer(document);
}

module.exports = { buildDocxBuffer, safeFileName };
