import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';
import ThemedView from '../components/ThemedView';
import ThemedText from '../components/ThemedText';
import { useTranslation } from 'react-i18next';

const Calendar = () => {

    const { t } = useTranslation();

    return (
        <ThemedView style={styles.container} >
            <ThemedText> {t('calendarPlaceholder')} </ThemedText>
            <Link href="/"><ThemedText> {t('goToMainScreen')} </ThemedText></Link>
        </ThemedView>
    )
}

export default Calendar

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },
})