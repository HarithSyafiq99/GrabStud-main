export const ZONES = [
  "Main Campus",
  "Library",
  "Faculty of Engineering",
  "Faculty of Business",
  "Hostel A",
  "Hostel B",
  "Sports Complex",
  "KTM / Bus Station",
  "Town / Off-Campus",
] as const;

export type Zone = (typeof ZONES)[number];

/** Static petrol-sharing rates in MYR. Drivers cannot override these. */
const RATE_TABLE: Record<string, number> = {
  "Main Campus|Library": 3,
  "Main Campus|Faculty of Engineering": 4,
  "Main Campus|Faculty of Business": 4,
  "Main Campus|Hostel A": 5,
  "Main Campus|Hostel B": 5,
  "Main Campus|Sports Complex": 4,
  "Main Campus|KTM / Bus Station": 7,
  "Main Campus|Town / Off-Campus": 10,
  "Library|Faculty of Engineering": 3,
  "Library|Faculty of Business": 3,
  "Library|Hostel A": 5,
  "Library|Hostel B": 5,
  "Library|Sports Complex": 4,
  "Library|KTM / Bus Station": 7,
  "Library|Town / Off-Campus": 10,
  "Faculty of Engineering|Faculty of Business": 4,
  "Faculty of Engineering|Hostel A": 6,
  "Faculty of Engineering|Hostel B": 6,
  "Faculty of Engineering|Sports Complex": 4,
  "Faculty of Engineering|KTM / Bus Station": 8,
  "Faculty of Engineering|Town / Off-Campus": 11,
  "Faculty of Business|Hostel A": 6,
  "Faculty of Business|Hostel B": 6,
  "Faculty of Business|Sports Complex": 4,
  "Faculty of Business|KTM / Bus Station": 8,
  "Faculty of Business|Town / Off-Campus": 11,
  "Hostel A|Hostel B": 3,
  "Hostel A|Sports Complex": 5,
  "Hostel A|KTM / Bus Station": 8,
  "Hostel A|Town / Off-Campus": 12,
  "Hostel B|Sports Complex": 5,
  "Hostel B|KTM / Bus Station": 8,
  "Hostel B|Town / Off-Campus": 12,
  "Sports Complex|KTM / Bus Station": 7,
  "Sports Complex|Town / Off-Campus": 10,
  "KTM / Bus Station|Town / Off-Campus": 6,
};

export function getFlatRate(from: string, to: string): number {
  if (from === to) return 2;
  const key = `${from}|${to}`;
  const reverse = `${to}|${from}`;
  return RATE_TABLE[key] ?? RATE_TABLE[reverse] ?? 6;
}

export const MAX_SEATS = 4;
