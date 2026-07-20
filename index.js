// Polyfill for crypto.getRandomValues, required by react-native-quick-crypto and
// any WebCrypto-style consumer. Must be imported before anything that uses it.
import 'react-native-get-random-values';
import 'react-native-gesture-handler';

import { registerRootComponent } from 'expo';

// Side-effect import: defines the background backup task at global scope, which
// expo-task-manager requires so the headless task can run.
import './src/backup/backgroundTask';
import App from './App';

registerRootComponent(App);
