const REFRESH_SECONDS = 30;

const state = {
  items: [],
  autoRefresh: true,
  nextRefreshAt: 0,
  countdownTimer: null,
  refreshTimer: null,
  loading: false,
  config: null
};

const elements = {
  sourceBadge: document.querySelector('#sourceBadge'),
  lastUpdated: document.querySelector('#lastUpdated'),
  autoRefresh: document.querySelector('#autoRefresh'),
  countdown: document.querySelector('#countdown'),
  refreshButton: document.querySelector('#refreshButton'),
  feedSummary: document.querySelector('#feedSummary'),
  feedNotice: document.querySelector('#feedNotice'),
  fireteamList: document.querySelector('#fireteamList'),
  filterInput: document.querySelector('#filterInput'),
  careerForm: document.querySelector('#careerForm'),
  careerInput: document.querySelector('#careerInput'),
  careerNotice: document.querySelector('#careerNotice'),
  careerResult: document.querySelector('#careerResult'),
  careerSubtitle: document.querySelector('#careerSubtitle'),
  toast: document.querySelector('#toast')
};

init();

async function init() {
  bindEvents();
  await loadConfig();
  await refreshFireteams();
  startCountdown();
  scheduleRefresh();
}

function bindEvents() {
  elements.refreshButton.addEventListener('click', () => refreshFireteams({ manual: true }));
  elements.autoRefresh.addEventListener('change', () => {
    state.autoRefresh = elements.autoRefresh.checked;
    if (state.autoRefresh) {
      scheduleRefresh();
      showToast('自动刷新已开启');
    } else {
      clearTimeout(state.refreshTimer);
      elements.countdown.textContent = 'off';
      showToast('自动刷新已关闭');
    }
  });

  elements.filterInput.addEventListener('input', renderFireteams);

  elements.fireteamList.addEventListener('click', async (event) => {
    const copyButton = event.target.closest('[data-copy]');
    if (copyButton) {
      await copyJoinCommand(copyButton.dataset.copy);
      return;
    }

    const username = event.target.closest('[data-username]');
    if (username) {
      elements.careerInput.value = username.dataset.username;
      elements.careerInput.focus();
    }
  });

  elements.careerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    await queryCareer(elements.careerInput.value);
  });
}

async function loadConfig() {
  try {
    const config = await fetchJson('/api/config-public');
    state.config = config;
    if (!config.hasBungieApiKey) {
      setNotice(elements.careerNotice, '请在 .env 中配置 BUNGIE_API_KEY 后查询棒鸡公开玩家生涯。');
    }
  } catch (error) {
    setNotice(elements.feedNotice, error.message, true);
  }
}

async function refreshFireteams() {
  if (state.loading) return;
  state.loading = true;
  elements.refreshButton.disabled = true;
  elements.feedSummary.textContent = '刷新中';

  try {
    const payload = await fetchJson('/api/fireteams');
    state.items = Array.isArray(payload.items) ? payload.items : [];
    updateSourceState(payload);
    renderFireteams();
    state.nextRefreshAt = Date.now() + REFRESH_SECONDS * 1000;
  } catch (error) {
    setNotice(elements.feedNotice, error.message, true);
    elements.feedSummary.textContent = '刷新失败';
    elements.sourceBadge.textContent = '异常';
    elements.sourceBadge.className = 'status-pill warn';
  } finally {
    state.loading = false;
    elements.refreshButton.disabled = false;
    scheduleRefresh();
  }
}

function scheduleRefresh() {
  clearTimeout(state.refreshTimer);
  if (!state.autoRefresh) return;
  state.nextRefreshAt = state.nextRefreshAt || Date.now() + REFRESH_SECONDS * 1000;
  const delay = Math.max(state.nextRefreshAt - Date.now(), 1000);
  state.refreshTimer = setTimeout(refreshFireteams, delay);
}

function startCountdown() {
  clearInterval(state.countdownTimer);
  state.countdownTimer = setInterval(() => {
    if (!state.autoRefresh) {
      elements.countdown.textContent = 'off';
      return;
    }
    const seconds = Math.max(Math.ceil((state.nextRefreshAt - Date.now()) / 1000), 0);
    elements.countdown.textContent = `${seconds || REFRESH_SECONDS}s`;
  }, 500);
}

function updateSourceState(payload) {
  const isDemo = payload.source === 'demo';
  elements.sourceBadge.textContent = isDemo ? '演示数据' : '已连接';
  elements.sourceBadge.className = `status-pill ${isDemo ? 'demo' : 'ready'}`;
  elements.lastUpdated.textContent = `更新 ${formatTime(payload.updatedAt)}`;
  if (payload.warning) {
    setNotice(elements.feedNotice, payload.warning, false);
  } else {
    clearNotice(elements.feedNotice);
  }
}

function renderFireteams() {
  const keyword = elements.filterInput.value.trim().toLowerCase();
  const items = state.items.filter((item) => {
    if (!keyword) return true;
    return [item.title, item.content, item.activity, item.author, item.username, ...(item.tags || [])]
      .join(' ')
      .toLowerCase()
      .includes(keyword);
  });

  elements.feedSummary.textContent = `${items.length} 条 / 共 ${state.items.length} 条`;
  if (!items.length) {
    elements.fireteamList.innerHTML = `<div class="career-result empty">没有匹配的组队信息</div>`;
    return;
  }

  elements.fireteamList.innerHTML = items.map(renderFireteamCard).join('');
}

function renderFireteamCard(item) {
  const username = item.username || '';
  const avatar = item.avatar || '/brand.svg';
  const slot = item.slots?.max ? `<span class="slot">${item.slots.current}/${item.slots.max}</span>` : '';
  const tags = (item.tags || [])
    .filter(Boolean)
    .slice(0, 4)
    .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
    .join('');
  const meta = [
    item.activity,
    item.author ? `队长 ${item.author}` : '',
    item.createdAt ? relativeTime(item.createdAt) : '',
    item.source === 'demo' ? '演示' : ''
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join(' · ');

  return `
    <article class="fireteam-card">
      <div class="fireteam-main">
        <div class="fireteam-head">
          <img class="team-avatar" src="${escapeAttribute(avatar)}" alt="" />
          <div class="fireteam-copy">
            <div class="fireteam-title">
              <h3>${escapeHtml(item.title || '未命名组队')}</h3>
              ${slot}
            </div>
            <div class="meta-row">${meta || '小黑盒'}</div>
          </div>
        </div>
        ${tags ? `<div class="tag-row">${tags}</div>` : ''}
        <p class="content">${escapeHtml(item.content || '无详情')}</p>
      </div>
      <div class="join-box">
        <div class="username ${username ? 'clickable' : ''}" ${username ? `data-username="${escapeAttribute(username)}"` : ''}>
          ${username ? escapeHtml(username) : '未识别用户名'}
        </div>
        <button class="copy-button" ${username ? `data-copy="/j ${escapeAttribute(username)}"` : 'disabled'}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 8h10v12H8z" />
            <path d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          复制
        </button>
        ${item.link ? `<a class="tag" href="${escapeAttribute(item.link)}" target="_blank" rel="noreferrer">来源</a>` : ''}
      </div>
    </article>
  `;
}

async function copyJoinCommand(command) {
  try {
    await navigator.clipboard.writeText(command);
    showToast(`已复制 ${command}`);
  } catch {
    const input = document.createElement('textarea');
    input.value = command;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
    showToast(`已复制 ${command}`);
  }
}

async function queryCareer(rawName) {
  const bungieName = rawName.trim();
  if (!bungieName) return;
  const queryId = `${Date.now()}-${Math.random()}`;
  state.careerQueryId = queryId;

  clearNotice(elements.careerNotice);
  elements.careerResult.className = 'career-result empty';
  elements.careerResult.textContent = '查询基础资料中';

  try {
    const career = await fetchJson('/api/destiny/summary', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bungieName })
    });
    if (state.careerQueryId !== queryId) return;
    let renderedCareer = {
      ...career,
      endgameLoading: { raid: true, dungeon: true }
    };
    renderCareer(renderedCareer);

    setNotice(elements.careerNotice, 'Raid / 地牢完整历史加载中，基础资料已先展示。');
    const modeRequests = ['raid', 'dungeon'].map(async (mode) => {
      const endgame = await fetchJson('/api/destiny/endgame', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode,
          membershipType: career.account.membershipType,
          membershipId: career.account.membershipId,
          characters: career.characters
        })
      });
      if (state.careerQueryId !== queryId) return;
      renderedCareer = mergeEndgameCareer(renderedCareer, endgame);
      renderCareer(renderedCareer);
    });
    await Promise.all(modeRequests);
    if (state.careerQueryId !== queryId) return;
    clearNotice(elements.careerNotice);
  } catch (error) {
    if (state.careerQueryId !== queryId) return;
    setNotice(elements.careerNotice, error.message, true);
    if (!elements.careerResult.innerHTML.trim() || elements.careerResult.classList.contains('empty')) {
      elements.careerResult.className = 'career-result empty';
      elements.careerResult.textContent = '暂无查询结果';
    }
  }
}

function mergeEndgameCareer(career, payload) {
  const endgame = payload.endgame || payload;
  const loading =
    career.endgameLoading && typeof career.endgameLoading === 'object'
      ? { ...career.endgameLoading }
      : { raid: false, dungeon: false };
  for (const mode of Object.keys(endgame)) {
    if (mode === 'raid' || mode === 'dungeon') loading[mode] = false;
  }

  const merged = {
    ...career,
    endgameLoading: loading.raid || loading.dungeon ? loading : false,
    endgame: {
      ...(career.endgame || {}),
      ...endgame
    },
    stats: {
      ...(career.stats || {})
    },
    cache: {
      ...(career.cache || {}),
      ...(payload.cache || {})
    }
  };
  if (payload.statsPatch?.raid) merged.stats.raid = payload.statsPatch.raid;
  if (payload.statsPatch?.dungeon) merged.stats.dungeon = payload.statsPatch.dungeon;
  return merged;
}

function renderCareer(career) {
  elements.careerSubtitle.textContent = `更新 ${formatTime(career.updatedAt)}`;
  const stats = career.stats || {};
  const pve = stats.pve || {};
  const pvp = stats.pvp || {};
  const overall = stats.overall || {};
  const endgame = career.endgame || {};
  const raid = endgame.raid || stats.raid || {};
  const dungeon = endgame.dungeon || stats.dungeon || {};
  const raidTotal = raid.total || raid;
  const dungeonTotal = dungeon.total || dungeon;
  const raidLoading = isEndgameModeLoading(career, 'raid');
  const dungeonLoading = isEndgameModeLoading(career, 'dungeon');

  elements.careerResult.className = 'career-result';
  elements.careerResult.innerHTML = `
    <div class="account-head">
      <h3>${escapeHtml(career.account.displayName)}</h3>
      <p>${escapeHtml(career.account.membershipTypeName)} · ${escapeHtml(career.account.membershipId)}</p>
    </div>

    <div class="stat-grid">
      ${statTile('守护者等级', career.profile.guardianRank || '-')}
      ${statTile('最高光等', career.profile.maxLight || '-')}
      ${statTile('总时长', formatMinutes(career.profile.totalMinutesPlayed))}
      ${statTile('角色数', career.profile.characterCount || 0)}
      ${statTile('Raid 完成', statDisplay(raidTotal.clears))}
      ${statTile('地牢完成', statDisplay(dungeonTotal.clears))}
      ${statTile('PvP 胜场', statDisplay(pvp.activitiesWon))}
    </div>

    <div class="section-title">角色</div>
    <div class="character-list">
      ${(career.characters || []).map(renderCharacter).join('') || '<div class="career-result empty">没有角色数据</div>'}
    </div>

    <div class="section-title">Raid / 地牢生涯</div>
    <div class="mode-grid">
      ${renderEndgameMode('Raid', raid, raidLoading)}
      ${renderEndgameMode('地牢', dungeon, dungeonLoading)}
    </div>

    <div class="section-title">常用统计</div>
    <div class="stat-grid">
      ${statTile('PvE 击杀', statDisplay(pve.kills))}
      ${statTile('PvE 复活', statDisplay(pve.resurrectionsPerformed))}
      ${statTile('PvP 击杀', statDisplay(pvp.kills))}
      ${statTile('PvP 效率', statDisplay(pvp.efficiency))}
    </div>
  `;
}

function isEndgameModeLoading(career, mode) {
  if (!career.endgameLoading) return false;
  if (career.endgameLoading === true) return !career.endgame?.[mode];
  return Boolean(career.endgameLoading[mode]);
}

function renderEndgameMode(label, mode, loading = false) {
  const total = mode.total || mode || {};
  const activities = Array.isArray(mode.activities) ? mode.activities : [];
  return `
    <div class="mode-card">
      <h4>${escapeHtml(label)}</h4>
      <div class="mode-stats">
        <span>完成 <b>${escapeHtml(statDisplay(total.clears))}</b></span>
        <span>进入 <b>${escapeHtml(statDisplay(total.activitiesEntered || total.attempts))}</b></span>
        <span>完成率 <b>${escapeHtml(statDisplay(total.completionRate))}</b></span>
        <span>击杀 <b>${escapeHtml(statDisplay(total.kills))}</b></span>
        <span>KD <b>${escapeHtml(statDisplay(total.kd))}</b></span>
      </div>
      <div class="activity-list">
        ${
          activities.length
            ? activities.map(renderEndgameActivity).join('')
            : `<div class="activity-empty">${loading ? '完整历史加载中' : '没有公开历史记录'}</div>`
        }
      </div>
    </div>
  `;
}

function renderEndgameActivity(activity) {
  const variants = Array.isArray(activity.variants) ? activity.variants : [];
  const tags = renderEndgameTags(activity);
  return `
    <div class="activity-row">
      <img src="${escapeAttribute(activity.image || '/brand.svg')}" alt="" />
      <div class="activity-main">
        <b>${escapeHtml(activity.name || '未知活动')}</b>
        <span>${escapeHtml(activity.variantCount > 1 ? `${activity.variantCount} 个变体` : '单一变体')}</span>
        ${tags}
      </div>
      <div class="activity-numbers">
        <span>完成 <b>${escapeHtml(statDisplay(activity.clears))}</b> / 进入 ${escapeHtml(statDisplay(activity.attempts))}</span>
        <span>${escapeHtml(statDisplay(activity.completionRate))} · KD ${escapeHtml(statDisplay(activity.kd))}</span>
        <span>${escapeHtml(statDisplay(activity.kills))} 击杀 · ${escapeHtml(statDisplay(activity.hours))} 小时</span>
      </div>
      ${variants.length > 1 ? renderEndgameVariants(variants) : ''}
    </div>
  `;
}

function renderEndgameTags(activity) {
  const tags = [];
  const solo = Number(activity.soloClears?.value || 0);
  const soloFlawless = Number(activity.soloFlawlessClears?.value || 0);
  if (solo > 0) tags.push(`Solo x${solo}`);
  if (soloFlawless > 0) tags.push(`Solo 无暇 x${soloFlawless}`);
  if (!tags.length) return '';
  return `<div class="activity-tags">${tags.map((tag) => `<em>${escapeHtml(tag)}</em>`).join('')}</div>`;
}

function renderEndgameVariants(variants) {
  return `
    <div class="variant-list">
      ${variants.map(renderEndgameVariant).join('')}
    </div>
  `;
}

function renderEndgameVariant(variant) {
  return `
    <div class="variant-row">
      <span>${escapeHtml(variant.name || '未知变体')}</span>
      <b>完成 ${escapeHtml(statDisplay(variant.clears))} / 进入 ${escapeHtml(statDisplay(variant.attempts))}</b>
      ${renderEndgameTags(variant)}
    </div>
  `;
}

function renderCharacter(character) {
  const image = character.emblemPath || '/brand.svg';
  return `
    <div class="character">
      <img src="${escapeAttribute(image)}" alt="" />
      <div>
        <b>${escapeHtml(character.className)}</b>
        <span>${escapeHtml([character.raceName, character.genderName].filter(Boolean).join(' · '))}</span>
      </div>
      <div class="power">${escapeHtml(character.light || '-')}</div>
    </div>
  `;
}

function statTile(label, value) {
  return `
    <div class="stat-tile">
      <span>${escapeHtml(label)}</span>
      <b>${escapeHtml(value)}</b>
    </div>
  `;
}

function statDisplay(stat) {
  if (!stat) return '-';
  return stat.displayValue ?? formatNumber(stat.value);
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `HTTP ${response.status}`);
  }
  return payload;
}

function setNotice(element, message, isError = false) {
  element.textContent = message;
  element.className = `notice${isError ? ' error' : ''}`;
}

function clearNotice(element) {
  element.textContent = '';
  element.className = 'notice hidden';
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => elements.toast.classList.remove('show'), 2200);
}

function formatTime(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date(value));
}

function relativeTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '';
  const diff = Math.round((Date.now() - date.valueOf()) / 1000);
  if (diff < 60) return `${Math.max(diff, 0)} 秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return `${Math.floor(diff / 86400)} 天前`;
}

function formatMinutes(minutes) {
  const value = Number(minutes || 0);
  if (!value) return '-';
  const hours = Math.round(value / 60);
  return `${formatNumber(hours)} 小时`;
}

function formatNumber(value) {
  if (value == null || value === '') return '-';
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(number);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}
