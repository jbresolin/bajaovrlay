// How a motion demo names and combines the optional parts of its graphic (BAJAOVRLAY-43):
// every combination of parts on and off, the words for a title ("com foto, sem logo") and a
// file name ("com-foto-sem-logo"), and the <template> that holds a state a button brings in.
// Used by slateMotionCardDemos.mjs and slateMotionBoardDemos.mjs.

/** A <template> holding a state a demo button brings in. */
export function renderTemplate(templateId, html) {
  return `<template id="${templateId}">
${html}
</template>`;
}

/** "com foto, sem logo" from [true, false] and the part names, for titles and file names. */
export function describeParts(partNames, partsShown) {
  return partNames.map((partName, index) => `${partsShown[index] ? 'com' : 'sem'} ${partName}`);
}

/** "com-foto-sem-logo": the words of a demo's parts as a file name, accents dropped. */
export function slugOf(words) {
  const joined = words.join('-').replaceAll(' ', '-');
  const withoutAccents = joined.normalize('NFD').replace(/[^\w-]/g, '');
  return withoutAccents;
}

/** Every combination of n parts on and off, all on first: [[true, true], [true, false], ...]. */
export function everyCombination(partCount) {
  let combinations = [[]];
  for (let part = 0; part < partCount; part += 1) {
    combinations = combinations.flatMap((combination) => [
      [...combination, true],
      [...combination, false],
    ]);
  }
  return combinations;
}
