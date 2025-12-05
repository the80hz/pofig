import { useState } from 'react'
import MainMenu from './MainMenu'
import Game from './Game'

export default function App() {
  const [gameStarted, setGameStarted] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState('CT')

  const startGame = (team) => {
    setSelectedTeam(team)
    setGameStarted(true)
  }

  const exitGame = () => {
    setGameStarted(false)
  }

  return (
    <>
      {!gameStarted ? (
        <MainMenu onStartGame={startGame} />
      ) : (
        <Game team={selectedTeam} onExit={exitGame} />
      )}
    </>
  )
}
