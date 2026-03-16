import express from 'express';

const app = express();
const PORT = 8000;

// Middleware to parse JSON bodies
app.use(express.json());

// Root GET route
app.get('/', (req, res) => {
    res.send('Welcome to the Sportz Express Server!');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
