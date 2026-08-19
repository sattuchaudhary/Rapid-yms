import { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { Platform } from 'react-native';

/**
 * High-performance smooth right-side slide screen transition configuration
 * Gives a buttery-smooth drawer-like slide-in effect when opening detail screens.
 */
export const smoothSlideFromRightOptions: NativeStackNavigationOptions = {
  headerShown: false,
  animation: 'slide_from_right',
  animationDuration: Platform.OS === 'ios' ? 320 : 280,
  gestureEnabled: true,
  gestureDirection: 'horizontal',
  fullScreenGestureEnabled: true,
  presentation: 'card',
  contentStyle: {
    backgroundColor: '#F8FAFC',
  },
};

/**
 * Default Stack Screen options with smooth transitions
 */
export const defaultStackScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  animation: 'slide_from_right',
  animationDuration: 260,
  gestureEnabled: true,
  contentStyle: {
    backgroundColor: '#F8FAFC',
  },
};
