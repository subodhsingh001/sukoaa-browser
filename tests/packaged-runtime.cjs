// Container-only harness: loads final packaged ASAR without the unavailable OS sandbox.
// Final executable fuse bytes are checked separately; this is not a real device launch.
const {app}=require('electron');
app.enableSandbox=()=>{};
Object.defineProperty(app,'isPackaged',{value:true});
app.setPath('userData',process.env.SUKOAA_TEST_PROFILE);
require('../build/desktop/linux-unpacked/resources/app.asar/main.cjs');
