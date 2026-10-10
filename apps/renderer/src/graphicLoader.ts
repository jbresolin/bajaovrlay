/**
 * Loads a graphic's code into the page. A graphic is an OGraf package served at
 * `/graphics/<graphic id>/`; its manifest's `main` names an ES module whose default
 * export is a web component class. The loader imports that module once per graphic and
 * registers the class as a custom element, as OGraf v1 expects of a renderer.
 */
import type { Graphic } from '@bajaovrlay/shared';

/** What the renderer asks of the loader. */
export type GraphicLoader = {
  /**
   * Makes the graphic's element available and resolves with its tag name, ready for
   * `document.createElement`. Rejects when the module cannot be imported or does not
   * export a class; the caller logs it and leaves the layer empty. A graphic that failed
   * keeps failing the same way until the page is reloaded.
   */
  defineGraphicElement: (graphic: Graphic) => Promise<string>;
};

/** How the loader reaches the outside world; tests replace the import with a stand-in. */
export type GraphicLoaderOptions = {
  importModule?: (moduleAddress: string) => Promise<unknown>;
};

/**
 * Imports a module by its address. The address is computed at run time (it depends on
 * which graphics the server has), so the bundler is told to leave this import alone.
 */
function importModuleFromAddress(moduleAddress: string): Promise<unknown> {
  return import(/* @vite-ignore */ moduleAddress);
}

/** Builds a loader that remembers which graphics it has already imported. */
export function createGraphicLoader(options: GraphicLoaderOptions = {}): GraphicLoader {
  const importModule = options.importModule ?? importModuleFromAddress;
  // One import per graphic id, shared by every take of that graphic. The promise is
  // remembered (not its result) so two takes at the same moment share one import.
  //
  // A failed import is remembered as well, on purpose. Trying again would not help:
  // Chromium (the engine inside OBS) keeps a failed module address in its own module map
  // for the life of the page, so a second `import()` of the same address fails without
  // asking the server. A graphic whose import failed needs the page to be reloaded (in
  // OBS: refresh the browser source); every take until then is logged by the caller.
  const tagNameByGraphicId = new Map<string, Promise<string>>();

  function defineGraphicElement(graphic: Graphic): Promise<string> {
    const rememberedTagName = tagNameByGraphicId.get(graphic.id);
    if (rememberedTagName !== undefined) {
      return rememberedTagName;
    }

    const tagName = importAndDefineGraphicElement(graphic, importModule);
    tagNameByGraphicId.set(graphic.id, tagName);
    return tagName;
  }

  return { defineGraphicElement };
}

/** Imports one graphic's module and registers its class; resolves with the tag name. */
async function importAndDefineGraphicElement(
  graphic: Graphic,
  importModule: (moduleAddress: string) => Promise<unknown>,
): Promise<string> {
  const moduleAddress = `/graphics/${graphic.id}/${graphic.manifest.main}`;
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
