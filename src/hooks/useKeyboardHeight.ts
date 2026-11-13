import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Keyboard,
  KeyboardEvent,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  View,
} from 'react-native';

interface KeyboardMetricsValue {
  keyboardHeight: number;
  uncompensatedKeyboardHeight: number;
}

const KeyboardMetricsContext = createContext<KeyboardMetricsValue | null>(null);

function useStandaloneKeyboardHeight(enabled: boolean): number {
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);

  useEffect(() => {
    if (!enabled) return;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e: KeyboardEvent) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [enabled]);

  return keyboardHeight;
}

/**
 * Tracks raw keyboard height and detects whether Android `adjustResize`
 * actually shrank the root container, avoiding double bottom padding when
 * resized while still padding safely on iOS and non-resizing Android layouts.
 */
export const KeyboardMetricsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);
  const [layoutHeight, setLayoutHeight] = useState<number>(0);
  const [restHeight, setRestHeight] = useState<number>(0);

  const keyboardVisibleRef = useRef<boolean>(false);
  const restHeightRef = useRef<number>(0);
  const lastWidthRef = useRef<number>(0);
  const pendingShrinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e: KeyboardEvent) => {
      keyboardVisibleRef.current = true;
      if (pendingShrinkTimerRef.current) {
        clearTimeout(pendingShrinkTimerRef.current);
        pendingShrinkTimerRef.current = null;
      }
      setKeyboardHeight(e.endCoordinates.height);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardVisibleRef.current = false;
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
      if (pendingShrinkTimerRef.current) {
        clearTimeout(pendingShrinkTimerRef.current);
        pendingShrinkTimerRef.current = null;
      }
    };
  }, []);

  const handleRootLayout = useCallback((e: LayoutChangeEvent) => {
    const { height, width } = e.nativeEvent.layout;
    if (height <= 0) return;

    if (pendingShrinkTimerRef.current) {
      clearTimeout(pendingShrinkTimerRef.current);
      pendingShrinkTimerRef.current = null;
    }

    setLayoutHeight(height);
    const widthChanged =
      lastWidthRef.current > 0 && Math.abs(width - lastWidthRef.current) > 1;
    lastWidthRef.current = width;

    if (widthChanged || (!keyboardVisibleRef.current && height >= restHeightRef.current)) {
      restHeightRef.current = height;
      setRestHeight(height);
      return;
    }

    if (!keyboardVisibleRef.current && height < restHeightRef.current) {
      pendingShrinkTimerRef.current = setTimeout(() => {
        pendingShrinkTimerRef.current = null;
        if (!keyboardVisibleRef.current) {
          restHeightRef.current = height;
          setRestHeight(height);
        }
      }, 180);
    }
  }, []);

  const value = useMemo<KeyboardMetricsValue>(() => {
    const resizedBy =
      Platform.OS === 'android' && keyboardHeight > 0 && restHeight > 0 && layoutHeight > 0
        ? Math.max(0, restHeight - layoutHeight)
        : 0;
    const uncompensatedKeyboardHeight =
      keyboardHeight > 0 ? Math.max(0, keyboardHeight - resizedBy) : 0;
    return {
      keyboardHeight,
      uncompensatedKeyboardHeight,
    };
  }, [keyboardHeight, restHeight, layoutHeight]);

  return React.createElement(
    KeyboardMetricsContext.Provider,
    { value },
    React.createElement(
      View,
      { style: styles.root, onLayout: handleRootLayout },
      children
    )
  );
};

/**
 * Tracks keyboard height dynamically across iOS and Android.
 */
export function useKeyboardHeight(): number {
  const ctx = useContext(KeyboardMetricsContext);
  const standaloneHeight = useStandaloneKeyboardHeight(!ctx);
  return ctx ? ctx.keyboardHeight : standaloneHeight;
}

/**
 * Keyboard height not yet compensated by OS window resizing.
 */
export function useUncompensatedKeyboardHeight(): number {
  const ctx = useContext(KeyboardMetricsContext);
  const standaloneHeight = useStandaloneKeyboardHeight(!ctx);
  if (ctx) return ctx.uncompensatedKeyboardHeight;
  return Platform.OS === 'ios' ? standaloneHeight : 0;
}

/**
 * Offset a sticky footer needs to clear the keyboard.
 * Uses measured uncompensated height so iOS and non-resizing Android layouts stay clear
 * without double-padding when Android adjustResize already shrinks the viewport.
 */
export function useFooterKeyboardOffset(): number {
  return useUncompensatedKeyboardHeight();
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
