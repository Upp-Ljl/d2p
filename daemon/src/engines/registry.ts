// Process-wide singleton holding the current LLMEngine. Set once at daemon
// boot from AppConfig, may be hot-swapped by /api/config POST.
//
// F1 adds a second slot — the critic engine — used by reviewer roles. The
// router (./router.ts) decides whether the critic is cross-family or
// degraded-to-same; consumers can ask for criticPolicy() to surface badges.

import type { LLMEngine } from './types.js';
import type { EngineConfig } from '../config/types.js';
import { buildEngine } from './factory.js';
import { pickCriticEngine, type CriticPolicy } from './router.js';

let activeWorker: LLMEngine | null = null;
let activeCritic: LLMEngine | null = null;
let workerConfig: EngineConfig | null = null;
let criticConfig: EngineConfig | null = null;
let criticPolicy: CriticPolicy | null = null;

export function setActiveEngine(worker: EngineConfig, critic?: EngineConfig | null): LLMEngine {
  activeWorker = buildEngine(worker);
  workerConfig = worker;
  const policy = pickCriticEngine(worker, critic ?? null);
  criticPolicy = policy;
  criticConfig = critic ?? null;
  // Critic engine is built from policy.critic (which equals worker when
  // degraded). Reuse the worker instance when they're identical to save a
  // duplicate engine object.
  activeCritic = policy.critic === worker ? activeWorker : buildEngine(policy.critic);
  return activeWorker;
}

export function getActiveEngine(): LLMEngine {
  if (!activeWorker) {
    // Default fallback so unit tests / daemon-not-bootstrapped paths still
    // produce a non-throwing engine.
    setActiveEngine({ kind: 'claude-cli' });
  }
  return activeWorker!;
}

/** The critic engine — used by reviewer roles. Falls back to the worker engine
 *  in degraded mode (no second engine configured or same family). */
export function getCriticEngine(): LLMEngine {
  if (!activeCritic) getActiveEngine(); // initialize defaults
  return activeCritic!;
}

export function currentEngineConfig(): EngineConfig | null {
  return workerConfig;
}

export function currentCriticConfig(): EngineConfig | null {
  return criticConfig;
}

export function currentCriticPolicy(): CriticPolicy | null {
  return criticPolicy;
}
