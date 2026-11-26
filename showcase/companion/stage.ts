import * as THREE from 'three';
import { Avatar } from './vendor/animama/src/frontend/web/src/lib/avatar/Avatar';
import { buildEmotionRuntimeState, normalizeEmotionStateMap } from './vendor/animama/src/frontend/web/src/lib/emotion';
import { BUILT_IN_AVATAR_MOTION_CATALOG as motions } from './vendor/animama/src/frontend/web/src/lib/avatar/motion/AvatarMotionCatalog';
import { EMPTY_RUNTIME_MEDIA_PROVIDER } from './vendor/animama/src/frontend/web/src/lib/runtime-content/AnimaRuntimeMediaCatalog';
import { AVATAR_PARTICLE_VFX_CATALOG } from './vendor/animama/src/frontend/web/src/lib/avatar/particle-vfx/catalog';
import { parseAvatarEffectDefinition, parseAvatarEffectUse } from './vendor/animama/src/frontend/web/src/lib/avatar/vfx/definition';
const base = new URL('.', (document.currentScript as HTMLScriptElement)?.src || location.href);
const asset = (path: string) => new URL(`content/${path}`, base).href;
const rawEffects = import.meta.glob('./vendor/animama/content/included/vfx/avatar/*/*.json', { eager: true, import: 'default' }) as Record<string, any>;
const effects = new Map<string, any>();
for (const [path, raw] of Object.entries(rawEffects)) {
  if (raw.content_type !== 'avatar_effect') continue;
  const id = path.split('/').at(-2)!;
  const context = { id, label: raw.name, description: raw.description, assetPath: asset(`vfx/avatar/${id}/${raw.definition.art.image}`),
    otherEyeAssetPath: raw.definition.art.otherEyeImage ? asset(`vfx/avatar/${id}/${raw.definition.art.otherEyeImage}`) : undefined };
  effects.set(id, {raw, context});
}
const particles = AVATAR_PARTICLE_VFX_CATALOG.map(p => ({ ...p, assetPath: asset(`vfx/particle/quark/${p.id}/particle.json`) }));
const media = { ...EMPTY_RUNTIME_MEDIA_PROVIDER,
  listParticleVFX: () => particles,
  resolveParticleVFX: async (id: string) => particles.find(p => p.id === id) ?? null,
  resolveAvatarVFX: (id: string) => { const e = effects.get(id); return e ? parseAvatarEffectDefinition(e.raw.definition, e.context) : null; },
  listAvatarVFX: () => [...effects.keys()].map(id => media.resolveAvatarVFX(id)!),
  loadAvatarVFX: async (id: string, override?: any) => { const e = effects.get(id); return e ? (override ? parseAvatarEffectUse(e.raw.definition, override, e.context) : parseAvatarEffectDefinition(e.raw.definition, e.context)) : null; },
};
export const isCharacter = (id: string) => id === 'andrew' || id === 'annie';
export const catalog = () => ({ gestures: motions.listPoseClips(), reactions: motions.listReactionClips() });
const feelings: Record<string,string> = { laugh:'amusement', cry:'grief', shout:'anger', scared:'fear', smug:'confidence', flat:'disapproval', determined:'confidence', tired:'disappointment', happy:'joy', excited:'excitement', warm:'caring', gentle:'caring', sad:'sadness', angry:'anger', curious:'curiosity', surprised:'confusion', serious:'confidence', calm:'respect', playful:'amusement', neutral:'' };
export function mount(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x607080, 2));
  const key = new THREE.DirectionalLight(0xffffff, 2.5); key.position.set(1, 3, 4); scene.add(key);
  let avatar: Avatar | null = null, disposed = false, generation = 0, frame = 'body', level = 0, lastEmotion = '', clock = 0;
  let width = 0, height = 0, cursor: any = null;
  let bounds = new THREE.Box3(), target = new THREE.Vector3(0, .9, 0), span = 1.8;
  const fit = () => {
    if (!avatar?.scene) return;
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    target.copy(center);
    // face: the desktop buddy's circle (just the face, from the front); head: head and shoulders; body: all of them.
    if (frame === 'face') { target.y = bounds.max.y - size.y * .085; span = size.y * .175; }
    else if (frame === 'head') { target.y = bounds.max.y - size.y * .16; span = size.y * .45; }
    else span = size.y * 1.13;
    // Only the full body needs the width (the arms): close framings would be pushed back by it.
    const wide = frame === 'body' ? size.x / camera.aspect * 1.15 : 0;
    const distance = Math.max(span, wide) / (2 * Math.tan(THREE.MathUtils.degToRad(15)));
    camera.position.set(target.x, target.y, target.z + distance); camera.lookAt(target); camera.updateProjectionMatrix();
  };
  // The desktop buddy draws the head a little bigger than life, so the small character stays readable.
  let head = 1;
  const sizeHead = () => avatar?.vrm?.humanoid?.getRawBoneNode('head')?.scale.setScalar(head);
  const api = {
    canvas,
    headScale(value: number) { head = Number.isFinite(value) && value > 0 ? value : 1; sizeHead(); },
    ready: false,
    error: '',
    async load(id: string) {
      if (!isCharacter(id) || disposed) return;
      const serial = ++generation;
      if (avatar) { if (avatar.scene) scene.remove(avatar.scene); avatar.dispose(); }
      const next = new Avatar(camera, canvas, { mediaCatalog: media, cursorLookAtInputProvider: () => cursor });
      lastEmotion = ''; avatar = next; api.ready = false; api.error = '';
      try {
        await next.load({ filePath: asset(`avatars/${id === 'annie' ? 'Annie' : 'Andrew'}.vrm`), materialMode: 'simple' });
        if (disposed || serial !== generation) { next.dispose(); return; }
        scene.add(next.scene!); next.prepareFirstFrame(); sizeHead();
        bounds.setFromObject(next.scene!); fit(); api.ready = true;
      } catch (e) { if (serial === generation && !disposed) { api.error = String(e); console.error('Companion could not load', e); } }
    },
    framing(value: string) { frame = value === 'head' || value === 'face' ? value : 'body'; fit(); },
    cursor(x: number, y: number) { cursor = { clientX:x, clientY:y, source:'dom', isInsideViewport:true }; },
    speaking(value: number) { level = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0; },
    emotion(name: string) {
      if (!api.ready || lastEmotion === name) return;
      lastEmotion = name;
      const emotion = feelings[name] ?? name;
      const state = buildEmotionRuntimeState(normalizeEmotionStateMap({ [emotion]: 15 }));
      avatar!.setEmotionalState(state, state.dominantGroup);
      const id = motions.getReactionRuntimeId({ emotionalTone: emotion, emotionalIntensity: 2, randomRoll: Math.random() });
      if (id) api.reaction(id);
    },
    gesture(id: string) { if (api.ready && motions.getPoseClip(id)) avatar!.playClip(id); },
    reaction(id: string) {
      const clip = motions.getReactionClip(id);
      if (api.ready && clip) avatar!.reactionClipPlayer?.play({clip, ownerId:'jarvis', runId:`jarvis-${++clock}`, sourceEventId:'jarvis', emotionEventId:null});
    },
    render(dt = 1 / 30, w = canvas.clientWidth || 256, h = canvas.clientHeight || 320) {
      if (disposed) return;
      if (width !== w || height !== h) { width = Math.max(1,w); height = Math.max(1,h); renderer.setSize(width,height,false); camera.aspect=width/height; fit(); }
      if (api.ready) {
        avatar!.update(Math.min(.05, Math.max(0,dt)));
        if (head !== 1) sizeHead();
        // Jarvis owns audio playback. RMS from its actual playing PCM drives Animama's mouth.
        avatar!.vrm?.expressionManager?.setValue('aa', level);
        avatar!.vrm?.expressionManager?.update();
      }
      renderer.render(scene,camera);
    },
    dispose() { disposed = true; ++generation; avatar?.dispose(); renderer.dispose(); renderer.forceContextLoss(); },
  };
  const action = (event: Event) => {
    const m = (event as CustomEvent).detail;
    if (['gesture', 'reaction', 'emotion'].includes(m?.action)) api[m.action as 'gesture'](m.name);
  };
  window.addEventListener('companion-action', action);
  const dispose = api.dispose;
  api.dispose = () => { window.removeEventListener('companion-action', action); dispose(); };
  return api;
}
