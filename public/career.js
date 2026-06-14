const state = {
  queryId: null,
  career: null
};

const elements = {
  form: document.querySelector('#careerPageForm'),
  input: document.querySelector('#careerPageInput'),
  notice: document.querySelector('#careerPageNotice'),
  result: document.querySelector('#careerPageResult'),
  subtitle: document.querySelector('#careerPageSubtitle')
};

initCareerPage();

function initCareerPage() {
  elements.form.addEventListener('submit', async (event) => {
    event.preventDefault();
    await queryCareer(elements.input.value);
  });

  const params = new URLSearchParams(window.location.search);
  const query = params.get('q');
  if (query) {
    elements.input.value = query;
    queryCareer(query);
  }
}

async function queryCareer(rawName) {
  const bungieName = rawName.trim();
  if (!bungieName) {
    setNotice('请输入棒鸡名称，格式为 名称#数字代码', true);
    return;
  }

  const queryId = `${Date.now()}-${Math.random()}`;
  state.queryId = queryId;
  state.career = null;
  clearNotice();
  elements.subtitle.textContent = '查询基础资料中';
  elements.result.innerHTML = '<div class="career-result empty">查询基础资料中</div>';

  try {
    const summary = await fetchJson('/api/destiny/summary', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bungieName })
    });
    if (state.queryId !== queryId) return;

    state.career = {
      ...summary,
      detailLoading: true,
      endgameLoading: { raid: true, dungeon: true, pvp: true }
    };
    renderCareerPage();

    const baseRequest = {
      membershipType: summary.account.membershipType,
      membershipId: summary.account.membershipId,
      characters: summary.characters
    };

    await Promise.allSettled([
      loadDetails(queryId, baseRequest),
      loadEndgame(queryId, baseRequest, 'raid'),
      loadEndgame(queryId, baseRequest, 'dungeon'),
      loadEndgame(queryId, baseRequest, 'pvp')
    ]);
    if (state.queryId !== queryId) return;
    clearNotice();
  } catch (error) {
    if (state.queryId !== queryId) return;
    setNotice(error.message, true);
    elements.subtitle.textContent = '公开玩家查询';
    elements.result.innerHTML = '<div class="career-result empty">暂无查询结果</div>';
  }
}

async function loadDetails(queryId, baseRequest) {
  try {
    const details = await fetchJson('/api/destiny/details', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(baseRequest)
    });
    if (state.queryId !== queryId || !state.career) return;
    state.career = {
      ...state.career,
      detailLoading: false,
      details: details.details,
      cache: {
        ...(state.career.cache || {}),
        ...(details.cache || {})
      }
    };
    renderCareerPage();
  } catch (error) {
    if (state.queryId !== queryId || !state.career) return;
    state.career = {
      ...state.career,
      detailLoading: false,
      detailError: error.message
    };
    renderCareerPage();
  }
}

async function loadEndgame(queryId, baseRequest, mode) {
  try {
    const payload = await fetchJson('/api/destiny/endgame', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...baseRequest, mode })
    });
    if (state.queryId !== queryId || !state.career) return;
    state.career = mergeEndgameCareer(state.career, payload);
    renderCareerPage();
  } catch (error) {
    if (state.queryId !== queryId || !state.career) return;
    state.career = {
      ...state.career,
      endgameLoading: {
        ...(state.career.endgameLoading || {}),
        [mode]: false
      },
      endgameErrors: {
        ...(state.career.endgameErrors || {}),
        [mode]: error.message
      }
    };
    renderCareerPage();
  }
}

function mergeEndgameCareer(career, payload) {
  const endgame = payload.endgame || payload;
  const loading =
    career.endgameLoading && typeof career.endgameLoading === 'object'
      ? { ...career.endgameLoading }
      : { raid: false, dungeon: false, pvp: false };
  for (const mode of Object.keys(endgame)) {
    if (mode === 'raid' || mode === 'dungeon' || mode === 'pvp') loading[mode] = false;
  }
  const merged = {
    ...career,
    endgameLoading: loading.raid || loading.dungeon || loading.pvp ? loading : false,
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

function renderCareerPage() {
  const career = state.career;
  if (!career) return;
  elements.subtitle.textContent = `更新 ${formatTime(career.updatedAt)}`;
  const stats = career.stats || {};
  const profile = career.profile || {};
  const details = career.details || {};
  const records = details.records || {};
  const crafting = details.crafting || {};
  const pvp = stats.pvp || {};
  const pvpHistory = career.endgame?.pvp || {};
  const pvpTotal = pvpHistory.total || pvp;
  const raid = career.endgame?.raid || stats.raid || {};
  const dungeon = career.endgame?.dungeon || stats.dungeon || {};
  const raidTotal = raid.total || raid;
  const dungeonTotal = dungeon.total || dungeon;

  elements.result.innerHTML = `
    <section class="career-profile-panel">
      <div class="career-account-head">
        <div>
          <h2>${escapeHtml(career.account.displayName)}</h2>
          <p>${escapeHtml(career.account.membershipTypeName)} · ${escapeHtml(career.account.membershipId)}</p>
        </div>
        <div class="career-account-meta">
          <span>${escapeHtml(career.queriedName || '')}</span>
          <span>${escapeHtml(profile.dateLastPlayed ? `最后在线 ${dateTime(profile.dateLastPlayed)}` : '公开资料')}</span>
        </div>
      </div>

      <div class="career-metric-grid">
        ${metricCard('守护者等级', profile.guardianRank || '-', '当前等级')}
        ${metricCard('最高光等', profile.maxLight || '-', '角色最高光')}
        ${metricCard('总时长', formatMinutes(profile.totalMinutesPlayed), '全部角色')}
        ${metricCard('成就点数', statDisplay(records.activeScore), records.lifetimeScore ? `生涯 ${statDisplay(records.lifetimeScore)}` : loadingText(career.detailLoading))}
        ${metricCard('Raid 完成', statDisplay(raidTotal.clears), `${statDisplay(raidTotal.completionRate)} 完成率`)}
        ${metricCard('地牢完成', statDisplay(dungeonTotal.clears), `${statDisplay(dungeonTotal.completionRate)} 完成率`)}
        ${metricCard('PvP 胜场', statDisplay(pvpTotal.activitiesWon), `${winRate(pvpTotal)} 胜率`)}
        ${metricCard('锻造解锁', crafting.unlocked ? `${statDisplay(crafting.unlocked)} / ${statDisplay(crafting.total)}` : '-', statDisplay(crafting.completionRate) || loadingText(career.detailLoading))}
      </div>
    </section>

    <section class="career-section-grid">
      ${renderCharacters(career.characters || [])}
      ${renderRecordPanel(records, career.detailLoading, career.detailError)}
      ${renderPvpPanel(pvp, pvpHistory, isEndgameModeLoading(career, 'pvp'), career.endgameErrors?.pvp)}
    </section>

    <section class="career-section-wide">
      ${renderEndgamePanel('Raid', raid, isEndgameModeLoading(career, 'raid'), career.endgameErrors?.raid)}
      ${renderEndgamePanel('地牢', dungeon, isEndgameModeLoading(career, 'dungeon'), career.endgameErrors?.dungeon)}
    </section>

    ${renderCraftingBoardPanel(crafting, career.detailLoading, career.detailError)}
  `;
}

function renderCharacters(characters) {
  return `
    <article class="career-info-card">
      <div class="career-card-head">
        <h3>角色</h3>
        <span>${escapeHtml(characters.length)} 个</span>
      </div>
      <div class="career-character-grid">
        ${characters.map((character) => `
          <div class="career-character">
            <img src="${escapeAttribute(character.emblemPath || '/brand.svg')}" alt="" />
            <div>
              <b>${escapeHtml(character.className || '-')}</b>
              <span>${escapeHtml([character.raceName, character.genderName].filter(Boolean).join(' · '))}</span>
              <em>${escapeHtml(formatMinutes(character.minutesPlayedTotal))}</em>
            </div>
            <strong>${escapeHtml(character.light || '-')}</strong>
          </div>
        `).join('') || '<div class="detail-loading">没有角色数据</div>'}
      </div>
    </article>
  `;
}

function renderRecordPanel(records, loading, error) {
  return `
    <article class="career-info-card">
      <div class="career-card-head">
        <h3>成就点数</h3>
        <span>${escapeHtml(privacyText(records.privacy))}</span>
      </div>
      ${error ? `<div class="notice error">${escapeHtml(error)}</div>` : ''}
      ${loading ? '<div class="detail-loading">成就数据加载中</div>' : `
        <div class="career-mini-grid">
          ${miniStat('当前分数', statDisplay(records.activeScore))}
          ${miniStat('生涯分数', statDisplay(records.lifetimeScore))}
          ${miniStat('传承分数', statDisplay(records.legacyScore))}
          ${miniStat('完成记录', `${statDisplay(records.completedRecords)} / ${statDisplay(records.recordCount)}`)}
        </div>
      `}
    </article>
  `;
}

function renderPvpPanel(pvp, history, loading, error) {
  const total = history.total || pvp || {};
  const subModes = Array.isArray(history.subModes) ? history.subModes : [];
  return `
    <article class="career-info-card pvp-history-card">
      <div class="career-card-head">
        <h3>PvP 数据</h3>
        <span>${loading ? '完整历史加载中' : `${escapeHtml(statDisplay(total.activitiesEntered))} 场`}</span>
      </div>
      <div class="career-mini-grid">
        ${miniStat('场次', statDisplay(total.activitiesEntered))}
        ${miniStat('胜场', statDisplay(total.activitiesWon))}
        ${miniStat('胜率', winRate(total))}
        ${miniStat('击败', statDisplay(total.opponentsDefeated || total.kills))}
        ${miniStat('KD', statDisplay(total.kd))}
        ${miniStat('KDA', statDisplay(total.kda))}
        ${miniStat('效率', statDisplay(total.efficiency))}
        ${miniStat('时长', total.hours ? `${statDisplay(total.hours)} 小时` : statDisplay(total.secondsPlayed))}
      </div>
      ${error ? `<div class="notice error">${escapeHtml(error)}</div>` : ''}
      <div class="pvp-mode-list">
        ${
          subModes.length
            ? subModes.map(renderPvpModeRow).join('')
            : `<div class="detail-loading">${loading ? 'PvP 完整历史加载中' : '没有公开 PvP 活动历史'}</div>`
        }
      </div>
    </article>
  `;
}

function renderPvpModeRow(mode) {
  return `
    <div class="pvp-mode-row">
      <div>
        <b>${escapeHtml(mode.label || `PvP 模式 ${mode.modeId || '-'}`)}</b>
        <span>${escapeHtml(mode.lastPlayed ? `最近 ${dateOnly(mode.lastPlayed)}` : '暂无最近记录')}</span>
      </div>
      <div class="pvp-mode-stats">
        ${miniStat('场次', statDisplay(mode.activitiesEntered))}
        ${miniStat('胜率', statDisplay(mode.winRate))}
        ${miniStat('KD', statDisplay(mode.kd))}
        ${miniStat('击败', statDisplay(mode.opponentsDefeated || mode.kills))}
      </div>
    </div>
  `;
}

function renderEndgamePanel(label, mode, loading, error) {
  const total = mode.total || mode || {};
  const activities = Array.isArray(mode.activities) ? mode.activities : [];
  return `
    <article class="career-endgame-card">
      <div class="career-card-head">
        <h3>${escapeHtml(label)}</h3>
        <span>${loading ? '完整历史加载中' : `${escapeHtml(statDisplay(total.clears))} 完成`}</span>
      </div>
      <div class="career-mini-grid endgame-summary">
        ${miniStat('完成', statDisplay(total.clears))}
        ${miniStat('进入', statDisplay(total.activitiesEntered || total.attempts))}
        ${miniStat('完成率', statDisplay(total.completionRate))}
        ${miniStat('击杀', statDisplay(total.kills))}
        ${miniStat('死亡', statDisplay(total.deaths))}
        ${miniStat('KD', statDisplay(total.kd))}
        ${miniStat('时长', statDisplay(total.hours) ? `${statDisplay(total.hours)} 小时` : '-')}
        ${miniStat('Solo 无暇', statDisplay(total.soloFlawlessClears))}
      </div>
      ${error ? `<div class="notice error">${escapeHtml(error)}</div>` : ''}
      <div class="career-activity-grid">
        ${
          activities.length
            ? activities.map(renderDetailedActivity).join('')
            : `<div class="detail-loading">${loading ? '活动历史加载中' : '没有公开活动历史'}</div>`
        }
      </div>
    </article>
  `;
}

function renderDetailedActivity(activity) {
  const variants = Array.isArray(activity.variants) ? activity.variants : [];
  return `
    <div class="career-activity-card">
      <img src="${escapeAttribute(activity.image || '/brand.svg')}" alt="" />
      <div class="activity-detail-main">
        <div>
          <b>${escapeHtml(activity.name || '未知活动')}</b>
          <span>${escapeHtml(activity.variantCount > 1 ? `${activity.variantCount} 个变体` : '单一变体')}</span>
        </div>
        ${renderEndgameTags(activity)}
      </div>
      <div class="career-activity-stats">
        ${miniStat('完成/进入', `${statDisplay(activity.clears)} / ${statDisplay(activity.attempts)}`)}
        ${miniStat('完成率', statDisplay(activity.completionRate))}
        ${miniStat('KD', statDisplay(activity.kd))}
        ${miniStat('击杀', statDisplay(activity.kills))}
        ${miniStat('最佳', statDisplay(activity.bestTime))}
        ${miniStat('最近', activity.lastPlayed ? dateOnly(activity.lastPlayed) : '-')}
      </div>
      ${variants.length > 1 ? `<div class="career-variant-list">${variants.slice(0, 8).map(renderVariant).join('')}</div>` : ''}
    </div>
  `;
}

function renderVariant(variant) {
  return `
    <div class="career-variant-row">
      <span>${escapeHtml(variant.name || '未知变体')}</span>
      <b>${escapeHtml(statDisplay(variant.clears))} 完成</b>
    </div>
  `;
}

function renderCraftingBoardPanel(crafting, loading, error) {
  const items = Array.isArray(crafting.items) ? crafting.items : [];
  const groups = buildCraftingGroups(items);
  return `
    <section class="career-crafting-panel">
      <div class="career-card-head">
        <h3>锻造进度</h3>
        <span>${escapeHtml(privacyText(crafting.privacy))}</span>
      </div>
      ${error ? `<div class="notice error">${escapeHtml(error)}</div>` : ''}
      ${loading ? '<div class="detail-loading">锻造数据加载中</div>' : `
        <div class="career-mini-grid crafting-summary">
          ${miniStat('配方解锁', `${statDisplay(crafting.unlocked)} / ${statDisplay(crafting.total)}`)}
          ${miniStat('配方完成率', statDisplay(crafting.completionRate))}
          ${miniStat('Perk 解锁', `${statDisplay(crafting.plugUnlocked)} / ${statDisplay(crafting.plugTotal)}`)}
          ${miniStat('Perk 完成率', statDisplay(crafting.plugCompletionRate))}
        </div>
        <div class="crafting-collection-board">
          ${groups.map(renderCraftingSourceGroup).join('') || '<div class="detail-loading">没有公开锻造数据</div>'}
        </div>
      `}
    </section>
  `;
}

function buildCraftingGroups(items) {
  const groups = new Map();
  for (const item of items) {
    const source = craftingSourceLabel(item.source);
    const key = `${item.sourceHash || source}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        source,
        items: [],
        complete: 0
      });
    }
    const group = groups.get(key);
    group.items.push(item);
    if (isCraftingPatternComplete(item)) group.complete += 1;
  }
  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      total: group.items.length,
      items: group.items.sort((a, b) => {
        const aComplete = Number(isCraftingPatternComplete(a));
        const bComplete = Number(isCraftingPatternComplete(b));
        return aComplete - bComplete || String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN');
      })
    }))
    .sort((a, b) => {
      const aDone = a.total ? a.complete / a.total : 0;
      const bDone = b.total ? b.complete / b.total : 0;
      return aDone - bDone || a.source.localeCompare(b.source, 'zh-CN');
    });
}

function renderCraftingSourceGroup(group) {
  const complete = Number(group.complete || 0);
  const total = Number(group.total || group.items.length || 0);
  return `
    <article class="crafting-source-group ${complete >= total && total ? 'complete' : ''}">
      <div class="crafting-source-head">
        <strong>${escapeHtml(group.source)}</strong>
        <span>收集进度：${escapeHtml(formatNumber(complete))}/${escapeHtml(formatNumber(total))}</span>
      </div>
      <div class="crafting-source-items">
        ${group.items.map(renderCraftingBoardItem).join('')}
      </div>
    </article>
  `;
}

function renderCraftingBoardItem(item) {
  const percent = craftingPatternPercent(item);
  const complete = isCraftingPatternComplete(item);
  return `
    <div class="crafting-board-item ${complete ? 'complete' : 'incomplete'}">
      <div class="crafting-board-icon">
        <img src="${escapeAttribute(item.icon || '/brand.svg')}" alt="" />
      </div>
      <i class="crafting-pattern-meter" style="--pattern-fill:${Math.max(0, Math.min(100, percent))}%"></i>
      <div class="crafting-board-copy">
        <b>${escapeHtml(item.name || `装备 ${item.hash}`)}</b>
        <span>${escapeHtml(item.type || '-')}</span>
        <em>${escapeHtml(craftingPatternLabel(item))}</em>
      </div>
    </div>
  `;
}

function craftingSourceLabel(value) {
  const source = String(value || '').replace(/^来源[:：]\s*/i, '').trim();
  return source || '其他来源';
}

function craftingPatternLabel(item) {
  if (item.pattern?.label && item.pattern.label !== '-') return item.pattern.label;
  if (item.unlocked) return '1/1';
  return '-';
}

function craftingPatternPercent(item) {
  const percent = Number(item.pattern?.percent);
  if (Number.isFinite(percent)) return percent;
  return item.unlocked ? 100 : 0;
}

function isCraftingPatternComplete(item) {
  if (typeof item.pattern?.complete === 'boolean') return item.pattern.complete;
  return Boolean(item.unlocked);
}

function renderCraftingPanel(crafting, loading, error) {
  return `
    <section class="career-crafting-panel">
      <div class="career-card-head">
        <h3>锻造进度</h3>
        <span>${escapeHtml(privacyText(crafting.privacy))}</span>
      </div>
      ${error ? `<div class="notice error">${escapeHtml(error)}</div>` : ''}
      ${loading ? '<div class="detail-loading">锻造数据加载中</div>' : `
        <div class="career-mini-grid crafting-summary">
          ${miniStat('配方解锁', `${statDisplay(crafting.unlocked)} / ${statDisplay(crafting.total)}`)}
          ${miniStat('配方完成率', statDisplay(crafting.completionRate))}
          ${miniStat('Perk 解锁', `${statDisplay(crafting.plugUnlocked)} / ${statDisplay(crafting.plugTotal)}`)}
          ${miniStat('Perk 完成率', statDisplay(crafting.plugCompletionRate))}
        </div>
        <div class="crafting-grid">
          ${(crafting.items || []).map(renderCraftingItem).join('') || '<div class="detail-loading">没有公开锻造数据</div>'}
        </div>
      `}
    </section>
  `;
}

function renderCraftingItem(item) {
  const percent = Number(item.plugCompletionRate?.value || 0);
  return `
    <div class="crafting-item ${item.unlocked ? 'unlocked' : ''}">
      <img src="${escapeAttribute(item.icon || '/brand.svg')}" alt="" />
      <div>
        <b>${escapeHtml(item.name || `装备 ${item.hash}`)}</b>
        <span>${escapeHtml([item.type, item.unlocked ? '配方已解锁' : '配方未完成'].filter(Boolean).join(' · '))}</span>
        <div class="crafting-progress">
          <i style="width:${Math.max(2, Math.min(100, percent))}%"></i>
        </div>
        <em>Perk ${escapeHtml(statDisplay(item.unlockedPlugCount))} / ${escapeHtml(statDisplay(item.plugCount))}</em>
      </div>
    </div>
  `;
}

function isEndgameModeLoading(career, mode) {
  if (!career.endgameLoading) return false;
  if (career.endgameLoading === true) return !career.endgame?.[mode];
  return Boolean(career.endgameLoading[mode]);
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

function metricCard(label, value, note) {
  return `
    <div class="career-metric-card">
      <span>${escapeHtml(label)}</span>
      <b>${escapeHtml(value ?? '-')}</b>
      <em>${escapeHtml(note || '')}</em>
    </div>
  `;
}

function miniStat(label, value) {
  return `
    <div class="career-mini-stat">
      <span>${escapeHtml(label)}</span>
      <b>${escapeHtml(value ?? '-')}</b>
    </div>
  `;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `HTTP ${response.status}`);
  }
  return payload;
}

function setNotice(message, isError = false) {
  elements.notice.textContent = message;
  elements.notice.className = `notice${isError ? ' error' : ''}`;
}

function clearNotice() {
  elements.notice.textContent = '';
  elements.notice.className = 'notice hidden';
}

function statDisplay(stat) {
  if (!stat) return '-';
  return stat.displayValue ?? formatNumber(stat.value);
}

function winRate(pvp) {
  const won = Number(pvp?.activitiesWon?.value || 0);
  const entered = Number(pvp?.activitiesEntered?.value || 0);
  if (!entered) return '-';
  return `${((won / entered) * 100).toFixed(1)}%`;
}

function privacyText(value) {
  if (value === 'private') return '隐私受限';
  if (value === 'public') return '公开';
  return '公开组件';
}

function loadingText(loading) {
  return loading ? '加载中' : '-';
}

function formatTime(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date(value));
}

function dateOnly(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(value));
}

function dateTime(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function formatMinutes(minutes) {
  const value = Number(minutes || 0);
  if (!value) return '-';
  return `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(Math.round(value / 60))} 小时`;
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
