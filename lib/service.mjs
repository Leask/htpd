import { utilitas, event as libEvent } from 'utilitas';
import path from 'path';

const { __dirname } = utilitas.__(import.meta.url);
const defaultServicePath = '../services';
const link = new Set();
const checkLink = (key) => { return link.has(key); };

let event;

const init = async (options) => {
    if (options) {
        event = libEvent;
        Object.keys(options).map((key) => { link.add(key); });
        const pmsLoad = [];
        utilitas.ensureArray(
            options.servicePath || path.join(__dirname, defaultServicePath)
        ).map(x => { pmsLoad.push(event.bulk(x, { silent: true })); });
        await Promise.all(pmsLoad);
    }
    assert(event, 'Services have not been initialized.', 501);
    return event;
};

const end = async (options) => {
    return event && await event.end(options);
};

export {
    checkLink,
    end,
    init,
};
