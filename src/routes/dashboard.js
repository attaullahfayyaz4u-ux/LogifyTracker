import express from 'express';
const app = express();
app.use(express.json());

app.get('/dashboard/stats', async (req, res) => {
  // implement dashboard stats logic
});
