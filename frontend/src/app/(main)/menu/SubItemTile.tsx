import { Card, CardContent } from '@/components/ui/card'
import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const SubItemTile = ({
  item,
  index,
  handleRankChange,
  totalLength,
}: {
  item: any
  index: number
  handleRankChange: any
  totalLength: number
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: item.titles,
  })

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  }

  return (
    <div ref={setNodeRef} {...attributes} {...listeners} style={style}>
      <Card className="my-2 border-2 hover:bg-accent/50 cursor-move">
        <CardContent className="p-4">
          <p className="font-medium">{item?.titles}</p>
        </CardContent>
      </Card>
    </div>
  )
}

export default SubItemTile
