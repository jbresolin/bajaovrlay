# GSAP for the design's motion demos

A byte-for-byte copy of `gsap.min.js` and `CustomEase.min.js` from GSAP 3.15.0, the version
the product's graphics depend on (`packages/graphics/race-clock`). The catalogue's motion
demos (`docs/design/directions/ardosia/motion-*.html`) load these two files.

They are copied here rather than loaded from `node_modules` because the demos must open from
the file system in any browser, including a Windows browser reading the WSL disk through
`\\wsl.localhost`. pnpm's `node_modules` is built from symlinks, and such a browser cannot
follow them. Nothing here runs in the product.

Licence: GreenSock's standard "no charge" licence (https://gsap.com/standard-license); each
file keeps its licence header. When the product moves to another GSAP version, copy the two
files again from `node_modules/.pnpm/node_modules/gsap/dist/` after `pnpm install`. Prettier
and ESLint skip this folder (`.prettierignore`, `eslint.config.js`): the files stay as GSAP
ships them.
