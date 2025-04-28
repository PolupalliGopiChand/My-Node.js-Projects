const express = require('express');
const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, 'moviesData.db');
let db = null;

// Initialize Database and Server
const initializeDatabaseAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000');
    });
  } catch (e) {
    console.error(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDatabaseAndServer();

// GET all Movies
app.get('/movies/', async (request, response) => {
  try {
    const getMoviesQuery = `SELECT movie_name AS movieName FROM movie;`;
    const moviesArray = await db.all(getMoviesQuery);
    response.status(200).send(moviesArray);
  } catch (error) {
    response.status(500).send('Error retrieving movies');
  }
});

// POST a new Movie
app.post('/movies/', async (request, response) => {
  const { directorId, movieName, leadActor } = request.body;

  try {
    const addMoviesQuery = `
      INSERT INTO movie (director_id, movie_name, lead_actor)
      VALUES (?, ?, ?);
    `;
    await db.run(addMoviesQuery, directorId, movieName, leadActor);
    response.status(201).send('Movie Successfully Added');
  } catch (error) {
    response.status(500).send('Error adding movie');
  }
});

// GET a Movie by ID
app.get('/movies/:movieId/', async (request, response) => {
  const { movieId } = request.params;

  try {
    const getMovieQuery = `SELECT * FROM movie WHERE movie_id = ?;`;
    const movie = await db.get(getMovieQuery, movieId);

    if (movie) {
      const { movie_id, director_id, movie_name, lead_actor } = movie;
      response.status(200).send({
        movieId: movie_id,
        directorId: director_id,
        movieName: movie_name,
        leadActor: lead_actor,
      });
    } else {
      response.status(404).send('Movie not found');
    }
  } catch (error) {
    response.status(500).send('Error retrieving movie');
  }
});

// PUT update a Movie by ID
app.put('/movies/:movieId/', async (request, response) => {
  const { movieId } = request.params;
  const { directorId, movieName, leadActor } = request.body;

  try {
    const updateMovieQuery = `
      UPDATE movie
      SET director_id = ?, movie_name = ?, lead_actor = ?
      WHERE movie_id = ?;
    `;
    await db.run(updateMovieQuery, directorId, movieName, leadActor, movieId);
    response.status(200).send('Movie Details Updated');
  } catch (error) {
    response.status(500).send('Error updating movie');
  }
});

// DELETE a Movie by ID
app.delete('/movies/:movieId/', async (request, response) => {
  const { movieId } = request.params;

  try {
    const deleteMovieQuery = `DELETE FROM movie WHERE movie_id = ?;`;
    await db.run(deleteMovieQuery, movieId);
    response.status(200).send('Movie Removed');
  } catch (error) {
    response.status(500).send('Error removing movie');
  }
});

// GET all Directors
app.get('/directors/', async (request, response) => {
  try {
    const getDirectorsQuery = `
      SELECT director_id AS directorId, director_name AS directorName FROM director;
    `;
    const directorsArray = await db.all(getDirectorsQuery);
    response.status(200).send(directorsArray);
  } catch (error) {
    response.status(500).send('Error retrieving directors');
  }
});

// GET Movies by Director ID
app.get('/directors/:directorId/movies/', async (request, response) => {
  const { directorId } = request.params;

  try {
    const getMovieNamesQuery = `
      SELECT movie_name AS movieName
      FROM movie
      WHERE director_id = ?;
    `;
    const movieNamesArray = await db.all(getMovieNamesQuery, directorId);
    response.status(200).send(movieNamesArray);
  } catch (error) {
    response.status(500).send('Error retrieving movies by director');
  }
});

module.exports = app;
