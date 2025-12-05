import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const Game = ({ team, onExit, teamBots = 4, enemyBots = 4 }) => {
  const mountRef = useRef(null)
  const [hud, setHud] = useState({
    health: 100,
    armor: 0,
    ammo: 30,
    reserve: 90,
    money: 800,
    roundTime: 105,
    scoreT: 0,
    scoreCT: 0,
    currentWeapon: 'Glock',
    kills: 0,
    deaths: 0
  })
  const [buyMenuOpen, setBuyMenuOpen] = useState(false)
  const [roundMessage, setRoundMessage] = useState('')
  const [isAlive, setIsAlive] = useState(true)
  const [hitmarker, setHitmarker] = useState(false)
  const [showScoreboard, setShowScoreboard] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const [botStats, setBotStats] = useState([])
  const [radarBots, setRadarBots] = useState([])

  useEffect(() => {
    let scene, camera, renderer, world
    let playerBody, playerModel
    let weapons = {}
    let currentWeapon = null
    let bots = []
    let particleSystems = []
    let muzzleFlash = null
    let bombPlanted = false
    let bombTimer = 45
    let bombObject = null
    let defusing = false
    let defuseProgress = 0
    let roundActive = true
    let roundTimeLeft = 105
    let buyZone = true
    let keys = {}
    let pitch = 0
    let yaw = 0
    let playerMoney = 800
    let consecutiveLosses = 0
    let scoreT = 0
    let scoreCT = 0
    let playerTeam = team
    let playerHealth = 100
    let playerArmor = 0
    let playerKills = 0
    let playerDeaths = 0
    let alive = true
    let recoil = 0
    let isReloading = false
    const ARENA_SIZE = 80
    const loader = new GLTFLoader()
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const playSound = (frequency, duration, type = 'sine', volume = 0.1) => {
      const oscillator = audioCtx.createOscillator()
      const gainNode = audioCtx.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(audioCtx.destination)
      oscillator.frequency.value = frequency
      oscillator.type = type
      gainNode.gain.setValueAtTime(volume, audioCtx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration)
      oscillator.start(audioCtx.currentTime)
      oscillator.stop(audioCtx.currentTime + duration)
    }
    const playGunshot = () => {
      playSound(150, 0.08, 'square', 0.15)
      playSound(80, 0.05, 'sawtooth', 0.1)
    }
    const playExplosion = () => {
      playSound(60, 0.4, 'sawtooth', 0.2)
      playSound(120, 0.3, 'square', 0.15)
    }
    const playFootstep = () => playSound(100, 0.04, 'triangle', 0.08)

    const playHitmarker = () => {
      playSound(800, 0.05, 'square', 0.12)
      setHitmarker(true)
      setTimeout(() => setHitmarker(false), 100)
    }
    const playBombPlant = () => {
      for (let i = 0; i < 5; i++) {
        setTimeout(() => playSound(1000 - i * 100, 0.1, 'sine', 0.15), i * 100)
      }
    }
    // THREE.JS SETUP
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x87ceeb)
    scene.fog = new THREE.Fog(0x87ceeb, 0, 200)
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.set(0, 1.7, 0)
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mountRef.current.appendChild(renderer.domElement)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7)
    scene.add(ambientLight)
    const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.2)
    sunLight.position.set(50, 80, 30)
    sunLight.castShadow = true
    sunLight.shadow.mapSize.width = 2048
    sunLight.shadow.mapSize.height = 2048
    sunLight.shadow.camera.near = 0.5
    sunLight.shadow.camera.far = 300
    sunLight.shadow.camera.left = -100
    sunLight.shadow.camera.right = 100
    sunLight.shadow.camera.top = 100
    sunLight.shadow.camera.bottom = -100
    scene.add(sunLight)
    // PHYSICS
    world = new CANNON.World()
    world.gravity.set(0, -20, 0)
    world.broadphase = new CANNON.SAPBroadphase(world)
    world.solver.iterations = 20
    // IMPROVED MAP WITH TEXTURES
    const textureLoader = new THREE.TextureLoader()
    const groundTexture = textureLoader.load('https://threejs.org/examples/textures/terrain/grasslight-big.jpg')
    groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping
    groundTexture.repeat.set(10, 10)
    const createBox = (w, h, d, x, y, z, color = 0x8b7355, texture = null) => {
      const geometry = new THREE.BoxGeometry(w, h, d)
      const material = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1, map: texture })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(x, y, z)
      mesh.castShadow = true
      mesh.receiveShadow = true
      scene.add(mesh)
      const shape = new CANNON.Box(new CANNON.Vec3(w/2, h/2, d/2))
      const body = new CANNON.Body({ mass: 0, shape })
      body.position.set(x, y, z)
      world.addBody(body)
      return { mesh, body }
    }
    // Ground
    createBox(160, 1, 160, 0, -0.5, 0, 0xa89968, groundTexture)
    // Walls with texture
    const wallTexture = textureLoader.load('https://threejs.org/examples/textures/brick_diffuse.jpg')
    wallTexture.wrapS = wallTexture.wrapT = THREE.RepeatWrapping
    wallTexture.repeat.set(5, 5)
    const wallHeight = 12
    createBox(160, wallHeight, 2, 0, wallHeight/2, -80, 0x666666, wallTexture)
    createBox(160, wallHeight, 2, 0, wallHeight/2, 80, 0x666666, wallTexture)
    createBox(2, wallHeight, 160, -80, wallHeight/2, 0, 0x666666, wallTexture)
    createBox(2, wallHeight, 160, 80, wallHeight/2, 0, 0x666666, wallTexture)
    // More obstacles
    for (let i = 0; i < 20; i++) {
      let x, z
      do {
        x = (Math.random() - 0.5) * 140
        z = (Math.random() - 0.5) * 140
      } while (Math.sqrt(x * x + z * z) < 20)
      const size = 3 + Math.random() * 4
      const height = 4 + Math.random() * 5
      const colors = [0x8b7355, 0x6b5d4f, 0x9b8365]
      createBox(size, height, size, x, height/2, z, colors[Math.floor(Math.random() * colors.length)], wallTexture)
    }
    // Bomb sites
    const createBombSite = (x, z) => {
      const geometry = new THREE.CircleGeometry(8, 32)
      const material = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide
      })
      const circle = new THREE.Mesh(geometry, material)
      circle.rotation.x = -Math.PI / 2
      circle.position.set(x, 0.01, z)
      scene.add(circle)
      return { x, z, radius: 8 }
    }
    createBombSite(0, 0)
    createBombSite(50, 50)
    // WEAPON STATS
    const weaponStats = {
      Knife: { damage: 50, fireRate: 400, ammo: Infinity, reserve: 0, price: 0, spread: 0, recoil: 0 },
      Glock: { damage: 25, fireRate: 150, ammo: 20, reserve: 120, price: 0, spread: 0.02, recoil: 0.05 },
      USP: { damage: 30, fireRate: 200, ammo: 12, reserve: 100, price: 0, spread: 0.015, recoil: 0.04 },
      'AK-47': { damage: 35, fireRate: 100, ammo: 30, reserve: 90, price: 2700, spread: 0.025, recoil: 0.1 },
      M4A1: { damage: 32, fireRate: 90, ammo: 30, reserve: 90, price: 3100, spread: 0.02, recoil: 0.08 },
      AWP: { damage: 110, fireRate: 1200, ammo: 10, reserve: 30, price: 4750, spread: 0.002, recoil: 0.2 },
      HE: { damage: 100, fireRate: 1000, ammo: 1, reserve: 0, price: 300, spread: 0 },
      Flash: { damage: 0, fireRate: 1000, ammo: 1, reserve: 0, price: 200, spread: 0 },
      Smoke: { damage: 0, fireRate: 1000, ammo: 1, reserve: 0, price: 300, spread: 0 }
    }
    const initWeapon = (name) => {
      const stats = weaponStats[name]
      return { ...stats, name, lastFire: 0, currentAmmo: stats.ammo }
    }
    weapons.knife = initWeapon('Knife')
    weapons.pistol = initWeapon(playerTeam === 'CT' ? 'USP' : 'Glock')
    currentWeapon = weapons.pistol
    // Reload function
    const reload = () => {
      if (isReloading || currentWeapon.reserve <= 0 || currentWeapon.currentAmmo === currentWeapon.ammo) return
      isReloading = true
      playSound(400, 0.15)
      setTimeout(() => {
        const needed = currentWeapon.ammo - currentWeapon.currentAmmo
        const take = Math.min(needed, currentWeapon.reserve)
        currentWeapon.currentAmmo += take
        currentWeapon.reserve -= take
        isReloading = false
      }, 1500)
    }
    // PLAYER PHYSICS
    const playerShape = new CANNON.Cylinder(0.4, 0.4, 1.8, 16)
    playerBody = new CANNON.Body({
      mass: 75,
      shape: playerShape,
      linearDamping: 0.95,
      angularDamping: 0.95,
      fixedRotation: true
    })
    playerBody.position.set(playerTeam === 'CT' ? -60 : 60, 3, 0)
    world.addBody(playerBody)
    // Load player model (download from Sketchfab and place in /assets/ct.glb or t.glb)
    loader.load(playerTeam === 'CT' ? '/assets/ct.glb' : '/assets/t.glb', (gltf) => {
      playerModel = gltf.scene
      playerModel.scale.set(1, 1, 1) // Adjust scale as needed
      playerModel.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true
          child.receiveShadow = true
        }
      })
      scene.add(playerModel)
    }, undefined, (error) => console.error('Player model load error:', error))
    // Weapon model
    const weaponGroup = new THREE.Group()
    loader.load('/assets/gun.glb', (gltf) => {
      const gun = gltf.scene
      gun.scale.set(0.5, 0.5, 0.5)
      gun.position.set(0.4, -0.3, -0.6)
      weaponGroup.add(gun)
    }, undefined, (error) => console.error('Gun model load error:', error))
    camera.add(weaponGroup)
    scene.add(camera)
    muzzleFlash = new THREE.PointLight(0xffaa00, 0, 1)
    muzzleFlash.position.set(0, 0, -0.8)
    weaponGroup.add(muzzleFlash)
    // BOT CLASS WITH GLTF MODELS
    class Bot {
      constructor(teamBot, x, z, id) {
        this.id = id
        this.team = teamBot
        this.alive = true
        this.kills = 0
        this.deaths = 0
        this.health = 100
        this.shape = new CANNON.Cylinder(0.4, 0.4, 1.6, 16)
        this.body = new CANNON.Body({ mass: 70, shape: this.shape, linearDamping: 0.95, fixedRotation: true })
        this.body.position.set(x, 3, z)
        world.addBody(this.body)
        this.model = new THREE.Group()
        loader.load(teamBot === 'CT' ? '/assets/ct.glb' : '/assets/t.glb', (gltf) => {
          const botModel = gltf.scene
          botModel.scale.set(1, 1, 1)
          botModel.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true
              child.receiveShadow = true
            }
          })
          this.model.add(botModel)
        }, undefined, (error) => console.error('Bot model load error:', error))
        scene.add(this.model)
        this.targetPos = new CANNON.Vec3(x, 3, z)
        this.moveSpeed = 8 + Math.random() * 4
        this.weapon = initWeapon(teamBot === 'CT' ? 'M4A1' : 'AK-47')
        this.shootInterval = setInterval(() => this.shootAtPlayer(), 1000 + Math.random() * 2000)
      }
      update(delta, allBots) {
        if (!this.alive) return
        this.model.position.copy(this.body.position)
        this.model.quaternion.copy(camera.quaternion) // Face same direction as player for simplicity, adjust for AI facing
        // AI logic as before
        if (Math.random() < 0.05) {
          this.targetPos.copy(playerBody.position)
        } else if (Math.random() < 0.02) {
          this.targetPos.x = (Math.random() - 0.5) * 140
          this.targetPos.z = (Math.random() - 0.5) * 140
        }
        const dx = this.targetPos.x - this.body.position.x
        const dz = this.targetPos.z - this.body.position.z
        const dist = Math.sqrt(dx * dx + dz * dz)
        if (dist > 2) {
          const nx = dx / dist
          const nz = dz / dist
          this.body.velocity.x = nx * this.moveSpeed
          this.body.velocity.z = nz * this.moveSpeed
        } else {
          this.body.velocity.x *= 0.8
          this.body.velocity.z *= 0.8
        }
      }
      shootAtPlayer() {
        if (!this.alive || Math.random() < 0.5) return
        const direction = playerBody.position.vsub(this.body.position).unit()
        const ray = new CANNON.Ray(this.body.position, direction)
        const result = new CANNON.RaycastResult()
        ray.intersectBody(playerBody, result)
        if (result.distance > 0) {
          playerHealth -= this.weapon.damage
          playHitmarker()
          if (playerHealth <= 0) {
            alive = false
            playerDeaths++
          }
        }
      }
      takeDamage(amount) {
        this.health -= amount
        if (this.health <= 0) {
          this.alive = false
          scene.remove(this.model)
          world.removeBody(this.body)
          clearInterval(this.shootInterval)
          playerKills++
        }
      }
    }
    // Spawn bots
    const spawnBots = () => {
      const tBots = Math.max(1, Math.min(teamBots, 5))
      const eBots = Math.max(1, Math.min(enemyBots, 5))
      for (let i = 0; i < tBots; i++) {
        const x = (team === 'CT' ? -60 : 60) + (Math.random() - 0.5) * 20
        const z = (Math.random() - 0.5) * 20
        bots.push(new Bot(team, x, z, i))
      }
      const enemyTeam = team === 'CT' ? 'T' : 'CT'
      for (let i = 0; i < eBots; i++) {
        const x = (team === 'CT' ? 60 : -60) + (Math.random() - 0.5) * 20
        const z = (Math.random() - 0.5) * 20
        bots.push(new Bot(enemyTeam, x, z, tBots + i))
      }
    }
    spawnBots()
    // Particle system
    const createParticleExplosion = (position, color = 0xff6600, count = 20) => {
      const geometry = new THREE.BufferGeometry()
      const positions = new Float32Array(count * 3)
      const velocities = new Float32Array(count * 3)
      for (let i = 0; i < count; i++) {
        const idx = i * 3
        positions[idx] = position.x
        positions[idx + 1] = position.y
        positions[idx + 2] = position.z
        velocities[idx] = (Math.random() - 0.5) * 10
        velocities[idx + 1] = Math.random() * 10
        velocities[idx + 2] = (Math.random() - 0.5) * 10
      }
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      const material = new THREE.PointsMaterial({ color, size: 0.15, transparent: true, opacity: 1 })
      const particles = new THREE.Points(geometry, material)
      scene.add(particles)
      particleSystems.push({ particles, velocities, life: 1.0, attr: geometry.attributes.position })
    }
    // Shoot with recoil
    const shoot = () => {
      if (!alive || isReloading || !currentWeapon || currentWeapon.currentAmmo <= 0) return
      const now = Date.now()
      if (now - currentWeapon.lastFire < currentWeapon.fireRate) return
      currentWeapon.lastFire = now
      currentWeapon.currentAmmo--
      playGunshot()
      muzzleFlash.intensity = 2
      setTimeout(() => muzzleFlash.intensity = 0, 50)
      recoil = currentWeapon.recoil
      pitch -= recoil * 0.5
      const direction = new THREE.Vector3(0, 0, -1)
      direction.applyQuaternion(camera.quaternion)
      const spread = currentWeapon.spread + recoil
      direction.x += (Math.random() - 0.5) * spread
      direction.y += (Math.random() - 0.5) * spread
      direction.normalize()
      const raycaster = new THREE.Raycaster(camera.position, direction)
      const intersects = raycaster.intersectObjects(scene.children, true)
      if (intersects.length > 0) {
        const hit = intersects[0]
        createParticleExplosion(hit.point, 0xff0000, 15)
        bots.forEach(bot => {
          if (bot.alive && bot.model === hit.object.parent) {
            bot.takeDamage(currentWeapon.damage)
            playHitmarker()
            playerKills++
          }
        })
      }
    }
    // Key handlers
    const onKeyDown = (e) => {
      keys[e.code] = true
      if (e.code === 'KeyR') reload()
      // ... other keys as in original
    }
    const onKeyUp = (e) => keys[e.code] = false
    const onMouseMove = (e) => {
      if (document.pointerLockElement) {
        yaw -= e.movementX * 0.002
        pitch -= e.movementY * 0.002
        pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch))
      }
    }
    renderer.domElement.addEventListener('click', () => renderer.domElement.requestPointerLock())
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mousedown', shoot)
    const clock = new THREE.Clock()
    const animate = () => {
      requestAnimationFrame(animate)
      const delta = clock.getDelta()
      world.step(1 / 60, delta, 5)
      if (alive) {
        const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, yaw, 0))
        const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, yaw, 0))
        const moveSpeed = keys['ShiftLeft'] ? 15 : 10
        let vx = 0, vz = 0
        if (keys['KeyW']) { vx += forward.x * moveSpeed; vz += forward.z * moveSpeed }
        if (keys['KeyS']) { vx -= forward.x * moveSpeed; vz -= forward.z * moveSpeed }
        if (keys['KeyA']) { vx -= right.x * moveSpeed; vz -= right.z * moveSpeed }
        if (keys['KeyD']) { vx += right.x * moveSpeed; vz += right.z * moveSpeed }
        playerBody.velocity.x = vx
        playerBody.velocity.z = vz
        const ray = new CANNON.Ray(playerBody.position, new CANNON.Vec3(0, -1, 0))
        const result = new CANNON.RaycastResult()
        ray.intersectWorld(world, { skipBody: playerBody, result })
        const onGround = result.distance < 1.0
        if (keys['Space'] && onGround) playerBody.velocity.y = 15
        camera.position.copy(playerBody.position)
        camera.position.y += 1.6
        camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0))
        if (playerModel) {
          playerModel.position.copy(playerBody.position)
          playerModel.position.y -= 0.9 // Adjust for model offset
          playerModel.quaternion.copy(camera.quaternion)
        }
        recoil *= 0.9
      }
      bots.forEach(bot => bot.update(delta, bots))
      particleSystems = particleSystems.filter(ps => {
        ps.life -= delta
        if (ps.life > 0) {
          const pos = ps.attr.array
          for (let i = 0; i < pos.length; i += 3) {
            pos[i] += ps.velocities[i] * delta
            pos[i + 1] += ps.velocities[i + 1] * delta - 9.8 * delta
            pos[i + 2] += ps.velocities[i + 2] * delta
          }
          ps.attr.needsUpdate = true
          ps.particles.material.opacity = ps.life
          return true
        } else {
          scene.remove(ps.particles)
          return false
        }
      })
      setHud({
        health: Math.max(0, playerHealth),
        armor: playerArmor,
        ammo: currentWeapon ? currentWeapon.currentAmmo : 0,
        reserve: currentWeapon ? currentWeapon.reserve : 0,
        money: playerMoney,
        roundTime: roundTimeLeft,
        scoreT: scoreT,
        scoreCT: scoreCT,
        currentWeapon: currentWeapon ? currentWeapon.name : 'None',
        kills: playerKills,
        deaths: playerDeaths
      })
      renderer.render(scene, camera)
    }
    animate()
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)
    return () => {
      // Cleanup
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keyup', onKeyUp)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mousedown', shoot)
      window.removeEventListener('resize', onResize)
      mountRef.current.removeChild(renderer.domElement)
      renderer.dispose()
      bots.forEach(bot => clearInterval(bot.shootInterval))
    }
  }, [team, onExit, teamBots, enemyBots])

  // HUD and other UI as in the original code
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      {/* The rest of the UI code from the provided Game component */}
      {/* ... */}
    </div>
  )
}

export default Game