/**
 * Loads a graphic's code into the page. A graphic is an OGraf package served at
 * `/graphics/<graphic id>/`; its manifest's `main` names an ES module whose default
 * export is a web component class. The loader imports that module once per graphic and
 * registers the class as a custom element, as OGraf v1 expects of a renderer.
 *
 * An import that fails is tried again on the next take of the same graphic, under a new
 * address, so "build the package, take it again" works without reloading the page.
 */
import type { Graphic } from '@bajaovrlay/shared';

import { logRendererEvent } from './rendererLog.js';

/** What the renderer asks of the loader. */
export type GraphicLoader = {
  /**
   * Makes the graphic's element available and resolves with its tag name, ready for
   * `document.createElement`. Rejects when the module cannot be imported or does not
   * export a class; the caller logs it and leaves the layer empty. The next call for the
   * same graphic then imports the module again, as `…/<main>?retry=<n>`.
   */
  defineGraphicElement: (graphic: Graphic) => Promise<string>;
};

/**
 * How the loader reaches the outside world; tests replace the import with a stand-in and
 * capture the log.
 */
export type GraphicLoaderOptions = {
  importModule?: (moduleAddress: string) => Promise<unknown>;
  logEvent?: typeof logRendererEvent;
};

/**
 * Imports a module by its address. The address is computed at run time (it depends on
 * which graphics the server has), so the bundler is told to leave this import alone.
 */
function importModuleFromAddress(moduleAddress: string): Promise<unknown> {
  return import(/* @vite-ignore */ moduleAddress);
}

/** Builds a loader that remembers which graphics it has imported, and which failed. */
export function createGraphicLoader(options: GraphicLoaderOptions = {}): GraphicLoader {
  const importModule = options.importModule ?? importModuleFromAddress;
  const logEvent = options.logEvent ?? logRendererEvent;
  // One import per graphic id, shared by every take of that graphic. The promise is
  // remembered (not its result) so two takes at the same moment share one import. An
  // import that fails is forgotten again, so the next take starts a new one.
  const tagNameByGraphicId = new Map<string, Promise<string>>();
  // How many imports of each graphic have failed in this page. It becomes the number in
  // `?retry=<n>`. Why the address must change: Chromium (the engine inside OBS) keeps a
  // failed module address in its own module map for the life of the page, so a second
  // `import()` of the very same address fails without asking the server. A new query
  // string is a new address to Chromium and the same file to the server.
  const numberOfFailedImportsByGraphicId = new Map<string, number>();

  function defineGraphicElement(graphic: Graphic): Promise<string> {
    const rememberedTagName = tagNameByGraphicId.get(graphic.id);
    if (rememberedTagName !== undefined) {
      return rememberedTagName;
    }

    const tagName = importGraphicAndCountAFailure(graphic);
    tagNameByGraphicId.set(graphic.id, tagName);
    return tagName;
  }

  /**
   * Imports the graphic under its first address or, after earlier failures, under its
   * next retry address. A failure is counted and the import forgotten before the error
   * goes on to the caller, so the take that comes next tries again.
   */
  async function importGraphicAndCountAFailure(graphic: Graphic): Promise<string> {
    const numberOfFailedImports = numberOfFailedImportsByGraphicId.get(graphic.id) ?? 0;
    const firstModuleAddress = `/graphics/${graphic.id}/${graphic.manifest.main}`;
    let moduleAddress = firstModuleAddress;
    if (numberOfFailedImports > 0) {
      moduleAddress = `${firstModuleAddress}?retry=${numberOfFailedImports}`;
      logEvent('info', 'graphic module import retried after an earlier failure', {
        graphicId: graphic.id,
        retryNumber: numberOfFailedImports,
        moduleAddress,
      });
    }

    try {
      return await importAndDefineGraphicElement(graphic, moduleAddress, importModule);
    } catch (importError) {
      numberOfFailedImportsByGraphicId.set(graphic.id, numberOfFailedImports + 1);
      tagNameByGraphicId.delete(graphic.id);
      throw importError;
    }
  }

  return { defineGraphicElement };
}

/** Imports one graphic's module and registers its class; resolves with the tag name. */
async function importAndDefineGraphicElement(
  graphic: Graphic,
  moduleAddress: string,
  importModule: (moduleAddress: string) => Promise<unknown>,
): Promise<string> {
  const graphicModule = await importModule(moduleAddress);

  const elementClass = (graphicModule as { default?: unknown }).default;
  if (typeof elementClass !== 'function') {
    throw new Error(`graphic "${graphic.id}" has no web component class as its default export`);
  }

  // The tag comes from the graphic id (the package folder name), which is unique. The
  // `baja-graphic-` prefix guarantees the dash every custom element name must have.
  const tagName = `baja-graphic-${graphic.id}`;
  if (customElements.get(tagName) === undefined) {
    customElements.define(tagName, elementClass as CustomElementConstructor);
  }
  return tagName;
}
