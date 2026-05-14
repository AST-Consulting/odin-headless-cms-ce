"use client";

import { useEffect } from "react";
import { usePropertyStore } from "@/lib/store";

export function PropertyInitializer() {
    const fetchProperty = usePropertyStore((state) => state.fetchProperty);

    useEffect(() => {
        fetchProperty();
    }, [fetchProperty]);

    return null;
}
