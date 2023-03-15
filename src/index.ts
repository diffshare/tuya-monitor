import TuyAPI, { DPSObject } from 'tuyapi';
import { Client } from '@elastic/elasticsearch';
import devices from '../devices';
import dotenv from 'dotenv';
dotenv.config();

if (!process.env.DEVICE_ID || !process.env.DEVICE_KEY) {
  throw new Error("id and key required.");
}

type Device = {
  name: string;
  id: string;
  key: string;
};

const observe = (dev: Device) => {
  if (!process.env.ELASTIC_USERNAME || !process.env.ELASTIC_PASSWORD) {
    throw new Error("username and password required.");
  }
  const device = new TuyAPI({
    id: dev.id,
    key: dev.key,
    version: '3.3',
    issueRefreshOnConnect: true
  });

  // Find device on network
  device.find({timeout: 10 * 60}).then(() => {
    // Connect to device
    device.connect();
  });

  // Add event listeners
  device.on('connected', () => {
    console.log('Connected to device!');
  });

  device.on('disconnected', () => {
    console.log('Disconnected from device.');
  });

  device.on('error', error => {
    console.log('Error!', error);
  });

  const client = new Client({
    node: {
      url: new URL('https://elastic.diffshare.com/'),
    },
    auth: {
      username: process.env.ELASTIC_USERNAME,
      password: process.env.ELASTIC_PASSWORD,
    }
  });
  const index = async (data: DPSObject) => {
    if (Number.isNaN(data.dps['19'])) return;

    const name = `${dev.name}_power`;
    const mA = Math.round(data.dps['18'] as number * 10) / 10;
    const W  = Math.round(data.dps['19'] as number / 10 * 10) / 10;
    console.log(name, mA, 'mA', W, 'W');
    try {
      await client.index({
        index: name,
        refresh: true,
        document: {
          value: W,
          timestamp: new Date(),
        }
      })
    } catch (e) {
      console.error(e);
    }
  };

  // 更新時のデータ
  device.on('dp-refresh', data => {
    index(data);
  });

  // デバイス接続時のデータ
  device.on('data', data => {
    console.log('Data from device:', data);
    index(data);
  });

  // 定期的に更新して定期的にデータを取得する
  setInterval(() => {
    device.refresh({ requestedDPS: [18, 19] });
  }, 3000);
};

devices.forEach(device => {
  while (true)
    try {
      observe(device);
      break;
    }
    catch {

    }
});
