export type Role = "passenger" | "driver" | "admin";
export type UserStatus = "pending" | "approved" | "rejected";
export type RideStatus = "open" | "full" | "completed" | "cancelled";
export type BookingStatus =
  | "pending"
  | "offered"
  | "accepted"
  | "rejected"
  | "completed"
  | "cancelled";
export type PaymentMethod = "cash" | "qr";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  phone_number: string;
  role: Role;
  status: UserStatus;
  profile_photo: string | null;
  car_colour: string;
  car_type: string;
  car_plate: string;
  onboarding_seen_at: string | null;
  session_version: number;
};

export type UserRecord = SessionUser & {
  student_number: string;
  student_id_doc: string | null;
  license_doc: string | null;
  created_at: string;
  updated_at: string;
};

export type RideRecord = {
  id: string;
  driver_id: string;
  from_zone: string;
  to_zone: string;
  departure_at: string;
  seats_total: number;
  seats_available: number;
  flat_rate: number;
  status: RideStatus;
  created_at: string;
  driver_name?: string;
};

export type BookingRecord = {
  id: string;
  ride_id: string | null;
  driver_id: string | null;
  passenger_id: string;
  passenger_count: number;
  status: BookingStatus;
  quoted_price: number | null; // Malaysian sen.
  payment_method: PaymentMethod;
  created_at: string;
  updated_at: string;
  passenger_name?: string;
  passenger_email?: string;
  passenger_phone?: string;
  driver_phone?: string;
  passenger_student_number?: string;
  from_zone: string;
  to_zone: string;
  departure_at: string;
  ride_status?: RideStatus | null;
  flat_rate?: number;
  driver_name?: string;
  pickup_note: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  destination_lat: number | null;
  destination_lng: number | null;
  arrived_at: string | null;
  arrival_acknowledged_at: string | null;
  rating_score?: number | null;
  rating_feedback?: string | null;
  rated_at?: string | null;
  driver_rating_average?: number | null;
  driver_rating_count?: number;
  passenger_photo?: string | null;
  driver_photo?: string | null;
  car_colour?: string;
  car_type?: string;
  car_plate?: string;
};

export type AuditLog = {
  id: string;
  actor_id: string | null;
  action: string;
  details: string;
  created_at: string;
  actor_name?: string;
};
