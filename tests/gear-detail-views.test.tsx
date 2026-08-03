// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GearDetailSlot } from '@frontend/pages/gear/GearDetailViews';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function weaponGroup(name: string, hash: number) {
  return {
    name,
    weaponType: 'Fusion Rifle',
    ammo: 'Special',
    element: 'Solar',
    canRoll: { normal: true, enhanced: true },
    variants: [
      {
        hash,
        name,
        icon: '',
        sockets: [
          {
            socketIndex: 0,
            label: 'Frame',
            perks: [{ hash: 1, name: 'Precision Frame', description: 'Intrinsic' }]
          },
          {
            socketIndex: 3,
            label: 'Column 4',
            perks: [{ hash: 2, name: 'Hidden Trait', description: 'Visible only after selection' }]
          }
        ]
      }
    ]
  };
}

describe('GearDetailViews perk weapon groups', () => {
  const payload = {
    query: 'Bait and Switch',
    perks: [],
    total: 1,
    weapons: [weaponGroup('Test Weapon', 100)]
  };

  it('shows perk columns in a separate selected weapon panel', () => {
    render(<GearDetailSlot detail={payload} />);
    const toggle = screen.getByRole('button', { name: /Test Weapon/ });

    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByText('Hidden Trait')).toBeNull();

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Hidden Trait')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '关闭武器词条详情' }));

    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByText('Hidden Trait')).toBeNull();
  });

  it('selects weapon perk details with keyboard', () => {
    render(<GearDetailSlot detail={payload} />);
    const toggle = screen.getByRole('button', { name: /Test Weapon/ });

    fireEvent.keyDown(toggle, { key: 'Enter' });

    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Hidden Trait')).toBeTruthy();
  });

  it('loads additional perk weapon groups from the server', async () => {
    const weapons = Array.from({ length: 25 }, (_, index) => weaponGroup(`Weapon ${String(index + 1).padStart(2, '0')}`, 1000 + index));
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => {
      const body = JSON.parse(String(options?.body || '{}'));
      return new Response(JSON.stringify({
        query: 'test perk',
        perks: [],
        total: weapons.length,
        limit: body.limit,
        offset: body.offset,
        weapons: [weapons[24]]
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<GearDetailSlot detail={{ query: 'test perk', perks: [], total: weapons.length, limit: 24, offset: 0, weapons: weapons.slice(0, 24) }} />);

    expect(screen.getAllByText('Weapon 01').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Weapon 25')).toHaveLength(0);
    expect(screen.getByText('1 / 2')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Next perk weapon page' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({ query: 'test perk', limit: 24, offset: 24 });
    await waitFor(() => expect(screen.queryAllByText('Weapon 01')).toHaveLength(0));
    expect(screen.getAllByText('Weapon 25').length).toBeGreaterThan(0);
    expect(screen.getByText('2 / 2')).toBeTruthy();
  });
});

describe('GearDetailViews roll recommendation badges', () => {
  it('renders anti-champion badges on perk cards', () => {
    render(<GearDetailSlot detail={{
      item: {
        hash: 9002,
        kind: 'weapon',
        name: 'Exotic Counter Weapon'
      },
      detail: {
        hash: 9002,
        name: 'Exotic Counter Weapon',
        stats: [],
        sockets: [
          {
            socketIndex: 0,
            label: '框架 / 固有',
            perks: [
              {
                hash: 5001,
                name: 'Queen Counter',
                type: '固有',
                description: '克制屏障勇士。',
                championCounters: [{ type: 'barrier', label: '反屏障' }]
              }
            ]
          }
        ],
        recommendations: []
      }
    }} />);

    expect(screen.getByText('反屏障')).toBeTruthy();
  });

  it('marks recommended perks in place without rendering separate roll cards', () => {
    render(<GearDetailSlot detail={{
      item: {
        hash: 9001,
        kind: 'weapon',
        name: 'Test Heavy Weapon'
      },
      detail: {
        hash: 9001,
        name: 'Test Heavy Weapon',
        stats: [],
        sockets: [
          {
            socketIndex: 3,
            label: 'Column 4',
            perks: [
              { hash: 3001, name: 'Reload Perk', description: 'Reloads the weapon.' },
              { hash: 3002, name: 'Duel Perk', description: 'Improves consistency.' }
            ]
          },
          {
            socketIndex: 4,
            label: 'Column 5',
            perks: [
              { hash: 4001, name: 'Damage Perk', description: 'Increases damage.' }
            ]
          }
        ],
        recommendations: [
          {
            id: 'pve-clear',
            mode: 'pve',
            label: '清怪',
            source: 'test',
            sockets: [
              { socketIndex: 3, perkHashes: [3001] },
              { socketIndex: 4, perkHashes: [4001] }
            ]
          },
          {
            id: 'pve-damage',
            mode: 'pve',
            label: '输出',
            source: 'test',
            sockets: [
              { socketIndex: 3, perkHashes: [3001] },
              { socketIndex: 4, perkHashes: [4001] }
            ]
          },
          {
            id: 'pvp-duel',
            mode: 'pvp',
            label: '对枪',
            source: 'test',
            sockets: [
              { socketIndex: 3, perkHashes: [3002] }
            ]
          },
          {
            id: 'lightgg-popular',
            mode: 'general',
            label: '社区热度 12%',
            source: 'light.gg',
            sockets: [
              { socketIndex: 3, perkHashes: [3001] },
              { socketIndex: 4, perkHashes: [4001] }
            ]
          }
        ]
      }
    }} />);

    expect(screen.queryByText('推荐组合')).toBeNull();
    expect(screen.getAllByText('PvE · 清怪')).toHaveLength(2);
    expect(screen.getAllByText('PvE · 输出')).toHaveLength(2);
    expect(screen.getByText('PvP · 对枪')).toBeTruthy();
    expect(screen.getAllByText('热度 1')).toHaveLength(2);
  });
});
