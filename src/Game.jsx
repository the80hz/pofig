import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import * as CANNON from 'cannon-es'

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
    let playerBody
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
    scene.fog = new THREE.Fog(0x87ceeb, 0, 150)

    camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.set(0, 1.7, 0)

    renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mountRef.current.appendChild(renderer.domElement)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.2)
    sunLight.position.set(50, 80, 30)
    sunLight.castShadow = true
    sunLight.shadow.mapSize.width = 2048
    sunLight.shadow.mapSize.height = 2048
    sunLight.shadow.camera.near = 0.5
    sunLight.shadow.camera.far = 200
    sunLight.shadow.camera.left = -60
    sunLight.shadow.camera.right = 60
    sunLight.shadow.camera.top = 60
    sunLight.shadow.camera.bottom = -60
    scene.add(sunLight)

    // PHYSICS
    world = new CANNON.World()
    world.gravity.set(0, -30, 0)
    world.broadphase = new CANNON.SAPBroadphase(world)
    world.solver.iterations = 20

    // SIMPLE BOX MAP - квадратная арена с стенами
    const createBox = (w, h, d, x, y, z, color = 0x8b7355) => {
      const geometry = new THREE.BoxGeometry(w, h, d)
      const material = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.2 })
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

    // Ground (пол)
    createBox(100, 1, 100, 0, -0.5, 0, 0xa89968)

    // Outer walls (внешние стены) - создаём квадрат
    const wallHeight = 10
    const wallThickness = 2
    const arenaSize = 50

    // North wall
    createBox(arenaSize * 2, wallHeight, wallThickness, 0, wallHeight/2, -arenaSize, 0x666666)
    
    // South wall
    createBox(arenaSize * 2, wallHeight, wallThickness, 0, wallHeight/2, arenaSize, 0x666666)
    
    // West wall
    createBox(wallThickness, wallHeight, arenaSize * 2, -arenaSize, wallHeight/2, 0, 0x666666)
    
    // East wall
    createBox(wallThickness, wallHeight, arenaSize * 2, arenaSize, wallHeight/2, 0, 0x666666)

    // COVER BOXES - случайные коробки для укрытия
    const coverBoxes = []
    const numBoxes = 25 // количество коробок
    
    for (let i = 0; i < numBoxes; i++) {
      // Случайная позиция, избегая центра (bomb site) и спавнов
      let x, z
      do {
        x = (Math.random() - 0.5) * 80 // -40 до 40
        z = (Math.random() - 0.5) * 80
      } while (
        // Избегаем центра (bomb site)
        (Math.abs(x) < 12 && Math.abs(z) < 12) ||
        // Избегаем CT spawn
        (x < -30 && Math.abs(z) < 15) ||
        // Избегаем T spawn
        (x > 30 && Math.abs(z) < 15)
      )
      
      const size = 2 + Math.random() * 3 // размер от 2 до 5
      const height = 3 + Math.random() * 4 // высота от 3 до 7
      const colors = [0x8b7355, 0x6b5d4f, 0x9b8365, 0x7a6850]
      const color = colors[Math.floor(Math.random() * colors.length)]
      
      coverBoxes.push(createBox(size, height, size, x, height/2, z, color))
    }

    // BOMB PLANT SITE в центре арены
    const createBombSite = (x, z) => {
      const geometry = new THREE.CircleGeometry(8, 32)
      const material = new THREE.MeshBasicMaterial({ 
        color: 0xff0000, 
        transparent: true, 
        opacity: 0.3,
        side: THREE.DoubleSide
      })
      const circle = new THREE.Mesh(geometry, material)
      circle.rotation.x = -Math.PI / 2
      circle.position.set(x, 0.1, z)
      scene.add(circle)

      // Text label
      const canvas = document.createElement('canvas')
      canvas.width = 128
      canvas.height = 128
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ff0000'
      ctx.font = 'bold 80px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('PLANT', 64, 80)
      
      const texture = new THREE.CanvasTexture(canvas)
      const spriteMaterial = new THREE.SpriteMaterial({ map: texture })
      const sprite = new THREE.Sprite(spriteMaterial)
      sprite.position.set(x, 8, z)
      sprite.scale.set(10, 10, 1)
      scene.add(sprite)

      return { x, z, radius: 8 }
    }

    const bombSite = createBombSite(0, 0)

    // PLAYER
    const playerShape = new CANNON.Cylinder(0.5, 0.5, 1.8, 12)
    playerBody = new CANNON.Body({
      mass: 80,
      shape: playerShape,
      linearDamping: 0.9,
      fixedRotation: true
    })
    
    // CT spawn слева, T spawn справа
    playerBody.position.set(
      playerTeam === 'CT' ? -40 : 40, 
      3, 
      0
    )
    world.addBody(playerBody)

    // Weapon model
    const weaponGroup = new THREE.Group()
    const weaponBody = new THREE.BoxGeometry(0.1, 0.2, 0.6)
    const weaponMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3, metalness: 0.7 })
    const weaponMesh = new THREE.Mesh(weaponBody, weaponMat)
    weaponGroup.add(weaponMesh)

    const barrelGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.4, 8)
    const barrelMesh = new THREE.Mesh(barrelGeometry, weaponMat)
    barrelMesh.rotation.x = Math.PI / 2
    barrelMesh.position.set(0, 0, -0.5)
    weaponGroup.add(barrelMesh)

    weaponGroup.position.set(0.3, -0.2, -0.5)
    camera.add(weaponGroup)
    scene.add(camera)

    const muzzleGeometry = new THREE.SphereGeometry(0.08)
    const muzzleMaterial = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0 })
    muzzleFlash = new THREE.Mesh(muzzleGeometry, muzzleMaterial)
    muzzleFlash.position.set(0, 0, -0.7)
    weaponGroup.add(muzzleFlash)

    // PARTICLE SYSTEM
    const createParticleExplosion = (position, color = 0xff6600, count = 30) => {
      const geometry = new THREE.BufferGeometry()
      const positions = []
      const velocities = []

      for (let i = 0; i < count; i++) {
        positions.push(position.x, position.y, position.z)
        velocities.push((Math.random() - 0.5) * 15, Math.random() * 15, (Math.random() - 0.5) * 15)
      }

      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      const material = new THREE.PointsMaterial({
        color, size: 0.3, transparent: true, opacity: 1, blending: THREE.AdditiveBlending
      })
      const particles = new THREE.Points(geometry, material)
      scene.add(particles)

      particleSystems.push({
        particles, velocities, life: 1.0, positions: geometry.attributes.position.array
      })
    }

    // WEAPON SYSTEM
    const weaponStats = {
      Knife: { damage: 65, fireRate: 600, ammo: Infinity, reserve: 0, price: 0, spread: 0 },
      Glock: { damage: 28, fireRate: 120, ammo: 20, reserve: 120, price: 0, spread: 0.018 },
      USP: { damage: 35, fireRate: 180, ammo: 12, reserve: 100, price: 0, spread: 0.012 },
      'AK-47': { damage: 36, fireRate: 100, ammo: 30, reserve: 90, price: 2700, spread: 0.022 },
      M4A1: { damage: 33, fireRate: 90, ammo: 30, reserve: 90, price: 3100, spread: 0.018 },
      AWP: { damage: 115, fireRate: 1500, ammo: 10, reserve: 30, price: 4750, spread: 0.001 },
      HE: { damage: 100, fireRate: 1000, ammo: 1, reserve: 0, price: 300, spread: 0 },
      Flash: { damage: 0, fireRate: 1000, ammo: 1, reserve: 0, price: 200, spread: 0 },
      Smoke: { damage: 0, fireRate: 1000, ammo: 1, reserve: 0, price: 300, spread: 0 }
    }

    const initWeapon = (name) => {
      const stats = weaponStats[name]
      return { name, damage: stats.damage, fireRate: stats.fireRate, ammo: stats.ammo, reserve: stats.reserve, lastFire: 0, spread: stats.spread }
    }

    weapons.knife = initWeapon('Knife')
    weapons.pistol = initWeapon(playerTeam === 'CT' ? 'USP' : 'Glock')
    currentWeapon = weapons.pistol

    // BOT AI
    class Bot {
      constructor(team, spawnPos, id) {
        this.id = id
        this.team = team
        this.health = 100
        this.armor = 0
        this.alive = true
        this.kills = 0
        this.deaths = 0
        this.weapon = initWeapon(team === 'CT' ? 'M4A1' : 'AK-47')
        
        const shape = new CANNON.Cylinder(0.5, 0.5, 1.8, 12)
        this.body = new CANNON.Body({ mass: 80, shape, linearDamping: 0.9, fixedRotation: true })
        this.body.position.set(spawnPos.x, spawnPos.y, spawnPos.z)
        world.addBody(this.body)

        const geometry = new THREE.CylinderGeometry(0.5, 0.5, 1.8, 12)
        const material = new THREE.MeshStandardMaterial({ 
          color: team === 'CT' ? 0x4a90e2 : 0xe74c3c, roughness: 0.7, metalness: 0.3 
        })
        this.mesh = new THREE.Mesh(geometry, material)
        this.mesh.castShadow = true
        scene.add(this.mesh)

        this.state = 'patrol'
        this.target = null
        this.patrolPoints = this.getPatrolPoints()
        this.currentPatrolIndex = 0
        this.lastShot = 0
        // УМЕНЬШЕНА ТОЧНОСТЬ - теперь от 0.35 до 0.55 (было 0.75-0.95)
        this.accuracy = 0.35 + Math.random() * 0.2
        this.alertness = 0
        this.lastSeenTarget = null
        this.searchTime = 0
      }

      getPatrolPoints() {
        // Простые точки патрулирования - движение к центру и по периметру
        if (this.team === 'CT') {
          return [
            new THREE.Vector3(-40, 2, 0),
            new THREE.Vector3(-20, 2, 0),
            new THREE.Vector3(-20, 2, 20),
            new THREE.Vector3(-20, 2, -20),
            new THREE.Vector3(0, 2, 0)
          ]
        } else {
          return [
            new THREE.Vector3(40, 2, 0),
            new THREE.Vector3(20, 2, 0),
            new THREE.Vector3(20, 2, 20),
            new THREE.Vector3(20, 2, -20),
            new THREE.Vector3(0, 2, 0)
          ]
        }
      }

      update(delta, allBots) {
        if (!this.alive) return

        this.mesh.position.copy(this.body.position)
        this.mesh.position.y -= 0.9

        let nearestEnemy = null
        let nearestDist = 60

        if (alive && playerTeam !== this.team) {
          const distToPlayer = this.body.position.distanceTo(playerBody.position)
          if (distToPlayer < nearestDist) {
            nearestEnemy = { position: playerBody.position, isPlayer: true }
            nearestDist = distToPlayer
          }
        }

        for (const enemy of allBots) {
          if (enemy.alive && enemy.team !== this.team) {
            const dist = this.body.position.distanceTo(enemy.body.position)
            if (dist < nearestDist) {
              nearestEnemy = { position: enemy.body.position, bot: enemy }
              nearestDist = dist
            }
          }
        }

        if (nearestEnemy) {
          this.state = 'attack'
          this.target = nearestEnemy
          this.lastSeenTarget = nearestEnemy.position.clone()
          this.alertness = 1
          this.searchTime = 0
        } else if (this.alertness > 0) {
          this.alertness -= delta * 0.2
          if (this.lastSeenTarget) {
            this.state = 'search'
            this.searchTime += delta
            if (this.searchTime > 5) {
              this.state = 'patrol'
              this.lastSeenTarget = null
            }
          }
        } else {
          this.state = 'patrol'
        }

        if (this.state === 'patrol') {
          const targetPoint = this.patrolPoints[this.currentPatrolIndex]
          const direction = new THREE.Vector3()
          direction.subVectors(targetPoint, this.body.position)
          direction.y = 0
          
          if (direction.length() < 3) {
            this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length
          } else {
            direction.normalize()
            // Скорость увеличена в 2.5 раза (было 10, стало 25)
            this.body.velocity.x = direction.x * 25
            this.body.velocity.z = direction.z * 25
          }
        } else if (this.state === 'attack' && this.target) {
          const direction = new THREE.Vector3()
          direction.subVectors(this.target.position, this.body.position)
          direction.y = 0
          direction.normalize()

          const dist = this.body.position.distanceTo(this.target.position)
          
          if (dist > 25) {
            // Скорость увеличена в 2.5 раза
            this.body.velocity.x = direction.x * 27.5
            this.body.velocity.z = direction.z * 27.5
          } else if (dist < 12) {
            this.body.velocity.x = -direction.x * 15
            this.body.velocity.z = -direction.z * 15
          } else {
            const strafe = new THREE.Vector3(-direction.z, 0, direction.x)
            this.body.velocity.x = strafe.x * 17.5
            this.body.velocity.z = strafe.z * 17.5
          }

          const now = Date.now()
          if (now - this.lastShot > this.weapon.fireRate && dist < 60) {
            this.shoot(direction, dist)
            this.lastShot = now
          }

          if (dist > 70) {
            this.state = 'search'
            this.searchTime = 0
          }
        }
      }

      shoot(direction, distance) {
        if (this.weapon.ammo <= 0) {
          const needed = weaponStats[this.weapon.name].ammo - this.weapon.ammo
          const reload = Math.min(needed, this.weapon.reserve)
          this.weapon.ammo += reload
          this.weapon.reserve -= reload
          return
        }

        this.weapon.ammo--
        playGunshot()

        const from = this.body.position.clone()
        from.y += 1.5
        
        const to = from.clone()
        const accuracy = this.accuracy * (1 - distance / 150)
        // УВЕЛИЧЕН РАЗБРОС - spread умножен на 3 для большей неточности
        const spread = (1 - accuracy) * 0.6
        
        to.x += direction.x * 200 + (Math.random() - 0.5) * spread * 200
        to.y += direction.y * 200 + (Math.random() - 0.5) * spread * 200
        to.z += direction.z * 200 + (Math.random() - 0.5) * spread * 200

        const rayResult = new CANNON.RaycastResult()
        world.rayTest(from, to, rayResult)

        if (rayResult.hasHit) {
          if (rayResult.body === playerBody && alive) {
            let finalDamage = this.weapon.damage * Math.max(1 - distance / 150, 0.4)
            if (rayResult.hitPointWorld.y > playerBody.position.y + 0.8) finalDamage *= 4
            
            if (playerArmor > 0) {
              const absorbed = Math.min(playerArmor, finalDamage * 0.5)
              playerArmor -= absorbed
              playerHealth -= (finalDamage - absorbed)
            } else {
              playerHealth -= finalDamage
            }

            if (playerHealth <= 0) {
              playerHealth = 0
              alive = false
              setIsAlive(false)
              playerDeaths++
              this.kills++
            }
          }

          for (const bot of bots) {
            if (bot.body === rayResult.body && bot.alive) {
              let damage = this.weapon.damage
              if (rayResult.hitPointWorld.y > bot.body.position.y + 0.8) damage *= 4
              bot.takeDamage(damage, this)
            }
          }

          createParticleExplosion(rayResult.hitPointWorld, 0xffaa00, 10)
        }
      }

      takeDamage(amount, attacker = null) {
        if (!this.alive) return
        
        if (this.armor > 0) {
          const absorbed = Math.min(this.armor, amount * 0.5)
          this.armor -= absorbed
          this.health -= (amount - absorbed)
        } else {
          this.health -= amount
        }

        if (this.health <= 0) {
          this.die()
          if (attacker) {
            attacker.kills++
          }
        }
      }

      die() {
        this.alive = false
        this.deaths++
        this.mesh.visible = false
        world.removeBody(this.body)
        createParticleExplosion(this.body.position, 0xff0000, 30)
      }

      respawn(pos) {
        this.alive = true
        this.health = 100
        this.armor = 50
        this.body.position.set(pos.x, pos.y, pos.z)
        this.body.velocity.set(0, 0, 0)
        world.addBody(this.body)
        this.mesh.visible = true
        this.state = 'patrol'
        this.target = null
        this.weapon = initWeapon(this.team === 'CT' ? 'M4A1' : 'AK-47')
      }
    }

    const spawnBots = () => {
      bots = []
      let botId = 0
      
      // Team bots - спавним на одной стороне с игроком
      for (let i = 0; i < teamBots; i++) {
        const pos = playerTeam === 'CT'
          ? { x: -40 + Math.random() * 10, y: 3, z: -15 + Math.random() * 30 }
          : { x: 40 - Math.random() * 10, y: 3, z: -15 + Math.random() * 30 }
        bots.push(new Bot(playerTeam, pos, `Bot${botId++}`))
      }

      // Enemy bots - спавним на противоположной стороне
      const enemyTeam = playerTeam === 'CT' ? 'T' : 'CT'
      for (let i = 0; i < enemyBots; i++) {
        const pos = enemyTeam === 'CT'
          ? { x: -40 + Math.random() * 10, y: 3, z: -15 + Math.random() * 30 }
          : { x: 40 - Math.random() * 10, y: 3, z: -15 + Math.random() * 30 }
        bots.push(new Bot(enemyTeam, pos, `Bot${botId++}`))
      }
    }

    spawnBots()

    const shoot = () => {
      if (!alive || !currentWeapon) return
      
      const now = Date.now()
      if (now - currentWeapon.lastFire < currentWeapon.fireRate) return
      if (currentWeapon.ammo <= 0) return

      currentWeapon.lastFire = now
      currentWeapon.ammo--
      playGunshot()

      muzzleFlash.material.opacity = 1
      setTimeout(() => muzzleFlash.material.opacity = 0, 50)

      camera.rotation.x -= 0.02
      weaponGroup.position.z += 0.05
      setTimeout(() => weaponGroup.position.z = -0.5, 80)

      if (['HE', 'Flash', 'Smoke'].includes(currentWeapon.name)) {
        throwGrenade(currentWeapon.name)
        return
      }

      const direction = new THREE.Vector3(0, 0, -1)
      direction.applyQuaternion(camera.quaternion)
      
      const spread = currentWeapon.spread
      direction.x += (Math.random() - 0.5) * spread
      direction.y += (Math.random() - 0.5) * spread
      direction.normalize()

      const from = camera.position.clone()
      const to = from.clone().add(direction.multiplyScalar(400))

      const rayResult = new CANNON.RaycastResult()
      world.rayTest(from, to, rayResult)

      if (rayResult.hasHit) {
        for (const bot of bots) {
          if (bot.body === rayResult.body && bot.alive && bot.team !== playerTeam) {
            let damage = currentWeapon.damage
            if (rayResult.hitPointWorld.y > bot.body.position.y + 0.8) damage *= 4

            const dist = from.distanceTo(rayResult.hitPointWorld)
            damage *= Math.max(1 - dist / 300, 0.4)

            bot.takeDamage(damage)
            playHitmarker()
            
            if (!bot.alive) {
              playerKills++
              playerMoney += 300
            }
            break
          }
        }

        createParticleExplosion(rayResult.hitPointWorld, 0xffaa00, 15)
      }
    }

    const throwGrenade = (type) => {
      const direction = new THREE.Vector3(0, 0, -1)
      direction.applyQuaternion(camera.quaternion)

      const grenadeShape = new CANNON.Sphere(0.12)
      const grenadeBody = new CANNON.Body({ mass: 0.4, shape: grenadeShape })
      grenadeBody.position.copy(camera.position)
      grenadeBody.velocity.set(direction.x * 30, direction.y * 30 + 5, direction.z * 30)
      world.addBody(grenadeBody)

      const grenadeGeometry = new THREE.SphereGeometry(0.12)
      const grenadeMaterial = new THREE.MeshStandardMaterial({ 
        color: type === 'HE' ? 0xff0000 : type === 'Flash' ? 0xffff00 : 0x888888
      })
      const grenadeMesh = new THREE.Mesh(grenadeGeometry, grenadeMaterial)
      grenadeMesh.castShadow = true
      scene.add(grenadeMesh)

      const grenadeData = { body: grenadeBody, mesh: grenadeMesh, type, time: 0, exploded: false }
      particleSystems.push({ grenade: grenadeData, isGrenade: true })

      setTimeout(() => {
        currentWeapon = weapons.primary || weapons.pistol
      }, 600)
    }

    window.buyWeapon = (weaponName) => {
      const stats = weaponStats[weaponName]
      if (playerMoney >= stats.price && buyZone && alive) {
        playerMoney -= stats.price
        
        if (['AK-47', 'M4A1', 'AWP'].includes(weaponName)) {
          weapons.primary = initWeapon(weaponName)
          currentWeapon = weapons.primary
        } else if (['HE', 'Flash', 'Smoke'].includes(weaponName)) {
          weapons[weaponName.toLowerCase()] = initWeapon(weaponName)
        } else if (weaponName === 'Armor') {
          playerArmor = 100
        }
        
        playSound(600, 0.1)
        setBuyMenuOpen(false)
      }
    }

    const startNewRound = () => {
      roundActive = true
      roundTimeLeft = 105
      bombPlanted = false
      bombTimer = 45
      defusing = false
      defuseProgress = 0
      buyZone = true

      if (bombObject) {
        scene.remove(bombObject)
        bombObject = null
      }

      playerBody.position.set(
        playerTeam === 'CT' ? -40 : 40,
        3,
        0
      )
      playerBody.velocity.set(0, 0, 0)
      playerHealth = 100
      playerArmor = 0
      alive = true
      setIsAlive(true)

      weapons.pistol = initWeapon(playerTeam === 'CT' ? 'USP' : 'Glock')
      currentWeapon = weapons.pistol
      weapons.primary = null

      spawnBots()

      setTimeout(() => buyZone = false, 15000)
      setRoundMessage('')
    }

    const endRound = (winner) => {
      roundActive = false
      
      if (winner === 'T') {
        scoreT++
        setRoundMessage('💀 TERRORISTS WIN!')
        playExplosion()
        
        if (playerTeam === 'T') {
          playerMoney += 3500
          consecutiveLosses = 0
        } else {
          consecutiveLosses++
          playerMoney += 1400 + Math.min(consecutiveLosses * 500, 3400)
        }
      } else {
        scoreCT++
        setRoundMessage('⚡ COUNTER-TERRORISTS WIN!')
        
        if (playerTeam === 'CT') {
          playerMoney += 3500
          consecutiveLosses = 0
        } else {
          consecutiveLosses++
          playerMoney += 1400 + Math.min(consecutiveLosses * 500, 3400)
        }
      }

      setTimeout(() => startNewRound(), 5000)
    }

    const plantBomb = () => {
      if (playerTeam !== 'T' || bombPlanted || !alive) return
      
      const pos = playerBody.position
      const dist = Math.sqrt(Math.pow(pos.x - bombSite.x, 2) + Math.pow(pos.z - bombSite.z, 2))
      
      if (dist > bombSite.radius) return

      bombPlanted = true
      playBombPlant()

      const bombGeometry = new THREE.BoxGeometry(0.5, 0.3, 0.6)
      const bombMaterial = new THREE.MeshStandardMaterial({ color: 0xcc0000, emissive: 0x660000 })
      bombObject = new THREE.Mesh(bombGeometry, bombMaterial)
      bombObject.position.copy(playerBody.position)
      bombObject.position.y = 0.15
      bombObject.castShadow = true
      scene.add(bombObject)

      setRoundMessage('💣 BOMB PLANTED!')
      setTimeout(() => setRoundMessage(''), 3000)
    }

    const defuseBomb = () => {
      if (playerTeam !== 'CT' || !bombPlanted || !alive) return
      const dist = playerBody.position.distanceTo(bombObject.position)
      if (dist > 3) return
      defusing = true
    }

    const onKeyDown = (e) => {
      keys[e.code] = true
      
      if (e.code === 'Tab') {
        e.preventDefault()
        setShowScoreboard(true)
      }
      if (e.code === 'KeyM') {
        setShowMap(!showMap)
      }
      if (e.code === 'KeyB' && buyZone && alive) {
        setBuyMenuOpen(!buyMenuOpen)
      }
      if (e.code === 'KeyE' && bombPlanted && playerTeam === 'CT' && alive) {
        defuseBomb()
      }
      if (e.code === 'KeyG' && playerTeam === 'T' && alive) {
        plantBomb()
      }
      if (e.code === 'Digit1') currentWeapon = weapons.pistol
      if (e.code === 'Digit2' && weapons.primary) currentWeapon = weapons.primary
      if (e.code === 'Digit3') currentWeapon = weapons.knife
      if (e.code === 'Digit4' && weapons.he) currentWeapon = weapons.he
      if (e.code === 'Digit5' && weapons.flash) currentWeapon = weapons.flash
      if (e.code === 'Digit6' && weapons.smoke) currentWeapon = weapons.smoke
      if (e.code === 'KeyR' && currentWeapon && currentWeapon.reserve > 0) {
        const needed = weaponStats[currentWeapon.name].ammo - currentWeapon.ammo
        const reload = Math.min(needed, currentWeapon.reserve)
        currentWeapon.ammo += reload
        currentWeapon.reserve -= reload
        playSound(400, 0.15)
      }
    }

    const onKeyUp = (e) => {
      keys[e.code] = false
      
      if (e.code === 'Tab') {
        setShowScoreboard(false)
      }
      if (e.code === 'KeyE') {
        defusing = false
        defuseProgress = 0
      }
    }

    const onMouseMove = (e) => {
      if (document.pointerLockElement === renderer.domElement) {
        yaw -= e.movementX * 0.002
        pitch -= e.movementY * 0.002
        pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch))
      }
    }

    const onMouseDown = (e) => {
      if (e.button === 0) shoot()
    }

    const onClick = () => {
      if (document.pointerLockElement !== renderer.domElement) {
        renderer.domElement.requestPointerLock()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mousedown', onMouseDown)
    renderer.domElement.addEventListener('click', onClick)

    const clock = new THREE.Clock()
    let lastFootstep = 0

    const animate = () => {
      requestAnimationFrame(animate)
      const delta = Math.min(clock.getDelta(), 0.1)

      world.step(1 / 60, delta, 3)

      if (alive) {
        const forward = new THREE.Vector3(0, 0, -1)
        forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
        const right = new THREE.Vector3(1, 0, 0)
        right.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw)

        // Скорость увеличена в 2.5 раза (было 12/18, стало 30/45)
        const moveSpeed = keys['ShiftLeft'] ? 45 : 30
        let moving = false

        if (keys['KeyW']) {
          playerBody.velocity.x = forward.x * moveSpeed
          playerBody.velocity.z = forward.z * moveSpeed
          moving = true
        } else if (keys['KeyS']) {
          playerBody.velocity.x = -forward.x * moveSpeed * 0.7
          playerBody.velocity.z = -forward.z * moveSpeed * 0.7
          moving = true
        }
        
        if (keys['KeyA']) {
          playerBody.velocity.x += -right.x * moveSpeed * 0.8
          playerBody.velocity.z += -right.z * moveSpeed * 0.8
          moving = true
        } else if (keys['KeyD']) {
          playerBody.velocity.x += right.x * moveSpeed * 0.8
          playerBody.velocity.z += right.z * moveSpeed * 0.8
          moving = true
        }

        if (!moving) {
          playerBody.velocity.x *= 0.85
          playerBody.velocity.z *= 0.85
        }

        if (keys['Space'] && Math.abs(playerBody.velocity.y) < 0.5) {
          playerBody.velocity.y = 12
        }

        if (moving && Math.abs(playerBody.velocity.y) < 0.5 && Date.now() - lastFootstep > 300) {
          playFootstep()
          lastFootstep = Date.now()
        }

        camera.position.copy(playerBody.position)
        camera.position.y += 0.9
        camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'))

        if (defusing && bombPlanted) {
          defuseProgress += delta
          if (defuseProgress >= 10) {
            bombPlanted = false
            scene.remove(bombObject)
            bombObject = null
            defusing = false
            defuseProgress = 0
            endRound('CT')
          }
        }
      }

      bots.forEach(bot => bot.update(delta, bots))

      // Update radar positions for teammates
      const teammates = bots.filter(b => b.team === playerTeam && b.alive).map(b => ({
        x: b.body.position.x,
        z: b.body.position.z
      }))
      setRadarBots(teammates)

      particleSystems = particleSystems.filter(ps => {
        if (ps.isGrenade) {
          const g = ps.grenade
          g.time += delta
          g.mesh.position.copy(g.body.position)

          if (g.time > 2 && !g.exploded) {
            g.exploded = true
            
            if (g.type === 'HE') {
              playExplosion()
              createParticleExplosion(g.body.position, 0xff3300, 60)
              
              bots.forEach(bot => {
                if (bot.alive) {
                  const dist = bot.body.position.distanceTo(g.body.position)
                  if (dist < 8) bot.takeDamage(100 * (1 - dist / 8))
                }
              })
              
              if (alive) {
                const dist = playerBody.position.distanceTo(g.body.position)
                if (dist < 8) {
                  playerHealth -= 100 * (1 - dist / 8)
                  if (playerHealth <= 0) {
                    playerHealth = 0
                    alive = false
                    setIsAlive(false)
                    playerDeaths++
                  }
                }
              }
            }
            
            scene.remove(g.mesh)
            world.removeBody(g.body)
            return false
          }
          
          return g.time < 2.5
        } else {
          ps.life -= delta
          const positions = ps.positions
          for (let i = 0; i < positions.length; i += 3) {
            positions[i] += ps.velocities[i] * delta
            positions[i + 1] += ps.velocities[i + 1] * delta - 15 * delta
            positions[i + 2] += ps.velocities[i + 2] * delta
            ps.velocities[i + 1] -= 30 * delta
          }
          ps.particles.geometry.attributes.position.needsUpdate = true
          ps.particles.material.opacity = ps.life

          if (ps.life <= 0) {
            scene.remove(ps.particles)
            return false
          }
          return true
        }
      })

      if (roundActive) {
        roundTimeLeft -= delta
        if (roundTimeLeft <= 0) endRound('CT')

        if (bombPlanted) {
          bombTimer -= delta
          if (bombTimer <= 0) {
            createParticleExplosion(bombObject.position, 0xff0000, 120)
            playExplosion()
            endRound('T')
          }
        }

        const tAlive = bots.filter(b => b.team === 'T' && b.alive).length + (playerTeam === 'T' && alive ? 1 : 0)
        const ctAlive = bots.filter(b => b.team === 'CT' && b.alive).length + (playerTeam === 'CT' && alive ? 1 : 0)
        
        if (tAlive === 0) endRound('CT')
        else if (ctAlive === 0 && !bombPlanted) endRound('T')
      }

      const stats = bots.map(b => ({
        id: b.id,
        team: b.team,
        kills: b.kills,
        deaths: b.deaths,
        alive: b.alive
      }))
      setBotStats(stats)

      setHud({
        health: Math.max(0, Math.floor(playerHealth)),
        armor: Math.max(0, Math.floor(playerArmor)),
        ammo: currentWeapon ? currentWeapon.ammo : 0,
        reserve: currentWeapon ? currentWeapon.reserve : 0,
        money: playerMoney,
        roundTime: Math.max(0, Math.floor(roundTimeLeft)),
        scoreT,
        scoreCT,
        currentWeapon: currentWeapon ? currentWeapon.name : '',
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
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keyup', onKeyUp)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mousedown', onMouseDown)
      renderer.domElement.removeEventListener('click', onClick)
      window.removeEventListener('resize', onResize)
      
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement)
      }
      
      renderer.dispose()
    }
  }, [team, teamBots, enemyBots])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      
      {/* RADAR с союзниками */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        width: '180px',
        height: '180px',
        background: 'rgba(0,0,0,0.8)',
        border: '3px solid #0f0',
        borderRadius: '50%',
        zIndex: 1000,
        overflow: 'hidden'
      }}>
        <svg width="180" height="180" style={{ position: 'absolute' }}>
          <circle cx="90" cy="90" r="85" fill="none" stroke="#0f0" strokeWidth="1" opacity="0.3" />
          <circle cx="90" cy="90" r="60" fill="none" stroke="#0f0" strokeWidth="1" opacity="0.3" />
          <circle cx="90" cy="90" r="30" fill="none" stroke="#0f0" strokeWidth="1" opacity="0.3" />
          <line x1="90" y1="5" x2="90" y2="175" stroke="#0f0" strokeWidth="1" opacity="0.3" />
          <line x1="5" y1="90" x2="175" y2="90" stroke="#0f0" strokeWidth="1" opacity="0.3" />
          
          {/* Bomb site центр */}
          <circle cx="90" cy="90" r="12" fill="none" stroke="#ff0000" strokeWidth="2" />
          <text x="90" y="95" textAnchor="middle" fill="#ff0000" fontSize="14" fontWeight="bold">PLANT</text>
          
          {/* Teammates на радаре */}
          {radarBots.map((bot, idx) => {
            // Конвертируем мировые координаты в радарные
            const radarX = 90 + (bot.x / 50) * 85
            const radarZ = 90 + (bot.z / 50) * 85
            return (
              <circle 
                key={idx}
                cx={radarX} 
                cy={radarZ} 
                r="3" 
                fill={team === 'CT' ? '#4a90e2' : '#e74c3c'}
                opacity="0.8"
              />
            )
          })}
          
          {/* Player (center) */}
          <circle cx="90" cy="90" r="5" fill={team === 'CT' ? '#4a90e2' : '#e74c3c'} />
        </svg>
      </div>

      {/* CROSSHAIR */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 1000
      }}>
        <div style={{ position: 'absolute', width: '4px', height: '4px', background: hitmarker ? '#ff0000' : '#00ff00', borderRadius: '50%', left: '-2px', top: '-2px', boxShadow: '0 0 8px currentColor' }} />
        <div style={{ position: 'absolute', width: '2px', height: '14px', background: '#00ff00', left: '-1px', top: '-22px', boxShadow: '0 0 4px #00ff00' }} />
        <div style={{ position: 'absolute', width: '2px', height: '14px', background: '#00ff00', left: '-1px', top: '8px', boxShadow: '0 0 4px #00ff00' }} />
        <div style={{ position: 'absolute', width: '14px', height: '2px', background: '#00ff00', left: '-22px', top: '-1px', boxShadow: '0 0 4px #00ff00' }} />
        <div style={{ position: 'absolute', width: '14px', height: '2px', background: '#00ff00', left: '8px', top: '-1px', boxShadow: '0 0 4px #00ff00' }} />
      </div>

      {/* HUD */}
      <div style={{
        position: 'absolute',
        bottom: '25px',
        left: '25px',
        color: '#0f0',
        fontFamily: 'Courier New, monospace',
        fontSize: '20px',
        fontWeight: 'bold',
        textShadow: '0 0 10px #000, 0 0 20px #0f0',
        pointerEvents: 'none',
        zIndex: 1000,
        background: 'rgba(0,0,0,0.7)',
        padding: '15px',
        borderRadius: '8px',
        border: '2px solid #0f0'
      }}>
        <div style={{ marginBottom: '8px', fontSize: '24px' }}>❤️ {hud.health}  🛡️ {hud.armor}</div>
        <div style={{ marginBottom: '8px' }}>💰 ${hud.money}</div>
        <div style={{ marginBottom: '8px', color: hud.ammo <= 5 ? '#ff0000' : '#0f0' }}>🔫 {hud.currentWeapon}: {hud.ammo} / {hud.reserve}</div>
        <div>☠️ K/D: {hud.kills}/{hud.deaths}</div>
        {!isAlive && <div style={{ color: '#f00', marginTop: '10px', fontSize: '18px', animation: 'blink 1s infinite' }}>☠️ SPECTATING ☠️</div>}
      </div>

      {/* Top HUD */}
      <div style={{
        position: 'absolute',
        top: '25px',
        left: '50%',
        transform: 'translateX(-50%)',
        color: '#fff',
        fontFamily: 'Courier New, monospace',
        fontSize: '26px',
        fontWeight: 'bold',
        textShadow: '0 0 15px #000',
        pointerEvents: 'none',
        zIndex: 1000,
        background: 'rgba(0,0,0,0.7)',
        padding: '15px 30px',
        borderRadius: '10px',
        border: '2px solid #fff',
        minWidth: '300px',
        textAlign: 'center'
      }}>
        <div><span style={{ color: '#e74c3c' }}>T {hud.scoreT}</span> : <span style={{ color: '#4a90e2' }}>{hud.scoreCT} CT</span></div>
        <div style={{ marginTop: '8px', fontSize: '22px', color: '#ffaa00' }}>⏱️ {Math.floor(hud.roundTime / 60)}:{(hud.roundTime % 60).toString().padStart(2, '0')}</div>
      </div>

      {/* SCOREBOARD (TAB) */}
      {showScoreboard && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(0,0,0,0.95)',
          padding: '30px',
          borderRadius: '15px',
          border: '3px solid #0f0',
          zIndex: 2500,
          minWidth: '600px',
          maxHeight: '80vh',
          overflow: 'auto'
        }}>
          <h2 style={{ color: '#0f0', textAlign: 'center', marginBottom: '20px' }}>📊 SCOREBOARD</h2>
          
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ color: '#4a90e2', marginBottom: '15px' }}>Counter-Terrorists</h3>
            <table style={{ width: '100%', color: '#fff', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #4a90e2' }}>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Player</th>
                  <th style={{ padding: '10px' }}>Kills</th>
                  <th style={{ padding: '10px' }}>Deaths</th>
                  <th style={{ padding: '10px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {team === 'CT' && (
                  <tr style={{ background: 'rgba(74,144,226,0.2)' }}>
                    <td style={{ padding: '10px' }}>👤 YOU</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>{hud.kills}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>{hud.deaths}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>{isAlive ? '✅' : '💀'}</td>
                  </tr>
                )}
                {botStats.filter(b => b.team === 'CT').map(bot => (
                  <tr key={bot.id}>
                    <td style={{ padding: '10px' }}>🤖 {bot.id}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>{bot.kills}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>{bot.deaths}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>{bot.alive ? '✅' : '💀'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3 style={{ color: '#e74c3c', marginBottom: '15px' }}>Terrorists</h3>
            <table style={{ width: '100%', color: '#fff', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e74c3c' }}>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Player</th>
                  <th style={{ padding: '10px' }}>Kills</th>
                  <th style={{ padding: '10px' }}>Deaths</th>
                  <th style={{ padding: '10px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {team === 'T' && (
                  <tr style={{ background: 'rgba(231,76,60,0.2)' }}>
                    <td style={{ padding: '10px' }}>👤 YOU</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>{hud.kills}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>{hud.deaths}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>{isAlive ? '✅' : '💀'}</td>
                  </tr>
                )}
                {botStats.filter(b => b.team === 'T').map(bot => (
                  <tr key={bot.id}>
                    <td style={{ padding: '10px' }}>🤖 {bot.id}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>{bot.kills}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>{bot.deaths}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>{bot.alive ? '✅' : '💀'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ textAlign: 'center', marginTop: '20px', color: '#888' }}>
            Press TAB to close
          </div>
        </div>
      )}

      {/* FULL MAP (M key) */}
      {showMap && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(0,0,0,0.95)',
          padding: '30px',
          borderRadius: '15px',
          border: '3px solid #0f0',
          zIndex: 2500
        }}>
          <h2 style={{ color: '#0f0', textAlign: 'center', marginBottom: '20px' }}>🗺️ SIMPLE MAP</h2>
          <svg width="400" height="400">
            <rect width="400" height="400" fill="#222" stroke="#0f0" strokeWidth="2" />
            
            {/* Grid */}
            <line x1="0" y1="200" x2="400" y2="200" stroke="#0f0" strokeWidth="1" opacity="0.3" />
            <line x1="200" y1="0" x2="200" y2="400" stroke="#0f0" strokeWidth="1" opacity="0.3" />
            
            {/* Outer walls */}
            <rect x="20" y="20" width="360" height="360" fill="none" stroke="#666" strokeWidth="4" />
            
            {/* CT Spawn Left */}
            <rect x="30" y="150" width="60" height="100" fill="#4a90e2" opacity="0.5" />
            <text x="60" y="205" textAnchor="middle" fill="#fff" fontSize="16">CT</text>
            
            {/* T Spawn Right */}
            <rect x="310" y="150" width="60" height="100" fill="#e74c3c" opacity="0.5" />
            <text x="340" y="205" textAnchor="middle" fill="#fff" fontSize="16">T</text>
            
            {/* Plant Site Center */}
            <circle cx="200" cy="200" r="40" fill="none" stroke="#ff0000" strokeWidth="3" />
            <text x="200" y="210" textAnchor="middle" fill="#ff0000" fontSize="20" fontWeight="bold">PLANT</text>
          </svg>
          <div style={{ textAlign: 'center', marginTop: '15px', color: '#888' }}>Press M to close</div>
        </div>
      )}

      {/* Buy Menu */}
      {buyMenuOpen && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(0, 0, 0, 0.95)',
          padding: '40px',
          borderRadius: '15px',
          border: '3px solid #0f0',
          zIndex: 2000,
          minWidth: '600px'
        }}>
          <h2 style={{ color: '#0f0', marginBottom: '25px', textAlign: 'center', fontSize: '32px', textShadow: '0 0 20px #0f0' }}>💰 BUY MENU</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
            <button onClick={() => window.buyWeapon(team === 'T' ? 'AK-47' : 'M4A1')} style={buyButtonStyle}>
              🔫 {team === 'T' ? 'AK-47' : 'M4A1'} - ${team === 'T' ? 2700 : 3100}
            </button>
            <button onClick={() => window.buyWeapon('AWP')} style={buyButtonStyle}>🎯 AWP - $4750</button>
            <button onClick={() => window.buyWeapon('HE')} style={buyButtonStyle}>💣 HE - $300</button>
            <button onClick={() => window.buyWeapon('Flash')} style={buyButtonStyle}>⚡ Flash - $200</button>
            <button onClick={() => window.buyWeapon('Smoke')} style={buyButtonStyle}>💨 Smoke - $300</button>
            <button onClick={() => window.buyWeapon('Armor')} style={buyButtonStyle}>🛡️ Armor - $650</button>
          </div>
          <div style={{ marginTop: '25px', color: '#fff', textAlign: 'center', fontSize: '20px', fontWeight: 'bold' }}>
            Your Money: <span style={{ color: '#0f0' }}>${hud.money}</span>
          </div>
          <div style={{ textAlign: 'center', marginTop: '15px', color: '#888', fontSize: '14px' }}>Press B to close</div>
        </div>
      )}

      {/* Round Message */}
      {roundMessage && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '64px',
          fontWeight: 'bold',
          color: '#fff',
          textShadow: '0 0 20px #000, 0 0 40px #ff0',
          pointerEvents: 'none',
          zIndex: 1500,
          animation: 'fadeInOut 1s ease-in-out',
          background: 'rgba(0,0,0,0.8)',
          padding: '30px 60px',
          borderRadius: '20px',
          border: '4px solid #ff0'
        }}>
          {roundMessage}
        </div>
      )}

      {/* Instructions */}
      <div style={{
        position: 'absolute',
        top: '15px',
        right: '15px',
        background: 'rgba(0,0,0,0.8)',
        padding: '15px',
        fontSize: '13px',
        color: '#0f0',
        borderRadius: '8px',
        border: '2px solid #0f0',
        zIndex: 1000,
        fontFamily: 'Courier New, monospace'
      }}>
        <div><strong>CONTROLS:</strong></div>
        <div>WASD: Move | Shift: Sprint</div>
        <div>Mouse: Look | Click: Shoot</div>
        <div>Space: Jump | R: Reload</div>
        <div>B: Buy | TAB: Scoreboard</div>
        <div>M: Map | 1-6: Weapons</div>
        <div>G: Plant | E: Defuse</div>
      </div>

      {/* Exit Button */}
      <button onClick={onExit} style={{
        position: 'absolute',
        top: '220px',
        left: '15px',
        padding: '12px 25px',
        background: 'linear-gradient(135deg, #ff0000, #cc0000)',
        color: '#fff',
        border: '2px solid #fff',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: 'bold',
        borderRadius: '8px',
        zIndex: 2000,
        boxShadow: '0 0 20px rgba(255,0,0,0.5)',
        transition: 'all 0.3s'
      }}>
        ❌ EXIT
      </button>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </div>
  )
}

const buyButtonStyle = {
  padding: '15px 20px',
  background: 'linear-gradient(135deg, #222, #111)',
  color: '#0f0',
  border: '2px solid #0f0',
  borderRadius: '8px',
  fontSize: '16px',
  fontWeight: 'bold',
  cursor: 'pointer',
  transition: 'all 0.3s',
  fontFamily: 'Courier New, monospace'
}

export default Game