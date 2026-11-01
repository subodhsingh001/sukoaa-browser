// SPDX-License-Identifier: GPL-3.0-or-later
const {FiltersEngine}=require('@ghostery/adblocker');
const crypto=require('node:crypto');
function compile(filters,resources){
 const engine=FiltersEngine.parse(filters);
 engine.updateEnv(new Map([['env_chromium',true],['cap_user_stylesheet',true]]));
 engine.updateResources(resources,crypto.createHash('sha256').update(resources).digest('hex'));
 return engine;
}
module.exports={compile};
