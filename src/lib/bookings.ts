/** New requests own their route; the optional ride link preserves earlier bookings. */
export const BOOKING_SELECT = `SELECT b.*, p.name as passenger_name,
  p.email as passenger_email, p.phone_number as passenger_phone,
  p.student_number as passenger_student_number,
  d.name as driver_name, d.phone_number as driver_phone,
  p.profile_photo as passenger_photo, d.profile_photo as driver_photo,
  d.car_colour, d.car_type, d.car_plate,
  (SELECT AVG(review.rating_score) FROM bookings review WHERE review.driver_id=b.driver_id AND review.rated_at IS NOT NULL) as driver_rating_average,
  (SELECT COUNT(*) FROM bookings review WHERE review.driver_id=b.driver_id AND review.rated_at IS NOT NULL) as driver_rating_count,
  r.status as ride_status, r.flat_rate, r.seats_available
  FROM bookings b JOIN users p ON p.id=b.passenger_id
  LEFT JOIN users d ON d.id=b.driver_id LEFT JOIN rides r ON r.id=b.ride_id`;
