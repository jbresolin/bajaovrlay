// The `@bajaovrlay/theme/motion` entry: what a graphic imports to animate with the theme.

// Reads the --motion-* and --ease-* tokens from an element's computed style as numbers
// and ease strings; the linear ease answered when a token is missing; the token type.
export { fallbackEase, type MotionTokens, readMotionTokens } from './readMotionTokens.js';
// Turns an ease token into a GSAP ease name, registering the curve with CustomEase once.
export { gsapEaseOfToken } from './gsapEaseOfToken.js';
