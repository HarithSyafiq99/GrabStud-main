import { getSession, requireApproved, requireRole } from "@/lib/auth";
import { handleError, jsonError } from "@/lib/http";
export async function POST() {
  try {
    requireApproved(requireRole(await getSession(), ["passenger"]));
    return jsonError(
      "Create a request with your pickup and destination on the passenger dashboard.",
      405,
    );
  } catch (error) {
    return handleError(error);
  }
}
