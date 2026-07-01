/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { makeWeaponRecord } from '../src/lib/gear/factories-records.js';
import { publicWeaponRecord } from '../src/lib/gear/public.js';
import { GearDetailSlot } from '../src/frontend/pages/gear/GearDetailViews';

afterEach(() => cleanup());

describe('gear catalyst records', () => {
  it('extracts catalyst perk, stat bonuses, and kill requirement for exotic weapons', () => {
    const record = makeWeaponRecord(
      exoticWeaponDefinition(),
      weaponItem('Exotic Test', 'Exotic'),
      catalystItems(),
      catalystPlugSets(),
      statDefinitions(),
      new Map(),
      new Map(),
      sandboxPerks(),
      objectiveDefinitions()
    );

    expect(record.catalyst).toEqual({
      perk: {
        name: 'Catalyst Spark',
        description: 'Adds a stronger catalyst effect.',
        icon: 'https://www.bungie.net/common/catalyst.png'
      },
      statBonuses: [{ name: 'Stability', value: 20 }],
      killsRequired: 500,
      progressDescription: 'Defeat targets with this weapon.'
    });
  });

  it('does not add catalyst data to legendary weapons', () => {
    const record = makeWeaponRecord(
      { ...exoticWeaponDefinition(), inventory: { tierType: 5 } },
      weaponItem('Legendary Test', 'Legendary'),
      catalystItems(),
      catalystPlugSets(),
      statDefinitions(),
      new Map(),
      new Map(),
      sandboxPerks(),
      objectiveDefinitions()
    );

    expect(record.catalyst).toBeNull();
  });

  it('exposes catalyst data through public weapon detail DTO', () => {
    const catalyst = {
      perk: { name: 'Catalyst Spark', description: 'Effect.', icon: '' },
      statBonuses: [],
      killsRequired: 0,
      progressDescription: ''
    };
    const dto = publicWeaponRecord({
      hash: 1001,
      name: 'Exotic Test',
      baseName: 'Exotic Test',
      icon: '',
      weaponType: 'Hand Cannon',
      ammo: 'Primary',
      element: 'Kinetic',
      adept: false,
      stats: [],
      screenshot: '',
      sourceHints: [],
      sockets: [],
      catalyst
    }, { items: [], weaponPlugs: [] });

    expect(dto.catalyst).toBe(catalyst);
  });
});

describe('gear catalyst UI', () => {
  it('renders catalyst perk, stat bonuses, and kill requirement in weapon detail', () => {
    render(React.createElement(GearDetailSlot, {
      detail: weaponDetailPayload({
        catalyst: {
          perk: { name: 'Catalyst Spark', description: 'Effect text.', icon: '' },
          statBonuses: [{ name: 'Stability', value: 20 }],
          killsRequired: 500,
          progressDescription: 'Defeat targets with this weapon.'
        }
      })
    }));

    expect(screen.getByText('催化剂')).toBeTruthy();
    expect(screen.getByText('Catalyst Spark')).toBeTruthy();
    expect(screen.getByText(/Stability\s+\+20/)).toBeTruthy();
    expect(screen.getByText('催化进度目标')).toBeTruthy();
    expect(screen.getByText(/需击杀/)).toBeTruthy();
    expect(screen.getByText(/500/)).toBeTruthy();
  });

  it('renders progress description without a number when killsRequired is zero', () => {
    render(React.createElement(GearDetailSlot, {
      detail: weaponDetailPayload({
        catalyst: {
          perk: { name: 'Catalyst Spark', description: '', icon: '' },
          statBonuses: [],
          killsRequired: 0,
          progressDescription: 'Complete the catalyst objective.'
        }
      })
    }));

    expect(screen.getByText('催化剂')).toBeTruthy();
    expect(screen.getByText('催化进度目标')).toBeTruthy();
    expect(screen.getByText('Complete the catalyst objective.')).toBeTruthy();
    expect(screen.queryByText(/：0/)).toBeNull();
  });

  it('does not render catalyst section when weapon detail has no catalyst', () => {
    render(React.createElement(GearDetailSlot, {
      detail: weaponDetailPayload({ catalyst: null })
    }));

    expect(screen.queryByText('催化剂')).toBeNull();
  });
});

function exoticWeaponDefinition() {
  return {
    hash: 1001,
    displayProperties: { name: 'Exotic Test' },
    inventory: { tierType: 6 },
    sockets: { socketEntries: [{ reusablePlugSetHash: 5001 }] },
    stats: { stats: {} },
    screenshot: ''
  };
}

function catalystPlugSets() {
  return {
    5001: {
      reusablePlugItems: [{ plugItemHash: 9000 }, { plugItemHash: 9001 }]
    }
  };
}

function catalystItems() {
  return {
    9000: {
      hash: 9000,
      displayProperties: { name: '空催化插槽', description: '可以将异域催化插入此插槽。' },
      plug: { plugCategoryIdentifier: 'v400.empty.exotic.masterwork' }
    },
    9001: {
      hash: 9001,
      displayProperties: { name: 'Catalyst Plug' },
      plug: { plugCategoryIdentifier: 'v400.weapon.masterwork' },
      perks: [{ isDisplayable: true, perkHash: 8001 }],
      investmentStats: [{ statTypeHash: 7001, value: 20 }],
      objectives: { objectiveHashes: [6001] }
    }
  };
}

function sandboxPerks() {
  return {
    8001: {
      displayProperties: {
        name: 'Catalyst Spark',
        description: 'Adds a stronger catalyst effect.',
        icon: '/common/catalyst.png'
      }
    }
  };
}

function statDefinitions() {
  return {
    7001: { displayProperties: { name: 'Stability' } }
  };
}

function objectiveDefinitions() {
  return {
    6001: {
      completionValue: 500,
      progressDescription: 'Defeat targets with this weapon.'
    }
  };
}

function weaponItem(name: string, tier: string) {
  return {
    kind: 'weapon',
    hash: 1001,
    name,
    icon: '',
    weaponType: 'Hand Cannon',
    ammo: 'Primary',
    element: 'Kinetic',
    tier,
    adept: false,
    sourceHints: []
  };
}

function weaponDetailPayload({ catalyst }: { catalyst: unknown }) {
  return {
    item: {
      kind: 'weapon',
      name: 'Exotic Test',
      icon: ''
    },
    detail: {
      name: 'Exotic Test',
      weaponType: 'Hand Cannon',
      ammo: 'Primary',
      element: 'Kinetic',
      adept: false,
      stats: [],
      sockets: [],
      sourceHints: [],
      catalyst
    }
  };
}
