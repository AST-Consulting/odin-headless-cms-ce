"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { RotateCcw, CheckSquare } from "lucide-react";
import { MODULE_NAMES, MODULE_VALUES, PERMISSION_ACTIONS } from "@/lib/constants";

interface Permission {
  module: string;
  actions: string[];
}

interface PermissionTableProps {
  permissions: Permission[];
  onChange: (permissions: Permission[]) => void;
  disabled?: boolean;
}

/**
 * Reusable Permission Table Component
 * Allows granular selection of module-level actions
 */
export function PermissionTable({ permissions, onChange, disabled }: PermissionTableProps) {
  
  /**
   * Toggle individual permission action for a module
   */
  const handleTogglePermission = (module: string, action: string) => {
    const existing = permissions.find(p => p.module === module);
    let newPermissions = [...permissions];

    if (existing) {
      const newActions = existing.actions.includes(action)
        ? existing.actions.filter(a => a !== action)
        : [...existing.actions, action];
      
      if (newActions.length === 0) {
        newPermissions = newPermissions.filter(p => p.module !== module);
      } else {
        newPermissions = newPermissions.map(p => 
          p.module === module ? { ...p, actions: newActions } : p
        );
      }
    } else {
      newPermissions.push({ module, actions: [action] });
    }
    onChange(newPermissions);
  };

  /**
   * Toggle all actions for a specific module
   */
  const handleToggleModuleAll = (module: string, isAllSelected: boolean) => {
    let newPermissions = [...permissions];
    if (isAllSelected) {
      newPermissions = newPermissions.filter(p => p.module !== module);
    } else {
      const allActions = Object.values(PERMISSION_ACTIONS) as string[];
      const existing = newPermissions.find(p => p.module === module);
      if (existing) {
        newPermissions = newPermissions.map(p => 
          p.module === module ? { ...p, actions: allActions } : p
        );
      } else {
        newPermissions.push({ module, actions: allActions });
      }
    }
    onChange(newPermissions);
  };

  /**
   * Select all actions for ALL modules
   */
  const handleSelectAll = () => {
    const allActions = Object.values(PERMISSION_ACTIONS) as string[];
    const newPermissions = Object.entries(MODULE_NAMES).map(([_, label]) => ({
      module: (MODULE_VALUES as any)[label],
      actions: allActions
    }));
    onChange(newPermissions);
  };

  /**
   * Reset all permissions
   */
  const handleReset = () => {
    onChange([]);
  };

  return (
    <div className="space-y-4 pt-2">
      {/* Global Action Bar — Matches Role Page Design */}
      {!disabled && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1">
          <h3 className="text-base font-medium">Permissions</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              className="whitespace-nowrap flex items-center gap-1.5"
            >
              <RotateCcw className="h-4 w-4 shrink-0" />
              Select All
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="whitespace-nowrap flex items-center gap-1.5"
            >
              <RotateCcw className="h-4 w-4 shrink-0" />
              Reset
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-x-auto shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900/50">
            <tr>
              <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Module</th>
              <th className="px-4 py-3 text-center font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">All</th>
              {Object.values(PERMISSION_ACTIONS).map(action => (
                <th key={action} className="px-4 py-3 text-center font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap text-[10px]">
                  {action}
                </th>
              ))}
            </tr>
          </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
          {Object.entries(MODULE_NAMES).map(([key, label]) => {
            const moduleValue = (MODULE_VALUES as any)[label];
            const modulePerm = permissions.find(p => p.module === moduleValue);
            // All actions are defined by the PERMISSION_ACTIONS constant
            const isAllSelected = modulePerm?.actions.length === Object.values(PERMISSION_ACTIONS).length;
            
            return (
              <tr key={moduleValue} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-4 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  {label}
                </td>
                <td className="px-4 py-4 text-center">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={() => handleToggleModuleAll(moduleValue, isAllSelected)}
                    disabled={disabled}
                    className="h-5 w-5 rounded-md border-slate-400 dark:border-slate-500 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                </td>
                {Object.values(PERMISSION_ACTIONS).map(action => (
                  <td key={action} className="px-4 py-4 text-center">
                    <Checkbox
                      checked={modulePerm?.actions.includes(action as string)}
                      onCheckedChange={() => handleTogglePermission(moduleValue, action as string)}
                      disabled={disabled}
                      className="h-5 w-5 rounded-md border-slate-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary shadow-sm"
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
