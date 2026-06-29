const CROSSHAIR = `<path d="M12 1 V9 M12 15 V23 M1 12 H9 M15 12 H23" stroke="#000" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M12 1 V9 M12 15 V23 M1 12 H9 M15 12 H23" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;

const stroked = (d: string) =>
	`<path d="${d}" stroke="#000" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="${d}" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;

const wrap = (extra: string) =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${CROSSHAIR}${extra}</svg>`;

const SLICER_SVG = wrap('');

const ADD_SVG = wrap(stroked('M19 1 V9 M15 5 H23'));

const SUB_SVG = wrap(stroked('M15 5 H23'));

const INTERSECT_SVG = wrap(stroked('M15 1 L23 9 M23 1 L15 9'));

const MOVE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M12 1 L8 6 L11 6 L11 11 L6 11 L6 8 L1 12 L6 16 L6 13 L11 13 L11 18 L8 18 L12 23 L16 18 L13 18 L13 13 L18 13 L18 16 L23 12 L18 8 L18 11 L13 11 L13 6 L16 6 Z" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/></svg>`;

const HAND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M9 11 V4.5 a1.5 1.5 0 0 1 3 0 V11 V3.5 a1.5 1.5 0 0 1 3 0 V11 V5 a1.5 1.5 0 0 1 3 0 V12 V7 a1.5 1.5 0 0 1 3 0 V15 a7 7 0 0 1 -7 7 H11 a5 5 0 0 1 -5 -5 V14 c0 -1.5 1 -2 2 -1.5 L9 14 Z" fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/></svg>`;

const HAND_GRAB_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M6 13 V9 a1.5 1.5 0 0 1 3 0 V11 V7 a1.5 1.5 0 0 1 3 0 V11 V6.5 a1.5 1.5 0 0 1 3 0 V11 V8 a1.5 1.5 0 0 1 3 0 V15 a7 7 0 0 1 -7 7 H11 a5 5 0 0 1 -5 -5 Z" fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/></svg>`;

const WAND_BODY = `<path d="M21 21 L10 10" stroke="#000" stroke-width="4" stroke-linecap="round"/><path d="M21 21 L10 10" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><path d="M7 10 H13 M10 7 V13" stroke="#000" stroke-width="3" stroke-linecap="round"/><path d="M7 10 H13 M10 7 V13" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>`;

const WAND_SPARKLES = `<path d="M6 3 V7 M4 5 H8" stroke="#000" stroke-width="2.4" stroke-linecap="round"/><path d="M6 3 V7 M4 5 H8" stroke="#fff" stroke-width="1.1" stroke-linecap="round"/><path d="M3 11 V15 M1 13 H5" stroke="#000" stroke-width="2.4" stroke-linecap="round"/><path d="M3 11 V15 M1 13 H5" stroke="#fff" stroke-width="1.1" stroke-linecap="round"/>`;

const wandWrap = (extra: string) =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${WAND_BODY}${WAND_SPARKLES}${extra}</svg>`;

const WAND_SVG = wandWrap('');
const WAND_ADD_SVG = wandWrap(stroked('M19 1 V9 M15 5 H23'));
const WAND_SUB_SVG = wandWrap(stroked('M15 5 H23'));
const WAND_INTERSECT_SVG = wandWrap(stroked('M15 1 L23 9 M23 1 L15 9'));

const toCursor = (svg: string, hx: number, hy: number, fb: string): string =>
	`url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hx} ${hy}, ${fb}`;

export const CUR_CROP = toCursor(SLICER_SVG, 12, 12, 'crosshair');
export const CUR_ADD = toCursor(ADD_SVG, 12, 12, 'copy');
export const CUR_SUB = toCursor(SUB_SVG, 12, 12, 'not-allowed');
export const CUR_INTERSECT = toCursor(INTERSECT_SVG, 12, 12, 'cell');
export const CUR_MOVE_SEL = toCursor(MOVE_SVG, 12, 12, 'move');
export const CUR_HAND = toCursor(HAND_SVG, 12, 12, 'grab');
export const CUR_HAND_GRAB = toCursor(HAND_GRAB_SVG, 12, 12, 'grabbing');
export const CUR_WAND = toCursor(WAND_SVG, 10, 10, 'crosshair');
export const CUR_WAND_ADD = toCursor(WAND_ADD_SVG, 10, 10, 'copy');
export const CUR_WAND_SUB = toCursor(WAND_SUB_SVG, 10, 10, 'not-allowed');
export const CUR_WAND_INTERSECT = toCursor(WAND_INTERSECT_SVG, 10, 10, 'cell');
