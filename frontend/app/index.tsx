import { StyleSheet} from "react-native";
import { Link } from "expo-router";
import ThemedView from "../components/ThemedView";
import ThemedText from "../components/ThemedText";
import { useTranslation } from 'react-i18next';


const Home = () => {

    const { t } = useTranslation();

    return (
        <ThemedView style={styles.container} >
            <ThemedText title={true} >{t('home')}</ThemedText>
            <ThemedText>{t('hellooooo')}</ThemedText>

            <Link href="/calendar"><ThemedText>{t('calendar')}</ThemedText></Link>
            <Link href="/login"><ThemedText>{t('login')}</ThemedText></Link>
            <Link href="/register"><ThemedText>{t('register')}</ThemedText></Link>
        </ThemedView>
    )

}

export default Home

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },
})