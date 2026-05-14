"use client";

import type { MenuItem } from "@/lib/types";
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
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { MediaFieldInput } from "@/components/content-manager/MediaFieldInput";

export type EditableMenuItem = MenuItem & {
  _isCollapsed?: boolean;
  children?: EditableMenuItem[];
};

type Props = {
  item: EditableMenuItem;
  path: number[];
  index: number;
  siblingsCount: number;
  depth?: number;
  onUpdate: (path: number[], field: string, value: any) => void;
  onRemove: (path: number[]) => void;
  onToggleCollapse: (path: number[]) => void;
  onAddChild: (path: number[]) => void;
};

const MenuItemForm = ({
  item,
  path,
  index,
  siblingsCount,
  depth = 0,
  onUpdate,
  onRemove,
  onToggleCollapse,
  onAddChild,
}: Props) => {
  const isCollapsed = !!item._isCollapsed;
  const isRoot = depth === 0;
  const labelFallback = isRoot ? `Item ${index + 1}` : `Child ${index + 1}`;

  return (
    <Card className={cn("border-2 overflow-hidden", !isRoot && "border-dashed")}>
      <div
        className={cn(
          "flex justify-between items-center px-6 py-4 cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors",
          !isCollapsed && "border-b"
        )}
        onClick={() => onToggleCollapse(path)}
      >
        <div className="flex items-center gap-3">
          {isCollapsed ? (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          )}
          <h4 className="font-semibold text-lg">{item.titles || labelFallback}</h4>
          {item.status && (
            <span
              className={cn(
                "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full",
                item.status === "active"
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              )}
            >
              {item.status}
            </span>
          )}
          {item.children && item.children.length > 0 && (
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              {item.children.length} child{item.children.length === 1 ? "" : "ren"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(siblingsCount > 1 || !isRoot) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(path);
              }}
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <CardContent className="md:pt-6 pt-4 space-y-4">
          <div className="grid md:grid-cols-2 md:gap-4 gap-3">
            <div className="space-y-2">
              <Label>
                Item Title <span className="text-red-500">*</span>
              </Label>
              <Input
                value={item.titles}
                onChange={(e) => onUpdate(path, "titles", e.target.value)}
                placeholder="Enter item title"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={item.label || ""}
                onChange={(e) => onUpdate(path, "label", e.target.value)}
                placeholder="Enter label"
              />
            </div>

            <div className="space-y-2">
              <Label>
                Link <span className="text-red-500">*</span>
              </Label>
              <Input
                value={item.link}
                onChange={(e) => onUpdate(path, "link", e.target.value)}
                placeholder="Enter link"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>
                Status <span className="text-red-500">*</span>
              </Label>
              <Select
                value={item.status}
                onValueChange={(val) => onUpdate(path, "status", val)}
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
              <Label>Type</Label>
              <Select
                value={item.type}
                onValueChange={(val) => onUpdate(path, "type", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new-page">New Page</SelectItem>
                  <SelectItem value="same-page">Same Page</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Item Rank</Label>
              <Input
                type="number"
                value={item.rank}
                onChange={(e) =>
                  onUpdate(path, "rank", parseInt(e.target.value) || 0)
                }
                placeholder="Enter rank"
              />
            </div>

            <div className="space-y-2">
              <Label>Text Color</Label>
              <Input
                value={item.textColor || ""}
                onChange={(e) => onUpdate(path, "textColor", e.target.value)}
                placeholder="e.g., #000000"
              />
            </div>

            <div className="space-y-2">
              <Label>Background Color</Label>
              <Input
                value={item.bgColor || ""}
                onChange={(e) => onUpdate(path, "bgColor", e.target.value)}
                placeholder="e.g., #ffffff"
              />
            </div>

            <div className="space-y-2">
              <Label>Sub Menu Slug</Label>
              <Input
                value={item.subMenuSlug || ""}
                onChange={(e) => onUpdate(path, "subMenuSlug", e.target.value)}
                placeholder="Enter sub menu slug"
              />
            </div>

            <div className="space-y-2">
              <Label>Hindi Title</Label>
              <Input
                value={item.titleHn || ""}
                onChange={(e) => onUpdate(path, "titleHn", e.target.value)}
                placeholder="Enter Hindi title"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Others</Label>
              <Input
                value={item.others || ""}
                onChange={(e) => onUpdate(path, "others", e.target.value)}
                placeholder="Additional information"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Icon Image</Label>
              <MediaFieldInput
                field={
                  {
                    name: "icon",
                    type: "media",
                    mediaMultiple: false,
                    mediaAllowedTypes: ["image"],
                  } as any
                }
                value={item.icon || null}
                onChange={(val) => onUpdate(path, "icon", val)}
              />
            </div>
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">Child Items</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onAddChild(path)}
              >
                <Plus className="w-4 h-4 mr-1" /> Add Child
              </Button>
            </div>

            {item.children && item.children.length > 0 && (
              <div className="space-y-3 pl-4 border-l-2 border-muted">
                {item.children.map((child, childIndex) => (
                  <MenuItemForm
                    key={childIndex}
                    item={child}
                    path={[...path, childIndex]}
                    index={childIndex}
                    siblingsCount={item.children!.length}
                    depth={depth + 1}
                    onUpdate={onUpdate}
                    onRemove={onRemove}
                    onToggleCollapse={onToggleCollapse}
                    onAddChild={onAddChild}
                  />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default MenuItemForm;
