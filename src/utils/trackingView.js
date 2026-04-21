// src/utils/trackingView.js
const axios = require('axios');
const TRACKING_VIEW_API_URL = process.env.TRACKING_VIEW_API_URL;

const createTrackingView = async (orderId, userId) => {
  try {
    const response = await axios.post(`${TRACKING_VIEW_API_URL}/tracking-views`, { order_id: orderId, user_id: userId });
    return response.data;
  } catch (error) {
    console.error(error);
    return null;
  }
};

module.exports = { createTrackingView };