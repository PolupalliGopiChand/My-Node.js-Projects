const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()
app.use(express.json())

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
let db = null

const SECRET_KEY = 'MY_SECRET_KEY'

// Initialize DB & Server
const initializeDBAndServer = async () => {
  try {
    db = await open({filename: dbPath, driver: sqlite3.Database})
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.error(`DB Error: ${e.message}`)
    process.exit(1)
  }
}
initializeDBAndServer()

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  if (!authHeader) return res.status(401).send('Invalid JWT Token')

  const token = authHeader.split(' ')[1]
  jwt.verify(token, SECRET_KEY, (error, payload) => {
    if (error) return res.status(401).send('Invalid JWT Token')
    req.username = payload.username
    next()
  })
}

// Login API
app.post('/login/', async (req, res) => {
  const {username, password} = req.body
  const getUserQuery = `SELECT * FROM user WHERE username = ?`
  const user = await db.get(getUserQuery, [username])

  if (!user) {
    res.status(400).send('Invalid user')
  } else {
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (isPasswordValid) {
      const jwtToken = jwt.sign({username}, SECRET_KEY)
      res.send({jwtToken})
    } else {
      res.status(400).send('Invalid password')
    }
  }
})

// Get all states
app.get('/states/', authenticateToken, async (req, res) => {
  const query = `SELECT state_id AS stateId, state_name AS stateName, population FROM state`
  const states = await db.all(query)
  res.send(states)
})

// Get specific state
app.get('/states/:stateId/', authenticateToken, async (req, res) => {
  const {stateId} = req.params
  const query = `SELECT state_id AS stateId, state_name AS stateName, population FROM state WHERE state_id = ?`
  const state = await db.get(query, [stateId])
  res.send(state)
})

// Add new district
app.post('/districts/', authenticateToken, async (req, res) => {
  const {districtName, stateId, cases, cured, active, deaths} = req.body
  const query = `
    INSERT INTO district (district_name, state_id, cases, cured, active, deaths) 
    VALUES (?, ?, ?, ?, ?, ?)`
  await db.run(query, [districtName, stateId, cases, cured, active, deaths])
  res.send('District Successfully Added')
})

// Get specific district
app.get('/districts/:districtId/', authenticateToken, async (req, res) => {
  const {districtId} = req.params
  const query = `
    SELECT district_id AS districtId, district_name AS districtName, state_id AS stateId, 
           cases, cured, active, deaths 
    FROM district WHERE district_id = ?`
  const district = await db.get(query, [districtId])
  res.send(district)
})

// Delete district
app.delete('/districts/:districtId/', authenticateToken, async (req, res) => {
  const {districtId} = req.params
  const query = `DELETE FROM district WHERE district_id = ?`
  await db.run(query, [districtId])
  res.send('District Removed')
})

// Update district
app.put('/districts/:districtId/', authenticateToken, async (req, res) => {
  const {districtId} = req.params
  const {districtName, stateId, cases, cured, active, deaths} = req.body
  const query = `
    UPDATE district 
    SET district_name = ?, state_id = ?, cases = ?, cured = ?, active = ?, deaths = ?
    WHERE district_id = ?`
  await db.run(query, [
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
    districtId,
  ])
  res.send('District Details Updated')
})

// Get state stats
app.get('/states/:stateId/stats/', authenticateToken, async (req, res) => {
  const {stateId} = req.params
  const query = `
    SELECT SUM(cases) AS totalCases, SUM(cured) AS totalCured, 
           SUM(active) AS totalActive, SUM(deaths) AS totalDeaths 
    FROM district WHERE state_id = ?`
  const stats = await db.get(query, [stateId])
  res.send(stats)
})

module.exports = app
