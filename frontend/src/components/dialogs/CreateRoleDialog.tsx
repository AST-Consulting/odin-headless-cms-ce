"use client";

import { useState, useEffect } from "react";
import { Plus, ChevronDown, ChevronRight, RotateCcw, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createRole, updateRole } from "@/lib/api";
import {
  MODULE_NAMES,
  MODULE_VALUES,
  PERMISSION_ACTIONS,
  ROLE_STATUS,
  type ModuleValue,
  type PermissionAction
} from "@/lib/constants";
import { Role } from "@/lib/types";
import { toast } from "sonner";
import { Checkbox } from "../ui/checkbox";
import { Card, CardContent } from "../ui/card";
import { usePropertyStore } from "@/lib/store";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ModulePermissions {
  [key: string]: PermissionAction[];
}

interface CreateRoleDialogProps {
  onRoleCreated?: () => void;
  roleData?: Role | null;
  type?: "create" | "edit";
  onCancel?: () => void;
  onSuccess?: () => void;
}

export function CreateRoleDialog({ onRoleCreated, roleData, type = "create", onCancel, onSuccess }: CreateRoleDialogProps) {
  const [open, setOpen] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<ModulePermissions>({});
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const modules = Object.entries(MODULE_NAMES);
  const actions = Object.values(PERMISSION_ACTIONS);
  const isEditMode = type === "edit";
  const selectedProperty = usePropertyStore((state) => state.selectedProperty);

  // Populate form when roleData is provided (edit mode)
  useEffect(() => {
    if (type === "edit" && roleData) {
      setRoleName(roleData.name);

      // Convert permissions to the format expected by the form
      const permissions: ModulePermissions = {};
      roleData.permissions.forEach(permission => {
        permissions[permission.module] = permission.actions as PermissionAction[];
      });
      setSelectedPermissions(permissions);

      // Expand modules that have permissions
      const modulesToExpand = new Set<string>();
      roleData.permissions.forEach(permission => {
        const moduleEntry = Object.entries(MODULE_VALUES).find(
          ([_, value]) => value === permission.module
        );
        if (moduleEntry) {
          modulesToExpand.add(moduleEntry[0] as keyof typeof MODULE_NAMES);
        }
      });
      setExpandedModules(modulesToExpand);
    } 
  }, [roleData, type]);

  const toggleModule = (moduleName: string) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleName)) {
      newExpanded.delete(moduleName);
    } else {
      newExpanded.add(moduleName);
    }
    setExpandedModules(newExpanded);
  };

  const toggleAction = (module: string, action: PermissionAction) => {
    const moduleKey = MODULE_VALUES[module as keyof typeof MODULE_VALUES];
    const currentActions = selectedPermissions[moduleKey] || [];

    if (currentActions.includes(action)) {
      setSelectedPermissions({
        ...selectedPermissions,
        [moduleKey]: currentActions.filter(a => a !== action)
      });
    } else {
      setSelectedPermissions({
        ...selectedPermissions,
        [moduleKey]: [...currentActions, action]
      });
    }
  };

  const toggleSelectAll = (module: string) => {
    const moduleKey = MODULE_VALUES[module as keyof typeof MODULE_VALUES];
    const currentActions = selectedPermissions[moduleKey] || [];

    if (currentActions.length === actions.length) {
      // If all selected, deselect all
      const { [moduleKey]: removed, ...rest } = selectedPermissions;
      setSelectedPermissions(rest);
    } else {
      // Select all
      setSelectedPermissions({
        ...selectedPermissions,
        [moduleKey]: [...actions]
      });
    }
  };

  const collapseAll = () => {
    setExpandedModules(new Set());
  };

  const resetSelections = () => {
    setSelectedPermissions({});
  };

  const selectAll = () => {
    const allPermissions: ModulePermissions = {};
    Object.values(MODULE_VALUES).forEach((value) => {
      allPermissions[value] = [...actions];
    });
    setSelectedPermissions(allPermissions);
    
    // Also expand all modules so the user can see what's selected
    // setExpandedModules(new Set(Object.values(MODULE_NAMES)));
  };

  const isModuleSelected = (module: string) => {
    const moduleKey = MODULE_VALUES[module as keyof typeof MODULE_VALUES];
    return (selectedPermissions[moduleKey] || []).length > 0;
  };

  const isAllActionsSelected = (module: string) => {
    const moduleKey = MODULE_VALUES[module as keyof typeof MODULE_VALUES];
    return (selectedPermissions[moduleKey] || []).length === actions.length;
  };

  const isActionSelected = (module: string, action: PermissionAction) => {
    const moduleKey = MODULE_VALUES[module as keyof typeof MODULE_VALUES];
    return (selectedPermissions[moduleKey] || []).includes(action);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!roleName.trim()) {
      toast.error("Please enter a role name");
      return;
    }

    if (Object.keys(selectedPermissions).length === 0) {
      toast.error("Please select at least one permission");
      return;
    }

    setIsLoading(true);
    try {
      // For create mode, automatically add organizations and property modules
      let finalPermissions = { ...selectedPermissions };
      
      if (!isEditMode) {
        // Add organizations module with all permissions if not already present
        if (!finalPermissions[MODULE_VALUES[MODULE_NAMES.ORGANIZATIONS]]) {
          finalPermissions[MODULE_VALUES[MODULE_NAMES.ORGANIZATIONS]] = [...actions];
        }
        
        // Add property module with all permissions if not already present
        if (!finalPermissions[MODULE_VALUES[MODULE_NAMES.PROPERTY]]) {
          finalPermissions[MODULE_VALUES[MODULE_NAMES.PROPERTY]] = [...actions];
        }
      }

      // Get valid module values and actions to filter out legacy/invalid data
      const validModules = Object.values(MODULE_VALUES) as string[];
      const validActions = Object.values(PERMISSION_ACTIONS) as string[];

      const filteredPermissions = Object.entries(finalPermissions)
        .filter(([module]) => validModules.includes(module))
        .map(([module, actions]) => ({
          module,
          actions: actions.filter(action => validActions.includes(action)),
        }))
        .filter(p => p.actions.length > 0);

      const payload = {
        name: roleName.trim().toUpperCase(),
        status: ROLE_STATUS.ACTIVE,
        permissions: filteredPermissions,
      };

      if (isEditMode && roleData) {
        await updateRole(roleData._id, payload);
        toast.success("Role updated successfully");
      } else {
        await createRole(payload, selectedProperty?._id);
        toast.success("Role created successfully");
      }
      setRoleName("");
      setSelectedPermissions({});
      setExpandedModules(new Set());
      onSuccess?.();
    } catch (error: any) {
      console.error(`Failed to ${isEditMode ? 'update' : 'create'} role:`, error);
      toast.error(error.message || `Failed to ${isEditMode ? 'update' : 'create'} role`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="md:p-4 lg:p-8 p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{type === "create" ? "Create Role" : "Update Role"}</h1>
        <p className="text-muted-foreground">
          {type === "create" ? "Add a new role to your site" : "Update role details"}
        </p>
      </div>
      <form onSubmit={handleSubmit} className="md:space-y-6 space-y-4">
        <Card>
          <CardContent>
            <div className="md:gap-4 gap-3">
              <div className="space-y-2">
                <Label htmlFor="roleName">Role name *</Label>
                <Input
                  id="roleName"
                  placeholder="Role name *"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value.toUpperCase())}
                  className="w-full"
                />
              </div>

              <div className="space-y-4 md:col-span-2 p-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <h3 className="text-base font-medium">Permissions</h3>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={selectAll} className="whitespace-nowrap">
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Select All
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={resetSelections} className="whitespace-nowrap">
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Reset
                    </Button>
                  </div>
                </div>

                <div className="rounded-md border overflow-x-auto mt-4">
                  <Table className="min-w-[600px]">
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="font-semibold text-foreground py-4 w-[250px]">Module</TableHead>
                        <TableHead className="font-semibold text-foreground text-center w-[120px]">All</TableHead>
                        {actions.map((action) => (
                          <TableHead key={action} className="font-semibold text-foreground capitalize text-center">
                            {action}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {modules.map(([moduleKey, moduleName]) => {
                        if(moduleName === MODULE_NAMES.ORGANIZATIONS || moduleName === MODULE_NAMES.PROPERTY) return null;

                        return (
                          <TableRow key={moduleKey}>
                            <TableCell className="font-medium py-4">
                              {moduleName}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center">
                                <Checkbox
                                  id={`${moduleName}-all`}
                                  checked={isAllActionsSelected(moduleName)}
                                  onCheckedChange={() => toggleSelectAll(moduleName)}
                                />
                              </div>
                            </TableCell>
                            {actions.map((action) => (
                              <TableCell key={action}>
                                <div className="flex items-center justify-center">
                                  <Checkbox
                                    id={`${moduleName}-${action}`}
                                    checked={isActionSelected(moduleName, action)}
                                    onCheckedChange={() => toggleAction(moduleName, action)}
                                  />
                                </div>
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading
              ? (isEditMode ? "Updating..." : "Creating...")
              : (isEditMode ? "Update Role" : "Create Role")
            }
          </Button>
        </div>
      </form>
    </div>
  );
}