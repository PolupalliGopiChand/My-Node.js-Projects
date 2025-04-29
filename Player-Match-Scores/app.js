const express = require('express')
const sqlite3 = require('sqlite3')
const {open} = require('sqlite')
const path = require('path')

const app = express()
app.use(express.json())

const dbPath = path.join(__dirname, 'cricketMatchDetails.db')
let db = null

// Initialize DB and Server
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () =>
      console.log('Server running at http://localhost:3000/'),
    )
  } catch (error) {
    console.error(`DB Error: ${error.message}`)
    process.exit(1)
  }
}

initializeDbAndServer()

/*******************************************************************/

// API 1: Get all players
app.get('/players/', async (req, res) => {
  const query = `
    SELECT 
      player_id AS playerId, 
      player_name AS playerName 
    FROM player_details;
  `
  const players = await db.all(query)
  res.json(players)
})

// API 2: Get player by ID
app.get('/players/:playerId/', async (req, res) => {
  const {playerId} = req.params
  const query = `
    SELECT 
      player_id AS playerId, 
      player_name AS playerName 
    FROM player_details 
    WHERE player_id = ?;
  `
  const player = await db.get(query, playerId)
  res.json(player)
})

// API 3: Update player name
app.put('/players/:playerId/', async (req, res) => {
  const {playerId} = req.params
  const {playerName} = req.body
  const query = `
    UPDATE player_details 
    SET player_name = ? 
    WHERE player_id = ?;
  `
  await db.run(query, playerName, playerId)
  res.send('Player Details Updated')
})

// API 4: Get match by ID
app.get('/matches/:matchId/', async (req, res) => {
  const {matchId} = req.params
  const query = `
    SELECT 
      match_id AS matchId, 
      match, 
      year 
    FROM match_details 
    WHERE match_id = ?;
  `
  const match = await db.get(query, matchId)
  res.json(match)
})

// API 5: Get all matches of a player
app.get('/players/:playerId/matches', async (req, res) => {
  const {playerId} = req.params
  const query = `
    SELECT 
      md.match_id AS matchId, 
      md.match, 
      md.year
    FROM player_match_score pms
    JOIN match_details md ON pms.match_id = md.match_id
    WHERE pms.player_id = ?;
  `
  const matches = await db.all(query, playerId)
  res.json(matches)
})

// API 6: Get all players in a match
app.get('/matches/:matchId/players', async (req, res) => {
  const {matchId} = req.params
  const query = `
    SELECT 
      pd.player_id AS playerId, 
      pd.player_name AS playerName
    FROM player_match_score pms
    JOIN player_details pd ON pms.player_id = pd.player_id
    WHERE pms.match_id = ?;
  `
  const players = await db.all(query, matchId)
  res.json(players)
})

// API 7: Get aggregated player stats
app.get('/players/:playerId/playerScores', async (req, res) => {
  const {playerId} = req.params
  const query = `
    SELECT 
      pd.player_id AS playerId, 
      pd.player_name AS playerName,
      SUM(pms.score) AS totalScore,
      SUM(pms.fours) AS totalFours,
      SUM(pms.sixes) AS totalSixes
    FROM player_match_score pms
    JOIN player_details pd ON pms.player_id = pd.player_id
    WHERE pms.player_id = ?;
  `
  const stats = await db.get(query, playerId)
  res.json(stats)
})

module.exports = app
