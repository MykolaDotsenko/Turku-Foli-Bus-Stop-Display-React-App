// server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors()); // Add this line to enable CORS

app.use(express.json());

app.get('/api/bus-stops', async (req, res) => {
  try {
    const response = await axios.get('http://data.foli.fi/siri/sm');
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching bus stops:', error);
    res.status(500).json({ error: 'Error fetching bus stops' });
  }
});

app.get('/api/bus-stop/:stopNumber', async (req, res) => {
  const { stopNumber } = req.params;
  try {
    const response = await axios.get(`http://data.foli.fi/siri/sm/${stopNumber}`);
    res.json(response.data);
  } catch (error) {
    console.error(`Error fetching bus stop ${stopNumber}:`, error);
    res.status(500).json({ error: `Error fetching bus stop ${stopNumber}` });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
