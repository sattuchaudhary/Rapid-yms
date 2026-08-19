import { Stack } from 'expo-router';
import { smoothSlideFromRightOptions } from './navigation/stackAnimation';

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        ...smoothSlideFromRightOptions,
        animation: 'slide_from_right',
        animationDuration: 280,
      }}
    >
      <Stack.Screen
        name="dashboard/index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="vehicles/index"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}
      />
      <Stack.Screen
        name="vehicles/details/[id]"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}
      />
      <Stack.Screen
        name="vehicles/details/kachha-to-pakka"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}
      />
      <Stack.Screen
        name="vehicles/details/edit"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}
      />
    </Stack>
  );
}
