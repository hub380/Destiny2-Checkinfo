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

export interface EndgameDto extends JsonRecord {
  endgame?: JsonRecord;
  statsPatch?: JsonRecord;
  cache?: JsonRecord;
  warnings?: string[];
}

export interface GearSearchDto extends JsonRecord {
  query?: string;
  total?: number;
  manifestVersion?: string;
  items?: JsonRecord[];
  cache?: JsonRecord;
}
