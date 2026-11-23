'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Opt in against a disposable instance seeded with this app's starter data.
// TEST_APP_URL=http://localhost:3117 TEST_ADMIN_PASSWORD=... npm test
test('colour uploads, edits, removal and legacy conversion persist through the API', {
  skip: !process.env.TEST_APP_URL,
  timeout: 30000
}, async () => {
  const base = process.env.TEST_APP_URL;
  let cookie = '';
  const created = [];
  const logo = fs.readFileSync(path.join(__dirname, '../public/logo.png'));
  const favicon = fs.readFileSync(path.join(__dirname, '../public/favicon.png'));
  async function request(method, route, body) {
    const response = await fetch(base + route, { method, headers: { Cookie: cookie, ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
    return response;
  }
  function form(colours, uploads = [], overrides = {}) {
    const fd = new FormData();
    const fields = { name: 'Colour integration fixture', cat: 'western-wear', subcat: '', original_link: colours ? colours[0].original_link : 'https://example.com/legacy',
      order: JSON.stringify(colours ? colours.flatMap((c) => c.order) : ['n:0']), ...overrides };
    Object.entries(fields).forEach(([key, value]) => fd.append(key, value));
    if (colours) fd.append('colours', JSON.stringify(colours));
    uploads.forEach((bytes) => fd.append('images', new Blob([bytes], { type: 'image/png' }), 'test.png'));
    return fd;
  }
  async function store() { return (await request('GET', '/api/store')).json(); }
  async function save(method, route, body, expected) {
    const res = await request(method, route, body);
    const result = await res.json();
    assert.equal(res.status, expected, JSON.stringify(result));
    return result;
  }
  const login = await request('POST', '/api/login', { password: process.env.TEST_ADMIN_PASSWORD });
  assert.equal(login.status, 200);
  cookie = login.headers.get('set-cookie').split(';')[0];
  try {
    assert.deepEqual((await store()).categories.map((c) => c.name), ['Lingerie', 'Indian Wear', 'Western Wear', 'Sleep & Lounge', 'Sports & Active', 'Footwear', 'Accessories', 'Others']);
    const legacy = await save('POST', '/api/items', form(null, [logo]), 201);
    created.push(legacy.id);
    const legacyItem = (await store()).items.find((i) => i.id === legacy.id);
    assert.equal(Object.hasOwn(legacyItem, 'price'), false);
    assert.deepEqual(legacyItem.colours, []);
    assert.equal(legacyItem.images.length, 1);
    const product = await save('POST', '/api/items', form([
      { id: 'black', name: 'Black', original_link: 'https://example.com/black', order: ['n:0'] },
      { id: 'pink', name: 'Pink', original_link: 'https://example.com/pink', order: ['n:1', 'n:2'] }
    ], [logo, favicon, logo]), 201);
    created.push(product.id);
    const initial = (await store()).items.find((i) => i.id === product.id);
    assert.deepEqual(initial.images, initial.colours[0].images);
    assert.deepEqual(initial.colours.map((c) => c.images.length), [1, 2]);
    assert.equal(new Set(initial.colours.flatMap((c) => c.images)).size, 3);
    assert.deepEqual(Buffer.from(await (await request('GET', '/img/' + initial.colours[1].images[0])).arrayBuffer()), favicon);

    // Remove Black, reorder Pink's gallery, replace one photo and add Navy.
    await save('PUT', '/api/items/' + product.id, form([
      { id: 'pink', name: 'Rose Pink', original_link: 'https://example.com/rose', order: ['n:0', 'f:' + initial.colours[1].images[1]] },
      { id: 'navy', name: 'Navy', original_link: 'https://example.com/navy', order: ['n:1'] }
    ], [favicon, logo]), 200);
    const edited = (await store()).items.find((i) => i.id === product.id);
    assert.deepEqual(edited.colours.map((c) => c.name), ['Rose Pink', 'Navy']);
    assert.equal(edited.colours[0].original_link, 'https://example.com/rose');
    assert.equal(edited.colours[0].images[1], initial.colours[1].images[1]);
    assert.deepEqual(edited.images, edited.colours[0].images);
    assert.equal((await request('GET', '/img/' + initial.colours[0].images[0])).status, 404);
    assert.equal((await request('GET', '/img/' + initial.colours[1].images[0])).status, 404);
    assert.equal((await request('GET', '/img/' + initial.colours[1].images[1])).status, 200);

    // Reject another product's image and verify the failed edit leaves data intact.
    await save('PUT', '/api/items/' + product.id, form([
      { id: 'stolen', name: 'Invalid', original_link: '', order: ['f:' + legacyItem.images[0]] }
    ]), 400);
    assert.deepEqual((await store()).items.find((i) => i.id === product.id), edited);
    await save('PUT', '/api/items/' + product.id, form([
      { id: 'pink', name: 'Pink', original_link: '', order: ['f:' + edited.images[0]] },
      { id: 'navy', name: 'Navy', original_link: '', order: ['f:' + edited.images[0]] }
    ]), 400);

    // Convert a legacy product without reuploading its existing gallery.
    await save('PUT', '/api/items/' + legacy.id, form([
      { id: 'original', name: 'Original', original_link: legacyItem.original_link, order: ['f:' + legacyItem.images[0]] },
      { id: 'blue', name: 'Blue', original_link: 'https://example.com/blue', order: ['n:0'] }
    ], [favicon]), 200);
    const converted = (await store()).items.find((i) => i.id === legacy.id);
    assert.deepEqual(converted.colours[0].images, legacyItem.images);
    assert.equal(converted.colours[1].images.length, 1);
  } finally {
    for (const id of created) await request('DELETE', '/api/items/' + id);
  }
});
