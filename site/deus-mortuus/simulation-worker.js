let timer = null;

function start() {
  if (timer) return;
  timer = setInterval(() => postMessage({ type: "tick", now: Date.now() }), 100);
}

self.onmessage = event => {
  if (event.data?.type === "start") start();
  if (event.data?.type === "stop" && timer) { clearInterval(timer); timer = null; }
};

start();
