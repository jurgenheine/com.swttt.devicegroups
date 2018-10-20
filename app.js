'use strict';

const Homey = require('homey');
const { HomeyAPI } = require('./lib/athom-api.js');

class DeviceGroups extends Homey.App {

  getApi() {
    if (!this.api) {
      this.api = HomeyAPI.forCurrentHomey();
    }
    return this.api;
  }

  async getDevices() {
    const api = await this.getApi();
    return await api.devices.getDevices();
  }

  async getGroups() {
    return Homey.ManagerDrivers.getDriver('devicegroup').getDevices();
  }

  async getGroup(id) {
    let device = await Homey.ManagerDrivers.getDriver('devicegroup').getDevice({ id });
    if (device instanceof Error) throw device;
    return device;
  }

  async setDevicesForGroup(id, devices) {
    let group = await this.getGroup(id);

    // Find all devices that should be grouped.
    let allDevices     = await this.getDevices();
    let groupedDevices = Object.values(allDevices).filter(d => devices.includes(d.id));
    let settings = group.getSettings();
    settings.groupedDevices = groupedDevices;
    // Update the group settings.
    return await group.setSettings(settings);
  }

  //async setDelay(id, delay) {
  //    let group = await this.getGroup(id);

  //    let settings = group.getSettings();
  //    settings.delay = delay;
  //    // Update the group settings.
  //    return await group.setSettings(settings);
  //}

  async setSettings(id, newsettings) {
      let group = await this.getGroup(id);

      let settings = group.getSettings();
      settings.retries = newsettings.retries;
      settings.delay = newsettings.delay;
      // Update the group settings.
      return await group.setSettings(settings);
  }

  onInit() {
    this.log('Device groups is running...');
  }

}

module.exports = DeviceGroups;
