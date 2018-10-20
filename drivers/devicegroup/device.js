'use strict';

const Homey = require('homey');
const {
    HomeyAPI
} = require('../../lib/athom-api.js');

var commandsArray = [];
var executorIsRunning = false;

class DeviceGroupDevice extends Homey.Device {

    onInit() {
        this.log('device init');

        this.registerMultipleCapabilityListener(this.getCapabilities(), async(valueObj, optsObj) => {
            try {
                var settings = await this.getSettings();

                await this.AddDeviceCommands(settings, valueObj);
                await this.executeCommandsFromQueue(settings);

                return Promise.resolve();
            }
            catch (err) {
                this.error(err);
                return Promise.reject();
            }
        }, 500);
    }

    // this method is called when the Device is added
    onAdded() {
        this.log('device added');
    }

    // this method is called when the Device is deleted
    onDeleted() {
        this.log('device deleted');
    }

    async AddDeviceCommands(settings, valueObj) {

        var devices = settings.groupedDevices;
        for (var key in devices) {
            let deviceid = devices[key].id;
            for (var key in valueObj) {
                await this.addCommand(deviceid, key, valueObj[key], 0);
            }
        }
    }

    getRetries(settings) {
        var retries = parseInt(settings.retries);
        if (isNaN(retries))
            retries = 0;
        return retries;
    }

    getDelay(settings) {
        var delay = parseInt(settings.delay);
        if (isNaN(delay))
            delay = 0;
        return delay;
    }

    getApi() {
        if (!this.api) {
            this.api = HomeyAPI.forCurrentHomey();
        }
        return this.api;
    }

    async executeCommandsFromQueue(settings) {
        if (!await this.canRun())
            return;

        var command = await this.getCommandToExecute();
        if (command == null)
            return;

        var api = await this.getApi();
        await api.devices.subscribe();
        var delay = this.getDelay(settings);
        var retries = this.getRetries(settings);

        while (command != null) {
            let device = await api.devices.getDevice({ id: command.deviceid });
            await this.setDeviceValue(device, command, retries);
            await this.sleep(delay);
            command = await this.getCommandToExecute();
        }
        await this.resetRun();
    }

    async setDeviceValue(device, command, retries) {
        var starttime = Date.now();
        device.setCapabilityValue(command.key, command.value)
            .then(_ => {
                var millis = Date.now() - starttime;
                this.logDevice(device.name, command.key, command.value, 'succesfull in ' + millis + ' ms');
            })
            .catch(msg => {
                this.logDevice(device.name, command.key, command.value, msg);
                this.retryDeviceValue(device.name, command, retries);
            });
    }

    async retryDeviceValue(devicename, command, retries) {
        if (retries != null && command.retry != null && command.retry < retries) {
            this.logDevice(devicename, command.key, command.value, 'retry: ' + command.retry + ' of ' + retries);
            await this.addCommand(command.deviceid, command.key, command.value, command.retry + 1)
        } else {
            this.logDevice(devicename, command.key, command.value, 'failed');
        }
    }

    async canRun() {
        if (!executorIsRunning) {
            executorIsRunning = true;
            return true;
        }
        return false;
    }

    async resetRun() {
        executorIsRunning = false;
    }

    async addCommand(deviceid, key, value, retry) {
        var command = {};
        command.deviceid = deviceid;
        command.key = key;
        command.value = value;
        command.retry = retry;

        //remove capability for device from queue, the value will be overridden by new command. It doesn't need te execute anymore 
        var index = commandsArray.findIndex(x => x.deviceid == deviceid && x.key == key);
        if (index > 0) {
            if (commandsArray[index].value == value) {
                // new command doesn't need to execute, command already in queue
                return;
            }
            //remove capability for device from queue, the value will be overridden by new command. It doesn't need te execute anymore 
            commandsArray.splice(index);
        }
        commandsArray.push(command);
    }

    async getCommandToExecute() {
        if (commandsArray.length > 0)
            return commandsArray.shift();
        return null;
    }

    logDevice(devicename, key, value, msg) {
        this.log(' Set ' + devicename + ' ' + key + ' to ' + value + '; ' + msg);
    }

    sleep(delay) {
        return new Promise(resolve => {
            setTimeout(resolve, delay)
        })
    }
}

module.exports = DeviceGroupDevice;
