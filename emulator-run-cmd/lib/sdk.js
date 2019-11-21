"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const exec_with_result_1 = __importDefault(require("./exec-with-result"));
const fs = __importStar(require("fs"));
const fs_1 = require("fs");
const util = __importStar(require("util"));
const exec_1 = require("@actions/exec/lib/exec");
const emulator_1 = require("./emulator");
const ANDROID_TMP_PATH = "/tmp/android-sdk.zip";
let writeFileAsync = util.promisify(fs_1.writeFile);
class BaseAndroidSdk {
    constructor() {
        this.portCounter = 5554;
    }
    install(url) {
        return __awaiter(this, void 0, void 0, function* () {
            const ANDROID_HOME = this.androidHome();
            let sdkUrl = url;
            if (sdkUrl == null || sdkUrl == "") {
                sdkUrl = this.defaultSdkUrl;
            }
            if (fs.existsSync(`${process.env.HOME}/.android`)) {
                yield exec_with_result_1.default(`mv ${process.env.HOME}/.android ${process.env.HOME}/.android.backup`);
            }
            yield exec_with_result_1.default(`curl -L ${sdkUrl} -o ${ANDROID_TMP_PATH} -s`);
            yield exec_with_result_1.default(`unzip -q ${ANDROID_TMP_PATH} -d ${ANDROID_HOME}`);
            yield exec_with_result_1.default(`rm ${ANDROID_TMP_PATH}`);
            yield exec_with_result_1.default(`mkdir -p ${ANDROID_HOME}/sdk_home`);
            core.exportVariable('ANDROID_HOME', `${ANDROID_HOME}`);
            core.exportVariable('ANDROID_SDK_ROOT', `${ANDROID_HOME}`);
            core.exportVariable('ANDROID_SDK_HOME', `${ANDROID_HOME}/sdk_home`);
            const PATH = process.env.PATH;
            let extraPaths = `${ANDROID_HOME}/bin:${ANDROID_HOME}/tools:${PATH}/tools/bin:${PATH}/platform-tools/bin`;
            let PATH_WITHOUT_ANDROID = PATH.split(':').filter(entry => {
                !entry.includes("Android");
            });
            core.exportVariable('PATH', `${PATH_WITHOUT_ANDROID}:${extraPaths}`);
            return true;
        });
    }
    androidHome() {
        return `${process.env.HOME}/android-sdk`;
    }
    emulatorCmd() {
        return `${this.androidHome()}/emulator/emulator`;
    }
    acceptLicense() {
        return __awaiter(this, void 0, void 0, function* () {
            // await execWithResult(`bash -c \\\"${this.androidHome()}/tools/bin/sdkmanager --update"`);
            yield exec_with_result_1.default(`bash -c \\\"yes | ${this.androidHome()}/tools/bin/sdkmanager --licenses"`);
        });
    }
    installEmulatorPackage(api, tag, abi, verbose) {
        return __awaiter(this, void 0, void 0, function* () {
            let args = "";
            if (!verbose) {
                args += " > /dev/null";
            }
            yield exec_with_result_1.default(`bash -c \\\"${this.androidHome()}/tools/bin/sdkmanager emulator tools platform-tools 'system-images;android-${api};${tag};${abi}'${args}"`);
        });
    }
    installPlatform(api, verbose) {
        return __awaiter(this, void 0, void 0, function* () {
            let args = "";
            if (!verbose) {
                args += " > /dev/null";
            }
            yield exec_with_result_1.default(`bash -c \\\"${this.androidHome()}/tools/bin/sdkmanager 'platforms;android-${api}'${args}"`);
        });
    }
    createEmulator(name, api, tag, abi) {
        return __awaiter(this, void 0, void 0, function* () {
            yield exec_with_result_1.default(`bash -c \\\"echo -n no | ${this.androidHome()}/tools/bin/avdmanager create avd -n ${name} --package \\\"system-images;android-${api};${tag};${abi}\\\" --tag ${tag}\"`);
            return new emulator_1.Emulator(this, name, api, abi, tag, this.portCounter++, this.portCounter++);
        });
    }
    verifyHardwareAcceleration() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let exitCode = yield exec_1.exec(`${this.emulatorCmd()} -accel-check`);
                return exitCode == 0;
            }
            catch (e) {
                return false;
            }
        });
    }
    listEmulators() {
        return __awaiter(this, void 0, void 0, function* () {
            yield exec_with_result_1.default(`${this.emulatorCmd()} -list-avds`);
        });
    }
    listRunningEmulators() {
        return __awaiter(this, void 0, void 0, function* () {
            let output = yield exec_with_result_1.default(`${this.androidHome()}/platform-tools/adb devices`);
            return yield this.parseDevicesOutput(output);
        });
    }
    parseDevicesOutput(output) {
        return __awaiter(this, void 0, void 0, function* () {
            let result = new Array();
            let lines = output.split(/\r?\n/);
            for (let line in lines) {
                if (line.startsWith("emulator")) {
                    let split = line.split(" ");
                    let serial = split[0];
                    let port = serial.split("-")[1];
                    let nameOutput = yield exec_with_result_1.default(`${this.androidHome()}/platform-tools/adb adb -s ${serial} emu avd name`);
                    let nameLines = nameOutput.split(/\r?\n/);
                    let name = nameLines[0];
                    result.fill(new emulator_1.Emulator(this, name, "", "", "", parseInt(port), parseInt(port) + 1));
                }
            }
            return result;
        });
    }
    startAdbServer() {
        return __awaiter(this, void 0, void 0, function* () {
            yield exec_with_result_1.default(`${this.androidHome()}/platform-tools/adb start-server`);
        });
    }
}
exports.BaseAndroidSdk = BaseAndroidSdk;
class LinuxAndroidSdk extends BaseAndroidSdk {
    constructor() {
        super(...arguments);
        this.defaultSdkUrl = "https://dl.google.com/android/repository/sdk-tools-linux-4333796.zip";
    }
}
class MacOSAndroidSdk extends BaseAndroidSdk {
    constructor() {
        super(...arguments);
        this.defaultSdkUrl = "https://dl.google.com/android/repository/sdk-tools-darwin-4333796.zip";
    }
}
class SdkFactory {
    getAndroidSdk() {
        switch (process.platform) {
            case "linux":
                return new LinuxAndroidSdk();
            case "darwin":
                return new MacOSAndroidSdk();
            default:
                throw new Error("Unsupported OS");
        }
    }
}
exports.SdkFactory = SdkFactory;
function writeLicenseFile(file, content) {
    return __awaiter(this, void 0, void 0, function* () {
        yield writeFileAsync(file, content);
    });
}
