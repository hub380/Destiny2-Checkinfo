const state = {
  queryId: null
};

const elements = {
  gearForm: document.querySelector('#gearForm'),
  gearInput: document.querySelector('#gearInput'),
  gearNotice: document.querySelector('#gearNotice'),
  gearResult: document.querySelector('#gearResult'),
  gearSubtitle: document.querySelector('#gearSubtitle')
};

initGearPage();

function initGearPage() {
  bindGearEvents();
  const params = new URLSearchParams(window.location.search);
  const query = params.get('q');
  if (query) {
    elements.gearInput.value = query;
    queryGear(query);
  }
}

function bindGearEvents() {
  elements.gearForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    await queryGear(elements.gearInput.value);
  });

  elements.gearResult.addEventListener('click', async (event) => {
    const result = event.target.closest('[data-gear-hash]');
    if (!result) return;
    const hash = result.dataset.gearHash;
    const kind = result.dataset.gearKind;
    const name = result.dataset.gearName || '';
    if (kind === 'perk') {
      await queryPerkWeapons({ hash, query: name });
      return;
    }
    await queryGearItem(hash);
  });
}

async function queryGear(rawQuery) {
  const query = rawQuery.trim();
  if (!query) {
    setNotice(elements.gearNotice, '请输入武器、护甲或 Perk 名称。', true);
    return;
  }

  const queryId = `${Date.now()}-${Math.random()}`;
  state.queryId = queryId;
  clearNotice(elements.gearNotice);
  elements.gearSubtitle.textContent = '装备索引查询中';
  elements.gearResult.className = 'gear-result empty';
  elements.gearResult.textContent = '首次加载索引可能需要几秒';

  try {
    const payload = await fetchJson('/api/gear/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, kind: 'all', limit: 80 })
    });
    if (state.queryId !== queryId) return;
    renderGearSearch(payload);
  } catch (error) {
    if (state.queryId !== queryId) return;
    setNotice(elements.gearNotice, error.message, true);
    elements.gearSubtitle.textContent = '装备搜索';
    elements.gearResult.className = 'gear-result empty';
    elements.gearResult.textContent = '暂无查询结果';
  }
}

async function queryGearItem(hash) {
  const detailSlot = detailContainer();
  if (!detailSlot) return;
  detailSlot.innerHTML = `<div class="detail-loading">加载装备详情中</div>`;

  try {
    const payload = await fetchJson('/api/gear/item', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hash })
    });
    detailSlot.innerHTML = renderGearDetail(payload.item, payload.detail);
    detailSlot.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } catch (error) {
    detailSlot.innerHTML = `<div class="notice error">${escapeHtml(error.message)}</div>`;
  }
}

async function queryPerkWeapons({ hash, query }) {
  const detailSlot = detailContainer();
  if (!detailSlot) return;
  detailSlot.innerHTML = `<div class="detail-loading">反查可出武器中</div>`;

  try {
    const body = hash ? { hash, query, limit: 80 } : { query, limit: 80 };
    const payload = await fetchJson('/api/gear/perk-weapons', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    detailSlot.innerHTML = renderPerkWeapons(payload);
    detailSlot.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } catch (error) {
    detailSlot.innerHTML = `<div class="notice error">${escapeHtml(error.message)}</div>`;
  }
}

function renderGearSearch(payload) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  elements.gearSubtitle.textContent = `统一搜索 · ${formatNumber(payload.total || 0)} 条 · ${gearCacheLabel(payload.cache?.gearIndex)}`;

  if (!items.length) {
    elements.gearResult.className = 'gear-result empty';
    elements.gearResult.textContent = '没有匹配的装备数据';
    return;
  }

  elements.gearResult.className = 'gear-result';
  elements.gearResult.innerHTML = `
    <div class="gear-summary">
      <b>${escapeHtml(payload.query)}</b>
      <span>Manifest ${escapeHtml(payload.manifestVersion || '-')}</span>
      <span>显示 ${escapeHtml(formatNumber(items.length))} / ${escapeHtml(formatNumber(payload.total || 0))}</span>
    </div>
    <div class="gear-detail-slot" id="gearDetailSlot"></div>
    <div class="gear-grid">
      ${items.map(renderGearResultCard).join('')}
    </div>
  `;
}

function renderGearResultCard(item) {
  const meta = gearMeta(item);
  const tags = meta.map((value) => `<span class="gear-tag">${escapeHtml(value)}</span>`).join('');
  const action = item.kind === 'perk' ? '反查武器' : '查看详情';
  return `
    <button class="gear-card gear-card-button" type="button" data-gear-hash="${escapeAttribute(item.hash || '')}" data-gear-kind="${escapeAttribute(item.kind || '')}" data-gear-name="${escapeAttribute(item.name || '')}">
      <img class="gear-icon" src="${escapeAttribute(item.icon || '/brand.svg')}" alt="" />
      <div class="gear-main">
        <div class="gear-title">
          <h3>${escapeHtml(item.name || '未知装备')}</h3>
          <span>${escapeHtml(gearKindLabel(item.kind))}</span>
        </div>
        ${tags ? `<div class="gear-tags">${tags}</div>` : ''}
        ${item.description ? `<p class="gear-description">${escapeHtml(item.description)}</p>` : ''}
        <div class="gear-card-foot">
          <span>#${escapeHtml(item.hash || '-')}</span>
          <b>${escapeHtml(action)}</b>
        </div>
      </div>
    </button>
  `;
}

function renderGearDetail(item, detail) {
  if (!item || !detail) {
    return `<div class="detail-loading">没有可展示的详情</div>`;
  }
  if (item.kind === 'weapon') return renderWeaponDetail(item, detail);
  if (item.kind === 'armor') return renderArmorDetail(item, detail);
  return `<div class="detail-loading">点击 Perk 可反查支持该 Perk 的武器</div>`;
}

function renderWeaponDetail(item, detail) {
  return `
    <section class="gear-detail-panel">
      <div class="gear-detail-head">
        <img class="gear-icon large" src="${escapeAttribute(item.icon || detail.icon || '/brand.svg')}" alt="" />
        <div>
          <h3>${escapeHtml(item.name || detail.name || '未知武器')}</h3>
          <div class="gear-tags">
            ${[detail.weaponType, detail.ammo, detail.element, detail.adept ? '专家' : ''].filter(Boolean).map((value) => `<span class="gear-tag">${escapeHtml(value)}</span>`).join('')}
          </div>
          ${item.description ? `<p class="gear-description">${escapeHtml(item.description)}</p>` : ''}
        </div>
      </div>
      ${renderStats(detail.stats || [])}
      ${renderPerkColumns(detail.sockets || [])}
    </section>
  `;
}

function renderArmorDetail(item, detail) {
  const setBonus = detail.setBonus;
  const intrinsicPerks = Array.isArray(detail.intrinsicPerks) ? detail.intrinsicPerks : [];
  return `
    <section class="gear-detail-panel">
      <div class="gear-detail-head">
        <img class="gear-icon large" src="${escapeAttribute(item.icon || detail.icon || '/brand.svg')}" alt="" />
        <div>
          <h3>${escapeHtml(item.name || detail.name || '未知护甲')}</h3>
          <div class="gear-tags">
            ${[detail.slot, detail.className, detail.tier, detail.type].filter(Boolean).map((value) => `<span class="gear-tag">${escapeHtml(value)}</span>`).join('')}
          </div>
          ${item.description ? `<p class="gear-description">${escapeHtml(item.description)}</p>` : ''}
        </div>
      </div>
      ${setBonus ? renderArmorSetBonus(setBonus) : '<div class="detail-loading">这件护甲没有公开的两件/四件套装效果</div>'}
      ${
        intrinsicPerks.length
          ? `<div class="perk-columns armor-intrinsics"><div class="perk-column"><h4>护甲特性</h4>${intrinsicPerks.map(renderPerkCard).join('')}</div></div>`
          : ''
      }
    </section>
  `;
}

function renderArmorSetBonus(setBonus) {
  return `
    <div class="armor-set">
      <div class="section-title">套装效果 · ${escapeHtml(setBonus.name || '-')}</div>
      <div class="set-bonus-grid">
        ${(setBonus.perks || []).map((perk) => `
          <div class="set-bonus-card">
            <span>${escapeHtml(perk.requiredSetCount)} 件套</span>
            <b>${escapeHtml(perk.name || '-')}</b>
            ${perk.description ? `<p>${escapeHtml(perk.description)}</p>` : ''}
          </div>
        `).join('') || '<div class="detail-loading">没有套装效果说明</div>'}
      </div>
    </div>
  `;
}

function renderPerkWeapons(payload) {
  const weapons = Array.isArray(payload.weapons) ? payload.weapons : [];
  const perks = Array.isArray(payload.perks) ? payload.perks : [];
  return `
    <section class="gear-detail-panel">
      <div class="gear-summary">
        <b>Perk 反查：${escapeHtml(payload.query)}</b>
        <span>命中 Perk ${escapeHtml(formatNumber(perks.length))} 个</span>
        <span>武器 ${escapeHtml(formatNumber(payload.total || 0))} 组</span>
      </div>
      ${perks.length ? `<div class="perk-strip">${perks.slice(0, 12).map(renderPerkChip).join('')}</div>` : ''}
      ${
        weapons.length
          ? `<div class="weapon-group-list">${weapons.map(renderWeaponGroup).join('')}</div>`
          : '<div class="detail-loading">没有找到可出该 Perk 的武器</div>'
      }
    </section>
  `;
}

function renderWeaponGroup(group) {
  const variants = Array.isArray(group.variants) ? group.variants : [];
  const primary = variants[0] || {};
  const sockets = Array.isArray(primary.sockets) ? primary.sockets : [];
  const frameSocket = sockets.find(isFrameSocket);
  const perkSockets = sockets.filter((socket) => socket !== frameSocket);
  const icon = primary.icon || '/brand.svg';
  const canRoll = [
    group.canRoll?.normal ? '普通可出' : '',
    group.canRoll?.enhanced ? '强化可出' : ''
  ].filter(Boolean);
  const meta = [group.weaponType, group.ammo, group.element, `${variants.length} 个变体`].filter(Boolean);

  return `
    <article class="weapon-group expanded">
      <img class="gear-icon" src="${escapeAttribute(icon)}" alt="" />
      <div class="gear-main">
        <div class="gear-title">
          <h3>${escapeHtml(group.name || '未知武器')}</h3>
          <span>${escapeHtml(canRoll.join(' / ') || '可出')}</span>
        </div>
        <div class="gear-tags">
          ${meta.map((value) => `<span class="gear-tag">${escapeHtml(value)}</span>`).join('')}
          ${renderInlineFrameSocket(frameSocket)}
        </div>
        <div class="variant-pills">
          ${variants.slice(0, 10).map(renderWeaponVariant).join('')}
          ${variants.length > 10 ? `<span>+${escapeHtml(variants.length - 10)}</span>` : ''}
        </div>
        ${renderPerkColumns(perkSockets)}
      </div>
    </article>
  `;
}

function isFrameSocket(socket) {
  const label = String(socket?.label || '');
  return label.includes('框架') || label.includes('固有');
}

function renderInlineFrameSocket(socket) {
  const perk = socket?.perks?.[0];
  if (!perk) return '';
  const title = [socket.label, perk.name, perk.description].filter(Boolean).join(' · ');
  return `
    <span class="gear-tag frame-inline" title="${escapeAttribute(title)}">
      <img src="${escapeAttribute(perk.icon || '/brand.svg')}" alt="" />
      <span>${escapeHtml(socket.label || '框架 / 固有')}</span>
      <b>${escapeHtml(perk.name || '-')}</b>
    </span>
  `;
}

function renderStats(stats) {
  if (!stats.length) return '';
  return `
    <div class="weapon-stat-list">
      ${stats.map((stat) => {
        const max = Number(stat.displayMaximum || 100) || 100;
        const width = Math.max(3, Math.min(100, (Number(stat.value || 0) / max) * 100));
        return `
          <div class="weapon-stat">
            <span>${escapeHtml(stat.name)}</span>
            <b>${escapeHtml(stat.value)}</b>
            <i style="width:${width}%"></i>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderPerkColumns(sockets) {
  if (!sockets.length) return '<div class="detail-loading">没有可展示的 Perk 池</div>';
  return `
    <div class="perk-columns">
      ${sockets.map((socket) => `
        <div class="perk-column">
          <h4>${escapeHtml(socket.label || `第 ${Number(socket.socketIndex || 0) + 1} 列`)}</h4>
          ${(socket.perks || []).map(renderPerkCard).join('')}
        </div>
      `).join('')}
    </div>
  `;
}

function renderPerkCard(perk) {
  return `
    <div class="perk-card ${perk.matched ? 'matched' : ''}">
      <img src="${escapeAttribute(perk.icon || '/brand.svg')}" alt="" />
      <div>
        <b>${escapeHtml(perk.name || '-')}</b>
        <span>${escapeHtml(perkTypeLabel(perk))}</span>
        ${perk.description ? `<p>${escapeHtml(perk.description)}</p>` : ''}
        ${renderEnhancedNotes(perk)}
      </div>
    </div>
  `;
}

function perkTypeLabel(perk) {
  if (Array.isArray(perk.enhancedOptions) && perk.enhancedOptions.length) {
    return `${perk.type || '普通'} / 可强化`;
  }
  return perk.enhanced ? '强化' : perk.type || '普通';
}

function renderEnhancedNotes(perk) {
  const options = Array.isArray(perk.enhancedOptions) ? perk.enhancedOptions : [];
  if (!options.length) return '';
  const notes = options.map(renderEnhancedNote).filter(Boolean);
  if (!notes.length) return '';
  return `
    <div class="perk-enhanced-notes">
      ${notes.join('')}
    </div>
  `;
}

function renderEnhancedNote(option) {
  const statText = formatEnhancedStatDiff(option.statDiff || []);
  const description = option.descriptionDiff || '';
  const lines = [];
  if (statText) lines.push(`强化后：${statText}`);
  if (!statText && description) lines.push(`强化后：${description}`);
  if (statText && description) lines.push(`强化说明：${description}`);
  if (!lines.length) return '';
  return lines.map((line) => `<em>${escapeHtml(line)}</em>`).join('');
}

function formatEnhancedStatDiff(stats) {
  return stats
    .map((stat) => {
      const enhanced = signedNumber(stat.enhanced);
      const delta = signedNumber(stat.delta);
      const condition = stat.conditionallyActive ? '，条件触发' : '';
      if (Number(stat.normal || 0) === 0) return `${stat.name} ${enhanced}${condition}`;
      return `${stat.name} ${enhanced}（${delta}）${condition}`;
    })
    .join('、');
}

function signedNumber(value) {
  const number = Number(value || 0);
  return number > 0 ? `+${number}` : String(number);
}

function renderPerkChip(perk) {
  return `
    <span class="perk-chip">
      <img src="${escapeAttribute(perk.icon || '/brand.svg')}" alt="" />
      <b>${escapeHtml(perk.name || '未知 Perk')}</b>
      <em>${escapeHtml(perk.enhanced ? '强化' : '普通')}</em>
    </span>
  `;
}

function renderWeaponVariant(variant) {
  return `<span title="#${escapeAttribute(variant.hash || '')}">${escapeHtml(variant.name || '未知变体')}${variant.adept ? ' · 专家' : ''}</span>`;
}

function detailContainer() {
  return document.querySelector('#gearDetailSlot');
}

function gearMeta(item) {
  if (item.kind === 'weapon') {
    return [item.type, item.ammo, item.element, item.tier, item.adept ? '专家' : ''].filter(Boolean);
  }
  if (item.kind === 'armor') {
    return [item.slot, item.className, item.tier, item.type].filter(Boolean);
  }
  if (item.kind === 'perk') {
    return [item.enhanced ? '强化 Perk' : '普通 Perk', item.type, '点击反查武器'].filter(Boolean);
  }
  return [item.type].filter(Boolean);
}

function gearKindLabel(kind) {
  const labels = {
    weapon: '武器',
    armor: '护甲',
    perk: 'Perk',
    all: '全部'
  };
  return labels[kind] || '装备';
}

function gearCacheLabel(status) {
  if (!status) return '索引缓存';
  if (String(status).includes('hit')) return '索引缓存命中';
  if (String(status).includes('miss')) return '索引已读取';
  return '索引已读取';
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
