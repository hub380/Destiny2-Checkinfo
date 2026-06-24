import { numberStat, percentStat } from '../bungie/index.js';
import { privacyLabel } from './privacy.js';

export function summarizeRecords(records, privacy) {
  const allRecords = Object.values(records.records || {});
  const visibleRecords = allRecords.filter((record) => (Number(record.state || 0) & 16) === 0);
  const completedRecords = visibleRecords.filter((record) => (Number(record.state || 0) & 4) === 0);
  const redeemedRecords = visibleRecords.filter((record) => (Number(record.state || 0) & 1) !== 0);
  return {
    privacy: privacyLabel(privacy),
    score: numberStat(records.score || 0),
    activeScore: numberStat(records.activeScore || records.score || 0),
    legacyScore: numberStat(records.legacyScore || 0),
    lifetimeScore: numberStat(records.lifetimeScore || 0),
    recordCount: numberStat(visibleRecords.length),
    completedRecords: numberStat(completedRecords.length),
    redeemedRecords: numberStat(redeemedRecords.length),
    completionRate: percentStat(numberStat(completedRecords.length), numberStat(visibleRecords.length))
  };
}
