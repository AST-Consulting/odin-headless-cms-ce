import { deleteMenu } from '@/lib/api'
import React from 'react'
import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const MenuItemTile = ({
  menu,
  index,
  selectedMenu,
  setSelectedMenu,
  setSelectedMenuId,
}: {
  menu: any
  index: number
  selectedMenu: number
  setSelectedMenu: any
  setSelectedMenuId: any
}) => {
  const router = useRouter()

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this menu?')) return

    try {
      await deleteMenu(id)
      toast.success('Menu deleted successfully')
      window.location.reload()
    } catch (error) {
      console.error('Failed to delete menu:', error)
      toast.error('Failed to delete menu')
    }
  }

  const handleEdit = (id: string) => {
    router.push(`/menu/edit/${id}`)
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between p-3 rounded-md cursor-pointer hover:bg-accent transition-colors',
        selectedMenu === index && 'bg-accent',
      )}
      onClick={() => {
        setSelectedMenu(index)
        if (menu._id) {
          setSelectedMenuId(menu._id)
        }
      }}
    >
      <span className="font-medium">{menu?.title}</span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              handleEdit(menu._id)
            }}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              handleDelete(menu._id)
            }}
            className="text-red-600"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default MenuItemTile
