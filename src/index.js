import express from 'express';
import { matchRouter } from './routes/matches.js';


const app = express();
const PORT = 8000;

// Middleware to parse JSON bodies
app.use(express.json());

// Root GET route
app.get('/', (req, res) => {
    res.send('Welcome to the Sportz Express Server!');
});



app.use("/matches", matchRouter);

// Global error handler — catches malformed JSON from body-parser
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ error: 'Invalid JSON payload.', details: err.message });
    }
    next(err);
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
