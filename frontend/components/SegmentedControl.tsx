import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useReducedMotion } from '../src/useReducedMotion';

export type SegmentOption = {
  value: string;
  label: string;
  iconName?: React.ComponentProps<typeof Ionicons>['name'];
};

type Props = {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  containerBackground: string;
  thumbBackground: string;
  activeColor: string;
  inactiveColor: string;
  glowColor?: string;
};

const PADDING = 4;

const SegmentedControl = ({
  options,
  value,
  onChange,
  containerBackground,
  thumbBackground,
  activeColor,
  inactiveColor,
  glowColor,
}: Props) => {
  const [containerWidth, setContainerWidth] = useState(0);
  const thumbWidth = containerWidth > 0 ? (containerWidth - PADDING * 2) / options.length : 0;
  const selectedIndex = Math.max(0, options.findIndex(o => o.value === value));

  const translateXRef = useRef<Animated.Value | null>(null);
  if (translateXRef.current === null) translateXRef.current = new Animated.Value(0);
  const translateX = translateXRef.current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (thumbWidth === 0) return;
    if (reduced) {
      translateX.setValue(selectedIndex * thumbWidth);
      return;
    }
    Animated.spring(translateX, {
      toValue: selectedIndex * thumbWidth,
      useNativeDriver: true,
      tension: 300,
      friction: 30,
    }).start();
  }, [selectedIndex, thumbWidth, translateX, reduced]);

  const handleLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  return (
    <View
      style={[styles.container, { backgroundColor: containerBackground }]}
      onLayout={handleLayout}
    >
      {thumbWidth > 0 && (
        <Animated.View
          style={[
            styles.thumb,
            {
              width: thumbWidth,
              backgroundColor: thumbBackground,
              transform: [{ translateX }],
              ...(glowColor ? { boxShadow: `0 0 16px ${glowColor}` } : {}),
            },
          ]}
        />
      )}

      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            style={styles.segment}
            onPress={() => onChange(opt.value)}
          >
            {opt.iconName && (
              <Ionicons
                name={opt.iconName}
                size={14}
                color={active ? activeColor : inactiveColor}
                style={{ opacity: active ? 1 : 0.55 }}
              />
            )}
            <Text
              style={[
                styles.label,
                { color: active ? activeColor : inactiveColor },
                active && styles.labelActive,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

export default SegmentedControl;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: PADDING,
    overflow: 'hidden',
  },
  thumb: {
    position: 'absolute',
    top: PADDING,
    left: PADDING,
    bottom: PADDING,
    borderRadius: 10,
  },
  segment: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    zIndex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    opacity: 0.55,
  },
  labelActive: {
    opacity: 1,
  },
});
