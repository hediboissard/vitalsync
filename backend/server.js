const express = require("express");
const app = express();
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});
app.get("/api/users", (req, res) => {
  res.json([{ id: 1, name: "Patient A" }]);
});
app.get("/api/activities", (req, res) => {
  res.json([]);
});
app.listen(3000, () => console.log("VitalSync API running on port 3000 - v1.1"));
