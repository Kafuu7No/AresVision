import { fetchPersonalBuildStatus } from '../services/api';

const PERSONAL_WARMUP_BLOCKING_STAGES = new Set([
  'queued',
  'building_cache',
  'warming_analysis',
  'warming_predict',
]);

export function isPersonalWarmupBlockingStage(stage) {
  return PERSONAL_WARMUP_BLOCKING_STAGES.has(stage);
}

export async function getPersonalSourceAvailability() {
  const status = await fetchPersonalBuildStatus();
  return {
    status,
    blocked: isPersonalWarmupBlockingStage(status?.stage || 'idle'),
  };
}

export function getPersonalSourceBlockedMessage(isZh) {
  return isZh
    ? '\u4e2a\u4eba\u6570\u636e\u4ecd\u5728\u9884\u70ed\u4e2d\uff0c\u8bf7\u5148\u7ee7\u7eed\u4f7f\u7528\u7cfb\u7edf\u9ed8\u8ba4\u6570\u636e\u6e90\u3002'
    : 'Personal data is still warming up. Please continue using the default source for now.';
}

export function getPersonalSourceCheckFailedMessage(isZh) {
  return isZh
    ? '\u6682\u65f6\u65e0\u6cd5\u786e\u8ba4\u4e2a\u4eba\u6570\u636e\u6e90\u72b6\u6001\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5\u3002'
    : 'Unable to confirm the personal source status right now. Please try again later.';
}
