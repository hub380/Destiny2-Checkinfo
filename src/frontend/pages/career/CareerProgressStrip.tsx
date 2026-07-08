import type { CareerProgressStage } from '@frontend/hooks/useCareerProgressiveLoad';
import { COPY_CAREER_AUTO_LOAD_HINT, COPY_CAREER_LOAD_ALL_NOW } from '@frontend/lib/copy';
import { cn } from './career-cn';

const STEPS: { key: CareerProgressStage; label: string }[] = [
  { key: 'details', label: '成就与锻造' },
  { key: 'endgame', label: 'Raid / 地牢' },
  { key: 'pvp', label: 'PvP 历史' }
];

function stepState(current: CareerProgressStage, step: CareerProgressStage) {
  const order: CareerProgressStage[] = ['idle', 'details', 'endgame', 'pvp', 'done'];
  const currentIndex = order.indexOf(current);
  const stepIndex = order.indexOf(step);
  if (currentIndex > stepIndex || current === 'done') return 'done';
  if (currentIndex === stepIndex) return 'active';
  return 'pending';
}

type CareerProgressStripProps = {
  stage: CareerProgressStage;
  onLoadAll?: () => void;
  busy?: boolean;
};

export function CareerProgressStrip({ stage, onLoadAll, busy }: CareerProgressStripProps) {
  if (stage === 'idle') return null;

  return (
    <div className={cn('career-progress-strip')} role="status" aria-live="polite">
      <div className={cn('career-progress-head')}>
        <p>{stage === 'done' ? '完整数据已加载' : COPY_CAREER_AUTO_LOAD_HINT}</p>
        {stage !== 'done' && onLoadAll ? (
          <button type="button" className={cn('career-load-all-now')} onClick={onLoadAll} disabled={busy}>
            {COPY_CAREER_LOAD_ALL_NOW}
          </button>
        ) : null}
      </div>
      <div className={cn('career-progress-track')}>
        <span
          className={cn('career-progress-fill')}
          style={{ width: `${progressPercent(stage)}%` }}
        />
      </div>
      <ol className={cn('career-progress-steps')}>
        {STEPS.map((step) => {
          const state = stepState(stage, step.key);
          return (
            <li key={step.key} className={cn(`career-progress-step ${state}`)}>
              <span className={cn('career-progress-dot')} />
              <span>{step.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function progressPercent(stage: CareerProgressStage) {
  if (stage === 'done') return 100;
  if (stage === 'pvp') return 82;
  if (stage === 'endgame') return 55;
  if (stage === 'details') return 28;
  return 8;
}
