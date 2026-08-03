import { describe, expect, it } from 'vitest';
import { extractChampionCounters } from '../src/lib/gear/champion-counters.js';
import { addWeaponPlug } from '../src/lib/gear/factories-records.js';
import { publicPerkRef } from '../src/lib/gear/public.js';

describe('gear champion counters', () => {
  it('extracts anti-champion counters from simplified Chinese perk text', () => {
    expect(extractChampionCounters({
      name: '区域拒止框架',
      type: '固有',
      description: '此武器的持续伤害会将目标包围在一个可削弱并眩晕他们的区域。克制过载勇士。'
    })).toEqual([{ type: 'overload', label: '反过载' }]);

    expect(extractChampionCounters({
      name: '微型导弹框架',
      description: '榴弹直接命中可眩晕目标。克制势不可挡勇士。'
    })).toEqual([{ type: 'unstoppable', label: '反势不可挡' }]);
  });

  it('extracts exotic anti-champion counters from English and traditional Chinese text', () => {
    expect(extractChampionCounters({
      name: 'Queen\'s Wrath',
      description: 'This weapon fires shield-piercing arrows that stun Barrier Champions.'
    })).toEqual([{ type: 'barrier', label: '反屏障' }]);

    expect(extractChampionCounters({
      name: '固有特性',
      description: '此武器可克制勢不可擋勇士。'
    })).toEqual([{ type: 'unstoppable', label: '反势不可挡' }]);
  });

  it('passes champion counters through public perk DTO', () => {
    const dto = publicPerkRef({
      hash: 123,
      name: 'Counter Perk',
      type: '固有',
      description: '',
      stats: [],
      championCounters: [{ type: 'barrier', label: '反屏障' }]
    });

    expect(dto.championCounters).toEqual([{ type: 'barrier', label: '反屏障' }]);
  });

  it('enriches weapon plug records during gear index construction', () => {
    const output = new Map();
    addWeaponPlug(output, {
      hash: 456,
      itemTypeDisplayName: '固有',
      displayProperties: {
        name: '区域拒止框架',
        description: '每个射弹命中时都会留下一个造成持续伤害的区域。克制过载勇士。'
      },
      plug: { plugCategoryIdentifier: 'intrinsics' },
      investmentStats: []
    }, {});

    expect(output.get(456)?.championCounters).toEqual([{ type: 'overload', label: '反过载' }]);
  });
});
