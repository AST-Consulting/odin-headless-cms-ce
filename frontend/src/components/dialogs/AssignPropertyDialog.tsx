'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PermissionTable } from '@/components/shared/PermissionTable';
import { Organization, Property, Role, Permission, UserData } from '@/lib/types';
import { fetchRoles, updateUser } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, Globe, Building2 } from 'lucide-react';
import { getStringId } from '@/lib/user-utils';

interface AssignPropertyDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserData | null;
  organization: Organization | null;
  property: Property | null;
  onSuccess: () => void;
}

export function AssignPropertyDialog({
  isOpen,
  onOpenChange,
  user,
  organization,
  property,
  onSuccess
}: AssignPropertyDialogProps) {
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [fetchingRoles, setFetchingRoles] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [permissions, setPermissions] = useState<Permission[]>([]);

  useEffect(() => {
    const orgId = getStringId(organization?._id);
    const propId = getStringId(property?._id);
    if (isOpen && orgId && propId) {
      loadRoles(orgId, propId);
    }
  }, [isOpen, organization?._id, property?._id]);

  useEffect(() => {
    if (!isOpen) {
      setRoles([]);
      setSelectedRoleId('');
      setPermissions([]);
    }
  }, [isOpen]);

  const loadRoles = async (orgId: string, propId: string) => {
    setFetchingRoles(true);
    try {
      // Pass propertyId to the server to get filtered roles
      const response = await fetchRoles({ propertyId: propId });
      setRoles(response.data || []);
    } catch (err) {
      console.error('Failed to load roles:', err);
      toast.error('Failed to load roles for this property');
    } finally {
      setFetchingRoles(false);
    }
  };

  const handleRoleChange = (roleId: string) => {
    setSelectedRoleId(roleId);
    const role = roles.find(r => getStringId(r._id) === roleId);
    if (role) {
      setPermissions(role.permissions || []);
    }
  };

  const handleAssign = async () => {
    if (!selectedRoleId || !user || !organization || !property) {
      toast.error('Please select a role');
      return;
    }

    setLoading(true);
    try {
      const userId = getStringId(user._id);
      const orgId = getStringId(organization._id);
      const propId = getStringId(property._id);

      if (!userId || !orgId || !propId) {
        throw new Error('Required IDs missing');
      }

      const updateData = {
        assignProperty: {
          organizationId: orgId,
          propertyId: propId,
          roleId: selectedRoleId,
          permissions: permissions
        }
      };

      await updateUser(userId, updateData);
      toast.success('Property assigned successfully');
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to assign property:', err);
      toast.error('Failed to assign property');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Assign Property Access
          </DialogTitle>
          <DialogDescription>
            Configure access for <strong>{user?.name || 'User'}</strong> to <strong>{property?.domain}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Target Context Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
                <Building2 className="h-5 w-5 shrink-0" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Organization</span>
                <span className="text-sm font-bold truncate">{organization?.name}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                <Globe className="h-5 w-5 shrink-0" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Property</span>
                <span className="text-sm font-bold truncate">{property?.domain}</span>
              </div>
            </div>
          </div>

          {/* Role Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-bold">Select Role</Label>
            <Select value={selectedRoleId} onValueChange={handleRoleChange} disabled={fetchingRoles}>
              <SelectTrigger className="h-12 rounded-xl border-slate-200 dark:border-slate-800">
                <SelectValue placeholder={fetchingRoles ? "Loading roles..." : "Choose a role"} />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={getStringId(role._id)} value={getStringId(role._id)} className="cursor-pointer">
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!fetchingRoles && roles.length === 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-xl mt-2">
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                  No roles found for this property. Please create a role in the Roles section first to assign access.
                </p>
              </div>
            )}
            {fetchingRoles && <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 underline decoration-dotted"><Loader2 className="h-3 w-3 animate-spin"/> Loading property-specific roles...</div>}
          </div>

          {/* Permissions Table */}
          <div className="border-t pt-6">
            <PermissionTable 
              permissions={permissions} 
              onChange={setPermissions}
              disabled={loading}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl h-11 px-6 font-bold" disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleAssign} className="rounded-xl h-11 px-8 font-bold" disabled={loading || !selectedRoleId}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Assignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
