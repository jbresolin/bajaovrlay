/**
 * The pages of a sponsor round (BAJAOVRLAY-46), for the sponsor roll (six tiles a page) and
 * the intermission's sponsor line (four logos): one level a page, in the round order, a
 * level with more sponsors than a page holds shared evenly between its pages, so pages of
 * one level differ by one sponsor at most, the fuller first (nine on pages of four are
 * 3 + 3 + 3; thirteen on pages of six are 5 + 4 + 4). The design's demo split thirteen as
 * 5 + 5 + 3; "shared evenly" (motion.md) reads as this, and both give its two examples.
 * Within a level the sponsors keep the order they came in (the server's: weight, name).
 */
import { type SponsorLevel, sponsorLevelsInTheRound } from './sponsorRound.js';

/** One page of a round: its level (its heading and hold) and its sponsors. */
export type SponsorPage<Sponsor extends { level: SponsorLevel }> = {
  level: SponsorLevel;
  sponsors: Sponsor[];
};

/**
 * Plans the pages of the round for these sponsors, up to `sponsorsPerPage` a page. Any
 * sponsor type carrying its level will do (the roll's tiles, the line's logos). No sponsor
 * gives no page; an empty page is never made.
 */
export function planSponsorPages<Sponsor extends { level: SponsorLevel }>(
  sponsors: Sponsor[],
  sponsorsPerPage: number,
): SponsorPage<Sponsor>[] {
  const pages: SponsorPage<Sponsor>[] = [];
  for (const level of sponsorLevelsInTheRound) {
    const sponsorsOfTheLevel = sponsors.filter((sponsor) => sponsor.level === level);
    const pageSizes = shareEvenlyIntoPages(sponsorsOfTheLevel.length, sponsorsPerPage);
    let firstOfThePage = 0;
    for (const pageSize of pageSizes) {
      const sponsorsOfThePage = sponsorsOfTheLevel.slice(firstOfThePage, firstOfThePage + pageSize);
      pages.push({ level, sponsors: sponsorsOfThePage });
      firstOfThePage += pageSize;
    }
  }
  return pages;
}

/**
 * The size of each page for `sponsorCount` sponsors of one level: as few pages as hold
 * them, the sponsors shared so the sizes differ by one at most, the fuller pages first.
 */
function shareEvenlyIntoPages(sponsorCount: number, sponsorsPerPage: number): number[] {
  if (sponsorCount === 0) {
    return [];
  }
  const pageCount = Math.ceil(sponsorCount / sponsorsPerPage);
  const smallerPageSize = Math.floor(sponsorCount / pageCount);
  const fullerPageCount = sponsorCount % pageCount;
  const pageSizes: number[] = [];
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const isFullerPage = pageIndex < fullerPageCount;
    pageSizes.push(isFullerPage ? smallerPageSize + 1 : smallerPageSize);
  }
  return pageSizes;
}
