/**
 * Character looks by agent role.
 *
 * The office people sheets (scripts/compose_lpc_people.py) are one look per
 * role, plus an "-alt" sheet of each (same outfit, other skin and hair) for a
 * second agent of the same role. Known subagent types get a fixed look;
 * unknown types and agents without a type get a stable look from the rest.
 * Two agents present at once never share a sheet, and an agent keeps its look
 * for its whole stay. Pure TS.
 */

export type LookKey =
  "blue" | "green" | "purple" | "orange" | "pink" | "teal" | "yellow" | "red";

/** Fixed looks of the known agent types (lower-case). */
const ROLE_LOOKS: Record<string, LookKey> = {
  developer: "blue",
  qa: "purple",
  reviewer: "yellow",
  devops: "teal",
  explore: "green",
  plan: "pink",
  "general-purpose": "orange",
  claude: "red",
};

/** Looks shared by unknown agent types. */
export const OTHER_LOOKS: readonly LookKey[] = [
  "green",
  "pink",
  "orange",
  "red",
];

const LOOK_ORDER: readonly LookKey[] = [
  "blue",
  "green",
  "purple",
  "orange",
  "pink",
  "teal",
  "yellow",
  "red",
];

/** Every agent sheet in /sprites/people (the boss has his own). */
export const ALL_SHEETS: readonly string[] = LOOK_ORDER.flatMap((look) => [
  look,
  `${look}-alt`,
]);

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** The look of an agent type (or, without a type, of the agent's name). */
export function baseLook(
  agentType: string | null | undefined,
  name: string,
): LookKey {
  const type = agentType?.trim().toLowerCase();
  if (type && ROLE_LOOKS[type]) return ROLE_LOOKS[type];
  return OTHER_LOOKS[hash(type || name) % OTHER_LOOKS.length];
}

export interface LookAgent {
  id: string;
  agentType?: string | null;
  name: string | null;
  /** Arrival order; earlier agents pick first. */
  number: number;
}

/**
 * Sheet per agent id. Agents already in `previous` keep their sheet; new
 * ones get their role's look, else its "-alt", else the first free sheet.
 */
export function assignLooks(
  agents: readonly LookAgent[],
  previous: ReadonlyMap<string, string>,
): Map<string, string> {
  const looks = new Map<string, string>();
  const taken = new Set<string>();
  const present = new Set(agents.map((a) => a.id));
  for (const [id, sheet] of previous) {
    if (present.has(id)) {
      looks.set(id, sheet);
      taken.add(sheet);
    }
  }

  const newcomers = agents
    .filter((a) => !looks.has(a.id))
    .sort((a, b) => a.number - b.number);
  for (const agent of newcomers) {
    const look = baseLook(agent.agentType, agent.name ?? agent.id);
    const choices = [
      look,
      `${look}-alt`,
      ...ALL_SHEETS.filter((s) => !s.startsWith(look)),
    ];
    // Everything taken (more than 16 agents): share the role's look
    const sheet = choices.find((s) => !taken.has(s)) ?? look;
    looks.set(agent.id, sheet);
    taken.add(sheet);
  }
  return looks;
}

/** Stateful wrapper: remembers the previous assignment between renders. */
export class AgentLookCache {
  private last = new Map<string, string>();

  compute(agents: readonly LookAgent[]): Map<string, string> {
    const next = assignLooks(agents, this.last);
    // Same assignment as before: hand back the same Map (stable for memo)
    if (
      next.size === this.last.size &&
      [...next].every(([id, sheet]) => this.last.get(id) === sheet)
    ) {
      return this.last;
    }
    this.last = next;
    return next;
  }
}
