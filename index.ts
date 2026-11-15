import 'react-native-url-polyfill/auto';
import { registerRootComponent } from 'expo';

// A tarefa de localização em segundo plano precisa ser definida antes de tudo
import './src/lib/tracking';
import App from './src/App';

registerRootComponent(App);
