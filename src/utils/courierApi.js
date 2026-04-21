const axios = require('axios');
const LEOPARDS_API_KEY = process.env.LEOPARDS_API_KEY;
const LEOPARDS_API_PASSWORD = process.env.LEOPARDS_API_PASSWORD;

const getLeopardsStatus = async (trackNumber) => {
  try {
    const response = await axios.get(`https://private.leopardscourier.com/api/getPacketStatus/?api_key=${LEOPARDS_API_KEY}&api_password=${LEOPARDS_API_PASSWORD}&track_numbers=${trackNumber}`);
    return response.data;
  } catch (error) {
    console.error(error);
    return null;
  }
};

module.exports = { getLeopardsStatus };