// SPDX-License-Identifier: GPL-3.0-or-later
const {parentPort,workerData}=require('node:worker_threads');
const {compile}=require('./filter-compiler.cjs');
try {
 const bytes=Uint8Array.from(compile(workerData.filters,workerData.resources).serialize());
 parentPort.postMessage({bytes},[bytes.buffer]);
}catch(error){parentPort.postMessage({error:error.message});}
