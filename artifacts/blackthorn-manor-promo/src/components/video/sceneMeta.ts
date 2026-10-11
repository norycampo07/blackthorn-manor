// Optional scene metadata for Replit workspace integrations. When the
// workspace's scene controls are enabled for this project, a viewer's click on
// a scene segment scopes their next chat request to that scene's source file.
// Fill one entry per SCENE_DURATIONS key in VideoTemplate.tsx only when a
// skill reference asks for it; otherwise leave the map empty. Scenes missing
// from the map still play and can be jumped to.
//
// Example:
//   export const SCENE_DETAILS: Record<string, SceneDetails> = {
//     open: { title: 'Intro', filePath: 'src/components/video/video_scenes/Scene1.tsx' },
//   };

export interface SceneDetails {
  title: string;
  filePath: string;
}

export const SCENE_DETAILS: Record<string, SceneDetails> = {
  opening: { title: 'Opening', filePath: 'src/components/video/video_scenes/Scenes.tsx' },
  explore: { title: 'Exploration', filePath: 'src/components/video/video_scenes/Scenes.tsx' },
  fear: { title: 'Fear', filePath: 'src/components/video/video_scenes/Scenes.tsx' },
  luck: { title: 'Luck', filePath: 'src/components/video/video_scenes/Scenes.tsx' },
  combat: { title: 'Combat', filePath: 'src/components/video/video_scenes/Scenes.tsx' },
  discovery: { title: 'Discovery', filePath: 'src/components/video/video_scenes/Scenes.tsx' },
  record: { title: 'Survival Record', filePath: 'src/components/video/video_scenes/Scenes.tsx' },
  final: { title: 'Final Card', filePath: 'src/components/video/video_scenes/Scenes.tsx' },
};
