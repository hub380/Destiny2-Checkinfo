export type JsonRecord = Record<string, any>;

export interface StatDto {
  value?: number | string;
  displayValue?: string;
}

export interface FireteamDto extends JsonRecord {
  id?: string;
  title?: string;
  activity?: string;
  content?: string;
  author?: string;
  username?: string;
  joinCommand?: string;
  avatar?: string;
  link?: string;
  source?: string;
  createdAt?: string;
  tags?: string[];
  slots?: {
    current?: number;
    max?: number;
  };
}

export interface FireteamsResponseDto extends JsonRecord {
  source?: string;
  updatedAt?: string;
  warning?: string;
  items?: FireteamDto[];
}

export interface CharacterDto extends JsonRecord {
  id?: string;
  className?: string;
  raceName?: string;
  genderName?: string;
  light?: number | string;
  emblemPath?: string;
  minutesPlayedTotal?: number | string;
}

export interface CareerSummaryDto extends JsonRecord {
  updatedAt?: string;
  queriedName?: string;
  account: JsonRecord;
  profile?: JsonRecord;
  stats?: JsonRecord;
  characters?: CharacterDto[];
  details?: JsonRecord;
  endgame?: JsonRecord;
  endgameLoading?: boolean | Record<string, boolean>;
  endgameErrors?: Record<string, string>;
  detailLoading?: boolean;
  detailError?: string;
}

export interface PlayerSearchItemDto extends JsonRecord {
  bungieName: string;
  displayName?: string;
  displayNameCode?: number;
  membershipType?: number;
  membershipTypeName?: string;
  membershipId?: string;
  displayMembershipName?: string;
  icon?: string;
  linkedAccounts?: JsonRecord[];
}

export interface PlayerSearchDto extends JsonRecord {
  query?: string;
  page?: number;
  hasMore?: boolean;
  items?: PlayerSearchItemDto[];
  cache?: JsonRecord;
}

export interface EndgameDto extends JsonRecord {
  endgame?: JsonRecord;
  statsPatch?: JsonRecord;
  cache?: JsonRecord;
  warnings?: string[];
}

export interface EndgameStatBlockDto extends JsonRecord {
  clears?: StatDto | number | string;
  attempts?: StatDto | number | string;
  activitiesEntered?: StatDto | number | string;
  completionRate?: StatDto | number | string;
  kills?: StatDto | number | string;
  deaths?: StatDto | number | string;
  kd?: StatDto | number | string;
  hours?: StatDto | number | string;
  soloFlawlessClears?: StatDto | number | string;
  activitiesWon?: StatDto | number | string;
  opponentsDefeated?: StatDto | number | string;
  kda?: StatDto | number | string;
  efficiency?: StatDto | number | string;
  secondsPlayed?: StatDto | number | string;
  winRate?: StatDto | number | string;
  total?: EndgameStatBlockDto;
  activities?: EndgameActivityDto[];
  subModes?: PvpSubModeDto[];
}

export interface EndgameActivityDto extends JsonRecord {
  name?: string;
  image?: string;
  variantCount?: number;
  variants?: EndgameVariantDto[];
  clears?: StatDto | number | string;
  attempts?: StatDto | number | string;
  completionRate?: StatDto | number | string;
  kd?: StatDto | number | string;
  kills?: StatDto | number | string;
  bestTime?: StatDto | number | string;
  lastPlayed?: string;
  soloClears?: StatDto;
  soloFlawlessClears?: StatDto;
}

export interface EndgameVariantDto extends JsonRecord {
  hash?: string | number;
  name?: string;
  clears?: StatDto | number | string;
}

export interface PvpSubModeDto extends JsonRecord {
  modeId?: string | number;
  label?: string;
  lastPlayed?: string;
  activitiesEntered?: StatDto | number | string;
  winRate?: StatDto | number | string;
  kd?: StatDto | number | string;
  opponentsDefeated?: StatDto | number | string;
  kills?: StatDto | number | string;
}

export interface CareerRecordsDto extends JsonRecord {
  privacy?: string;
  activeScore?: StatDto | number | string;
  lifetimeScore?: StatDto | number | string;
  legacyScore?: StatDto | number | string;
  completedRecords?: StatDto | number | string;
  recordCount?: StatDto | number | string;
}

export interface CraftingPatternDto extends JsonRecord {
  label?: string;
  percent?: number;
  complete?: boolean;
}

export interface CraftingItemDto extends JsonRecord {
  hash?: string | number;
  name?: string;
  icon?: string;
  type?: string;
  source?: string;
  sourceHash?: string | number;
  watermark?: string;
  unlocked?: boolean;
  pattern?: CraftingPatternDto;
}

export interface CraftingSummaryDto extends JsonRecord {
  privacy?: string;
  unlocked?: StatDto | number | string;
  total?: StatDto | number | string;
  completionRate?: StatDto | number | string;
  plugUnlocked?: StatDto | number | string;
  plugTotal?: StatDto | number | string;
  plugCompletionRate?: StatDto | number | string;
  items?: CraftingItemDto[];
}

export interface CraftingSourceGroupDto {
  key: string;
  source: string;
  items: CraftingItemDto[];
  complete: number;
  total: number;
}

export interface CraftingSeasonGroupDto {
  key: string;
  season: string;
  sources: CraftingSourceGroupDto[];
  complete: number;
  total: number;
}

export interface FireteamMemberLookupDto extends JsonRecord {
  membershipId?: string;
  membershipType?: number | string;
  status?: number | string | null;
  statusLabel?: string;
  source?: string;
  account?: JsonRecord;
  profile?: JsonRecord;
  characters?: CharacterDto[];
  stats?: JsonRecord;
  endgame?: JsonRecord;
  warnings?: string[];
  error?: string;
  elapsedMs?: number;
}

export interface FireteamLookupDto extends JsonRecord {
  updatedAt?: string;
  query?: string;
  modes?: string[];
  anchor?: JsonRecord;
  currentActivity?: JsonRecord;
  joinability?: JsonRecord;
  members?: FireteamMemberLookupDto[];
  summary?: JsonRecord;
  message?: string;
  cache?: JsonRecord;
}

export interface GearCatalystStatBonus {
  name: string;
  value: number;
}

export interface GearCatalystPerk {
  name: string;
  description: string;
  icon: string;
}

export interface GearCatalyst {
  perk: GearCatalystPerk;
  statBonuses: GearCatalystStatBonus[];
  killsRequired: number;
  progressDescription: string;
}

export interface GearSearchEncounterContext {
  sourceText: string;
  encounterZh: string;
  encounterKey: string;
}

export interface GearSearchSourceContext {
  sourceText: string;
  sourceZh: string;
  sourceType: string;
}

export interface GearSearchDto extends JsonRecord {
  query?: string;
  total?: number;
  manifestVersion?: string;
  items?: JsonRecord[];
  cache?: JsonRecord;
  /** Populated when the query matched a specific encounter (e.g. "国王的陨落 战争祭司"). */
  encounter?: GearSearchEncounterContext;
  /** Populated when the query matched an activity alias (e.g. "国王的陨落"). */
  source?: GearSearchSourceContext;
}

export interface GuideSummaryDto extends JsonRecord {
  slug: string;
  title: string;
  subtitle?: string;
  type?: string;
  typeLabel?: string;
  activityHash?: string;
  activityName?: string;
  cover?: string;
  summary?: string;
  tags?: string[];
  updatedAt?: string;
  difficulty?: string;
  estimatedMinutes?: number;
}

export interface GuideIndexDto extends JsonRecord {
  updatedAt?: string;
  categories?: string[];
  tags?: string[];
  items?: GuideSummaryDto[];
  cache?: JsonRecord;
}

export interface GuideDetailDto extends GuideSummaryDto {
  authors?: string[];
  videos?: JsonRecord[];
  sections?: JsonRecord[];
  related?: string[];
  cache?: JsonRecord;
}
