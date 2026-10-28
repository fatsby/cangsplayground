import { z } from "zod";

/** Big Smile 10.x variants; Pastel Wall changes only the background palette. */
export const avatarChoices = {
  backgroundColor: ["ffe3ea", "e3edff", "e2f5e9", "fdf1d4", "efe6ff"],
  hairVariant: [
    "bangs",
    "bowlCutHair",
    "braids",
    "bunHair",
    "curlyBob",
    "curlyShortHair",
    "froBun",
    "halfShavedHead",
    "mohawk",
    "shavedHead",
    "shortHair",
    "straightHair",
    "wavyBob",
  ],
  hairColor: ["220f00", "3a1a00", "71472d", "e2ba87", "605de4", "238d80", "d56c0c", "e9b729"],
  skinColor: ["ffe4c0", "f5d7b1", "efcc9f", "e2ba87", "c99c62", "a47539", "8c5a2b", "643d19"],
  eyesVariant: ["angry", "cheery", "confused", "normal", "sad", "sleepy", "starstruck", "winking"],
  mouthVariant: [
    "awkwardSmile",
    "braces",
    "gapSmile",
    "kawaii",
    "openSad",
    "openedSmile",
    "teethSmile",
    "unimpressed",
  ],
  accessoriesVariant: [
    "none",
    "catEars",
    "clownNose",
    "faceMask",
    "glasses",
    "mustache",
    "sailormoonCrown",
    "sleepMask",
    "sunglasses",
  ],
} as const;

export const avatarSchema = z
  .object({
    seed: z.string().min(1).max(64),
    backgroundColor: z.enum(avatarChoices.backgroundColor).optional(),
    hairVariant: z.enum(avatarChoices.hairVariant).optional(),
    hairColor: z.enum(avatarChoices.hairColor).optional(),
    skinColor: z.enum(avatarChoices.skinColor).optional(),
    eyesVariant: z.enum(avatarChoices.eyesVariant).optional(),
    mouthVariant: z.enum(avatarChoices.mouthVariant).optional(),
    accessoriesVariant: z.enum(avatarChoices.accessoriesVariant).optional(),
  })
  .strict();

export type AvatarConfig = z.infer<typeof avatarSchema>;
