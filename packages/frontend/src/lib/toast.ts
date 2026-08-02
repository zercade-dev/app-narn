/**
 * Thin wrapper around sonner's `toast` that also logs every shown notification
 * to the console panel under the "notifications" category.
 */
import { toast as sonnerToast } from 'sonner';
import type { ExternalToast } from 'sonner';
import { useLoggerStore } from '../stores/logger-store.js';
import { randomId } from './utils.js';

type ToastMessage = Parameters<typeof sonnerToast>[0];

function messageToString(message: ToastMessage): string {
  if (typeof message === 'string') return message;
  if (typeof message === 'number') return String(message);
  return '(rich content)';
}

function logNotification(type: string, message: ToastMessage): void {
  useLoggerStore.getState().addEntry({
    id: `notif-${randomId()}`,
    level: 'notification',
    message: `[${type}] ${messageToString(message)}`,
    timestamp: Date.now(),
  });
}

function basicToast(message: ToastMessage, options?: ExternalToast) {
  logNotification('toast', message);
  return sonnerToast(message, options);
}

basicToast.success = function success(message: ToastMessage, options?: ExternalToast) {
  logNotification('success', message);
  return sonnerToast.success(message, options);
};

basicToast.error = function error(message: ToastMessage, options?: ExternalToast) {
  logNotification('error', message);
  return sonnerToast.error(message, options);
};

basicToast.warning = function warning(message: ToastMessage, options?: ExternalToast) {
  logNotification('warning', message);
  return sonnerToast.warning(message, options);
};

basicToast.info = function info(message: ToastMessage, options?: ExternalToast) {
  logNotification('info', message);
  return sonnerToast.info(message, options);
};

basicToast.loading = function loading(message: ToastMessage, options?: ExternalToast) {
  logNotification('loading', message);
  return sonnerToast.loading(message, options);
};

// Pass-through for non-showing operations. The unused sonner properties
// (`promise`, `custom`, `message`, `getHistory`, `getToasts`) are intentionally
// omitted because attaching them to `basicToast` would leak sonner's private
// `PromiseIExtendedResult` type into the exported interface (TS4032).
basicToast.dismiss = sonnerToast.dismiss;

export const toast = basicToast;
