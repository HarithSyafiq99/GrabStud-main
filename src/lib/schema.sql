-- GrabStudent schema (Turso / SQLite)

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone_number TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  session_version INTEGER NOT NULL DEFAULT 0,
  student_number TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('passenger', 'driver', 'admin')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  student_id_doc TEXT,
  license_doc TEXT,
  profile_photo TEXT,
  car_colour TEXT NOT NULL DEFAULT '',
  car_type TEXT NOT NULL DEFAULT '',
  car_plate TEXT NOT NULL DEFAULT '',
  onboarding_seen_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rides (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_zone TEXT NOT NULL,
  to_zone TEXT NOT NULL,
  departure_at TEXT NOT NULL,
  seats_total INTEGER NOT NULL CHECK (seats_total BETWEEN 1 AND 4),
  seats_available INTEGER NOT NULL,
  flat_rate INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'full', 'completed', 'cancelled')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  ride_id TEXT REFERENCES rides(id) ON DELETE CASCADE,
  driver_id TEXT REFERENCES users(id),
  from_zone TEXT NOT NULL,
  to_zone TEXT NOT NULL,
  departure_at TEXT NOT NULL,
  passenger_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'offered', 'accepted', 'rejected', 'completed', 'cancelled')),
  quoted_price INTEGER CHECK (quoted_price > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'qr')),
  pickup_note TEXT NOT NULL DEFAULT '',
  arrived_at TEXT,
  arrival_acknowledged_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (ride_id, passenger_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_rides_departure ON rides(departure_at);
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);
CREATE INDEX IF NOT EXISTS idx_bookings_ride ON bookings(ride_id);
CREATE INDEX IF NOT EXISTS idx_bookings_passenger ON bookings(passenger_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
