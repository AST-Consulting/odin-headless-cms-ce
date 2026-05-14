"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Edit, History, Trash2 } from "lucide-react";
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
import { fetchRoles, deleteRole } from "@/lib/api";
import { Role } from "@/lib/types";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { usePropertyStore } from "@/lib/store";

export function RolesTable() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { selectedProperty } = usePropertyStore();
  const router = useRouter();

  const loadRoles = async () => {
    try {
      const params: Record<string, string> = {};
      if (selectedProperty?._id) {
        params.propertyId = selectedProperty._id;
      }
      const response = await fetchRoles(params);
      setRoles(response.data);
    } catch (error) {
      console.error("Failed to load roles:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, [selectedProperty?._id]);

  const toggleExpanded = (roleId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(roleId)) {
      newExpanded.delete(roleId);
    } else {
      newExpanded.add(roleId);
    }
    setExpandedRows(newExpanded);
  };

  const handleDeleteRole = async (roleId: string, roleName: string) => {
    if (!confirm(`Are you sure you want to delete the role "${roleName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteRole(roleId);
      toast.success("Role deleted successfully");
      loadRoles();
    } catch (error: any) {
      console.error("Failed to delete role:", error);
      toast.error(error.message || "Failed to delete role");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusBadge = (status: string) => {
    return (
      <Badge variant={status === "active" ? "default" : "secondary"}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  if (loading) {
    return <div className="text-center py-4">Loading roles...</div>;
  }

  return (
    <div className="rounded-md border">{/* Rest of the table remains the same */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created By</TableHead>
            <TableHead>Updated By</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <p>No roles found.</p>
                  <p className="text-sm">Create your roles to get started.</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            roles.map((role) => {
              const isExpanded = expandedRows.has(role._id);
              return (
                <React.Fragment key={role._id}>
                  <TableRow className="cursor-pointer">
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(role._id)}
                        className="p-1 h-6 w-6"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell>{getStatusBadge(role.status)}</TableCell>
                    <TableCell>{role.createdBy.name}</TableCell>
                    <TableCell>{role.updatedBy.name}</TableCell>
                    <TableCell>{formatDate(role.updatedAt)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => router.push(`/audit-trail/${role._id}`)}>
                          <History className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => router.push(`/roles/edit/${role._id}`)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                          onClick={() => handleDeleteRole(role._id, role.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-muted/20">
                        <div className="py-4 px-6">
                          <h4 className="font-semibold mb-3">Permissions</h4>
                          <div className="grid gap-2">
                            <div className="grid grid-cols-2 gap-4 font-medium text-sm text-muted-foreground">
                              <div>Module</div>
                              <div>Actions</div>
                            </div>
                            {role.permissions.map((permission, index) => (
                              <div key={index} className="grid grid-cols-2 gap-4 py-2 border-t">
                                <div className="font-medium">{permission.module}</div>
                                <div className="flex gap-1 flex-wrap">
                                  {permission.actions.map((action, actionIndex) => (
                                    <Badge key={actionIndex} variant="outline" className="text-xs">
                                      {action}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
