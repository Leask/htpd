import { fileURLToPath } from 'url';
import { utilitas, storage } from 'utilitas';
import * as file from './file.mjs';
import * as token from './token.mjs';
import fs from 'fs';
import path from 'path';
import Router from '@koa/router';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultControllerPath = '../controllers';
const log = (content) => { return utilitas.modLog(content, __filename); };

const init = async (options) => {
    options = options || {};
    options.subconscious = options.subconscious || {};
    const router = new Router(options);
    const [arrPath, ctls, actions] = [[
        path.join(__dirname, defaultControllerPath),
        ...utilitas.ensureArray(options.controllerPath)
    ], [], []];
    for (let strPath of arrPath) {
        await storage.assertPath(strPath, 'D', 'R');
        const files = fs.readdirSync(strPath).filter(
            file => /\.mjs$/i.test(file) && file.indexOf('.') !== 0
        );
        for (let file of files) {
            const ctl = await import(path.join(strPath, file));
            const ctlLink = (ctl && ctl.link || '').toLowerCase();
            if (ctl && (ctlLink && !options[ctlLink] || ctl.disabled)) { continue; }
            utilitas.assert(
                ctl && ctl.actions && Array.isArray(ctl.actions)
                && ctl.actions.length, `Invalid controller: ${file}.`, 500
            );
            ctls.push(ctl);
        }
    }
    ctls.map((ctl) => {
        ctl.actions.map((action) => {
            utilitas.assert(
                action && action.process,
                `Invalid action: ${JSON.stringify(action)}.`, 500
            );
            action.path = utilitas.ensureArray(action.path || '*');
            action.method = utilitas.ensureArray(action.method || 'GET');
            action.process = utilitas.ensureArray(action.process);
            action.path.map((path) => {
                path = utilitas.ensureString(path);
                action.method.map((method) => {
                    method = utilitas.ensureString(method, { case: 'LOW' });
                    actions.push({
                        path: `/${path === '*' ? '(.*)' : path}`,
                        method: method === '*' ? 'all' : method,
                        process: utilitas.clone(action.process),
                        priority: ~~action.priority,
                        upload: !!action.upload,
                        share: !!action.share,
                        auth: !!action.auth,
                    });
                });
            });
        });
    });
    actions.sort((x, y) => { return x.priority - y.priority; });
    actions.map((action) => { initAction(router, action); });
    return router;
};

const initAction = (router, action) => {
    const process = [];
    if (action.auth) { process.push(token.ensureAuthorization); }
    if (action.upload) { action.uploadIndex = process.push(file.upload()) - 1; }
    if (action.share) { process.push(file.share); }
    action.process = [...process, ...action.process];
    router[action.method].apply(router, [action.path, ...action.process]);
    logAction(action);
};

const logAction = (action) => {
    const pcs = action.process.map((x) => { return x.name || 'anonymous' });
    if (action.upload) { pcs[action.uploadIndex] = 'upload'; }
    log(`${action.method.toUpperCase().padStart(7, ' ')} ${action.path} => ${pcs.join(', ')}`);
};

export default init;
export {
    init,
};
