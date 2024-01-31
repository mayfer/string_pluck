export function sound(sample_rate: i32, buffer_size: i32, num_strings: i32, counter: i32): Float64Array {
  let duration: i32 = 6 * sample_rate;
  let arr = new Float64Array(buffer_size);
  for (let i = 0; i < buffer_size; i++) {
    let freq: i32 = 70;
    let cumulative: f64 = 0;
    let num_overtones: i32 = 15;
    let amp = 1;
    for(let j = 0; j < num_strings; j++) {
      let ofreq = freq;
      for(let k: i32 = 1; k <= num_overtones; k++) {
        let ofreq: i32 = freq * k;
        let damp : f64 = amp * Math.pow(1.0 - Math.min(1.0, counter as f64/duration as f64), 4.0*(ofreq as f64/freq as f64));
        cumulative += damp * Math.sin(Math.PI * 2 * ofreq * counter / sample_rate);
      }
    }
    arr[i] = cumulative / (num_overtones * num_strings);
    counter++;
  }
  return arr;
}
