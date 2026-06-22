import { TextInput, type TextInputProps, StyleSheet } from "react-native"
import { Colors } from "../constants/Colors"
import { useAppTheme } from "../src/theme";

type ThemedInputProps = TextInputProps & {}

const ThemedInput = ({ style, ...props }: ThemedInputProps) => {

    const { themeName } = useAppTheme();
    const theme = Colors[themeName] ?? Colors.light;

    return (
        <TextInput
            maxFontSizeMultiplier={1.6}
            style={[
                styles.input,
                {
                    color: theme.title,
                    backgroundColor: theme.uiBackground,
                    borderColor: theme.border,
                },
                style
            ]}
            placeholderTextColor={theme.icon}
            {...props}
        />
    )
}

export default ThemedInput

const styles = StyleSheet.create({
    input: {
        width: '100%',
        borderWidth: 1,
        borderRadius: 13,
        padding: 14,
        fontSize: 15,
        fontWeight: '600',
    }
})
