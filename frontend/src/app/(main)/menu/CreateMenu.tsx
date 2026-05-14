"use client";

import { useEffect, useState } from "react";
import { createMenu, updateMenu, getMenus, getMenuById } from "@/lib/api";
import type { Menu } from "@/lib/types";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";

import { usePropertyStore } from "@/lib/store";
import MenuItemForm, { EditableMenuItem } from "./MenuItemForm";

const emptyItem = (rank: number, collapsed = false): EditableMenuItem => ({
  titles: "",
  link: "",
  status: "",
  type: "",
  textColor: "",
  bgColor: "",
  others: "",
  subMenuSlug: "",
  label: "",
  titleHn: "",
  icon: undefined,
  rank,
  _isCollapsed: collapsed,
});

// Strip UI-only fields recursively before sending to the API.
const stripUiFields = (items: EditableMenuItem[]): any[] =>
  items.map(({ _isCollapsed, children, ...rest }) => ({
    ...rest,
    ...(children && children.length > 0 ? { children: stripUiFields(children) } : {}),
  }));

// Mark every nested item as collapsed when loading existing data.
const collapseAll = (items: any[]): EditableMenuItem[] =>
  (items || []).map((item: any) => ({
    ...item,
    _isCollapsed: true,
    children: item.children ? collapseAll(item.children) : undefined,
  }));

// Apply a transform to the item addressed by `path` (an array of child indices).
const transformAtPath = (
  items: EditableMenuItem[],
  path: number[],
  transform: (item: EditableMenuItem) => EditableMenuItem
): EditableMenuItem[] => {
  if (path.length === 0) return items;
  const [head, ...rest] = path;
  return items.map((item, i) => {
    if (i !== head) return item;
    if (rest.length === 0) return transform(item);
    return {
      ...item,
      children: transformAtPath(item.children || [], rest, transform),
    };
  });
};

// Remove the item addressed by `path`.
const removeAtPath = (items: EditableMenuItem[], path: number[]): EditableMenuItem[] => {
  if (path.length === 0) return items;
  const [head, ...rest] = path;
  if (rest.length === 0) {
    return items.filter((_, i) => i !== head);
  }
  return items.map((item, i) => {
    if (i !== head) return item;
    return {
      ...item,
      children: removeAtPath(item.children || [], rest),
    };
  });
};

const CreateMenu = ({ type = "create" }: { type?: "update" | "create" }) => {
  const router = useRouter();
  const params = useParams();
  const menuId = params?.menuId as string;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedProperty = usePropertyStore((state) => state.selectedProperty);

  const [menu, setMenu] = useState<{
    title: string;
    status: string;
    rank: number;
    slug: string;
    items: EditableMenuItem[];
  }>({
    title: "",
    status: "",
    rank: 0,
    slug: "",
    items: [emptyItem(1)],
  });

  useEffect(() => {
    const fetchMenus = async () => {
      try {
        await getMenus();
      } catch (error) {
        console.error("Failed to fetch menus:", error);
        toast.error("Failed to load menus");
      }
    };
    fetchMenus();
  }, []);

  useEffect(() => {
    if (menuId && type === "update") {
      const fetchData = async () => {
        try {
          const res = await getMenuById(menuId);
          setMenu({
            title: res.title,
            status: res.status,
            rank: res.rank,
            slug: res.slug,
            items: collapseAll(res.items || []),
          });
        } catch (error) {
          console.error("Failed to fetch menu:", error);
          toast.error("Failed to load menu");
        }
      };
      fetchData();
    }
  }, [menuId, type]);

  // Recursively validate that every item (and its descendants) has the required fields.
  const validateItems = (items: EditableMenuItem[]): boolean => {
    for (const item of items) {
      if (!item.titles || !item.link || !item.status) return false;
      if (item.children && item.children.length > 0) {
        if (!validateItems(item.children)) return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!menu.title || !menu.status || !menu.slug) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (menu.items.length === 0) {
      toast.error("At least one item is required");
      return;
    }

    if (!validateItems(menu.items)) {
      toast.error("All items (and children) must have title, link, and status");
      return;
    }

    const data = {
      ...menu,
      items: stripUiFields(menu.items),
      propertyId: selectedProperty?._id,
    };

    setIsSubmitting(true);
    try {
      if (type === "update" && menuId) {
        await updateMenu(menuId, data);
        toast.success("Menu updated successfully");
      } else {
        await createMenu(data);
        toast.success("Menu created successfully");
      }
      await new Promise((resolve) => setTimeout(resolve, 700));
      router.push("/menu");
    } catch (error) {
      console.error("Failed to save menu:", error);
      toast.error(`Failed to ${type === "update" ? "update" : "create"} menu`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addItem = () => {
    setMenu((prev) => ({
      ...prev,
      items: [...prev.items, emptyItem(prev.items.length + 1, false)],
    }));
  };

  const updateItemAtPath = (path: number[], field: string, value: any) => {
    setMenu((prev) => ({
      ...prev,
      items: transformAtPath(prev.items, path, (item) => ({ ...item, [field]: value })),
    }));
  };

  const removeItemAtPath = (path: number[]) => {
    if (path.length === 1 && menu.items.length === 1) {
      toast.error("At least one item is required");
      return;
    }
    setMenu((prev) => ({ ...prev, items: removeAtPath(prev.items, path) }));
  };

  const toggleCollapseAtPath = (path: number[]) => {
    setMenu((prev) => ({
      ...prev,
      items: transformAtPath(prev.items, path, (item) => ({
        ...item,
        _isCollapsed: !item._isCollapsed,
      })),
    }));
  };

  const addChildAtPath = (path: number[]) => {
    setMenu((prev) => ({
      ...prev,
      items: transformAtPath(prev.items, path, (item) => {
        const children = item.children || [];
        return {
          ...item,
          children: [...children, emptyItem(children.length + 1, false)],
        };
      }),
    }));
  };

  return (
    <div className="md:p-4 lg:p-8 p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">
          {type === "create" ? "Create Menu" : "Update Menu"}
        </h1>
        <p className="text-muted-foreground">
          {type === "create" ? "Add a new menu to your site" : "Update menu details"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="md:space-y-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Menu Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 md:gap-4 gap-3">
              <div className="space-y-2">
                <Label htmlFor="title">
                  Menu Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  value={menu.title}
                  onChange={(e) => setMenu({ ...menu, title: e.target.value })}
                  placeholder="Enter menu title"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">
                  Status <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={menu.status}
                  onValueChange={(val) => setMenu({ ...menu, status: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rank">
                  Order <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="rank"
                  type="number"
                  value={menu.rank}
                  onChange={(e) => setMenu({ ...menu, rank: parseInt(e.target.value) || 0 })}
                  placeholder="Enter order"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">
                  Slug <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="slug"
                  value={menu.slug}
                  onChange={(e) => setMenu({ ...menu, slug: e.target.value })}
                  placeholder="Enter slug"
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Menu Items</CardTitle>
              <Button
                type="button"
                onClick={addItem}
                size="icon"
                className="rounded-full h-10 w-10"
              >
                <Plus className="h-6 w-6" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {menu.items.map((item, index) => (
              <MenuItemForm
                key={index}
                item={item}
                path={[index]}
                index={index}
                siblingsCount={menu.items.length}
                depth={0}
                onUpdate={updateItemAtPath}
                onRemove={removeItemAtPath}
                onToggleCollapse={toggleCollapseAtPath}
                onAddChild={addChildAtPath}
              />
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/menu")}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : type === "create" ? "Create Menu" : "Update Menu"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CreateMenu;
