import React from 'react'
import { View, useColorScheme, type ViewProps } from 'react-native'
import { Colors } from '../constants/Colors'
import { useAppTheme } from '../src/theme';

const ThemedView = ({ style, ...props }: ViewProps) =>  {
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  

  return (
    <View
      style={[{ backgroundColor: theme.background }, style]}
      {...props}
    />
  )
}

export default ThemedView

