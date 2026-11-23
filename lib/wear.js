'use strict';
const diary = require('../public/diary-utils');
function validateWearUpdate(date, worn, today) {
  if (typeof worn !== 'boolean') return 'Choose whether the item was worn.';
  return diary.validateUpdate(date, 'written', today);
}
function resolveWearColour(colours, requested) {
  if (requested !== undefined && (typeof requested !== 'string' || requested.length > 80)) return { error: 'Choose a valid colour.' };
  const options = Array.isArray(colours) ? colours : [];
  if (!options.length) return requested ? { error: 'That colour no longer exists.' } : { id: '', name: '' };
  const colour = requested ? options.find((option) => option.id === requested) : options[0];
  return colour ? { id: colour.id, name: colour.name } : { error: 'That colour no longer exists.' };
}
module.exports = { validateWearUpdate, resolveWearColour };
