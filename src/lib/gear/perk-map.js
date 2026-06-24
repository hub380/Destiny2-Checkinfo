export function perkMap(index) {
  return new Map([
    ...index.items.filter((item) => item.kind === 'perk').map((item) => [item.hash, item]),
    ...(index.weaponPlugs || []).map((item) => [item.hash, item])
  ]);
}
