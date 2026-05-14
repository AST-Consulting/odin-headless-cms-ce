"use client";

import { useState, useEffect } from "react";
import { Edit, History, Trash2, Facebook, Twitter, Linkedin, Instagram, Youtube, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { getProperties, deleteProperty, updateProperty } from "@/lib/api";
import { Property } from "@/lib/types";
import { toast } from "sonner";
import { CreatePropertyDialog } from "@/components/dialogs/CreatePropertyDialog";
import { useRouter } from "next/navigation";
import { usePropertyStore, useOrganizationStore } from "@/lib/store";

export function PropertyTable() {
    const [properties, setProperties] = useState<Property[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingProperty, setEditingProperty] = useState<Property | undefined>(undefined);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    const router = useRouter();
    const { selectedProperty, setSelectedProperty } = usePropertyStore();
    const { selectedOrganization } = useOrganizationStore();

    const loadProperties = async () => {
        setLoading(true);
        try {
            const data = await getProperties(selectedOrganization?._id);
            setProperties(data);
        } catch (error) {
            console.error("Failed to load properties:", error);
            toast.error("Failed to load properties");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProperties();
    }, [selectedOrganization?._id]);

    const handleDeleteProperty = async (propertyId: string, domain: string) => {
        if (!confirm(`Are you sure you want to delete the property "${domain}"? This action cannot be undone.`)) {
            return;
        }

        try {
            await deleteProperty(propertyId);
            
            // If the deleted property is the current active property, remove it from storage
            if (selectedProperty && selectedProperty._id === propertyId) {
                setSelectedProperty(null);
            }
            
            toast.success("Property deleted successfully");
            loadProperties(); // Reload after delete
        } catch (error) {
            console.error("Failed to delete property:", error);
            toast.error("Failed to delete property");
        }
    };

    const handleStatusChange = async (property: Property, checked: boolean) => {
        const newStatus = checked ? 'active' : 'inactive';
        // Optimistic update
        setProperties(properties.map(p => p._id === property._id ? { ...p, status: newStatus } : p));

        try {
            await updateProperty(property._id, { status: newStatus });
            toast.success(`Property ${checked ? 'activated' : 'deactivated'}`);
        } catch (error) {
            console.error("Failed to update property status:", error);
            toast.error("Failed to update property status");
            // Revert optimistic update
            loadProperties();
        }
    };

    const handleEditClick = (property: Property) => {
        setEditingProperty(property);
        setIsEditDialogOpen(true);
    };

    const handlePropertyUpdated = () => {
        loadProperties();
        setEditingProperty(undefined);
    };

    if (loading) {
        return <div className="text-center py-4">Loading properties...</div>;
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>DOMAIN</TableHead>
                        <TableHead>INDUSTRY</TableHead>
                        <TableHead>STATUS</TableHead>
                        <TableHead>ARTICLE TYPE</TableHead>
                        <TableHead className="w-24 text-right">ACTIONS</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {properties.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground">
                                No properties found
                            </TableCell>
                        </TableRow>
                    ) : (
                        properties.map((property) => (
                            <TableRow key={property._id}>
                                <TableCell className="font-medium">
                                    <div className="flex flex-col gap-1">
                                        <div>{property.domain}</div>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            {property.social_links?.twitter && (
                                                <a href={property.social_links.twitter} target="_blank" rel="noopener noreferrer" className="opacity-60 hover:opacity-100 transition-opacity cursor-pointer">
                                                    <Twitter className="w-4 h-4 text-sky-500" />
                                                </a>
                                            )}
                                            {property.social_links?.facebook && (
                                                <a href={property.social_links.facebook} target="_blank" rel="noopener noreferrer" className="opacity-60 hover:opacity-100 transition-opacity cursor-pointer">
                                                    <Facebook className="w-4 h-4 text-blue-600" />
                                                </a>
                                            )}
                                            {property.social_links?.linkedin && (
                                                <a href={property.social_links.linkedin} target="_blank" rel="noopener noreferrer" className="opacity-60 hover:opacity-100 transition-opacity cursor-pointer">
                                                    <Linkedin className="w-4 h-4 text-indigo-700" />
                                                </a>
                                            )}
                                            {property.social_links?.instagram && (
                                                <a href={property.social_links.instagram} target="_blank" rel="noopener noreferrer" className="opacity-60 hover:opacity-100 transition-opacity cursor-pointer">
                                                    <Instagram className="w-4 h-4 text-rose-500" />
                                                </a>
                                            )}
                                            {property.social_links?.youtube && (
                                                <a href={property.social_links.youtube} target="_blank" rel="noopener noreferrer" className="opacity-60 hover:opacity-100 transition-opacity cursor-pointer">
                                                    <Youtube className="w-4 h-4 text-red-600" />
                                                </a>
                                            )}
                                            {property.social_links?.wikipedia && (
                                                <a href={property.social_links.wikipedia} target="_blank" rel="noopener noreferrer" className="opacity-60 hover:opacity-100 transition-opacity cursor-pointer">
                                                    <Globe className="w-4 h-4 text-slate-500" />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>{property.industry}</TableCell>
                                <TableCell>
                                    <Switch
                                        checked={property.status === 'active'}
                                        onCheckedChange={(checked) => handleStatusChange(property, checked)}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline">{property.articleType}</Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button 
                                            variant="ghost"
                                            size="icon" 
                                            onClick={() => router.push(`/audit-trail/${property._id}`)}
                                        >
                                            <History className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => router.push(`/property/edit/${property._id}`)}
                                            title="Edit property"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDeleteProperty(property._id, property.domain)}
                                            title="Delete property"
                                        >
                                            <Trash2 className="w-4 h-4 text-red-500" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>

            <CreatePropertyDialog
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                onPropertyCreated={handlePropertyUpdated}
                propertyToEdit={editingProperty}
            />
        </div>
    );
}
