import { ThemeProvider } from '@/shared/components/ThemeProvider';
import { AppRouter } from '@/lib/router/AppRouter';

function App() {
  return (
    <ThemeProvider>
      <AppRouter />
    </ThemeProvider>
  );
}

export default App;