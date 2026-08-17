// v2/src/core/device_tier.js — Adaptive Device Tier Detection & Rendering Budgets

/**
 * Detects device hardware tier based on user-agent heuristics and touch-point capability.
 * @returns {'mobile' | 'desktop'}
 */
export function detectDeviceTier() {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  const isMobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  const hasTouch = (navigator.maxTouchPoints || 0) > 0;
  return (isMobileUA || hasTouch) ? 'mobile' : 'desktop';
}

/**
 * Returns performance budgets tailored to the current device tier.
 * @returns {{ tier: string, maxSplatSizeMB: number, targetDPR: number }}
 */
export function getDeviceBudget() {
  const tier = detectDeviceTier();
  const rawDPR = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;

  if (tier === 'mobile') {
    return {
      tier: 'mobile',
      maxSplatSizeMB: 8, // 2x baseline butterfly.spz size
      targetDPR: Math.min(rawDPR, 1.5)
    };
  }

  return {
    tier: 'desktop',
    maxSplatSizeMB: 64,
    targetDPR: Math.min(rawDPR, 2.0)
  };
}
