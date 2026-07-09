import { cleanText, extractDestinyName } from '../utils/index.js';
import { parseTime, stableId } from '../utils/index.js';

export function normalizeHeyboxHomePayload(payload, sourceUrl) {
  const list = payload?.result?.team_list;
  if (!Array.isArray(list)) return [];

  return list
    .filter((item) => item && !item.is_room_delete)
    .map((item, index) => mapHeyboxTeam(item, index, sourceUrl))
    .filter(Boolean)
    .sort((a, b) => Number(a.expired) - Number(b.expired) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export function mapHeyboxTeam(item, index, sourceUrl) {
  const content = cleanText(item.content_text || '');
  const tagTexts = Array.isArray(item.tags) ? item.tags.map((tag) => cleanText(tag.desc)).filter(Boolean) : [];
  const lightTags = tagTexts.filter((tag) => /^光等/.test(tag));
  const activityTags = tagTexts.filter((tag) => !/^光等/.test(tag));
  const expired = Boolean(item.is_expired || Number(item.remain_seconds) <= 0);
  const stateTag = item.is_full ? '已满' : expired ? '已过期' : stateLabel(item.display_state);
  const username = extractDestinyName(item.game_id || '') || extractDestinyName(content);
  const title = content ? content.slice(0, 54) : activityTags.join(' / ') || '小黑盒组队';
  const tags = [...activityTags, ...lightTags, stateTag].filter(Boolean);

  return {
    id: String(item.link_id || stableId(content, username, index)),
    source: 'heybox',
    title,
    activity: activityTags.join(' / '),
    content,
    author: item.user?.username || '',
    username,
    joinCommand: username ? `/加入 ${username}` : '',
    slots: parseHeyboxSlots(content),
    link: sourceUrl,
    createdAt: parseTime(item.modify_at) || null,
    tags,
    expired,
    remainingSeconds: Number(item.remain_seconds || 0),
    avatar: item.user?.avatar || item.user?.avartar || ''
  };
}

export function stateLabel(displayState) {
  return { online: '在线', chat: '可聊天' }[displayState] || '';
}

export function parseHeyboxSlots(content) {
  const eq = String(content || '').match(/(\d{1,2})\s*=\s*(\d{1,2})/);
  if (eq) {
    const current = Number(eq[1]);
    const missing = Number(eq[2]);
    return { current, max: current + missing };
  }

  const slash = String(content || '').match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
  if (slash) return { current: Number(slash[1]), max: Number(slash[2]) };
  return null;
}
