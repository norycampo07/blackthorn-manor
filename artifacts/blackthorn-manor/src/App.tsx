import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import {
  combatTurn, createGame, enterRoom, getChoiceDiscoveryText, getChoiceReward, getItem, getLeaderboard, getMonster, getRandomWhisper,
  getRoom, interact, isExitAvailable, loadGame, restartGame, saveGame, submitScore, testLuck, getDisplayItem, usePotion,
  type CombatAction, type GameState,
} from '@/game/engine';
import { ITEM_LOCK_MESSAGES, ROOMS, type Room, type StoryChoice } from '@/game/content';
import { artForEnding, artForMonster, artForRoom } from '@/game/artwork';
import { advanceGuidance, readGuidance, saveGuidance, type GuidanceState } from '@/game/guidance';
import { acceptDiscovery, stageDiscoveries } from '@/game/discoveries';
import { DiscoveryOverlay, type DiscoveryModal } from '@/components/discovery-overlay';
import { FearCinematic } from '@/components/fear-cinematic';
import { ItemArt } from '@/components/item-art';
import { CombatControls } from '@/components/combat-controls';
import { combatDialogue } from '@/game/combat-lore';
import { HoverTooltips } from '@/components/hover-tooltips';
import { TOOLTIPS, tooltip } from '@/game/tooltips';
import { knownLocks } from '@/game/map-state';
import {
  ArrowLeft, ArrowRight, BadgeCheck, BookOpen, Compass, Eye, Heart, KeyRound, Map, Moon, Save,
  Shield, Skull, Sparkles, Swords, Volume2, VolumeX, Wind, X,
} from 'lucide-react';
import './manor.css';
import './refinements.css';

type Panel = 'map' | 'inventory' | 'clues' | 'achievements' | null;
type Entry = { username?: string; ending?: string; score?: number; time?: string; fear?: number; monstersDefeated?: number };
const pretty = (id: string) => id.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');

export default function App() {
  return <><Game /><HoverTooltips /></>;
}

function Game() {
  const [screen, setScreen] = useState<'title' | 'play'>('title');
  const [game, setGame] = useState<GameState | null>(null);
  const [name, setName] = useState(() => localStorage.getItem('blackthorn.username') || '');
  const [nameError, setNameError] = useState('');
  const [leaderboard, setLeaderboard] = useState<Entry[]>([]);
  const [panel, setPanel] = useState<Panel>(null);
  const [toast, setToast] = useState('');
  const [lucky, setLucky] = useState(false);
  const [battleRunning, setBattleRunning] = useState(false);
  const autoExchange = useRef<(() => void) | null>(null);
  const [discoveryDialog, setDiscoveryDialog] = useState<DiscoveryModal | null>(null);
  const [guidance, setGuidance] = useState(() => readGuidance(loadGame()));
  const [fearTransition, setFearTransition] = useState<{ fromFear: number; toFear: number; eventId: number } | null>(null);
  const fearCommit = useRef<(() => void) | null>(null);
  const transitionLocked = useRef(false);
  const [whisperHighlighted, setWhisperHighlighted] = useState(false);
  const [victory, setVictory] = useState('');
  const [itemImpact, setItemImpact] = useState('');
  const [transformation, setTransformation] = useState(false);
  const [endingStage, setEndingStage] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const submittedRun = useRef<number | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const lastSoundEvent = useRef('');
  const room = useMemo(() => game ? getRoom(game.roomId) : undefined, [game?.roomId]);
  const monster = game?.combat ? getMonster(game.combat.monsterId) : undefined;
  const exits = room?.exits || [];
  const currentChoices = room?.choices || [];

  useEffect(() => {
    setLeaderboard(getLeaderboard());
  }, []);

  useEffect(() => saveGuidance(guidance), [guidance]);
  useEffect(() => {
    const pause = () => { if (document.hidden) setBattleRunning(false); };
    document.addEventListener('visibilitychange', pause);
    return () => document.removeEventListener('visibilitychange', pause);
  }, []);
  useEffect(() => {
    if (!battleRunning || screen !== 'play' || game?.phase !== 'combat' || fearTransition || discoveryDialog || transformation || panel || document.hidden) return;
    const timer = window.setTimeout(() => autoExchange.current?.(), 1800);
    return () => window.clearTimeout(timer);
  }, [battleRunning, game, screen, fearTransition, discoveryDialog, transformation, panel]);

  useEffect(() => {
    if (!game) return;
    if (game.lastEvent?.message) {
      setToast(game.lastEvent.message);
      window.setTimeout(() => setToast(current => current === game.lastEvent?.message ? '' : current), 3000);
    }
    const eventKey = game.lastLuck?.success ? `${game.lastLuck.id}:${game.lastLuck.at}`
      : game.lastEvent?.type === 'luck' ? `${game.lastEvent.message}:${game.luckSuccesses}` : '';
    if (eventKey && lastSoundEvent.current !== eventKey) {
      lastSoundEvent.current = eventKey;
      setLucky(true);
      window.setTimeout(() => setLucky(false), 1400);
      if (soundEnabled) {
        playTone([784, 988, 1175], 0.1, 0.045);
      }
    }
  }, [game, soundEnabled]);

  useEffect(() => {
    if (game?.phase === 'ending') setEndingStage(0);
  }, [game?.phase, game?.ending]);

  useEffect(() => {
    if (!game || game.fear < 7 || (game.phase !== 'playing' && game.phase !== 'combat') || !soundEnabled) return;
    const pulse = () => playTone([54, 42], 0.13, 0.07, 0.12, true);
    pulse();
    const timer = window.setInterval(pulse, game.fear >= 9 ? 760 : 1120);
    return () => window.clearInterval(timer);
  }, [game?.fear, game?.phase, soundEnabled]);

  useEffect(() => {
    if (!game || (game.phase !== 'dead' && game.phase !== 'ending') || submittedRun.current === game.startedAt) return;
    submittedRun.current = game.startedAt;
    setLeaderboard(submitScore(game, game.phase === 'ending' ? game.ending : 'bad'));
  }, [game]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(current => current === message ? '' : current), 2800);
  };
  const getAudioContext = () => {
    try {
      if (!audioContext.current) audioContext.current = new window.AudioContext();
      if (audioContext.current.state === 'suspended') void audioContext.current.resume();
      return audioContext.current;
    } catch {
      return null;
    }
  };
  const playTone = (frequencies: number[], duration: number, volume: number, gap = 0.08, low = false) => {
    const context = getAudioContext();
    if (!context) return;
    const start = context.currentTime;
    frequencies.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const at = start + index * gap;
      oscillator.type = low ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(volume, at + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + duration + 0.02);
    });
  };
  const persist = (next: GameState) => {
    setGame(next);
    const ok = saveGame(next);
    if (!ok) notify('This browser could not keep a save file.');
  };
  const markGuidance = (patch: Partial<GuidanceState>) => {
    setGuidance(current => ({ ...current, ...patch }));
  };
  const openPanel = (next: Panel) => {
    if (transitionLocked.current) return;
    if (next === 'map') markGuidance({ mapOpened: true });
    setPanel(next);
    setBattleRunning(false);
  };
  const showItemUse = (id: string) => {
    setItemImpact(id);
    window.setTimeout(() => setItemImpact(''), 850);
  };
  // Compare actual stats rather than lastEvent: combat and passive Luck can
  // overwrite the fear event. Save immediately, but reveal the result only
  // after the candle sequence, including fatal fear and combat outcomes.
  const applyResult = (
    previous: GameState, next: GameState, dialog?: DiscoveryModal,
    after?: () => void, action: { choiceId?: string; combatAction?: CombatAction } = {},
  ) => {
    if (transitionLocked.current) return;
    setGuidance(current => advanceGuidance(current, previous, next, action));
    const result = stageDiscoveries(previous, next, dialog);
    const commit = () => {
      persist(result);
      setDiscoveryDialog(result.pendingDiscovery ?? null);
      after?.();
    };
    if (next.fear > previous.fear) {
      transitionLocked.current = true;
      if (!saveGame(result)) notify('This browser could not keep a save file.');
      setToast('');
      setLucky(false);
      setPanel(null);
      setDiscoveryDialog(null);
      fearCommit.current = commit;
      setFearTransition({ fromFear: previous.fear, toFear: next.fear, eventId: Date.now() });
      if (soundEnabled) playTone([54, 42], 0.13, 0.06, 0.12, true);
    } else commit();
  };
  const finishFear = () => {
    const commit = fearCommit.current;
    fearCommit.current = null;
    transitionLocked.current = false;
    setFearTransition(null);
    commit?.();
  };
  const closeDiscovery = () => {
    if (!game || !discoveryDialog) return;
    if (discoveryDialog.kind === 'luck') { useLuck(); return; }
    if (discoveryDialog.kind === 'item') markGuidance({ itemTaken: true });
    if (discoveryDialog.kind === 'fragment') markGuidance({ fragmentAdded: true });
    const next = acceptDiscovery(game);
    persist(next);
    setDiscoveryDialog(next.pendingDiscovery ?? null);
  };
  const discoveryGuided = discoveryDialog?.kind === 'item' ? !guidance.itemTaken
    : discoveryDialog?.kind === 'fragment' ? !guidance.fragmentAdded : false;
  const itemUseVisual = itemImpact ? <div className="item-use-label" role="status">{getDisplayItem(game!, itemImpact)?.name ?? 'Item'} used</div> : null;
  const begin = (resume = false) => {
    setBattleRunning(false);
    const saved = resume ? loadGame() : null;
    if (!saved && !name.trim()) {
      setNameError('Enter a name before crossing the threshold.');
      return;
    }
    setNameError('');
    const next = saved || createGame(name.trim() || 'Unknown Guest');
    if (!saved && guidance.combat === 'active') markGuidance({ combat: 'done' });
    setGame(next);
    if (!saved) saveGame(next);
    setName(next.username);
    localStorage.setItem('blackthorn.username', next.username);
    setScreen('play');
    setPanel(null);
    setDiscoveryDialog(next.pendingDiscovery ?? null);
    setEndingStage(0);
    notify(resume && saved ? 'Your last visit returns to you.' : 'The manor has been waiting.');
  };
  const restart = () => {
    if (transitionLocked.current) return;
    if (!window.confirm('Leave this history and begin again? Your saved page will be replaced.')) return;
    setBattleRunning(false);
    const next = restartGame(game?.username || name || 'Unknown Guest');
    if (guidance.combat === 'active') markGuidance({ combat: 'done' });
    persist(next);
    setPanel(null);
    setDiscoveryDialog(null);
    setTransformation(false);
    setEndingStage(0);
    setScreen('play');
  };
  const save = () => {
    if (!game || transitionLocked.current) return;
    setBattleRunning(false);
    notify(saveGame(game) ? 'Progress sealed in the ledger.' : 'The ledger would not hold your story.');
  };
  const load = () => {
    if (transitionLocked.current) return;
    setBattleRunning(false);
    const saved = loadGame();
    if (!saved) { notify('No saved story is waiting.'); return; }
    setGame(saved);
    setName(saved.username);
    setScreen('play');
    setDiscoveryDialog(saved.pendingDiscovery ?? null);
    setEndingStage(0);
    notify('The last page returns.');
  };
  const moveTo = (roomId: string) => {
    if (!game || transitionLocked.current) return;
    const next = enterRoom(game, roomId);
    const passageItem = next.roomId !== game.roomId
      ? game.roomId === 'cellar' && roomId === 'secret-tunnel' ? 'lantern'
        : game.roomId === 'secret-tunnel' && roomId === 'ritual-chamber' ? 'rope' : undefined
      : undefined;
    if (passageItem) next.usedItems = [...new Set([...next.usedItems, passageItem])];
    applyResult(game, next, newReward(game, next, next.lastEvent?.message || ''), () => {
      if (passageItem) showItemUse(passageItem);
    });
    setPanel(null);
  };
  const makeChoice = (choice: StoryChoice) => {
    if (!game || transitionLocked.current) return;
    setGuidance(current => advanceGuidance(current, game, game, { choiceId: choice.id }));
    if (choice.requires && (!game.inventory.includes(choice.requires) || (choice.requires === 'matchbox' && (game.itemCharges.matchbox ?? 0) <= 0))) {
      setGame(current => current ? { ...current, knownLockedChoices: [...new Set([...(current.knownLockedChoices ?? []), choice.id])] } : current);
      setDiscoveryDialog({
        kind: 'locked',
        title: `THE ${pretty(choice.requires).toUpperCase()} IS NEEDED`,
        story: choice.requires === 'matchbox' && game.inventory.includes('matchbox')
          ? 'The matchbox is empty. Not even a spark remains.'
          : ITEM_LOCK_MESSAGES[choice.requires] || 'Something is missing. The house waits for you to discover what.',
      });
      return;
    }
    if (game.discoveries.includes(choice.id)) {
      const reward = getChoiceReward(choice.id);
      setDiscoveryDialog({
        kind: 'review',
        title: choice.label,
        story: getChoiceDiscoveryText(choice.id) || choice.description,
        itemId: reward.itemId,
        usedItemId: choice.requires,
      });
      return;
    }
    const next = interact(game, choice.id);
    let dialog: DiscoveryModal | undefined;
    if (next.phase !== 'dead' && next.discoveries.includes(choice.id)) {
      const story = getChoiceDiscoveryText(choice.id) || next.lastEvent?.message || choice.description;
      dialog = { ...(newReward(game, next, story) ?? { kind: 'discovery', title: 'DISCOVERY', story }), usedItemId: choice.requires };
    }
    applyResult(game, next, dialog, () => {
      if (choice.requires && next.discoveries.includes(choice.id)) showItemUse(choice.requires);
    }, { choiceId: choice.id });
  };
  const useLuck = () => {
    if (!game || transitionLocked.current) return;
    const next = testLuck(game);
    const freshOutcome = next.lastLuck !== game.lastLuck;
    const story = next.lastEvent?.message ?? '';
    applyResult(game, next, next.phase === 'dead' ? undefined : newReward(game, next, story)
      ?? { kind: 'discovery', title: freshOutcome && next.lastLuck?.success ? 'LUCK IS ON YOUR SIDE' : 'FATE ANSWERS', story });
  };
  const newReward = (previous: GameState, next: GameState, story: string): DiscoveryModal | undefined => {
    if (next.phase === 'dead' || next.phase === 'ending') return undefined;
    const rewards: DiscoveryModal[] = [
      ...next.inventory.filter(id => !previous.inventory.includes(id)).map(itemId => ({
        kind: 'item' as const, title: 'ITEM FOUND', story, itemId,
      })),
      ...next.clues.filter(id => !previous.clues.includes(id)).map(clueId => ({
        kind: 'fragment' as const, title: 'FAMILY FRAGMENT DISCOVERED', story, clueId,
      })),
      ...(next.pendingLuck ? [{ kind: 'luck' as const, title: next.pendingLuck.title, story: next.pendingLuck.story }] : []),
    ];
    const [first, ...following] = rewards;
    return first ? { ...first, following: following.length ? following : undefined } : undefined;
  };
  const takeCombatAction = (action: CombatAction, itemId?: string) => {
    if (!game || transitionLocked.current) return;
    if (action !== 'attack') setBattleRunning(false);
    const next = combatTurn(game, action, itemId);
    if (next.phase !== 'combat' || next.combat?.pauseReason || next.fear > game.fear) setBattleRunning(false);
    applyResult(game, next, newReward(game, next, next.lastEvent?.message || ''), () => {
      if (action === 'item' && itemId) {
        showItemUse(itemId);
      }
      const defeated = next.defeatedMonsters.find(id => !game.defeatedMonsters.includes(id));
      if (defeated && next.phase === 'playing') setVictory(`${getMonster(defeated)?.name ?? 'The creature'} is defeated. +100 MONSTER DEFEAT\n${next.lastCombatDialogue ?? ''}`);
      if (game.combat?.enemyPhase === 'human' && next.combat?.enemyPhase === 'demon') setTransformation(true);
      if (next.phase === 'ending') setEndingStage(0);
    }, { combatAction: action });
  };
  autoExchange.current = () => takeCombatAction('attack');
  const startBattle = () => {
    if (transitionLocked.current || discoveryDialog || transformation) return;
    setBattleRunning(true);
    takeCombatAction('attack');
  };
  const drinkPotion = (id: string) => {
    if (!game || transitionLocked.current) return;
    setBattleRunning(false);
    const next = usePotion(game, id);
    applyResult(game, next, next.phase === 'dead' ? undefined : {
      kind: 'examine', title: 'THE VIAL REVEALS ITSELF', itemId: id, story: next.lastEvent?.message ?? '',
    }, () => showItemUse(id));
  };
  const listen = () => {
    if (!game || transitionLocked.current) return;
    const next = {
      ...game,
      whisper: getRandomWhisper(game) || 'The walls have nothing to say.',
      whisperCount: game.whisperCount + 1,
    };
    persist(next);
    setWhisperHighlighted(true);
    window.setTimeout(() => setWhisperHighlighted(false), 1300);
  };

  if (screen === 'title') {
    return (
      <main className="title-screen">
        <div className="title-grain" />
        <header className="title-brand"><span className="brand-mark">B</span><span>BLACKTHORN <i>MANOR</i></span><span className="brand-rule" /></header>
        <div className="title-content">
          <section className="title-copy">
            <div className="eyebrow"><span className="red-dot" /> A story that remembers you</div>
            <h1>The house<br />is <em>awake.</em></h1>
            <p className="title-deck">The storm has sealed every door but one.<br />Your family name is already inside.</p>
            <label className="name-label" htmlFor="heir-name">ENTER THE NAME OF THE HEIR</label>
            <div className="name-entry">
             <input id="heir-name" value={name} onChange={event => { setName(event.target.value); setNameError(''); }} onKeyDown={event => event.key === 'Enter' && begin()} placeholder="Your name…" maxLength={24} aria-invalid={Boolean(nameError)} aria-describedby={nameError ? 'name-error' : undefined} />
              <button className="enter-button" onClick={() => begin()} aria-label="Enter the manor"><ArrowRight size={19} /></button>
            </div>
           {nameError && <p id="name-error" className="name-error" role="alert">{nameError}</p>}
            <div className="start-links">
              {loadGame() && <button className="text-action" onClick={() => begin(true)}><BookOpen size={15} /> Continue last visit</button>}
              <button className="text-action" onClick={() => document.getElementById('survivors')?.scrollIntoView({ behavior: 'smooth' })}>Hall of Survivors <ArrowRight size={13} /></button>
            </div>
            <p className="title-meta"><span>ONE HOUSE</span><b>·</b><span>ENDLESS HISTORIES</span></p>
          </section>
          <div className="manor-portrait" aria-label="A dark manor beneath a storm">
            <img className="title-manor-image" src={artForRoom('front-gate')} alt="Blackthorn Manor beyond the iron gate" />
            <div className="moon-disc" /><div className="portrait-fog fog-one" /><div className="portrait-fog fog-two" />
            <div className="mansion"><div className="roof roof-main" /><div className="roof roof-left" /><div className="roof roof-tower" /><div className="tower"><i /><i /><i /></div><div className="mansion-body"><span className="window win-a" /><span className="window win-b" /><span className="window win-c" /><span className="window win-d" /><span className="door" /></div><div className="wing wing-left"><span className="window" /><span className="window" /></div><div className="wing wing-right"><span className="window" /><span className="window" /></div></div>
            <div className="foreground-branch" /><div className="portrait-caption"><span>01 / THE BLACKTHORN ESTATE</span><span>EST. 1847 — STILL OCCUPIED</span></div><div className="art-frame" />
          </div>
        </div>
        <section className="survivors-section" id="survivors">
          <div><div className="eyebrow">THE NAMES THE HOUSE KEPT</div><h2>Hall of Survivors</h2><p>Some left. Some were let go.</p></div>
          <div className="survivor-list">{leaderboard.length ? leaderboard.slice(0, 10).map((entry, index) => <div className="survivor-row" key={`${entry.username}-${index}`}><span className="survivor-rank">{String(index + 1).padStart(2, '0')}</span><span>{entry.username || 'Unknown heir'}</span><span className="survivor-ending">{entry.ending || 'A night endured'} · {Number(entry.score || 0).toLocaleString()}</span></div>) : <div className="survivor-empty">No names yet. The first story is yours to leave behind.</div>}</div>
        </section>
        <footer className="title-footer"><span>BLACKTHORN MANOR</span><span>THE WHISPERS ARE NOT ALWAYS YOURS.</span><span>AN ENDLESS GAMEBOOK</span></footer>
      </main>
    );
  }

  if (!game || !room) return <main className="empty-recovery"><p>The story has slipped out of reach.</p><button className="primary-button" onClick={() => setScreen('title')}>Return to the threshold</button></main>;
  if (game.phase === 'ending') {
    const ending = game.ending || 'good';
    const trueEnding = ending === 'true';
    const endingArt = artForEnding(ending);
    const survivors = leaderboard.slice(0, 10);
    const judgement = trueEnding ? 'Worthy' : 'Survivor';
    return (
      <main className="ending-screen ending-sequence">
        {itemUseVisual}
        <div className="ending-progress"><span className={endingStage >= 0 ? 'current' : ''}>THE STORY</span><i /><span className={endingStage >= 1 ? 'current' : ''}>THE WHISPER</span><i /><span className={endingStage >= 2 ? 'current' : ''}>THE REVEAL</span><i /><span className={endingStage >= 3 ? 'current' : ''}>THE ACCOUNT</span><i /><span className={endingStage >= 4 ? 'current' : ''}>SURVIVORS</span></div>
        {endingStage === 0 && <>
          <div className="ending-seal"><Moon /></div><p className="eyebrow">ENDING NARRATIVE</p>
          <h1>{trueEnding ? 'The final page turns.' : 'The storm has passed.'}</h1>
          <p className="ending-copy">{trueEnding ? 'The diary ink fades. The family portraits lower their eyes, and the manor waits for you to speak.' : 'The Blackthorn blade finds its mark. You escape before dawn as the clouds part over the hill.'}</p>
          {game.lastCombatDialogue && <p className="ending-copy">{game.lastCombatDialogue}</p>}
          <button className="primary-button" onClick={() => setEndingStage(1)}>Continue <ArrowRight size={17} /></button>
        </>}
        {endingStage === 1 && <>
          <div className="ending-seal whisper-seal"><Volume2 /></div><p className="eyebrow">THE HOUSE SPEAKS</p>
          <h1 className="final-whisper">“{trueEnding ? 'Welcome home.' : 'The storm remembers.'}”</h1>
          <p className="ending-copy">{trueEnding ? 'For the first and only time, the House speaks clearly. The manor finally sleeps.' : 'The rain falls beyond the gate. The House keeps its silence.'}</p>
          <button className="primary-button" onClick={() => setEndingStage(2)}>See what remains <ArrowRight size={17} /></button>
        </>}
        {endingStage === 2 && <>
          {endingArt && <img className="ending-art" src={endingArt} alt="The Blackthorn Manor curse broken at dawn" />}
          <div className="ending-seal"><Moon /></div><p className="eyebrow">{trueEnding ? 'THE TRUE ENDING' : 'A BLACKTHORN STORY'}</p>
          <h1>{trueEnding ? 'The House remembers its heir.' : 'You escaped before dawn.'}</h1>
          <p className="ending-copy">{trueEnding ? 'You are the heir to Blackthorn Manor. The curse is broken, and the House has finally let you go.' : 'The Blackthorn blade has ended the curse for tonight. The manor remains behind you.'}</p>
          <button className="primary-button" onClick={() => setEndingStage(3)}>Open the Manor’s Account <ArrowRight size={17} /></button>
        </>}
        {endingStage === 3 && <>
          <p className="eyebrow">THE MANOR’S ACCOUNT</p><h1 className="account-title">{game.username}</h1>
          <div className="manor-account">
            <div><span>HEIR</span><b>{game.username}</b></div><div><span>ENDING</span><b>{trueEnding ? 'True Ending' : 'Escaped'}</b></div>
            <div><span>ROOMS REMEMBERED</span><b>{game.visitedRooms.length} / 13</b></div><div><span>FRAGMENTS RECOVERED</span><b>{game.clues.length}</b></div>
            <div><span>SECRETS UNEARTHED</span><b>{game.discoveries.length}</b></div><div><span>FEAR REMAINING</span><b>{game.fear} / 10</b></div>
            <div><span>THE HOUSE’S JUDGMENT</span><b>{judgement}</b></div><div><span>FINAL SCORE</span><b>{game.score.toLocaleString()}</b></div>
          </div>
          <div className="account-achievements"><span>ACHIEVEMENTS</span>{game.achievements.length ? game.achievements.map(id => <b key={id}>{pretty(id)}</b>) : <i>None earned this visit.</i>}</div>
          <button className="primary-button" onClick={() => setEndingStage(4)}>Read the Hall of Survivors <ArrowRight size={17} /></button>
        </>}
        {endingStage === 4 && <>
          <p className="eyebrow">THE NAMES THE HOUSE KEPT</p><h1>Hall of Survivors</h1>
          <div className="ending-leaderboard">{survivors.length ? survivors.map((entry, index) => <div className="survivor-row" key={`${entry.username}-${entry.time}-${index}`}><span className="survivor-rank">{String(index + 1).padStart(2, '0')}</span><span>{entry.username}</span><span className="survivor-ending">{entry.ending} · {Number(entry.score || 0).toLocaleString()}</span></div>) : <p className="panel-empty">No names yet. The first story is yours to leave behind.</p>}</div>
          <button className="primary-button" onClick={() => { const next = restartGame(game.username); setGame(next); saveGame(next); setEndingStage(0); setScreen('play'); }}>Begin another history <ArrowRight size={17} /></button>
          <button className="text-action centered" onClick={() => { setScreen('title'); setLeaderboard(getLeaderboard()); }}>Return to the threshold</button>
        </>}
      </main>
    );
  }
  if (game.phase === 'dead') {
    const title = game.deathWhisper || 'The house keeps what it is owed.';
    const terrorComplete = game.fear >= 10;
    return (
      <main className={`ending-screen death ${terrorComplete ? 'fear-ten-death' : ''}`}>
        {itemUseVisual}
        <div className="ending-seal"><Skull /></div>
        <p className="eyebrow">{terrorComplete ? 'THE TERROR BECOMES UNBEARABLE' : game.ending === 'bad' ? 'BAD ENDING · YOU WERE NOT READY' : 'THE HOUSE HAS CLAIMED YOU'}</p>
        <h1>GAME OVER</h1>
        <div className="death-candles" aria-label={terrorComplete ? 'All ten candle flames extinguished' : `${game.fear} fear candles lit`}>{Array.from({ length: 10 }, (_, index) => <span key={index} className={terrorComplete ? 'extinguished' : index < game.fear ? 'lit' : ''} />)}</div>
        <p className="ending-copy">{game.lastEvent?.message || 'The candle gutters. Somewhere beyond the dark, the house begins to tell your story without you.'}</p>
        <blockquote className="death-whisper"><span>THE HOUSE WHISPERS</span>“{title}”</blockquote>
        <div className="ending-stats"><span><small>ROOMS FOUND</small>{game.visitedRooms.length}</span><span><small>CLUES KEPT</small>{game.clues.length}</span><span><small>FINAL SCORE</small>{game.score.toLocaleString()}</span></div>
        {game.achievements.length > 0 && <div className="achievement-strip">{game.achievements.map(achievement => <span key={achievement}>{pretty(achievement)}</span>)}</div>}
        <button className="primary-button" onClick={() => { const next = restartGame(game.username); setGame(next); saveGame(next); setPanel(null); }}>Begin another history <ArrowRight size={17} /></button>
        <button className="text-action centered" onClick={() => { setScreen('title'); setLeaderboard(getLeaderboard()); }}>Return to the threshold</button>
      </main>
    );
  }

  if (game.phase === 'combat' && game.combat && monster) {
    return (
        <main aria-busy={Boolean(fearTransition)} className={`combat-screen fear-level-${game.fear} ${itemImpact ? `impact-${itemImpact}` : ''}`}>
        <header className="game-top">
          <button className="wordmark" onClick={() => !transitionLocked.current && setScreen('title')}><span className="brand-mark small">B</span> BLACKTHORN <i>MANOR</i></button>
          <span className="top-status"><span className="red-dot" /> THE HOUSE TURNS HOSTILE</span>
          <div className="top-actions"><button onClick={() => setSoundEnabled(value => !value)} aria-label={soundEnabled ? 'Mute audio cues' : 'Enable audio cues'}>{soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}<span>Sound</span></button><button onClick={save} aria-label="Save game"><Save size={16} /><span>Save</span></button><button onClick={load} aria-label="Load save"><BookOpen size={16} /><span>Load</span></button><button onClick={restart} aria-label="Restart"><ArrowLeft size={16} /><span>Restart</span></button></div>
        </header>
        <div className="combat-layout">
          <section className="combat-art">
            <div className="combat-portrait"><MonsterArt id={monster.id} name={monster.name} demonPhase={game.combat.enemyPhase === 'demon'} /></div>
            <div className="combat-art-shade" />
            <div className="monster-title"><span>YOU ARE NOT ALONE · ROUND {game.combat.round + 1}</span><h1>{monster.name}</h1><p>{monster.description}</p></div>
            <div className="combat-art-footer"><span>CONFRONTATION / {room.title.toUpperCase()}</span><span>{game.combat.enemyPhase === 'demon' ? 'THE SECOND FORM' : 'DO NOT LOOK AWAY'}</span></div>
          </section>
          <section className="combat-controls">
            <CombatControls game={game} running={battleRunning} guided={guidance.combat === 'active'} onAttack={startBattle}
              onPause={() => setBattleRunning(false)} onItem={id => takeCombatAction('item', id)} onFlee={() => takeCombatAction('flee')} />
          </section>
        </div>
        {victory && <div className="victory-backdrop"><section className="victory-card"><span className="eyebrow">THE ROOM HOLDS ITS BREATH</span><h2>It is over.</h2><p>{victory}</p><button className="primary-button" onClick={() => setVictory('')}>Return to the room <ArrowRight size={16} /></button></section></div>}
        {transformation && <div className="transformation-backdrop"><section className="transformation-card"><img src={artForMonster('lord-blackthorn', true)} alt="Lord Blackthorn transformed into his demon form" /><div><span className="eyebrow">THE HUMAN SHAPE BREAKS</span><h2>The eye at his throat opens.</h2><p>{combatDialogue('lord-blackthorn', 'demon', 'start')}</p><button className="primary-button" onClick={() => { setTransformation(false); setBattleRunning(true); }}>Continue Battle <ArrowRight size={16} /></button></div></section></div>}
        {discoveryDialog && <DiscoveryOverlay game={game} dialog={discoveryDialog} guided={discoveryGuided} onClose={closeDiscovery} />}
        {itemUseVisual}
        {fearTransition && <FearCinematic key={fearTransition.eventId} {...fearTransition} onComplete={finishFear} />}
        {lucky && <LuckyEffect />}
        {toast && <div className={`game-toast ${lucky ? 'lucky' : ''}`} role="status">{toast}</div>}
      </main>
    );
  }

  const items = game.inventory.map(id => getDisplayItem(game, id)).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const locks = knownLocks(game);
  const mapRooms = exits.map(id => getRoom(id)).filter((entry): entry is Room => Boolean(entry)
    && (isExitAvailable(game, entry!.id) || game.visitedRooms.includes(entry!.id))).slice(0, 4);
  return (
    <main aria-busy={Boolean(fearTransition)} className={`game-screen fear-level-${game.fear}`}>
      <header className="game-top">
        <button className="wordmark" onClick={() => !transitionLocked.current && setScreen('title')}><span className="brand-mark small">B</span> BLACKTHORN <i>MANOR</i></button>
        <div className="chapter-mark"><span>THE INHERITANCE</span><b>·</b><span>ROOM {String(game.visitedRooms.length).padStart(2, '0')} OF 13</span></div>
        <div className="top-actions"><button onClick={() => setSoundEnabled(value => !value)} aria-label={soundEnabled ? 'Mute audio cues' : 'Enable audio cues'}>{soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}<span>Sound</span></button><button onClick={save} aria-label="Save progress"><Save size={16} /><span>Save</span></button><button onClick={load} aria-label="Load saved game"><BookOpen size={16} /><span>Load</span></button><button onClick={restart} aria-label="Restart story"><ArrowLeft size={16} /><span>Restart</span></button></div>
      </header>
      <div className="game-grid">
        <aside className="character-rail">
          <div className="rail-heading"><span>THE HEIR</span><span className="tiny-rule" /></div>
          <div className="heir-initial">{game.username.slice(0, 1).toUpperCase()}</div><h2>{game.username}</h2><p className="heir-kicker">RETURNED BLOODLINE</p>
          <div className="stat-block" {...tooltip(TOOLTIPS.stamina)} tabIndex={0}><div className="stat-label"><span><Heart size={14} /> STAMINA</span><b>{game.stamina}</b></div><div className="pip-row">{Array.from({ length: 10 }, (_, index) => <i className={index < Math.ceil(game.stamina / 2.5) ? 'pip filled' : 'pip'} key={index} />)}</div></div>
          <div className="stat-block" {...tooltip(TOOLTIPS.skill)} tabIndex={0}><div className="stat-label"><span><Swords size={14} /> SKILL</span><b>{game.skill}</b></div><div className="strength-dash"><i style={{ width: `${Math.min(100, game.skill * 10)}%` }} /></div></div>
          <div className="stat-block" {...tooltip(TOOLTIPS.luck)} tabIndex={0}><div className="stat-label"><span><Sparkles size={14} /> LUCK</span><b>{game.luck}</b></div><div className="strength-dash luck-track"><i style={{ width: `${Math.min(100, game.luck * 10)}%` }} /></div></div>
          <div className="stat-block score-stat" {...tooltip(TOOLTIPS.score)} tabIndex={0}><div className="stat-label"><span>HOUSE SCORE</span><b>{game.score.toLocaleString()}</b></div></div>
           <FearCandles fear={game.fear} />
          <div className="rail-counts"><button onClick={() => setPanel('inventory')}><KeyRound size={15} /><span>Carried</span><b>{items.length}</b></button><button onClick={() => setPanel('clues')}><BookOpen size={15} /><span>Clues</span><b>{game.clues.length}</b></button><button onClick={() => setPanel('achievements')}><BadgeCheck size={15} /><span>Achievements</span><b>{game.achievements.length}</b></button><button {...tooltip(TOOLTIPS.testLuck)} onClick={useLuck}><Sparkles size={15} /><span>Test luck</span><b>{game.luck}</b></button></div>
        </aside>

        <section className="story-column">
          <div className="room-image"><RoomArt key={room.id} id={room.id} /><div className="room-image-overlay" /><div className="room-image-label"><span>BLACKTHORN ESTATE</span><span>—</span><span>{room.atmosphere.toUpperCase()}</span></div><button className={`map-trigger ${!guidance.mapOpened ? 'guidance-glow' : ''}`} title={!guidance.mapOpened ? 'Interactive Map' : undefined} onClick={() => openPanel('map')}><Map size={15} /> Manor map</button></div>
          <article className="story-card">
            <div className="story-meta"><span>{room.subtitle.toUpperCase()}</span><span className="story-line" /><span>VISIT {String(game.visitedRooms.filter(id => id === room.id).length).padStart(2, '0')}</span></div>
            <h1>{room.title}</h1><p className="story-copy">{room.description}</p>
            <div className="choice-list"><div className="choice-prompt">CHOOSE YOUR WAY</div>{currentChoices.map((choice: StoryChoice, index) => {
              const missing = choice.requires ? !game.inventory.includes(choice.requires) || (choice.requires === 'matchbox' && (game.itemCharges.matchbox ?? 0) <= 0) : false;
              const repeated = game.discoveries.includes(choice.id);
              const guided = !repeated && ((guidance.investigation === 'gate' && room.id === 'front-gate' && choice.id === 'gate-footprints')
                || (guidance.investigation === 'hall' && room.id === 'entrance-hall' && choice.id === 'hall-portraits'));
              return <button className={`story-choice ${guided ? 'guidance-glow' : ''} ${missing ? 'choice-locked' : ''} ${repeated ? 'choice-muted' : ''}`} key={choice.id} onClick={() => makeChoice(choice)}><span className="choice-index">0{index + 1}</span><span className="choice-body"><span className="choice-label">{choice.label}</span><small>{choice.description}{missing ? ' · The house keeps this from you' : repeated ? ' · Already explored — view discovery' : ''}</small></span>{missing ? <KeyRound size={16} /> : repeated ? <Eye size={16} /> : <ArrowRight size={17} />}</button>;
            })}</div>
            <div className="story-actions"><button {...tooltip(TOOLTIPS.rooms)} onClick={() => openPanel('map')}><Compass size={15} /> Find another room</button><button {...tooltip(TOOLTIPS.listen)} onClick={listen}><Volume2 size={15} /> Listen to the walls</button><button {...tooltip(TOOLTIPS.testLuck)} onClick={useLuck}><Sparkles size={15} /> Test your luck</button><button onClick={() => setSoundEnabled(value => !value)}>{soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />} Sound {soundEnabled ? 'on' : 'off'}</button></div>
          </article>
        </section>

        <aside className="right-rail">
          <div className="rail-heading"><span>THE MANOR</span><span className="tiny-rule" /></div>
          <div className="map-card"><div className="map-zoom-anchor"><div className="mini-map">
            <div className="map-room map-room-main active" title={`${room.title} — you are here`}><span>{room.title.toUpperCase()}</span>{locks.some(lock => lock.roomId === room.id) && <KeyRound className="map-lock" size={10} aria-label="Known locked interaction" />}</div>
            {mapRooms.map((target, index) => <button key={target.id} disabled={!isExitAvailable(game, target.id)} className={`map-room map-node node-${index} ${game.visitedRooms.includes(target.id) ? 'visited' : 'unexplored'}`} onClick={() => moveTo(target.id)} title={game.visitedRooms.includes(target.id) ? target.title : 'Unexplored passage'}>{game.visitedRooms.includes(target.id) ? target.title.toUpperCase() : 'UNKNOWN'}{locks.some(lock => lock.roomId === target.id) && <KeyRound className="map-lock" size={10} aria-label="Known locked interaction" />}</button>)}
            {mapRooms.map((target, index) => <div key={`route-${target.id}`} className={`map-path dynamic-path path-${index} ${game.visitedRooms.includes(target.id) ? '' : 'unexplored'}`} />)}
          </div></div><p className="map-current"><span className="red-dot" /> {room.title.toUpperCase()}</p>{locks.length > 0 && <div className="map-known-locks" aria-label="Known locked locations">{[...new Set(locks.map(lock => lock.roomId))].map(id => <span key={id} title={locks.filter(lock => lock.roomId === id).map(lock => lock.label).join(' · ')}><KeyRound size={11} />{getRoom(id)?.title}</span>)}</div>}<button className="map-open" onClick={() => openPanel('map')}>Open full map <ArrowRight size={14} /></button></div>
          <div className="side-section"><div className="side-heading"><span>POCKETS</span><button onClick={() => setPanel('inventory')}>VIEW</button></div>{items.length ? <ul className="pocket-list">{items.map(item => <li key={item.id}>{item.name}</li>)}</ul> : <p className="side-empty">Nothing but the name you came with.</p>}</div>
          <div className="side-section"><div className="side-heading"><span>FRAGMENTS</span><button onClick={() => setPanel('clues')}>VIEW</button></div>{game.clues.length ? game.clues.slice(0, 2).map(clue => <div className="clue-row" key={clue}><span className="clue-mark" /><span>{pretty(clue)}</span></div>) : <p className="side-empty">The family story is still obscured.</p>}</div>
          <div className={`whisper-note ${whisperHighlighted ? 'whisper-note-highlighted' : ''}`} aria-live="polite"><span>WHISPER {String(Math.min(10, game.whisperCount)).padStart(2, '0')} / 10</span><p>“{game.whisper || 'The house is listening.'}”</p><span className="whisper-byline">— THE HOUSE</span></div>
        </aside>
      </div>

      <nav className="mobile-tools" aria-label="Game tools"><button className={!guidance.mapOpened ? 'guidance-glow' : ''} title={!guidance.mapOpened ? 'Interactive Map' : undefined} onClick={() => openPanel('map')}><Map /><span>Map</span></button><button onClick={() => setPanel('inventory')}><KeyRound /><span>Items</span></button><button onClick={() => setPanel('clues')}><BookOpen /><span>Clues</span></button><button onClick={() => setPanel('achievements')}><BadgeCheck /><span>Deeds</span></button><button onClick={useLuck}><Sparkles /><span>Luck</span></button></nav>
      {panel && <div className="panel-backdrop" onClick={() => setPanel(null)}><section className="side-panel" role="dialog" aria-modal="true" aria-label={panel === 'map' ? 'The manor map' : panel === 'inventory' ? 'Inventory' : panel === 'clues' ? 'Clues' : 'Achievements'} onClick={event => event.stopPropagation()}><header><span>{panel === 'map' ? 'THE MANOR MAP' : panel === 'inventory' ? 'WHAT YOU CARRY' : panel === 'clues' ? 'FAMILY FRAGMENTS' : 'DEEDS THE HOUSE REMEMBERS'}</span><button onClick={() => setPanel(null)} aria-label="Close panel"><X /></button></header>
        {panel === 'map' ? <div className="full-map">{ROOMS.map((entry, index) => {
          const available = isExitAvailable(game, entry.id);
          const visited = game.visitedRooms.includes(entry.id);
          const current = game.roomId === entry.id;
          return <button key={entry.id} disabled={!available && !current} className={`full-map-room ${visited ? 'visited' : ''} ${current ? 'here' : ''}`} onClick={() => current ? setPanel(null) : moveTo(entry.id)}><span>{String(index + 1).padStart(2, '0')}</span><b>{entry.title}{locks.some(lock => lock.roomId === entry.id) && <KeyRound size={13} aria-label="Known locked interaction" style={{ marginLeft: 8 }} />}</b><small>{current ? 'YOU ARE HERE' : available ? 'PASSAGE OPEN' : visited ? 'NO OPEN PASSAGE' : 'UNREVEALED'}</small></button>;
         })}</div> : panel === 'inventory' ? <div className="panel-items inventory-items">{items.length ? items.map(item => {
           const legendary = ['blackthorn-dagger', 'red-gem', 'family-seal-ring', 'ancient-diary'].includes(item.id);
           const charges = game.itemCharges[item.id];
           const used = !legendary && (item.id === 'matchbox' || item.id === 'rusty-revolver'
             ? (charges ?? (item.id === 'matchbox' ? 7 : 1)) <= 0
             : game.usedItems.includes(item.id));
           const chargeText = item.id.endsWith('-potion') ? (charges === 0 ? 'Empty vial' : 'One sealed dose') : item.id === 'matchbox' ? `${charges ?? 7} matches remain` : item.id === 'rusty-revolver' ? `${charges ?? 1} round${charges === 1 ? '' : 's'} remain` : '';
           const description = item.id === 'matchbox' ? `${charges ?? 7} dry matches remain.` : item.id === 'rusty-revolver' && used ? 'The single chamber is empty.' : item.description;
           return <article key={item.id} className={`inventory-item ${used ? 'used' : ''} ${legendary ? 'legendary-item' : ''}`}><div className="inventory-art"><ItemArt id={item.id} /></div><div><b>{item.name}</b><p>{description}</p>{chargeText && <small className="item-charge">{chargeText}</small>}{used && <small className="used-stamp">USED</small>}{legendary && <small className="legendary-stamp">LEGENDARY</small>}<button className="inventory-examine" aria-label={`Examine ${item.name}`} onClick={() => setDiscoveryDialog({ kind: 'examine', title: 'WHAT YOU CARRY', story: description, itemId: item.id })}>Examine <Eye size={12} /></button>{item.id.endsWith('-potion') && <button className="inventory-examine" disabled={charges === 0} onClick={() => drinkPotion(item.id)}>Use potion</button>}</div></article>;
         }) : <div className="panel-empty">Your pockets are empty.<br />The house has not offered anything yet.</div>}</div> : panel === 'clues' ? <div className="panel-items">{game.clues.length ? game.clues.map(clue => <article key={clue}><BookOpen /><div><b>{pretty(clue)}</b><p>{game.discoveries.length ? 'A fragment preserved from this visit to Blackthorn Manor.' : 'A trace in the family history.'}</p></div></article>) : <div className="panel-empty">No fragments found.<br />Every room has a version of the truth.</div>}</div> : <div className="panel-items">{['manor-explorer', 'ghost-hunter', 'fortunes-favorite', 'fearless', 'true-heir', 'blackthorn-slayer'].map(id => <article key={id} className={game.achievements.includes(id) ? 'earned-achievement' : 'locked-achievement'}><BadgeCheck /><div><b>{pretty(id)}</b><p>{game.achievements.includes(id) ? 'The House has marked this deed.' : 'The House has not yet been forced to remember this.'}</p></div></article>)}</div>}
      </section></div>}
      {fearTransition && <FearCinematic key={fearTransition.eventId} {...fearTransition} onComplete={finishFear} />}
      {lucky && <LuckyEffect />}
      {victory && <div className="victory-backdrop"><section className="victory-card"><span className="eyebrow">THE ROOM HOLDS ITS BREATH</span><h2>It is over.</h2><p>{victory}</p><button className="primary-button" onClick={() => setVictory('')}>Return to the room <ArrowRight size={16} /></button></section></div>}
      {discoveryDialog && <DiscoveryOverlay game={game} dialog={discoveryDialog} guided={discoveryGuided} onClose={closeDiscovery} />}
      {itemUseVisual}
      {toast && <div className={`game-toast ${lucky ? 'lucky' : ''}`} role="status">{toast}</div>}
    </main>
  );
}

function LuckyEffect() {
  return <div className="lucky-flash" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} style={{ '--particle': index } as CSSProperties & { '--particle': number }} />)}</div>;
}

function RoomArt({ id }: { id: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [id]);
  const src = artForRoom(id);
  if (src && !failed) return <img className="room-art-img" src={src} onError={() => setFailed(true)} alt="" />;
  return <div className="room-placeholder"><div className="placeholder-arch"><span /><i /><i /><i /></div><span className="placeholder-caption">THE ROOM HAS NO FACE YET</span></div>;
}

function FearCandles({ fear }: { fear: number }) {
  return <div className={`fear-card fear-tension-${fear >= 7 ? 'high' : fear >= 4 ? 'rising' : 'low'}`} {...tooltip(TOOLTIPS.fear)} tabIndex={0} aria-label={`Fear ${fear} of 10`}>
    <div className="fear-caption"><span>FEAR</span><span>{fear} / 10</span></div>
    <div className="fear-candles" role="img" aria-label={`${10 - fear} of 10 candle flames remain`}>
      {Array.from({ length: 10 }, (_, index) => <span key={index} style={{ '--candle-index': index } as React.CSSProperties} className={`candle-slot ${index < 10 - fear ? 'lit' : 'extinguished'}`}><i /><b className="wax-drips" /></span>)}
    </div>
    <p>{fear >= 9 ? 'One fragile light remains.' : fear >= 7 ? 'A heartbeat answers yours.' : fear >= 4 ? 'The walls draw closer.' : 'Ten flames stand between you and the dark.'}</p>
  </div>;
}

function MonsterArt({ id, name, demonPhase = false }: { id: string; name: string; demonPhase?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [id, demonPhase]);
  const src = artForMonster(id, demonPhase);
  if (src && !failed) return <img className="monster-art-img" src={src} onError={() => setFailed(true)} alt={name} />;
  return <div className="monster-placeholder"><div className="monster-silhouette"><i /><b /><span /></div><div className="placeholder-ornament">✦</div></div>;
}
