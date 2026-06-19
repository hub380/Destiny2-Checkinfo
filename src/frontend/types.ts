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

export interface GearSearchDto extends JsonRecord {
  query?: string;
  total?: number;
  manifestVersion?: string;
  items?: JsonRecord[];
  cache?: JsonRecord;
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
