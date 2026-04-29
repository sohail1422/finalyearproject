const express = require('express');
const path = require('path');

const app = express();
const PORT = 8080;

// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Define a route to render the home.ejs file
app.get('/', (req, res) => {
  res.render('home');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});