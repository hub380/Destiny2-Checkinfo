import { getDestinySummary } from './summary.js';
import { fetchCharacterRefs, normalizeCharacterRefs } from './shared.js';
export async function resolveDetailsTarget(body, env, ctx) {
  const membershipType = body?.membershipType || body?.account?.membershipType;
  const membershipId = body?.membershipId || body?.account?.membershipId;
  if (membershipType && membershipId) {
    return {
      membership: {
        membershipType,
        membershipId
      }
    };
  }

  const career = await getDestinySummary(body, env, ctx);
  return {
    membership: {
      membershipType: career.account.membershipType,
      membershipId: career.account.membershipId
    }
  };
}

export async function resolveEndgameTarget(body, env, ctx) {
  const membershipType = body?.membershipType || body?.account?.membershipType;
  const membershipId = body?.membershipId || body?.account?.membershipId;
  if (membershipType && membershipId) {
    const membership = {
      membershipType,
      membershipId
    };
    let characters = normalizeCharacterRefs(body?.characters);
    if (!characters.length) {
      characters = await fetchCharacterRefs(membership, env);
    }
    return { membership, characters };
  }

  const career = await getDestinySummary(body, env, ctx);
  return {
    membership: {
      membershipType: career.account.membershipType,
      membershipId: career.account.membershipId
    },
    characters: normalizeCharacterRefs(career.characters)
  };
}