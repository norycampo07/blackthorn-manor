import { useEffect, useRef } from 'react';
import { ArrowRight, BookOpen } from 'lucide-react';
import { getDisplayItem, getItem, type GameState, type PendingDiscovery } from '@/game/engine';
import { ItemArt } from './item-art';

export type DiscoveryModal = PendingDiscovery;

const pretty = (id: string) => id.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
const itemWhispers: Record<string, string> = {
  'blackthorn-dagger': 'The blade remembers.',
  'red-gem': 'The crimson eye still waits.',
  'family-seal-ring': 'At last.',
  'ancient-diary': 'You have walked these halls before.',
};

export function DiscoveryOverlay({ dialog, onClose, guided = false, game, fading = false }: {
  dialog: DiscoveryModal;
  onClose: () => void;
  guided?: boolean;
  game?: GameState;
  fading?: boolean;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => closeButton.current?.focus({ preventScroll: true }), [dialog]);
  const item = dialog.itemId ? game ? getDisplayItem(game, dialog.itemId) : getItem(dialog.itemId) : undefined;
  const legendary = dialog.kind === 'item' && Boolean(itemWhispers[dialog.itemId ?? '']);
  const buttonText = dialog.kind === 'encounter' ? 'Enter the chamber' : dialog.kind === 'luck' ? 'Test Your Luck' : dialog.kind === 'locked' ? 'Close'
    : dialog.kind === 'item' ? 'Take Item'
      : dialog.kind === 'fragment' ? 'Add to Family Fragments'
        : dialog.kind === 'review' ? 'Close Discovery'
          : dialog.kind === 'examine' ? 'Return to Inventory' : 'Continue';
  return (
    <div className={`discovery-backdrop ${legendary ? 'legendary-reveal' : ''} ${fading ? 'luck-fading' : ''}`} role="presentation">
      <section className="discovery-modal" role="dialog" aria-modal="true" aria-labelledby="discovery-title" onKeyDown={event => {
        if (event.key === 'Tab') { event.preventDefault(); closeButton.current?.focus(); }
      }}>
        <span className="eyebrow">{dialog.kind === 'locked' ? 'THE HOUSE WITHHOLDS' : dialog.kind === 'review' ? 'OPTION MEMORY' : legendary ? 'THE HOUSE WHISPERS' : dialog.title}</span>
        {legendary && <p className="discovery-whisper">“{itemWhispers[dialog.itemId!]}”</p>}
        {dialog.itemId && <ItemArt id={dialog.itemId} className="discovery-art" />}
        <h2 id="discovery-title">{dialog.kind === 'item' || dialog.kind === 'examine' ? item?.name ?? dialog.title : dialog.kind === 'fragment' ? pretty(dialog.clueId ?? 'family-fragment') : dialog.title}</h2>
        {dialog.kind === 'item' && item && <p className="discovery-description">{item.description}</p>}
        <p className="discovery-story">{dialog.story}</p>
        {dialog.effects?.length ? <ul className="discovery-effects">{dialog.effects.map(effect => <li key={effect}>{effect}</li>)}</ul> : null}
        {dialog.usedItemId && <div className="discovery-used-item"><span>IN YOUR HAND<br /><b>{getItem(dialog.usedItemId)?.name}</b></span></div>}
        {dialog.clueId && dialog.kind === 'item' && <div className="discovery-side-fragment"><BookOpen size={15} /> Also recovered: {pretty(dialog.clueId)}</div>}
        <button ref={closeButton} className={`primary-button ${guided ? 'guidance-glow' : ''}`} onClick={onClose}>{buttonText}<ArrowRight size={16} /></button>
      </section>
    </div>
  );
}
