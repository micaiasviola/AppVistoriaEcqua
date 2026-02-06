import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Telas existentes
import HomeScreen from './src/screens/HomeScreen';
import InspectionScreen from './src/screens/InspectionScreen';
import UnitListScreen from './src/screens/UnitListScreen';

// Novas Telas
import InspectionTypeScreen from './src/screens/InspectionTypeScreen';
import NewProjectScreen from './src/screens/NewProjectScreen';
import NewUnitScreen from './src/screens/NewUnitScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerStyle: { backgroundColor: '#f2f2f7' },
            headerTintColor: '#333',
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        >
          {/* MUDANÇA AQUI: headerShown: false */}
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ headerShown: false }}
          />

          {/* Mantenha as outras telas como estão por enquanto, 
              ou coloque headerShown: false se quiser a navbar nelas também */}
          <Stack.Screen name="NewProject" component={NewProjectScreen} options={{ title: 'Novo Empreendimento' }} />
          <Stack.Screen name="Units" component={UnitListScreen} options={{ title: 'Unidades' }} />
          <Stack.Screen name="NewUnit" component={NewUnitScreen} options={{ title: 'Nova Unidade' }} />
          <Stack.Screen name="InspectionType" component={InspectionTypeScreen} options={{ title: 'Tipo de Vistoria' }} />
          <Stack.Screen name="Inspection" component={InspectionScreen} options={{ title: 'Vistoria', headerShown: false }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}