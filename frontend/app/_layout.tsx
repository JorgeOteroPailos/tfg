import {useColorScheme} from 'react-native'
import {Stack} from 'expo-router'
import { Colors } from '../constants/Colors'
import '../i18n'
import { useTranslation } from 'react-i18next';
import { AuthProvider } from '../src/auth';

const RootLayout = () => {
    
    const colorScheme = useColorScheme() ?? "light";
    const theme = Colors[colorScheme];
    const { t } = useTranslation();

    return (

        <AuthProvider>
            <Stack screenOptions={{headerStyle: {backgroundColor: theme.navBackground},
            headerTintColor: theme.title}}>
                <Stack.Screen name="index" options={{title: t('home')}} />
                <Stack.Screen name="calendar" options={{title: t('calendar')}} />
                <Stack.Screen name="(auth)/login" options={{title: t('login')}} />
                <Stack.Screen name="(auth)/register" options={{title: t('register')}} />
            </Stack>
        </AuthProvider>

    )
}

export default RootLayout