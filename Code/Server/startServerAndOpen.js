const { exec } = require("child_process");
const http = require("http");

async function checkServer(open) {
  console.log("Checking server status...");
  http.get("http://localhost:8000", (res) => {
    console.log("Server response status:", res.statusCode);
    if (res.statusCode === 200) {
      console.log("Server is up, opening the browser...");
      open("http://localhost:8000");
    } else {
      setTimeout(() => checkServer(open), 1000);
    }
  }).on("error", (err) => {
    // console.log("Error checking server:", err.message);
    setTimeout(() => checkServer(open), 1000);
  });
}

async function startServerAndOpen() {
  const open = (await import('open')).default;

  console.log("Starting server...");
  const serverProcess = exec("npm start");

  serverProcess.stdout.on("data", (data) => {
    console.log(`Server output: ${data}`);
  });

  serverProcess.stderr.on("data", (data) => {
    console.error(`Server error: ${data}`);
  });

  serverProcess.on("close", (code) => {
    console.log(`Server process exited with code ${code}`);
  });

  setTimeout(() => checkServer(open), 1000);
}

startServerAndOpen();
