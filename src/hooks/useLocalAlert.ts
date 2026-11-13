import { useState, useCallback, useRef } from 'react';
import { AlertButton, AlertType } from '../components/CustomAlertModal';

export interface LocalAlertConfig {
  visible: boolean;
  id: string;
  title: string;
  message?: string;
  buttons?: AlertButton[];
  type?: AlertType;
}

const INITIAL_ALERT: LocalAlertConfig = {
  visible: false,
  id: '',
  title: '',
};

/**
 * Shared local alert dialog state with ID guarding so chained alerts never close
 * a newer dialog that opened inside a button's `onPress` callback.
 */
export function useLocalAlert() {
  const seqRef = useRef(0);
  const [alertConfig, setAlertConfig] = useState<LocalAlertConfig>(INITIAL_ALERT);

  const showAlert = useCallback(
    (
      title: string,
      message?: string,
      buttons?: AlertButton[],
      type: AlertType = 'info'
    ) => {
      seqRef.current += 1;
      setAlertConfig({
        visible: true,
        id: `local_alert_${seqRef.current}`,
        title,
        message,
        buttons: buttons || [{ text: 'OK', style: 'default' }],
        type,
      });
    },
    []
  );

  const hideAlert = useCallback((alertId?: string) => {
    setAlertConfig((prev) => {
      if (alertId && prev.id !== alertId) return prev;
      return { ...prev, visible: false };
    });
  }, []);

  return {
    alertConfig,
    showAlert,
    hideAlert,
  };
}
