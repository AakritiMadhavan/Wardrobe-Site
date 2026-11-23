'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readColours } = require('../lib/colours');

function payload(colours, order = colours.flatMap((c) => c.order || [])) {
  return { colours: JSON.stringify(colours), order: JSON.stringify(order) };
}
const black = () => ({ id: 'black', name: ' Black ', original_link: 'https://example.com/black', order: ['f:1', 'n:0'] });
const pink = () => ({ id: 'pink', name: 'Pink', original_link: 'https://example.com/pink', order: ['n:1'] });

test('legacy products need no colour options', () => {
  assert.deepEqual(readColours({ order: '[]' }), []);
});
test('colours keep independent shopping links and ordered galleries', () => {
  const colours = readColours(payload([black(), pink()]));
  assert.equal(colours[0].name, 'Black');
  assert.equal(colours[1].original_link, 'https://example.com/pink');
  assert.deepEqual(colours.map((c) => c.order), [['f:1', 'n:0'], ['n:1']]);
});
test('blank names, duplicate names and IDs are rejected', () => {
  for (const changed of [{ ...pink(), name: ' ' }, { ...pink(), name: 'BLACK' }, { ...pink(), id: 'black' }]) {
    assert.ok(readColours(payload([black(), changed])).error);
  }
});
test('unsafe links and embedded credentials are rejected', () => {
  for (const link of ['javascript:alert(1)', 'https://user:password@example.com', 'https://', '//example.com']) {
    assert.ok(readColours(payload([{ ...black(), original_link: link }])).error);
  }
});
test('photos cannot be shared between colours, silently dropped or reassigned by ordering', () => {
  assert.ok(readColours(payload([black(), { ...pink(), order: ['f:1'] }])).error);
  assert.ok(readColours(payload([black(), pink()], ['n:1', 'f:1', 'n:0'])).error);
  assert.ok(readColours(payload([black()], ['f:1'])).error);
  assert.ok(readColours(payload([{ ...black(), order: ['f:0'] }])).error);
});
test('limits apply to each gallery and the number of options', () => {
  assert.ok(readColours(payload([{ ...black(), order: Array.from({ length: 11 }, (_, i) => 'n:' + i) }])).error);
  assert.ok(readColours(payload(Array.from({ length: 21 }, (_, i) => ({ ...black(), id: 'c' + i, name: 'Colour ' + i, order: [] })))).error);
  assert.ok(readColours({ colours: '{}', order: '[]' }).error);
  assert.ok(readColours({ colours: '[invalid', order: '[]' }).error);
});
