const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", require("./routes/userRoutes"));

app.listen(5000, () => {
  console.log("Server running on port 5000");
});