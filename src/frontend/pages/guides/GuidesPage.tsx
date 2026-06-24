import React, { FormEvent, useState } from 'react';
import { useGuidesLibrary } from '@frontend/hooks';
import {
  AppShell,
  CopyIcon,
  FadeIn,
  Notice,
  PageEmpty,
  PageLoading,
  SearchIcon,
  StaggerList,
  createPageCn,
  dateOnly
} from '@frontend/ui';
import type { GuideDetailDto, GuideSummaryDto, JsonRecord } from '@frontend/lib/types';
import '@frontend/styles/global.css';
import styles from './guides.module.css';

const cn = createPageCn(styles);

export function GuidesPage() {
  const {
    index,
    detail,
    query,
    setQuery,
    category,
    setCategory,
    loading,
    detailLoading,
    notice,
    error,
    categories,
    visibleItems,
    openGuide,
    closeGuide
  } = useGuidesLibrary();
  const [copyNotice, setCopyNotice] = useState('');

  const detailOpen = Boolean(detail || detailLoading);

  function onSearch(event: FormEvent) {
    event.preventDefault();
  }

  async function copyGuideLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      const input = document.createElement('textarea');
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    setCopyNotice('链接已复制');
    window.setTimeout(() => setCopyNotice(''), 1800);
  }

  return (
    <AppShell title="Destiny 2 攻略/资讯" subtitle="Raid、地牢、地图与机制资料库" current="guides">
      <FadeIn variant="page" className={cn(`guides-layout ${detailOpen ? 'detail-open' : ''}`)}>
        <section className={cn('panel guides-list-panel panelEnter')}>
          <div className={cn('panel-header')}>
            <div>
              <h2>攻略库</h2>
              <p>{loading ? '加载中' : `${visibleItems.length} / ${index?.items?.length ?? 0} 篇`}</p>
            </div>
            {index?.cache?.guides ? <span className={cn('cache-note')}>{cacheLabel(index.cache.guides)}</span> : null}
          </div>

          <form className={cn('guide-search')} onSubmit={onSearch}>
            <SearchIcon />
            <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="搜索 Raid、地牢、地图、机制" />
          </form>

          <div className={cn('category-tabs')} role="tablist" aria-label="攻略分类">
            <button
              className={cn(category === 'all' ? 'active' : '')}
              type="button"
              role="tab"
              aria-selected={category === 'all'}
              id="guides-tab-all"
              onClick={() => setCategory('all')}
            >
              全部
            </button>
            {categories.map((item) => (
              <button
                key={item.value}
                className={cn(category === item.value ? 'active' : '')}
                type="button"
                role="tab"
                aria-selected={category === item.value}
                id={`guides-tab-${item.value}`}
                onClick={() => setCategory(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <Notice message={notice} error={error} />

          {loading ? (
            <PageLoading className={cn('guide-list-loading')}>攻略索引加载中</PageLoading>
          ) : (
            <StaggerList className={cn('guide-list')} stagger={visibleItems.length <= 24}>
              {visibleItems.map((item) => (
                <GuideCard
                  key={item.slug}
                  item={item}
                  active={detail?.slug === item.slug}
                  onOpen={() => void openGuide(item)}
                />
              ))}
              {!visibleItems.length ? (
                <PageEmpty className={cn('guides-empty')}>
                  <b>暂无攻略内容</b>
                  <span>上传攻略后列表会自动出现。</span>
                </PageEmpty>
              ) : null}
            </StaggerList>
          )}
        </section>

        <section className={cn('panel guide-detail-panel panelEnter')} role="tabpanel" aria-label="攻略详情">
          {detailOpen ? (
            <button className={cn('detail-back')} type="button" onClick={closeGuide}>
              ← 返回列表
            </button>
          ) : null}
          {detailLoading ? (
            <PageLoading className={cn('empty-state')}>
              <b>正在加载攻略</b>
            </PageLoading>
          ) : detail ? (
            <FadeIn variant="detail" className={cn('contentSwap')}>
              <GuideDetail detail={detail} onCopyLink={() => void copyGuideLink()} copyNotice={copyNotice} />
            </FadeIn>
          ) : (
            <PageEmpty className={cn('empty-state detail-empty')}>
              <b>选择一篇攻略</b>
              <span>这里会展示章节、机制步骤、图片和外部视频引用。</span>
            </PageEmpty>
          )}
        </section>
      </FadeIn>
    </AppShell>
  );
}

function GuideCard({ item, active, onOpen }: { item: GuideSummaryDto; active: boolean; onOpen: () => void }) {
  return (
    <button className={cn(`guide-card cardHover ${active ? 'active' : ''}`)} type="button" onClick={onOpen}>
      {item.cover ? <img src={item.cover} alt="" /> : <span className={cn('cover-placeholder')}>{item.typeLabel || 'Guide'}</span>}
      <span className={cn('guide-card-body')}>
        <strong>{item.title}</strong>
        <em>{[item.activityName, item.difficulty, item.estimatedMinutes ? `${item.estimatedMinutes} 分钟` : ''].filter(Boolean).join(' · ')}</em>
        <small>{item.summary || item.subtitle || '暂无摘要'}</small>
      </span>
      <span className={cn('guide-card-meta')}>
        <span>{item.typeLabel || '其他'}</span>
        <span>{dateOnly(item.updatedAt)}</span>
      </span>
    </button>
  );
}

function GuideDetail({
  detail,
  onCopyLink,
  copyNotice
}: {
  detail: GuideDetailDto;
  onCopyLink: () => void;
  copyNotice: string;
}) {
  const sections = Array.isArray(detail.sections) ? detail.sections : [];
  const videos = Array.isArray(detail.videos) ? detail.videos : [];
  return (
    <article className={cn('guide-detail')}>
      <header className={cn('guide-hero')}>
        {detail.cover ? <img src={detail.cover} alt="" /> : null}
        <div>
          <span className={cn('guide-type')}>{detail.typeLabel || '攻略'}</span>
          <h2>{detail.title}</h2>
          <p>{detail.summary || detail.subtitle || ''}</p>
          <div className={cn('guide-meta-row')}>
            {detail.activityName ? <span>{detail.activityName}</span> : null}
            {detail.difficulty ? <span>{detail.difficulty}</span> : null}
            {detail.updatedAt ? <span>更新 {dateOnly(detail.updatedAt)}</span> : null}
            {detail.authors?.length ? <span>{detail.authors.join(' / ')}</span> : null}
          </div>
          <div className={cn('guide-actions')}>
            <button className={cn('guide-copy-link')} type="button" onClick={onCopyLink}>
              <CopyIcon />
              复制链接
            </button>
            {copyNotice ? <span className={cn('guide-copy-notice')}>{copyNotice}</span> : null}
          </div>
          {detail.tags?.length ? (
            <div className={cn('tag-row')}>
              {detail.tags.map((tag) => <span key={tag}>{tag}</span>)}
            </div>
          ) : null}
        </div>
      </header>

      {videos.length ? (
        <section className={cn('video-grid')}>
          {videos.map((video, index) => <VideoBlock key={`${video.url || video.embedUrl || index}`} video={video} />)}
        </section>
      ) : null}

      <div className={cn('section-list')}>
        {sections.map((section, index) => <GuideSection key={section.id || index} section={section} index={index} />)}
        {!sections.length ? (
          <PageEmpty>
            <b>暂无章节</b>
            <span>这篇攻略还没有章节内容。</span>
          </PageEmpty>
        ) : null}
      </div>
    </article>
  );
}

function GuideSection({ section, index }: { section: JsonRecord; index: number }) {
  const steps = Array.isArray(section.steps) ? section.steps : [];
  const media = Array.isArray(section.media) ? section.media : [];
  return (
    <section className={cn('guide-section')}>
      <div className={cn('section-heading')}>
        <span>{String(index + 1).padStart(2, '0')}</span>
        <div>
          <h3>{section.title || `章节 ${index + 1}`}</h3>
          {section.summary ? <p>{section.summary}</p> : null}
        </div>
      </div>
      {media.length ? (
        <div className={cn('media-grid')}>
          {media.map((item, mediaIndex) => <MediaBlock key={`${item.url || mediaIndex}`} item={item} />)}
        </div>
      ) : null}
      <div className={cn('step-list')}>
        {steps.map((step, stepIndex) => <StepBlock key={`${step.title || stepIndex}`} step={step} index={stepIndex} />)}
      </div>
    </section>
  );
}

function StepBlock({ step, index }: { step: JsonRecord; index: number }) {
  const tips = Array.isArray(step.tips) ? step.tips : [];
  return (
    <div className={cn('step-card')}>
      <span className={cn('step-index')}>{index + 1}</span>
      <div>
        <h4>{step.title || `步骤 ${index + 1}`}</h4>
        {step.body ? <p>{step.body}</p> : null}
        {tips.length ? (
          <ul>
            {tips.map((tip) => <li key={tip}>{tip}</li>)}
          </ul>
        ) : null}
        {step.danger ? <strong>{step.danger}</strong> : null}
      </div>
    </div>
  );
}

function VideoBlock({ video }: { video: JsonRecord }) {
  return (
    <div className={cn('video-block')}>
      <div className={cn('video-frame')}>
        {video.embedUrl ? (
          <iframe src={video.embedUrl} title={video.title || 'video'} loading="lazy" allowFullScreen />
        ) : (
          <a href={video.url} target="_blank" rel="noreferrer">打开外部视频</a>
        )}
      </div>
      <b>{video.title || '外部视频'}</b>
      {video.provider ? <span>{video.provider}</span> : null}
    </div>
  );
}

function MediaBlock({ item }: { item: JsonRecord }) {
  if (item.type === 'video') {
    return <VideoBlock video={item} />;
  }
  return (
    <figure className={cn('image-block')}>
      <img src={item.url} alt={item.alt || item.title || ''} loading="lazy" />
      {item.caption || item.title ? <figcaption>{item.caption || item.title}</figcaption> : null}
    </figure>
  );
}

function cacheLabel(value: unknown) {
  const text = String(value || '');
  if (text === 'empty-r2') return '暂无内容';
  if (text.includes('hit') || text.includes('memory') || text.includes('r2')) return '已缓存';
  return '在线';
}
