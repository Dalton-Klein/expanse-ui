import React from "react";
import { useNavigate } from "react-router-dom";

export default function HomePage() {
  const navigate = useNavigate();

  const buttonPressPlayGame = () => {
    navigate("/game");
  };
  return (
    <div>
      <div>testing!!!</div>
      <button onClick={() => buttonPressPlayGame()}>
        play game
      </button>
    </div>
  );
}
