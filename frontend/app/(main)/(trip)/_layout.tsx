import { Stack } from "expo-router";
import { TouchableOpacity } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { TripProvider } from "../../../src/trips";
import { useAppTheme } from "../../../src/theme";
import { Colors } from "../../../constants/Colors";
import { useSidebar } from "../../../src/sidebar";
import { useTranslation } from "react-i18next";
import ThemedText from "../../../components/ThemedText";

export default function TripLayout() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { setOpen } = useSidebar();
  const { t } = useTranslation();

  return (
    <TripProvider tripId={tripId}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.navBackground },
          headerTintColor: theme.title,
          contentStyle: { backgroundColor: theme.background },
          animation: 'slide_from_right',
          headerRight: () => (
            <TouchableOpacity onPress={() => setOpen(true)} style={{ paddingHorizontal: 8 }}>
              <ThemedText style={{ fontSize: 22 }}>☰</ThemedText>
            </TouchableOpacity>
          ),
        }}
      >
        <Stack.Screen name="trip" options={{ headerTitle: '' }} />
        <Stack.Screen name="members" options={{ title: t('trip.members') }} />
      </Stack>
    </TripProvider>
  );
}