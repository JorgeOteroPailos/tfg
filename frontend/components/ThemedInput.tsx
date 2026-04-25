import { TextInput, type TextInputProps, useColorScheme, StyleSheet } from "react-native"
import { Colors } from "../constants/Colors"
import { useAppTheme } from "../src/theme";

type ThemedInputProps = TextInputProps & {}

const ThemedInput = ({ style, ...props }: ThemedInputProps) => {

    const { themeName } = useAppTheme();
    const theme = Colors[themeName] ?? Colors.light;
    

    return (
        <TextInput
            style={[
                styles.input,
                {
                    color: theme.text,
                    backgroundColor: theme.uiBackground,
                    borderColor: theme.iconColor
                },
                style
            ]}
            placeholderTextColor={theme.iconColor}
            {...props}
        />
    )
}

export default ThemedInput

const styles = StyleSheet.create({
    input: {
        width: '100%',
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        fontSize: 16
    }
})