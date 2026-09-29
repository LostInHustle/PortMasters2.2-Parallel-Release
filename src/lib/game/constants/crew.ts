// The artisan roster. Each type belongs to a content tier and is only
// hirable once that tier's charter has opened. WAGES is derived from this
// rather than repeated, so a wage can never drift between the two.
export type WorkerTypeId =
  | "weaver"
  | "master"
  | "sachet_maker"
  | "coppersmith"
  | "potter"
  | "perfumer"
  | "jeweler";

export type WorkerType = {
  id: WorkerTypeId;
  label: string;
  plural: string;
  icon: string;
  wage: number;
  tier: number;
};

export const WORKER_TYPES: WorkerType[] = [
  {
    id: "weaver",
    label: "Weaver",
    plural: "Weavers",
    icon: "👩‍🔧",
    wage: 8,
    tier: 0,
  },
  {
    id: "master",
    label: "Master Weaver",
    plural: "Masters",
    icon: "👩‍🎨",
    wage: 12,
    tier: 0,
  },
  {
    id: "sachet_maker",
    label: "Sachet Maker",
    plural: "Makers",
    icon: "🌸",
    wage: 20,
    tier: 0,
  },
  {
    id: "coppersmith",
    label: "Coppersmith",
    plural: "Coppersmiths",
    icon: "🪞",
    wage: 12,
    tier: 1,
  },
  {
    id: "potter",
    label: "Potter",
    plural: "Potters",
    icon: "🫖",
    wage: 14,
    tier: 1,
  },
  {
    id: "perfumer",
    label: "Perfumer",
    plural: "Perfumers",
    icon: "🧴",
    wage: 18,
    tier: 2,
  },
  {
    id: "jeweler",
    label: "Jeweler",
    plural: "Jewelers",
    icon: "📿",
    wage: 24,
    tier: 2,
  },
];

export const WORKER_TYPE_IDS: WorkerTypeId[] = WORKER_TYPES.map((w) => w.id);

export function workerType(id: string): WorkerType | undefined {
  return WORKER_TYPES.find((w) => w.id === id);
}

export const WAGES: Record<string, number> = Object.fromEntries(
  WORKER_TYPES.map((w) => [w.id, w.wage]),
);

// [C2: crew loss by name] The two things the loss rule needs, kept here
// beside the provisions above for the reason every number in this file is
// kept here: the run is a rule of the same family as the ration price, and
// the pool is content the way WORKER_TYPES is, so a balance pass or a
// content pass both find theirs where they already look.
//
// The run is the plan's own number, and it is written down rather than
// inlined where it is read: "two consecutive legs on Short Rations costs a
// crew member" is the rule, so a later tune that moved it to three should
// cost one edit with the plan's own sentence as the note beside it.
//
// The pool is the crew's names, and the plan asks for names that read as
// people rather than identifiers. It also says the pool is worth a content
// pass of its own once the mechanic is proven, which is the shape this
// list is written to: short enough for a log line, no repeats, and wide
// enough that a voyage never reaches the end of it. Every name is a single
// word so the sentences that carry one stay sentences.
export const CREW_LOSS_AFTER_HUNGRY_LEGS = 2;

export const CREW_NAMES: string[] = [
  "Ada",
  "Adil",
  "Aiko",
  "Amara",
  "Anil",
  "Anouk",
  "Arjun",
  "Asha",
  "Bram",
  "Cassia",
  "Chen",
  "Corin",
  "Dara",
  "Dev",
  "Dilara",
  "Emeka",
  "Enzo",
  "Farah",
  "Fen",
  "Gita",
  "Hakon",
  "Hana",
  "Idris",
  "Imani",
  "Ines",
  "Isolde",
  "Jaya",
  "Jonas",
  "Kavi",
  "Kiran",
  "Lena",
  "Lian",
  "Mabel",
  "Malik",
  "Maren",
  "Mateo",
  "Mina",
  "Nadia",
  "Nia",
  "Noor",
  "Odile",
  "Oren",
  "Pia",
  "Priya",
  "Rafi",
  "Rhea",
  "Roshan",
  "Runa",
  "Sana",
  "Selma",
  "Shaan",
  "Sora",
  "Sunil",
  "Tam",
  "Tara",
  "Teo",
  "Thandi",
  "Tomas",
  "Uma",
  "Vasco",
  "Vera",
  "Wren",
  "Yara",
  "Yusuf",
  "Zaid",
  "Zara",
  "Zoya",
];
