const express = require("express");
const app = express();
app.get("/health", (req, res) => {
  res.json({ status: "ok", version: "1.0.0", timestamp: new Date() });
});
app.get("/api/users", (req, res) => {
  res.json([{ id: 1, name: "Patient A" }]);
});
app.get("/api/activities", (req, res) => {
  res.json([]);
});
app.listen(3000, () => console.log("VitalSync API v1.1 on :3000"));
