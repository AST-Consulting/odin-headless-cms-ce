"use client";

import { createReactBlockSpec } from "@blocknote/react";
import React from "react";
import { Plus, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Movie Cast Block
 * A structured block for entering cast members (Actor and Character).
 */
export const MovieCastBlock = createReactBlockSpec(
  {
    type: "movieCast",
    propSchema: {
      actorName: { default: "" },
      characterName: { default: "" },
    },
    content: "none",
  },
  {
    render: (props: any) => {
      const { editor, block } = props;

      // Calculate cast member number reactively
      const [castNumber, setCastNumber] = React.useState(1);

      React.useEffect(() => {
        const calculateAndSet = () => {
          const doc = editor.document;
          let count = 1;
          const index = doc.findIndex((b: any) => b.id === block.id);
          if (index !== -1) {
            for (let i = index - 1; i >= 0; i--) {
              if (doc[i].type === "movieCast") {
                count++;
              } else if (doc[i].type === "heading" && (doc[i].props as any).level === 2) {
                break;
              }
            }
          }
          setCastNumber(count);
        };

        calculateAndSet();
        return editor.onEditorContentChange(calculateAndSet);
      }, [editor, block.id]);

      const handleAddAfter = () => {
        const newBlocks = editor.insertBlocks(
          [{ type: "movieCast", content: "" }],
          block.id,
          "after"
        );
        if (newBlocks && newBlocks.length > 0) {
            editor.setTextCursorPosition(newBlocks[0], "start");
        }
      };

      const handleDelete = () => {
        editor.removeBlocks([block]);
      };

      const updateProps = (newProps: any) => {
        editor.updateBlock(block, { props: { ...block.props, ...newProps } });
      };

      return (
        <div className="flex items-center gap-3 group w-full py-1.5 border-b border-muted/30 last:border-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-bold text-xs shrink-0">
            {castNumber}
          </div>

          <div className="flex-1 grid grid-cols-2 gap-4">
            <div className="relative">
              <div
                className="min-w-0 outline-none text-sm font-semibold"
                contentEditable={true}
                suppressContentEditableWarning={true}
                onBlur={(e) => updateProps({ actorName: e.currentTarget.innerText })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAddAfter();
                  }
                }}
              >
                {block.props.actorName}
              </div>
              {!block.props.actorName && (
                <div className="absolute inset-0 pointer-events-none text-muted-foreground/30 italic text-sm">
                  Actor Name...
                </div>
              )}
            </div>

            <div className="relative border-l pl-4 border-muted/50">
              <div
                className="min-w-0 outline-none text-sm text-muted-foreground"
                contentEditable={true}
                suppressContentEditableWarning={true}
                onBlur={(e) => updateProps({ characterName: e.currentTarget.innerText })}
              >
                {block.props.characterName}
              </div>
              {!block.props.characterName && (
                <div className="absolute inset-0 pointer-events-none text-muted-foreground/30 italic text-sm pl-4">
                  as Character...
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              onClick={handleAddAfter}
              title="Add Cast Member"
            >
              <Plus size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
              onClick={handleDelete}
              title="Remove"
            >
              <Trash2 size={16} />
            </Button>
          </div>
        </div>
      );
    },
  }
);

/**
 * Movie Rating Block
 * A visual component to display and edit the overall movie rating.
 */
export const MovieRatingBlock = createReactBlockSpec(
  {
    type: "movieRating",
    propSchema: {
      rating: { default: "8" },
      label: { default: "Overall Rating" },
    },
    content: "none",
  },
  {
    render: (props: any) => {
      const { editor, block } = props;
      const stars = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      const setRating = (val: number) => {
        editor.updateBlock(block, { props: { ...block.props, rating: val.toString() } });
      };

      return (
        <div className="my-6 p-6 rounded-xl border-2 border-blue-100 bg-blue-50/20 shadow-sm flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-blue-700 font-bold uppercase tracking-wider text-xs">
            <Star size={14} className="fill-blue-600" />
            <div
                contentEditable={true}
                suppressContentEditableWarning={true}
                className="outline-none min-w-[50px] text-center"
                onBlur={(e) => editor.updateBlock(block, { props: { ...block.props, label: e.currentTarget.innerText } })}
            >
                {block.props.label}
            </div>
          </div>
          
          <div className="flex gap-1.5">
            {stars.map((s) => (
              <button
                key={s}
                onClick={() => setRating(s)}
                className="transition-transform hover:scale-110 active:scale-95"
              >
                <Star
                  size={24}
                  className={`${
                    s <= parseInt(block.props.rating)
                      ? "fill-yellow-400 text-yellow-400 drop-shadow-sm"
                      : "text-muted-foreground/20"
                  }`}
                />
              </button>
            ))}
          </div>
          
          <div className="text-3xl font-black text-blue-900 flex items-baseline gap-1">
            {block.props.rating}
            <span className="text-sm font-bold text-muted-foreground">/10</span>
          </div>
        </div>
      );
    },
  }
);
