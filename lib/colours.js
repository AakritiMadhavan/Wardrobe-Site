'use strict';

// Validate the colour/gallery boundaries before resolving any uploaded photos.
function readColours(body) {
  if (body.colours === undefined) return [];
  let colours, order;
  try {
    colours = JSON.parse(body.colours);
    order = JSON.parse(body.order || '[]');
  } catch (_) { return { error: 'Colour options are not valid.' }; }
  if (!Array.isArray(colours) || !colours.length || colours.length > 20 || !Array.isArray(order)) {
    return { error: 'Add between 1 and 20 colour options.' };
  }
  const names = new Set(), ids = new Set(), photos = new Set(), flattened = [];
  const clean = [];
  for (const c of colours) {
    if (!c || typeof c.name !== 'string' || !c.name.trim() || c.name.trim().length > 60 ||
        typeof c.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(c.id) || ids.has(c.id)) {
      return { error: 'Give every colour a valid name and unique ID.' };
    }
    const name = c.name.trim();
    if (names.has(name.toLowerCase())) return { error: 'Colour names must be different.' };
    const link = typeof c.original_link === 'string' ? c.original_link.trim() : '';
    if (link) {
      try {
        const url = new URL(link);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
      } catch (_) { return { error: 'Colour links must be valid http:// or https:// URLs without credentials.' }; }
    }
    if (!Array.isArray(c.order) || c.order.length > 10) return { error: 'Each colour can have up to 10 photos.' };
    for (const photo of c.order) {
      if (typeof photo !== 'string' || !/^(f:[1-9][0-9]*|n:(0|[1-9][0-9]*))$/.test(photo) || photos.has(photo)) {
        return { error: 'Each photo must belong to exactly one colour.' };
      }
      photos.add(photo); flattened.push(photo);
    }
    names.add(name.toLowerCase()); ids.add(c.id);
    clean.push({ id: c.id, name, original_link: link, order: c.order });
  }
  if (JSON.stringify(flattened) !== JSON.stringify(order)) return { error: 'Colour galleries do not match the photo list.' };
  return clean;
}

module.exports = { readColours };
