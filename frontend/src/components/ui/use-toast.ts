"use client"

import * as React from "react"
import { toast as sonnerToast } from "sonner"

type ToastActionElement = React.ReactElement<any>

export type ToastProps = {
  title?: string
  description?: string
  action?: ToastActionElement
  variant?: "default" | "destructive"
}

export function useToast() {
  return {
    toast: ({ title, description, variant, ...props }: ToastProps) => {
      if (variant === "destructive") {
        sonnerToast.error(title, {
          description,
          ...props,
        })
      } else {
        sonnerToast(title, {
          description,
          ...props,
        })
      }
    },
    dismiss: sonnerToast.dismiss,
  }
}
