import TuyAPI from 'tuyapi';
import dotenv from 'dotenv';
dotenv.config();

if (!process.env.DEVICE_ID ||
  !process.env.DEVICE_KEY) {
    throw new Error("id and key required.");

  }

const device = new TuyAPI({
  id: process.env.DEVICE_ID,
  key: process.env.DEVICE_KEY,
  version: '3.3',
  issueRefreshOnConnect: true});

let stateHasChanged = false;

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

device.on('dp-refresh', data => {
  // console.log('DP_REFRESH data from device: ', data);
  console.log(data.dps['18'], 'mA', data.dps['19'] as number / 10, 'W');
});

device.on('data', data => {
  console.log('Data from device:', data);

  // console.log(`Boolean status of default property: ${data.dps['1']}.`);
  console.log(data.dps['18'], 'mA', data.dps['19'] as number / 10, 'W');

  /*
  // Set default property to opposite
  if (!stateHasChanged) {
    device.set({dps: 1, set: !(data.dps['1'])});

    // Otherwise we'll be stuck in an endless
    // loop of toggling the state.
    stateHasChanged = true;
  }
  */
});

// Disconnect after 10 seconds
// setTimeout(() => { device.disconnect(); }, 10000);
