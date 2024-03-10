const signals = [
  "SIGTERM",
  "SIGHUP",
  "SIGINT",
  "SIGQUIT",
  "SIGUSR1",
  "SIGUSR2",
];

for (const signal of signals) {
  process.on(signal, (catchedSignal) => {
    console.log("catched signal", catchedSignal);
  });
}

const oneHourInMs = 1000 * 60 * 60;

setTimeout(() => {
  console.log("one hour after, exiting.");
}, oneHourInMs);
