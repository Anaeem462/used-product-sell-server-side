//all requires
const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;

// all middleware
app.use(cors());
app.unsubscribe(express.json());

//listener
app.get("/", (req, res) => {
    res.send("2nd sell server");
});

app.listen(port, () => {
    console.log("server is running on ", port);
});
