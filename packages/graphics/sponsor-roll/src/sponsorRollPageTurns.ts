/**
 * Which page the sponsor roll shows and how it moves to the next (BAJAOVRLAY-46), kept out of
 * sponsor-roll.ts so the lifecycle file stays one responsibility. Each layout stacks two
 * layers in one place (two tile grids, two sponsor cells): the page on air is on one, and a
 * turn draws the next page on the other, then turns the tiles in place or crossfades the
 * cell; the head's words change in place. It also draws page 1 off air (load, after a stop)
 * and redraws the page on air in place after an edit (page 1 when the list shrank under it).
 * Which page each layer holds is the kit's plan (stackedPageLayers), shared with the
 * intermission's sponsor line.
 */
import {
  type LayerIndex,
  otherLayerThan,
  planLayersOnPageOne,
  planTheRedrawInPlace,
  planTheTurnToTheNextPage,
  type StackedPageLayers,
} from '@bajaovrlay/graphics-kit/stackedPageLayers';
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
  private pages: SponsorRollPage[] = [];
  // The kit's plan of the two layers: the page each holds, the layer and the page on air.
  private layers: StackedPageLayers = planLayersOnPageOne();

  constructor(private readonly options: SponsorRollPageTurnsOptions) {}

  /** What the view draws now. */
  readViewState(): SponsorRollViewState {
    return {
      pages: this.pages,
      pageIndexOfLayer: this.layers.pageIndexOfLayer,
      pageIndexOnAir: this.layers.pageIndexOnAir,
    };
  }

  /** How many pages the round has now. */
  countPages(): number {
    return this.pages.length;
  }

  /** The page on air; undefined before load. */
  readPageOnAir(): SponsorRollPage | undefined {
    return this.pages[this.layers.pageIndexOnAir];
  }

  /** Draws the data from page 1, on the first layer, every piece off air. */
  async drawFromPageOneOffAir(data: SponsorRollData): Promise<void> {
    await this.redraw(planSponsorRollPages(data), planLayersOnPageOne());
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
    await this.redraw(pages, planTheRedrawInPlace(this.layers, pages.length));
    const renderRoot = this.options.readRenderRoot();
    const layerOnAir = this.layers.layerOnAir;
    if (data.layout === 'corner') {
      showCornerCellAtOnce(
        findSponsorCellOfLayer(renderRoot, layerOnAir),
        findSponsorCellOfLayer(renderRoot, otherLayerThan(layerOnAir)),
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
    const turn = planTheTurnToTheNextPage(this.layers, this.countPages());
    await this.redraw(this.pages, turn.layersDuringTheTurn);
    await this.options.runMotion(this.buildTurnTimeline(turn.layerLeaving, turn.layerArriving));
    this.layers = turn.layersAfterTheTurn;
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
      findTilesOfLayer(renderRoot, this.layers.layerOnAir),
    );
  }

  /** The pieces on air: the head and the tiles of the page on air, or the corner's card. */
  listPiecesOnAir(): HTMLElement[] {
    const renderRoot = this.options.readRenderRoot();
    if (this.options.readData().layout === 'corner') {
      return [findSponsorRollPanel(renderRoot)];
    }
    return [
      findSponsorRollHead(renderRoot),
      ...findTilesOfLayer(renderRoot, this.layers.layerOnAir),
    ];
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

  private async redraw(pages: SponsorRollPage[], layers: StackedPageLayers): Promise<void> {
    this.pages = pages;
    this.layers = layers;
    await this.options.redrawNow();
  }
}
