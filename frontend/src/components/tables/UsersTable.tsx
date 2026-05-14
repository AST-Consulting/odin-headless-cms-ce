"use client";

import { useState, useEffect } from "react";
import { Edit, Eye, History, Trash2, Shield, Twitter, Facebook, Linkedin, Instagram, CheckCircle2, AlertCircle, Globe, ChevronUp, ChevronDown, RotateCcw, RefreshCw } from "lucide-react";
import { UserCard } from "@/components/cards/UserCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getUsers, deleteUser, reactivateUser, resendInvitation } from "@/lib/api";
import { UserData, Permission } from "@/lib/types";
import { toast } from "sonner";
import { EditUserRolesDialog } from "@/components/dialogs/EditUserRolesDialog";
import { usePropertyStore } from "@/lib/store";
import { TablePagination } from "@/components/ui/table-pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { useAuthStore, havePermission } from "@/lib/auth";
import { getUserPropertyContext, isUserSuperAdmin } from "@/lib/user-utils";

interface UsersTableProps {
  search?: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onTotalChange?: (total: number) => void;
  sort: string;
  sortOrder: "asc" | "desc";
  onSort: (sort: string, order: "asc" | "desc") => void;
  status?: string | string[];
  verified?: boolean;
  propertyId?: string;
}

export function UsersTable({ search, name, email, phone, role, page, limit, onPageChange, onLimitChange, onTotalChange, sort, sortOrder, onSort, status, verified, propertyId }: UsersTableProps) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [cursors, setCursors] = useState<Record<number, any>>({ 0: null });

  const [selectedUser, setSelectedUser] = useState<UserData|null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const { user: currentUser } = useAuthStore();
  const { selectedProperty } = usePropertyStore();
  const router = useRouter();

  const loadUsers = async () => {
    setLoading(true);
    try {
      let cursorToSend: any = undefined;

      if (page > 1 && cursors[page - 1]) {
        cursorToSend = cursors[page - 1];
      }
      const response = await getUsers({
        page,
        limit,
        lastSortValues: cursorToSend,
        search: search || undefined,
        name: name || undefined,
        email: email || undefined,
        phone: phone || undefined,
        role: role || undefined,
        sort,
        sortOrder,
        status: status || undefined,
        verified: verified !== undefined ? verified : undefined,
        propertyId,
      });
      setUsers(response.data);
      const newTotal = response.total || 0;
      setTotal(newTotal);

      // Update cursors for the next page
      if (response.lastSortValues) {
        setCursors(prev => ({
          ...prev,
          [page]: response.lastSortValues ?? null
        }));
      }

      if (onTotalChange) {
        onTotalChange(newTotal);
      }
    } catch (error) {
      console.error("Failed to load users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  // Reset cursors when filters, limit or sort change
  useEffect(() => {
    setCursors({ 0: null });
  }, [search, name, email, phone, role, limit, sort, sortOrder, status, verified, propertyId]);

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, search, name, email, phone, role, sort, sortOrder, status, verified, propertyId]);

  const handleDeactivateUser = async (userId: string, userName: string) => {
    const propId = selectedProperty?._id;
    const confirmMsg = propId 
      ? `Are you sure you want to deactivate "${userName}" for the current property? They will lose access to this property but may remain active in others.`
      : `Are you sure you want to deactivate "${userName}" GLOBALLY? They will no longer be able to log in to ANY property.`;

    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      await deleteUser(userId, propId);
      toast.success(propId ? "User deactivated for this property" : "User deactivated globally");
      loadUsers();
    } catch (error: any) {
      console.error("Failed to deactivate user:", error);
      toast.error(error.message || "Failed to deactivate user");
    }
  };


  const canEdit = havePermission(currentUser, 'users', 'edit');
  const canDelete = havePermission(currentUser, 'users', 'delete');


  const getSafeId = (userData: UserData) => {
    if (typeof userData._id === 'string') return userData._id;
    if (userData._id && typeof userData._id === 'object' && '$oid' in userData._id) return userData._id.$oid;
    return userData.id || '';
  };

  const getUserTypeBadge = (userType?: string) => {
    if (!userType) return <Badge variant="secondary">N/A</Badge>;
    return (
      <Badge variant="default">
        {userType.toUpperCase()}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const variant = status === 'active' ? 'default' : 'secondary';
    return (
      <Badge variant={variant}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <>
      <div className="hidden xl:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <div className="flex items-center gap-2">
                  <span>Created</span>
                  <div className="flex flex-col">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-4 w-4 p-0 hover:bg-transparent ${sort === 'createdAt' && sortOrder === 'asc' ? 'text-primary' : 'text-muted-foreground'}`}
                      onClick={() => onSort('createdAt', 'asc')}
                      title="Sort by oldest"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-4 w-4 p-0 hover:bg-transparent ${sort === 'createdAt' && sortOrder === 'desc' ? 'text-primary' : 'text-muted-foreground'}`}
                      onClick={() => onSort('createdAt', 'desc')}
                      title="Sort by latest"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center gap-2">
                  <span>Updated</span>
                  <div className="flex flex-col">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-4 w-4 p-0 hover:bg-transparent ${sort === 'updatedAt' && sortOrder === 'asc' ? 'text-primary' : 'text-muted-foreground'}`}
                      onClick={() => onSort('updatedAt', 'asc')}
                      title="Sort by oldest"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-4 w-4 p-0 hover:bg-transparent ${sort === 'updatedAt' && sortOrder === 'desc' ? 'text-primary' : 'text-muted-foreground'}`}
                      onClick={() => onSort('updatedAt', 'desc')}
                      title="Sort by latest"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users
                .filter(u => u.id !== currentUser?.id)
                .map((user) => {
                const { status: displayStatus, roles: displayRoles } = getUserPropertyContext(user, selectedProperty);
                const isTargetAdmin = isUserSuperAdmin(user, displayRoles);

                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <button
                          onClick={() => router.push(`/users/edit/${user.id}`)}
                          className="hover:underline text-primary text-left font-bold"
                        >
                          {user.name}
                        </button>
                        <div className="flex gap-1.5 mt-1">
                          {user.socialLinks?.twitter && (
                            <a href={user.socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:opacity-80 transition-opacity">
                              <Twitter size={12} />
                            </a>
                          )}
                          {user.socialLinks?.facebook && (
                            <a href={user.socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:opacity-80 transition-opacity">
                              <Facebook size={12} />
                            </a>
                          )}
                          {user.socialLinks?.linkedin && (
                            <a href={user.socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:opacity-80 transition-opacity">
                              <Linkedin size={12} />
                            </a>
                          )}
                          {user.socialLinks?.instagram && (
                            <a href={user.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-rose-500 hover:opacity-80 transition-opacity">
                              <Instagram size={12} />
                            </a>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 min-w-[160px]">
                        {/* Email row */}
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm">{user.email}</span>
                          {user.emailVerified ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                          ) : (
                            <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />
                          )}
                        </div>
                        {/* Phone row */}
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <span className="truncate text-xs">
                            {user.phone
                              ? typeof user.phone === 'object'
                                ? (user.phone as { fullNumber?: string; number?: string }).fullNumber || (user.phone as { fullNumber?: string; number?: string }).number
                                : user.phone
                              : '—'}
                          </span>
                          {user.phone && (
                            user.phoneVerified ? (
                              <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                            ) : (
                              <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />
                            )
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {displayRoles.length === 0 ? (
                          <span className="text-muted-foreground text-sm">No roles</span>
                        ) : (
                          displayRoles.map((role, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {role.name}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(displayStatus)}
                    </TableCell>
                    <TableCell><div className="flex flex-col">
                      <span className="text-sm font-medium">{user.createdBy?.name || '-'}</span>
                      <span className="text-xs text-muted-foreground">
                        {(() => {
                          if (!user.createdAt) return '-';
                          const dateVal = typeof user.createdAt === 'object' && '$date' in (user.createdAt as any) ? (user.createdAt as any).$date : user.createdAt;
                          try {
                            return new Date(dateVal as string).toLocaleString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            });
                          } catch (e) {
                            return '-';
                          }
                        })()}
                      </span>
                    </div></TableCell>
                    <TableCell><div className="flex flex-col">
                      <span className="text-sm font-medium">{user.updatedBy?.name || '-'}</span>
                      <span className="text-xs text-muted-foreground">
                        {(() => {
                          if (!user.updatedAt) return '-';
                          const dateVal = typeof user.updatedAt === 'object' && '$date' in (user.updatedAt as any) ? (user.updatedAt as any).$date : user.updatedAt;
                          try {
                            return new Date(dateVal as string).toLocaleString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            });
                          } catch (e) {
                            return '-';
                          }
                        })()}
                      </span>
                    </div></TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const domain = selectedProperty?.domain || user.organization?.domain || user.companyName || "";
                            if (domain && user.slug) {
                              const url = domain.startsWith('http') ? `${domain}/author/${user.slug}` : `https://${domain}/author/${user.slug}`;
                              window.open(url, '_blank');
                            } else {
                              toast.error("User slug or domain not found");
                            }
                          }}
                          title="View on Site"
                        >
                          <Globe className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => router.push(`/audit-trail/${getSafeId(user)}`)}>
                          <History className="w-4 h-4" />
                        </Button>
                        {/* Conditional actions based on status */}
                        {displayStatus === 'active' ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                router.push(`/users/edit/${user.id}`);
                              }}
                              disabled={!canEdit}
                              title={canEdit ? "Edit user" : "No permission to edit"}
                              className={!canEdit ? "opacity-50 cursor-not-allowed" : ""}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeactivateUser(user.id, user.name)}
                              disabled={!canDelete}
                              title={canDelete ? "Deactivate user" : "No permission to deactivate"}
                              className={`text-amber-500 hover:text-amber-600 hover:bg-amber-50 ${!canDelete ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            {displayStatus === 'inactive' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => router.push(`/users/activate/${user.id}`)}
                                disabled={!canEdit}
                                title="Reactivate user"
                                className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </Button>
                            )}
                            {(displayStatus === 'expired' || displayStatus === 'pending') && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => router.push(`/users/activate/${user.id}`)}
                                disabled={!canEdit}
                                title="Resend Invitation & Update Permissions"
                                className="text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile/Tablet Card View - Hidden on desktop */}
      <div className="xl:hidden grid grid-cols-1 md:grid-cols-2 gap-6">
        {users.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground bg-white rounded-xl border border-dashed">
            No users found
          </div>
        ) : (
          users
            .filter(u => u.id !== currentUser?.id)
            .map((user) => (
            <UserCard
              key={user.id}
              user={user}
              handleDeactivateUser={handleDeactivateUser}
              handleReactivateUser={(user) => {
                router.push(`/users/activate/${user.id}`);
              }}
              handleResendInvite={() => {
                router.push(`/users/activate/${user.id}`);
              }}
              router={router}
            />
          ))
        )}
      </div>

      <TablePagination
        page={page}
        limit={limit}
        total={total}
        onPageChange={onPageChange}
        onLimitChange={onLimitChange}
      />

      <EditUserRolesDialog
        user={selectedUser ? (() => {
          const propertyRoles = selectedUser.properties?.find(p => p.id === selectedProperty?._id)?.roles;
          const displayRoles = propertyRoles || selectedUser.roles || [];
          return {
            id: selectedUser.id,
            name: selectedUser.name,
            email: selectedUser.email,
            roles: displayRoles.map(r => r.id),
            userType: selectedUser.userType,
          };
        })() : null}
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setSelectedUser(null);
        }}
        onSuccess={loadUsers}
      />

    </>
  );
}
