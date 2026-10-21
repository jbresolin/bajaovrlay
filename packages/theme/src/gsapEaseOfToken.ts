/**
 * Turns an ease token (`cubic-bezier(0.16, 1, 0.3, 1)`) into the name of a GSAP ease a
 * timeline can pass as `ease`, registering the curve with GSAP's CustomEase once per
 * curve. A value that is not a cubic-bezier (the `linear` fallback, a keyword) answers
 * `none`, GSAP's linear ease.
 *
 * Why CustomEase and not the closest built-in ease: the curve GSAP runs is then exactly
 * the token's curve, and the design demo (docs/design, motion-demo.html) runs the same
 * tokens through the Web Animations API. An approximation with `power3.out` would make
 * the product's motion differ from the demo João approved, and a theme that changes a
 * curve would be followed by the CSS and not by GSAP.
 */
import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';

// Once per page: registering a plugin twice is harmless but needless.
gsap.registerPlugin(CustomEase);

// `cubic-bezier(x1, y1, x2, y2)`: four numbers, any spacing. Only this exact form is a
// curve; `ease-in-out` and friends are CSS keywords GSAP has no name for.
const cubicBezierPattern =
  /^cubic-bezier\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)$/;

/** GSAP's linear ease, answered for anything that is not a cubic-bezier. */
const linearEaseName = 'none';

// The curves already registered, keyed by their four numbers, so the same token read by
// every graphic on the page builds one CustomEase.
const registeredEaseNamesByCurve = new Map<string, string>();

/**
 * Answers the GSAP ease name for an ease token value. The name is stable per curve
 * (`theme-cubic-bezier_0.16_1_0.3_1`), so two graphics asking for the same token share
 * one registered ease.
 */
export function gsapEaseOfToken(easeTokenValue: string): string {
  const curveMatch = cubicBezierPattern.exec(easeTokenValue.trim());
  if (curveMatch === null) {
    return linearEaseName;
  }
  const [, x1, y1, x2, y2] = curveMatch;
  const curveNumbers = `${x1},${y1},${x2},${y2}`;

  const alreadyRegisteredName = registeredEaseNamesByCurve.get(curveNumbers);
  if (alreadyRegisteredName !== undefined) {
    return alreadyRegisteredName;
  }

  // No parenthesis or spaces in the name: GSAP reads `name(args)` as a configured ease.
  const easeName = `theme-cubic-bezier_${curveNumbers.replaceAll(',', '_')}`;
  // CustomEase takes the four numbers of a cubic-bezier as "x1,y1,x2,y2" and adds the
  // (0,0) and (1,1) anchors itself; the word `cubic-bezier` would be read as SVG path
  // commands, so only the numbers are passed.
  CustomEase.create(easeName, curveNumbers);
  registeredEaseNamesByCurve.set(curveNumbers, easeName);
  return easeName;
}
