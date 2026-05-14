"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/auth";
import { useOrganizationStore, usePropertyStore } from "@/lib/store";
import { getContextPermissions } from "@/lib/api";

export function SecurityContextSync() {
  const { token, setContext, hasHydrated } = useAuthStore();
  const { selectedOrganization } = useOrganizationStore();
  const { selectedProperty } = usePropertyStore();

  useEffect(() => {
    // Only fetch once stores are hydrated from localStorage
    if (!hasHydrated || !token || !selectedOrganization?._id) return;

    const syncPermissions = async () => {
      try {
        const { roles, permissions } = await getContextPermissions(
            selectedOrganization._id, 
            selectedProperty?._id
        );
        setContext(roles, permissions);
      } catch (error) {
        console.error("Failed to sync security context on mount:", error);
      }
    };

    syncPermissions();
  }, [token, selectedOrganization?._id, selectedProperty?._id, hasHydrated, setContext]);

  return null;
}
