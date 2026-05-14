'use client'

import { getMenus, updateMenu } from '@/lib/api'
import type { Menu } from '@/lib/types'
import React, { useEffect, useState } from 'react'
import MenuItemTile from '../MenuItemTile'
import SubItemTile from '../SubItemTile'
import { DndContext, DragEndEvent, closestCorners } from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { usePropertyStore } from '@/lib/store'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useDebounce } from '@/hooks/use-debounce'
import { useRouter, useSearchParams } from 'next/navigation'




const MenuPriorityPage = () => {
    const [menus, setMenus] = useState<Menu[]>([])
    const [selectedMenuIndex, setSelectedMenuIndex] = useState(0)
    const searchParams = useSearchParams()
    const urlMenuId = searchParams.get('menuId')
    const [selectedMenuId, setSelectedMenuId] = useState(urlMenuId || '')

    const [searchTerm, setSearchTerm] = useState('')
    const debouncedSearchTerm = useDebounce(searchTerm, 500)
    const [isLoading, setIsLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const [hasMore, setHasMore] = useState(false)
    const [isDirty, setIsDirty] = useState(false)
    const [isSaving, setIsSaving] = useState(false)


    const selectedProperty = usePropertyStore((state) => state.selectedProperty)
    const router = useRouter()

    const loadMenus = async (isMore = false) => {
        if (!selectedProperty?._id) {
            setIsLoading(false);
            return;
        }
        try {
            setIsLoading(true)
            const currentPage = isMore ? page + 1 : 1
            const response = await getMenus({
                propertyId: selectedProperty._id,
                limit: 15,
                page: currentPage,
                search: debouncedSearchTerm
            })

            const menusData = Array.isArray(response) ? response : (response as any).data || []
            const newTotal = Array.isArray(response) ? response.length : (response as any).total || 0

            const sortedMenus = menusData.map((menu: any) => ({
                ...menu,
                items: [...(menu.items || [])].sort((a: any, b: any) => a.rank - b.rank),
            }))

            if (isMore) {
                setMenus(prev => [...prev, ...sortedMenus])
                setPage(currentPage)
            } else {
                setMenus(sortedMenus)
                setPage(1)
                
                // Use URL menuId if present on initial load, otherwise default to first menu
                const initialMenuId = urlMenuId || (sortedMenus.length > 0 ? sortedMenus[0]._id : '')
                
                if (sortedMenus.length > 0 && !selectedMenuId) {
                    const targetMenu = sortedMenus.find((m: any) => m._id === initialMenuId) || sortedMenus[0]
                    setSelectedMenuId(targetMenu._id)
                    setSelectedMenuIndex(sortedMenus.indexOf(targetMenu))
                }
            }


            setTotal(newTotal)
            setHasMore(isMore ? (menus.length + sortedMenus.length < newTotal) : (sortedMenus.length < newTotal))

        } catch (error) {
            console.error('Failed to load menus:', error)
            toast.error('Failed to load menus')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        loadMenus()
        setIsDirty(false)
    }, [selectedProperty, debouncedSearchTerm])

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault()
                e.returnValue = ''
            }
        }
        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [isDirty])


    // Derive the active menu object from the selectedMenuId
    const activeMenuIndex = menus.findIndex(m => m._id === selectedMenuId)
    const effectiveIndex = activeMenuIndex === -1 ? 0 : activeMenuIndex
    const currentMenu = menus[effectiveIndex]


    const handleRankChange = ({ type, index }: { type: 'dec' | 'inc'; index: number }) => {
        if (!currentMenu) return
        const tempItems = [...(currentMenu as any).items]
        const updatedItems = tempItems.map((item) => ({ ...item }))

        if (type === 'dec' && index > 0) {
            // Move up (decrease rank)
            const tempRank = updatedItems[index].rank
            updatedItems[index].rank = updatedItems[index - 1].rank
            updatedItems[index - 1].rank = tempRank
        } else if (type === 'inc' && index < updatedItems.length - 1) {
            // Move down (increase rank)
            const tempRank = updatedItems[index].rank
            updatedItems[index].rank = updatedItems[index + 1].rank
            updatedItems[index + 1].rank = tempRank
        }

        updatedItems.sort((a: any, b: any) => a.rank - b.rank)

        const tempMenus = [...menus]
            ; (tempMenus[effectiveIndex] as any).items = updatedItems

        setMenus(tempMenus)
        setIsDirty(true)
    }

    const handleSave = async () => {
        if (!currentMenu || !isDirty) return

        try {
            setIsSaving(true)
            await updateMenu((currentMenu as any)._id, { items: (currentMenu as any).items })
            toast.success('Menu priority saved successfully')
            setIsDirty(false)
            loadMenus()
        } catch (error) {
            console.error('Failed to save menu priority:', error)
            toast.error('Failed to save menu priority')
        } finally {
            setIsSaving(false)
        }
    }

    const handleCancel = () => {
        if (isDirty) {
            if (confirm('You have unsaved changes. Are you sure you want to discard them?')) {
                loadMenus()
                setIsDirty(false)
            }
        }
    }


    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        if (active.id !== over?.id && currentMenu) {
            const oldIndex = (currentMenu as any).items.findIndex(
                (item: any) => item.titles === active.id,
            )
            const newIndex = (currentMenu as any).items.findIndex(
                (item: any) => item.titles === over?.id,
            )

            const newItems = arrayMove((currentMenu as any).items, oldIndex, newIndex)

            const updatedItems = newItems.map((item: any, index: number) => ({
                ...item,
                rank: index + 1,
            }))

            const tempMenus = [...menus]
                ; (tempMenus[effectiveIndex] as any).items = updatedItems

            setMenus(tempMenus)
            setIsDirty(true)
        }
    }


    // Initial loading state
    if (isLoading && menus.length === 0 && !searchTerm) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p className="text-muted-foreground">Loading menus...</p>
                </div>
            </div>
        )
    }



    return (
        <div className="p-8">
            {/* <AddItemComponent
                open={drawerOpen}
                toggleDrawer={toggleDrawer}
                menu={menus}
                typeform="create"
                selectedMenuId={selectedMenuId}
            /> */}

            <Card className="mb-6">
                <CardContent className="flex justify-between items-center p-6">
                    <div>
                        <h1 className="text-2xl font-bold">
                            Menu Priority {menus.length > 0 ? `(${menus.length})` : '(0)'}
                        </h1>
                        <p className="text-muted-foreground">Manage menu item priorities and ordering</p>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">

                    <div className="md:col-span-3">
                        <Card className="flex flex-col">
                            <CardContent className="p-4 flex-1 flex flex-col min-h-0">
                                <div className="relative mb-4">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search menus..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9 pr-9"
                                    />
                                    {searchTerm && (
                                        <button
                                            onClick={() => setSearchTerm('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                                <div className="max-h-[650px] overflow-y-auto pr-2 custom-scrollbar flex-1">
                                    <div className="space-y-2">
                                        {menus.length > 0 ? (
                                            menus.map((menu: any, index) => (
                                                <MenuItemTile
                                                    key={menu._id}
                                                    menu={menu}
                                                    index={index}
                                                    setSelectedMenuId={setSelectedMenuId}
                                                    setSelectedMenu={setSelectedMenuIndex}
                                                    selectedMenu={effectiveIndex}
                                                />
                                            ))
                                        ) : (
                                            !isLoading && (
                                                <div className="text-center py-8 px-4 border-2 border-dashed rounded-lg">
                                                    <p className="text-sm text-muted-foreground font-medium">
                                                        {searchTerm ? 'No matching menus found' : 'No menus found'}
                                                    </p>
                                                    {searchTerm && (
                                                        <Button
                                                            variant="link"
                                                            size="sm"
                                                            onClick={() => setSearchTerm('')}
                                                            className="mt-1"
                                                        >
                                                            Clear search
                                                        </Button>
                                                    )}
                                                </div>
                                            )
                                        )}

                                        {hasMore && (
                                            <Button
                                                variant="ghost"
                                                className="w-full text-xs text-muted-foreground hover:text-foreground mt-2"
                                                onClick={() => loadMenus(true)}
                                                disabled={isLoading}
                                            >
                                                {isLoading ? 'Loading...' : 'Load More'}
                                            </Button>
                                        )}
                                    </div>
                                </div>


                            </CardContent>
                        </Card>
                    </div>



                    <div className="md:col-span-9">
                        <Card>
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <CardTitle>Menu Items</CardTitle>
                                    <div className="flex items-center gap-2">
                                        {isDirty && (
                                            <>
                                                <Button variant="ghost" size="sm" onClick={handleCancel}>
                                                    Cancel
                                                </Button>
                                                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                                </Button>
                                            </>
                                        )}
                                        <Button onClick={() => router.push('/menu/priority/create')} size="icon" className="rounded-full h-10 w-10">
                                            <Plus className="h-6 w-6" />
                                        </Button>
                                    </div>
                                </div>

                            </CardHeader>
                            <CardContent>
                                <DndContext collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
                                    <SortableContext
                                        items={(currentMenu as any)?.items?.map((men: any) => men.titles) || []}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        <div className="space-y-2">
                                            {(currentMenu as any)?.items?.map((item: any, index: number) => {
                                                return (
                                                    <SubItemTile
                                                        key={index}
                                                        item={item}
                                                        index={index}
                                                        handleRankChange={handleRankChange}
                                                        totalLength={(currentMenu as any)?.items?.length - 1}
                                                    />
                                                )
                                            })}
                                        </div>
                                    </SortableContext>
                                </DndContext>

                            </CardContent>
                        </Card>
                </div>
            </div>
        </div>
    )
}


export default MenuPriorityPage

