import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { TextInput, TextInputProps } from 'react-native';

/**
 * Drop-in replacement for React Native's `<TextInput>` that eliminates Android
 * mid-word cursor jumping inside portaled modals (`OverlayPortal` / Fabric).
 *
 * Why: Passing a controlled `value` prop into `<TextInput>` inside `OverlayPortal`
 * causes a 1-commit lag where RN's internal `useTextInputStateSynchronization`
 * sees `lastNativeText !== props.value`, calls `setTextAndSelection(..., -1, -1)`,
 * and resets Android's EditText cursor to the beginning of the word.
 *
 * How this fixes it:
 * - Keeps the underlying `<TextInput>` uncontrolled (`defaultValue`) during typing
 *   so Android's native EditText & IME retain 100% control over cursor & composing.
 * - Tracks emitted keystrokes in a FIFO queue (`pendingEmitsRef`) so echoes of
 *   the user's own typing (even rapid typing) never touch the native input.
 * - Syncs external programmatic value changes (preset chips, clear buttons, blur
 *   normalization, switching edited items) cleanly by updating `defaultValue` + key.
 */
export const StableTextInput = forwardRef<
  React.ComponentRef<typeof TextInput>,
  TextInputProps
>(({ value, defaultValue, onChangeText, onFocus, onBlur, ...rest }, forwardedRef) => {
  const initialText = value ?? defaultValue ?? '';
  const [sync, setSync] = useState<{ version: number; text: string }>(() => ({
    version: 0,
    text: initialText,
  }));

  const innerRef = useRef<React.ComponentRef<typeof TextInput> | null>(null);
  const isFocusedRef = useRef<boolean>(false);
  // Latest text known to be inside the native EditText
  const lastNativeTextRef = useRef<string>(initialText);
  // Bounded FIFO queue of very recent user keystroke emissions (for 1-frame OverlayPortal echoes)
  const pendingEmitsRef = useRef<{ text: string; ts: number }[]>([]);

  const setCombinedRef = useCallback(
    (node: React.ComponentRef<typeof TextInput> | null) => {
      innerRef.current = node;
      if (typeof forwardedRef === 'function') {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    },
    [forwardedRef]
  );

  const handleChangeText = useCallback(
    (nextText: string) => {
      lastNativeTextRef.current = nextText;
      const queue = pendingEmitsRef.current;
      // Remove any older duplicate of the same text so stale values never match ahead of newer edits
      const dupIdx = queue.findIndex((entry) => entry.text === nextText);
      if (dupIdx !== -1) {
        queue.splice(dupIdx, 1);
      }
      queue.push({ text: nextText, ts: Date.now() });
      if (queue.length > 12) {
        queue.splice(0, queue.length - 12);
      }
      onChangeText?.(nextText);
    },
    [onChangeText]
  );

  const handleFocus = useCallback<NonNullable<TextInputProps['onFocus']>>(
    (e) => {
      isFocusedRef.current = true;
      onFocus?.(e);
    },
    [onFocus]
  );

  const handleBlur = useCallback<NonNullable<TextInputProps['onBlur']>>(
    (e) => {
      isFocusedRef.current = false;
      pendingEmitsRef.current = [];
      onBlur?.(e);
    },
    [onBlur]
  );

  useEffect(() => {
    if (value === undefined) return;

    // 1. Native EditText already holds this exact text: nothing to sync, clear pending echoes
    if (value === lastNativeTextRef.current) {
      pendingEmitsRef.current = [];
      return;
    }

    // 2. Check if `value` is an in-flight 1-frame echo of a keystroke from a fast typing burst
    const now = Date.now();
    const queue = pendingEmitsRef.current;
    while (queue.length > 0 && now - queue[0].ts > 120) {
      queue.shift();
    }
    const matchIdx = queue.findIndex((entry) => entry.text === value);
    if (matchIdx !== -1) {
      queue.splice(0, matchIdx + 1);
      return;
    }

    // 3. Genuine external programmatic update (preset chip, clear button, blur normalize, item switch)
    pendingEmitsRef.current = [];
    lastNativeTextRef.current = value;

    // If currently focused (e.g. tapping Clear X while typing in search), update native text
    // in-place without remounting so focus and the soft keyboard stay open smoothly.
    if (isFocusedRef.current && innerRef.current) {
      if (value === '') {
        innerRef.current.clear();
      } else {
        innerRef.current.setNativeProps({ text: value });
      }
      return;
    }

    setSync((prev) => ({
      version: prev.version + 1,
      text: value,
    }));
  }, [value]);

  return (
    <TextInput
      ref={setCombinedRef}
      key={sync.version}
      defaultValue={sync.text}
      onChangeText={handleChangeText}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...rest}
    />
  );
});

StableTextInput.displayName = 'StableTextInput';
