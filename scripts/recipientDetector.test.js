const assert = require('assert');
const { detectRecipient } = require('../server/services/utils/recipientDetector');

const cases = [
  {
    title: 'Bit Hebrew outgoing',
    input: { description: 'העברה בביט ל רן כהן' },
    expectName: 'רן כהן',
    expectMethod: 'bit',
    expectDirection: 'outgoing'
  },
  {
    title: 'Paybox English outgoing',
    input: { description: 'PAYBOX TO Dana' },
    expectName: 'Dana',
    expectMethod: 'paybox',
    expectDirection: 'outgoing'
  },
  {
    title: 'Notes pattern "למי"',
    input: { notes: 'ארוחת צהריים\nלמי: נוי כהן' },
    expectName: 'נוי כהן',
    expectDirection: 'outgoing',
    expectCleanedNotes: 'ארוחת צהריים'
  },
  {
    title: 'Voucher to pattern',
    input: { notes: 'שוברים לקניה ב-איקאה 123' },
    expectName: 'איקאה',
    expectDirection: 'outgoing'
  },
  {
    title: 'Incoming Bit from description',
    input: { description: 'העברה בביט מ דני לוי' },
    expectName: 'דני לוי',
    expectMethod: 'bit',
    expectDirection: 'incoming'
  },
  {
    title: 'Incoming voucher from notes',
    input: { notes: 'שובר מ-רותם' },
    expectName: 'רותם',
    expectDirection: 'incoming'
  }
];

cases.forEach((testCase) => {
  const result = detectRecipient(testCase.input);
  assert.strictEqual(result.recipientName, testCase.expectName, `${testCase.title}: recipientName`);
  if (testCase.expectMethod) {
    assert.strictEqual(result.executionMethod, testCase.expectMethod, `${testCase.title}: executionMethod`);
  }
  if (testCase.expectDirection) {
    assert.strictEqual(result.direction, testCase.expectDirection, `${testCase.title}: direction`);
  }
  if ('expectCleanedNotes' in testCase) {
    assert.strictEqual(result.cleanedNotes, testCase.expectCleanedNotes, `${testCase.title}: cleanedNotes`);
  }
});

console.log('✅ recipientDetector tests passed');
