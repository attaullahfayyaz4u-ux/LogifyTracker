import express from 'express';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
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
app.post('/orders', async (req, res) => {
  const { order_ref, customer_name, customer_phone, customer_city, product_name, cod_amount, courier, tracking_number } = req.body;
  const order = await prisma.orders.create({
    data: {
      order_ref,
      customer_name,
      customer_phone,
      customer_city,
      product_name,
      cod_amount,
      courier,
      tracking_number,
    },
  });
  res.send({ order, tracking_url: `https://track.khaasimports.pk/t/${order.track_token}` });
});
app.get('/track/:token', async (req, res) => {
  const token = req.params.token;
  const order = await prisma.orders.findFirst({ where: { track_token: token } });
  if (!order) return res.status(404).send('Order not found');
  const statusEvents = await prisma.statusEvents.findMany({
    where: { order_id: order.id },
    orderBy: { recorded_at: 'desc' },
  });
  res.send({
    order_ref: order.order_ref,
    customer_name: order.customer_name,
    customer_city: order.customer_city,
    product_name: order.product_name,
    cod_amount: order.cod_amount,
    courier: order.courier,
    tracking_number: order.tracking_number,
    current_status: statusEvents[0].status,
    timeline: statusEvents.map((event) => ({
      status: event.status,
      label: event.status,
      recorded_at: event.recorded_at,
      location: event.location,
    })),
  });
});
app.listen(3001, () => {
  console.log('Server started on port 3001');
});
