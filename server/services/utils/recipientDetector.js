const sanitizeName = (name) => {
  if (!name) return null;
  return String(name)
    .replace(/^[\s-,:]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const applyPattern = (text, { regex, direction = null, executionMethod = null }) => {
  if (!text) return null;
  const match = text.match(regex);
  if (match && match[1]) {
    const recipientName = sanitizeName(match[1]);
    if (!recipientName) return null;
    const cleanedNotes = text.replace(regex, '').trim() || null;
    return { recipientName, cleanedNotes, direction, executionMethod };
  }
  return null;
};

const detectFromDescription = (description) => {
  const desc = description ? String(description).trim() : '';
  if (!desc) return null;

  const patterns = [
    // Bit / Paybox Hebrew
    { regex: /העברה\s+בביט\s+ל\s+(.+)/i, direction: 'outgoing', executionMethod: 'bit' },
    { regex: /העברה\s+בביט\s+מ\s+(.+)/i, direction: 'incoming', executionMethod: 'bit' },
    { regex: /העברה\s+בפייבוקס\s+ל\s+(.+)/i, direction: 'outgoing', executionMethod: 'paybox' },
    { regex: /העברה\s+בפייבוקס\s+מ\s+(.+)/i, direction: 'incoming', executionMethod: 'paybox' },
    { regex: /ביט\s+ל\s+(.+)/i, direction: 'outgoing', executionMethod: 'bit' },
    { regex: /ביט\s+מ(?:-|ן)?\s+(.+)/i, direction: 'incoming', executionMethod: 'bit' },
    { regex: /פייבוקס\s+ל\s+(.+)/i, direction: 'outgoing', executionMethod: 'paybox' },
    { regex: /פייבוקס\s+מ(?:-|ן)?\s+(.+)/i, direction: 'incoming', executionMethod: 'paybox' },
    // English variants
    { regex: /\bBIT\s*(?:TO)?\s+(.+)/i, direction: 'outgoing', executionMethod: 'bit' },
    { regex: /\bBIT\s*(?:FROM)\s+(.+)/i, direction: 'incoming', executionMethod: 'bit' },
    { regex: /\bPAYBOX\b\s*(?:TO)?\s+(.+)/i, direction: 'outgoing', executionMethod: 'paybox' },
    { regex: /\bPAYBOX\b\s*(?:FROM)\s+(.+)/i, direction: 'incoming', executionMethod: 'paybox' },
    // Generic transfer with Bit/Paybox
    { regex: /bit[^א-תA-Za-z0-9]{0,2}ל\s+(.+)/i, direction: 'outgoing', executionMethod: 'bit' },
    { regex: /bit[^א-תA-Za-z0-9]{0,2}מ(?:-|ן)?\s+(.+)/i, direction: 'incoming', executionMethod: 'bit' },
    { regex: /paybox[^א-תA-Za-z0-9]{0,2}ל\s+(.+)/i, direction: 'outgoing', executionMethod: 'paybox' },
    { regex: /paybox[^א-תA-Za-z0-9]{0,2}מ(?:-|ן)?\s+(.+)/i, direction: 'incoming', executionMethod: 'paybox' }
  ];

  for (const pattern of patterns) {
    const result = applyPattern(desc, pattern);
    if (result) return result;
  }
  return null;
};

const detectFromNotes = (notes) => {
  const text = notes ? String(notes).trim() : '';
  if (!text) return null;

  const patterns = [
    { regex: /למי:\s*(.+?)(?:\n|$)/i, direction: 'outgoing' },
    { regex: /שוברי?ם?\s*ל(?:קניה\s+ב)?-(.+?)(?:\s|$)/i, direction: 'outgoing' },
    { regex: /שוברי?ם?\s*מ-(.+?)(?:\s|$)/i, direction: 'incoming' },
    { regex: /BIT\s*-\s*ל\s+(.+)/i, direction: 'outgoing', executionMethod: 'bit' },
    { regex: /BIT\s*-\s*מ(?:-|ן)?\s+(.+)/i, direction: 'incoming', executionMethod: 'bit' },
    { regex: /PAYBOX\s*-\s*ל\s+(.+)/i, direction: 'outgoing', executionMethod: 'paybox' },
    { regex: /PAYBOX\s*-\s*מ(?:-|ן)?\s+(.+)/i, direction: 'incoming', executionMethod: 'paybox' },
  ];

  for (const pattern of patterns) {
    const result = applyPattern(text, pattern);
    if (result) return result;
  }
  return null;
};

/**
 * Detect recipient information from description and/or notes/memo.
 * @param {object} params
 * @param {string} params.description - Transaction description/business name.
 * @param {string} params.notes - Notes to scan (can be cleaned if a pattern is found).
 * @param {string} params.memo - Alternate notes field (used by scraper).
 * @returns {{recipientName: string|null, cleanedNotes: string|null|undefined, executionMethod: string|null, direction: 'incoming'|'outgoing'|null}}
 */
const detectRecipient = ({ description, notes, memo }) => {
  const result = {
    recipientName: null,
    cleanedNotes: notes ?? memo ?? null,
    executionMethod: null,
    direction: null
  };

  const descResult = detectFromDescription(description);
  if (descResult) {
    result.recipientName = descResult.recipientName;
    result.executionMethod = descResult.executionMethod || null;
    result.direction = descResult.direction || null;
  }

  const noteInput = notes !== undefined ? notes : memo;
  const notesResult = detectFromNotes(noteInput);
  if (notesResult) {
    result.cleanedNotes = notesResult.cleanedNotes;
    if (!result.recipientName) {
      result.recipientName = notesResult.recipientName;
    }
    result.executionMethod = result.executionMethod || notesResult.executionMethod || null;
    result.direction = result.direction || notesResult.direction || null;
  }

  return result;
};

module.exports = {
  detectRecipient
};
