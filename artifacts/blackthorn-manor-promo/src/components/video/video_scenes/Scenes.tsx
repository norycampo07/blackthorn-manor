import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, CircleDot, Gem, KeyRound, Map } from 'lucide-react';
import { useSceneTimer } from '@/lib/video';

const img = (n: string) => `${import.meta.env.BASE_URL}images/${n}`;
const EASE = [0.22, 1, 0.36, 1] as const;
const SLOW = [0.4, 0, 0.2, 1] as const;

const sceneFade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, scale: 1.04 },
  transition: { duration: 1.1, ease: SLOW },
};

function Plate({ src, from = 1.08, to = 1.0, x = ['0%', '0%'], dur = 7, style }: { src: string; from?: number; to?: number; x?: string[]; dur?: number; style?: React.CSSProperties }) {
  return (
    <motion.div
      className="bm-plate"
      style={{ backgroundImage: `url(${src})`, ...style }}
      initial={{ scale: from, x: x[0] }}
      animate={{ scale: to, x: x[1] }}
      transition={{ duration: dur, ease: 'linear' }}
    />
  );
}

function Reveal({ children, delay = 0, y = 20, className, style }: { children: React.ReactNode; delay?: number; y?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 1.2, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/* 1 — OPENING: title over the gate */
export function OpeningScene() {
  const letters = 'BLACKTHORN'.split('');
  return (
    <motion.section className="bm-scene" {...sceneFade} transition={{ duration: 1.8 }}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 3, ease: SLOW }} className="absolute inset-0">
        <Plate src={img('front-gate.webp')} from={1.18} to={1.02} dur={7} />
      </motion.div>
      <div className="bm-shade" />
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center" style={{ paddingTop: '8vmin' }}>
        <Reveal delay={0.6} className="bm-eyebrow" y={0}>Est. 1847 &nbsp;·&nbsp; Still occupied</Reveal>
        <div className="bm-title flex" style={{ fontSize: '11vmin', marginTop: '3vmin' }}>
          {letters.map((l, i) => (
            <motion.span key={i} initial={{ opacity: 0, y: '0.25em', filter: 'blur(10px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 1.4, delay: 1.1 + i * 0.09, ease: EASE }}>{l}</motion.span>
          ))}
        </div>
        <motion.div className="bm-title" style={{ fontSize: '4.6vmin', letterSpacing: '0.9em', marginTop: '1.5vmin', paddingLeft: '0.9em' }}
          initial={{ opacity: 0, letterSpacing: '1.4em' }} animate={{ opacity: 1, letterSpacing: '0.9em' }} transition={{ duration: 2.2, delay: 2.1, ease: EASE }}>MANOR</motion.div>
        <motion.div className="bm-rule" style={{ width: '40vmin', marginTop: '3.5vmin' }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.6, delay: 2.8, ease: EASE }} />
        <Reveal delay={3.4} className="bm-line" style={{ fontSize: '4.2vmin', marginTop: '2.5vmin' }}>A House That Remembers</Reveal>
      </div>
    </motion.section>
  );
}

/* 2 — EXPLORATION: room montage + map + relics */
const ROOMS = [
  { src: 'entrance-hall.webp', name: 'ENTRANCE HALL' },
  { src: 'library.webp', name: 'THE LIBRARY' },
  { src: 'dining-room.webp', name: 'DINING ROOM' },
];
export function ExploreScene() {
  const [i, setI] = useState(0);
  useSceneTimer([{ time: 2100, callback: () => setI(1) }, { time: 4200, callback: () => setI(2) }]);
  const MAP = ['Gate', 'Hall', 'Library', 'Dining', 'Chapel', 'Nursery', '?', '?'];
  return (
    <motion.section className="bm-scene" {...sceneFade}>
      <AnimatePresence mode="sync">
        <motion.div key={i} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1 }}>
          <Plate src={img(ROOMS[i].src)} from={1.12} to={1.02} x={i % 2 ? ['-2%', '1%'] : ['1%', '-2%']} dur={3.4} />
        </motion.div>
      </AnimatePresence>
      <div className="bm-shade-left" />
      <div className="absolute" style={{ left: '7%', top: '24%', width: '44%' }}>
        <Reveal className="bm-eyebrow" delay={0.3}>Chapter I · Exploration</Reveal>
        <Reveal className="bm-line" delay={0.7} style={{ fontSize: '8.4vmin', lineHeight: 1.02, marginTop: '2vmin' }}>Explore a<br />forgotten <span className="bm-red">estate.</span></Reveal>
        <AnimatePresence mode="wait">
          <motion.div key={i} className="bm-chip inline-block" style={{ marginTop: '4vmin' }} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
            NOW ENTERING — {ROOMS[i].name}
          </motion.div>
        </AnimatePresence>
      </div>
      {/* interactive map UI */}
      <motion.div className="absolute bm-record" style={{ right: '6%', top: '14%', padding: '2.6vmin', width: '30vmin' }}
        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, delay: 1.4, ease: EASE }}>
        <div className="bm-eyebrow flex items-center gap-2" style={{ fontSize: '1.6vmin' }}><Map size={14} /> Manor Map</div>
        <div className="grid grid-cols-2" style={{ gap: '1vmin', marginTop: '1.6vmin' }}>
          {MAP.map((m, k) => {
            const lit = k === 0 || k === i + 1 || (k <= i + 1 && k < 6);
            return <motion.div key={k} animate={{ borderColor: k === i + 1 ? 'rgba(196,58,82,.9)' : 'rgba(185,166,132,.3)', opacity: lit ? 1 : 0.35 }}
              style={{ border: '1px solid', padding: '1vmin', fontSize: '1.9vmin', fontFamily: 'Cinzel, serif', textAlign: 'center' }}>{m}</motion.div>;
          })}
        </div>
      </motion.div>
      {/* relics rail */}
      <motion.div className="absolute flex items-center" style={{ right: '6%', bottom: '14%', gap: '1.6vmin' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3, duration: 1 }}>
        <span className="bm-eyebrow" style={{ fontSize: '1.6vmin', marginRight: '1vmin' }}>Relics</span>
        {[BookOpen, Gem, CircleDot, KeyRound].map((Icon, k) => (
          <motion.span key={k} className="flex items-center justify-center" style={{ width: '6vmin', height: '6vmin', border: '1px solid rgba(185,166,132,.45)', background: 'rgba(14,11,13,.7)' }}
            initial={{ color: '#5a5045' }} animate={{ color: k <= 1 ? '#e8c77a' : '#5a5045' }} transition={{ delay: 3.6 + k * 0.6, duration: 0.8 }}>
            <Icon size={22} />
          </motion.span>
        ))}
      </motion.div>
    </motion.section>
  );
}

/* 3 — FEAR: candle + meter */
export function FearScene() {
  const [fear, setFear] = useState(3);
  useSceneTimer([{ time: 1500, callback: () => setFear(4) }, { time: 2500, callback: () => setFear(5) }, { time: 3400, callback: () => setFear(6) }]);
  return (
    <motion.section className="bm-scene" {...sceneFade}>
      <Plate src={img('servant-corridor.webp')} from={1.05} to={1.15} dur={5} style={{ filter: 'brightness(.35) saturate(.6)' }} />
      <div className="bm-shade" />
      <motion.div className="bm-candle" style={{ left: '22%', bottom: '18%', height: '30vmin' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, ease: EASE }}>
        <motion.div className="bm-glow" animate={{ opacity: [0.7, 1, 0.6, 0.9] }} transition={{ duration: 2.5, repeat: Infinity }} />
        <div className="bm-wax" />
        <motion.div initial={{ scale: 1 }} animate={{ scale: 1 - (fear - 3) * 0.12 }} transition={{ duration: 0.8 }} style={{ position: 'absolute', inset: 0, transformOrigin: '4vmin 22.6vmin' }}><div className="bm-flame" /></motion.div>
      </motion.div>
      <div className="absolute" style={{ right: '9%', top: '28%', width: '44%', textAlign: 'right' }}>
        <Reveal className="bm-eyebrow" delay={0.3}>Chapter II · Fear</Reveal>
        <Reveal className="bm-line" delay={0.6} style={{ fontSize: '9vmin', lineHeight: 1, marginTop: '2vmin' }}>The Manor<br />is <span className="bm-red">watching.</span></Reveal>
        <Reveal delay={1.2} className="flex justify-end items-center" style={{ gap: '2vmin', marginTop: '5vmin' }}>
          <span className="bm-eyebrow">Fear</span>
          <div className="bm-pips">
            {Array.from({ length: 10 }, (_, k) => (
              <motion.div key={k} className="bm-pip" animate={{ backgroundColor: k < fear ? '#a3243b' : 'rgba(0,0,0,0)' }} transition={{ duration: 0.5 }} />
            ))}
          </div>
          <motion.span key={fear} className="bm-title bm-red" style={{ fontSize: '4vmin', width: '9vmin', textAlign: 'left' }} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>{fear}/10</motion.span>
        </Reveal>
      </div>
    </motion.section>
  );
}

/* 4 — LUCK: coin */
export function LuckScene() {
  const [line, setLine] = useState(0);
  useSceneTimer([{ time: 2500, callback: () => setLine(1) }]);
  return (
    <motion.section className="bm-scene flex items-center justify-center" {...sceneFade} style={{ background: 'radial-gradient(circle at 50% 45%, #2a1d17, #0e0b0d 70%)' }}>
      <div className="absolute bm-eyebrow" style={{ top: '13%', left: 0, right: 0, textAlign: 'center' }}>Test your luck · Fortune turns</div>
      <div style={{ perspective: '90vmin' }}>
        <motion.div className="bm-coin" initial={{ rotateY: 0, y: 0 }} animate={{ rotateY: [0, 1440, 1620], y: ['0vmin', '-6vmin', '0vmin'] }} transition={{ duration: 2.4, times: [0, 0.75, 1], ease: 'easeOut', delay: 0.3 }}>
          <div className="bm-face"><span>BLACKTHORN</span><b>B</b><small>1847</small></div>
          <div className="bm-face bm-back"><span>FORTUNA</span><b>✦</b><small>REMEMBERS</small></div>
        </motion.div>
      </div>
      <div className="absolute" style={{ bottom: '13%', left: 0, right: 0, height: '9vmin' }}>
        <AnimatePresence mode="sync">
          <motion.div key={line} className="bm-line absolute inset-x-0 text-center" style={{ fontSize: '6.4vmin' }}
            initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -14, filter: 'blur(6px)' }} transition={{ duration: 0.9, ease: EASE }}>
            {line === 0 ? <>Fortune may <span style={{ color: '#e8c77a' }}>help.</span></> : <>Misfortune may <span className="bm-red">follow.</span></>}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.section>
  );
}

/* 5 — COMBAT: four encounters */
const FOES = [
  { src: 'shadow-hound.webp', name: 'Shadow Hound', pos: '50% 50%' },
  { src: 'bat-swarm.webp', name: 'Bat Swarm', pos: '50% 40%' },
  { src: 'hanging-lady.webp', name: 'The Hanging Lady', pos: '50% 30%' },
  { src: 'lord-blackthorn.webp', name: 'Lord Blackthorn', pos: '50% 30%' },
];
export function CombatScene() {
  const [i, setI] = useState(0);
  useSceneTimer([{ time: 2250, callback: () => setI(1) }, { time: 4500, callback: () => setI(2) }, { time: 6750, callback: () => setI(3) }]);
  return (
    <motion.section className="bm-scene" {...sceneFade}>
      <AnimatePresence mode="sync">
        <motion.div key={i} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.9 }}>
          <Plate src={img(FOES[i].src)} from={1.02} to={1.12} dur={3.2} style={{ backgroundPosition: FOES[i].pos }} />
          <div className="bm-shade" />
          <motion.div className="absolute" style={{ left: '7%', bottom: '14%' }} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5, duration: 0.9, ease: EASE }}>
            <div className="bm-eyebrow">Encounter {String(i + 1).padStart(2, '0')} / 04</div>
            <div className="bm-title" style={{ fontSize: '5.4vmin', marginTop: '1.2vmin', letterSpacing: '.08em' }}>{FOES[i].name}</div>
            <div style={{ marginTop: '1.8vmin', width: '34vmin', height: '0.8vmin', background: 'rgba(185,166,132,.2)' }}>
              <motion.div style={{ height: '100%', background: '#a3243b', transformOrigin: 'left' }} initial={{ scaleX: 1 }} animate={{ scaleX: 0.62 }} transition={{ delay: 1.1, duration: 0.9 }} />
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
      <div className="absolute" style={{ right: '7%', top: '12%', textAlign: 'right' }}>
        <Reveal className="bm-eyebrow" delay={0.2}>Chapter III · Combat</Reveal>
        <Reveal className="bm-line" delay={0.5} style={{ fontSize: '7vmin', marginTop: '1.5vmin' }}>Face what <span className="bm-red">remains.</span></Reveal>
      </div>
    </motion.section>
  );
}

/* 6 — DISCOVERY: fragments + relics on a dark desk */
const FINDS = [
  { src: 'ancient-diary.webp', label: 'Family Fragment' },
  { src: 'family-seal-ring.webp', label: 'Relic' },
  { src: 'brass-key.webp', label: 'A door, unopened' },
];
export function DiscoveryScene() {
  return (
    <motion.section className="bm-scene" {...sceneFade}>
      <Plate src={img('chapel.webp')} from={1.1} to={1.02} dur={4.5} style={{ filter: 'brightness(.3) blur(2px)' }} />
      <div className="absolute" style={{ left: 0, right: 0, top: '11%', textAlign: 'center' }}>
        <Reveal className="bm-eyebrow">Chapter IV · Discovery</Reveal>
        <Reveal className="bm-line" delay={0.3} style={{ fontSize: '7.4vmin', marginTop: '1.4vmin' }}>Recover the <span className="bm-red">truth.</span></Reveal>
      </div>
      <div className="absolute flex justify-center" style={{ left: 0, right: 0, top: '42%', gap: '5vmin' }}>
        {FINDS.map((f, k) => (
          <motion.div key={k} className="flex flex-col items-center" initial={{ opacity: 0, y: 40, rotate: (k - 1) * 6 }} animate={{ opacity: 1, y: 0, rotate: (k - 1) * 2 }} transition={{ delay: 0.8 + k * 0.6, duration: 1.2, ease: EASE }}>
            <div className="bm-frame relative" style={{ width: '24vmin', height: '24vmin', backgroundImage: `url(${img(f.src)})` }} />
            <div className="bm-eyebrow" style={{ marginTop: '2vmin', fontSize: '1.7vmin' }}>{f.label}</div>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}

/* 7 — ENDING: survival record */
export function RecordScene() {
  const rows: [string, string][] = [['Areas Explored', '14'], ['Fragments Recovered', '9'], ['Fear Remaining', '6 / 10'], ['Monsters Defeated', '3'], ['House’s Judgment', '— sealed —']];
  return (
    <motion.section className="bm-scene" {...sceneFade}>
      <Plate src={img('tower-observatory.webp')} from={1.04} to={1.12} dur={4} style={{ filter: 'brightness(.4)' }} />
      <div className="bm-shade" />
      <motion.div className="absolute bm-record" style={{ left: '8%', top: '13%', width: '50vmin' }} initial={{ opacity: 0, y: 40, rotate: -2 }} animate={{ opacity: 1, y: 0, rotate: -1 }} transition={{ duration: 1.3, ease: EASE }}>
        <div className="bm-eyebrow">Survival Record</div>
        <div className="bm-title" style={{ fontSize: '4vmin', marginTop: '1.6vmin' }}>THE HEIR</div>
        <dl>{rows.map(([k, v], n) => (
          <motion.div key={k} style={{ display: 'contents' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 + n * 0.25 }}><dt>{k}</dt><dd className={n === 4 ? 'bm-red' : ''}>{v}</dd></motion.div>
        ))}</dl>
        <div className="bm-eyebrow" style={{ fontSize: '1.6vmin' }}>Achievements</div>
        <div className="flex flex-wrap" style={{ gap: '1vmin', marginTop: '1.2vmin' }}>
          {['Keeper of Candles', 'Lucky Heir', 'Archivist'].map((a, n) => (
            <motion.span key={a} className="bm-chip" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.9 + n * 0.3 }}>{a}</motion.span>
          ))}
        </div>
      </motion.div>
      <div className="absolute" style={{ right: '8%', top: '36%', width: '38%', textAlign: 'right' }}>
        <Reveal className="bm-line" delay={1.2} style={{ fontSize: '7.2vmin', lineHeight: 1.05 }}>Will you become<br />the <span style={{ color: '#e8c77a' }}>True Heir?</span></Reveal>
      </div>
    </motion.section>
  );
}

/* 8 — FINAL CARD */
export function FinalScene() {
  return (
    <motion.section className="bm-scene flex flex-col items-center justify-center text-center" {...sceneFade} style={{ background: 'radial-gradient(ellipse at 50% 50%, #1e1316, #0a0709 70%)' }}>
      <motion.div className="bm-title" style={{ fontSize: '9vmin' }} initial={{ opacity: 0, scale: 1.08, filter: 'blur(10px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} transition={{ duration: 1.6, ease: EASE }}>BLACKTHORN</motion.div>
      <motion.div className="bm-title" style={{ fontSize: '4vmin', letterSpacing: '.9em', paddingLeft: '.9em', marginTop: '1vmin' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 1.2 }}>MANOR</motion.div>
      <motion.div className="bm-rule" style={{ width: '36vmin', marginTop: '3.5vmin' }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1, duration: 1.2 }} />
      <Reveal className="bm-eyebrow" delay={1.4} style={{ marginTop: '3vmin', fontSize: '2.2vmin', color: '#e8c77a' }}>Available Now</Reveal>
      <Reveal className="bm-line" delay={2.2} style={{ fontSize: '4.4vmin', marginTop: '2.4vmin' }}>“Enter if you <span className="bm-red">dare.</span>”</Reveal>
    </motion.section>
  );
}
