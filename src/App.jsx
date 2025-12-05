import { useState } from 'react'
import MainMenu from './MainMenu'
import Game from './Game'

export default function App() {
  const [gameStarted, setGameStarted] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState('CT')
  const [teamBots, setTeamBots] = useState(4)
  const [enemyBots, setEnemyBots] = useState(4)

  const startGame = (team, tBots, eBots) => {
    setSelectedTeam(team)
    setTeamBots(tBots)
    setEnemyBots(eBots)
    setGameStarted(true)
  }

  const exitGame = () => {
    setGameStarted(false)
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', margin: 0, padding: 0 }}>
      {!gameStarted ? (
        <MainMenu onStartGame={startGame} />
      ) : (
        <Game team={selectedTeam} onExit={exitGame} teamBots={teamBots} enemyBots={enemyBots} />
      )}
    </div>
  )
}