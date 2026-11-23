'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateWearUpdate, resolveWearColour } = require('../lib/wear');
const diary = require('../public/diary-utils');

test('wear history accepts valid past dates and requires an explicit boolean', () => {
  assert.equal(validateWearUpdate('2026-06-14', true, '2026-11-23'), '');
  assert.equal(validateWearUpdate('2026-11-23', false, '2026-11-23'), '');
  for (const [date, worn] of [['2026-02-30', true], ['2026-11-24', true], ['2022-12-31', true], ['2026-06-14', 'false'], ['2026-06-14', null]]) {
    assert.ok(validateWearUpdate(date, worn, '2026-11-23'));
  }
});

test('wear calendars resolve a valid colour and reject removed or malformed selections', () => {
  const colours = [{ id: 'red', name: 'Red' }, { id: 'blue', name: 'Blue' }];
  assert.deepEqual(resolveWearColour(colours), colours[0]);
  assert.deepEqual(resolveWearColour(colours, 'blue'), colours[1]);
  assert.deepEqual(resolveWearColour([], undefined), { id: '', name: '' });
  for (const invalid of ['removed', ['red', 'blue'], {}, 'x'.repeat(81)]) assert.ok(resolveWearColour(colours, invalid).error);
  assert.ok(resolveWearColour([], 'blue').error);
});

test('screenshot history matches the visible counts, streaks and in-progress day', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../db/diary-history.sql'), 'utf8');
  const rows = [...sql.matchAll(/\('(\d{4}-\d{2}-\d{2})', '(written|in_progress)'\)/g)].map((match) => [match[1], match[2]]);
  const entries = Object.fromEntries(rows);
  assert.equal(rows.length, 111);
  assert.equal(Object.keys(entries).length, rows.length);
  assert.equal(diary.stats(2025, entries, '2026-11-23').written, 24);
  assert.equal(diary.stats(2025, entries, '2026-11-23').longestStreak, 5);
  assert.equal(diary.stats(2026, entries, '2026-11-23').written, 86);
  assert.equal(diary.stats(2026, entries, '2026-11-23').longestStreak, 19);
  assert.equal(entries['2026-06-14'], 'in_progress');
});

test('wear dates are private, isolated per product, persistent and reversible', { skip: !process.env.TEST_APP_URL, timeout: 30000 }, async () => {
  const base = process.env.TEST_APP_URL;
  const login = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: process.env.TEST_ADMIN_PASSWORD }) });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const ids = [];
  async function api(method, route, body, authenticated = true) {
    return fetch(base + route, { method, headers: { 'Content-Type': 'application/json', ...(authenticated ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  }
  try {
    for (let i = 0; i < 2; i++) {
      const fd = new FormData();
      for (const [name, value] of Object.entries({ name: 'Wear history test ' + i, cat: 'western-wear', order: '[]' })) fd.append(name, value);
      const response = await fetch(base + '/api/items', { method: 'POST', headers: { Cookie: cookie }, body: fd });
      assert.equal(response.status, 201); ids.push((await response.json()).id);
    }
    const route = '/api/items/' + ids[0] + '/wear';
    assert.equal((await api('GET', route, undefined, false)).status, 401);
    assert.equal((await api('PUT', route + '/2026-06-14', { worn: true }, false)).status, 401);
    assert.equal((await api('PUT', route + '/2026-02-30', { worn: true })).status, 400);
    assert.equal((await api('PUT', route + '/2099-01-01', { worn: true })).status, 400);
    assert.equal((await api('PUT', route + '/2026-06-14', { worn: 'false' })).status, 400);
    assert.equal((await api('GET', '/api/items/missing-wear-fixture/wear')).status, 404);
    assert.equal((await api('PUT', route + '/2026-06-14', { worn: true })).status, 200);
    assert.equal((await api('PUT', route + '/2026-06-14', { worn: true })).status, 200);
    assert.deepEqual((await (await api('GET', route)).json()).dates, ['2026-06-14']);
    assert.deepEqual((await (await api('GET', '/api/items/' + ids[1] + '/wear')).json()).dates, []);
    assert.equal((await api('PUT', route + '/2026-06-14', { worn: false })).status, 200);
    assert.deepEqual((await (await api('GET', route)).json()).dates, []);
    assert.equal((await api('PUT', route + '/2026-06-14', { worn: true })).status, 200);
    async function saveColours(colours) {
      const fd = new FormData();
      for (const [name, value] of Object.entries({ name: 'Wear history colour test', cat: 'western-wear', order: '[]', colours: JSON.stringify(colours.map(c => ({ ...c, original_link: '', order: [] }))) })) fd.append(name, value);
      const response = await fetch(base + '/api/items/' + ids[0], { method: 'PUT', headers: { Cookie: cookie }, body: fd });
      assert.equal(response.status, 200, await response.text());
    }
    await saveColours([{ id: 'red', name: 'Red' }, { id: 'blue', name: 'Blue' }]);
    const red = route + '?colour=red', blue = route + '?colour=blue';
    assert.deepEqual((await (await api('GET', red)).json()).dates, ['2026-06-14']);
    assert.deepEqual((await (await api('GET', blue)).json()).dates, []);
    assert.equal((await api('GET', route + '?colour=removed')).status, 400);
    assert.equal((await api('GET', route + '?colour=red&colour=blue')).status, 400);
    assert.equal((await api('PUT', route + '/2026-06-14?colour=removed', { worn: true })).status, 400);
    assert.equal((await api('PUT', route + '/2026-06-14?colour=blue', { worn: true })).status, 200);
    assert.equal((await api('PUT', route + '/2026-06-15?colour=blue', { worn: true })).status, 200);
    assert.equal((await api('PUT', route + '/2026-06-14?colour=red', { worn: false })).status, 200);
    assert.deepEqual((await (await api('GET', red)).json()).dates, []);
    assert.deepEqual((await (await api('GET', blue)).json()).dates, ['2026-06-15', '2026-06-14']);
    await saveColours([{ id: 'blue', name: 'Navy' }, { id: 'red', name: 'Ruby' }]);
    assert.deepEqual((await (await api('GET', route)).json()).dates, ['2026-06-15', '2026-06-14']);
    assert.deepEqual((await (await api('GET', red)).json()).dates, []);
    assert.equal((await api('PUT', route + '/2026-06-16?colour=red', { worn: true })).status, 200);
    await saveColours([{ id: 'red', name: 'Ruby' }]);
    assert.deepEqual((await (await api('GET', red)).json()).dates, ['2026-06-16']);
    assert.equal((await api('GET', blue)).status, 400);
    await api('DELETE', '/api/items/' + ids[0]);
    assert.equal((await api('GET', route)).status, 404);
  } finally { for (const id of ids) await api('DELETE', '/api/items/' + id); }
});
