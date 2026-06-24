import { normalizeXiaoheiheHomePayload } from './heybox.js';
import { tryParseJson } from '../utils/index.js';
import { requestText } from '../bungie/index.js';
import { httpError } from '../http/index.js';
import { parseJsonEnv } from '../utils/index.js';

const DEFAULT_HEYBOX_SOURCE_URL = 'https://api.xiaoheihe.cn/game/common_team_v2/home?appid=1085660';

const SAMPLE_FIRETEAMS = [
  {
    id: 'demo-1',
    source: 'demo',
    title: '宗师日落 需要清怪稳定',
    activity: 'PvE / 宗师',
    content: '缺 1，带反勇士，语音可不开。',
    author: '示例队长',
    username: 'GuardianCN#2333',
    joinCommand: '/j GuardianCN#2333',
    slots: { current: 2, max: 3 },
    createdAt: new Date(Date.now() - 8 * 60_000).toISOString(),
    tags: ['演示数据']
  }
];

export async function getFireteams(env) {
  const configuredUrl = env.HEYBOX_SOURCE_URL || DEFAULT_HEYBOX_SOURCE_URL;
  const method = (env.HEYBOX_SOURCE_METHOD || 'GET').toUpperCase();
  const headers = parseJsonEnv(env.HEYBOX_SOURCE_HEADERS, {});
  const { response, text } = await requestText(
    configuredUrl,
    {
      method,
      headers: {
        accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.6',
        'user-agent': 'Mozilla/5.0 Destiny2FireteamDashboard/1.0',
        ...headers
      },
      body: method === 'GET' || method === 'HEAD' ? undefined : env.HEYBOX_SOURCE_BODY
    },
    env
  );

  if (!response.ok) {
    throw httpError(response.status, 'HEYBOX_SOURCE_ERROR', `小黑盒数据源返回 HTTP ${response.status}`);
  }

  const payload = tryParseJson(text);
  if (!payload) {
    return {
      source: 'demo',
      updatedAt: new Date().toISOString(),
      warning: '小黑盒接口没有返回 JSON，当前显示演示数据。',
      items: SAMPLE_FIRETEAMS
    };
  }

  const items = normalizeXiaoheiheHomePayload(payload, configuredUrl);
  return {
    source: 'heybox',
    sourceUrl: configuredUrl,
    parser: 'xiaoheihe-common-team-v2',
    updatedAt: new Date().toISOString(),
    warning: payload.status && payload.status !== 'ok' ? payload.msg || '小黑盒接口返回异常状态。' : undefined,
    items
  };
}
