import { COPY_FIRETEAM_DETAILED_LOADING } from '@frontend/lib/copy';
import { createPageCn } from '@frontend/ui';
import styles from './fireteam.module.css';

const cn = createPageCn(styles);

type FireteamProgressStripProps = {
  active: boolean;
  loaded: number;
  total: number;
  done?: boolean;
};

export function FireteamProgressStrip({ active, loaded, total, done }: FireteamProgressStripProps) {
  if (!active && !done) return null;

  const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : done ? 100 : 12;
  const label = done
    ? '成员详细终局数据已加载'
    : total > 0
      ? `${COPY_FIRETEAM_DETAILED_LOADING}（${loaded}/${total}）`
      : COPY_FIRETEAM_DETAILED_LOADING;

  return (
    <div className={cn('fireteam-progress-strip')} role="status" aria-live="polite">
      <p>{label}</p>
      <div className={cn('fireteam-progress-track')}>
        <span className={cn('fireteam-progress-fill')} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
