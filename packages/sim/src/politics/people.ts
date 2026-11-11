// The persons table and the offices (pivot 5.7, 5.8; D1037): what every other lane calls to find a
// person, see who holds a seat, seat a winner or take someone out of office. Owned by lane C from
// the M2 contracts change on; the signatures below are contracts (lanes E and G call them), the
// bodies are C's to deepen. Every draw a caller makes for these comes from the Politics stream.

import type { SimDate } from "../types/calendar.ts";
import { ordinal, type PersonId } from "../types/ids.ts";
import type {
  CareerRecord,
  OfficeExit,
  OfficeHolder,
  OfficeHow,
  OfficeSeat,
  Person,
  PersonsState,
  VacancyFill,
} from "../types/state/persons.ts";
import { OFFICE_KIND_VALUES } from "../types/state/persons.ts";

/** An empty persons table (D1037): every world's at load until lane C fills it (`personsStart`). */
export function personsStateEmpty(): PersonsState {
  return { persons: [], persons_made: 0, offices: [], vacancies: [], benches: [], platforms: [] };
}

/** The person with `id`, or undefined (the table is in id order: a binary search). */
export function personGet(s: PersonsState, id: PersonId): Person | undefined {
  let lo = 0;
  let hi = s.persons.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const p = s.persons[mid] as Person;
    if (p.id === id) return p;
    if (p.id < id) lo = mid + 1;
    else hi = mid - 1;
  }
  return undefined;
}

/** Adds a person with the next id (`persons_made`), keeping the table in id order. */
export function personAdd(s: PersonsState, make: (id: PersonId) => Person): Person {
  const id = ordinal<PersonId>(s.persons_made);
  s.persons_made += 1;
  const p = make(id);
  s.persons.push(p);
  return p;
}

/** A seat as a key for maps and equality: "Senate/12/1", "House/4/7", "President". Never iterated. */
export function seatKey(seat: OfficeSeat): string {
  switch (seat.kind) {
    case "President":
    case "VicePresident":
    case "FedChair":
      return seat.kind;
    case "Cabinet":
      return `Cabinet/${seat.post}`;
    case "Senate":
      return `Senate/${seat.state}/${seat.senate_class}`;
    case "House":
      return `House/${seat.state}/${seat.district}`;
    case "Governor":
      return `Governor/${seat.state}`;
    case "Judge":
      return `Judge/${seat.post}/${seat.seat}`;
  }
}

/** The numbers a seat sorts by after its kind: state, then class, district, post or seat. */
function seatParts(seat: OfficeSeat): [number, number] {
  switch (seat.kind) {
    case "President":
    case "VicePresident":
    case "FedChair":
      return [0, 0];
    case "Cabinet":
      return [seat.post, 0];
    case "Senate":
      return [seat.state, seat.senate_class];
    case "House":
      return [seat.state, seat.district];
    case "Governor":
      return [seat.state, 0];
    case "Judge":
      return [seat.post, seat.seat];
  }
}

/** The offices table's order (`PersonsState.offices`): by kind (`OFFICE_KIND_VALUES`), then place. */
export function officeSeatOrder(a: OfficeSeat, b: OfficeSeat): number {
  const k = OFFICE_KIND_VALUES.indexOf(a.kind) - OFFICE_KIND_VALUES.indexOf(b.kind);
  if (k !== 0) return k;
  const [a0, a1] = seatParts(a);
  const [b0, b1] = seatParts(b);
  return a0 !== b0 ? a0 - b0 : a1 - b1;
}

/** Who holds `seat` now, or undefined when it is vacant. */
export function officeHolderOf(s: PersonsState, seat: OfficeSeat): OfficeHolder | undefined {
  const key = seatKey(seat);
  return s.offices.find((o) => seatKey(o.seat) === key);
}

/** The seats `person` holds now, in table order. */
export function officesOf(s: PersonsState, person: PersonId): OfficeHolder[] {
  return s.offices.filter((o) => o.person === person);
}

/**
 * Seats `person` in `seat` from `date` (pivot 5.8): adds the office, opens a career line, marks
 * them in office and fills any vacancy of the seat. Whoever held it must have left first
 * (`officeLeave`); a seat held twice throws.
 */
export function officeTake(
  s: PersonsState,
  person: PersonId,
  seat: OfficeSeat,
  how: OfficeHow,
  date: SimDate,
  termEnds: SimDate | null,
): void {
  const p = personGet(s, person);
  if (p === undefined) throw new Error(`officeTake: no person ${person}`);
  if (officeHolderOf(s, seat) !== undefined) throw new Error(`officeTake: ${seatKey(seat)} is held`);
  const holder: OfficeHolder = { seat, person, since: date, term_ends: termEnds };
  const at = s.offices.findIndex((o) => officeSeatOrder(o.seat, seat) > 0);
  if (at < 0) s.offices.push(holder);
  else s.offices.splice(at, 0, holder);
  const line: CareerRecord = { seat, how, from: date, to: null, exit: null };
  p.career.push(line);
  p.status = "InOffice";
  const key = seatKey(seat);
  s.vacancies = s.vacancies.filter((v) => seatKey(v.seat) !== key);
}

/**
 * Takes whoever holds `seat` out of it on `date` (pivot 5.9): closes their career line with `exit`
 * and, when they hold nothing else, sets their status (Dead on `Died`, Retired on `Retired`,
 * `Resigned` and `Removed`, else Bench to run again). Raises a vacancy filled by `vacancyFillOf`
 * unless `vacate` is false (a handover seats the winner at once). Returns who left, or null.
 */
export function officeLeave(
  s: PersonsState,
  seat: OfficeSeat,
  exit: OfficeExit,
  date: SimDate,
  vacate = true,
): PersonId | null {
  const key = seatKey(seat);
  const at = s.offices.findIndex((o) => seatKey(o.seat) === key);
  if (at < 0) return null;
  const holder = s.offices[at] as OfficeHolder;
  s.offices.splice(at, 1);
  const p = personGet(s, holder.person);
  if (p !== undefined) {
    const line = [...p.career].reverse().find((c) => c.to === null && seatKey(c.seat) === key);
    if (line !== undefined) {
      line.to = date;
      line.exit = exit;
    }
    if (!s.offices.some((o) => o.person === p.id)) {
      p.status =
        exit === "Died"
          ? "Dead"
          : exit === "Retired" || exit === "Resigned" || exit === "Removed"
            ? "Retired"
            : "Bench";
      if (p.status !== "Bench") p.left = date;
    }
  }
  if (vacate) s.vacancies.push({ seat, since: date, fill: vacancyFillOf(seat), special: null });
  return holder.person;
}

/**
 * How a vacant seat is filled (pivot 6.1 "by office", T; lane C may refine by state): the
 * presidency by succession, a House seat by special election, everything else by appointment
 * (a Senate seat by the governor until a special election, which lane E schedules for it too).
 */
export function vacancyFillOf(seat: OfficeSeat): VacancyFill {
  switch (seat.kind) {
    case "President":
      return "Succession";
    case "House":
      return "Special";
    default:
      return "Appointment";
  }
}
