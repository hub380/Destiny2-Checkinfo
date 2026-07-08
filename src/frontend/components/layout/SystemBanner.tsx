import { css, uiClasses } from '@frontend/lib/cn';
import { COPY_BUNGIE_KEY_MISSING, COPY_DEMO_DATA_HINT } from '@frontend/lib/copy';

const cn = (classNames: string) => css(uiClasses, classNames);

type SystemBannerProps = {
  hasBungieApiKey?: boolean;
  demoData?: boolean;
  configReady?: boolean;
};

export function SystemBanner({ hasBungieApiKey, demoData, configReady = true }: SystemBannerProps) {
  if (!configReady) return null;
  if (demoData) {
    return (
      <div className={cn('system-banner warn')} role="status">
        {COPY_DEMO_DATA_HINT}
      </div>
    );
  }
  if (hasBungieApiKey === false) {
    return (
      <div className={cn('system-banner error')} role="alert">
        {COPY_BUNGIE_KEY_MISSING}
      </div>
    );
  }
  return null;
}
