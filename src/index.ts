import TuyAPI, { DPSObject } from 'tuyapi';
import { Client } from '@elastic/elasticsearch';
import devices from '../devices';
import dotenv from 'dotenv';
dotenv.config();

type Device = {
  name: string;
  id: string;
  key: string;
};

// Check environment variables
const checkEnvironmentVariables = () => {
  if (!process.env.DEVICE_ID || !process.env.DEVICE_KEY) {
    throw new Error('id and key required.');
  }
  if (!process.env.ELASTIC_USERNAME || !process.env.ELASTIC_PASSWORD) {
    throw new Error('username and password required.');
  }
};

// Create and configure TuyAPI device
const createDevice = (dev) => {
  const device = new TuyAPI({
    id: dev.id,
    key: dev.key,
    version: '3.3',
    issueRefreshOnConnect: true,
  });

  device.find({ timeout: 10 * 60 }).then(() => {
    device.connect();
  });

  return device;
};

// Register event listeners for TuyAPI device
const registerDeviceEventListeners = (device) => {
  device.on('connected', () => console.log('Connected to device!'));
  device.on('disconnected', () => console.log('Disconnected from device.'));
  device.on('error', (error) => console.log('Error!', error));
};

// Create Elasticsearch client
const createElasticClient = () => {
  return new Client({
    node: {
      url: new URL('https://elastic.diffshare.com/'),
    },
    auth: {
      username: process.env.ELASTIC_USERNAME,
      password: process.env.ELASTIC_PASSWORD,
    },
  });
};

// Index data in Elasticsearch
const index = async (client, dev, data) => {
  if (Number.isNaN(data.dps['19'])) return;

  const name = `${dev.name}_power`;
  const mA = Math.round(data.dps['18'] * 10) / 10;
  const W = Math.round((data.dps['19'] / 10) * 10) / 10;
  console.log(name, mA, 'mA', W, 'W');

  try {
    await client.index({
      index: name,
      refresh: true,
      document: {
        value: W,
        timestamp: new Date(),
      },
    });
  } catch (e) {
    console.error(e);
  }
};

// Register data event listeners for TuyAPI device
const registerDataEventListeners = (device, client, dev) => {
  device.on('dp-refresh', (data) => index(client, dev, data));
  device.on('data', (data) => {
    console.log('Data from device:', data);
    index(client, dev, data);
  });

  setInterval(() => {
    device.refresh({ requestedDPS: [18, 19] });
  }, 3000);
};

const observe = async (dev) => {
  checkEnvironmentVariables();

  const device = createDevice(dev);
  registerDeviceEventListeners(device);

  const client = createElasticClient();
  registerDataEventListeners(device, client, dev);
};

const main = async () => {
  for (const device of devices) {
    while (true) {
      try {
        await observe(device);
        break;
      } catch {
        // Retry on error
      }
    }
  }
};

main();