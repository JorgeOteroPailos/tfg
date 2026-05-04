import { type TextProps, Text } from "react-native"
import { Colors } from "../constants/Colors"
import { useAppTheme } from "../src/theme"

type ThemedTextProps = TextProps & {
  title?: boolean
}


const ThemedText = ({ style, title=false, ...props}: ThemedTextProps) => {
    const { themeName } = useAppTheme();
    const theme = Colors[themeName] ?? Colors.light;


    const textColor = title ? theme.title : theme.text

    return (
        <Text
            style={[{ color: textColor, fontWeight: title ? "700" : "600"},
                style]}
            {...props}
        />
    )
}

export default ThemedText