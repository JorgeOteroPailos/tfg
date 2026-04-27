import { Pressable, PressableProps, StyleSheet } from "react-native"
import { Colors } from "../constants/Colors"
import { useAppTheme } from "../src/theme";

const ThemedButton = ({style, ...props}: PressableProps) => {
  
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;

  return (
    <Pressable
      style={(state) => {
        const baseStyle = [
          styles.button,
          state.pressed && styles.pressed,
        ]

        if (typeof style === "function") {
          return [...baseStyle, style(state)]
        }

        return [...baseStyle, style]
      }}
      {...props}
    />
  )
}

export default ThemedButton

const styles = StyleSheet.create({
    button: {
        backgroundColor: Colors.primary,
        padding: 18,
        borderRadius: 6,
        marginVertical: 10
    },
    pressed: {
        opacity: 0.5
    }
})