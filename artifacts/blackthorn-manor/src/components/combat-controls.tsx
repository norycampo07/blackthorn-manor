import { useState } from 'react';
import { ArrowRight, Backpack, Heart, Pause, Play, Shield, Sparkles, Swords, Wind, X } from 'lucide-react';
import { canUseCombatItem, getDisplayItem, getMonster, type GameState } from '@/game/engine';
import { ItemArt } from '@/components/item-art';
import './combat-controls.css';
import { TOOLTIPS, tooltip } from '@/game/tooltips';

type Props = {
  game: GameState;
  running: boolean;
  guided: boolean;
  onAttack: () => void;
  onPause: () => void;
  onItem: (id: string) => void;
  onFlee: () => void;
};

export function CombatControls({ game, running, guided, onAttack, onPause, onItem, onFlee }: Props) {
  const [itemsOpen, setItemsOpen] = useState(false);
  const combat = game.combat;
  if (!combat) return null;
  const monster = getMonster(combat.monsterId);
  const hound = combat.monsterId === 'shadow-hound' || combat.monsterId === 'bat-swarm';
  const max = Math.max(1, combat.enemyMaxStamina);
  const enemyPct = Math.max(0, Math.min(100, (combat.enemyStamina / max) * 100));
  const playerPct = Math.max(0, Math.min(100, (game.stamina / 25) * 100));
  const out = combat.outcome;
  const started = combat.round > 0;
  const openItems = () => {
    if (running) onPause();
    setItemsOpen(true);
  };
  const outcomeKind = !out ? '' : out.enemyDamage > 0 && out.playerDamage > 0 ? 'both' : out.enemyDamage > 0 ? 'won' : out.playerDamage > 0 ? 'lost' : 'none';

  return (
    <div className="cc-root">
      <div className="eyebrow">YOUR NEXT BREATH</div>
      <h2>{running ? 'The fight is on.' : 'What will you do?'}</h2>

      <div className="cc-bars">
        <div className="cc-bar enemy" title="The enemy's remaining stamina. At zero it falls.">
          <div className="cc-bar-head"><span><Shield size={13} /> {monster?.name ?? 'ENEMY'}</span><b>{combat.enemyStamina} / {max}</b></div>
          <div className="cc-track"><i style={{ transform: `scaleX(${enemyPct / 100})` }} /></div>
        </div>
        <div className="cc-bar you" {...tooltip(TOOLTIPS.stamina)} tabIndex={0}>
          <div className="cc-bar-head"><span><Heart size={13} /> YOUR STAMINA</span><b>{game.stamina}</b></div>
          <div className="cc-track"><i style={{ transform: `scaleX(${playerPct / 100})` }} /></div>
        </div>
        <div className="cc-stats">
          <span {...tooltip(TOOLTIPS.skill)} tabIndex={0}><Swords size={13} /> SKILL <b>{game.skill}</b></span>
          <span {...tooltip(TOOLTIPS.luck)} tabIndex={0}><Sparkles size={13} /> LUCK <b>{game.luck}</b></span>
          <span className="cc-fear" {...tooltip(TOOLTIPS.fear)} tabIndex={0}>FEAR <b>{game.fear} / 10</b></span>
        </div>
      </div>

      {out && (
        <div key={combat.round} className={`cc-outcome ${outcomeKind} ${out.critical ? 'critical' : ''}`} aria-live="polite">
          {out.critical && <span className="cc-crit">CRITICAL</span>}
          <h3>{out.heading}</h3>
          <p>{out.detail}</p>
          <div className="cc-deltas">
            <span className="enemy-d" title="Stamina the enemy lost"><small>ENEMY</small>{out.enemyDamage > 0 ? `\u2212${out.enemyDamage}` : '0'}</span>
            <span className="player-d" title="Stamina you lost"><small>YOU</small>{out.playerDamage > 0 ? `\u2212${out.playerDamage}` : '0'}</span>
          </div>
          {out.luck && <p className="cc-luck"><Sparkles size={13} /> {out.luck}</p>}
        </div>
      )}

      {started && (
        <details className="cc-dice">
          <summary>Dice details</summary>
          <div className="dice-roll">
            <span>YOU <b>{combat.lastPlayerRoll ?? '\u2014'}</b></span><i>SKILL + 2D6</i><span>THE HOUSE <b>{combat.lastEnemyRoll ?? '\u2014'}</b></span>
          </div>
        </details>
      )}

      {combat.dialogue && (
        <blockquote className={`cc-dialogue ${hound ? 'narration' : ''}`}>
          <span>{hound ? 'THE DARK MOVES' : (monster?.name ?? 'IT').toUpperCase()}</span>
          {hound ? combat.dialogue : `\u201C${combat.dialogue}\u201D`}
        </blockquote>
      )}

      {combat.pauseReason && !running && <p className="cc-pause-reason">{combat.pauseReason}</p>}

      <div className="cc-actions">
        {running ? (
          <>
            <div className="cc-active" role="status"><span className="cc-pulse" /> AUTO BATTLE ACTIVE</div>
            <button className="combat-action" onClick={onPause}><Pause /><span><b>Pause</b><small>Hold the fight between exchanges.</small></span><ArrowRight /></button>
          </>
        ) : (
          <button className={`combat-action ${guided && !started ? 'guidance-combat' : ''}`} onClick={onAttack}>
            {started ? <Play /> : <Swords />}
            <span><b>{started ? 'Continue Battle' : 'Attack'}</b><small>{started ? 'Resume the automatic exchange.' : 'Begin the fight. Skill + 2D6; the higher roll strikes.'}</small></span>
            <ArrowRight />
          </button>
        )}
        <button className="combat-action" onClick={openItems} aria-expanded={itemsOpen}><Backpack /><span><b>Use Item / Potion</b><small>Pauses the fight while you choose.</small></span><ArrowRight /></button>
        <button className="combat-action" onClick={onFlee}><Wind /><span><b>Flee</b><small>Find the nearest open passage. Fear follows.</small></span><ArrowRight /></button>
      </div>

      {itemsOpen && (
        <div className="cc-items" role="dialog" aria-label="Objects">
          <div className="cc-items-head"><span>OBJECTS IN HAND</span><button onClick={() => setItemsOpen(false)} aria-label="Close objects"><X size={16} /></button></div>
          {game.inventory.length === 0 && <p className="cc-empty">Nothing in hand but the dark.</p>}
          <div className="cc-item-grid">
            {game.inventory.map(id => {
              const info = getDisplayItem(game, id);
              if (!info) return null;
              const usable = canUseCombatItem(game, id);
              const charges = game.itemCharges[id];
              const spent = charges !== undefined && charges <= 0;
              return (
                <button key={id} className="cc-item" disabled={!usable || spent} title={spent ? 'No charges remain' : usable ? `Use ${info.name}` : 'This cannot be used in combat'}
                  onClick={() => { setItemsOpen(false); onItem(id); }}>
                  <ItemArt id={id} className="cc-item-art" />
                  <b>{info.name}</b>
                  <small>{info.description}</small>
                  {charges !== undefined && <em>{spent ? 'EMPTY' : `${charges} LEFT`}</em>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="combat-log" aria-live="polite">{combat.log.slice(-5).map((line, i) => <p key={`${i}-${line}`}>{line}</p>)}</div>
      {monster?.special && <p className="monster-special">{monster.special}</p>}
    </div>
  );
}
