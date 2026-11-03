import type { Rng } from "@cangsplayground/core";
import type { ScenePreset } from "./model.js";
import type {
  CaseBriefing,
  IntroCaptions,
  IntroDescriptor,
  RoomShape,
  SuspectBadge,
} from "./types.js";

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[rng.int(items.length)]!;
}

function fillCaption(template: string, values: Record<string, string>): string {
  return template.replace(/\{([a-z]+)\}/g, (_match, key: string) => {
    const value = values[key];
    if (value === undefined) throw new Error(`unbound caption placeholder {${key}}`);
    return value;
  });
}

/**
 * Builds the public intro descriptor for the projector.
 *
 * The parameters deliberately exclude the case logic, answer, worlds and seed, so the result can
 * depend only on the public briefing, the scene's pools and the random stream. Shapes and badges
 * are looked up by display name in the scene, and the captions name only the place where the
 * body was found.
 *
 * @param args.scene the scene preset the briefing was bound from.
 * @param args.briefing the public briefing; its rooms and suspects must come from `scene`.
 * @param args.rng random stream for the victim look, discovery time and caption wording.
 * @returns a descriptor keyed by exactly the briefing's room and suspect ids.
 * @throws Error when the briefing names a room, suspect or found place the scene does not know.
 */
export function buildIntro(args: {
  scene: ScenePreset;
  briefing: CaseBriefing;
  rng: Rng;
}): IntroDescriptor {
  const { scene, briefing, rng } = args;
  const victimLook = pick(scene.victimLooks, rng);
  const discoveredAt = pick(scene.discoveredTimes, rng);

  const place = scene.foundPlaces.find((p) => p.label === briefing.bodyFoundAt);
  if (!place) throw new Error(`scene ${scene.id} has no found place "${briefing.bodyFoundAt}"`);

  const roomShapes: Record<string, RoomShape> = {};
  for (const room of briefing.rooms) {
    const entry = scene.roomPool.find((r) => r.name === room.name);
    if (!entry) throw new Error(`scene ${scene.id} has no room "${room.name}"`);
    roomShapes[room.id] = entry.shape;
  }
  const suspectBadges: Record<string, SuspectBadge> = {};
  for (const suspect of briefing.suspects) {
    const entry = scene.suspectPool.find((s) => s.name === suspect.name);
    const badge = entry ? scene.badgeByRole[entry.role] : undefined;
    if (!badge) throw new Error(`scene ${scene.id} has no badge for "${suspect.name}"`);
    suspectBadges[suspect.id] = badge;
  }

  const values = {
    title: briefing.title,
    venue: scene.venue,
    victim: briefing.victim.name,
    place: place.label,
    time: discoveredAt,
  };
  const captions = Object.fromEntries(
    (Object.keys(scene.captionTemplates) as (keyof IntroCaptions)[]).map((beat) => [
      beat,
      fillCaption(pick(scene.captionTemplates[beat], rng), values),
    ]),
  ) as IntroCaptions;

  return {
    sceneId: scene.id,
    victimLook,
    foundPlace: place.kind,
    discoveredAt,
    roomShapes,
    suspectBadges,
    captions,
  };
}
