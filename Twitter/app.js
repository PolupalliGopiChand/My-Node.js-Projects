const express = require('express')
const { open } = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()
app.use(express.json())

const dbPath = path.join(__dirname, 'twitterClone.db')
let db = null

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () =>
      console.log(`Server Running at http://localhost:3000/`)
    )
  } catch (error) {
    console.error(`DB Error: ${error.message}`)
    process.exit(1)
  }
}
initializeDbAndServer()

// JWT Middleware
const authenticateToken = (request, response, next) => {
  const authHeader = request.headers['authorization']
  if (!authHeader) return response.status(401).send('Invalid JWT Token')

  const token = authHeader.split(' ')[1]
  jwt.verify(token, 'SECRET_KEY', (error, payload) => {
    if (error) return response.status(401).send('Invalid JWT Token')
    request.username = payload.username
    next()
  })
}

// Register API
app.post('/register/', async (request, response) => {
  const { username, password, name, gender } = request.body
  const user = await db.get('SELECT * FROM user WHERE username = ?', [username])
  if (user) return response.status(400).send('User already exists')

  if (password.length < 6) return response.status(400).send('Password is too short')

  const hashedPassword = await bcrypt.hash(password, 10)
  await db.run(
    `INSERT INTO user (username, password, name, gender) VALUES (?, ?, ?, ?)`,
    [username, hashedPassword, name, gender]
  )
  response.send('User created successfully')
})

// Login API
app.post('/login/', async (request, response) => {
  const { username, password } = request.body
  const user = await db.get('SELECT * FROM user WHERE username = ?', [username])
  if (!user) return response.status(400).send('Invalid user')

  const isPasswordValid = await bcrypt.compare(password, user.password)
  if (!isPasswordValid) return response.status(400).send('Invalid password')

  const token = jwt.sign({ username }, 'SECRET_KEY')
  response.send({ jwtToken: token })
})

// Middleware to check tweet access (only if following)
const isUserFollowing = async (request, response, next) => {
  const { tweetId } = request.params
  const { username } = request

  const user = await db.get(`SELECT user_id FROM user WHERE username = ?`, [username])
  const tweet = await db.get(`SELECT user_id FROM tweet WHERE tweet_id = ?`, [tweetId])
  if (!tweet) return response.status(404).send('Tweet not found')

  const following = await db.get(
    `SELECT * FROM follower WHERE follower_user_id = ? AND following_user_id = ?`,
    [user.user_id, tweet.user_id]
  )
  if (!following) return response.status(401).send('Invalid Request')

  next()
}

// API 3 - User feed
app.get('/user/tweets/feed/', authenticateToken, async (request, response) => {
  const { username } = request
  const user = await db.get('SELECT user_id FROM user WHERE username = ?', [username])

  const tweets = await db.all(
    `SELECT u.username, t.tweet, t.date_time AS dateTime
     FROM follower f 
     JOIN tweet t ON f.following_user_id = t.user_id 
     JOIN user u ON t.user_id = u.user_id
     WHERE f.follower_user_id = ?
     ORDER BY t.date_time DESC
     LIMIT 4`,
    [user.user_id]
  )

  response.send(tweets)
})

// API 4 - Following list
app.get('/user/following/', authenticateToken, async (request, response) => {
  const { username } = request
  const user = await db.get('SELECT user_id FROM user WHERE username = ?', [username])

  const following = await db.all(
    `SELECT u.name FROM follower f
     JOIN user u ON f.following_user_id = u.user_id
     WHERE f.follower_user_id = ?`,
    [user.user_id]
  )
  response.send(following)
})

// API 5 - Followers list
app.get('/user/followers/', authenticateToken, async (request, response) => {
  const { username } = request
  const user = await db.get('SELECT user_id FROM user WHERE username = ?', [username])

  const followers = await db.all(
    `SELECT u.name FROM follower f
     JOIN user u ON f.follower_user_id = u.user_id
     WHERE f.following_user_id = ?`,
    [user.user_id]
  )
  response.send(followers)
})

// API 6 - Tweet details
app.get('/tweets/:tweetId/', authenticateToken, isUserFollowing, async (request, response) => {
  const { tweetId } = request.params

  const tweet = await db.get(
    `SELECT t.tweet, COUNT(DISTINCT r.reply_id) AS replies, t.date_time AS dateTime
     FROM tweet t LEFT JOIN reply r ON t.tweet_id = r.tweet_id
     WHERE t.tweet_id = ?`,
    [tweetId]
  )

  const { likes } = await db.get(
    `SELECT COUNT(*) AS likes FROM like WHERE tweet_id = ?`,
    [tweetId]
  )

  tweet.likes = likes
  response.send(tweet)
})

// API 7 - Who liked tweet
app.get('/tweets/:tweetId/likes/', authenticateToken, isUserFollowing, async (request, response) => {
  const { tweetId } = request.params
  const likes = await db.all(
    `SELECT u.username FROM like l
     JOIN user u ON l.user_id = u.user_id
     WHERE l.tweet_id = ?`,
    [tweetId]
  )
  response.send({ likes: likes.map(user => user.username) })
})

// API 8 - Replies to tweet
app.get('/tweets/:tweetId/replies/', authenticateToken, isUserFollowing, async (request, response) => {
  const { tweetId } = request.params
  const replies = await db.all(
    `SELECT u.name, r.reply FROM reply r
     JOIN user u ON r.user_id = u.user_id
     WHERE r.tweet_id = ?`,
    [tweetId]
  )
  response.send({ replies })
})

// API 9 - User's own tweets
app.get('/user/tweets/', authenticateToken, async (request, response) => {
  const { username } = request
  const user = await db.get('SELECT user_id FROM user WHERE username = ?', [username])

  const tweets = await db.all(
    `SELECT t.tweet,
            COUNT(DISTINCT l.like_id) AS likes,
            COUNT(DISTINCT r.reply_id) AS replies,
            t.date_time AS dateTime
     FROM tweet t
     LEFT JOIN like l ON t.tweet_id = l.tweet_id
     LEFT JOIN reply r ON t.tweet_id = r.tweet_id
     WHERE t.user_id = ?
     GROUP BY t.tweet_id`,
    [user.user_id]
  )
  response.send(tweets)
})

// API 10 - Create tweet
app.post('/user/tweets/', authenticateToken, async (request, response) => {
  const { tweet } = request.body
  const { username } = request
  const user = await db.get('SELECT user_id FROM user WHERE username = ?', [username])

  await db.run(
    `INSERT INTO tweet (tweet, user_id, date_time)
     VALUES (?, ?, datetime('now'))`,
    [tweet, user.user_id]
  )
  response.send('Created a Tweet')
})

// API 11 - Delete tweet
app.delete('/tweets/:tweetId/', authenticateToken, async (request, response) => {
  const { tweetId } = request.params
  const { username } = request
  const user = await db.get('SELECT user_id FROM user WHERE username = ?', [username])

  const tweet = await db.get(
    `SELECT * FROM tweet WHERE tweet_id = ? AND user_id = ?`,
    [tweetId, user.user_id]
  )
  if (!tweet) return response.status(401).send('Invalid Request')

  await db.run(`DELETE FROM tweet WHERE tweet_id = ?`, [tweetId])
  response.send('Tweet Removed')
})
