import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#0f172a',
          },
          headerTintColor: '#f8fafc',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          contentStyle: {
            backgroundColor: '#0f172a',
          },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'Handwriting Forensic',
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
            title: 'Comparison History',
          }}
        />
        <Stack.Screen
          name="help"
          options={{
            title: 'About & Help',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="crop"
          options={{
            title: 'Crop Selection',
            presentation: 'fullScreenModal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="overlay"
          options={{
            title: 'Overlay Adjustment',
            presentation: 'fullScreenModal',
            headerShown: false,
          }}
        />
      </Stack>
    </>
  );
}
