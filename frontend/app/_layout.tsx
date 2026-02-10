import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { STEAMPUNK_COLORS as C } from '../styles/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: C.bgPanel,
          },
          headerTintColor: C.brass,
          headerTitleStyle: {
            fontWeight: 'bold',
            letterSpacing: 1,
          },
          contentStyle: {
            backgroundColor: C.bgDark,
          },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'WRITESLEUTH',
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="results"
          options={{
            title: 'Analysis Results',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="history"
          options={{
            title: 'Case Files',
          }}
        />
        <Stack.Screen
          name="help"
          options={{
            title: 'Apparatus Guide',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="crop"
          options={{
            title: 'Specimen Extraction',
            presentation: 'fullScreenModal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="overlay"
          options={{
            title: 'Overlay Analysis',
            presentation: 'fullScreenModal',
            headerShown: false,
          }}
        />
      </Stack>
    </>
  );
}
