import {
  configureStore,
  Action,
  combineReducers,
  Middleware,
} from "@reduxjs/toolkit";
import { createEpicMiddleware } from "redux-observable";
import UserSlice from "./userSlice";
import { ThunkAction } from "redux-thunk";
import { thunk } from "redux-thunk";
import {
  persistStore,
  persistReducer,
} from "redux-persist";
import storage from "redux-persist/lib/storage"; // defaults to localStorage for web

const rootReducer = combineReducers({
  user: UserSlice,
});

const persistConfig = {
  key: "root",
  storage,
};

const persistedReducer = persistReducer(
  persistConfig,
  rootReducer
);
const epicMiddleware = createEpicMiddleware();

const store: any = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(
      epicMiddleware as Middleware<
        (action: Action<"specialAction">) => number,
        RootState
      >,
      thunk as unknown as Middleware<
        (action: Action<"specialAction">) => number,
        RootState
      >
    ), //[epicMiddleware, thunk],
  devTools: false, //process.env.NODE_ENV !== 'production',
});

let persistor = persistStore(store);

export default store;
export { persistor };
export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export type AppThunk = ThunkAction<
  void,
  RootState,
  null,
  Action<string>
>;
