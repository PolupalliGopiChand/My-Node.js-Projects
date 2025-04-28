const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')

const app = express()
app.use(express.json())

const dbPath = path.join(__dirname, 'cricketTeam.db')
let db = null

// Initialize Database and Server
const initializeServerAndDatabase = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })

    app.listen(3000, () => {
      console.log('Server running at http://localhost:3000/')
    })
  } catch (error) {
    console.error(`Database Error: ${error.message}`)
    process.exit(1)
  }
}

initializeServerAndDatabase()

// Convert Database Object to Response Object
const convertPlayerDBObject = player => ({
  playerId: player.player_id,
  playerName: player.player_name,
  jerseyNumber: player.jersey_number,
  role: player.role,
})

// API 1: Get All Players
app.get('/players/', async (request, response) => {
  const getPlayersQuery = `
    SELECT 
      * 
    FROM 
      cricket_team;`
  const players = await db.all(getPlayersQuery)
  response.send(players.map(player => convertPlayerDBObject(player)))
})

// API 2: Add a New Player
app.post('/players/', async (request, response) => {
  const {playerName, jerseyNumber, role} = request.body
  const addPlayerQuery = `
    INSERT INTO 
      cricket_team (player_name, jersey_number, role)
    VALUES 
      (?, ?, ?);`
  await db.run(addPlayerQuery, playerName, jerseyNumber, role)
  response.send('Player Added to Team')
})

// API 3: Get a Single Player by ID
app.get('/players/:playerId/', async (request, response) => {
  const {playerId} = request.params
  const getPlayerQuery = `
    SELECT 
      * 
    FROM 
      cricket_team 
    WHERE 
      player_id = ?;`
  const player = await db.get(getPlayerQuery, playerId)

  if (player) {
    response.send(convertPlayerDBObject(player))
  } else {
    response.status(404).send('Player Not Found')
  }
})

// API 4: Update Player Details
app.put('/players/:playerId/', async (request, response) => {
  const {playerId} = request.params
  const {playerName, jerseyNumber, role} = request.body
  const updatePlayerQuery = `
    UPDATE 
      cricket_team
    SET 
      player_name = ?,
      jersey_number = ?,
      role = ?
    WHERE 
      player_id = ?;`
  await db.run(updatePlayerQuery, playerName, jerseyNumber, role, playerId)
  response.send('Player Details Updated')
})

// API 5: Delete a Player
app.delete('/players/:playerId/', async (request, response) => {
  const {playerId} = request.params
  const deletePlayerQuery = `
    DELETE FROM 
      cricket_team 
    WHERE 
      player_id = ?;`
  await db.run(deletePlayerQuery, playerId)
  response.send('Player Removed')
})

module.exports = app
