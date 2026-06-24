import {
  CopyIcon,
  Notice,
  PageEmpty,
  SearchIcon,
  StaggerList,
  createPageCn,
  relativeTime,
  staggerStyle
} from '@frontend/ui';
import type { FireteamDto } from '@frontend/lib/types';
import { useWindowedSlice } from '@frontend/hooks/useWindowedSlice';
import styles from './home.module.css';

const cn = createPageCn(styles);
const FIRETEAM_PAGE_SIZE = 48;

type FireteamFeedSectionProps = {
  items: FireteamDto[];
  filteredItems: FireteamDto[];
  filter: string;
  loading: boolean;
  notice: string;
  noticeError: boolean;
  onFilterChange: (value: string) => void;
  onCopy: (command: string) => void;
  onPickUser: (username: string) => void;
};

export function FireteamFeedSection({
  items,
  filteredItems,
  filter,
  loading,
  notice,
  noticeError,
  onFilterChange,
  onCopy,
  onPickUser
}: FireteamFeedSectionProps) {
  const { visible, hasMore, showMore } = useWindowedSlice(filteredItems, FIRETEAM_PAGE_SIZE);

  return (
    <>
      <div className={cn('panel-header')}>
        <div>
          <h2>组队信息</h2>
          <p>{loading ? '刷新中' : `${filteredItems.length} 条 / 共 ${items.length} 条`}</p>
        </div>
        <div className={cn('filter-box searchFocus')}>
          <SearchIcon />
          <input
            value={filter}
            onChange={(event) => onFilterChange(event.target.value)}
            type="search"
            placeholder="筛选活动、队长、用户名"
          />
        </div>
      </div>
      <Notice message={notice} error={noticeError} />
      <StaggerList className={cn(`fireteam-list ${loading ? 'is-loading' : ''}`)} stagger={visible.length <= 20}>
        {visible.length ? (
          visible.map((item, index) => (
            <FireteamCard
              key={item.id || `${item.username}-${index}`}
              item={item}
              index={index}
              onCopy={onCopy}
              onPickUser={onPickUser}
            />
          ))
        ) : (
          <PageEmpty>没有匹配的组队信息</PageEmpty>
        )}
      </StaggerList>
      {hasMore ? (
        <div className={cn('list-more')}>
          <button type="button" className={cn('list-more-button')} onClick={showMore}>
            显示更多（已显示 {visible.length} / {filteredItems.length}）
          </button>
        </div>
      ) : null}
    </>
  );
}

function FireteamCard({
  item,
  index,
  onCopy,
  onPickUser
}: {
  item: FireteamDto;
  index: number;
  onCopy: (command: string) => void;
  onPickUser: (username: string) => void;
}) {
  const username = item.username || '';
  const command = item.joinCommand || (username ? `/j ${username}` : '');
  const meta = [
    item.activity,
    item.author ? `队长 ${item.author}` : '',
    item.createdAt ? relativeTime(item.createdAt) : '',
    item.source === 'demo' ? '演示' : ''
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <article className={cn('fireteam-card cardHover staggerItem')} style={staggerStyle(index)}>
      <div className={cn('fireteam-main')}>
        <div className={cn('fireteam-head')}>
          <img className={cn('team-avatar')} src={item.avatar || '/brand.svg'} alt="" loading="lazy" decoding="async" />
          <div className={cn('fireteam-copy')}>
            <div className={cn('fireteam-title')}>
              <h3>{item.title || '未命名组队'}</h3>
              {item.slots?.max ? <span className={cn('slot')}>{item.slots.current}/{item.slots.max}</span> : null}
            </div>
            <div className={cn('meta-row')}>{meta || '小黑盒'}</div>
          </div>
        </div>
        {item.tags?.length ? (
          <div className={cn('tag-row')}>{item.tags.slice(0, 4).map((tag) => <span className={cn('tag')} key={tag}>{tag}</span>)}</div>
        ) : null}
        <p className={cn('content')}>{item.content || '无详情'}</p>
      </div>
      <div className={cn('join-box')}>
        <button className={cn(`username ${username ? 'clickable' : ''}`)} type="button" onClick={() => username && onPickUser(username)}>
          {username || '未识别用户名'}
        </button>
        <button className={cn('copy-button')} disabled={!command} onClick={() => command && onCopy(command)}>
          <CopyIcon />
          复制
        </button>
        {item.link ? <a className={cn('tag')} href={item.link} target="_blank" rel="noreferrer">来源</a> : null}
        {username.includes('#') ? (
          <a className={cn('tag')} href={`/fireteam.html?q=${encodeURIComponent(username)}`}>查棒鸡队伍</a>
        ) : null}
      </div>
    </article>
  );
}
