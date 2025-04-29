const express = require('express')
const path = require('path')
const { open } = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')

const app = express()
app.use(express.json())

const dbPath = path.join(__dirname, 'userData.db')
let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () =>
      console.log('Server Running at http://localhost:3000')
    )
  } catch (error) {
    console.error(`DB Error: ${error.message}`)
    process.exit(1)
  }
}
initializeDBAndServer()

// API 1: Register New User
app.post('/register', async (req, res) => {
  const { username, name, password, gender, location } = req.body

  const userCheckQuery = `SELECT * FROM user WHERE username = ?`
  const existingUser = await db.get(userCheckQuery, [username])

  if (existingUser) {
    res.status(400).send('User already exists')
  } else if (password.length < 5) {
    res.status(400).send('Password is too short')
  } else {
    const hashedPassword = await bcrypt.hash(password, 10)
    const createUserQuery = `
      INSERT INTO user (username, name, password, gender, location)
      VALUES (?, ?, ?, ?, ?)`
    await db.run(createUserQuery, [
      username,
      name,
      hashedPassword,
      gender,
      location,
    ])
    res.status(200).send('User created successfully')
  }
})

// API 2: Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body

  const userQuery = `SELECT * FROM user WHERE username = ?`
  const dbUser = await db.get(userQuery, [username])

  if (!dbUser) {
    res.status(400).send('Invalid user')
  } else {
    const isPasswordValid = await bcrypt.compare(password, dbUser.password)
    isPasswordValid
      ? res.status(200).send('Login success!')
      : res.status(400).send('Invalid password')
  }
})

// API 3: Change Password
app.put('/change-password', async (req, res) => {
  const { username, oldPassword, newPassword } = req.body

  const userQuery = `SELECT * FROM user WHERE username = ?`
  const dbUser = await db.get(userQuery, [username])

  if (!dbUser) {
    res.status(400).send('Invalid current password')
  } else {
    const isOldCorrect = await bcrypt.compare(oldPassword, dbUser.password)

    if (!isOldCorrect) {
      res.status(400).send('Invalid current password')
    } else if (newPassword.length < 5) {
      res.status(400).send('Password is too short')
    } else {
      const hashedNew = await bcrypt.hash(newPassword, 10)
      const updateQuery = `UPDATE user SET password = ? WHERE username = ?`
      await db.run(updateQuery, [hashedNew, username])
      res.status(200).send('Password updated')
    }
  }
})

module.exports = app
