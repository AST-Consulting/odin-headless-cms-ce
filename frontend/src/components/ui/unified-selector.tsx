'use client';

import { useState, useEffect, useRef } from 'react';
import { Building, ChevronDown, Check, Loader2, Globe, Building2, Search } from 'lucide-react';
import { useOrganizationStore, usePropertyStore } from '@/lib/store';
import { useAuthStore } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Organization, Property } from '@/lib/types';
import { getProperties } from '@/lib/api';

interface UnifiedSelectorProps {
  className?: string;
}

export default function UnifiedSelector({
  className = ""
}: UnifiedSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [orgProperties, setOrgProperties] = useState<Record<string, Property[]>>({});
  const [loadingProps, setLoadingProps] = useState<Record<string, boolean>>({});

  // 1. Hooks & Refs
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();
  
  const {
      selectedOrganization,
      organizations: storeOrgs,
      setSelectedOrganization,
      isFetching: isFetchingOrgs
  } = useOrganizationStore();

  const {
      selectedProperty,
      setSelectedProperty
  } = usePropertyStore();

  // 2. Computed Values
  const authorizedOrgs = storeOrgs.length > 0 ? storeOrgs : (user?.organizations || []);

  const filteredOrgs = authorizedOrgs.filter(org => {
    const orgId = (org as any).id || (org as any)._id;
    const orgRawName = (org as any).name || (org as any).organization_name || (org as any).organizationName || (org as any).legal_name || "";
    const searchStr = orgRawName.toLowerCase();
    const matchesOrg = searchStr.includes(searchTerm.toLowerCase());
    const matchesProps = (orgProperties[orgId] || []).some(p => p.domain.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesOrg || matchesProps;
  });

  // 3. Sync State (No logs needed)
  useEffect(() => {
    // Syncing...
  }, [authorizedOrgs.length, filteredOrgs.length]);

  // Fetch organizations on mount to keep details synced, but rely on user profile for the list
  useEffect(() => {
    // We still fetch to ensure the global store is warm, 
    // but we'll use authorizedOrgs for the UI mapping
    const { fetchOrganizations } = useOrganizationStore.getState();
    fetchOrganizations();
  }, []);

  // Fetch properties for each organization when dropdown opens or organizations change
  useEffect(() => {
    if (!isOpen || authorizedOrgs.length === 0) return;

    authorizedOrgs.forEach(async (org) => {
      const orgId = (org as any).id || (org as any)._id;
      if (!orgId) return;

      const isSelected = selectedOrganization?._id === orgId;
      // Skip if already loading
      if (loadingProps[orgId]) return;
      // Skip if we have data and it's NOT the selected organization (to save bandwidth)
      if (orgProperties[orgId] && !isSelected) return;

      setLoadingProps(prev => ({ ...prev, [orgId]: true }));
      try {
        const props = await getProperties(orgId);
        const propsArray = Array.isArray(props) ? props : [];
        setOrgProperties(prev => ({ ...prev, [orgId]: propsArray }));
      } catch (err) {
        console.error(`Failed to fetch properties for ${orgId}:`, err);
      } finally {
        setLoadingProps(prev => ({ ...prev, [orgId]: false }));
      }
    });
  }, [isOpen, authorizedOrgs.length]);

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

  const handleSelect = (org: Organization, prop?: Property) => {
    setSelectedOrganization(org);
    if (prop) {
      setSelectedProperty(prop);
    }
    setIsOpen(false);
  };

  const currentOrgName = selectedOrganization?.name || (selectedOrganization as any)?.organization_name || (selectedOrganization as any)?.organizationName || (selectedOrganization as any)?.legal_name || 'Select Organization';
  const currentPropName = selectedProperty?.domain || 'Select Property';

  return (
    <div className={cn("relative z-50", className)} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 text-sm font-semibold group relative overflow-hidden",
          "bg-white border border-slate-200 shadow-sm hover:border-primary/50 hover:shadow-lg",
          "dark:bg-[#1A1C1E] dark:border-slate-800 dark:hover:border-primary/50",
          isOpen && "ring-2 ring-primary/20 border-primary shadow-primary/10"
        )}
      >
        <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-full -mr-8 -mt-8 blur-2xl group-hover:bg-primary/10 transition-colors" />

        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-all duration-300 group-hover:scale-110 shadow-inner">
          <Building2 className="w-5 h-5 text-primary" />
        </div>

        <div className="flex-1 text-left truncate flex flex-col items-start gap-0.5 leading-none h-9 justify-center">
          <div className="flex items-center gap-1.5 w-full">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-black">Context</span>
            <div className="h-[2px] w-4 bg-primary/20 rounded-full" />
          </div>
          <div className="w-full flex flex-col items-start">
            <span className="text-xs font-black truncate w-full text-slate-900 dark:text-slate-100">{currentOrgName}</span>
            <div className="flex items-center gap-1 w-full opacity-60">
              <Globe className="w-2.5 h-2.5 text-primary" />
              <span className="text-[9px] font-bold truncate text-slate-500 dark:text-slate-400">{currentPropName}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-0.5 px-1 py-2 rounded-md bg-slate-50 dark:bg-white/5 transition-colors group-hover:bg-primary/5">
          <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform duration-300", isOpen && "rotate-180")} />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className={cn(
          "absolute top-full left-0 right-0 mt-2 p-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 w-[280px] md:w-[320px]",
          "dark:bg-[#111315] dark:border-white/10"
        )}>
          {/* Search Header */}
          <div className="px-2 pb-2 mb-2 border-b border-slate-100 dark:border-white/5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search organizations or properties..."
                className="w-full h-9 pl-9 pr-3 bg-slate-50 dark:bg-white/5 border-none rounded-xl text-xs font-bold focus:ring-1 focus:ring-primary/30 transition-all outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {(isFetchingOrgs || Object.values(loadingProps).some(v => v)) && authorizedOrgs.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                <Building2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 text-primary" />
              </div>
              <span className="font-black uppercase tracking-widest text-[10px]">Synchronizing...</span>
            </div>
          ) : filteredOrgs.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground italic">
              No matching records found
            </div>
          ) : (
            <div className="max-h-[70vh] overflow-y-auto custom-scrollbar pr-1">
              {filteredOrgs.map((org: any) => {
                const orgId = org.id || org._id;
                const props = orgProperties[orgId] || [];
                const isLoading = loadingProps[orgId];
                const isOrgSelected = selectedOrganization?._id === orgId;
                const orgName = org.name || org.organization_name || org.organizationName || org.legal_name || "Unknown Org";

                return (
                  <div key={orgId} className="mb-4 last:mb-0">
                    {/* Organization Banner */}
                    <button
                      onClick={() => handleSelect(org)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-xl mb-1 sticky top-0 bg-white dark:bg-[#111315] z-10 transition-colors text-left",
                        isOrgSelected ? "text-primary bg-primary/5" : "text-muted-foreground hover:bg-slate-50 dark:hover:bg-white/5"
                      )}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-black uppercase tracking-widest truncate flex-1">{orgName}</span>
                      {isOrgSelected && <div className="w-1 h-1 rounded-full bg-primary" />}
                    </button>

                    {/* Properties List */}
                    <div className="space-y-0.5 mt-1 ml-1 pl-3 border-l-2 border-slate-100 dark:border-white/5">
                      {isLoading ? (
                        <div className="py-2 pl-4 text-[10px] text-muted-foreground italic flex items-center gap-2">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Loading properties...
                        </div>
                      ) : props.length === 0 ? (
                        <div className="py-2 pl-4 text-[10px] text-muted-foreground italic">
                          No properties found
                        </div>
                      ) : (
                        props.map((prop) => {
                          const isPropSelected = selectedProperty?._id === prop._id;
                          return (
                            <button
                              key={prop._id}
                              onClick={() => handleSelect(org, prop)}
                              className={cn(
                                "w-full flex items-center gap-3 px-3 py-2 text-xs rounded-xl transition-all group",
                                isPropSelected
                                  ? "bg-primary text-white font-black shadow-lg shadow-primary/20 scale-[0.98]"
                                  : "text-foreground hover:bg-slate-50 dark:hover:bg-white/5"
                              )}
                            >
                              <Globe className={cn("w-3.5 h-3.5 shrink-0", isPropSelected ? "text-white" : "text-primary/50 group-hover:text-primary")} />
                              <div className="flex-1 text-left flex flex-col items-start leading-tight">
                                <span className="truncate w-full">{prop.domain}</span>
                              </div>
                              {isPropSelected ? (
                                <div className="bg-white/20 p-1 rounded-full">
                                  <Check className="w-2.5 h-2.5" />
                                </div>
                              ) : (
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-white/10 group-hover:bg-primary/30 transition-colors" />
                              )}
                            </button>
                          );
                        })
                      )}

                      {/* Option to select just the organization if no properties */}
                      {props.length === 0 && !isLoading && (
                        <button
                          onClick={() => handleSelect(org)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 text-[11px] rounded-xl transition-all mt-1",
                            isOrgSelected 
                              ? "bg-primary/20 text-primary font-bold border border-primary/20" 
                              : "text-muted-foreground hover:bg-slate-50 dark:hover:bg-white/5 border border-dashed border-slate-200 dark:border-white/5"
                          )}
                        >
                          <Building className="w-3.5 h-3.5" />
                          <span className="flex-1 text-left font-bold uppercase tracking-tight">Select Organization Only</span>
                          <ChevronDown className="w-3 h-3 -rotate-90 opacity-40" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
