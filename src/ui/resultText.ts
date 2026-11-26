import type { BattleResult } from '../sim/battle';
import type { FinishKind } from '../sim/combat';
import { formatStamina } from './format';

export const FINISH_LABEL: Record<FinishKind, string> = { burst: 'BURST FINISH', knockout: 'KNOCKOUT FINISH', spin: 'SPIN FINISH' };

/** Result-card text (pure; unit-tested). */
export function describeResult(r: BattleResult, label: (i: number) => string, stepHz = 240): { title: string; badge: string; sub: string } {
  const o = r.outcome;
  const finishText: Record<FinishKind, (l: string) => string> = {
    burst: (l) => `${l} burst apart`,
    knockout: (l) => `${l} was knocked out of the stadium`,
    spin: (l) => `${l} stopped spinning first`,
  };
  if (o.kind === 'win') {
    const extra = o.narrow ? ` · ${label(o.winner)} still had ${formatStamina(r.tops[o.winner]!.stamina)} stamina` : '';
    return {
      title: `${label(o.winner)} wins!`,
      badge: o.narrow ? 'NARROW VICTORY' : '',
      sub: `${FINISH_LABEL[o.finish]} · ${finishText[o.finish](label(o.loser))}${extra} · ${r.time.toFixed(1)} s`,
    };
  }
  if (o.kind === 'draw') {
    if (o.reason === 'near-simultaneous') {
      const dw = r.drawWindow!;
      const delay = (dw.secondStopDelaySteps ?? 0) / stepHz;
      return {
        title: 'DRAW',
        badge: '',
        sub: `Both tops stopped spinning almost simultaneously (${delay.toFixed(2)} s apart, within the ${(dw.windowSteps / stepHz).toFixed(2)} s draw window) · ${r.time.toFixed(1)} s`,
      };
    }
    return {
      title: 'DRAW',
      badge: '',
      sub: `Both tops were eliminated on the same physics step (${o.finishes.map((f) => FINISH_LABEL[f].toLowerCase()).join(' + ')}) · ${r.time.toFixed(1)} s`,
    };
  }
  return { title: 'Time up', badge: '', sub: `Both tops still in play after ${r.time.toFixed(0)} s (maximum duration). No winner.` };
}
