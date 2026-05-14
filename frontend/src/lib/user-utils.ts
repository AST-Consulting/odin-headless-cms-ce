import { UserData, Property, Permission } from "./types";

/**
 * Extracts property-specific context (status, roles, permissions) from a user document
 * based on the currently selected property.
 */
export function getUserPropertyContext(user: UserData, selectedProperty: Property | null) {
  const propId = selectedProperty?._id || "";
  const propMembership = user.properties?.find(p => p.id === propId || p._id === propId);
  
  return {
    propId,
    status: (propMembership?.status || user.status || "inactive").toLowerCase(),
    roles: propMembership?.roles || [],
    permissions: propMembership?.permissions || [],
    isAssigned: !!propMembership,
  };
}

/**
 * Formats a phone number for display, handling both string and object formats.
 */
export function formatPhoneNumber(phone: string | { fullNumber?: string; number?: string } | null | undefined): string {
  if (!phone) return "No phone";
  if (typeof phone === "string") return phone;
  return phone.fullNumber || phone.number || "No phone";
}

/**
 * Safely extracts a string ID from various formats (string, MongoDB $oid object).
 */
export function getStringId(id: string | { $oid: string } | null | undefined): string {
  if (!id) return "";
  if (typeof id === "string") return id;
  if (typeof id === "object" && id && "$oid" in id) return id.$oid;
  return String(id || "");
}

/**
 * Checks if a user is a SuperAdmin (either globally or in the current context).
 */
export function isUserSuperAdmin(user: UserData, roles: Array<{ id: string; name: string }> = []) {
  if (user.userType === "superadmin") return true;
  return roles.some(role => (role.name || "").toUpperCase() === "SUPERADMIN");
}
