import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { Palette, Typography } from '../theme/tokens';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render-time crashes so the app never ends on a blank screen.
 * Users can retry rendering without losing their saved data.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.warn('Unhandled render error:', error?.message);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.iconWrapper}>
            <AlertTriangle size={24} color={Palette.error} />
          </View>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            The screen could not be displayed. Your saved data is safe — try to reopen the app
            screen below.
          </Text>
          <TouchableOpacity
            style={styles.button}
            activeOpacity={0.85}
            accessibilityRole="button"
            onPress={() => this.setState({ error: null })}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Palette.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Palette.hairline,
    paddingHorizontal: 22,
    paddingVertical: 24,
    alignItems: 'center',
  },
  iconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FDF0ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    ...Typography.subheading,
    fontSize: 17,
    fontWeight: '700',
    color: Palette.ink,
    textAlign: 'center',
    marginBottom: 6,
  },
  message: {
    ...Typography.body,
    fontSize: 13,
    color: Palette.muted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
  },
  button: {
    backgroundColor: Palette.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  buttonText: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '700',
    color: Palette.white,
  },
});
