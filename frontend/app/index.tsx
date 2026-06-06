import { Redirect } from 'expo-router';
import { useAuth } from '../src/auth';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();

  console.log('Index -> isLoading:', isLoading, 'isAuthenticated:', isAuthenticated);

  if (isLoading) {
    return <View style={{ flex: 1 }} />;
  }

  return <Redirect href={isAuthenticated ? '/main' : '/login'} />;
}