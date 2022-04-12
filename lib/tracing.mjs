// Reference: https://docs.sentry.io/platforms/node/guides/koa/

import { utilitas } from 'utilitas';

const log = (str, opts) => utilitas.log(str, import.meta.url, opts);

let sentry, tracing, domain;

// not mandatory, but adding domains does help a lot with breadcrumbs
const requestHandler = (ctx, next) => {
    return new Promise((resolve, _) => {
        const local = domain.create();
        local.add(ctx);
        local.on('error', err => {
            ctx.status = err.status || 500;
            ctx.body = err.message;
            ctx.app.emit('error', err, ctx);
        });
        local.run(async () => {
            sentry.getCurrentHub().configureScope(scope =>
                scope.addEventProcessor(event => sentry.Handlers.parseRequest(
                    event, ctx.request, { user: false }
                ))
            );
            await next();
            resolve();
        });
    });
};

// this tracing middleware creates a transaction per request
const tracingMiddleWare = async (ctx, next) => {
    const reqMethod = (ctx.method || '').toUpperCase();
    const reqUrl = ctx.url && tracing.stripUrlQueryAndFragment(ctx.url);
    // connect to trace of upstream app
    let traceparentData;
    if (ctx.request.get('sentry-trace')) {
        traceparentData = tracing.extractTraceparentData(
            ctx.request.get('sentry-trace')
        );
    }
    const transaction = sentry.startTransaction({
        name: `${reqMethod} ${reqUrl}`, op: 'http.server', ...traceparentData,
    });
    ctx.__sentry_transaction = transaction;
    await next();
    // if using koa router, a nicer way to capture transaction using the matched route
    if (ctx._matchedRoute) {
        const mountPath = ctx.mountPath || '';
        transaction.setName(`${reqMethod} ${mountPath}${ctx._matchedRoute}`);
    }
    transaction.setHttpStatus(ctx.status);
    transaction.finish();
};

// usual error handler
const errorHandler = (err, ctx) => {
    sentry.withScope(scope => {
        scope.addEventProcessor(event => {
            return sentry.Handlers.parseRequest(event, ctx.request);
        });
        sentry.captureException(err);
    });
};

const init = async (options, app) => {
    if (options) {
        if (!sentry) {
            const { sentinel } = await import('utilitas');
            sentry = await sentinel.init(options);
        }
        if (app && (!tracing || !domain)) {
            /* extractTraceparentData, stripUrlQueryAndFragment, Span */
            tracing = await import('@sentry/tracing');
            domain = await import('domain');
            app.use(requestHandler);
            app.use(tracingMiddleWare);
            app.on('error', errorHandler);
            if (!options.silent) { log(`Tracing has been enabled.`); }
        }
    }
    assert(sentry, 'Sentry has not been initialized.', 501);
    assert(!app || (tracing && domain),
        'Sentry Tracing has not been initialized.', 501);
    return { sentry, tracing, domain };
};

export {
    init,
};
