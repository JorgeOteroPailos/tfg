import { type ViewProps, View, StyleSheet} from "react-native";
import { Colors } from "../constants/Colors";
import { useAppTheme } from "../src/theme";


const ThemedCard = ({style, ...props}: ViewProps) => {
    const { themeName } = useAppTheme();
    const theme = Colors[themeName] ?? Colors.light;

    return (
        <View
            style={[{ backgroundColor: theme.uiBackground},
                styles.card,
                style]}
            {...props}
        />
    )
}

export default ThemedCard

const styles = StyleSheet.create({
    card: {
        borderRadius: 5,
        padding: 20
    }
})