import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';

export const DEFAULT_CONTENT_ROOT = resolve('content/guides');
export const DEFAULT_GUIDE_PREFIX = 'guides';

const GUIDE_TYPES = new Set(['raid', 'dungeon', 'map', 'news', 'system', 'other']);
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,80}$/;

export function loadGuideContent(options = {}) {
  const contentRoot = resolve(options.contentRoot || DEFAULT_CONTENT_ROOT);
  if (!existsSync(contentRoot)) {
    return {
      contentRoot,
      index: createIndex([]),
      details: [],
      mediaFiles: [],
      warnings: [`Content root does not exist: ${contentRoot}`]
    };
  }

  const details = [];
  const mediaFiles = [];
  const warnings = [];
  for (const entry of readdirSync(contentRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    const guidePath = resolve(contentRoot, slug, 'guide.json');
    if (!existsSync(guidePath)) {
      warnings.push(`Skipped ${slug}: missing guide.json`);
      continue;
    }
    const guide = readJson(guidePath);
    const normalized = normalizeGuide(guide, slug, guidePath);
    details.push({
      slug: normalized.slug,
      path: guidePath,
      value: normalized
    });
    mediaFiles.push(...collectMediaFiles(contentRoot, normalized.slug));
  }

  details.sort((a, b) => String(b.value.updatedAt || '').localeCompare(String(a.value.updatedAt || '')) || a.value.title.localeCompare(b.value.title, 'zh-CN'));
  return {
    contentRoot,
    index: createIndex(details.map((detail) => summaryFor(detail.value))),
    details,
    mediaFiles,
    warnings
  };
}

export function objectKey(prefix, pathname) {
  return `${trimSlashes(prefix || DEFAULT_GUIDE_PREFIX)}/${trimSlashes(pathname)}`;
}

export function contentTypeFor(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

function createIndex(items) {
  const categories = Array.from(new Set(items.map((item) => item.type).filter(Boolean)));
  const tags = Array.from(new Set(items.flatMap((item) => item.tags || [])));
  return {
    updatedAt: new Date().toISOString(),
    categories,
    tags,
    items
  };
}

function summaryFor(guide) {
  return {
    slug: guide.slug,
    title: guide.title,
    subtitle: guide.subtitle,
    type: guide.type,
    activityHash: guide.activityHash,
    activityName: guide.activityName,
    cover: guide.cover,
    summary: guide.summary,
    tags: guide.tags,
    updatedAt: guide.updatedAt,
    difficulty: guide.difficulty,
    estimatedMinutes: guide.estimatedMinutes
  };
}

function normalizeGuide(value, folderSlug, guidePath) {
  const slug = cleanText(value.slug || folderSlug).toLowerCase();
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(`${guidePath}: invalid slug "${slug}"`);
  }
  if (slug !== folderSlug) {
    throw new Error(`${guidePath}: slug must match folder name "${folderSlug}"`);
  }
  const title = cleanText(value.title);
  if (!title) {
    throw new Error(`${guidePath}: title is required`);
  }
  const type = normalizeType(value.type);
  const sections = normalizeSections(value.sections);
  return {
    slug,
    title,
    subtitle: cleanText(value.subtitle),
    type,
    activityHash: value.activityHash ? String(value.activityHash) : '',
    activityName: cleanText(value.activityName),
    cover: cleanText(value.cover),
    summary: cleanText(value.summary),
    tags: normalizeStringArray(value.tags),
    updatedAt: cleanText(value.updatedAt) || new Date().toISOString(),
    difficulty: cleanText(value.difficulty),
    estimatedMinutes: Number(value.estimatedMinutes || 0) || 0,
    authors: normalizeStringArray(value.authors),
    videos: normalizeVideos(value.videos),
    sections,
    related: normalizeStringArray(value.related)
  };
}

function normalizeSections(sections) {
  if (!Array.isArray(sections)) return [];
  return sections.map((section, index) => ({
    id: safeAnchor(section?.id) || `section-${index + 1}`,
    title: cleanText(section?.title) || `Section ${index + 1}`,
    summary: cleanText(section?.summary),
    steps: normalizeSteps(section?.steps),
    media: normalizeMedia(section?.media)
  }));
}

function normalizeSteps(steps) {
  if (!Array.isArray(steps)) return [];
  return steps.map((step, index) => ({
    title: cleanText(step?.title) || `Step ${index + 1}`,
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

function collectMediaFiles(contentRoot, slug) {
  const mediaRoot = resolve(contentRoot, slug, 'media');
  if (!existsSync(mediaRoot)) return [];
  return walkFiles(mediaRoot).map((filePath) => {
    const relativePath = relative(mediaRoot, filePath).split(sep).join('/');
    return {
      slug,
      path: filePath,
      relativePath
    };
  });
}

function walkFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const filePath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(filePath));
    } else if (entry.isFile() && statSync(filePath).size > 0) {
      files.push(filePath);
    }
  }
  return files;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function normalizeType(value) {
  const type = String(value || 'other').trim().toLowerCase();
  return GUIDE_TYPES.has(type) ? type : 'other';
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map(cleanText).filter(Boolean);
}

function safeAnchor(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function trimSlashes(value) {
  return String(value || '').replace(/^\/+|\/+$/g, '');
}
