import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { Toaster } from "./components/ui/sonner";
import { Provider } from "react-redux";
import { persistStore } from "redux-persist";

import store from "./redux/store";
import { PersistGate } from "redux-persist/integration/react";

const persistor = persistStore(store);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ThemeProvider>
          <App />
        </ThemeProvider>
        <Toaster />
      </PersistGate>
    </Provider>
  </StrictMode>
);
