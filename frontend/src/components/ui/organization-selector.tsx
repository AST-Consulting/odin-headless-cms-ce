'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Building, ChevronDown, Check, Loader2 } from 'lucide-react';
import { useOrganizationStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Organization } from '@/lib/types';

interface OrganizationSelectorProps {
  className?: string;
}

export default function OrganizationSelector({
  className = ""
}: OrganizationSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { 
    selectedOrganization, 
    organizations, 
    fetchOrganizations, 
    setSelectedOrganization,
    isFetching 
  } = useOrganizationStore();

  // Fetch organizations on mount
  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (org: Organization) => {
    setSelectedOrganization(org);
    setIsOpen(false);
  };

  const currentOrgName = selectedOrganization?.name || selectedOrganization?.legal_name || 'Select Organization';

  return (
    <div className={cn("relative z-50", className)} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 text-sm font-semibold group",
          "bg-white border border-slate-200 shadow-sm hover:border-primary/50 hover:shadow-md",
          "dark:bg-[#1A1C1E] dark:border-slate-800 dark:hover:border-primary/50",
          isOpen && "ring-2 ring-primary/20 border-primary"
        )}
      >
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
          <Building className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 text-left truncate flex flex-col items-start leading-tight">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Organization</span>
          <span className="truncate w-full">{currentOrgName}</span>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className={cn(
          "absolute top-full left-0 right-0 mt-2 p-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200",
          "dark:bg-[#1A1C1E] dark:border-slate-800"
        )}>
          {isFetching && organizations.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              Loading Organizations...
            </div>
          ) : organizations.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No organizations found
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto custom-scrollbar">
              {organizations.map((org) => (
                <button
                  key={org._id}
                  onClick={() => handleSelect(org)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors group",
                    selectedOrganization?._id === org._id 
                      ? "bg-primary/5 text-primary font-bold" 
                      : "text-foreground hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  )}
                >
                  <div className={cn(
                    "w-6 h-6 rounded flex items-center justify-center shrink-0",
                    selectedOrganization?._id === org._id ? "bg-primary/20" : "bg-muted"
                  )}>
                    <Building className="w-3 h-3" />
                  </div>
                  <span className="flex-1 text-left truncate">{org.name || org.legal_name}</span>
                  {selectedOrganization?._id === org._id && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
