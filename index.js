//all requires
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion } = require("mongodb");

//function call
const app = express();
const port = process.env.PORT || 5000;

// all middleware
app.use(cors());
app.unsubscribe(express.json());

// mongodb connect
const uri = process.env.DB_URL;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
const secondSellDb = client.db("2nd-Sell");
const userCollection = secondSellDb.collection("users");
//listener
app.get("/", (req, res) => {
    res.send("2nd sell server");
});

app.listen(port, () => {
    client.connect((err) => {
        // console.log(err);
    });
    console.log("server is running with mongodb on ", port);
});
