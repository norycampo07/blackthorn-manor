import { useEffect, useRef } from 'react';
import { VideoCanvas, VideoPausedContext, type VideoAspectRatio, useVideoPlayer } from '@/lib/video';
import { AnimatePresence } from 'framer-motion';
import './promo.css';
import {
  OpeningScene, ExploreScene, FearScene, LuckScene, CombatScene, DiscoveryScene, RecordScene, FinalScene,
} from './video_scenes/Scenes';

export const SCENE_DURATIONS = {
  opening: 6000,
  explore: 6500,
  fear: 4500,
  luck: 5000,
  combat: 9000,
  discovery: 4500,
  record: 4000,
  final: 4500,
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  opening: OpeningScene, explore: ExploreScene, fear: FearScene, luck: LuckScene,
  combat: CombatScene, discovery: DiscoveryScene, record: RecordScene, final: FinalScene,
};

const SCENE_START_SEC: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  let c = 0;
  for (const [k, ms] of Object.entries(SCENE_DURATIONS)) { out[k] = c / 1000; c += ms; }
  return out;
})();

const VIDEO_ASPECT_RATIO: VideoAspectRatio = '16:9';
const AUDIO_SEEK_EPSILON_SEC = 0.18;

export default function VideoTemplate({
  durations = SCENE_DURATIONS, loop = true, paused = false, muted = false, onSceneChange,
}: {
  durations?: Record<string, number>; loop?: boolean; paused?: boolean; muted?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop, paused });
  useEffect(() => { onSceneChange?.(currentSceneKey); }, [currentSceneKey, onSceneChange]);
  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '');
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSceneKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.5;
    if (paused) { audio.pause(); return; }
    if (lastSceneKeyRef.current !== currentSceneKey) {
      lastSceneKeyRef.current = currentSceneKey;
      const t = SCENE_START_SEC[baseSceneKey] ?? 0;
      if (Math.abs(audio.currentTime - t) > AUDIO_SEEK_EPSILON_SEC) audio.currentTime = t;
    }
    audio.play().catch(() => {});
  }, [currentSceneKey, baseSceneKey, muted, paused]);

  return (
    <VideoPausedContext.Provider value={paused}>
      <VideoCanvas aspectRatio={VIDEO_ASPECT_RATIO} style={{ backgroundColor: '#0e0b0d' }}>
        <div className="bm-root">
          <AnimatePresence mode="sync">
            {SceneComponent && <SceneComponent key={currentSceneKey} />}
          </AnimatePresence>
          <div className="bm-vig" />
          <div className="bm-grain" />
        </div>
        <audio ref={audioRef} src={`${import.meta.env.BASE_URL}audio/bg_music.mp3`} preload="auto" autoPlay muted={muted} />
      </VideoCanvas>
    </VideoPausedContext.Provider>
  );
}
