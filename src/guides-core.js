import { getGuideDetailObject, getGuideIndexObject } from './r2-store.js';

const GUIDE_TYPES = new Set(['raid', 'dungeon', 'map', 'news', 'system', 'other']);
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,80}$/;

export async function getGuidesIndex(env) {
  const object = await getGuideIndexObject(env);
  if (!object?.value) {
    return emptyGuideIndex('empty-r2');
  }
  const index = normalizeGuideIndex(object.value);
  return {
    ...index,
    cache: {
      guides: object.status,
      r2Key: object.r2Key,
      byteSize: object.byteSize,
      uploadedAt: object.uploadedAt
    }
  };
}

export async function getGuideDetail(slug, env) {
  const normalizedSlug = normalizeSlug(slug);
  const object = await getGuideDetailObject(normalizedSlug, env);
  if (!object?.value) {
    const error = new Error('没有找到这篇攻略');
    error.status = 404;
    error.code = 'GUIDE_NOT_FOUND';
    throw error;
  }
  const detail = normalizeGuideDetail(object.value, normalizedSlug);
  return {
    ...detail,
    cache: {
      guides: object.status,
      r2Key: object.r2Key,
      byteSize: object.byteSize,
      uploadedAt: object.uploadedAt
    }
  };
}

function emptyGuideIndex(status) {
  return {
    updatedAt: new Date().toISOString(),
    categories: [],
    tags: [],
    items: [],
    cache: {
      guides: status
    }
  };
}

function normalizeGuideIndex(value) {
  const rawItems = Array.isArray(value.items) ? value.items : [];
  const items = rawItems
    .map(normalizeGuideSummary)
    .filter((item) => item.slug && item.title)
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')) || a.title.localeCompare(b.title, 'zh-CN'));
  const categorySet = new Set();
  const tagSet = new Set();
  for (const item of items) {
    if (item.type) categorySet.add(item.type);
    for (const tag of item.tags || []) tagSet.add(tag);
  }
  return {
    updatedAt: value.updatedAt || new Date().toISOString(),
    categories: normalizeStringArray(value.categories || Array.from(categorySet)),
    tags: normalizeStringArray(value.tags || Array.from(tagSet)),
    items
  };
}

function normalizeGuideSummary(item) {
  const slug = safeSlug(item?.slug);
  const type = normalizeType(item?.type);
  return {
    slug,
    title: cleanText(item?.title),
    subtitle: cleanText(item?.subtitle),
    type,
    typeLabel: guideTypeLabel(type),
    activityHash: item?.activityHash ? String(item.activityHash) : '',
    activityName: cleanText(item?.activityName),
    cover: cleanText(item?.cover),
    summary: cleanText(item?.summary),
    tags: normalizeStringArray(item?.tags),
    updatedAt: cleanText(item?.updatedAt),
    difficulty: cleanText(item?.difficulty),
    estimatedMinutes: Number(item?.estimatedMinutes || 0) || 0
  };
}

function normalizeGuideDetail(value, fallbackSlug) {
  const summary = normalizeGuideSummary({ ...value, slug: value.slug || fallbackSlug });
  return {
    ...summary,
    updatedAt: summary.updatedAt || new Date().toISOString(),
    authors: normalizeStringArray(value.authors),
    videos: normalizeVideos(value.videos),
    sections: normalizeSections(value.sections),
    related: normalizeStringArray(value.related)
  };
}

function normalizeSections(sections) {
  if (!Array.isArray(sections)) return [];
  return sections.map((section, index) => ({
    id: safeAnchor(section?.id) || `section-${index + 1}`,
    title: cleanText(section?.title) || `章节 ${index + 1}`,
    summary: cleanText(section?.summary),
    steps: normalizeSteps(section?.steps),
    media: normalizeMedia(section?.media)
  }));
}

function normalizeSteps(steps) {
  if (!Array.isArray(steps)) return [];
  return steps.map((step, index) => ({
    title: cleanText(step?.title) || `步骤 ${index + 1}`,
    body: cleanText(step?.body),
    tips: normalizeStringArray(step?.tips),
    danger: cleanText(step?.danger)
  }));
}

function normalizeMedia(media) {
  if (!Array.isArray(media)) return [];
  return media.map((item) => ({
    type: cleanText(item?.type) || 'image',
    title: cleanText(item?.title),
    url: cleanText(item?.url),
    alt: cleanText(item?.alt),
    caption: cleanText(item?.caption)
  })).filter((item) => item.url);
}

function normalizeVideos(videos) {
  if (!Array.isArray(videos)) return [];
  return videos.map((video) => ({
    title: cleanText(video?.title),
    provider: cleanText(video?.provider),
    url: cleanText(video?.url),
    embedUrl: cleanText(video?.embedUrl)
  })).filter((video) => video.url || video.embedUrl);
}

function normalizeSlug(value) {
  const slug = safeSlug(value);
  if (!slug || !SLUG_PATTERN.test(slug)) {
    const error = new Error('攻略 slug 格式不正确');
    error.status = 400;
    error.code = 'INVALID_GUIDE_SLUG';
    throw error;
  }
  return slug;
}

function safeSlug(value) {
  return String(value || '').trim().toLowerCase();
}

function safeAnchor(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function normalizeType(value) {
  const type = String(value || 'other').trim().toLowerCase();
  return GUIDE_TYPES.has(type) ? type : 'other';
}

function guideTypeLabel(type) {
  const labels = {
    raid: 'Raid',
    dungeon: '地牢',
    map: '地图',
    news: '资讯',
    system: '系统',
    other: '其他'
  };
  return labels[type] || labels.other;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map(cleanText).filter(Boolean);
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}
