import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ThemedText from '../ThemedText';

// Mock useAppTheme so ThemeProvider's React 19 use(_savedThemeProm) suspension
// (which requires AsyncStorage) is never triggered.
jest.mock('../../src/theme', () => ({
  useAppTheme: () => ({
    themeName: 'light',
    selectedTheme: 'light',
    setThemePreference: jest.fn(),
  }),
}));

describe('ThemedText', () => {
  it('renders the provided text', () => {
    render(<ThemedText>Hello world</ThemedText>);
    expect(screen.getByText('Hello world')).toBeTruthy();
  });

  it('applies light theme text color and fontWeight 600 by default (title=false)', () => {
    render(<ThemedText testID="txt">Body text</ThemedText>);
    const el = screen.getByTestId('txt');
    const style = el.props.style;
    const flat = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flat.color).toBe('#3d1e7a');
    expect(flat.fontWeight).toBe('600');
  });

  it('applies title color and fontWeight 700 when title=true', () => {
    render(<ThemedText testID="title-txt" title>Page Title</ThemedText>);
    const el = screen.getByTestId('title-txt');
    const style = el.props.style;
    const flat = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flat.color).toBe('#14043a');
    expect(flat.fontWeight).toBe('700');
  });

  it('always sets maxFontSizeMultiplier={1.6}', () => {
    render(<ThemedText testID="mfs">Text</ThemedText>);
    expect(screen.getByTestId('mfs').props.maxFontSizeMultiplier).toBe(1.6);
  });

  it('merges an additional style prop', () => {
    render(
      <ThemedText testID="custom" style={{ fontSize: 24 }}>
        Styled
      </ThemedText>,
    );
    const style = screen.getByTestId('custom').props.style;
    const flat = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flat.fontSize).toBe(24);
  });
});
