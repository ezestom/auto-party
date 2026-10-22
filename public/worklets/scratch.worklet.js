class ScratchProcessor extends AudioWorkletProcessor {
  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !output) return true;
    
    // Copy input samples to output channels directly (bypass)
    for (let channel = 0; channel < input.length; ++channel) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];
      if (!inputChannel || !outputChannel) continue;
      
      outputChannel.set(inputChannel);
    }
    return true;
  }
}

registerProcessor("scratch-processor", ScratchProcessor);
