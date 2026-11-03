import type { ScenePreset } from "../model.js";

/**
 * Words that must never appear in intro text: weapon names and vocabulary describing how harm
 * was done. The intro shows only where the body was found, so captions are checked against this.
 */
export const INTRO_BANNED_TERMS: readonly string[] = [
  "gun",
  "knife",
  "shot",
  "shoot",
  "shooting",
  "stab",
  "stabbed",
  "blood",
  "bloody",
  "bullet",
  "poison",
  "poisoned",
  "strangled",
  "hanged",
  "hammer",
  "axe",
  "sword",
  "weapon",
  "kill",
  "killed",
  "killing",
  "murder",
  "murdered",
];

const CAPTIONS = {
  setting: [
    "{title}. One night, four rooms and four suspects.",
    "{title}: one house, many secrets.",
  ],
  walk: ["{victim} walks through the building.", "{victim} is alone for a few minutes."],
  blackout: ["The lights go out. Nobody sees what happens.", "Suddenly, everything goes dark."],
  found: [
    "At {time}, {victim} is found at {place}.",
    "{victim} is found at {place}. The time is {time}",
  ],
};

const MANOR: ScenePreset = {
  id: "manor-night",
  venue: "house",
  titles: ["The Ashgrove Manor Mystery", "A Stormy Night at Fenwick House", "The Elmcourt Secret"],
  openings: [
    "{victim} was found at {place} late in the evening. The police think that someone in the house is guilty, and they need your team to find the truth.",
    "On a stormy night, {victim} was found at {place}. Four people were in the house. Your team must find out who did it, with what, and where.",
  ],
  victims: [
    {
      name: "Lord Edwin Marsh",
      description: "The owner of the house. Known for strict rules and large parties.",
    },
    {
      name: "Dame Clara Voss",
      description: "A rich collector. Known for her old paintings and her sharp words.",
    },
    {
      name: "Mr. Arthur Penn",
      description: "A retired judge. Known for long dinners and long stories.",
    },
  ],
  roomPool: [
    { name: "the library", description: "A quiet room full of old books.", shape: "arched" },
    { name: "the kitchen", description: "A busy room with a big table.", shape: "square" },
    { name: "the wine cellar", description: "A cold room under the house.", shape: "low" },
    { name: "the greenhouse", description: "A warm room with glass walls.", shape: "glasshouse" },
    {
      name: "the tower room",
      description: "A round room at the top of the house.",
      shape: "round",
    },
  ],
  weaponPool: [
    { name: "the brass candlestick", description: "A heavy candlestick from the hall." },
    { name: "the garden spade", description: "A tool from the garden shed." },
    { name: "the heavy vase", description: "A large vase from the living room." },
    { name: "the walking stick", description: "A thick stick that stands by the door." },
  ],
  suspectPool: [
    {
      name: "Dr. Harris",
      role: "doctor",
      description: "The family doctor. A friend of the house for many years.",
    },
    { name: "Mr. Finch", role: "butler", description: "The butler. Works in the house every day." },
    {
      name: "Ms. Rowan",
      role: "artist",
      description: "A painter who is staying in the house this month.",
    },
    {
      name: "Mrs. Doyle",
      role: "cook",
      description: "The cook. Knows every corner of the kitchen.",
    },
    {
      name: "Mr. Blake",
      role: "gardener",
      description: "The gardener. Looks after the big garden.",
    },
    { name: "Ms. Lane", role: "lawyer", description: "The family lawyer. Visits for business." },
  ],
  foundPlaces: [
    { kind: "garden-path", label: "the garden path" },
    { kind: "courtyard", label: "the stone courtyard" },
  ],
  victimLooks: [
    { hair: "white", coat: "indigo", accessory: "bowtie" },
    { hair: "grey", coat: "burgundy", accessory: "scarf" },
    { hair: "bald", coat: "green", accessory: "glasses" },
    { hair: "dark", coat: "charcoal", accessory: "hat" },
  ],
  badgeByRole: {
    doctor: "stethoscope",
    butler: "bowtie",
    artist: "long-hair",
    gardener: "hat",
    cook: "apron",
    lawyer: "glasses",
  },
  discoveredTimes: ["10:05 p.m.", "10:20 p.m.", "10:40 p.m.", "11:00 p.m."],
  captionTemplates: CAPTIONS,
};

const HOTEL: ScenePreset = {
  id: "hotel-night",
  venue: "hotel",
  titles: [
    "Night at the Grand Meridian Hotel",
    "The Harbour Palace Mystery",
    "The Silver Anchor Hotel",
  ],
  openings: [
    "{victim} was found at {place} late in the evening. The hotel was full of guests, and the police need your team to find the truth.",
    "On a busy night at the hotel, {victim} was found at {place}. Four people had a reason to be there. Your team must find out who did it, with what, and where.",
  ],
  victims: [
    {
      name: "Mr. Leon Hartley",
      description: "The owner of the hotel. Known for his big plans and his bad temper.",
    },
    {
      name: "Ms. Vera Castell",
      description: "A famous travel writer. Known for her sharp reviews.",
    },
    {
      name: "Mr. Oscar Brandt",
      description: "A rich guest who stays in the hotel every winter.",
    },
  ],
  roomPool: [
    { name: "the spa", description: "A calm room with hot water and soft light.", shape: "arched" },
    { name: "the laundry room", description: "A low room full of machines.", shape: "low" },
    {
      name: "the conference room",
      description: "A plain room with a long table.",
      shape: "square",
    },
    {
      name: "the roof garden",
      description: "A room with glass walls above the city.",
      shape: "glasshouse",
    },
    { name: "the ballroom", description: "A big round room for parties.", shape: "round" },
  ],
  weaponPool: [
    { name: "the silver trophy", description: "A heavy prize from the lobby." },
    { name: "the metal tray", description: "A large tray from the restaurant." },
    { name: "the black umbrella", description: "A strong umbrella from the front desk." },
    { name: "the luggage strap", description: "A long strap from the baggage room." },
  ],
  suspectPool: [
    {
      name: "Ms. Okafor",
      role: "manager",
      description: "The hotel manager. Is responsible for every guest.",
    },
    {
      name: "Mr. Sato",
      role: "receptionist",
      description: "The receptionist. Meets every guest at the desk.",
    },
    { name: "Mrs. Duval", role: "chef", description: "The head chef. Runs the busy kitchen." },
    {
      name: "Dr. Moreau",
      role: "nurse",
      description: "The hotel nurse. Helps guests who feel ill.",
    },
    {
      name: "Mr. Quinn",
      role: "porter",
      description: "The porter. Carries the bags of the guests.",
    },
    { name: "Ms. Alder", role: "author", description: "A writer who is staying for the month." },
  ],
  foundPlaces: [
    { kind: "service-corridor", label: "the service corridor" },
    { kind: "courtyard", label: "the back courtyard" },
  ],
  victimLooks: [
    { hair: "grey", coat: "charcoal", accessory: "glasses" },
    { hair: "dark", coat: "burgundy", accessory: "scarf" },
    { hair: "white", coat: "green", accessory: "hat" },
    { hair: "bald", coat: "indigo", accessory: "none" },
  ],
  badgeByRole: {
    manager: "bowtie",
    receptionist: "long-hair",
    chef: "apron",
    nurse: "stethoscope",
    porter: "hat",
    author: "glasses",
  },
  discoveredTimes: ["10:10 p.m.", "10:25 p.m.", "10:45 p.m.", "11:05 p.m."],
  captionTemplates: CAPTIONS,
};

const PRESETS: readonly ScenePreset[] = [MANOR, HOTEL];

/**
 * The authored intro scenes. Server-only: pools of names, shapes and caption templates that the
 * generator binds to a case. Every scene works with every logical configuration.
 *
 * @returns the shipped scene presets in a stable order.
 */
export function scenePresets(): readonly ScenePreset[] {
  return PRESETS;
}
