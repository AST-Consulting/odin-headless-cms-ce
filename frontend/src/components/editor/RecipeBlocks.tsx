"use client";

import { createReactBlockSpec } from "@blocknote/react";
import React from "react";
import { Plus, Trash2, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Recipe Ingredient Block
 * A structured block for entering recipe ingredients with an inline "+" button.
 */
export const RecipeIngredientBlock = createReactBlockSpec(
  {
    type: "recipeIngredient",
    propSchema: {
      text: { default: "" },
    },
    content: "none",
  },
  {
    render: (props: any) => {
      const { editor, block } = props;

      const handleAddAfter = () => {
        editor.insertBlocks(
          [{ type: "recipeIngredient" }],
          block,
          "after"
        );
      };

      const handleDelete = () => {
        editor.removeBlocks([block]);
      };

      return (
        <div className="flex items-center gap-2 group w-full py-1">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-600 shrink-0">
            <Utensils size={14} />
          </div>

          <div className="flex-1 relative">
            <div
              className="min-w-0 min-h-[1.5rem] outline-none"
              contentEditable={true}
              suppressContentEditableWarning={true}
              onBlur={(e) => {
                const text = e.currentTarget.innerText;
                if (text !== block.props.text) {
                  editor.updateBlock(block, { props: { ...block.props, text } });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  const newBlocks = editor.insertBlocks(
                    [{ type: "recipeIngredient" }],
                    block,
                    "after"
                  );
                  if (newBlocks && newBlocks.length > 0) {
                    editor.setTextCursorPosition(newBlocks[0], "start");
                  }
                }
              }}
            >
              {block.props.text}
            </div>
            {!block.props.text && (
              <div className="absolute inset-0 pointer-events-none text-muted-foreground/30 italic text-sm flex items-center">
                Add an ingredient...
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              onClick={handleAddAfter}
              title="Add Ingredient"
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
 * HowToStep Block
 * A structured block for recipe instructions with an inline "+" button.
 */
export const HowToStepBlock = createReactBlockSpec(
  {
    type: "howToStep",
    propSchema: {
      text: { default: "" },
    },
    content: "none",
  },
  {
    render: (props: any) => {
      const { editor, block } = props;

      // Calculate step number reactively
      const [stepNumber, setStepNumber] = React.useState(1);

      React.useEffect(() => {
        const calculateStepNumber = () => {
          const doc = editor.document;
          let count = 1;
          const index = doc.findIndex((b: any) => b.id === block.id);
          if (index !== -1) {
            for (let i = index - 1; i >= 0; i--) {
              if (doc[i].type === "howToStep") {
                count++;
              } else if (doc[i].type === "heading") {
                break;
              }
            }
          }
          setStepNumber(count);
        };

        calculateStepNumber();
        // Subscribe to document changes to recalculate step numbers across all blocks
        return editor.onEditorContentChange(calculateStepNumber);
      }, [editor, block.id]);

      const handleAddAfter = () => {
        editor.insertBlocks(
          [{ type: "howToStep" }],
          block,
          "after"
        );
      };

      const handleDelete = () => {
        editor.removeBlocks([block]);
      };

      return (
        <div className="flex items-start gap-3 group w-full py-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold text-sm shrink-0 mt-0.5">
            {stepNumber}
          </div>

          <div className="flex-1 relative">
            <div
              className="min-w-0 min-h-[1.5rem] pt-0.5 outline-none"
              contentEditable={true}
              suppressContentEditableWarning={true}
              onBlur={(e) => {
                const text = e.currentTarget.innerText;
                if (text !== block.props.text) {
                  editor.updateBlock(block, { props: { ...block.props, text } });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  const newBlocks = editor.insertBlocks(
                    [{ type: "howToStep" }],
                    block,
                    "after"
                  );
                  if (newBlocks && newBlocks.length > 0) {
                    editor.setTextCursorPosition(newBlocks[0], "start");
                  }
                }
              }}
            >
              {block.props.text}
            </div>
            {!block.props.text && (
              <div className="absolute inset-0 pointer-events-none text-muted-foreground/30 italic text-sm flex items-start pt-1">
                Enter step description...
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              onClick={handleAddAfter}
              title="Add Step"
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
