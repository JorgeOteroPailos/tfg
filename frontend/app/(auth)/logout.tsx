import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet } from "react-native";
import ThemedView from "../../components/ThemedView";
import { useAuth } from "../../src/auth";

const Logout = () => {
  const { logout } = useAuth();
  const [done, setDone] = useState(false);

  useEffect(() => {
    let mounted = true;

    const runLogout = async () => {
      await logout();
      if (mounted) {
        setDone(true);
      }
    };

    runLogout();

    return () => {
      mounted = false;
    };
  }, [logout]);

  if (done) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <ThemedView style={styles.container}>
      <ActivityIndicator />
    </ThemedView>
  );
};

export default Logout;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});