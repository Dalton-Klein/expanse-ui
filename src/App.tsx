import "./App.scss";
import React, { useEffect, useRef } from "react";
import "./App.css";
import {
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import * as io from "socket.io-client";
import { Provider } from "react-redux";
import store, { persistor } from "./store/store";
import { PersistGate } from "redux-persist/integration/react";
import HomePage from "./components/pages/home-page/homePage";
import GamePage from "./components/pages/game/gamePage";

function App() {
  const socketRef = useRef<any>();

  useEffect(() => {
    //Master connect to socket so each client only connects to server once
    connectToSocketMaster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectToSocketMaster = async () => {
    // ***PROD FIX SOCKET
    socketRef.current = io.connect(
      "http://localhost:3000" //: "https://www.gangs.gg" or "http://localhost:3000"
    );
  };

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <div className="App">
          {/* This scroll component scrolls user to top of each page when navigating */}

          <div className="app-container">
            <div className="app-content-scrollbox">
              <Routes>
                {/* Main Paths */}
                <Route path="/" element={<HomePage />} />
                <Route
                  path="/game"
                  element={<GamePage />}
                />
              </Routes>
            </div>
          </div>
        </div>
      </PersistGate>
    </Provider>
  );
}

export default App;
