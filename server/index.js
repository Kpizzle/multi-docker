const keys = require('./keys');

// Express App set up
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Create and setup postgres client
const { Pool } = require('pg');
const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  // @ts-ignore
  port: keys.pgPort
});

pgClient.on('error', () => console.log('Lost PG Connection'));

pgClient
  .query('CREATE TABLE IF NOT EXISTS values (number INT)')
  .catch(err => console.error(err));

//Redis client set up
const redis = require('redis');
const redisClient = redis.createClient({
  host: keys.redisHost,
  // @ts-ignore
  port: keys.redisPort,
  retry_strategy: () => 1000
});

const redisPublisher = redisClient.duplicate();

//Express route handlers
app.get('/', (req, res) => {
  res.send('Hello');
});

//Express route handlers
app.get('/values/all', async (req, res) => {
  const values = await pgClient.query('SELECT * from values');

  res.send(values.rows);
});

//Express route handlers
app.get('/values/current', async (req, res) => {
  //redis lib doest't have promise support
  redisClient.hgetall('values', (err, values) => {
    res.send(values);
  });
});

app.post('/values', async (req, res) => {
  const index = req.body.index;

  if (parseInt(index) > 40) {
    return res.status(422).send('Index To High');
  }

  redisClient.hset('values', index, 'Nothing yet.');
  redisPublisher.publish('insert', index);
  pgClient.query('INSERT INTO values(number) values ($1)', [index]);

  res.send({ working: true });
});

app.listen(5000, () => {
  console.log('Listening');
});
