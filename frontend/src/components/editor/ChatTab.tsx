"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { chatWithAIStream } from "@/lib/api";
import type { ChatMessage } from "@/lib/types";
import { Loader2, Send, Sparkles, User, Bot, RotateCcw, ArrowRightToLine } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEditorContext } from "./EditorContext";
import { markdownToBlocks } from "@/lib/markdown-to-blocks";
import { shouldAutoInsert } from "@/lib/content-detection";
import { toast } from "sonner";

// Configuration constants
const CHAT_CONFIG = {
  MAX_MESSAGES: 100,
  MAX_MESSAGE_LENGTH: 4000,
  WELCOME_MESSAGE_ID: 'welcome-message',
  MESSAGE_MAX_WIDTH: '85%',
  AVATAR_SIZE: 8,
  INPUT_ROWS: 3,
  INPUT_MAX_ROWS: 6,
  SYSTEM_INSTRUCTION: 'You are a Hindi-language AI writing assistant for a news CMS. Always respond in Hindi by default. If the user writes in English, you may respond in English, but prefer Hindi. Help with rewriting, headlines, SEO, fact-checking, brainstorming, and grammar.',
} as const;

// Generate unique ID for messages
const generateMessageId = () => `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

interface ChatTabProps {
  initialPrompt?: string;
  onPromptUsed?: () => void;
}

export function ChatTab(props: ChatTabProps = {}) {
  const { initialPrompt, onPromptUsed } = props;
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: CHAT_CONFIG.WELCOME_MESSAGE_ID,
      role: 'assistant',
      content: 'नमस्ते! मैं आपका AI लेखन सहायक हूँ। मैं इनमें मदद कर सकता हूँ:\n\n• कंटेंट को रीराइट और बेहतर बनाना\n• हेडलाइन और टाइटल सुझाव\n• SEO ऑप्टिमाइज़ेशन टिप्स\n• फ़ैक्ट-चेकिंग और रिसर्च\n• आइडिया ब्रेनस्टॉर्मिंग\n• व्याकरण और स्टाइल सुधार\n\nआज मैं आपकी किस चीज़ में मदद कर सकता हूँ?',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState("");
  const [insertedMessages, setInsertedMessages] = useState<Set<string>>(new Set());
  const isSubmittingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentUserMessageRef = useRef<string>("");
  const { editor } = useEditorContext();

  // Memoize markdown plugins to avoid recreation on every render
  const markdownPlugins = useMemo(() => [remarkGfm], []);

  const scrollToBottom = useCallback(() => {
    // Scroll within the messages container only, not the entire page
    if (messagesEndRef.current) {
      const container = messagesEndRef.current.parentElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Handle initial prompt
  useEffect(() => {
    if (initialPrompt && !isSubmittingRef.current) {
      setInput(initialPrompt);
      onPromptUsed?.();
      // Auto-focus the textarea
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [initialPrompt, onPromptUsed]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
    };
  }, []);

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => {
      const newMessages = [...prev, message];
      // Prevent memory leak: keep only last MAX_MESSAGES
      return newMessages.length > CHAT_CONFIG.MAX_MESSAGES
        ? newMessages.slice(-CHAT_CONFIG.MAX_MESSAGES)
        : newMessages;
    });
  }, []);

  // Insert content into the BlockNote editor
  const handleInsertToEditor = useCallback((content: string, messageId: string, isAuto = false) => {
    if (!editor) {
      toast.error("Editor is not ready");
      return;
    }

    // Prevent double insertion
    if (insertedMessages.has(messageId)) {
      toast.info("This content has already been inserted");
      return;
    }

    try {
      // Convert markdown to BlockNote blocks using the editor's built-in parser
      // This ensures full support for all BlockNote block types and formatting
      const blocks = markdownToBlocks(content, editor as any);

      // Insert at current cursor position
      editor.insertBlocks(blocks as any, editor.getTextCursorPosition().block);

      // Mark as inserted
      setInsertedMessages(prev => new Set(prev).add(messageId));

      // Show success toast
      if (isAuto) {
        toast.success("✨ Content automatically inserted into editor");
      } else {
        toast.success("✅ Content inserted into editor");
      }
    } catch (error) {
      console.error("Failed to insert content:", error);
      toast.error("Failed to insert content into editor");
    }
  }, [editor, insertedMessages]);

  // Debounced update for streaming messages to prevent excessive re-renders
  const updateStreamingMessage = useCallback((messageId: string, content: string, immediate = false) => {
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current);
    }

    const doUpdate = () => {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === messageId
            ? { ...msg, content }
            : msg
        )
      );
    };

    if (immediate) {
      doUpdate();
    } else {
      // Debounce updates to max 16ms (60fps) for smooth rendering
      updateTimerRef.current = setTimeout(doUpdate, 16);
    }
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent race conditions with ref
    if (!input.trim() || isSubmittingRef.current) return;

    isSubmittingRef.current = true;

    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    // Store user message for auto-insert detection
    currentUserMessageRef.current = userMessage.content;

    const assistantMessageId = generateMessageId();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };

    // Capture history BEFORE updating state to avoid race condition
    // Prepend system instruction as first user-assistant exchange for Hindi default
    const chatHistory = messages
      .filter(msg => msg.id !== CHAT_CONFIG.WELCOME_MESSAGE_ID)
      .map(msg => ({
        role: msg.role,
        content: msg.content,
      }));
    const history = [
      { role: 'user' as const, content: CHAT_CONFIG.SYSTEM_INSTRUCTION },
      { role: 'assistant' as const, content: 'समझ गया। मैं हिंदी में जवाब दूँगा।' },
      ...chatHistory,
    ];

    // Add both messages at once
    setMessages(prev => {
      const newMessages = [...prev, userMessage, assistantMessage];
      return newMessages.length > CHAT_CONFIG.MAX_MESSAGES
        ? newMessages.slice(-CHAT_CONFIG.MAX_MESSAGES)
        : newMessages;
    });

    setInput("");

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const stream = chatWithAIStream({
        message: userMessage.content,
        history,
        signal: abortControllerRef.current.signal,
      });

      let accumulatedContent = '';
      let chunkCount = 0;

      for await (const chunk of stream) {
        chunkCount++;
        if (process.env.NODE_ENV === 'development') {
          console.log(`Chunk ${chunkCount}:`, chunk);
        }
        accumulatedContent += chunk;

        // Use debounced update for better performance
        updateStreamingMessage(assistantMessageId, accumulatedContent);
      }

      // Final update immediately to ensure last chunk is rendered
      updateStreamingMessage(assistantMessageId, accumulatedContent, true);

      if (process.env.NODE_ENV === 'development') {
        console.log(`Stream completed after ${chunkCount} chunks. Total length:`, accumulatedContent.length);
      }

      // If we got no content, show an error
      if (!accumulatedContent) {
        updateStreamingMessage(assistantMessageId, '❌ No response received from AI.', true);
      } else {
        // Check if we should auto-insert this content
        const userMessageContent = currentUserMessageRef.current;
        if (userMessageContent && shouldAutoInsert(userMessageContent)) {
          // Delay auto-insert to allow user to see the response first
          setTimeout(() => {
            handleInsertToEditor(accumulatedContent, assistantMessageId, true);
          }, 500);
        }
      }
    } catch (error: any) {
      // Ignore abort errors
      if (error.name === 'AbortError') {
        if (process.env.NODE_ENV === 'development') {
          console.log('Stream aborted by user');
        }
        return;
      }

      // User-friendly error messages based on error type
      let errorContent = '❌ Sorry, I encountered an error. Please try again.';

      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        errorContent = '🔒 Please log in to continue chatting.';
      } else if (error.message?.includes('429') || error.message?.includes('Too Many')) {
        errorContent = '⏱️ Too many messages. Please wait a moment and try again.';
      } else if (error.message?.includes('timeout') || error.message?.includes('ECONNABORTED')) {
        errorContent = '⏰ Request timed out. The AI is taking too long - please try again.';
      } else if (error.message?.includes('Network') || error.message?.includes('Failed to fetch')) {
        errorContent = '📡 Network error. Check your internet connection and try again.';
      }

      updateStreamingMessage(assistantMessageId, errorContent, true);

      // Only log in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Chat error:', error);
      }
    } finally {
      isSubmittingRef.current = false;
      abortControllerRef.current = null;
      textareaRef.current?.focus();
    }
  }, [input, messages, updateStreamingMessage, handleInsertToEditor]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleReset = () => {
    setMessages([
      {
        id: CHAT_CONFIG.WELCOME_MESSAGE_ID,
        role: 'assistant',
        content: 'Chat reset! How can I help you today?',
        timestamp: new Date(),
      }
    ]);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">AI Chat Assistant</span>

        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          title="Reset conversation"
          aria-label="Reset conversation"
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
          <span className="sr-only">Reset conversation</span>
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 min-h-0">
        {messages.map((message) => (
          <div
            key={message.id || generateMessageId()}
            className={cn(
              "flex gap-3",
              message.role === 'user' ? "justify-end" : "justify-start"
            )}
          >
            {message.role === 'assistant' && (
              <div
                className="rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0"
                style={{ width: `${CHAT_CONFIG.AVATAR_SIZE * 4}px`, height: `${CHAT_CONFIG.AVATAR_SIZE * 4}px` }}
                aria-hidden="true"
              >
                <Bot className="w-4 h-4 text-primary" />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <div
                className={cn(
                  "rounded-lg px-4 py-2.5",
                  message.role === 'user'
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
                style={{ maxWidth: CHAT_CONFIG.MESSAGE_MAX_WIDTH }}
              >
                {message.content ? (
                  message.role === 'assistant' ? (
                    <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={markdownPlugins}>
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="text-sm whitespace-pre-wrap break-words">
                      {message.content}
                    </div>
                  )
                ) : (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Thinking...</span>
                  </div>
                )}
                {message.timestamp && message.content && (
                  <div className={cn(
                    "text-xs mt-1 opacity-70",
                    message.role === 'user' ? "text-right" : "text-left"
                  )}>
                    {message.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                )}
              </div>

              {/* Insert to Editor Button for Assistant Messages */}
              {message.role === 'assistant' && message.content && message.id !== CHAT_CONFIG.WELCOME_MESSAGE_ID && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleInsertToEditor(message.content as string, message.id as string)}
                  disabled={insertedMessages.has(message.id as string) || !editor}
                  className="self-start text-xs h-7 gap-1.5"
                  aria-label="Insert content into editor"
                >
                  <ArrowRightToLine className="w-3 h-3" />
                  {insertedMessages.has(message.id as string) ? 'Inserted' : 'Insert into Editor'}
                </Button>
              )}
            </div>

            {message.role === 'user' && (
              <div
                className="rounded-full bg-muted flex items-center justify-center flex-shrink-0"
                style={{ width: `${CHAT_CONFIG.AVATAR_SIZE * 4}px`, height: `${CHAT_CONFIG.AVATAR_SIZE * 4}px` }}
                aria-hidden="true"
              >
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="pt-3 border-t flex-shrink-0">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                const value = e.target.value;
                if (value.length <= CHAT_CONFIG.MAX_MESSAGE_LENGTH) {
                  setInput(value);
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder="Type your message... (Shift+Enter for new line)"
              className="resize-none min-h-[80px] max-h-[200px]"
              rows={CHAT_CONFIG.INPUT_ROWS}
              maxLength={CHAT_CONFIG.MAX_MESSAGE_LENGTH}
              disabled={isSubmittingRef.current}
              aria-label="Chat message input"
            />
          </div>
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isSubmittingRef.current}
            className="h-10 w-10 flex-shrink-0"
            aria-label="Send message"
          >
            {isSubmittingRef.current ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="w-4 h-4" aria-hidden="true" />
            )}
          </Button>
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-muted-foreground">
            Press Enter to send • Shift+Enter for new line
          </p>
          <p className="text-xs text-muted-foreground">
            {input.length}/{CHAT_CONFIG.MAX_MESSAGE_LENGTH}
          </p>
        </div>
      </form>
    </div>
  );
}
