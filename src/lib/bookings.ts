/** New requests own their route; the optional ride link preserves earlier bookings. */
export const BOOKING_SELECT = `SELECT b.*, p.name as passenger_name,
  p.email as passenger_email, p.phone_number as passenger_phone,
  p.student_number as passenger_student_number,
  d.name as driver_name, d.phone_number as driver_phone,
  r.status as ride_status, r.flat_rate, r.seats_available
  FROM bookings b JOIN users p ON p.id=b.passenger_id
  LEFT JOIN users d ON d.id=b.driver_id LEFT JOIN rides r ON r.id=b.ride_id`;
