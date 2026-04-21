import { createClient } from 'redis';
const client = createClient({
  socket: {
    port: 6379,
    host: 'localhost',
  },
});
