import { getDestinySummary } from './summary.js';
import { getDestinyEndgame } from './endgame.js';
import { attachEndgameToCareer } from './shared.js';
export async function getDestinyCareer(body, env, ctx) {
  const career = await getDestinySummary(body, env, ctx);
  const endgamePayload = await getDestinyEndgame(
    {
      membershipType: career.account.membershipType,
      membershipId: career.account.membershipId,
      characters: career.characters
    },
    env,
    ctx
  );
  return attachEndgameToCareer(career, endgamePayload);
}