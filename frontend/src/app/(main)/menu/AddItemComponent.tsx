"use client";

import { updateMenu, getMenus } from '@/lib/api'
import type { Menu, MenuItem } from '@/lib/types'
import { useEffect, useState } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

import { usePropertyStore } from '@/lib/store'

interface AddItemComponentProps {
  menu?: Menu[] | null
  itemData?: MenuItem | null
  type?: 'create' | 'update'
  selectedMenuId?: string
  onSuccess?: () => void
  onCancel?: () => void
}

const AddItemComponent = ({
  onSuccess,
  onCancel,
  menu: initialMenu,
  itemData,
  type = 'create',
  selectedMenuId: initialSelectedMenuId,
}: AddItemComponentProps) => {
  const { toast } = useToast()
  const selectedProperty = usePropertyStore((state) => state.selectedProperty)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [menu, setMenu] = useState<Menu[]>(initialMenu || [])
  const [selectedMenuId, setSelectedMenuId] = useState(initialSelectedMenuId || '')
  const [isLoadingMenus, setIsLoadingMenus] = useState(!initialMenu)
  const [isCollapsed, setIsCollapsed] = useState(false)


  const [item, setItem] = useState<Partial<MenuItem>>({
    titles: itemData?.titles || '',
    link: itemData?.link || '',
    status: itemData?.status || 'inactive',
    type: itemData?.type || '',
    textColor: itemData?.textColor || '',
    bgColor: itemData?.bgColor || '',
    rank: itemData?.rank || 0,
    subMenuSlug: itemData?.subMenuSlug || '',
    label: itemData?.label || '',
    titleHn: itemData?.titleHn || '',
    others: itemData?.others || '',
    children: itemData?.children,
  })

  // Load menus if not provided
  useEffect(() => {
    if (!initialMenu && selectedProperty) {
      const loadMenus = async () => {
        try {
          const data = await getMenus({ propertyId: selectedProperty._id })
          const menusData = Array.isArray(data) ? data : (data as any).data || []
          setMenu(menusData)
          if (menusData.length > 0 && !selectedMenuId) {
            setSelectedMenuId(menusData[0]._id)
          }
        } catch (error) {
          console.error('Failed to load menus:', error)
          toast({
            title: 'Error',
            description: 'Failed to load menus',
            variant: 'destructive',
          })
        } finally {
          setIsLoadingMenus(false)
        }
      }
      loadMenus()
    }
  }, [initialMenu, selectedProperty, selectedMenuId])

  // Update item when itemData changes
  useEffect(() => {
    if (itemData) {
      setItem({
        titles: itemData.titles || '',
        link: itemData.link || '',
        status: itemData.status || 'inactive',
        type: itemData.type || '',
        textColor: itemData.textColor || '',
        bgColor: itemData.bgColor || '',
        rank: itemData.rank || 0,
        subMenuSlug: itemData.subMenuSlug || '',
        label: itemData.label || '',
        titleHn: itemData.titleHn || '',
        others: itemData.others || '',
        children: itemData.children,
      })
    }
  }, [itemData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!item.titles || !item.link || !item.status || !item.type) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      })
      return
    }

    if (!selectedMenuId) {
      toast({
        title: 'Error',
        description: 'Please select a menu',
        variant: 'destructive',
      })
      return
    }

    const itemData = {
      titles: item.titles,
      link: item.link,
      status: item.status,
      type: item.type,
      rank: item.rank || 0,
      ...(item.textColor && { textColor: item.textColor }),
      ...(item.bgColor && { bgColor: item.bgColor }),
      ...(item.subMenuSlug && { subMenuSlug: item.subMenuSlug }),
      ...(item.label && { label: item.label }),
      ...(item.titleHn && { titleHn: item.titleHn }),
      ...(item.others && { others: item.others }),
      ...(item.children && item.children.length > 0 && { children: item.children }),
    } as MenuItem

    // Update the menu with new/updated item
    const updatedMenus = menu.map((menuItem) => {
      if (menuItem._id === selectedMenuId) {
        if (type === 'create') {
          // Add new item
          return {
            ...menuItem,
            items: [...(menuItem.items || []), itemData],
          }
        } else {
          // Update existing item
          return {
            ...menuItem,
            items: (menuItem.items || []).map((existingItem) =>
              existingItem._id === itemData.titles ? itemData : existingItem
            ),
          }
        }
      }
      return menuItem
    })

    const updatedMenu = updatedMenus.find((menuItem) => menuItem._id === selectedMenuId)

    if (updatedMenu) {
      setIsSubmitting(true)
      try {
        await updateMenu(updatedMenu._id, updatedMenu)
        toast({
          title: 'Success',
          description: `Menu item ${type === 'create' ? 'created' : 'updated'} successfully`,
        })
        onSuccess?.()
      } catch (error) {
        console.error('Update failed:', error)
        toast({
          title: 'Error',
          description: 'Failed to update menu',
          variant: 'destructive',
        })
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  if (isLoadingMenus) {
    return (
      <div className="md:p-4 lg:p-8 p-2">
        <p className="text-center">Loading menus...</p>
      </div>
    )
  }

  return (
    <div className="md:p-4 lg:p-8 p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{type === "create" ? "Create Menu Item" : "Update Menu Item"}</h1>
        <p className="text-muted-foreground">
          {type === "create" ? "Add a new item to your menu" : "Update menu item details"}
        </p>
      </div>
      <form onSubmit={handleSubmit} className="md:space-y-6 space-y-4">
        <Card>
          <CardContent className="space-y-4 pt-6">
            {/* Menu Selection */}
            {menu.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="menu">
                  Select Menu <span className="text-red-500">*</span>
                </Label>
                <Select value={selectedMenuId} onValueChange={(val) => setSelectedMenuId(val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a menu" />
                  </SelectTrigger>
                  <SelectContent>
                    {menu.map((m) => (
                      <SelectItem key={m._id} value={m._id}>
                        {m.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-2 overflow-hidden">
          <div
            className={cn(
              "flex justify-between items-center px-6 py-4 cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors",
              !isCollapsed && "border-b"
            )}
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            <div className="flex items-center gap-3">
              {isCollapsed ? (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              )}
              <h4 className="font-semibold text-lg">
                {item.titles || "Item Details"}
              </h4>
              {item.status && (
                <span className={cn(
                  "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full",
                  item.status === 'active' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                )}>
                  {item.status}
                </span>
              )}
            </div>
          </div>

          {!isCollapsed && (
            <CardContent className="space-y-4 pt-6">


            <div className='grid md:grid-cols-2 md:gap-4 gap-3'>
              <div className="space-y-2">
                <Label htmlFor="titles">
                  Item Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="titles"
                  value={item.titles}
                  onChange={(e) => setItem({ ...item, titles: e.target.value })}
                  placeholder="Enter item title"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="label">Label</Label>
                <Input
                  id="label"
                  value={item.label}
                  onChange={(e) => setItem({ ...item, label: e.target.value })}
                  placeholder="Enter label"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="link">
                  Link <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="link"
                  value={item.link}
                  onChange={(e) => setItem({ ...item, link: e.target.value })}
                  placeholder="Enter link"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">
                  Status <span className="text-red-500">*</span>
                </Label>
                <Select value={item.status} onValueChange={(val) => setItem({ ...item, status: val })}>
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
                  value={item.rank}
                  onChange={(e) => setItem({ ...item, rank: parseInt(e.target.value) || 0 })}
                  placeholder="Enter order"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">
                  Type <span className="text-red-500">*</span>
                </Label>
                <Select value={item.type} onValueChange={(val) => setItem({ ...item, type: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="same-page">Same Page</SelectItem>
                    <SelectItem value="new-page">New Page</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="textColor">Text Color</Label>
                <Input
                  id="textColor"
                  value={item.textColor}
                  onChange={(e) => setItem({ ...item, textColor: e.target.value })}
                  placeholder="e.g., #000000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bgColor">Background Color</Label>
                <Input
                  id="bgColor"
                  value={item.bgColor}
                  onChange={(e) => setItem({ ...item, bgColor: e.target.value })}
                  placeholder="e.g., #ffffff"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="others">Others</Label>
                <Input
                  id="others"
                  value={item.others}
                  onChange={(e) => setItem({ ...item, others: e.target.value })}
                  placeholder="Additional info"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subMenuSlug">Sub Menu Slug</Label>
                <Select
                  value={item.subMenuSlug || ''}
                  onValueChange={(val) => setItem({ ...item, subMenuSlug: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sub menu" />
                  </SelectTrigger>
                  <SelectContent>
                    {menu.map((m) => (
                      <SelectItem key={m._id} value={m.slug || m._id}>
                        {m.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="titleHn">Hindi Title</Label>
                <Input
                  id="titleHn"
                  value={item.titleHn}
                  onChange={(e) => setItem({ ...item, titleHn: e.target.value })}
                  placeholder="Enter Hindi title"
                />
              </div>
            </div>
          </CardContent>
          )}
        </Card>

        <div className="flex md:justify-end justify-between gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : type === 'create' ? 'Add Item' : 'Update Item'}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default AddItemComponent
