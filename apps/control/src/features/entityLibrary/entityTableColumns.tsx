import {
  type EntityType,
  findStatusOfScheduleSlot,
  labelOfScheduleSlotStatus,
  type Person,
  ptBREntities,
  type ScheduleSlot,
  type Sponsor,
  type Team,
} from '@bajaovrlay/shared';
import type { ReactNode } from 'react';

import { ptBR } from '@/i18n/ptBR';

import type { AnyEntityRecord } from './entityRecordsOfType';
import { writeLocalDateTimeText } from './localDateTimeText';
import { MediaThumbnail } from './MediaThumbnail';

const texts = ptBR.entityLibrary;
const columnTexts = texts.columns;

/** What a cell may need besides its record: the moment (for a slot's status) and the slots. */
export type EntityTableCellContext = { nowMs: number; scheduleSlots: ScheduleSlot[] };

/** One column of a tab's table: its header and how a record fills its cell. */
export type EntityTableColumn = {
  header: string;
  renderCell: (record: AnyEntityRecord, context: EntityTableCellContext) => ReactNode;
};

/** A cell's text, or "—" when the record has no value there. */
function writeOrDash(value: string | number | undefined): string {
  return value === undefined ? texts.noValue : String(value);
}

/** A small thumbnail of an image field, or "—" when the record has none. */
function renderThumbnailOrDash(mediaId: string | undefined, fieldLabel: string): ReactNode {
  if (mediaId === undefined) {
    return texts.noValue;
  }
  return (
    <MediaThumbnail
      mediaId={mediaId}
      alt={texts.image.thumbnailAlt(fieldLabel)}
      sizeClassName="h-8 w-8"
    />
  );
}

const teamColumns: EntityTableColumn[] = [
  { header: columnTexts.carNumber, renderCell: (record) => (record as Team).carNumber },
  { header: columnTexts.teamName, renderCell: (record) => (record as Team).teamName },
  { header: columnTexts.school, renderCell: (record) => (record as Team).schoolName },
  {
    header: columnTexts.place,
    renderCell: (record) => texts.cityAndState((record as Team).city, (record as Team).state),
  },
  {
    header: columnTexts.logo,
    renderCell: (record) =>
      renderThumbnailOrDash((record as Team).logoMediaId, ptBREntities.teamFieldLabels.logoMediaId),
  },
];

const personColumns: EntityTableColumn[] = [
  { header: columnTexts.name, renderCell: (record) => (record as Person).name },
  { header: columnTexts.role, renderCell: (record) => (record as Person).role },
  {
    header: columnTexts.teamOfPerson,
    renderCell: (record) => writeOrDash((record as Person).carNumber),
  },
  {
    header: columnTexts.photo,
    renderCell: (record) =>
      renderThumbnailOrDash(
        (record as Person).photoMediaId,
        ptBREntities.personFieldLabels.photoMediaId,
      ),
  },
];

const sponsorColumns: EntityTableColumn[] = [
  { header: columnTexts.name, renderCell: (record) => (record as Sponsor).name },
  {
    header: columnTexts.tier,
    renderCell: (record) => ptBREntities.tierLabels[(record as Sponsor).tier],
  },
  { header: columnTexts.rollWeight, renderCell: (record) => (record as Sponsor).rollWeight },
  {
    header: columnTexts.logo,
    renderCell: (record) =>
      renderThumbnailOrDash(
        (record as Sponsor).logoMediaId,
        ptBREntities.sponsorFieldLabels.logoMediaId,
      ),
  },
];

const scheduleSlotColumns: EntityTableColumn[] = [
  {
    header: columnTexts.startsAt,
    renderCell: (record) => writeLocalDateTimeText((record as ScheduleSlot).startsAtMs),
  },
  { header: columnTexts.sessionName, renderCell: (record) => (record as ScheduleSlot).sessionName },
  {
    header: columnTexts.sessionKind,
    renderCell: (record) => {
      const sessionKind = (record as ScheduleSlot).sessionKind;
      return ptBR.bindings.overrides.sessionKinds[sessionKind] ?? sessionKind;
    },
  },
  {
    header: columnTexts.placeOfSlot,
    renderCell: (record) => writeOrDash((record as ScheduleSlot).place),
  },
  {
    header: columnTexts.status,
    // Worked out at every draw from the server-aligned clock, never stored.
    renderCell: (record, context) =>
      labelOfScheduleSlotStatus(
        findStatusOfScheduleSlot(record as ScheduleSlot, context.scheduleSlots, context.nowMs),
      ),
  },
];

/** The columns of one tab's table, before its actions. */
export function listTableColumnsOfEntityType(entityType: EntityType): EntityTableColumn[] {
  switch (entityType) {
    case 'team':
      return teamColumns;
    case 'person':
      return personColumns;
    case 'sponsor':
      return sponsorColumns;
    case 'scheduleSlot':
      return scheduleSlotColumns;
  }
}
