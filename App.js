// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Importando suas telas
import HomeScreen from './src/screens/HomeScreen';
import UnitListScreen from './src/screens/UnitListScreen';
import InspectionScreen from './src/screens/InspectionScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#f2f2f7',
          },
          headerTintColor: '#333',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'Obras ECQUA' }}
        />
        <Stack.Screen
          name="Units"
          component={UnitListScreen}
          options={{ title: 'Unidades do Empreendimento' }}
        />
        <Stack.Screen
          name="Inspection"
          component={InspectionScreen}
          options={{ title: 'Vistoria da unidade' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}