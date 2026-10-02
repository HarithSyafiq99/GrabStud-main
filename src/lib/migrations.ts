import type { Client } from "@libsql/client";
import { SCHEMA_SQL } from "./schema";

/** Preserve existing users and bookings when upgrading from the original schema. */
export async function initializeSchema(db: Client) {
  const tx = await db.transaction("write");
  try {
    for (const sql of SCHEMA_SQL.split(";")
      .map((s) => s.trim())
      .filter(Boolean))
      await tx.execute(sql);
    const users = await tx.execute("PRAGMA table_info(users)");
    if (!users.rows.some((r) => r.name === "phone_number"))
      await tx.execute(
        "ALTER TABLE users ADD COLUMN phone_number TEXT NOT NULL DEFAULT ''",
      );
    const table = await tx.execute(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='bookings'",
    );
    const columns = await tx.execute("PRAGMA table_info(bookings)");
    const hasPrice = columns.rows.some((r) => r.name === "quoted_price");
    const hasRoutes = columns.rows.some((r) => r.name === "from_zone");
    const hasDriver = columns.rows.some((r) => r.name === "driver_id");
    const rideRequired = columns.rows.some(
      (r) => r.name === "ride_id" && Number(r.notnull) === 1,
    );
    if (
      !String(table.rows[0]?.sql).includes("'offered'") ||
      !hasPrice ||
      !hasRoutes ||
      !hasDriver ||
      rideRequired
    ) {
      const bookingSchema = SCHEMA_SQL.split(";").find((s) =>
        s.includes("CREATE TABLE IF NOT EXISTS bookings"),
      )!;
      await tx.execute(
        bookingSchema.replace(
          "CREATE TABLE IF NOT EXISTS bookings",
          "CREATE TABLE bookings_v2",
        ),
      );
      const price = hasPrice
        ? "b.quoted_price"
        : "CASE WHEN b.status IN ('accepted','completed') THEN r.flat_rate * 100 ELSE NULL END";
      await tx.execute(
        "INSERT INTO bookings_v2 (id,ride_id,driver_id,from_zone,to_zone,departure_at,passenger_id,status,quoted_price,payment_method,created_at,updated_at) " +
          "SELECT b.id,b.ride_id," +
          (hasDriver ? "b.driver_id" : "r.driver_id") +
          "," +
          (hasRoutes
            ? "b.from_zone,b.to_zone,b.departure_at"
            : "r.from_zone,r.to_zone,r.departure_at") +
          ",b.passenger_id,b.status," +
          price +
          ",b.payment_method,b.created_at,b.updated_at FROM bookings b LEFT JOIN rides r ON r.id=b.ride_id",
      );
      await tx.execute("DROP TABLE bookings");
      await tx.execute("ALTER TABLE bookings_v2 RENAME TO bookings");
      await tx.execute("CREATE INDEX idx_bookings_ride ON bookings(ride_id)");
      await tx.execute(
        "CREATE INDEX idx_bookings_passenger ON bookings(passenger_id)",
      );
    }
    await tx.execute(
      "CREATE INDEX IF NOT EXISTS idx_bookings_driver ON bookings(driver_id)",
    );
    await tx.execute(
      "CREATE INDEX IF NOT EXISTS idx_bookings_route ON bookings(from_zone,to_zone,departure_at)",
    );
    // Update only the original synthetic accounts; other student emails remain intact.
    const demos = [
      ["demo-passenger", "passenger"],
      ["demo-driver", "driver"],
      ["demo-driver-2", "sarah"],
      ["demo-pending", "alya"],
    ];
    for (const [i, [id, name]] of demos.entries()) {
      await tx.execute({
        sql: "UPDATE users SET email=?, phone_number=CASE WHEN phone_number='' THEN ? ELSE phone_number END WHERE id=? AND email=? AND NOT EXISTS (SELECT 1 FROM users WHERE email=?)",
        args: [
          name + "@grabstudent.com",
          "+6010000000" + i,
          id,
          name + "@grabstudent.edu",
          name + "@grabstudent.com",
        ],
      });
    }
    await tx.execute({
      sql: "UPDATE users SET email='admin@grabstudent.com' WHERE email='admin@grabstudent.edu' AND role='admin' AND student_number='ADMIN-0001' AND name='Platform Admin' AND NOT EXISTS (SELECT 1 FROM users WHERE email='admin@grabstudent.com')",
      args: [],
    });
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    tx.close();
  }
}
