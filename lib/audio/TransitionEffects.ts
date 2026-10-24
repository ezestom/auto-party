import { isTransitionEffect, type TransitionEffect } from '../ai/transitionEffects';
type Echo = {
    send: GainNode;
    delay: DelayNode;
    filter: BiquadFilterNode;
    feedback: GainNode;
    wet: GainNode;
    end: number;
};
/** Local recipes only. No provider-generated frequencies, gains, code or schedules. */
export class TransitionEffects {
    readonly filter: BiquadFilterNode;
    private echo: Echo | null = null;
    private retiring: Array<{
        echo: Echo;
        end: number;
    }> = [];
    private until = 0;
    constructor(private ctx: BaseAudioContext, private input: AudioNode, dryOutput: AudioNode, private wetOutput: AudioNode) {
        this.filter = ctx.createBiquadFilter();
        this.filter.type = 'highpass';
        this.filter.frequency.setValueAtTime(20, ctx.currentTime);
        this.filter.Q.setValueAtTime(.5, ctx.currentTime);
        input.connect(this.filter);
        this.filter.connect(dryOutput);
    }
    start(effect: TransitionEffect, duration: number, bpm: number): TransitionEffect {
        this.cancel();
        if (!isTransitionEffect(effect) || effect === 'none' || !Number.isFinite(duration) || duration < 1 || duration > 8)
            return 'none';
        if (effect === 'echo_out' && (!Number.isFinite(bpm) || bpm < 60 || bpm > 200))
            return 'none';
        const now = this.ctx.currentTime;
        if (effect === 'filter_sweep') {
            const curve = Float32Array.from({ length: 129 }, (_, i) => 20 * Math.pow(45, i / 128));
            this.filter.frequency.cancelScheduledValues(now);
            this.filter.frequency.setValueCurveAtTime(curve, now, duration);
            this.filter.frequency.setTargetAtTime(20, now + duration, .025);
            this.filter.frequency.setValueAtTime(20, now + duration + .2);
            this.until = now + duration + .2;
        }
        else {
            const send = this.ctx.createGain(), delay = this.ctx.createDelay(1), filter = this.ctx.createBiquadFilter(), feedback = this.ctx.createGain(), wet = this.ctx.createGain();
            const capture = Math.min(.8, duration * .6), end = now + duration + 1.25;
            delay.delayTime.setValueAtTime(Math.max(.15, Math.min(.5, 30 / bpm)), now);
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(4000, now);
            filter.Q.setValueAtTime(.5, now);
            send.gain.setValueCurveAtTime(new Float32Array([0, .65, .65, 0]), now, capture);
            send.gain.setValueAtTime(0, now + capture);
            feedback.gain.setValueAtTime(.25, now);
            feedback.gain.setValueAtTime(0, end);
            wet.gain.setValueAtTime(.18, now);
            wet.gain.setTargetAtTime(0, now + duration, .12);
            wet.gain.setValueAtTime(0, end);
            this.input.connect(send);
            send.connect(delay);
            delay.connect(filter);
            filter.connect(feedback);
            feedback.connect(delay);
            delay.connect(wet);
            wet.connect(this.wetOutput);
            this.echo = { send, delay, filter, feedback, wet, end };
            this.until = end;
        }
        return effect;
    }
    private release(echo: Echo) {
        this.input.disconnect(echo.send);
        for (const node of [echo.send, echo.delay, echo.filter, echo.feedback, echo.wet])
            node.disconnect();
    }
    private hold(param: AudioParam, value: number) {
        const now = this.ctx.currentTime;
        if (typeof param.cancelAndHoldAtTime === 'function')
            param.cancelAndHoldAtTime(now);
        else {
            param.cancelScheduledValues(now);
            param.setValueAtTime(param.value, now);
        }
        param.setTargetAtTime(value, now, .01);
        param.setValueAtTime(value, now + .08);
    }
    cancel() {
        this.hold(this.filter.frequency, 20);
        this.until = 0;
        if (this.echo) {
            for (const node of [this.echo.send, this.echo.feedback, this.echo.wet])
                this.hold(node.gain, 0);
            this.retiring.push({ echo: this.echo, end: this.ctx.currentTime + .1 });
            this.echo = null;
        }
        this.tick();
    }
    tick() {
        const now = this.ctx.currentTime;
        if (this.echo && now >= this.echo.end) {
            this.release(this.echo);
            this.echo = null;
        }
        this.retiring = this.retiring.filter(item => { if (now < item.end)
            return true; this.release(item.echo); return false; });
    }
    get active() { return this.ctx.currentTime < this.until; }
    dispose() {
        this.cancel();
        for (const item of this.retiring)
            this.release(item.echo);
        this.retiring = [];
        this.input.disconnect(this.filter);
        this.filter.disconnect();
    }
}
