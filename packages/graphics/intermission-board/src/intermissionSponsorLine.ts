/**
 * Which page the intermission's sponsor line shows and how it turns to the next
 * (BAJAOVRLAY-46), kept out of intermission-board.ts so the lifecycle stays one
 * responsibility. The line's pages are the sponsor roll's rule (the kit's planSponsorPages,
 * four logos of one level a page); its two layers are stacked in one place, the page on air
 * on one, and a turn draws the next page on the other and turns its heading and logos in
 * place. The board's timer holds each page by its level (the kit's sponsorPageTurner).
 */
import type { SponsorLevel } from '@bajaovrlay/graphics-kit/sponsorRound';
import type { GraphicTimeline } from '@bajaovrlay/graphics-kit/timelinePlayback';

import {
  buildSponsorLineTurnTimeline,
  placeIntermissionPiecesOffAir,
  placeIntermissionPiecesOnAir,
} from './intermissionBoardAnimations.js';
import type { SponsorLinePage } from './intermissionBoardModel.js';
import { findSponsorLineLayerPieces, type SponsorLineLayers } from './intermissionBoardView.js';

/** One of the line's two layers. */
type LayerIndex = 0 | 1;

/** What the line needs from the board; each reader is called anew. */
export type IntermissionSponsorLineOptions = {
  readRenderRoot: () => ParentNode;
  /** The board element, which the theme's tokens are read from. */
  readBoard: () => HTMLElement;
  /** The line's pages for the data now. */
  readPages: () => SponsorLinePage[];
  /** Asks Lit to draw the layers now held here, and waits until it has. */
  redrawNow: () => Promise<void>;
  /** Runs a motion through the board's one-at-a-time runner. */
  runMotion: (timeline: GraphicTimeline) => Promise<void>;
};

/** The sponsor line of one intermission board. */
export class IntermissionSponsorLine {
  private layers: SponsorLineLayers = [0, undefined];
  private layerOnAir: LayerIndex = 0;
  private pageIndexOnAir = 0;

  constructor(private readonly options: IntermissionSponsorLineOptions) {}

  /** Which page each layer shows, for the view. */
  readLayers(): SponsorLineLayers {
    return this.layers;
  }

  /** How many pages the line has now. */
  countPages(): number {
    return this.options.readPages().length;
  }

  /** The level of the page on air, whose hold the timer waits; undefined with no page. */
  readLevelOnAir(): SponsorLevel | undefined {
    return this.options.readPages()[this.pageIndexOnAir]?.level;
  }

  /** Draws page 1 on the first layer, its heading and logos shown inside the line. */
  async drawPageOne(): Promise<void> {
    this.layerOnAir = 0;
    this.pageIndexOnAir = 0;
    this.layers = [0, undefined];
    await this.options.redrawNow();
    placeIntermissionPiecesOnAir(findSponsorLineLayerPieces(this.options.readRenderRoot(), 0));
  }

  /**
   * Draws the page on air again with the pages there are now, on the layer on air; page 1
   * when the list shrank under it.
   */
  async redrawThePageOnAirInPlace(): Promise<void> {
    const pageCount = this.countPages();
    this.pageIndexOnAir = this.pageIndexOnAir < pageCount ? this.pageIndexOnAir : 0;
    const layers: SponsorLineLayers = [undefined, undefined];
    layers[this.layerOnAir] = this.pageIndexOnAir;
    this.layers = layers;
    await this.options.redrawNow();
    placeIntermissionPiecesOnAir(
      findSponsorLineLayerPieces(this.options.readRenderRoot(), this.layerOnAir),
    );
  }

  /** Turns to the next page: draws it on the other layer, then turns the line in place. */
  async turnToTheNextPage(): Promise<void> {
    const layerLeaving = this.layerOnAir;
    const layerArriving: LayerIndex = layerLeaving === 0 ? 1 : 0;
    const nextPageIndex = (this.pageIndexOnAir + 1) % this.countPages();
    const layers: SponsorLineLayers = [...this.layers];
    layers[layerArriving] = nextPageIndex;
    this.layers = layers;
    this.pageIndexOnAir = nextPageIndex;
    await this.options.redrawNow();

    const renderRoot = this.options.readRenderRoot();
    const board = this.options.readBoard();
    const arrivingPieces = findSponsorLineLayerPieces(renderRoot, layerArriving);
    placeIntermissionPiecesOffAir(board, arrivingPieces);
    const turn = buildSponsorLineTurnTimeline(
      board,
      findSponsorLineLayerPieces(renderRoot, layerLeaving),
      arrivingPieces,
    );
    await this.options.runMotion(turn);
    this.layerOnAir = layerArriving;
  }
}
