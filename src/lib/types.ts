export type Role = "passenger" | "driver" | "admin";
export type UserStatus = "pending" | "approved" | "rejected";
export type RideStatus = "open" | "full" | "completed" | "cancelled";
export type BookingStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "completed"
  | "cancelled";
export type PaymentMethod = "cash" | "qr";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
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
  ride_id: string;
  passenger_id: string;
  status: BookingStatus;
  payment_method: PaymentMethod;
  created_at: string;
  updated_at: string;
  passenger_name?: string;
  passenger_email?: string;
  passenger_student_number?: string;
  from_zone?: string;
  to_zone?: string;
  departure_at?: string;
  flat_rate?: number;
  driver_name?: string;
};

export type AuditLog = {
  id: string;
  actor_id: string | null;
  action: string;
  details: string;
  created_at: string;
  actor_name?: string;
};
