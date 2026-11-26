import React, {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

export interface PortalEntry {
  id: string;
  zIndex: number;
  node: React.ReactNode;
}

type BackHandlerCallback = () => boolean;
export type OverlayPriority = boolean | 'alert' | 'lock';

function resolveTier(priority: OverlayPriority = false): 0 | 1 | 2 {
  if (priority === 'lock') return 2;
  if (priority === true || priority === 'alert') return 1;
  return 0;
}

interface OverlayStore {
  subscribe: (listener: () => void) => () => void;
  registerLayer: (id: string, priority?: OverlayPriority) => () => void;
  bringToFront: (id: string, priority?: OverlayPriority) => void;
  getLayerZIndex: (id: string) => number;
  setBackHandler: (id: string, handler: BackHandlerCallback | null) => void;
  upsertPortal: (id: string, node: React.ReactNode) => void;
  removePortal: (id: string) => void;
  getPortalsSnapshot: () => readonly PortalEntry[];
  handleBackPress: () => boolean;
}

function createOverlayStore(): OverlayStore {
  const regularLayers: string[] = [];
  const priorityLayers: string[] = [];
  const lockLayers: string[] = [];
  const portals = new Map<string, React.ReactNode>();
  const backHandlers = new Map<string, BackHandlerCallback>();
  const listeners = new Set<() => void>();
  let portalsSnapshot: PortalEntry[] = [];

  const getTierList = (tier: 0 | 1 | 2): string[] => {
    if (tier === 2) return lockLayers;
    if (tier === 1) return priorityLayers;
    return regularLayers;
  };

  const getIndex = (id: string): number => {
    const regIdx = regularLayers.indexOf(id);
    if (regIdx !== -1) return regIdx;
    const prioIdx = priorityLayers.indexOf(id);
    if (prioIdx !== -1) return 1000 + prioIdx;
    const lockIdx = lockLayers.indexOf(id);
    if (lockIdx !== -1) return 2000 + lockIdx;
    return -1;
  };

  const rebuildPortalsSnapshot = () => {
    const next: PortalEntry[] = [];
    for (const [id, node] of portals.entries()) {
      const idx = getIndex(id);
      next.push({
        id,
        zIndex: idx >= 0 ? 1000 + idx * 2 : 1000,
        node,
      });
    }
    next.sort((a, b) => a.zIndex - b.zIndex);
    portalsSnapshot = next;
  };

  const notify = () => {
    rebuildPortalsSnapshot();
    listeners.forEach((listener) => listener());
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const removeFromAllLists = (id: string): boolean => {
    let changed = false;
    for (const list of [regularLayers, priorityLayers, lockLayers]) {
      const idx = list.indexOf(id);
      if (idx !== -1) {
        list.splice(idx, 1);
        changed = true;
      }
    }
    return changed;
  };

  const registerLayer = (id: string, priority: OverlayPriority = false) => {
    const target = getTierList(resolveTier(priority));
    const existingIdx = target.indexOf(id);
    if (existingIdx === -1) {
      removeFromAllLists(id);
      target.push(id);
      notify();
    }
    return () => {
      if (removeFromAllLists(id)) {
        notify();
      }
    };
  };

  const bringToFront = (id: string, priority: OverlayPriority = false) => {
    const target = getTierList(resolveTier(priority));
    const idx = target.indexOf(id);
    if (idx === -1) return;
    if (idx === target.length - 1) return;
    target.splice(idx, 1);
    target.push(id);
    notify();
  };

  const getLayerZIndex = (id: string): number => {
    const idx = getIndex(id);
    return idx >= 0 ? 1000 + idx * 2 : 1000;
  };

  const setBackHandler = (id: string, handler: BackHandlerCallback | null) => {
    if (handler) {
      backHandlers.set(id, handler);
    } else {
      backHandlers.delete(id);
    }
  };

  const upsertPortal = (id: string, node: React.ReactNode) => {
    portals.set(id, node);
    notify();
  };

  const removePortal = (id: string) => {
    if (portals.delete(id)) {
      notify();
    }
  };

  const getPortalsSnapshot = () => portalsSnapshot;

  const handleBackPress = (): boolean => {
    // Lock-tier layers (AppLockScreen) ALWAYS have highest BackHandler precedence over any alert or modal
    for (let i = lockLayers.length - 1; i >= 0; i--) {
      const handler = backHandlers.get(lockLayers[i]);
      if (handler && handler()) return true;
    }
    for (let i = priorityLayers.length - 1; i >= 0; i--) {
      const handler = backHandlers.get(priorityLayers[i]);
      if (handler && handler()) return true;
    }
    for (let i = regularLayers.length - 1; i >= 0; i--) {
      const handler = backHandlers.get(regularLayers[i]);
      if (handler && handler()) return true;
    }
    return false;
  };

  return {
    subscribe,
    registerLayer,
    bringToFront,
    getLayerZIndex,
    setBackHandler,
    upsertPortal,
    removePortal,
    getPortalsSnapshot,
    handleBackPress,
  };
}

const OverlayContext = createContext<OverlayStore | null>(null);
export const SheetDepthContext = createContext<boolean>(false);

export const OverlayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [store] = useState<OverlayStore>(() => createOverlayStore());

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      return store.handleBackPress();
    });
    return () => {
      sub.remove();
    };
  }, [store]);

  return (
    <OverlayContext.Provider value={store}>
      {children}
    </OverlayContext.Provider>
  );
};

export function useIsInsideSheet(): boolean {
  return useContext(SheetDepthContext);
}

/**
 * Registers an in-app overlay layer for deterministic LIFO z-ordering and
 * Android hardware back-button handling without stacking native `<Modal>` views.
 */
export function useOverlayLayer(
  layerActive: boolean,
  backActive: boolean,
  onBack?: () => boolean,
  priority: OverlayPriority = false
): { overlayId: string; zIndex: number } {
  const store = useContext(OverlayContext);
  const overlayId = useId();

  useLayoutEffect(() => {
    if (!store || !layerActive) return;
    return store.registerLayer(overlayId, priority);
  }, [store, overlayId, layerActive, priority]);

  // If a closing overlay reopens before its exit animation finishes (layerActive never went false),
  // bump it back to the top of its tier so zIndex & BackHandler order never invert.
  useLayoutEffect(() => {
    if (!store || !layerActive || !backActive) return;
    store.bringToFront(overlayId, priority);
  }, [store, overlayId, layerActive, backActive, priority]);

  useEffect(() => {
    if (!store || !backActive || !onBack) {
      store?.setBackHandler(overlayId, null);
      return;
    }
    store.setBackHandler(overlayId, onBack);
    return () => {
      store.setBackHandler(overlayId, null);
    };
  }, [store, overlayId, backActive, onBack]);

  const zIndex = useSyncExternalStore(
    store ? store.subscribe : NOOP_SUBSCRIBE,
    () => (store ? store.getLayerZIndex(overlayId) : 1000)
  );

  return { overlayId, zIndex };
}

const NOOP_SUBSCRIBE = () => () => {};
const EMPTY_PORTALS: readonly PortalEntry[] = [];

export const OverlayPortal: React.FC<{
  id: string;
  active: boolean;
  children: React.ReactNode;
}> = ({ id, active, children }) => {
  const store = useContext(OverlayContext);

  useLayoutEffect(() => {
    if (!store) return;
    if (active) {
      store.upsertPortal(id, children);
    } else {
      store.removePortal(id);
    }
  }, [store, id, active, children]);

  useLayoutEffect(() => {
    if (!store) return;
    return () => {
      store.removePortal(id);
    };
  }, [store, id]);

  return null;
};

export const OverlayHost: React.FC = () => {
  const store = useContext(OverlayContext);
  const entries = useSyncExternalStore(
    store ? store.subscribe : NOOP_SUBSCRIBE,
    () => (store ? store.getPortalsSnapshot() : EMPTY_PORTALS)
  );

  if (entries.length === 0) return null;

  return (
    <View pointerEvents="box-none" style={styles.host}>
      {entries.map((entry) => (
        <View
          key={entry.id}
          pointerEvents="box-none"
          style={[StyleSheet.absoluteFill, { zIndex: entry.zIndex }]}
        >
          {entry.node}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 50000,
    elevation: 500,
  },
});
