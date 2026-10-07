import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import {
  combatTurn, createGame, enterRoom, getItem, getLeaderboard, getMonster, getRandomWhisper,
  getRoom, interact, isExitAvailable, loadGame, restartGame, saveGame, submitScore, testLuck,
  type CombatAction, type GameState,
} from '@/game/engine';
import { ROOMS, type Room, type StoryChoice } from '@/game/content';
import {
  ArrowLeft, ArrowRight, BadgeCheck, BookOpen, Compass, Heart, KeyRound, Map, Moon, Save,
  Shield, Skull, Sparkles, Swords, Volume2, VolumeX, Wind, X,
} from 'lucide-react';
import './manor.css';

type Panel = 'map' | 'inventory' | 'clues' | 'achievements' | null;
type Entry = { username?: string; ending?: string; score?: number; time?: string; fear?: number; monstersDefeated?: number };
const pretty = (id: string) => id.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
const slug = (id: string) => id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export default function App() {
  const [screen, setScreen] = useState<'title' | 'play'>('title');
  const [game, setGame] = useState<GameState | null>(null);
  const [name, setName] = useState(() => localStorage.getItem('blackthorn.username') || '');
  const [nameError, setNameError] = useState('');
  const [leaderboard, setLeaderboard] = useState<Entry[]>([]);
  const [panel, setPanel] = useState<Panel>(null);
  const [toast, setToast] = useState('');
  const [lucky, setLucky] = useState(false);
  const [whisperLine, setWhisperLine] = useState('');
  const [victory, setVictory] = useState('');
  const [itemImpact, setItemImpact] = useState('');
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

  useEffect(() => {
    if (!game) return;
    if (game.lastEvent?.message) {
      setToast(game.lastEvent.message);
      window.setTimeout(() => setToast(current => current === game.lastEvent?.message ? '' : current), 3000);
    }
    if (game.lastEvent?.type === 'luck') {
      setLucky(true);
      window.setTimeout(() => setLucky(false), 1400);
      const eventKey = `${game.lastEvent.message}:${game.luckSuccesses}`;
      if (soundEnabled && lastSoundEvent.current !== eventKey) {
        lastSoundEvent.current = eventKey;
        playTone([784, 988, 1175], 0.1, 0.045);
      }
    }
  }, [game, soundEnabled]);

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
  const begin = (resume = false) => {
    const saved = resume ? loadGame() : null;
    if (!saved && !name.trim()) {
      setNameError('Enter a name before crossing the threshold.');
      return;
    }
    setNameError('');
    const next = saved || createGame(name.trim() || 'Unknown Guest');
    setGame(next);
    if (!saved) saveGame(next);
    setName(next.username);
    localStorage.setItem('blackthorn.username', next.username);
    setScreen('play');
    setPanel(null);
    notify(resume && saved ? 'Your last visit returns to you.' : 'The manor has been waiting.');
  };
  const restart = () => {
    if (!window.confirm('Leave this history and begin again? Your saved page will be replaced.')) return;
    const next = restartGame(game?.username || name || 'Unknown Guest');
    persist(next);
    setPanel(null);
    setScreen('play');
  };
  const save = () => {
    if (!game) return;
    notify(saveGame(game) ? 'Progress sealed in the ledger.' : 'The ledger would not hold your story.');
  };
  const load = () => {
    const saved = loadGame();
    if (!saved) { notify('No saved story is waiting.'); return; }
    setGame(saved);
    setName(saved.username);
    setScreen('play');
    notify('The last page returns.');
  };
  const moveTo = (roomId: string) => {
    if (!game) return;
    persist(enterRoom(game, roomId));
    setPanel(null);
  };
  const makeChoice = (choice: StoryChoice) => {
    if (!game) return;
    persist(interact(game, choice.id));
  };
  const useLuck = () => {
    if (!game) return;
    persist(testLuck(game));
  };
  const takeCombatAction = (action: CombatAction, itemId?: string) => {
    if (!game) return;
    const next = combatTurn(game, action, itemId);
    if (action === 'item' && itemId) {
      setItemImpact(itemId);
      window.setTimeout(() => setItemImpact(''), 850);
    }
    if (next.phase === 'playing' && next.lastEvent?.message.includes('is defeated')) {
      setVictory(next.lastEvent.message);
    }
    persist(next);
  };
  const listen = () => {
    if (!game) return;
    setWhisperLine(getRandomWhisper(game) || 'The walls have nothing to say.');
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
            <div className="moon-disc" /><div className="portrait-fog fog-one" /><div className="portrait-fog fog-two" />
            <div className="mansion"><div className="roof roof-main" /><div className="roof roof-left" /><div className="roof roof-tower" /><div className="tower"><i /><i /><i /></div><div className="mansion-body"><span className="window win-a" /><span className="window win-b" /><span className="window win-c" /><span className="window win-d" /><span className="door" /></div><div className="wing wing-left"><span className="window" /><span className="window" /></div><div className="wing wing-right"><span className="window" /><span className="window" /></div></div>
            <div className="foreground-branch" /><div className="portrait-caption"><span>01 / THE BLACKTHORN ESTATE</span><span>EST. 1847 — STILL OCCUPIED</span></div><div className="art-frame" />
          </div>
        </div>
        <section className="survivors-section" id="survivors">
          <div><div className="eyebrow">THE NAMES THE HOUSE KEPT</div><h2>Hall of Survivors</h2><p>Some left. Some were let go.</p></div>
         <div className="survivor-list">{leaderboard.length ? leaderboard.slice(0, 10).map((entry, index) => <div className="survivor-row" key={`${entry.username}-${index}`}><span className="survivor-rank">0{index + 1}</span><span>{entry.username || 'Unknown heir'}</span><span className="survivor-ending">{entry.ending || 'A night endured'} · {Number(entry.score || 0).toLocaleString()}</span></div>) : <div className="survivor-empty">No names yet. The first story is yours to leave behind.</div>}</div>
        </section>
        <footer className="title-footer"><span>BLACKTHORN MANOR</span><span>THE WHISPERS ARE NOT ALWAYS YOURS.</span><span>AN ENDLESS GAMEBOOK</span></footer>
      </main>
    );
  }

  if (!game || !room) return <main className="empty-recovery"><p>The story has slipped out of reach.</p><button className="primary-button" onClick={() => setScreen('title')}>Return to the threshold</button></main>;
  if (game.phase === 'dead' || game.phase === 'ending') {
    const title = game.phase === 'dead' ? game.deathWhisper || 'The house keeps what it is owed.' : game.ending === 'true' ? 'The house remembers its heir.' : 'The storm breaks at last.';
    return (
      <main className={`ending-screen ${game.phase === 'dead' ? 'death' : ''}`}>
        <div className="ending-seal">{game.phase === 'dead' ? <Skull /> : <Moon />}</div>
        <p className="eyebrow">{game.phase === 'dead' ? 'THE TERROR BECOMES UNBEARABLE' : game.ending === 'true' ? 'THE TRUE ENDING' : 'A BLACKTHORN STORY'}</p>
        <h1>{game.phase === 'dead' ? 'GAME OVER' : title}</h1>
        {game.phase === 'dead' && <div className="death-candles" aria-label="All ten candle flames extinguished">{Array.from({ length: 10 }, (_, index) => <span key={index} />)}</div>}
        <p className="ending-copy">{game.lastEvent?.message || (game.phase === 'dead' ? 'The candle gutters. Somewhere beyond the dark, the house begins to tell your story without you.' : game.ending === 'true' ? 'You are the heir. The House speaks clearly, for the first and only time: “Welcome home.” The manor finally sleeps.' : 'The Blackthorn blade finds its mark. You escape before dawn as the storm breaks over the hill.')}</p>
        {game.phase === 'dead' && <blockquote className="death-whisper"><span>THE HOUSE WHISPERS</span>“{title}”</blockquote>}
        <div className="ending-stats"><span><small>ROOMS FOUND</small>{game.visitedRooms.length}</span><span><small>CLUES KEPT</small>{game.clues.length}</span><span><small>FINAL SCORE</small>{game.score.toLocaleString()}</span></div>
        {game.achievements.length > 0 && <div className="achievement-strip">{game.achievements.map(achievement => <span key={achievement}>{pretty(achievement)}</span>)}</div>}
        <button className="primary-button" onClick={() => { const next = restartGame(game.username); setGame(next); saveGame(next); setPanel(null); }}>Begin another history <ArrowRight size={17} /></button>
        <button className="text-action centered" onClick={() => { setScreen('title'); setLeaderboard(getLeaderboard()); }}>Return to the threshold</button>
      </main>
    );
  }

  if (game.phase === 'combat' && game.combat && monster) {
    const weapons = ['blackthorn-dagger', 'rusty-revolver', 'lantern', 'silver-crucifix'];
    const artName = monster.id === 'butler' ? 'mad-caretaker' : monster.id;
    return (
        <main className={`combat-screen fear-level-${game.fear} ${itemImpact ? `impact-${itemImpact}` : ''}`}>
        <header className="game-top">
          <button className="wordmark" onClick={() => setScreen('title')}><span className="brand-mark small">B</span> BLACKTHORN <i>MANOR</i></button>
          <span className="top-status"><span className="red-dot" /> THE HOUSE TURNS HOSTILE</span>
          <div className="top-actions"><button onClick={() => setSoundEnabled(value => !value)} aria-label={soundEnabled ? 'Mute audio cues' : 'Enable audio cues'}>{soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}<span>Sound</span></button><button onClick={save} aria-label="Save game"><Save size={16} /><span>Save</span></button><button onClick={load} aria-label="Load save"><BookOpen size={16} /><span>Load</span></button><button onClick={restart} aria-label="Restart"><ArrowLeft size={16} /><span>Restart</span></button></div>
        </header>
        <div className="combat-layout">
          <section className="combat-art">
            <MonsterArt id={artName} name={monster.name} />
            <div className="combat-art-shade" />
            <div className="monster-title"><span>YOU ARE NOT ALONE · ROUND {game.combat.round + 1}</span><h1>{monster.name}</h1><p>{monster.description}</p></div>
            <div className="combat-art-footer"><span>CONFRONTATION / {room.title.toUpperCase()}</span><span>{game.combat.enemyPhase === 'demon' ? 'THE SECOND FORM' : 'DO NOT LOOK AWAY'}</span></div>
          </section>
          <section className="combat-controls">
            <div className="eyebrow">YOUR NEXT BREATH</div><h2>What will you do?</h2>
            <div className="combat-vitals"><span><Heart /> STAMINA <b>{game.stamina}</b></span><span><Shield /> ENEMY <b>{game.combat.enemyStamina}</b></span><span><Swords /> SKILL <b>{game.skill}</b></span><span><Sparkles /> LUCK <b>{game.luck}</b></span><span className="combat-fear">FEAR <b>{game.fear} / 10</b></span></div>
            {game.combat.round > 0 && <div key={game.combat.round} className="dice-roll" aria-live="polite"><span>YOU <b>{game.combat.lastPlayerRoll ?? '—'}</b></span><i>SKILL + 2D6</i><span>THE HOUSE <b>{game.combat.lastEnemyRoll ?? '—'}</b></span></div>}
            {game.lastEvent?.type === 'damage' && game.lastEvent.amount && <div key={`${game.combat.round}-${game.lastEvent.amount}-${game.lastEvent.target}`} className={`damage-indicator ${game.lastEvent.target || 'enemy'}`}>−{game.lastEvent.amount}<small>{game.lastEvent.target === 'player' ? 'YOUR STAMINA' : 'ENEMY STAMINA'}</small></div>}
            <button className="combat-action" onClick={() => takeCombatAction('attack')}><Swords /><span><b>Attack</b><small>Skill + 2D6. The higher roll strikes.</small></span><ArrowRight /></button>
            <button className="combat-action" onClick={() => takeCombatAction('flee')}><Wind /><span><b>Flee</b><small>Find the nearest open passage.</small></span><ArrowRight /></button>
            <div className="combat-log" aria-live="polite">{game.combat.log.slice(-3).map((line, index) => <p key={`${index}-${line}`}>{line}</p>)}</div>
            <div className="combat-items"><p>WEAPONS & OBJECTS</p>{game.inventory.length ? game.inventory.map(id => {
              const item = getItem(id);
              const canStrike = weapons.includes(id);
              return item ? <button key={id} disabled={!canStrike} title={canStrike ? `Use ${item.name}` : 'This cannot harm a creature'} onClick={() => takeCombatAction('item', id)}><KeyRound size={15} /> {item.name}{!canStrike && <small> · NO USE</small>}</button> : null;
            }) : <span className="empty-weapon">Nothing in hand but the dark.</span>}</div>
            <button className="luck-button" onClick={() => takeCombatAction('luck')}><Sparkles size={16} /> Test your luck</button>
            <p className="monster-special">{monster.special}</p>
          </section>
        </div>
        {victory && <div className="victory-backdrop"><section className="victory-card"><span className="eyebrow">THE ROOM HOLDS ITS BREATH</span><h2>It is over.</h2><p>{victory}</p><button className="primary-button" onClick={() => setVictory('')}>Return to the room <ArrowRight size={16} /></button></section></div>}
        <FearEffects game={game} />
        {lucky && <LuckyEffect />}
        {toast && <div className={`game-toast ${lucky ? 'lucky' : ''}`} role="status">{toast}</div>}
      </main>
    );
  }

  const items = game.inventory.map(id => getItem(id)).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const accessibleRooms = exits.map(id => getRoom(id)).filter((entry): entry is Room => entry !== undefined && isExitAvailable(game, entry.id));
  return (
    <main className={`game-screen fear-level-${game.fear}`}>
      <header className="game-top">
        <button className="wordmark" onClick={() => setScreen('title')}><span className="brand-mark small">B</span> BLACKTHORN <i>MANOR</i></button>
        <div className="chapter-mark"><span>THE INHERITANCE</span><b>·</b><span>ROOM {String(game.visitedRooms.length).padStart(2, '0')} OF 13</span></div>
        <div className="top-actions"><button onClick={() => setSoundEnabled(value => !value)} aria-label={soundEnabled ? 'Mute audio cues' : 'Enable audio cues'}>{soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}<span>Sound</span></button><button onClick={save} aria-label="Save progress"><Save size={16} /><span>Save</span></button><button onClick={load} aria-label="Load saved game"><BookOpen size={16} /><span>Load</span></button><button onClick={restart} aria-label="Restart story"><ArrowLeft size={16} /><span>Restart</span></button></div>
      </header>
      <div className="game-grid">
        <aside className="character-rail">
          <div className="rail-heading"><span>THE HEIR</span><span className="tiny-rule" /></div>
          <div className="heir-initial">{game.username.slice(0, 1).toUpperCase()}</div><h2>{game.username}</h2><p className="heir-kicker">RETURNED BLOODLINE</p>
          <div className="stat-block"><div className="stat-label"><span><Heart size={14} /> STAMINA</span><b>{game.stamina} / 25</b></div><div className="pip-row">{Array.from({ length: 10 }, (_, index) => <i className={index < Math.ceil(game.stamina / 2.5) ? 'pip filled' : 'pip'} key={index} />)}</div></div>
          <div className="stat-block"><div className="stat-label"><span><Swords size={14} /> SKILL</span><b>{game.skill}</b></div><div className="strength-dash"><i style={{ width: `${game.skill * 10}%` }} /></div></div>
          <div className="stat-block"><div className="stat-label"><span><Sparkles size={14} /> LUCK</span><b>{game.luck}</b></div><div className="strength-dash luck-track"><i style={{ width: `${game.luck * 10}%` }} /></div></div>
          <div className="stat-block score-stat"><div className="stat-label"><span>HOUSE SCORE</span><b>{game.score.toLocaleString()}</b></div></div>
          <div className="fear-card" aria-label={`Fear ${game.fear} of 10`}><div className="fear-caption"><span>FEAR</span><span>{game.fear} / 10</span></div><div className="fear-candles" role="img" aria-label={`${10 - game.fear} of 10 candle flames remain`}>{Array.from({ length: 10 }, (_, index) => <span className={`candle-slot ${index < 10 - game.fear ? 'lit' : 'extinguished'}`} key={index}><i /></span>)}</div><p>{game.fear >= 9 ? 'The room bends at the edges.' : game.fear >= 7 ? 'A heartbeat answers yours.' : game.fear >= 4 ? 'The walls draw closer.' : 'Ten flames stand between you and the dark.'}</p></div>
          <div className="rail-counts"><button onClick={() => setPanel('inventory')}><KeyRound size={15} /><span>Carried</span><b>{items.length}</b></button><button onClick={() => setPanel('clues')}><BookOpen size={15} /><span>Clues</span><b>{game.clues.length}</b></button><button onClick={() => setPanel('achievements')}><BadgeCheck size={15} /><span>Achievements</span><b>{game.achievements.length}</b></button><button onClick={useLuck}><Sparkles size={15} /><span>Test luck</span><b>{game.luck}</b></button></div>
        </aside>

        <section className="story-column">
          <div className="room-image"><RoomArt key={room.id} id={room.id} /><div className="room-image-overlay" /><div className="room-image-label"><span>BLACKTHORN ESTATE</span><span>—</span><span>{room.atmosphere.toUpperCase()}</span></div><button className="map-trigger" onClick={() => setPanel('map')}><Map size={15} /> Manor map</button></div>
          <article className="story-card">
            <div className="story-meta"><span>{room.subtitle.toUpperCase()}</span><span className="story-line" /><span>VISIT {String(game.visitedRooms.filter(id => id === room.id).length).padStart(2, '0')}</span></div>
            <h1>{room.title}</h1><p className="story-copy">{room.description}</p>
            {game.whisper && <blockquote><span>THE HOUSE WHISPERS</span>{game.whisper}</blockquote>}
            {whisperLine && <blockquote><span>A VOICE IN THE WALL</span>{whisperLine}</blockquote>}
            <div className="choice-list"><div className="choice-prompt">CHOOSE YOUR WAY</div>{currentChoices.map((choice: StoryChoice, index) => {
              const missing = choice.requires ? !game.inventory.includes(choice.requires) : false;
              const repeated = game.discoveries.includes(choice.id);
              return <button className={`story-choice ${missing || repeated ? 'choice-muted' : ''}`} key={choice.id} disabled={missing || repeated} onClick={() => makeChoice(choice)}><span className="choice-index">0{index + 1}</span><span className="choice-body"><span className="choice-label">{choice.label}</span><small>{choice.description}{choice.requires ? ` · Needs ${pretty(choice.requires)}` : ''}{repeated ? ' · Already explored' : ''}</small></span>{missing ? <KeyRound size={16} /> : <ArrowRight size={17} />}</button>;
            })}</div>
            <div className="story-actions"><button onClick={() => setPanel('map')}><Compass size={15} /> Find another room</button><button onClick={listen}><Volume2 size={15} /> Listen to the walls</button><button onClick={useLuck}><Sparkles size={15} /> Test your luck</button><button onClick={() => setSoundEnabled(value => !value)}>{soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />} Sound {soundEnabled ? 'on' : 'off'}</button></div>
          </article>
        </section>

        <aside className="right-rail">
          <div className="rail-heading"><span>THE MANOR</span><span className="tiny-rule" /></div>
          <div className="map-card"><div className="mini-map">
            <div className="map-room map-room-main active"><span>{room.title.toUpperCase()}</span></div>
            {accessibleRooms.slice(0, 4).map((target, index) => <button key={target.id} className={`map-room map-node node-${index}`} onClick={() => moveTo(target.id)} title={`Enter ${target.title}`}>{game.visitedRooms.includes(target.id) ? target.title.toUpperCase() : 'UNKNOWN'}</button>)}
            {accessibleRooms.slice(0, 4).map((target, index) => <div key={`route-${target.id}`} className={`map-path dynamic-path path-${index}`} />)}
          </div><p className="map-current"><span className="red-dot" /> {room.title.toUpperCase()}</p><button className="map-open" onClick={() => setPanel('map')}>Open full map <ArrowRight size={14} /></button></div>
          <div className="side-section"><div className="side-heading"><span>POCKETS</span><button onClick={() => setPanel('inventory')}>VIEW</button></div>{items.length ? items.slice(0, 3).map(item => <div className="object-row" key={item.id}><span className="object-icon"><KeyRound size={14} /></span><span>{item.name}</span></div>) : <p className="side-empty">Nothing but the name you came with.</p>}</div>
          <div className="side-section"><div className="side-heading"><span>FRAGMENTS</span><button onClick={() => setPanel('clues')}>VIEW</button></div>{game.clues.length ? game.clues.slice(0, 2).map(clue => <div className="clue-row" key={clue}><span className="clue-mark" /><span>{pretty(clue)}</span></div>) : <p className="side-empty">The family story is still obscured.</p>}</div>
          <div className="whisper-note"><span>WHISPER / {String(game.visitedRooms.length).padStart(2, '0')}</span><p>“{game.whisper || 'The house is listening.'}”</p><span className="whisper-byline">— A VOICE IN THE WALL</span></div>
        </aside>
      </div>

      <nav className="mobile-tools" aria-label="Game tools"><button onClick={() => setPanel('map')}><Map /><span>Map</span></button><button onClick={() => setPanel('inventory')}><KeyRound /><span>Items</span></button><button onClick={() => setPanel('clues')}><BookOpen /><span>Clues</span></button><button onClick={() => setPanel('achievements')}><BadgeCheck /><span>Deeds</span></button><button onClick={useLuck}><Sparkles /><span>Luck</span></button></nav>
      {panel && <div className="panel-backdrop" onClick={() => setPanel(null)}><section className="side-panel" role="dialog" aria-modal="true" aria-label={panel === 'map' ? 'The manor map' : panel === 'inventory' ? 'Inventory' : panel === 'clues' ? 'Clues' : 'Achievements'} onClick={event => event.stopPropagation()}><header><span>{panel === 'map' ? 'THE MANOR MAP' : panel === 'inventory' ? 'WHAT YOU CARRY' : panel === 'clues' ? 'FAMILY FRAGMENTS' : 'DEEDS THE HOUSE REMEMBERS'}</span><button onClick={() => setPanel(null)} aria-label="Close panel"><X /></button></header>
        {panel === 'map' ? <div className="full-map">{ROOMS.map((entry, index) => {
          const available = isExitAvailable(game, entry.id);
          const visited = game.visitedRooms.includes(entry.id);
          const current = game.roomId === entry.id;
          return <button key={entry.id} disabled={!available && !current} className={`full-map-room ${visited ? 'visited' : ''} ${current ? 'here' : ''}`} onClick={() => current ? setPanel(null) : moveTo(entry.id)}><span>{String(index + 1).padStart(2, '0')}</span><b>{entry.title}</b><small>{current ? 'YOU ARE HERE' : available ? 'PASSAGE OPEN' : visited ? 'NO OPEN PASSAGE' : 'UNREVEALED'}</small></button>;
         })}</div> : panel === 'inventory' ? <div className="panel-items">{items.length ? items.map(item => <article key={item.id}><KeyRound /><div><b>{item.name}</b><p>{item.description}</p></div></article>) : <div className="panel-empty">Your pockets are empty.<br />The house has not offered anything yet.</div>}</div> : panel === 'clues' ? <div className="panel-items">{game.clues.length ? game.clues.map(clue => <article key={clue}><BookOpen /><div><b>{pretty(clue)}</b><p>{game.discoveries.length ? 'A fragment preserved from this visit to Blackthorn Manor.' : 'A trace in the family history.'}</p></div></article>) : <div className="panel-empty">No fragments found.<br />Every room has a version of the truth.</div>}</div> : <div className="panel-items">{['manor-explorer', 'ghost-hunter', 'fortunes-favorite', 'fearless', 'true-heir', 'blackthorn-slayer'].map(id => <article key={id} className={game.achievements.includes(id) ? 'earned-achievement' : 'locked-achievement'}><BadgeCheck /><div><b>{pretty(id)}</b><p>{game.achievements.includes(id) ? 'The House has marked this deed.' : 'The House has not yet been forced to remember this.'}</p></div></article>)}</div>}
      </section></div>}
      <FearEffects game={game} />
      {lucky && <LuckyEffect />}
      {victory && <div className="victory-backdrop"><section className="victory-card"><span className="eyebrow">THE ROOM HOLDS ITS BREATH</span><h2>It is over.</h2><p>{victory}</p><button className="primary-button" onClick={() => setVictory('')}>Return to the room <ArrowRight size={16} /></button></section></div>}
      {toast && <div className={`game-toast ${lucky ? 'lucky' : ''}`} role="status">{toast}</div>}
    </main>
  );
}

function FearEffects({ game }: { game: GameState }) {
  if (game.lastEvent?.type !== 'fear' || !game.lastEvent.amount) return null;
  return <div className="fear-flash" key={game.fearPulse} aria-hidden="true"><span>+{game.lastEvent.amount} FEAR</span></div>;
}

function LuckyEffect() {
  return <div className="lucky-flash" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} style={{ '--particle': index } as CSSProperties & { '--particle': number }} />)}</div>;
}

function RoomArt({ id }: { id: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [id]);
  if (!failed) return <img className="room-art-img" src={`/images/${slug(id)}.jpg`} onError={() => setFailed(true)} alt="" />;
  return <div className="room-placeholder"><div className="placeholder-arch"><span /><i /><i /><i /></div><span className="placeholder-caption">THE ROOM HAS NO FACE YET</span></div>;
}

function MonsterArt({ id, name }: { id: string; name: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [id]);
  if (!failed) return <img className="monster-art-img" src={`/images/${slug(id)}.jpg`} onError={() => setFailed(true)} alt={name} />;
  return <div className="monster-placeholder"><div className="monster-silhouette"><i /><b /><span /></div><div className="placeholder-ornament">✦</div></div>;
}
