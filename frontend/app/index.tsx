import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet } from "react-native";
import ThemedView from "../components/ThemedView";
import { useAuth } from "../src/auth";

const Home = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/main" />;
  }

  return <Redirect href="/(auth)/register" />;
};

export default Home;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});