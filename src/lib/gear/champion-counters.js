const COUNTER_DEFINITIONS = [
  {
    type: 'barrier',
    label: '反屏障',
    patterns: [
      /屏障勇士/i,
      /反屏障/i,
      /anti[-\s]?barrier/i,
      /barrier champion/i
    ]
  },
  {
    type: 'overload',
    label: '反过载',
    patterns: [
      /过载勇士/i,
      /超载勇士/i,
      /反过载/i,
      /反超载/i,
      /overload champion/i
    ]
  },
  {
    type: 'unstoppable',
    label: '反势不可挡',
    patterns: [
      /势不可挡勇士/i,
      /勢不可擋勇士/i,
      /反势不可挡/i,
      /反勢不可擋/i,
      /unstoppable champion/i
    ]
  }
];

export function extractChampionCounters(perk) {
  const text = [
    perk?.name,
    perk?.type,
    perk?.description,
    perk?.searchText
  ].filter(Boolean).join(' ');
  if (!text) return [];
  return COUNTER_DEFINITIONS
    .filter((counter) => counter.patterns.some((pattern) => pattern.test(text)))
    .map(({ type, label }) => ({ type, label }));
}
