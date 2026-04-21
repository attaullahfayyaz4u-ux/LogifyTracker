import express from 'express';
const app = express();
app.use(express.json());

app.post('/auth/login', async (req, res) => {
  const { whatsapp, password } = req.body;
  const seller = await prisma.sellers.findFirst({
    where: { whatsapp, password: await hashPassword(password) },
  });
  if (!seller) return res.status(401).send('Invalid credentials');
  const token = generateToken(seller);
  res.send({ access_token: token });
});
