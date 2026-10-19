// The values Vite writes into this page's bundle, beyond its own MODE, DEV and PROD.
interface ImportMetaEnv {
  /**
   * The id of the `pnpm build` this page came from (build-id.json, embedded by the
   * plugin in vite.config.ts). Undefined on the dev server and in tests.
   */
  readonly BAJAOVRLAY_BUILD_ID?: string;
}
