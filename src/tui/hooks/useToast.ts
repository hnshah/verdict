/**
 * Lightweight toast bus. App creates the provider and wires dispatch;
 * any screen can call `useToast()` to show an ephemeral message.
 */

import { createContext, useContext } from 'react'

type ToastFn = (message: string) => void

const ToastContext = createContext<ToastFn>(() => {})

export const ToastProvider = ToastContext.Provider

export function useToast(): ToastFn {
  return useContext(ToastContext)
}
