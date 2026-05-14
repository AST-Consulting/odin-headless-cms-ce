import React, { createContext, useContext, useMemo, useState } from "react";
import { BlockNoteEditor, BlockSchema, InlineContentSchema, StyleSchema } from "@blocknote/core";

interface EditorContextType {
  editor: BlockNoteEditor<BlockSchema, InlineContentSchema, StyleSchema> | null;
  setEditor: (editor: BlockNoteEditor<BlockSchema, InlineContentSchema, StyleSchema> | null) => void;
  atomicReplaceQuote?: (blockId: string, quote: string, replacement: string, findingId?: string) => boolean;
}

// Create context with a default value to avoid undefined
const EditorContext = createContext<EditorContextType>({
  editor: null,
  setEditor: () => { },
});

export function EditorContextProvider({ children }: { children: React.ReactNode }) {
  const [editor, setEditor] = useState<any | null>(null);

  const value = useMemo(() => ({ 
    editor, 
    setEditor,
    atomicReplaceQuote: (blockId: string, quote: string, replacement: string, findingId?: string) => {
      if (!editor) return false;
      const block = editor.getBlock(blockId);
      if (!block || !Array.isArray(block.content)) return false;

      const newContent: any[] = [];
      let replaced = false;

      block.content.forEach((item: any) => {
        if (item.type === "text" && !replaced && item.text.includes(quote)) {
           const index = item.text.indexOf(quote);
           const before = item.text.substring(0, index);
           const after = item.text.substring(index + quote.length);

           if (before) newContent.push({ ...item, text: before });
           
           // Replace text and remove the factCheck style
           const { factCheck, ...cleanStyles } = item.styles || {};
           newContent.push({ ...item, text: replacement, styles: cleanStyles });
           
           if (after) newContent.push({ ...item, text: after });
           replaced = true;
        } else if (item.styles?.factCheck) {
           // Cleanup styles if it's the exact same finding but maybe split across segments
           const [fId] = item.styles.factCheck.split('|');
           if (fId === findingId) {
               const { factCheck, ...cleanStyles } = item.styles;
               newContent.push({ ...item, styles: cleanStyles });
           } else {
               newContent.push(item);
           }
        } else {
           newContent.push(item);
        }
      });

      if (replaced) {
        editor.updateBlock(blockId, { content: newContent } as any);
        return true;
      }
      return false;
    }
  }), [editor, setEditor]);

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditorContext() {
  const context = useContext(EditorContext);
  return context;
}
