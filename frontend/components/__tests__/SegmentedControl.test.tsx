import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import SegmentedControl, { type SegmentOption } from '../SegmentedControl';

jest.mock('../../src/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

const OPTIONS: SegmentOption[] = [
  { value: 'expenses', label: 'Expenses' },
  { value: 'events', label: 'Events' },
  { value: 'documents', label: 'Documents' },
];

const DEFAULT_PROPS = {
  options: OPTIONS,
  value: 'expenses',
  onChange: jest.fn(),
  containerBackground: '#eee',
  thumbBackground: '#fff',
  activeColor: '#000',
  inactiveColor: '#999',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SegmentedControl', () => {
  it('renders all option labels', () => {
    render(<SegmentedControl {...DEFAULT_PROPS} />);
    expect(screen.getByText('Expenses')).toBeTruthy();
    expect(screen.getByText('Events')).toBeTruthy();
    expect(screen.getByText('Documents')).toBeTruthy();
  });

  it('does not call onChange before any interaction', () => {
    render(<SegmentedControl {...DEFAULT_PROPS} />);
    expect(DEFAULT_PROPS.onChange).not.toHaveBeenCalled();
  });

  it('calls onChange with the value of the pressed segment', () => {
    render(<SegmentedControl {...DEFAULT_PROPS} />);
    fireEvent.press(screen.getByText('Events'));
    expect(DEFAULT_PROPS.onChange).toHaveBeenCalledWith('events');
  });

  it('calls onChange with the correct value for a different segment', () => {
    render(<SegmentedControl {...DEFAULT_PROPS} />);
    fireEvent.press(screen.getByText('Documents'));
    expect(DEFAULT_PROPS.onChange).toHaveBeenCalledWith('documents');
  });

  it('calls onChange even when pressing the already-selected segment', () => {
    render(<SegmentedControl {...DEFAULT_PROPS} value="events" />);
    fireEvent.press(screen.getByText('Events'));
    expect(DEFAULT_PROPS.onChange).toHaveBeenCalledWith('events');
  });

  it('calls onChange exactly once per press', () => {
    render(<SegmentedControl {...DEFAULT_PROPS} />);
    fireEvent.press(screen.getByText('Expenses'));
    expect(DEFAULT_PROPS.onChange).toHaveBeenCalledTimes(1);
  });
});
