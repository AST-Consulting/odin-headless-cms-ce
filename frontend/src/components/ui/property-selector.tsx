'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Building2 } from 'lucide-react';
import { getProperties } from '@/lib/api';
import { Property } from '@/lib/types';
import { usePropertyStore, useOrganizationStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface PropertyDropdownProps {
  onPropertyChange?: (propertyId: string) => void;
  className?: string;
}

export default function PropertyDropdown({
  onPropertyChange,
  className = ""
}: PropertyDropdownProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hasFetchedList = useRef(false);
  const { selectedProperty, setSelectedProperty } = usePropertyStore();
  const { selectedOrganization } = useOrganizationStore();

  // Reset fetched flag when organization changes
  useEffect(() => {
    hasFetchedList.current = false;
    setProperties([]);
    // Do not auto-close dropdown if it was open, just let it re-fetch on next render if needed
  }, [selectedOrganization]);

  // Only fetch the properties list when dropdown is opened (for switching)
  const fetchPropertiesList = useCallback(async () => {
    if (!selectedOrganization) return;
    if (hasFetchedList.current && properties.length > 0) return;

    try {
      setLoading(true);
      setError(null);
      const data = await getProperties(selectedOrganization._id);
      setProperties(data);
      hasFetchedList.current = true;
    } catch (error) {
      console.error('Failed to fetch properties:', error);
      setError(error instanceof Error ? error.message : 'Failed to load properties');
    } finally {
      setLoading(false);
    }
  }, [selectedOrganization, properties.length]);

  // Fetch list when dropdown opens
  useEffect(() => {
    if (isDropdownOpen) {
      fetchPropertiesList();
    }
  }, [isDropdownOpen, fetchPropertiesList]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handlePropertySelect = (propertyId: string) => {
    setIsDropdownOpen(false);
    const propertyObject = properties.find(p => p._id === propertyId);
    if (propertyObject) {
      setSelectedProperty(propertyObject);
    }
    if (onPropertyChange) {
      onPropertyChange(propertyId);
    }
  };

  const selectedPropertyName = selectedProperty?.domain || 'Select Property';

  // Show loading only if no property is selected yet (initial load handled by PropertyInitializer)
  if (!selectedProperty && loading) {
    return (
      <div className={`px-3 py-2 text-sm text-muted-foreground ${className}`}>
        Loading...
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm cursor-pointer",
          "border border-border hover:bg-muted hover:border-muted-foreground/30",
          "dark:border-[hsl(230_20%_20%)] dark:hover:bg-[hsl(220_20%_18%)] dark:hover:border-[hsl(230_20%_30%)]"
        )}
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      >
        <Building2 className="w-4 h-4 flex-shrink-0" />
        <a 
          href={selectedProperty?.domain ? (selectedProperty.domain.startsWith('http') ? selectedProperty.domain : `https://${selectedProperty.domain}`) : '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-left truncate hover:underline hover:text-primary transition-colors"
          onClick={(e) => e.stopPropagation()}
          title="Visit Property"
        >
          {selectedPropertyName}
        </a>
        <svg
          className="w-4 h-4 fill-current flex-shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
        >
          <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
        </svg>
      </div>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div className="absolute top-full left-0 mt-1 w-full bg-card border border-border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto dark:bg-[hsl(230_25%_11%)] dark:border-[hsl(230_20%_20%)] dark:shadow-[0_10px_40px_-10px_hsl(0_0%_0%/0.6),0_0_1px_0_hsl(230_20%_30%)]">
          {loading ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">Loading...</div>
          ) : error ? (
            <div className="px-3 py-2 text-sm text-red-500">{error}</div>
          ) : properties.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">No properties found</div>
          ) : (
            properties.map((property) => (
              <button
                key={property._id}
                className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-muted first:rounded-t-md last:rounded-b-md transition-colors dark:hover:bg-[hsl(220_20%_16%)]"
                onClick={() => handlePropertySelect(property._id)}
              >
                <div className="font-medium">{property.domain}</div>
                <div className="text-xs text-muted-foreground dark:text-[hsl(215_20%_65%)]">{property.domain}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}