import * as robot from '../lib/robot.mjs';

const action = async (bot) => {
    bot.hears('poke', async (ctx, next) => {
        ctx.reply(new Date());
        await next();
    });
};

export const { run, func } = {
    run: robot.checkLink('bot'),
    func: action,
};
