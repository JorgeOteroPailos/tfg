import { View, StyleSheet } from 'react-native';

/** Subtle dot-grid overlay — use as first child with pointerEvents="none" */
export const DotGrid = ({ color = 'rgba(168,85,247,0.07)', spacing = 28, dotSize = 1.5 }: {
  color?: string; spacing?: number; dotSize?: number;
}) => {
  const COLS = 14;
  const ROWS = 28;
  const dots = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      dots.push(
        <View
          key={`${r}-${c}`}
          style={{
            position: 'absolute',
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: color,
            top: r * spacing,
            left: c * spacing,
          }}
        />
      );
    }
  }
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {dots}
    </View>
  );
};

/** Soft color blobs — subtle ambient glow / "nebula" background texture */
export const AmbientBlobs = ({ tint, secondary }: { tint: string; secondary?: string }) => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <View style={[styles.blob1, { backgroundColor: tint }]} />
    <View style={[styles.blob2, { backgroundColor: secondary ?? tint }]} />
    <View style={[styles.blob3, { backgroundColor: tint }]} />
  </View>
);

const styles = StyleSheet.create({
  blob1: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    top: -80,
    left: -100,
    opacity: 0.07,
  },
  blob2: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    bottom: 60,
    right: -80,
    opacity: 0.06,
  },
  blob3: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    top: '45%',
    left: '30%',
    opacity: 0.04,
  },
});
