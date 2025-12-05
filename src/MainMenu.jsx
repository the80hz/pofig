import React, { useState } from 'react'

const MainMenu = ({ onStartGame }) => {
  const [teamBots, setTeamBots] = useState(4)
  const [enemyBots, setEnemyBots] = useState(4)

  const menuStyle = {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    background: 'linear-gradient(180deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
    color: '#fff',
    position: 'relative',
    overflow: 'hidden'
  }

  const titleStyle = {
    fontSize: '84px',
    fontWeight: 'bold',
    marginBottom: '10px',
    textShadow: '0 0 30px #ff6b35, 0 0 60px #ff6b35',
    letterSpacing: '6px',
    fontFamily: 'Arial Black, sans-serif',
    background: 'linear-gradient(45deg, #ff6b35, #f7931e)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    animation: 'pulse 2s ease-in-out infinite'
  }

  const subtitleStyle = {
    fontSize: '20px',
    marginBottom: '50px',
    color: '#aaa',
    letterSpacing: '3px',
    textTransform: 'uppercase'
  }

  const settingsStyle = {
    background: 'rgba(0,0,0,0.7)',
    padding: '30px',
    borderRadius: '15px',
    border: '2px solid #333',
    marginBottom: '40px',
    minWidth: '400px'
  }

  const sliderContainerStyle = {
    marginBottom: '20px'
  }

  const labelStyle = {
    display: 'block',
    marginBottom: '10px',
    fontSize: '16px',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: '1px'
  }

  const buttonContainerStyle = {
    display: 'flex',
    gap: '30px',
    zIndex: 10
  }

  const buttonStyle = (color) => ({
    padding: '25px 60px',
    fontSize: '26px',
    fontWeight: 'bold',
    border: `3px solid ${color}`,
    background: `linear-gradient(135deg, rgba(0,0,0,0.8), rgba(0,0,0,0.6))`,
    color: color,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    textTransform: 'uppercase',
    letterSpacing: '3px',
    borderRadius: '10px',
    position: 'relative',
    overflow: 'hidden',
    boxShadow: `0 0 20px ${color}40`
  })

  return (
    <div style={menuStyle}>
      <div style={titleStyle}>COUNTER-STRIKE</div>
      <div style={subtitleStyle}>Ultimate WebGL Experience</div>

      <div style={settingsStyle}>
        <h3 style={{ textAlign: 'center', marginBottom: '25px', color: '#ff6b35', fontSize: '22px' }}>
          GAME SETTINGS
        </h3>
        
        <div style={sliderContainerStyle}>
          <label style={labelStyle}>
            Your Team Bots: <span style={{ color: '#4a90e2' }}>{teamBots}</span>
          </label>
          <input
            type="range"
            min="0"
            max="9"
            value={teamBots}
            onChange={(e) => setTeamBots(parseInt(e.target.value))}
            style={{ width: '100%', cursor: 'pointer' }}
          />
        </div>

        <div style={sliderContainerStyle}>
          <label style={labelStyle}>
            Enemy Bots: <span style={{ color: '#e74c3c' }}>{enemyBots}</span>
          </label>
          <input
            type="range"
            min="1"
            max="9"
            value={enemyBots}
            onChange={(e) => setEnemyBots(parseInt(e.target.value))}
            style={{ width: '100%', cursor: 'pointer' }}
          />
        </div>

        <div style={{ 
          textAlign: 'center', 
          marginTop: '20px', 
          color: '#888',
          fontSize: '14px' 
        }}>
          Total players: {teamBots + enemyBots + 1}
        </div>
      </div>

      <div style={buttonContainerStyle}>
        <button
          style={buttonStyle('#4a90e2')}
          onMouseEnter={(e) => e.target.style.transform = 'scale(1.08)'}
          onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          onClick={() => onStartGame('CT', teamBots, enemyBots)}
        >
          ⚡ Counter-Terrorists
        </button>
        <button
          style={buttonStyle('#e74c3c')}
          onMouseEnter={(e) => e.target.style.transform = 'scale(1.08)'}
          onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          onClick={() => onStartGame('T', teamBots, enemyBots)}
        >
          💀 Terrorists
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          height: 8px;
          border-radius: 5px;
          background: #333;
          outline: none;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #ff6b35;
          cursor: pointer;
          box-shadow: 0 0 10px #ff6b35;
        }
        input[type="range"]::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #ff6b35;
          cursor: pointer;
          box-shadow: 0 0 10px #ff6b35;
          border: none;
        }
      `}</style>
    </div>
  )
}

export default MainMenu