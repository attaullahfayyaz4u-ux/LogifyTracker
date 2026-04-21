import express from 'express';
const app = express();
app.use(express.json());

app.post('/orders/:id/poll', async (req, res) => {
  const orderId = req.params.id;
  // implement polling logic
});
