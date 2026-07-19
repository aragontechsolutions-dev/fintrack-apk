// Polyfill for crypto.getRandomValues, required by react-native-quick-crypto and
// any WebCrypto-style consumer. Must be imported before anything that uses it.
import 'react-native-get-random-values';
import 'react-native-gesture-handler';

import { registerRootComponent } from 'expo';

import App from './App';

registerRootComponent(App);
