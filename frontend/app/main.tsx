import { StyleSheet} from "react-native";
import { Link} from "expo-router";
import ThemedView from "../components/ThemedView";
import ThemedText from "../components/ThemedText";
import { useTranslation } from "react-i18next";



const Main = () => {

    const { t } = useTranslation();

    return (
        <ThemedView style={styles.container} >
            <ThemedText title={true} >{t('home')}</ThemedText>
            <ThemedText>{t('hellooooo')}</ThemedText>

            <Link href="/calendar"><ThemedText>{t('calendar')}</ThemedText></Link>
            <Link href="/login"><ThemedText>{t('login')}</ThemedText></Link>
            <Link href="/register"><ThemedText>{t('register')}</ThemedText></Link>
            <Link href="/profile"><ThemedText>{t('profile')}</ThemedText></Link>
            <Link href="/logout"><ThemedText>{t('logout')}</ThemedText></Link>
            <Link href="/settings"><ThemedText>{t('settings')}</ThemedText></Link>

        </ThemedView>
    )

}

export default Main

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },
})