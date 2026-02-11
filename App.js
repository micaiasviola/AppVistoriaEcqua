import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
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
import RelatoriosScreen from './src/screens/RelatoriosScreen';
import VistoriaDetailScreen from './src/screens/VistoriaDetailScreen';
import VistoriaListScreen from './src/screens/VistoriaListScreen';
import VistoriasHomeScreen from './src/screens/VistoriasHomeScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function UnidadesStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#f2f2f7' },
        headerTintColor: '#333',
        headerTitleStyle: { fontWeight: 'bold' },
        headerBackTitleVisible: false
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="NewProject" component={NewProjectScreen} options={{ title: 'Novo Empreendimento' }} />
      <Stack.Screen name="Units" component={UnitListScreen} options={{ title: 'Unidades' }} />
      <Stack.Screen name="NewUnit" component={NewUnitScreen} options={{ title: 'Nova Unidade' }} />
      <Stack.Screen name="InspectionType" component={InspectionTypeScreen} options={{ title: 'Tipo de Vistoria' }} />
      <Stack.Screen name="VistoriaList" component={VistoriaListScreen} options={({ route }) => {
        const tipo = route?.params?.tipoVistoria;
        let title = 'Vistorias';
        if (tipo === 'construtora') title = 'Vistoria Construtora';
        else if (tipo === 'entrada') title = 'Vistoria de Entrada';
        else if (tipo === 'revistoria') title = 'Revistoria';
        else if (tipo === 'entrega') title = 'Vistoria de Entrega';
        return { title };
      }} />
      <Stack.Screen name="VistoriaDetail" component={VistoriaDetailScreen} options={{ title: 'Vistoria' }} />
      <Stack.Screen name="Inspection" component={InspectionScreen} options={{ title: 'Vistoria', headerShown: false }} />
    </Stack.Navigator>
  );
}

function VistoriasStack() {
  return (
      <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#f2f2f7' },
        headerTintColor: '#333',
        headerTitleStyle: { fontWeight: 'bold' }
      }}
    >
      <Stack.Screen name="VistoriasHome" component={VistoriasHomeScreen} options={{ title: 'Revistorias' }} />
      <Stack.Screen name="VistoriaList" component={VistoriaListScreen} options={({ route }) => {
        const tipo = route?.params?.tipoVistoria;
        let title = 'Vistorias';
        if (tipo === 'construtora') title = 'Vistoria Construtora';
        else if (tipo === 'entrada') title = 'Vistoria de Entrada';
        else if (tipo === 'revistoria') title = 'Revistoria';
        else if (tipo === 'entrega') title = 'Vistoria de Entrega';
        return { title };
      }} />
      <Stack.Screen name="VistoriaDetail" component={VistoriaDetailScreen} options={{ title: 'Vistoria' }} />
      <Stack.Screen name="Inspection" component={InspectionScreen} options={{ title: 'Vistoria', headerShown: false }} />
    </Stack.Navigator>
  );
}

function RelatoriosStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#f2f2f7' },
        headerTintColor: '#333',
        headerTitleStyle: { fontWeight: 'bold' },
        headerBackTitleVisible: false
      }}
    >
      <Stack.Screen name="Relatorios" component={RelatoriosScreen} options={{ title: 'Relatorios' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: '#007AFF',
            tabBarInactiveTintColor: '#666',
            tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#eee' },
            tabBarIcon: ({ color, size }) => {
              const nameMap = {
                UnidadesTab: 'home-outline',
                VistoriasTab: 'clipboard-outline',
                RelatoriosTab: 'document-text-outline'
              };
              const iconName = nameMap[route.name] || 'ellipse-outline';
              return <Ionicons name={iconName} size={size} color={color} />;
            }
          })}
        >
          <Tab.Screen
            name="UnidadesTab"
            component={UnidadesStack}
            options={{ title: 'Unidades' }}
            listeners={({ navigation, route }) => ({
              tabPress: (e) => {
                // Always navigate to the Home screen of the Unidades stack
                e.preventDefault();
                navigation.navigate('UnidadesTab', { screen: 'Home' });
              }
            })}
          />
          <Tab.Screen
            name="VistoriasTab"
            component={VistoriasStack}
            options={{ title: 'Revistorias' }}
            listeners={({ navigation, route }) => ({
              tabPress: (e) => {
                e.preventDefault();
                navigation.navigate('VistoriasTab', { screen: 'VistoriasHome' });
              }
            })}
          />
          <Tab.Screen
            name="RelatoriosTab"
            component={RelatoriosStack}
            options={{ title: 'Relatorios' }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}