/**
 * Which page the sponsor roll shows and how it moves to the next (BAJAOVRLAY-46), kept out of
 * sponsor-roll.ts so the lifecycle file stays one responsibility. Each layout stacks two
 * layers in one place (two tile grids, two sponsor cells): the page on air is on one, and a
 * turn draws the next page on the other, then turns the tiles in place or crossfades the
 * cell; the head's words change in place. It also draws page 1 off air (load, after a stop)
 * and redraws the page on air in place after an edit (page 1 when the list shrank under it).
 */
import type { GraphicTimeline } from '@bajaovrlay/graphics-kit/timelinePlayback';

import {
  buildCellCrossfadeTimeline,
  buildCornerPlayInTimeline,
  buildFullscreenPlayInTimeline,
  buildTilePageTurnTimeline,
  placeSponsorRollPiecesOffAir,
  placeSponsorRollPiecesOnAir,
  showCornerCellAtOnce,
} from './sponsorRollAnimations.js';
import {
  keepPageIndexWithin,
  planSponsorRollPages,
  type SponsorRollData,
  type SponsorRollPage,
} from './sponsorRollModel.js';
import {
  findSponsorCellOfLayer,
  findSponsorRollHead,
  findSponsorRollPanel,
  findTilesOfLayer,
  type SponsorRollViewState,
} from './sponsorRollView.js';

/** One of the two layers each layout stacks in one place. */
type LayerIndex = 0 | 1;

/** The other of the two layers. */
function otherLayerThan(layerIndex: LayerIndex): LayerIndex {
  return layerIndex === 0 ? 1 : 0;
}

/** What the page turns need from the graphic; each reader is called anew. */
export type SponsorRollPageTurnsOptions = {
  readRenderRoot: () => ParentNode;
  readData: () => SponsorRollData;
  /** Asks Lit to draw the view state now held here, and waits until it has. */
  redrawNow: () => Promise<void>;
  /** Runs a motion through the graphic's one-at-a-time runner. */
  runMotion: (timeline: GraphicTimeline) => Promise<void>;
};

/** The pages of one sponsor roll and the layer the page on air is drawn on. */
export class SponsorRollPageTurns {
  private viewState: SponsorRollViewState = {
    pages: [],
    pageIndexOfLayer: [0, undefined],
    pageIndexOnAir: 0,
  };
  private layerOnAir: LayerIndex = 0;

  constructor(private readonly options: SponsorRollPageTurnsOptions) {}

  /** What the view draws now. */
  readViewState(): SponsorRollViewState {
    return this.viewState;
  }

  /** How many pages the round has now. */
  countPages(): number {
    return this.viewState.pages.length;
  }

  /** The page on air; undefined before load. */
  readPageOnAir(): SponsorRollPage | undefined {
    return this.viewState.pages[this.viewState.pageIndexOnAir];
  }

  /** Draws the data from page 1, on the first layer, every piece off air. */
  async drawFromPageOneOffAir(data: SponsorRollData): Promise<void> {
    this.layerOnAir = 0;
    await this.redraw({
      pages: planSponsorRollPages(data),
      pageIndexOfLayer: [0, undefined],
      pageIndexOnAir: 0,
    });
    const renderRoot = this.options.readRenderRoot();
    const panel = findSponsorRollPanel(renderRoot);
    if (data.layout === 'corner') {
      placeSponsorRollPiecesOffAir(panel, [panel]);
      showCornerCellAtOnce(
        findSponsorCellOfLayer(renderRoot, 0),
        findSponsorCellOfLayer(renderRoot, 1),
      );
      return;
    }
    placeSponsorRollPiecesOffAir(panel, [
      findSponsorRollHead(renderRoot),
      ...findTilesOfLayer(renderRoot, 0),
      ...findTilesOfLayer(renderRoot, 1),
    ]);
  }

  /**
   * Draws the page on air again with the data as it is now, on the layer on air, every
   * piece on air at once (a tile of a new sponsor included); page 1 when the list shrank.
   */
  async redrawThePageOnAirInPlace(): Promise<void> {
    const data = this.options.readData();
    const pages = planSponsorRollPages(data);
    const pageIndexOnAir = keepPageIndexWithin(this.viewState.pageIndexOnAir, pages.length);
    const pageIndexOfLayer: [number | undefined, number | undefined] = [undefined, undefined];
    pageIndexOfLayer[this.layerOnAir] = pageIndexOnAir;
    await this.redraw({ pages, pageIndexOfLayer, pageIndexOnAir });
    const renderRoot = this.options.readRenderRoot();
    if (data.layout === 'corner') {
      showCornerCellAtOnce(
        findSponsorCellOfLayer(renderRoot, this.layerOnAir),
        findSponsorCellOfLayer(renderRoot, otherLayerThan(this.layerOnAir)),
      );
      return;
    }
    placeSponsorRollPiecesOnAir(this.listPiecesOnAir());
  }

  /**
   * Turns to the next page: draws it on the other layer, the head's words in place, then
   * runs the turn (the tiles in place, or the corner's cell crossfading).
   */
  async turnToTheNextPage(): Promise<void> {
    const layerLeaving = this.layerOnAir;
    const layerArriving = otherLayerThan(layerLeaving);
    const nextPageIndex = (this.viewState.pageIndexOnAir + 1) % this.countPages();
    const pageIndexOfLayer: [number | undefined, number | undefined] = [
      ...this.viewState.pageIndexOfLayer,
    ];
    pageIndexOfLayer[layerArriving] = nextPageIndex;
    await this.redraw({ ...this.viewState, pageIndexOfLayer, pageIndexOnAir: nextPageIndex });
    await this.options.runMotion(this.buildTurnTimeline(layerLeaving, layerArriving));
    this.layerOnAir = layerArriving;
  }

  /** The play-in of the layout: the head then the tiles, or the corner's card whole. */
  buildPlayInTimeline(): GraphicTimeline {
    const renderRoot = this.options.readRenderRoot();
    const panel = findSponsorRollPanel(renderRoot);
    if (this.options.readData().layout === 'corner') {
      return buildCornerPlayInTimeline(panel);
    }
    return buildFullscreenPlayInTimeline(
      panel,
      findSponsorRollHead(renderRoot),
      findTilesOfLayer(renderRoot, this.layerOnAir),
    );
  }

  /** The pieces on air: the head and the tiles of the page on air, or the corner's card. */
  listPiecesOnAir(): HTMLElement[] {
    const renderRoot = this.options.readRenderRoot();
    if (this.options.readData().layout === 'corner') {
      return [findSponsorRollPanel(renderRoot)];
    }
    return [findSponsorRollHead(renderRoot), ...findTilesOfLayer(renderRoot, this.layerOnAir)];
  }

  /** The turn of the layout, from the layer leaving to the layer arriving. */
  private buildTurnTimeline(layerLeaving: LayerIndex, layerArriving: LayerIndex): GraphicTimeline {
    const renderRoot = this.options.readRenderRoot();
    const panel = findSponsorRollPanel(renderRoot);
    if (this.options.readData().layout === 'corner') {
      return buildCellCrossfadeTimeline(
        panel,
        findSponsorCellOfLayer(renderRoot, layerLeaving),
        findSponsorCellOfLayer(renderRoot, layerArriving),
      );
    }
    const arrivingTiles = findTilesOfLayer(renderRoot, layerArriving);
    placeSponsorRollPiecesOffAir(panel, arrivingTiles);
    return buildTilePageTurnTimeline(
      panel,
      findTilesOfLayer(renderRoot, layerLeaving),
      arrivingTiles,
    );
  }

  private async redraw(viewState: SponsorRollViewState): Promise<void> {
    this.viewState = viewState;
    await this.options.redrawNow();
  }
}
