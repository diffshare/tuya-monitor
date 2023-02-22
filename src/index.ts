import TuyAPI, { DPSObject } from 'tuyapi';
import {Client} from '@elastic/elasticsearch';
import dotenv from 'dotenv';
dotenv.config();

if (!process.env.DEVICE_ID || !process.env.DEVICE_KEY) {
  throw new Error("id and key required.");
}
if (!process.env.ELASTIC_USERNAME || !process.env.ELASTIC_PASSWORD) {
  throw new Error("username and password required.");
}

const device = new TuyAPI({
  id: process.env.DEVICE_ID,
  key: process.env.DEVICE_KEY,
  version: '3.3',
  issueRefreshOnConnect: true});

// Find device on network
device.find().then(() => {
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
// (async () => {
//   const info = await client.info();
//   console.log("info:", info);
// })()
const index = async (data: DPSObject) => {
  if (!data.dps['19']) return;

  const name = "洗濯機_power";
  const mA = data.dps['18'];
  const W  = data.dps['19'] as number / 10;
  console.log(name, mA, 'mA', W, 'W');
  await client.index({
    index: name,
    refresh: true,
    document: {
      value: W,
      timestamp: new Date(),
    }
  })
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
  device.refresh({requestedDPS: [18, 19]});
}, 2000);
