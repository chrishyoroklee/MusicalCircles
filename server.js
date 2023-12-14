const express = require("express");
const app = express();
const path = require("path");
const PORT = process.env.PORT || 3030;

// Serve static files from the 'dist' directory
app.use(express.static(path.join(__dirname, 'dist')));

// Define additional routes if needed
// For example, if you have an API or other routes

// Serve index.html for all other routes to enable client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});