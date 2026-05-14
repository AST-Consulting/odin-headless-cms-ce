"use client";

import { createReactBlockSpec } from "@blocknote/react";
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle, ChevronDown, ChevronUp } from "lucide-react";

// FAQ Component for the Editor
export function FaqComponent({ question, answer }: { question: string; answer: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div contentEditable={false} className="my-2 w-full">
      <Card 
        className="w-full border border-primary/10 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
      >
        <CardHeader 
          className="p-4 bg-primary/5 cursor-pointer flex flex-row items-center justify-between gap-4 select-none"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <HelpCircle className="w-5 h-5 text-primary shrink-0" />
            <span className="font-semibold text-base leading-tight">
              {question || "No Question Provided"}
            </span>
          </div>
          <div className="shrink-0 text-muted-foreground">
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </CardHeader>
        {isExpanded && (
          <CardContent className="p-4 border-t border-primary/5 bg-card">
            <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
              {answer || "No Answer Provided"}
            </p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

// Create the FaqBlock spec
export const FaqBlock = createReactBlockSpec(
  {
    type: "faqEmbed",
    propSchema: {
      faqId: { default: "" },
      question: { default: "" },
      answer: { default: "" },
    },
    content: "none",
  },
  {
    render: (props: any) => {
      const { question, answer } = props.block.props;
      return <FaqComponent question={question} answer={answer} />;
    },
  }
);
