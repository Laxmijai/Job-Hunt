import { combineReducers, configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import jobReducer from "./jobSlice";
import companyReducer from "./companyslice";

import {
  persistStore,
  persistReducer,
  createTransform,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import storage from "redux-persist/lib/storage";
import applicationSlice from "./applicationSlice";
// Transient request flags must never survive a browser refresh. Older persisted
// sessions may contain loading: true, which leaves auth buttons disabled forever.
const resetTransientAuthState = createTransform(
  (inboundState) => ({ ...inboundState, loading: false }),
  (outboundState) => ({ ...outboundState, loading: false }),
  { whitelist: ["auth"] }
);

const persistConfig = {
  key: "root",
  version: 2,
  storage,
  transforms: [resetTransientAuthState],
};

const rootReducer = combineReducers({
  auth: authReducer,
  job: jobReducer,
  jobs: jobReducer,
  company: companyReducer,
  application: applicationSlice,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export default store;
