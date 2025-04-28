const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')

const app = express()
app.use(express.json())

const dbPath = path.join(__dirname, 'covid19India.db')
let db = null

// Connect to Database and Start Server
const initializeDbAndServer = async () => {
  try {
    db = await open({filename: dbPath, driver: sqlite3.Database})
    app.listen(3000, () =>
      console.log('Server is running on http://localhost:3000'),
    )
  } catch (error) {
    console.error(`Database Error: ${error.message}`)
    process.exit(1)
  }
}
initializeDbAndServer()

// Utility Functions
const toCamelCaseState = state => ({
  stateId: state.state_id,
  stateName: state.state_name,
  population: state.population,
})

const toCamelCaseDistrict = district => ({
  districtId: district.district_id,
  districtName: district.district_name,
  stateId: district.state_id,
  cases: district.cases,
  cured: district.cured,
  active: district.active,
  deaths: district.deaths,
})

// API Endpoints

// API 1: Get All States
app.get('/states/', async (req, res) => {
  const query = `SELECT * FROM state;`
  const states = await db.all(query)
  res.send(states.map(toCamelCaseState))
})

// API 2: Get Specific State
app.get('/states/:stateId/', async (req, res) => {
  const {stateId} = req.params
  const query = `SELECT * FROM state WHERE state_id = ?;`
  const state = await db.get(query, stateId)
  res.send(toCamelCaseState(state))
})

// API 3: Add New District
app.post('/districts/', async (req, res) => {
  const {districtName, stateId, cases, cured, active, deaths} = req.body
  const query = `
    INSERT INTO district (district_name, state_id, cases, cured, active, deaths)
    VALUES (?, ?, ?, ?, ?, ?);`
  await db.run(query, [districtName, stateId, cases, cured, active, deaths])
  res.send('District Successfully Added')
})

// API 4: Get Specific District
app.get('/districts/:districtId/', async (req, res) => {
  const {districtId} = req.params
  const query = `SELECT * FROM district WHERE district_id = ?;`
  const district = await db.get(query, districtId)
  res.send(toCamelCaseDistrict(district))
})

// API 5: Delete District
app.delete('/districts/:districtId/', async (req, res) => {
  const {districtId} = req.params
  const query = `DELETE FROM district WHERE district_id = ?;`
  await db.run(query, districtId)
  res.send('District Removed')
})

// API 6: Update District Details
app.put('/districts/:districtId/', async (req, res) => {
  const {districtId} = req.params
  const {districtName, stateId, cases, cured, active, deaths} = req.body
  const query = `
    UPDATE district
    SET district_name = ?, state_id = ?, cases = ?, cured = ?, active = ?, deaths = ?
    WHERE district_id = ?;`
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

// API 7: Get State Statistics
app.get('/states/:stateId/stats/', async (req, res) => {
  const {stateId} = req.params
  const query = `
    SELECT SUM(cases) AS totalCases, SUM(cured) AS totalCured,
           SUM(active) AS totalActive, SUM(deaths) AS totalDeaths
    FROM district
    WHERE state_id = ?;`
  const stats = await db.get(query, stateId)
  res.send(stats)
})

// API 8: Get State Name by District ID
app.get('/districts/:districtId/details/', async (req, res) => {
  const {districtId} = req.params
  const query = `
    SELECT state_name AS stateName
    FROM district
    NATURAL JOIN state
    WHERE district_id = ?;`
  const result = await db.get(query, districtId)
  res.send(result)
})

module.exports = app // (good practice if you later want to test)
