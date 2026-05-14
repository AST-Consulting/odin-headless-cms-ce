"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useAuthStore } from "@/lib/auth";
import { AIPromptDialog } from "./AIPromptDialog";

// Dynamically import JoditEditor to avoid SSR issues
const JoditEditor = dynamic(() => import("jodit-react"), { ssr: false });

interface RichTextEditorProps {
  value: string;
  config?: any;
  onBlur?: (content: string) => void;
  onChange: (content: string) => void;
  title?: string;
  characterLimit?: number;
  buttons?: string[];
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  config,
  onBlur,
  onChange,
  title,
  characterLimit,
  buttons,
}) => {
  const editor = useRef<any>(null);
  const token = useAuthStore((state) => state.token);
  const showTitle = title ? title : "description";
  const [charCount, setCharCount] = useState(0);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  const buttonStyles = buttons || [
    "bold",
    "italic",
    "underline",
    "|",
    "ul",
    "ol",
    "|",
    "font",
    "fontsize",
    "brush",
    "paragraph",
    "|",
    "table",
    "link",
    "|",
    "left",
    "center",
    "right",
    "justify",
    "|",
    "undo",
    "redo",
    "|",
    "hr",
    "eraser",
    "|",
    "fullsize",
    "|",
    "ai-generate",
    "source",
  ];

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

  const getTextLength = (html: string) => {
    const temp = document.createElement("div");
    temp.innerHTML = html;
    return temp.textContent?.length || 0;
  };

  const handleContentChange = (newContent: string) => {
    const length = getTextLength(newContent);
    setCharCount(length);

    if (characterLimit && length > characterLimit) {
      const temp = document.createElement("div");
      temp.innerHTML = newContent;
      let text = temp.textContent || "";
      text = text.substring(0, characterLimit);
      temp.textContent = text;

      if (editor.current?.value) {
        editor.current.value = temp.innerHTML;
      }

      setCharCount(characterLimit);
    }
  };

  const handleAIGenerate = (generatedContent: string) => {
    if (editor.current) {
      const joditInstance = editor.current;

      // Insert content at cursor position
      joditInstance.selection.insertHTML(generatedContent);

      // Trigger change event
      const newContent = joditInstance.value;
      handleContentChange(newContent);
      onChange(newContent);
    }
  };

  const configData = useMemo(
    () => ({
      readonly: false,
      placeholder: "Write your " + showTitle + " here...",
      uploader: {
        url: `${API_BASE}/files/upload?path=public&isPrivate=false`,
        insertImageAsBase64URI: false,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        isSuccess: function (resp: any) {
          if (resp.data) return true;
          return false;
        },
        process: function (resp: any) {
          return {
            url: resp.data.url,
          };
        },
        defaultHandlerSuccess: async function (data: any) {
          //@ts-ignore
          this.selection.insertImage(data.url);
        },
        defaultHandlerError: function (error: any) {
          console.error("Upload error:", error);
        },
        imageProcessor: {
          replaceDataURIToBlobIdInView: true,
        },
        buildData: function (data: any) {
          return new Promise(function (resolve, reject) {
            const reader = new FileReader();
            reader.readAsDataURL(data.getAll("files[0]")[0]);
            reader.onload = function () {
              const formData = new FormData();
              formData.append("files", data.getAll("files[0]")[0]);
              resolve(formData);
            };
            reader.onerror = function (error) {
              reject(error);
            };
          });
        },
      },
      iframe: true,
      editHTMLDocumentMode: true,
      askBeforePasteFromWord: false,
      askBeforePasteHTML: true,
      processPasteHTML: true,
      showCharsCounter: false,
      showWordsCounter: false,
      showXPathInStatusbar: false,
      hidePoweredByJodit: true,
      buttons: buttonStyles,
      buttonsMD: buttonStyles,
      buttonsSM: buttonStyles,
      buttonsXS: buttonStyles,
      extraButtons: [
        {
          name: "ai-generate",
          icon: "✨",
          tooltip: "Generate with AI",
          exec: () => {
            setAiDialogOpen(true);
          },
        },
      ],
      events: {
        change: (newContent: string) => {
          handleContentChange(newContent);
          onChange(newContent);
        },
        blur: () => {
          if (onBlur) {
            const newContent = editor.current?.value || "";
            onBlur(newContent);
          }
        },
      },
      ...config,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token]
  );

  return (
    <div>
      <JoditEditor
        ref={editor}
        value={value}
        config={configData}
      />
      {characterLimit && (
        <div
          style={{
            marginTop: "8px",
            fontSize: "14px",
            color: charCount >= characterLimit ? "#dc2626" : "#6b7280",
            textAlign: "right",
          }}
        >
          {charCount}/{characterLimit} characters
        </div>
      )}

      <AIPromptDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        onGenerate={handleAIGenerate}
      />
    </div>
  );
};

export default RichTextEditor;

