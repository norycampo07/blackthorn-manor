import { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { artForItem } from '@/game/artwork';
import { getItem } from '@/game/engine';

export function ItemArt({ id, className = '' }: { id: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const src = artForItem(id);
  useEffect(() => setFailed(false), [id]);
  return src && !failed
    ? <img className={className} src={src} onError={() => setFailed(true)} alt={getItem(id)?.name ?? id.replaceAll('-', ' ')} />
    : <span className={`item-art-placeholder ${className}`} aria-label="Item illustration unavailable"><KeyRound /></span>;
}
