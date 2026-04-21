import { type ViewProps, View, useColorScheme , StyleSheet} from "react-native";
import { Colors } from "../constants/Colors";


const ThemedCard = ({style, ...props}: ViewProps) => {
    const colorScheme= useColorScheme() ?? "light"
    const theme= Colors[colorScheme] ?? Colors.light

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